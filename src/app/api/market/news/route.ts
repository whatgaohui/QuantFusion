import { NextRequest, NextResponse } from 'next/server';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
/** Hard deadline for the entire Finnhub call (fetch + body parse) */
const FINNHUB_TIMEOUT = 5000;

const MOCK_NEWS = [
  {
    id: 'mock-1',
    category: 'general',
    headline: 'S&P 500 Hits New All-Time High as Tech Sector Leads Rally',
    image: '',
    source: 'Reuters',
    summary: 'The benchmark index climbed to a record close as strong earnings from major technology companies boosted investor sentiment across the board.',
    url: '#',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    category: 'general',
    headline: 'NVIDIA Surges on AI Chip Demand Forecast, Beats Quarterly Estimates',
    image: '',
    source: 'Bloomberg',
    summary: 'The chipmaker raised its revenue guidance for the current quarter, citing unprecedented demand for its AI training and inference processors.',
    url: '#',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'mock-3',
    category: 'general',
    headline: 'Federal Reserve Signals Potential Rate Cuts in Coming Months',
    image: '',
    source: 'CNBC',
    summary: 'Fed officials indicated that inflation data has been moving in the right direction, opening the door for possible interest rate reductions.',
    url: '#',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'mock-4',
    category: 'crypto',
    headline: 'Bitcoin ETFs See Record Inflows on First Day of Trading',
    image: '',
    source: 'CoinDesk',
    summary: 'Newly approved spot Bitcoin ETFs attracted over $4.6 billion in trading volume on their debut, marking the most successful ETF launch in history.',
    url: '#',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'mock-5',
    category: 'forex',
    headline: 'Dollar Weakens Against Major Currencies After Fed Comments',
    image: '',
    source: 'Financial Times',
    summary: 'The greenback fell sharply against the euro and yen as traders priced in a higher probability of rate cuts in the first half of the year.',
    url: '#',
    timestamp: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: 'mock-6',
    category: 'merger',
    headline: 'Pfizer Announces $43B Acquisition of Cancer Drug Maker Seagen',
    image: '',
    source: 'WSJ',
    summary: 'The pharmaceutical giant will acquire Seagen to bolster its oncology pipeline, in one of the largest healthcare deals in recent years.',
    url: '#',
    timestamp: new Date(Date.now() - 28800000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const FINNHUB_API_KEY = await getFinnhubApiKey();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'general';
    const symbol = searchParams.get('symbol');

    if (!FINNHUB_API_KEY) {
      return NextResponse.json(MOCK_NEWS);
    }

    let url: string;

    if (symbol) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${formatDate(from)}&to=${formatDate(to)}&token=${FINNHUB_API_KEY}`;
    } else {
      url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${FINNHUB_API_KEY}`;
    }

    try {
      // Single AbortController with timeout — no double-timeout race.
      // The controller covers both the fetch() call and the .json() parse,
      // ensuring the endpoint never hangs beyond FINNHUB_TIMEOUT.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT);

      let data: unknown;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          clearTimeout(timer);
          return NextResponse.json(MOCK_NEWS);
        }
        data = await response.json();
      } finally {
        clearTimeout(timer);
      }

      const news = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => {
        const datetime = item.datetime as number | undefined;
        const timestamp = datetime ? new Date(datetime * 1000).toISOString() : new Date().toISOString();

        const rawCategory = (item.category as string) || 'general';
        let mappedCategory = 'general';
        if (rawCategory.includes('crypto') || rawCategory.includes('bitcoin') || rawCategory.includes('ethereum')) {
          mappedCategory = 'crypto';
        } else if (rawCategory.includes('forex') || rawCategory.includes('currency')) {
          mappedCategory = 'forex';
        } else if (rawCategory.includes('merger') || rawCategory.includes('acquisition')) {
          mappedCategory = 'merger';
        }

        return {
          id: String(item.id || ''),
          category: mappedCategory,
          headline: (item.headline as string) || '',
          image: (item.image as string) || '',
          source: (item.source as string) || '',
          summary: (item.summary as string) || '',
          url: (item.url as string) || '#',
          timestamp,
        };
      });

      return NextResponse.json(news.length > 0 ? news : MOCK_NEWS);
    } catch {
      // AbortError (timeout), network error, or parse failure — fall back immediately
      return NextResponse.json(MOCK_NEWS);
    }
  } catch (error) {
    console.error('[market/news] Error:', error);
    return NextResponse.json(MOCK_NEWS);
  }
}
