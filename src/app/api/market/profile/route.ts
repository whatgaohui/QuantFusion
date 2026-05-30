import { NextRequest, NextResponse } from 'next/server';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

export async function GET(request: NextRequest) {
  try {
    const FINNHUB_API_KEY = await getFinnhubApiKey();
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    if (!FINNHUB_API_KEY) {
      return NextResponse.json(
        { error: 'Finnhub API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data || !data.name) {
      return NextResponse.json(
        { error: 'No profile data found for symbol' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      country: data.country,
      currency: data.currency,
      exchange: data.exchange,
      finnhubIndustry: data.finnhubIndustry,
      ipo: data.ipo,
      logo: data.logo,
      marketCapitalization: data.marketCapitalization,
      name: data.name,
      phone: data.phone,
      shareOutstanding: data.shareOutstanding,
      ticker: data.ticker,
      weburl: data.weburl,
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company profile' },
      { status: 500 }
    );
  }
}
