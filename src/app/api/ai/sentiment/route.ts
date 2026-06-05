import { NextRequest, NextResponse } from 'next/server';
import { createChatCompletion } from '@/lib/ai-service';
import type { ChatMessage } from '@/lib/ai-service';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const AI_TIMEOUT = 8000;

// --- 30-second in-memory cache ---

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const sentimentCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 1000; // 30 seconds

function getCached(symbol: string): unknown | null {
  const entry = sentimentCache.get(symbol);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  if (entry) sentimentCache.delete(symbol);
  return null;
}

function setCache(symbol: string, data: unknown): void {
  sentimentCache.set(symbol, { data, timestamp: Date.now() });
}

// --- Deterministic fallback based on symbol hash ---

function hashSymbol(symbol: string): number {
  return symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function generateFallbackSentiment(symbol: string, name?: string) {
  const h = hashSymbol(symbol);
  const seed = (h % 100) / 100;
  const score = Math.round(30 + seed * 40); // 30-70
  const labels = ['BEARISH', 'NEUTRAL', 'BULLISH'];
  const label = score < 40 ? labels[0] : score < 55 ? labels[1] : labels[2];
  const riskLevels = ['LOW', 'MEDIUM', 'HIGH'];
  const riskLevel = score < 35 ? riskLevels[2] : score < 55 ? riskLevels[1] : riskLevels[0];

  return {
    symbol: symbol.toUpperCase(),
    name: name || symbol.toUpperCase(),
    score,
    label,
    factors: ['AI服务暂不可用，使用降级分析', '基于确定性信号计算'],
    riskLevel,
    shortTermOutlook: score > 55 ? '短期动能偏正面' : score < 40 ? '短期下行压力较大' : '短期震荡整理',
    summary: `${name || symbol}的情绪分析基于降级算法，AI分析服务暂不可用。`,
    newsCount: 0,
    analyzedAt: new Date().toISOString(),
    provider: 'fallback',
  };
}

// --- Fetch with timeout ---

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

// --- Fetch news from Finnhub ---

interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  datetime: number;
}

async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return [];

  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 86400;

  try {
    const res = await fetchWithTimeout(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${new Date(weekAgo * 1000).toISOString().split('T')[0]}&to=${new Date(now * 1000).toISOString().split('T')[0]}&token=${FINNHUB_API_KEY}`,
      AI_TIMEOUT
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.slice(0, 10) as NewsItem[];
      }
    }
  } catch {
    // Continue without news
  }
  return [];
}

// --- Fetch quote from Finnhub ---

async function fetchQuote(symbol: string): Promise<string> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return '';

  try {
    const res = await fetchWithTimeout(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
      AI_TIMEOUT
    );
    if (res.ok) {
      const quote = await res.json();
      if (quote.c) {
        return `Current Price: $${quote.c}, Change: ${quote.d >= 0 ? '+' : ''}${quote.d} (${quote.dp >= 0 ? '+' : ''}${quote.dp}%), High: $${quote.h}, Low: $${quote.l}`;
      }
    }
  } catch {
    // Continue without quote
  }
  return '';
}

// --- Core sentiment analysis using z-ai-web-dev-sdk ---

async function analyzeSentiment(symbol: string, name?: string) {
  // Check cache first
  const cached = getCached(symbol);
  if (cached) return cached;

  // Fetch news and quote data
  const [newsItems, quoteInfo] = await Promise.all([
    fetchNews(symbol),
    fetchQuote(symbol),
  ]);

  const newsSummary = newsItems.length > 0
    ? newsItems.map((n, i) => `${i + 1}. "${n.headline}" - ${n.summary || 'No summary'} (${n.source})`).join('\n')
    : 'No recent news available for this symbol.';

  const systemPrompt = `你是一位专业的金融市场分析师，擅长股票市场情绪分析。请根据给定的股票数据，提供情绪评估。

重要：你必须仅以有效的JSON格式返回结果，不要包含其他文字：
{
  "symbol": "股票代码",
  "name": "公司名称",
  "score": 72,
  "label": "BULLISH",
  "factors": ["因素1", "因素2"],
  "riskLevel": "LOW",
  "shortTermOutlook": "短期展望描述",
  "summary": "情绪分析摘要",
  "newsCount": 5
}

规则：
- score：0-100的整数，0=极度看空，50=中性，100=极度看多
- label：STRONG_BUY（强烈买入）、BUY（买入）、BULLISH（看多）、NEUTRAL（中性）、BEARISH（看空）、SELL（卖出）、STRONG_SELL（强烈卖出）之一
- riskLevel：LOW（低）、MEDIUM（中）、HIGH（高）之一
- factors：2-5个影响情绪的关键因素数组，请用中文描述
- summary和shortTermOutlook：请用中文撰写
- newsCount：分析的新闻文章数量`;

  const userPrompt = `请分析 ${name || symbol}（${symbol}）的市场情绪。

${quoteInfo ? `市场数据：${quoteInfo}\n` : ''}近期新闻：
${newsSummary}

请仅以JSON格式返回情绪分析结果。`;

  // Try AI analysis
  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await createChatCompletion({ messages });

    const aiResponse = result.content || '';

    // Parse AI response
    let parsed: Record<string, unknown> | null = null;
    try {
      // Try to extract JSON from markdown code blocks or raw text
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/) || aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
    } catch {
      // Parsing failed, use fallback
    }

    if (parsed && typeof parsed.score === 'number') {
      const sentimentResult = {
        symbol: symbol.toUpperCase(),
        name: (parsed.name as string) || name || symbol.toUpperCase(),
        score: Math.max(0, Math.min(100, Math.round(parsed.score as number))),
        label: (parsed.label as string) || 'NEUTRAL',
        factors: Array.isArray(parsed.factors) ? (parsed.factors as string[]).slice(0, 5) : ['AI analysis completed'],
        riskLevel: (parsed.riskLevel as string) || 'MEDIUM',
        shortTermOutlook: (parsed.shortTermOutlook as string) || 'Uncertain',
        summary: (parsed.summary as string) || aiResponse.slice(0, 200),
        newsCount: newsItems.length,
        analyzedAt: new Date().toISOString(),
        provider: 'z-ai',
      };
      setCache(symbol, sentimentResult);
      return sentimentResult;
    }
  } catch (error) {
    console.error('[ai/sentiment] AI analysis failed, using fallback:', error);
  }

  // Fallback
  const fallback = generateFallbackSentiment(symbol, name);
  fallback.newsCount = newsItems.length;
  setCache(symbol, fallback);
  return fallback;
}

// --- GET handler ---

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const name = searchParams.get('name') || undefined;

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const result = await analyzeSentiment(symbol, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ai/sentiment] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}

// --- POST handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, name } = body as { symbol?: string; name?: string };

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const result = await analyzeSentiment(symbol, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ai/sentiment] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}
