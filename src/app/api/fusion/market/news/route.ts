import { NextRequest, NextResponse } from 'next/server';
import { getMockNews } from '@/lib/mock-api-data';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'general';
    const count = parseInt(searchParams.get('count') || '20', 10);

    // Try real Finnhub news for US market
    if (FINNHUB_API_KEY && (market === 'US' || market === 'general')) {
      try {
        const today = new Date();
        const fromDate = new Date(today.getTime() - 7 * 86400000); // Last 7 days
        const from = fromDate.toISOString().split('T')[0];
        const to = today.toISOString().split('T')[0];

        const finnhubNews = await finnhubFetch<Array<{
          category: string;
          datetime: number;
          headline: string;
          id: number;
          image: string;
          related: string;
          source: string;
          summary: string;
          url: string;
        }>>('news', { category: 'general', from, to });

        if (finnhubNews && Array.isArray(finnhubNews) && finnhubNews.length > 0) {
          const mapped = finnhubNews.slice(0, count).map((item, i) => ({
            id: `finnhub-${item.id || i}`,
            headline: item.headline || '',
            summary: item.summary || item.headline || '',
            source: item.source || 'Finnhub',
            url: item.url || '#',
            image: item.image || '',
            category: item.category || 'general',
            sentiment: 'neutral' as const,
            relatedStocks: item.related ? item.related.split(',').filter(Boolean) : [],
            timestamp: new Date(item.datetime * 1000).toISOString(),
          }));

          return NextResponse.json({
            success: true,
            data: mapped,
            error: null,
          });
        }
      } catch (err) {
        console.error('[FusionNews] Finnhub news fetch failed, falling back:', err);
      }
    }

    // Fallback to mock data for A/HK markets or when Finnhub fails
    const result = getMockNews(market, count);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('Fusion news API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '获取新闻数据失败' },
      { status: 500 }
    );
  }
}
