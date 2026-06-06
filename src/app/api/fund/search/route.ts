import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/fund/search?q=513
 * Search for Chinese funds by code prefix, name contains, or pinyin prefix.
 * Returns array of { code, name, fundType, isEtf, isOnMarket, exchange, nav, accNav }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    const query = q.trim();
    const queryLower = query.toLowerCase();

    const results = await db.fund.findMany({
      where: {
        OR: [
          { code: { startsWith: query } },
          { name: { contains: query } },
          { pinyin: { startsWith: queryLower } },
          { pinyin: { contains: queryLower } },
        ],
      },
      orderBy: [
        { isOnMarket: 'desc' },
        { isEtf: 'desc' },
      ],
      take: 30,
    });

    const formatted = results.map((fund) => ({
      code: fund.code,
      name: fund.name,
      fundType: fund.fundType,
      isEtf: fund.isEtf,
      isOnMarket: fund.isOnMarket,
      exchange: fund.exchange,
      nav: fund.nav,
      accNav: fund.accNav,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Fund search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search funds' },
      { status: 500 }
    );
  }
}
