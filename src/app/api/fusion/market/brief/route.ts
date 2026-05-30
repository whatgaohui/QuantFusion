import { NextResponse } from 'next/server';
import { createChatCompletion } from '@/lib/ai-service';
import type { ChatMessage } from '@/lib/ai-service';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedBrief {
  content: string;
  provider: string;
  tokens: number;
  generatedAt: string;
  timestamp: number;
}

let cachedBrief: CachedBrief | null = null;

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

async function getMarketIndices() {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  const indices: Record<string, unknown> = {};

  if (!FINNHUB_API_KEY) return indices;

  const symbols = [
    { key: 'sp500', symbol: '^GSPC' },
    { key: 'nasdaq', symbol: '^IXIC' },
    { key: 'dow', symbol: '^DJI' },
  ];

  const results = await Promise.allSettled(
    symbols.map(async (idx) => {
      try {
        const res = await fetchWithTimeout(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(idx.symbol)}&token=${FINNHUB_API_KEY}`,
          FINNHUB_TIMEOUT
        );
        if (res.ok) {
          const data = await res.json();
          return { key: idx.key, data };
        }
        return { key: idx.key, data: null };
      } catch {
        return { key: idx.key, data: null };
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.data) {
      indices[result.value.key] = result.value.data;
    }
  }

  return indices;
}

async function getMarketNews() {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return [];

  try {
    const res = await fetchWithTimeout(
      `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`,
      FINNHUB_TIMEOUT
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // Take top 5 headlines for context
        return data.slice(0, 5).map((item: Record<string, unknown>) => ({
          headline: item.headline || '',
          source: item.source || '',
          summary: item.summary || '',
        }));
      }
    }
  } catch {
    // Fall through to empty array
  }

  return [];
}

const mockBriefContent = `Markets are showing mixed signals today. Tech sector leads gains with NVIDIA up 2.3%, while energy stocks lag. S&P 500 hovering near resistance at 5250. Consider defensive positioning near-term with selective tech exposure. Key levels to watch: S&P support at 5200, resistance at 5280. NASDAQ showing relative strength, driven by AI/semiconductor momentum. DOW underperforming as cyclical sectors face headwinds. Bond yields stable, suggesting market is pricing in a steady Fed outlook.`;

export async function GET() {
  // Return cached brief if still valid
  if (cachedBrief && Date.now() - cachedBrief.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedBrief);
  }

  // Fetch market data and news for context
  const [indices, news] = await Promise.allSettled([
    getMarketIndices(),
    getMarketNews(),
  ]);

  const marketIndices = indices.status === 'fulfilled' ? indices.value : {};
  const marketNews = news.status === 'fulfilled' ? news.value : [];

  // Try to use AI service (routes through user's configured provider) for AI-generated brief
  try {
    const systemPrompt = `You are an expert financial market analyst for the QuantFusion AI trading platform. Generate a concise, actionable market brief based on the provided market data and news.

Your brief should:
1. Summarize current market conditions (bullish/bearish/neutral tone)
2. Highlight key index movements and notable stocks
3. Identify important support/resistance levels
4. Provide a short-term outlook
5. Suggest any actionable insights

Keep the brief to 3-5 sentences. Be specific with numbers when available. Write in a professional yet accessible tone.`;

    const userPrompt = `Generate today's AI Market Brief based on the following real-time data:

Market Index Data:
${JSON.stringify(marketIndices, null, 2)}

Latest Market News Headlines:
${marketNews.length > 0 ? marketNews.map((n: { headline: string; source: string }) => `- ${n.headline} (${n.source})`).join('\n') : 'No recent news available'}

Please provide a concise market brief.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await createChatCompletion({ messages });

    if (result.content) {
      const brief: CachedBrief = {
        content: result.content,
        provider: result.provider,
        tokens: result.tokens,
        generatedAt: new Date().toISOString(),
        timestamp: Date.now(),
      };
      cachedBrief = brief;
      return NextResponse.json(brief);
    }
  } catch (aiError) {
    console.error('[fusion/market/brief] AI service error, falling back to mock:', aiError);
  }

  // Fallback to mock content
  const brief: CachedBrief = {
    content: mockBriefContent,
    provider: 'mock',
    tokens: 0,
    generatedAt: new Date().toISOString(),
    timestamp: Date.now(),
  };
  cachedBrief = brief;
  return NextResponse.json(brief);
}
