import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/fund/popular?type=etf&limit=20
 * 
 * Get popular/recommended Chinese domestic funds from the local database.
 * Defaults to on-market ETFs sorted by code.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'etf';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Well-known ETF codes for "popular" display
    const popularEtfCodes = [
      // 宽基ETF
      '510050', '510300', '510500', '512100', '159919', '159915',
      // 行业ETF
      '512880', '512660', '512480', '512010', '512170', '512200',
      // 跨境ETF
      '513500', '513300', '513100', '513050', '513520',
      // 商品ETF
      '518880', '518870',
      // 债券ETF
      '511010', '511260', '511220',
    ];

    let funds;
    if (type === 'etf') {
      // Try to get the pre-selected popular ETFs first
      funds = await db.fund.findMany({
        where: {
          code: { in: popularEtfCodes },
          isEtf: true,
        },
        orderBy: { code: 'asc' },
      });

      // If not enough, add more ETFs
      if (funds.length < limit) {
        const existingCodes = new Set(funds.map(f => f.code));
        const moreFunds = await db.fund.findMany({
          where: {
            isEtf: true,
            isOnMarket: true,
            NOT: { code: { in: Array.from(existingCodes) } },
          },
          take: limit - funds.length,
          orderBy: { code: 'asc' },
        });
        funds = [...funds, ...moreFunds];
      }
    } else {
      funds = await db.fund.findMany({
        where: { isOnMarket: true },
        take: limit,
        orderBy: { code: 'asc' },
      });
    }

    const formatted = funds.map(fund => ({
      code: fund.code,
      name: fund.name,
      fundType: fund.fundType,
      market: fund.market,
      isOnMarket: fund.isOnMarket,
      isEtf: fund.isEtf,
      exchange: fund.exchange,
      nav: fund.nav,
      navDate: fund.navDate,
      category: fund.isEtf ? 'etf_cn' : fund.fundType,
      // Map to the PopularETF interface expected by the frontend
      symbol: fund.code,
      expenseRatio: null,
      returns1y: null,
      dividendYield: null,
      aum: null,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Fund popular API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular funds' },
      { status: 500 }
    );
  }
}
