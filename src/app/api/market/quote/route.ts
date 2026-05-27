import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
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
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Finnhub returns { c: current, d: change, dp: changePercent, h: high, l: low, o: open, pc: prevClose, t: timestamp }
    if (!data || data.c === 0 && data.h === 0 && data.l === 0) {
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
