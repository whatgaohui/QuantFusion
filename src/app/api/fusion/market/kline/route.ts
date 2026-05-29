import { NextRequest, NextResponse } from 'next/server';
import { getMockKline } from '@/lib/mock-api-data';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';

function toFinnhubSymbol(symbol: string): string {
  if (symbol.startsWith('SH')) return symbol.slice(2) + '.SS';
  if (symbol.startsWith('SZ')) return symbol.slice(2) + '.SZ';
  if (symbol.startsWith('HK')) return symbol.slice(2).replace(/^0*/, '') + '.HK';
  return symbol;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const count = parseInt(searchParams.get('count') || '90', 10);

    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: '股票代码参数不能为空' },
        { status: 400 }
      );
    }

    // Try Finnhub candle API
    const finnhubSymbol = toFinnhubSymbol(symbol);
    const to = Math.floor(Date.now() / 1000);
    const from = to - (count + 30) * 86400; // Extra buffer for non-trading days

    const data = await finnhubFetch<{
      s: string; c: number[]; o: number[]; h: number[]; l: number[]; v: number[]; t: number[];
    }>('stock/candle', { symbol: finnhubSymbol, resolution: 'D', from: String(from), to: String(to) });

    if (data && data.s === 'ok' && data.c && data.c.length >= 20) {
      // Return real kline data, limited to requested count
      const sliceStart = Math.max(0, data.c.length - count);
      return NextResponse.json({
        success: true,
        data: {
          c: data.c.slice(sliceStart),
          o: data.o.slice(sliceStart),
          h: data.h.slice(sliceStart),
          l: data.l.slice(sliceStart),
          v: data.v.slice(sliceStart),
          t: data.t.slice(sliceStart),
          s: 'ok',
        },
        error: null,
      });
    }

    // Fallback to mock
    const result = getMockKline(symbol, count);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion kline API error:', error);
    // Fallback to mock
    const symbol = new URL(request.url).searchParams.get('symbol');
    const count = parseInt(new URL(request.url).searchParams.get('count') || '90', 10);
    if (symbol) {
      const result = getMockKline(symbol, count);
      return NextResponse.json(result, { status: result.success ? 200 : 404 });
    }
    return NextResponse.json(
      { success: false, data: null, error: '获取K线数据失败' },
      { status: 500 }
    );
  }
}
