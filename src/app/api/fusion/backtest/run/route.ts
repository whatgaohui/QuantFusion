import { NextRequest, NextResponse } from 'next/server';
import { getMockBacktest } from '@/lib/mock-api-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const strategy = body.strategy || 'ma_crossover';
    const symbol = body.symbol || 'SH600519';

    const result = getMockBacktest(strategy, symbol);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fusion backtest API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '运行回测失败' },
      { status: 500 }
    );
  }
}
