import { NextRequest, NextResponse } from 'next/server';
import { smartStockScreen } from '@/lib/data-source-iwencai';

/**
 * POST /api/fusion/market/stock-screen
 * 选股（问财+条件筛选）
 * Body: { query: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const result = await smartStockScreen(query);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[stock-screen] Error:', error);
    return NextResponse.json(
      { error: 'Failed to screen stocks' },
      { status: 500 }
    );
  }
}
