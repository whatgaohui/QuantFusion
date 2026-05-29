import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';

/**
 * GET /api/trades
 * Get all trade logs, sorted by tradeTime desc
 */
export async function GET() {
  try {
    await ensureDefaultUser();

    const trades = await db.tradeLog.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { tradeTime: 'desc' },
    });

    return NextResponse.json(trades);
  } catch (error) {
    console.error('Get trades error:', error);
    return NextResponse.json(
      { error: '获取交易记录失败' },
      { status: 500 }
    );
  }
}
