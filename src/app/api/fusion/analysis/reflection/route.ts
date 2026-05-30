/**
 * 反思摘要API
 * GET /api/fusion/analysis/reflection?symbol=AAPL
 * 获取某股票的反思摘要（对比历史建议和实际结果）
 */

import { NextRequest, NextResponse } from 'next/server';
import { reflectOnHistory } from '@/lib/agent-memory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const reflection = await reflectOnHistory(symbol);
    return NextResponse.json(reflection);
  } catch (error) {
    console.error('[fusion/analysis/reflection] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reflection' },
      { status: 500 }
    );
  }
}
