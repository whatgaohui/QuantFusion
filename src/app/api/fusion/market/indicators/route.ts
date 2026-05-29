import { NextRequest, NextResponse } from 'next/server';
import { getMockIndicators } from '@/lib/mock-api-data';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKDJ,
} from '@/lib/indicators';

function toFinnhubSymbol(symbol: string): string {
  if (symbol.startsWith('SH')) return symbol.slice(2) + '.SS';
  if (symbol.startsWith('SZ')) return symbol.slice(2) + '.SZ';
  if (symbol.startsWith('HK')) return symbol.slice(2).replace(/^0*/, '') + '.HK';
  return symbol;
}

async function computeRealIndicators(symbol: string) {
  const finnhubSymbol = toFinnhubSymbol(symbol);
  const to = Math.floor(Date.now() / 1000);
  const from = to - 120 * 86400;

  const data = await finnhubFetch<{
    s: string; c: number[]; o: number[]; h: number[]; l: number[]; v: number[]; t: number[];
  }>('stock/candle', { symbol: finnhubSymbol, resolution: 'D', from: String(from), to: String(to) });

  if (!data || data.s !== 'ok' || !data.c || data.c.length < 30) return null;

  const closes = data.c;
  const highs = data.h;
  const lows = data.l;

  // Calculate real indicators from candle data
  const rsi = calculateRSI(closes, 14);
  const macdResult = calculateMACD(closes);
  const bbResult = calculateBollingerBands(closes);
  const kdjResult = calculateKDJ(highs, lows, closes);

  // Calculate MA
  const ma5 = closes.length >= 5 ? closes.slice(-5).reduce((s, v) => s + v, 0) / 5 : 0;
  const ma10 = closes.length >= 10 ? closes.slice(-10).reduce((s, v) => s + v, 0) / 10 : 0;
  const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((s, v) => s + v, 0) / 20 : 0;
  const ma60 = closes.length >= 60 ? closes.slice(-60).reduce((s, v) => s + v, 0) / 60 : 0;

  return {
    symbol: symbol.toUpperCase(),
    ma: {
      ma5: parseFloat(ma5.toFixed(2)),
      ma10: parseFloat(ma10.toFixed(2)),
      ma20: parseFloat(ma20.toFixed(2)),
      ma60: parseFloat(ma60.toFixed(2)),
    },
    rsi: {
      rsi6: parseFloat(calculateRSI(closes, 6).toFixed(2)),
      rsi12: parseFloat(calculateRSI(closes, 12).toFixed(2)),
      rsi14: parseFloat(rsi.toFixed(2)),
    },
    macd: {
      macd: macdResult.macd,
      signal: macdResult.signal,
      histogram: macdResult.histogram,
    },
    bollinger: {
      upper: bbResult.upper,
      middle: bbResult.middle,
      lower: bbResult.lower,
      pricePosition: bbResult.pricePosition,
    },
    kdj: {
      k: kdjResult.k,
      d: kdjResult.d,
      j: kdjResult.j,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: '股票代码参数不能为空' },
        { status: 400 }
      );
    }

    // Try real Finnhub data + indicator calculation
    const realIndicators = await computeRealIndicators(symbol);
    if (realIndicators) {
      return NextResponse.json({ success: true, data: realIndicators, error: null });
    }

    // Fallback to mock
    const result = getMockIndicators(symbol);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion indicators API error:', error);
    // Fallback to mock
    const symbol = new URL(request.url).searchParams.get('symbol');
    if (symbol) {
      const result = getMockIndicators(symbol);
      return NextResponse.json(result, { status: result.success ? 200 : 404 });
    }
    return NextResponse.json(
      { success: false, data: null, error: '获取指标数据失败' },
      { status: 500 }
    );
  }
}
