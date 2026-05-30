import { NextRequest, NextResponse } from 'next/server';
import { createChatCompletion } from '@/lib/ai-service';
import type { ChatMessage } from '@/lib/ai-service';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;

const SYSTEM_PROMPT = `You are an expert quantitative trading assistant for the QuantFusion platform. You specialize in:

1. **Technical Analysis**: RSI, MACD, Bollinger Bands, Moving Averages, KDJ, Volume Analysis
2. **Fundamental Analysis**: Financial statements, valuation metrics, growth analysis
3. **Market Sentiment**: News analysis, social sentiment, analyst ratings
4. **Risk Management**: Position sizing, stop-loss strategies, portfolio optimization
5. **Trading Strategies**: Trend following, mean reversion, breakout, momentum strategies
6. **Backtesting**: Strategy validation, performance metrics (Sharpe ratio, max drawdown, win rate)

Guidelines:
- Provide data-driven, analytical responses
- Include specific numbers, levels, and indicators when discussing stocks
- Consider both bull and bear cases
- Always mention risk factors
- Use markdown formatting for structured responses
- If asked about specific stocks, try to provide current context (price levels, recent news, technical levels)
- Be concise but thorough
- Do not provide personal financial advice; always frame as analysis

You have access to real-time market data via Finnhub API for US stocks. For Chinese/HK markets, provide analysis based on your knowledge.`;

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
        ? 'Provide a detailed, comprehensive analysis with multiple sections.'
        : 'Provide a concise but informative response.';

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
