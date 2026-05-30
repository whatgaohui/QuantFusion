import { NextRequest, NextResponse } from 'next/server';
import { detectMarket } from '@/lib/data-source-manager';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;

// Map frontend period names to Finnhub resolution strings
const RESOLUTION_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  'D': 'D',
  'W': 'W',
  'M': 'M',
};

function generateMockCandleData(currentPrice: number, days: number = 90) {
  const result = {
    c: [] as number[],
    h: [] as number[],
    l: [] as number[],
    o: [] as number[],
    v: [] as number[],
    t: [] as number[],
    s: 'ok' as string,
  };

  let price = currentPrice * (0.85 + Math.random() * 0.1);
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;

  for (let i = 0; i < days; i++) {
    const timestamp = now - (days - i) * daySeconds;
    const drift = (currentPrice - price) / (days - i) * 0.3;
    const volatility = price * 0.02;
    const change = drift + (Math.random() - 0.5) * volatility;

    const open = Number(price.toFixed(2));
    const close = Number((price + change).toFixed(2));
    const high = Number((Math.max(open, close) + Math.random() * volatility * 0.5).toFixed(2));
    const low = Number((Math.min(open, close) - Math.random() * volatility * 0.5).toFixed(2));
    const volume = Math.floor(30000000 + Math.random() * 70000000);

    result.o.push(open);
    result.c.push(close);
    result.h.push(high);
    result.l.push(low);
    result.v.push(volume);
    result.t.push(timestamp);

    price = close;
  }

  return result;
}

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
    const period = searchParams.get('period') || searchParams.get('resolution') || 'D';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // Map period to Finnhub resolution
    const resolution = RESOLUTION_MAP[period] || period;
    const validResolutions = ['1', '5', '15', '30', '60', 'D', 'W', 'M'];
    if (!validResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}` },
        { status: 400 }
      );
    }

    // Detect market from symbol
    const detected = detectMarket(symbol);

    // If A-share, try EastMoney first
    if (detected.market === 'A') {
      try {
        const { fetchEastMoneyKline } = await import('@/lib/data-source-eastmoney');
        const eastmoneyResult = await fetchEastMoneyKline(detected.pureCode, period, 'qfq', 200);
        if (eastmoneyResult && eastmoneyResult.c.length > 0) {
          return NextResponse.json({
            c: eastmoneyResult.c,
            h: eastmoneyResult.h,
            l: eastmoneyResult.l,
            o: eastmoneyResult.o,
            v: eastmoneyResult.v,
            t: eastmoneyResult.t,
            s: eastmoneyResult.s,
            source: 'eastmoney',
          });
        }
      } catch {
        // EastMoney failed, fall through to Finnhub
      }
    }

    // Calculate date range if not provided
    let fromTs = from ? parseInt(from) : 0;
    let toTs = to ? parseInt(to) : Math.floor(Date.now() / 1000);

    if (!from) {
      // Default lookback based on resolution
      const now = Math.floor(Date.now() / 1000);
      if (resolution === '1' || resolution === '5' || resolution === '15' || resolution === '30') {
        fromTs = now - 5 * 86400; // 5 days for intraday
      } else if (resolution === '60') {
        fromTs = now - 30 * 86400; // 30 days for hourly
      } else if (resolution === 'D') {
        fromTs = now - 180 * 86400; // 180 days for daily
      } else if (resolution === 'W') {
        fromTs = now - 365 * 86400; // 1 year for weekly
      } else if (resolution === 'M') {
        fromTs = now - 730 * 86400; // 2 years for monthly
      }
    }

    // Try Finnhub API
    const FINNHUB_API_KEY = await getFinnhubApiKey();
    if (FINNHUB_API_KEY) {
      try {
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${fromTs}&to=${toTs}&token=${FINNHUB_API_KEY}`;
        const response = await fetchWithTimeout(url, FINNHUB_TIMEOUT);

        if (response.ok) {
          const data = await response.json();
          if (data.s === 'ok' && data.c && data.c.length > 0) {
            return NextResponse.json({
              c: data.c,
              h: data.h,
              l: data.l,
              o: data.o,
              v: data.v,
              t: data.t,
              s: data.s,
            });
          }
        }
      } catch {
        // Finnhub candle API failed, fall through to mock data
      }
    }

    // Generate realistic mock data based on current quote
    let currentPrice = 150;
    if (FINNHUB_API_KEY) {
      try {
        const quoteRes = await fetchWithTimeout(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
          FINNHUB_TIMEOUT
        );
        if (quoteRes.ok) {
          const quoteData = await quoteRes.json();
          if (quoteData.c && quoteData.c > 0) {
            currentPrice = quoteData.c;
          }
        }
      } catch {
        // Use default price
      }
    }

    const days = resolution === 'W' ? 52 : resolution === 'M' ? 24 : resolution === '60' ? 30 : 90;
    const mockData = generateMockCandleData(currentPrice, days);

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('[fusion/kline] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch kline data' },
      { status: 500 }
    );
  }
}
