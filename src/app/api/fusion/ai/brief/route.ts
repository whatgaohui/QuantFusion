import { NextRequest, NextResponse } from 'next/server';
import { generateMarketBrief } from '@/lib/ai-service';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';

const INDEX_SYMBOLS: Record<string, string> = {
  'AAPL': '苹果', 'GOOGL': '谷歌', 'MSFT': '微软',
  'NVDA': '英伟达', 'AMZN': '亚马逊',
};

export async function GET(request: NextRequest) {
  try {
    // Gather real market data from Finnhub
    const symbols = Object.keys(INDEX_SYMBOLS);
    const indices: Array<{ name: string; price: number; change: number; changePercent: number; market: string }> = [];

    if (FINNHUB_API_KEY) {
      // Fetch real quotes for US indices/stocks
      for (let i = 0; i < symbols.length; i += 3) {
        const batch = symbols.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map(async (sym) => {
            try {
              const data = await finnhubFetch<{
                c: number; d: number; dp: number;
              }>('quote', { symbol: sym });
              if (data && data.c && data.c !== 0) {
                return {
                  name: INDEX_SYMBOLS[sym] || sym,
                  price: data.c,
                  change: data.d || 0,
                  changePercent: data.dp || 0,
                  market: 'US',
                };
              }
              return null;
            } catch {
              return null;
            }
          })
        );
        for (const result of batchResults) {
          if (result) indices.push(result);
        }
      }
    }

    // Fetch real news from Finnhub
    let newsItems: Array<{ headline: string; sentiment?: string }> = [];
    if (FINNHUB_API_KEY) {
      try {
        const today = new Date();
        const fromDate = new Date(today.getTime() - 2 * 86400000);
        const from = fromDate.toISOString().split('T')[0];
        const to = today.toISOString().split('T')[0];

        const finnhubNews = await finnhubFetch<Array<{
          headline: string;
          datetime: number;
        }>>('news', { category: 'general', from, to });

        if (finnhubNews && Array.isArray(finnhubNews) && finnhubNews.length > 0) {
          newsItems = finnhubNews.slice(0, 5).map(item => ({
            headline: item.headline,
            sentiment: 'neutral' as const,
          }));
        }
      } catch {
        // Skip failed news fetch
      }
    }

    // Try AI brief generation
    const { brief, isOffline } = await generateMarketBrief({
      indices,
      news: newsItems,
    });

    if (isOffline || !brief) {
      return NextResponse.json({
        success: true,
        data: {
          brief: generateFallbackBrief(indices),
          source: 'fallback',
          is_offline: true,
        },
        error: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        brief,
        source: 'ai',
        is_offline: false,
      },
      error: null,
    });
  } catch (error) {
    console.error('AI brief API error:', error);
    return NextResponse.json({
      success: true,
      data: {
        brief: generateFallbackBrief([]),
        source: 'fallback',
        is_offline: true,
      },
      error: null,
    });
  }
}

function generateFallbackBrief(
  indices: Array<{ name: string; price: number; change: number; changePercent: number; market: string }>
): string {
  const formatIndex = (idx: { name: string; changePercent: number }) => {
    const arrow = idx.changePercent >= 0 ? '↑' : '↓';
    return `${idx.name} ${arrow}${Math.abs(idx.changePercent).toFixed(2)}%`;
  };

  const us = indices.filter(i => i.market === 'US');

  const parts = ['📊 **今日市场简报**\n'];

  if (us.length > 0) {
    parts.push(`🇺🇸 **美股**: ${us.map(formatIndex).join('、')}`);
  } else {
    parts.push('🇺🇸 **美股**: 数据暂不可用');
  }

  parts.push('\n💡 **提示**: AI简报暂时不可用，以上为基于实时行情的简要摘要。');

  return parts.join('\n\n');
}
