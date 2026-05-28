import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getQuotes } from '@/lib/data-service/quotes';

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
          { success: false, data: null, error: 'No valid symbols provided' },
          { status: 400 }
        );
      }
      const result = await getQuotes(symbolList);
      return NextResponse.json(result, { status: result.success ? 200 : 502 });
    }

    // Single quote request
    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const result = await getQuote(symbol);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion quote API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch quote data' },
      { status: 500 }
    );
  }
}
