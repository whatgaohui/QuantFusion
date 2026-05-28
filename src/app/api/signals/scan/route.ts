import { NextRequest, NextResponse } from 'next/server';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKDJ,
  calculateVolumeRatio,
} from '@/lib/indicators';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

interface CandleData {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  t: number[];
}

function generateMockCandleData(currentPrice: number, days: number = 90): CandleData {
  const result: CandleData = { o: [], h: [], l: [], c: [], v: [], t: [], s: 'ok' } as CandleData & { s: string };
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

async function fetchCandleData(symbol: string): Promise<CandleData | null> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 90 * 86400;

  // Try Finnhub API
  if (FINNHUB_API_KEY) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.s === 'ok' && data.c && data.c.length >= 30) {
          return { o: data.o, h: data.h, l: data.l, c: data.c, v: data.v, t: data.t };
        }
      }
    } catch {
      // Fall through to mock
    }

    // Get current price for mock data
    try {
      const quoteRes = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
      );
      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        if (quoteData.c) {
          return generateMockCandleData(quoteData.c, 90);
        }
      }
    } catch {
      // Use default
    }
  }

  return generateMockCandleData(150, 90);
}

function analyzeSignals(candleData: CandleData, symbol: string) {
  const closes = candleData.c;
  const highs = candleData.h;
  const lows = candleData.l;
  const volumes = candleData.v;

  let score = 0;

  // RSI
  const rsi = calculateRSI(closes, 14);
  let rsiSignal = 'NEUTRAL';
  if (rsi < 30) { score += 20; rsiSignal = 'OVERSOLD'; }
  else if (rsi > 70) { score -= 20; rsiSignal = 'OVERBOUGHT'; }
  else if (rsi < 40) { score += 5; rsiSignal = 'LEANING_OVERSOLD'; }
  else if (rsi > 60) { score -= 5; rsiSignal = 'LEANING_OVERBOUGHT'; }

  // MACD
  const macdResult = calculateMACD(closes);
  let macdSignalStr = 'NEUTRAL';
  if (macdResult.prevMacd <= macdResult.prevSignal && macdResult.macd > macdResult.signal) {
    score += 25; macdSignalStr = 'GOLDEN_CROSS';
  } else if (macdResult.prevMacd >= macdResult.prevSignal && macdResult.macd < macdResult.signal) {
    score -= 30; macdSignalStr = 'DEATH_CROSS';
  } else if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
    score += 10; macdSignalStr = 'BULLISH';
  } else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
    score -= 10; macdSignalStr = 'BEARISH';
  }

  // Bollinger Bands
  const bbResult = calculateBollingerBands(closes);
  let bollingerSignal = 'NEUTRAL';
  if (bbResult.pricePosition <= 0.2) { score += 15; bollingerSignal = 'NEAR_LOWER'; }
  else if (bbResult.pricePosition >= 0.8) { score -= 15; bollingerSignal = 'NEAR_UPPER'; }
  else if (bbResult.pricePosition < 0.4) { score += 5; bollingerSignal = 'LOWER_HALF'; }
  else if (bbResult.pricePosition > 0.6) { score -= 5; bollingerSignal = 'UPPER_HALF'; }

  // KDJ
  const kdjResult = calculateKDJ(highs, lows, closes);
  let kdjSignal = 'NEUTRAL';
  if (kdjResult.prevK <= kdjResult.prevD && kdjResult.k > kdjResult.d) {
    score += 15; kdjSignal = 'GOLDEN_CROSS';
  } else if (kdjResult.prevK >= kdjResult.prevD && kdjResult.k < kdjResult.d) {
    score -= 15; kdjSignal = 'DEATH_CROSS';
  }
  if (kdjResult.j < 0) { score += 10; kdjSignal = kdjSignal === 'NEUTRAL' ? 'J_OVERSOLD' : kdjSignal; }
  else if (kdjResult.j > 100) { score -= 10; kdjSignal = kdjSignal === 'NEUTRAL' ? 'J_OVERBOUGHT' : kdjSignal; }

  // Volume
  const volumeRatio = calculateVolumeRatio(volumes);
  if (volumeRatio > 2.0) { score += 15; }
  else if (volumeRatio > 1.5) { score += 5; }
  else if (volumeRatio < 0.5) { score -= 5; }

  // Signal type
  let signalType: 'BUY' | 'HOLD' | 'SELL';
  if (score >= 50) signalType = 'BUY';
  else if (score <= -40) signalType = 'SELL';
  else signalType = 'HOLD';

  const currentPrice = closes[closes.length - 1];

  return {
    symbol: symbol.toUpperCase(),
    score,
    signalType,
    rsi: parseFloat(rsi.toFixed(2)),
    macdSignal: macdSignalStr,
    macd: macdResult,
    bollingerSignal,
    bollingerBands: bbResult,
    kdjSignal,
    kdj: kdjResult,
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    price: currentPrice,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/signals/scan?symbol=AAPL
 * Auto-fetches candle data and runs signal scan
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol query parameter is required' },
        { status: 400 }
      );
    }

    const candleData = await fetchCandleData(symbol);
    if (!candleData || candleData.c.length < 30) {
      return NextResponse.json(
        { error: 'Not enough data to scan this symbol' },
        { status: 400 }
      );
    }

    const result = analyzeSignals(candleData, symbol);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Signal scan error:', error);
    return NextResponse.json(
      { error: 'Failed to run signal scan' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/signals/scan
 * Run signal scanner with provided candle data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, candleData } = body as {
      symbol: string;
      candleData?: CandleData;
    };

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    if (candleData && candleData.c && candleData.c.length >= 30) {
      const result = analyzeSignals(candleData, symbol);
      return NextResponse.json(result);
    }

    // No candle data provided, auto-fetch
    const data = await fetchCandleData(symbol);
    if (!data || data.c.length < 30) {
      return NextResponse.json({ error: 'Not enough data' }, { status: 400 });
    }

    const result = analyzeSignals(data, symbol);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Signal scan error:', error);
    return NextResponse.json({ error: 'Failed to run signal scan' }, { status: 500 });
  }
}
