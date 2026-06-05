import { NextRequest, NextResponse } from 'next/server';
import { createChatCompletion } from '@/lib/ai-service';
import type { ChatMessage } from '@/lib/ai-service';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;

const SYSTEM_PROMPT = `你是一位专业的量化交易AI助手，擅长以下领域：

1. **技术分析**：RSI、MACD、布林带、均线系统、KDJ、成交量分析
2. **基本面分析**：财务报表、估值指标、成长性分析
3. **市场情绪**：新闻分析、社交媒体情绪、分析师评级
4. **风险管理**：仓位管理、止损策略、投资组合优化
5. **交易策略**：趋势跟踪、均值回归、突破策略、动量策略
6. **回测验证**：策略验证、绩效指标（夏普比率、最大回撤、胜率）

指导原则：
- 提供数据驱动、分析性的回答
- 讨论股票时包含具体数字、价格位和指标
- 同时考虑看多和看空因素
- 始终提及风险因素
- 使用Markdown格式使回答结构清晰
- 如果被问到具体股票，尽量提供当前背景（价格水平、近期新闻、技术位）
- 简洁但全面
- 不提供个人理财建议，始终以分析框架表述
- 请使用中文回答

你可以通过Finnhub API获取美股实时市场数据。对于A股/港股市场，基于你的知识进行分析。`;

interface ChatRequest {
  message: string;
  mode?: 'quick' | 'deep';
  session_id?: string;
  history?: { role: string; content: string }[];
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function getStockContext(message: string): Promise<string> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  // Extract potential stock symbols from the message
  const symbolPattern = /\b([A-Z]{1,5})\b/g;
  const matches = message.match(symbolPattern);
  const commonSymbols = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'NFLX', 'JPM', 'BAC', 'V', 'MA', 'DIS', 'PFE', 'JNJ', 'XOM', 'CVX', 'WMT', 'KO'];

  const symbols = (matches || []).filter(s => commonSymbols.includes(s)).slice(0, 3);
  if (symbols.length === 0 || !FINNHUB_API_KEY) return '';

  const contextParts: string[] = [];

  for (const symbol of symbols) {
    try {
      const quoteRes = await fetchWithTimeout(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        FINNHUB_TIMEOUT
      );
      if (quoteRes.ok) {
        const quote = await quoteRes.json();
        if (quote.c) {
          contextParts.push(`${symbol}: Price $${quote.c}, Change ${quote.d >= 0 ? '+' : ''}${quote.d} (${quote.dp >= 0 ? '+' : ''}${quote.dp}%)`);
        }
      }
    } catch {
      // Skip this symbol
    }
  }

  return contextParts.length > 0
    ? `\n\nCurrent Market Data:\n${contextParts.join('\n')}`
    : '';
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, mode = 'quick', history = [] } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Try to use AI service (routes through user's configured provider)
    try {
      // Get stock context from Finnhub
      const stockContext = await getStockContext(message);

      const modePrompt = mode === 'deep'
        ? '请提供详细、全面的分析，包含多个章节。'
        : '请提供简洁但信息丰富的回答。';

      const messages: ChatMessage[] = [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${modePrompt}` },
        ...history.slice(-10).map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: message + stockContext },
      ];

      const result = await createChatCompletion({ messages });

      if (result.content) {
        return NextResponse.json({
          content: result.content,
          role: 'assistant',
          provider: result.provider,
          tokens: result.tokens,
        });
      }
    } catch (aiError) {
      console.error('[fusion/agent/chat] AI service error, falling back to mock:', aiError);
    }

    // Fallback mock response — clearly indicate it's simulated
    const mockContent = `⚠️ **AI 服务暂不可用**

当前无法连接到 AI 模型，以下为模拟回复。

您的问题："${message}"

### 建议
1. 请在 **设置 → LLM** 中配置 AI 提供商（如 Z.ai 免费、DeepSeek 等）
2. 如果已配置，请检查 API Key 是否正确
3. 可以点击「测试连接」验证配置

配置完成后，AI 助手将为您提供专业的量化分析。`;

    return NextResponse.json({
      content: mockContent,
      role: 'assistant',
      provider: 'mock',
      tokens: 0,
    });
  } catch (error) {
    console.error('[fusion/agent/chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
