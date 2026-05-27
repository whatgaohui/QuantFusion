import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'general';
    const symbol = searchParams.get('symbol');

    if (!FINNHUB_API_KEY) {
      return NextResponse.json(
        { error: 'Finnhub API key not configured' },
        { status: 500 }
      );
    }

    let url: string;

    if (symbol) {
      // Company-specific news requires date range (last 7 days)
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${formatDate(from)}&to=${formatDate(to)}&token=${FINNHUB_API_KEY}`;
    } else {
      url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${FINNHUB_API_KEY}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const news = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => {
      // Convert Finnhub datetime (Unix timestamp) to ISO string
      const datetime = item.datetime as number | undefined;
      const timestamp = datetime ? new Date(datetime * 1000).toISOString() : new Date().toISOString();

      // Map Finnhub categories to our frontend categories
      const rawCategory = (item.category as string) || 'general';
      let category = 'general';
      if (rawCategory.includes('crypto') || rawCategory.includes('bitcoin') || rawCategory.includes('ethereum')) {
        category = 'crypto';
      } else if (rawCategory.includes('forex') || rawCategory.includes('currency')) {
        category = 'forex';
      } else if (rawCategory.includes('merger') || rawCategory.includes('acquisition')) {
        category = 'merger';
      }

      return {
        id: String(item.id || ''),
        category,
        headline: (item.headline as string) || '',
        image: (item.image as string) || '',
        source: (item.source as string) || '',
        summary: (item.summary as string) || '',
        url: (item.url as string) || '#',
        timestamp,
      };
    });

    return NextResponse.json(news);
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market news' },
      { status: 500 }
    );
  }
}
