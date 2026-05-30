import { NextRequest, NextResponse } from 'next/server';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

// In-memory cache with 24-hour TTL
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function GET(request: NextRequest) {
  try {
    const FINNHUB_API_KEY = await getFinnhubApiKey();
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange') || 'US';

    if (!FINNHUB_API_KEY) {
      return NextResponse.json(
        { error: 'Finnhub API key not configured' },
        { status: 500 }
      );
    }

    // Check cache
    const cacheKey = `symbols_${exchange}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const response = await fetch(
      `https://finnhub.io/api/v1/stock/symbol?exchange=${encodeURIComponent(exchange)}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const symbols = (Array.isArray(data) ? data : []).map((item: Record<string, string>) => ({
      symbol: item.symbol,
      description: item.description,
      displaySymbol: item.displaySymbol,
      type: item.type,
    }));

    // Update cache
    cache.set(cacheKey, { data: symbols, timestamp: Date.now() });

    return NextResponse.json(symbols);
  } catch (error) {
    console.error('Symbols API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock symbols' },
      { status: 500 }
    );
  }
}
