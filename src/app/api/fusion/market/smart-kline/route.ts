import { NextRequest, NextResponse } from 'next/server';
import { getSmartKline, detectMarket } from '@/lib/data-source-manager';

/**
 * GET /api/fusion/market/smart-kline
 * 智能K线（多源回退：东方财富→Finnhub→模拟）
 * 参数: symbol, period, market (market可选，会自动从symbol检测)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const period = searchParams.get('period') || searchParams.get('resolution') || 'D';
    const marketParam = searchParams.get('market');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // 自动检测市场：如果显式传了market参数就用它，否则从symbol检测
    const detected = detectMarket(symbol);
    const market = marketParam && marketParam !== 'US' ? marketParam : detected.market;

    const result = await getSmartKline(symbol, period, market);

    if (result) {
      return NextResponse.json({
        c: result.c,
        h: result.h,
        l: result.l,
        o: result.o,
        v: result.v,
        t: result.t,
        s: result.s,
        source: result.source,
      });
    }

    // 完全没有数据时返回空结果
    return NextResponse.json({
      c: [],
      h: [],
      l: [],
      o: [],
      v: [],
      t: [],
      s: 'no_data',
      source: 'none',
    });
  } catch (error) {
    console.error('[smart-kline] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch smart kline data' },
      { status: 500 }
    );
  }
}
