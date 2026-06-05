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

const mockBriefContent = `今日市场信号喜忧参半。科技板块领涨，英伟达上涨2.3%，能源股落后。标普500在5250阻力位附近徘徊。短期内建议防御性配置，选择性持有科技股。关键位置关注：标普支撑位5200，阻力位5280。纳斯达克表现相对强势，受AI/半导体动量驱动。道指表现落后，周期性板块面临逆风。债券收益率稳定，市场预期美联储立场平稳。`;

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
    const systemPrompt = `你是一位专业的金融市场分析师，擅长生成简明、可操作的市场简报。请基于提供的市场数据和新闻，生成今日市场简报。请使用中文。

你的简报应包含：
1. 概括当前市场状况（看多/看空/中性基调）
2. 突出主要指数变动和值得关注的个股
3. 识别重要的支撑/阻力位
4. 提供短期展望
5. 给出可操作的见解

简报控制在3-5句话。有具体数据时请引用数字。语言专业但通俗易懂。`;

    const userPrompt = `请根据以下实时数据生成今日AI市场简报：

市场指数数据：
${JSON.stringify(marketIndices, null, 2)}

最新市场新闻头条：
${marketNews.length > 0 ? marketNews.map((n: { headline: string; source: string }) => `- ${n.headline} (${n.source})`).join('\n') : '暂无近期新闻'}

请提供简明的市场简报。`;

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
