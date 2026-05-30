import { NextRequest, NextResponse } from 'next/server';
import { detectMarket } from '@/lib/data-source-manager';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;

// Fallback data for market indices (only used when Finnhub fails)
// These are approximate values and should be updated periodically
const INDEX_FALLBACK: Record<string, {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}> = {
  '^GSPC': { currentPrice: 5942.17, change: 28.45, changePercent: 0.48, high: 5968.32, low: 5918.50, open: 5920.75, prevClose: 5913.72 },
  '^IXIC': { currentPrice: 19687.54, change: 156.78, changePercent: 0.80, high: 19782.39, low: 19542.16, open: 19560.80, prevClose: 19530.76 },
  '^DJI': { currentPrice: 42342.18, change: -45.12, changePercent: -0.11, high: 42485.23, low: 42210.56, open: 42400.30, prevClose: 42387.30 },
  '^HSI': { currentPrice: 22744.28, change: 154.32, changePercent: 0.68, high: 22856.50, low: 22580.15, open: 22600.10, prevClose: 22589.96 },
  '000001.SS': { currentPrice: 3156.28, change: 12.45, changePercent: 0.40, high: 3178.50, low: 3140.20, open: 3144.30, prevClose: 3143.83 },
  '399001.SZ': { currentPrice: 10245.67, change: 53.21, changePercent: 0.52, high: 10312.40, low: 10190.80, open: 10192.46, prevClose: 10192.46 },
};

// A-share mock fallback prices for common symbols
const ASHARE_FALLBACK: Record<string, {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}> = {
  '000001': { currentPrice: 12.85, change: 0.15, changePercent: 1.18, high: 13.02, low: 12.68, open: 12.70, prevClose: 12.70 },
  '600519': { currentPrice: 1528.50, change: -8.30, changePercent: -0.54, high: 1542.00, low: 1520.10, open: 1536.80, prevClose: 1536.80 },
  '000858': { currentPrice: 148.60, change: 1.20, changePercent: 0.81, high: 149.50, low: 147.30, open: 147.40, prevClose: 147.40 },
  '601318': { currentPrice: 52.30, change: 0.45, changePercent: 0.87, high: 52.80, low: 51.85, open: 51.90, prevClose: 51.85 },
};

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

    // Detect market from symbol
    const detected = detectMarket(symbol);

    // If A-share, try EastMoney first for real quote data
    if (detected.market === 'A') {
      try {
        const { fetchEastMoneyQuote } = await import('@/lib/data-source-eastmoney');
        // Pass both pureCode and original symbol so convertSymbol can
        // correctly determine Shanghai (.SS) vs Shenzhen (.SZ) market.
        const quote = await fetchEastMoneyQuote(detected.pureCode, symbol);
        if (quote && quote.currentPrice > 0) {
          return NextResponse.json({
            currentPrice: quote.currentPrice,
            change: quote.change,
            changePercent: quote.changePercent,
            high: quote.high,
            low: quote.low,
            open: quote.open,
            prevClose: quote.prevClose,
            volume: quote.volume,
            amount: quote.amount,
            timestamp: Math.floor(Date.now() / 1000),
            source: quote.source,
          });
        }
      } catch (err) {
        console.log('[fusion/quote] EastMoney A-share quote failed:', err instanceof Error ? err.message : String(err));
        // EastMoney failed, fall through to fallback data
      }

      // EastMoney failed — mark as finnhub_fallback since Finnhub doesn't
      // support A-shares well, but still try static fallback data first.
      if (ASHARE_FALLBACK[detected.pureCode]) {
        return NextResponse.json({
          ...ASHARE_FALLBACK[detected.pureCode],
          timestamp: Math.floor(Date.now() / 1000),
          source: 'finnhub_fallback',
        });
      }

      // Also check original symbol for INDEX_FALLBACK compatibility
      if (INDEX_FALLBACK[symbol]) {
        return NextResponse.json({
          ...INDEX_FALLBACK[symbol],
          timestamp: Math.floor(Date.now() / 1000),
          source: 'finnhub_fallback',
        });
      }

      // No A-share data available from any source
      return NextResponse.json({
        currentPrice: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        open: 0,
        prevClose: 0,
        timestamp: Math.floor(Date.now() / 1000),
        source: 'unavailable',
      });
    }

    // Try Finnhub first for non-A-share symbols (including indices)
    const FINNHUB_API_KEY = await getFinnhubApiKey();
    if (FINNHUB_API_KEY) {
      try {
        const response = await fetchWithTimeout(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
          FINNHUB_TIMEOUT
        );

        if (response.ok) {
          const data = await response.json();

          // Check for valid Finnhub data (c > 0 means we have real data)
          if (data && !data.error && data.c > 0) {
            return NextResponse.json({
              currentPrice: data.c,
              change: data.d || 0,
              changePercent: data.dp || 0,
              high: data.h || 0,
              low: data.l || 0,
              open: data.o || 0,
              prevClose: data.pc || 0,
              timestamp: data.t || Math.floor(Date.now() / 1000),
              source: 'finnhub',
            });
          }
        }
      } catch {
        // Finnhub failed, fall through to fallback
      }
    }

    // Fallback for known indices
    if (INDEX_FALLBACK[symbol]) {
      return NextResponse.json({
        ...INDEX_FALLBACK[symbol],
        timestamp: Math.floor(Date.now() / 1000),
        source: 'fallback',
      });
    }

    // No data available
    return NextResponse.json({
      currentPrice: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      prevClose: 0,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'unavailable',
    });
  } catch (error) {
    console.error('[fusion/quote] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock quote' },
      { status: 500 }
    );
  }
}
