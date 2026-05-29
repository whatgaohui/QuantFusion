import { NextRequest, NextResponse } from 'next/server';
import { getMockQuote, getMockQuotes } from '@/lib/mock-api-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const symbols = searchParams.get('symbols');

    // Batch quote request
    if (symbols) {
      const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
      if (symbolList.length === 0) {
        return NextResponse.json(
          { success: false, data: null, error: '未提供有效的股票代码' },
          { status: 400 }
        );
      }
      const result = getMockQuotes(symbolList);
      return NextResponse.json(result, { status: result.success ? 200 : 502 });
    }

    // Single quote request
    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: '股票代码参数不能为空' },
        { status: 400 }
      );
    }

    const result = getMockQuote(symbol);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion quote API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '获取行情数据失败' },
      { status: 500 }
    );
  }
}
