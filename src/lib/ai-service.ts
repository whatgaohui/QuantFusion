import ZAI from 'z-ai-web-dev-sdk';

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

// ==================== Conversation Memory ====================
// Simple in-memory conversation store (max 50 sessions, max 20 messages each)
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
    // Evict oldest session if at capacity
    if (conversations.size >= MAX_SESSIONS) {
      const firstKey = conversations.keys().next().value;
      if (firstKey) conversations.delete(firstKey);
    }
    conversations.set(sessionId, []);
  }
  const msgs = conversations.get(sessionId)!;
  msgs.push({ role, content });
  // Trim old messages if exceeding limit
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
- 回复使用中文，除非用户使用英文提问`;

const STOCK_ANALYSIS_SYSTEM = `你是一位专业的量化分析师，负责对股票进行深度分析。

分析框架：
1. **技术分析** - 基于提供的价格数据、技术指标（MA/MACD/RSI/KDJ/布林带）进行分析
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
): Promise<{ response: string; isOffline: boolean }> {
  try {
    const zai = await getZAI();
    const history = getConversation(sessionId);

    // Build messages array — use 'assistant' role for system prompts per SDK convention
    const messages = [
      { role: 'assistant' as const, content: TRADING_ASSISTANT_SYSTEM },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message }
    ];

    const completion = await withTimeout(
      zai.chat.completions.create({ messages, thinking: { type: 'disabled' } }),
      25000
    );

    const response = completion.choices[0]?.message?.content || '';

    if (!response || response.trim().length === 0) {
      throw new Error('Empty response from AI');
    }

    // Save to conversation memory
    addMessage(sessionId, 'user', message);
    addMessage(sessionId, 'assistant', response);

    // For deep mode, we could add extended thinking; for now just return the response
    void mode; // mode reserved for future deep-thinking integration

    return { response, isOffline: false };
  } catch (err) {
    console.error('Chat with assistant failed:', err);
    return { response: '', isOffline: true };
  }
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
    const zai = await getZAI();

    // Build analysis prompt with real data
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

    // Use 'assistant' role for system prompts per SDK convention
    const messages = [
      { role: 'assistant' as const, content: STOCK_ANALYSIS_SYSTEM },
      { role: 'user' as const, content: userPrompt }
    ];

    // For debate mode, add bull/bear fields to system prompt
    if (mode === 'debate') {
      messages[0].content += `\n\n对于辩论模式，额外输出：
- bullCase: 多头论点，3-5句话
- bearCase: 空头论点，3-5句话`;
    }

    const completion = await withTimeout(
      zai.chat.completions.create({ messages, thinking: { type: 'disabled' } }),
      30000
    );

    const response = completion.choices[0]?.message?.content || '';

    if (!response || response.trim().length === 0) {
      throw new Error('Empty analysis response');
    }

    // Try to parse as JSON, fallback to structured extraction
    let analysis;
    try {
      // Extract JSON from response (might be wrapped in markdown code block)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // Fallback: create structured analysis from plain text
      analysis = {
        technical: response.substring(0, 200),
        fundamental: '基于当前市场数据的综合评估',
        sentiment: '中性',
        risk: '市场波动风险',
        recommendation: 'HOLD',
        score: 50,
        confidence: 'medium',
        summary: response.substring(0, 500)
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
    const zai = await getZAI();

    const dataContext = `
市场数据:
${marketData.indices?.map(i => `- ${i.name}: ${i.price} (${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`).join('\n') || '暂无指数数据'}

最新新闻:
${marketData.news?.slice(0, 5).map(n => `- ${n.headline}`).join('\n') || '暂无新闻数据'}
    `.trim();

    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: MARKET_BRIEF_SYSTEM },
          { role: 'user', content: `基于以下数据生成今日市场简报:\n\n${dataContext}` }
        ],
        thinking: { type: 'disabled' }
      }),
      25000
    );

    const brief = completion.choices[0]?.message?.content || '';
    return { brief, isOffline: !brief };
  } catch (err) {
    console.error('Market brief generation failed:', err);
    return { brief: '', isOffline: true };
  }
}

/**
 * Search web for stock/market news and synthesize with LLM
 */
export async function searchAndAnalyze(
  query: string,
  language: 'zh' | 'en' = 'zh'
): Promise<{ result: string; sources: Array<{ title: string; url: string }>; isOffline: boolean }> {
  try {
    const zai = await getZAI();

    // Step 1: Web search
    const searchResults = await zai.functions.invoke('web_search', {
      query,
      num: 8
    });

    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      throw new Error('No search results found');
    }

    // Step 2: Synthesize with LLM
    const searchContext = searchResults
      .slice(0, 5)
      .map((r: { name: string; snippet: string; url: string }, i: number) => `${i + 1}. ${r.name}\n${r.snippet}`)
      .join('\n\n');

    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content: language === 'zh'
              ? '你是一位专业的金融分析师。基于搜索结果，提供准确、客观的分析。使用中文回答。'
              : 'You are a professional financial analyst. Provide accurate, objective analysis based on search results.'
          },
          {
            role: 'user',
            content: `查询: "${query}"\n\n搜索结果:\n${searchContext}\n\n请综合以上信息，提供详细的分析报告。`
          }
      ],
      thinking: { type: 'disabled' }
    }),
      25000
    );

    const result = completion.choices[0]?.message?.content || '';
    const sources = searchResults.slice(0, 5).map((r: { name: string; url: string }) => ({
      title: r.name,
      url: r.url
    }));

    return { result, sources, isOffline: false };
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
    const zai = await getZAI();
    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'Respond with OK.' },
          { role: 'user', content: 'Health check' }
        ],
        thinking: { type: 'disabled' }
      }),
      10000
    );
    return !!completion.choices[0]?.message?.content;
  } catch {
    return false;
  }
}
