import { NextRequest, NextResponse } from 'next/server';
import { getIndicators } from '@/lib/data-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const result = await getIndicators(symbol);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion indicators API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch indicators data' },
      { status: 500 }
    );
  }
}
