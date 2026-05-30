/**
 * Unified AI Service — single entry point for all LLM calls.
 *
 * Routes through the user's configured provider (z-ai / deepseek / openai /
 * anthropic / qwen / glm / custom). Falls back to z-ai SDK when the
 * configured provider fails.
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string | null;
  provider: string;
  model: string;
  tokens: number;
  cost: number;
}

export interface LLMConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Provider defaults
// ---------------------------------------------------------------------------

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  deepseek:  { baseUrl: 'https://api.deepseek.com/v1',                         model: 'deepseek-chat' },
  openai:    { baseUrl: 'https://api.openai.com/v1',                            model: 'gpt-4o' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1',                         model: 'claude-sonnet-4-20250514' },
  qwen:      { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',   model: 'qwen-plus' },
  glm:       { baseUrl: 'https://open.bigmodel.cn/api/paas/v4',                model: 'glm-4' },
};

// ---------------------------------------------------------------------------
// getLLMConfig — read from DB
// ---------------------------------------------------------------------------

const CONFIG_KEYS = [
  'llm_provider',
  'llm_api_key',
  'llm_base_url',
  'llm_model',
  'llm_temperature',
  'llm_max_tokens',
  'llm_enabled',
];

/**
 * Read the current LLM configuration from the `SystemConfig` table.
 * Returns sensible defaults when nothing is configured yet.
 */
export async function getLLMConfig(): Promise<LLMConfig> {
  const rows = await db.systemConfig.findMany({
    where: { key: { in: CONFIG_KEYS } },
  });

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  const provider = map.llm_provider || 'z-ai';
  const defaults = PROVIDER_DEFAULTS[provider];

  return {
    provider,
    apiKey:    map.llm_api_key    || '',
    baseUrl:   map.llm_base_url   || defaults?.baseUrl   || '',
    model:     map.llm_model      || defaults?.model     || 'default',
    temperature: parseFloat(map.llm_temperature || '0.7'),
    maxTokens:   parseInt(map.llm_max_tokens   || '4096', 10),
    enabled:     map.llm_enabled !== 'false',
  };
}

// ---------------------------------------------------------------------------
// Provider-specific call helpers
// ---------------------------------------------------------------------------

/** Call z-ai via the SDK (free, no key needed). */
async function callZaiSDK(
  messages: ChatMessage[],
  temperature?: number,
  maxTokens?: number,
): Promise<ChatCompletionResult> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();

  const result = await zai.chat.completions.create({
    model: 'default',
    messages,
    thinking: { type: 'disabled' },
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
  });

  const content = result?.choices?.[0]?.message?.content ?? null;
  const tokens = (result?.usage?.prompt_tokens ?? 0) + (result?.usage?.completion_tokens ?? 0);

  return {
    content,
    provider: 'z-ai',
    model: 'default',
    tokens,
    cost: 0, // z-ai is free
  };
}

/** Call an OpenAI-compatible API (deepseek, openai, qwen, glm, custom). */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature?: number,
  maxTokens?: number,
): Promise<ChatCompletionResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 4096,
    stream: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `OpenAI-compatible provider returned ${res.status}: ${text.slice(0, 300)}`,
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? null;
  const tokens = (data?.usage?.prompt_tokens ?? 0) + (data?.usage?.completion_tokens ?? 0);

  return {
    content,
    provider: 'openai-compatible',
    model,
    tokens,
    cost: 0, // cost calculation handled externally if needed
  };
}

/** Call the Anthropic Messages API. */
async function callAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature?: number,
  maxTokens?: number,
): Promise<ChatCompletionResult> {
  const url = `${baseUrl.replace(/\/+$/, '')}/messages`;

  // Anthropic expects `system` as a top-level param, not in messages array
  const systemMessage = messages.find((m) => m.role === 'system')?.content ?? '';
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model,
    messages: chatMessages,
    max_tokens: maxTokens ?? 4096,
    temperature: temperature ?? 0.7,
  };
  if (systemMessage) {
    body.system = systemMessage;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Anthropic provider returned ${res.status}: ${text.slice(0, 300)}`,
    );
  }

  const data = await res.json();
  // Anthropic returns content as array of blocks
  const content =
    Array.isArray(data?.content)
      ? data.content
          .filter((b: { type: string }) => b.type === 'text')
          .map((b: { text: string }) => b.text)
          .join('\n')
      : null;

  const inputTokens = data?.usage?.input_tokens ?? 0;
  const outputTokens = data?.usage?.output_tokens ?? 0;

  return {
    content,
    provider: 'anthropic',
    model,
    tokens: inputTokens + outputTokens,
    cost: 0,
  };
}

// ---------------------------------------------------------------------------
// Main entry — createChatCompletion
// ---------------------------------------------------------------------------

/**
 * Send a chat completion request through the user's configured LLM provider.
 *
 * If the configured provider fails, automatically falls back to the free
 * z-ai SDK. If that also fails, throws a descriptive error.
 */
export async function createChatCompletion(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const { messages, temperature, maxTokens, stream } = options;

  // Read the latest config from DB
  const config = await getLLMConfig();

  // If provider is z-ai or config is disabled / unconfigured → go straight to SDK
  if (config.provider === 'z-ai' || !config.enabled || !config.apiKey) {
    try {
      return await callZaiSDK(messages, temperature, maxTokens);
    } catch (sdkErr) {
      throw new Error(
        `z-ai SDK call failed: ${sdkErr instanceof Error ? sdkErr.message : String(sdkErr)}`,
      );
    }
  }

  // --- Attempt with the configured provider ---
  try {
    let result: ChatCompletionResult;

    switch (config.provider) {
      case 'anthropic':
        result = await callAnthropic(
          config.baseUrl,
          config.apiKey,
          config.model,
          messages,
          temperature ?? config.temperature,
          maxTokens ?? config.maxTokens,
        );
        break;

      case 'deepseek':
      case 'openai':
      case 'qwen':
      case 'glm':
      case 'custom':
        result = await callOpenAICompatible(
          config.baseUrl,
          config.apiKey,
          config.model,
          messages,
          temperature ?? config.temperature,
          maxTokens ?? config.maxTokens,
        );
        break;

      default:
        // Unknown provider — try OpenAI-compatible as a best-effort
        result = await callOpenAICompatible(
          config.baseUrl,
          config.apiKey,
          config.model,
          messages,
          temperature ?? config.temperature,
          maxTokens ?? config.maxTokens,
        );
    }

    // Stamp the actual provider name
    result.provider = config.provider;
    return result;
  } catch (primaryErr) {
    // Log the primary provider failure
    console.warn(
      `[ai-service] Provider "${config.provider}" failed, falling back to z-ai SDK:`,
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    );

    // --- Fallback to z-ai SDK ---
    try {
      const fallback = await callZaiSDK(messages, temperature, maxTokens);
      fallback.provider = `${config.provider}→z-ai-fallback`;
      return fallback;
    } catch (sdkErr) {
      throw new Error(
        `Both primary provider ("${config.provider}") and z-ai fallback failed. ` +
        `Primary: ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}. ` +
        `Fallback: ${sdkErr instanceof Error ? sdkErr.message : String(sdkErr)}`,
      );
    }
  }
}
