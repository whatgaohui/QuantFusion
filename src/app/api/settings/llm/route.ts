import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Provider default configurations
const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; temperature: number; maxTokens: number }> = {
  zai: { baseUrl: '', model: 'z-ai-general', temperature: 0.7, maxTokens: 4096 },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 4096 },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3.5-sonnet', temperature: 0.7, maxTokens: 4096 },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', temperature: 0.7, maxTokens: 4096 },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', temperature: 0.7, maxTokens: 4096 },
  custom: { baseUrl: '', model: '', temperature: 0.7, maxTokens: 4096 },
};

const CONFIG_KEYS = ['apiKey', 'baseUrl', 'model', 'temperature', 'maxTokens', 'enabled'] as const;

// GET — Retrieve all LLM provider configs
export async function GET() {
  try {
    const configs = await db.systemConfig.findMany({
      where: { category: 'llm' },
    });

    // Build response grouped by provider
    const result: Record<string, Record<string, string>> = {};

    // Initialize all providers with defaults
    for (const [provider, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
      result[provider] = {
        apiKey: '',
        baseUrl: defaults.baseUrl,
        model: defaults.model,
        temperature: defaults.temperature.toString(),
        maxTokens: defaults.maxTokens.toString(),
        enabled: provider === 'zai' ? 'true' : 'false',
      };
    }

    // Override with saved configs
    for (const config of configs) {
      // Key format: llm_{provider}_{field}
      const match = config.key.match(/^llm_(.+)_([a-zA-Z0-9]+)$/);
      if (match) {
        const provider = match[1];
        const field = match[2];
        if (result[provider] && CONFIG_KEYS.includes(field as typeof CONFIG_KEYS[number])) {
          result[provider][field] = config.value;
        }
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to load LLM configs:', error);
    return NextResponse.json({ success: false, error: '加载配置失败' }, { status: 500 });
  }
}

// POST — Save a provider config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, baseUrl, model, temperature, maxTokens, enabled } = body as {
      provider: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      enabled?: boolean;
    };

    if (!provider || !PROVIDER_DEFAULTS[provider]) {
      return NextResponse.json({ success: false, error: '无效的提供方' }, { status: 400 });
    }

    const fields: Record<string, string> = {};
    if (apiKey !== undefined) fields.apiKey = apiKey;
    if (baseUrl !== undefined) fields.baseUrl = baseUrl;
    if (model !== undefined) fields.model = model;
    if (temperature !== undefined) fields.temperature = temperature.toString();
    if (maxTokens !== undefined) fields.maxTokens = maxTokens.toString();
    if (enabled !== undefined) fields.enabled = enabled ? 'true' : 'false';

    // Upsert each config field
    for (const [field, value] of Object.entries(fields)) {
      const key = `llm_${provider}_${field}`;
      await db.systemConfig.upsert({
        where: { key },
        create: { key, value, category: 'llm' },
        update: { value },
      });
    }

    return NextResponse.json({ success: true, message: '配置已保存' });
  } catch (error) {
    console.error('Failed to save LLM config:', error);
    return NextResponse.json({ success: false, error: '保存配置失败' }, { status: 500 });
  }
}
