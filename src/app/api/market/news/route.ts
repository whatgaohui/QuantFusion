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

    const news = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => ({
      id: item.id,
      category: item.category,
      datetime: item.datetime,
      headline: item.headline,
      image: item.image,
      related: item.related,
      source: item.source,
      summary: item.summary,
      url: item.url,
    }));

    return NextResponse.json(news);
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market news' },
      { status: 500 }
    );
  }
}
