import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

// ==================== Timeout Helper ====================
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// ==================== LLM Provider Config ====================
interface LLMProviderConfig {
  provider: string;  // zai / deepseek / openai / anthropic / qwen / glm / custom
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; temperature: number; maxTokens: number }> = {
  zai: { baseUrl: '', model: 'z-ai-general', temperature: 0.7, maxTokens: 4096 },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 4096 },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3.5-sonnet', temperature: 0.7, maxTokens: 4096 },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', temperature: 0.7, maxTokens: 4096 },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', temperature: 0.7, maxTokens: 4096 },
  custom: { baseUrl: '', model: '', temperature: 0.7, maxTokens: 4096 },
};

// Cache provider config for 60 seconds to avoid DB hits on every request
let cachedConfig: LLMProviderConfig | null = null;
let configCacheExpiry = 0;
const CONFIG_CACHE_TTL = 60000; // 60 seconds

async function getActiveProviderConfig(): Promise<LLMProviderConfig> {
  // Return cached config if still valid
  if (cachedConfig && Date.now() < configCacheExpiry) {
    return cachedConfig;
  }

  try {
    const configs = await db.systemConfig.findMany({
      where: { category: 'llm' },
    });

    // Collect all provider fields from DB
    const providerFields: Record<string, Record<string, string>> = {};
    const enabledProviders: string[] = [];

    for (const config of configs) {
      const match = config.key.match(/^llm_(.+)_([a-zA-Z0-9]+)$/);
      if (match) {
        const provider = match[1];
        const field = match[2];
        if (!providerFields[provider]) providerFields[provider] = {};
        providerFields[provider][field] = config.value;

        if (field === 'enabled' && config.value === 'true') {
          enabledProviders.push(provider);
        }
      }
    }

    // Select the active provider:
    // 1. If only one is enabled, use it
    // 2. If multiple are enabled, prefer non-ZAI providers with valid API keys
    // 3. If none are enabled or no valid API key, fall back to ZAI (free, no key needed)
    let enabledProvider = 'zai'; // default

    if (enabledProviders.length === 1) {
      enabledProvider = enabledProviders[0];
    } else if (enabledProviders.length > 1) {
      // Multiple enabled — pick the first non-ZAI one that has an API key
      const nonZaiEnabled = enabledProviders.find(p => p !== 'zai' && providerFields[p]?.apiKey);
      if (nonZaiEnabled) {
        enabledProvider = nonZaiEnabled;
      } else {
        // Fall back to ZAI
        enabledProvider = 'zai';
      }
    }

    const defaults = PROVIDER_DEFAULTS[enabledProvider] || PROVIDER_DEFAULTS.zai;
    const fields = providerFields[enabledProvider] || {};

    // For non-ZAI providers, verify API key exists
    if (enabledProvider !== 'zai' && !fields.apiKey) {
      console.warn(`[AI Service] Provider ${enabledProvider} is enabled but has no API key, falling back to ZAI`);
      enabledProvider = 'zai';
    }

    cachedConfig = {
      provider: enabledProvider,
      apiKey: fields.apiKey || '',
      baseUrl: fields.baseUrl || defaults.baseUrl,
      model: fields.model || defaults.model,
      temperature: parseFloat(fields.temperature) || defaults.temperature,
      maxTokens: parseInt(fields.maxTokens) || defaults.maxTokens,
      enabled: true,
    };
    configCacheExpiry = Date.now() + CONFIG_CACHE_TTL;

    console.log(`[AI Service] Active provider: ${cachedConfig.provider}, model: ${cachedConfig.model}`);
    return cachedConfig;
  } catch (err) {
    console.error('[AI Service] Failed to load provider config from DB, using ZAI default:', err);
    cachedConfig = {
      provider: 'zai',
      apiKey: '',
      baseUrl: '',
      model: 'z-ai-general',
      temperature: 0.7,
      maxTokens: 4096,
      enabled: true,
    };
    configCacheExpiry = Date.now() + CONFIG_CACHE_TTL;
    return cachedConfig;
  }
}

/**
 * Invalidate the provider config cache (call after saving settings)
 */
export function invalidateProviderCache(): void {
  cachedConfig = null;
  configCacheExpiry = 0;
  // Also reset ZAI instance since provider might have changed
  zaiInstance = null;
  zaiInitPromise = null;
}

// ==================== ZAI Singleton ====================
let zaiInstance: ZAI | null = null;
let zaiInitPromise: Promise<ZAI> | null = null;

async function getZAI(): Promise<ZAI> {
  if (zaiInstance) return zaiInstance;
  if (zaiInitPromise) return zaiInitPromise;

  zaiInitPromise = (async () => {
    try {
      zaiInstance = await withTimeout(ZAI.create(), 10000);
      return zaiInstance;
    } catch (err) {
      zaiInitPromise = null;
      throw err;
    }
  })();

  return zaiInitPromise;
}

// ==================== Unified Chat Completion ====================
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResult {
  content: string;
  provider: string;
  model: string;
}

/**
 * Unified chat completion — routes to the correct provider based on settings
 */
async function createChatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; timeout?: number }
): Promise<ChatCompletionResult> {
  const config = await getActiveProviderConfig();
  const temperature = options?.temperature ?? config.temperature;
  const maxTokens = options?.maxTokens ?? config.maxTokens;
  const timeout = options?.timeout ?? 60000;

  // ZAI provider uses SDK
  if (config.provider === 'zai') {
    const zai = await getZAI();
    // ZAI SDK uses 'assistant' role for system prompts
    const zaiMessages = messages.map(m => ({
      role: m.role === 'system' ? 'assistant' as const : m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const completion = await withTimeout(
      zai.chat.completions.create({ messages: zaiMessages, thinking: { type: 'disabled' } }),
      timeout
    );

    const content = completion.choices[0]?.message?.content || '';
    return { content, provider: 'zai', model: config.model };
  }

  // Anthropic provider uses different API format
  if (config.provider === 'anthropic') {
    return await callAnthropicAPI(config, messages, temperature, maxTokens, timeout);
  }

  // All other providers use OpenAI-compatible API
  return await callOpenAICompatibleAPI(config, messages, temperature, maxTokens, timeout);
}

/**
 * Call OpenAI-compatible chat completions API (DeepSeek, OpenAI, Qwen, GLM, custom)
 */
async function callOpenAICompatibleAPI(
  config: LLMProviderConfig,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  timeout: number
): Promise<ChatCompletionResult> {
  if (!config.apiKey) {
    throw new Error(`API Key not configured for provider: ${config.provider}. Please configure it in Settings.`);
  }

  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model: config.model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return { content, provider: config.provider, model: config.model };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request to ${config.provider} timed out after ${timeout}ms`);
    }
    throw err;
  }
}

/**
 * Call Anthropic Messages API
 */
async function callAnthropicAPI(
  config: LLMProviderConfig,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  timeout: number
): Promise<ChatCompletionResult> {
  if (!config.apiKey) {
    throw new Error('API Key not configured for Anthropic. Please configure it in Settings.');
  }

  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/v1/messages`;

  // Anthropic requires system message to be separate
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const body = {
    model: config.model,
    max_tokens: maxTokens,
    system: systemMessage,
    messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
    temperature,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return { content, provider: 'anthropic', model: config.model };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request to Anthropic timed out after ${timeout}ms`);
    }
    throw err;
  }
}

// ==================== Conversation Memory ====================
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const conversations = new Map<string, ConversationMessage[]>();
const MAX_SESSIONS = 50;
const MAX_MESSAGES = 20;

function getConversation(sessionId: string): ConversationMessage[] {
  return conversations.get(sessionId) || [];
}

function addMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
  if (!conversations.has(sessionId)) {
    if (conversations.size >= MAX_SESSIONS) {
      const firstKey = conversations.keys().next().value;
      if (firstKey) conversations.delete(firstKey);
    }
    conversations.set(sessionId, []);
  }
  const msgs = conversations.get(sessionId)!;
  msgs.push({ role, content });
  if (msgs.length > MAX_MESSAGES) {
    conversations.set(sessionId, msgs.slice(-MAX_MESSAGES));
  }
}

function clearConversation(sessionId: string): void {
  conversations.delete(sessionId);
}

// ==================== System Prompts ====================

const TRADING_ASSISTANT_SYSTEM = `你是QuantFusion AI量化交易助手，一位专业的金融分析师和投资顾问。

你的核心能力：
1. **股票分析** - 技术面、基本面、资金面全方位分析
2. **市场解读** - A股、港股、美股市场趋势洞察
3. **策略建议** - 基于量化指标的交易策略推荐
4. **风险评估** - 个股和组合风险分析

回答规范：
- 使用专业但易懂的语言
- 给出具体的数据和指标支持观点
- 明确标注风险提示
- 如涉及具体操作建议，必须声明"以上分析仅供参考，不构成投资建议"
- 回复使用中文，除非用户使用英文提问
- 使用Markdown格式回复，包含标题(##/###)、列表(-)、加粗(**)等格式
- 对于股票分析，使用以下结构：## 股票名称(代码) 分析 → ### 技术面 → ### 基本面 → ### 投资建议`;

const STOCK_ANALYSIS_SYSTEM = `你是一位专业的量化分析师，负责对股票进行深度分析。

分析框架：
1. **技术分析** - 基于提供价格数据、技术指标（MA/MACD/RSI/KDJ/布林带）进行分析
2. **基本面评估** - 估值水平、行业地位、成长性评估
3. **市场情绪** - 当前市场对标的的情绪倾向
4. **风险评估** - 潜在风险点和压力位

输出格式（必须使用JSON）：
{
  "technical": "技术分析摘要，2-3句话",
  "fundamental": "基本面评估，2-3句话",  
  "sentiment": "市场情绪判断，1-2句话",
  "risk": "风险提示，1-2句话",
  "recommendation": "BUY/HOLD/SELL",
  "score": 0-100,
  "confidence": "high/medium/low",
  "summary": "整体分析总结，3-5句话"
}`;

const DEEP_ANALYSIS_SYSTEM = `你是QuantFusion AI高级量化分析师，擅长深度多维度分析。

你的分析框架：
1. **技术面深度分析** - 结合MA/MACD/RSI/KDJ/布林带等多指标综合研判，指出关键支撑阻力位
2. **基本面评估** - 估值水平(PE/PB/PS)、行业对比、成长性、盈利质量
3. **资金面分析** - 主力资金流向、北向资金动向、融资融券变化
4. **市场情绪** - 机构观点、分析师评级变化、舆情热点
5. **风险评估** - 系统性风险、行业风险、个股风险、流动性风险
6. **操作建议** - 具体入场点位、止损止盈策略、仓位管理建议

回答规范：
- 必须进行深入、全面的分析，字数不少于800字
- 使用Markdown格式，包含详细的数据和指标
- 给出明确的操作建议和风险提示
- 声明"以上分析仅供参考，不构成投资建议"
- 使用中文回复`;

const MARKET_BRIEF_SYSTEM = `你是QuantFusion的市场分析师，负责生成每日市场简报。

要求：
- 简明扼要，重点突出
- 包含A股、港股、美股三大市场概况
- 标注关键数据变化
- 提供后市展望
- 使用中文输出`;

// ==================== Public API Functions ====================

/**
 * Chat with the trading assistant
 */
export async function chatWithAssistant(
  message: string,
  sessionId: string,
  mode: 'quick' | 'deep' = 'quick'
): Promise<{ response: string; isOffline: boolean; error?: string; provider?: string }> {
  const maxRetries = 2;
  const timeoutMs = mode === 'deep' ? 90000 : 60000;
  const systemPrompt = mode === 'deep' ? DEEP_ANALYSIS_SYSTEM : TRADING_ASSISTANT_SYSTEM;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const history = getConversation(sessionId);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: mode === 'deep' ? `请对以下问题进行深度多维度分析：\n\n${message}` : message }
      ];

      const result = await createChatCompletion(messages, { timeout: timeoutMs });

      if (!result.content || result.content.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      // Save to conversation memory
      addMessage(sessionId, 'user', message);
      addMessage(sessionId, 'assistant', result.content);

      return { response: result.content, isOffline: false, provider: result.provider };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Chat with assistant failed (attempt ${attempt + 1}/${maxRetries + 1}):`, errorMsg);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }

      return { response: '', isOffline: true, error: errorMsg };
    }
  }

  return { response: '', isOffline: true, error: 'Max retries exceeded' };
}

/**
 * Analyze a stock using AI
 */
export async function analyzeStock(
  symbol: string,
  stockName: string,
  marketData: {
    price?: number;
    change?: number;
    changePercent?: number;
    indicators?: Record<string, unknown>;
    kline?: { c: number[]; h: number[]; l: number[]; o: number[]; v: number[] };
  },
  mode: 'quick' | 'standard' | 'full' | 'debate' = 'standard'
): Promise<{
  analysis: {
    technical: string;
    fundamental: string;
    sentiment: string;
    risk: string;
    recommendation: string;
    score: number;
    confidence: string;
    summary: string;
    bullCase?: string;
    bearCase?: string;
  };
  isOffline: boolean;
}> {
  try {
    const dataContext = `
股票: ${stockName} (${symbol})
当前价格: ${marketData.price || 'N/A'}
涨跌幅: ${marketData.changePercent ? marketData.changePercent.toFixed(2) + '%' : 'N/A'}
${marketData.indicators ? `技术指标: ${JSON.stringify(marketData.indicators, null, 2)}` : ''}
${marketData.kline ? `最近5日收盘价: ${marketData.kline.c.slice(-5).join(', ')}` : ''}
    `.trim();

    const modeInstructions = {
      quick: '请快速分析，给出核心观点和推荐。',
      standard: '请按照标准分析框架进行全面分析，给出详细的技术面、基本面、情绪面和风险评估。',
      full: '请进行最深入全面的分析，包括技术面细节、基本面深度评估、市场情绪分析、风险因素、以及详细的操作建议。',
      debate: '请进行多空辩论分析：先从多头角度论述买入理由，再从空头角度论述卖出理由，最后给出综合判断。'
    };

    const userPrompt = `${dataContext}\n\n分析模式: ${modeInstructions[mode]}`;

    let systemPrompt = STOCK_ANALYSIS_SYSTEM;
    if (mode === 'debate') {
      systemPrompt += `\n\n对于辩论模式，额外输出：
- bullCase: 多头论点，3-5句话
- bearCase: 空头论点，3-5句话`;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const result = await createChatCompletion(messages, { timeout: 30000 });

    if (!result.content || result.content.trim().length === 0) {
      throw new Error('Empty analysis response');
    }

    // Try to parse as JSON, fallback to structured extraction
    let analysis;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // Fallback: create structured analysis from plain text
      analysis = {
        technical: result.content.substring(0, 200),
        fundamental: '基于当前市场数据的综合评估',
        sentiment: '中性',
        risk: '市场波动风险',
        recommendation: 'HOLD',
        score: 50,
        confidence: 'medium',
        summary: result.content.substring(0, 500)
      };
    }

    return { analysis, isOffline: false };
  } catch (err) {
    console.error('Stock analysis failed:', err);
    return {
      analysis: {
        technical: '',
        fundamental: '',
        sentiment: '',
        risk: '',
        recommendation: 'HOLD',
        score: 0,
        confidence: 'low',
        summary: ''
      },
      isOffline: true
    };
  }
}

/**
 * Generate AI market brief
 */
export async function generateMarketBrief(
  marketData: {
    indices?: Array<{ name: string; price: number; change: number; changePercent: number; market: string }>;
    news?: Array<{ headline: string; sentiment?: string }>;
  }
): Promise<{ brief: string; isOffline: boolean }> {
  try {
    const dataContext = `
市场数据:
${marketData.indices?.map(i => `- ${i.name}: ${i.price} (${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`).join('\n') || '暂无指数数据'}

最新新闻:
${marketData.news?.slice(0, 5).map(n => `- ${n.headline}`).join('\n') || '暂无新闻数据'}
    `.trim();

    const messages: ChatMessage[] = [
      { role: 'system', content: MARKET_BRIEF_SYSTEM },
      { role: 'user', content: `基于以下数据生成今日市场简报:\n\n${dataContext}` }
    ];

    const result = await createChatCompletion(messages, { timeout: 25000 });
    const brief = result.content;
    return { brief, isOffline: !brief };
  } catch (err) {
    console.error('Market brief generation failed:', err);
    return { brief: '', isOffline: true };
  }
}

/**
 * Search web for stock/market news and synthesize with LLM
 * Note: Web search is only available through ZAI SDK
 */
export async function searchAndAnalyze(
  query: string,
  language: 'zh' | 'en' = 'zh'
): Promise<{ result: string; sources: Array<{ title: string; url: string }>; isOffline: boolean }> {
  try {
    const zai = await getZAI();

    // Step 1: Web search (ZAI SDK only)
    const searchResults = await zai.functions.invoke('web_search', {
      query,
      num: 8
    });

    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      throw new Error('No search results found');
    }

    // Step 2: Synthesize with LLM (use configured provider)
    const searchContext = searchResults
      .slice(0, 5)
      .map((r: { name: string; snippet: string; url: string }, i: number) => `${i + 1}. ${r.name}\n${r.snippet}`)
      .join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: language === 'zh'
          ? '你是一位专业的金融分析师。基于搜索结果，提供准确、客观的分析。使用中文回答。'
          : 'You are a professional financial analyst. Provide accurate, objective analysis based on search results.'
      },
      {
        role: 'user',
        content: `查询: "${query}"\n\n搜索结果:\n${searchContext}\n\n请综合以上信息，提供详细的分析报告。`
      }
    ];

    const result = await createChatCompletion(messages, { timeout: 25000 });

    const sources = searchResults.slice(0, 5).map((r: { name: string; url: string }) => ({
      title: r.name,
      url: r.url
    }));

    return { result: result.content, sources, isOffline: false };
  } catch (err) {
    console.error('Search and analyze failed:', err);
    return { result: '', sources: [], isOffline: true };
  }
}

/**
 * Clear a conversation session
 */
export function clearSession(sessionId: string): void {
  clearConversation(sessionId);
}

/**
 * Check if AI service is available
 */
export async function checkAIHealth(): Promise<boolean> {
  try {
    const result = await createChatCompletion(
      [
        { role: 'system', content: 'Respond with OK.' },
        { role: 'user', content: 'Health check' }
      ],
      { timeout: 10000 }
    );
    return !!result.content;
  } catch {
    return false;
  }
}

/**
 * Test a specific provider connection (for settings page)
 */
export async function testProviderConnection(
  provider: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (provider === 'zai') {
      // ZAI is free, just check if SDK initializes
      const zai = await getZAI();
      const completion = await withTimeout(
        zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: 'Respond with OK.' },
            { role: 'user', content: 'Hello' }
          ],
          thinking: { type: 'disabled' }
        }),
        15000
      );
      const content = completion.choices[0]?.message?.content;
      return { success: !!content, message: content ? 'ZAI连接成功' : 'ZAI返回空响应' };
    }

    if (provider === 'anthropic') {
      if (!apiKey) return { success: false, message: 'API Key 不能为空' };
      const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3.5-sonnet',
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Hello, respond with OK' }],
        }),
      });
      if (response.ok) {
        return { success: true, message: `${provider} 连接成功` };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { success: false, message: `连接失败 (${response.status}): ${errorText.substring(0, 200)}` };
      }
    }

    // OpenAI-compatible providers
    if (!apiKey) return { success: false, message: 'API Key 不能为空' };
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello, respond with OK' }],
        max_tokens: 50,
      }),
    });
    if (response.ok) {
      return { success: true, message: `${provider} 连接成功` };
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { success: false, message: `连接失败 (${response.status}): ${errorText.substring(0, 200)}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `连接失败: ${msg}` };
  }
}
