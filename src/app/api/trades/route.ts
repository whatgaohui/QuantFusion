import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/trades
 * Get all trade logs, sorted by createdAt desc
 */
export async function GET() {
  try {
    const trades = await db.tradeLog.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(trades);
  } catch (error) {
    console.error('Get trades error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade logs' },
      { status: 500 }
    );
  }
}
