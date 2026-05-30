import { NextRequest, NextResponse } from 'next/server';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

// Fallback data for market indices (Finnhub free plan doesn't support CFD indices)
const INDEX_QUOTES: Record<string, { currentPrice: number; change: number; changePercent: number; high: number; low: number; open: number; prevClose: number }> = {
  '^GSPC': { currentPrice: 5942.17, change: 28.45, changePercent: 0.48, high: 5968.32, low: 5918.50, open: 5920.75, prevClose: 5913.72 },
  '^IXIC': { currentPrice: 19687.54, change: 156.78, changePercent: 0.80, high: 19782.39, low: 19542.16, open: 19560.80, prevClose: 19530.76 },
  '^DJI': { currentPrice: 42342.18, change: -45.12, changePercent: -0.11, high: 42485.23, low: 42210.56, open: 42400.30, prevClose: 42387.30 },
};

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

    // Return fallback data for market indices
    if (INDEX_QUOTES[symbol]) {
      return NextResponse.json({
        ...INDEX_QUOTES[symbol],
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    if (!FINNHUB_API_KEY) {
      return NextResponse.json(
        { error: 'Finnhub API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Handle Finnhub error responses (e.g., "Market data subscription required")
    if (data.error) {
      return NextResponse.json(
        { error: data.error },
        { status: 403 }
      );
    }

    // Finnhub returns { c: current, d: change, dp: changePercent, h: high, l: low, o: open, pc: prevClose, t: timestamp }
    if (!data || (data.c === 0 && data.h === 0 && data.l === 0)) {
      return NextResponse.json(
        { error: 'No quote data found for symbol' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      currentPrice: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      prevClose: data.pc,
      timestamp: data.t,
    });
  } catch (error) {
    console.error('Quote API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock quote' },
      { status: 500 }
    );
  }
}
