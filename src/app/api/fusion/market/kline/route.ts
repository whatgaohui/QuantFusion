import { NextRequest, NextResponse } from 'next/server';
import { getMockKline } from '@/lib/mock-api-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const count = parseInt(searchParams.get('count') || '90', 10);

    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const result = getMockKline(symbol, count);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion kline API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch kline data' },
      { status: 500 }
    );
  }
}
