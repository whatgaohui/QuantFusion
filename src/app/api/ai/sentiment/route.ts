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
    factors: ['Fallback analysis - AI unavailable', 'Using deterministic signals'],
    riskLevel,
    shortTermOutlook: score > 55 ? 'Positive momentum expected' : score < 40 ? 'Downward pressure likely' : 'Sideways consolidation',
    summary: `Sentiment analysis for ${name || symbol} is based on deterministic fallback. AI analysis was unavailable.`,
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

  const systemPrompt = `You are an expert financial analyst specializing in stock market sentiment analysis. Analyze the given stock data and provide a sentiment assessment.

IMPORTANT: You must respond ONLY with valid JSON in this exact format, no other text:
{
  "symbol": "TICKER",
  "name": "Company Name",
  "score": 72,
  "label": "BULLISH",
  "factors": ["factor 1", "factor 2"],
  "riskLevel": "LOW",
  "shortTermOutlook": "Brief outlook text",
  "summary": "Brief summary of sentiment analysis",
  "newsCount": 5
}

Rules:
- score: integer 0-100 where 0 = extremely bearish, 50 = neutral, 100 = extremely bullish
- label: one of STRONG_BUY, BUY, BULLISH, NEUTRAL, BEARISH, SELL, STRONG_SELL
- riskLevel: one of LOW, MEDIUM, HIGH
- factors: array of 2-5 key factors influencing sentiment
- newsCount: number of news articles analyzed`;

  const userPrompt = `Analyze market sentiment for ${name || symbol} (${symbol}).

${quoteInfo ? `Market Data: ${quoteInfo}\n` : ''}Recent News:
${newsSummary}

Provide your sentiment analysis as JSON only.`;

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
