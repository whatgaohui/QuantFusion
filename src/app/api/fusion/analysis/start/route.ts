import { NextRequest, NextResponse } from 'next/server';
import { analyzeStock } from '@/lib/ai-service';
import { getQuote } from '@/lib/data-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, mode = 'standard' } = body;

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Only fetch quote for AI analysis (skip indicators to save memory)
    let stockName = symbol;
    let marketData: { price?: number; change?: number; changePercent?: number } = {};

    try {
      const quoteResult = await getQuote(symbol);
      if (quoteResult.data) {
        stockName = quoteResult.data.name;
        marketData = {
          price: quoteResult.data.currentPrice,
          change: quoteResult.data.change,
          changePercent: quoteResult.data.changePercent,
        };
      }
    } catch { /* ignore */ }

    // Try AI analysis with timeout
    try {
      const result = await analyzeStock(symbol, stockName, marketData, mode);

      if (!result.isOffline && result.analysis.summary) {
        return NextResponse.json({
          success: true,
          data: {
            task_id: crypto.randomUUID(),
            status: 'completed',
            source: 'ai',
            symbol,
            name: stockName,
            mode,
            analysis: result.analysis,
          },
          error: null,
        });
      }
    } catch (aiError) {
      console.error('AI analysis failed, falling back to mock:', aiError instanceof Error ? aiError.message : 'Unknown');
    }

    // Fallback to mock
    return NextResponse.json({
      success: true,
      data: {
        task_id: crypto.randomUUID(),
        status: 'completed',
        source: 'mock',
        symbol,
        name: stockName,
        mode,
      },
      error: null,
    });
  } catch (err) {
    console.error('Analysis start API error:', err);
    return NextResponse.json({
      success: true,
      data: {
        task_id: crypto.randomUUID(),
        status: 'completed',
        source: 'mock',
        symbol: 'UNKNOWN',
        name: 'UNKNOWN',
        mode: 'standard',
      },
      error: null,
    });
  }
}
