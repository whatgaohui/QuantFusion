/**
 * 大盘复盘API
 * GET /api/fusion/market/market-review
 * 返回三市场红绿灯+复盘
 */

import { NextResponse } from 'next/server';
import { getMarketReview } from '@/lib/market-assessment';

export async function GET() {
  try {
    const review = await getMarketReview();
    return NextResponse.json(review);
  } catch (error) {
    console.error('[fusion/market/market-review] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get market review' },
      { status: 500 }
    );
  }
}
