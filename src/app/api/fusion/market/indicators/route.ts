import { NextRequest, NextResponse } from 'next/server';
import { getMockIndicators } from '@/lib/mock-api-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: '股票代码参数不能为空' },
        { status: 400 }
      );
    }

    const result = getMockIndicators(symbol);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion indicators API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '获取指标数据失败' },
      { status: 500 }
    );
  }
}
