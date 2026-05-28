import { NextRequest, NextResponse } from 'next/server';
import { getMockAnalysis } from '@/lib/mock-api-data';

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

    const result = getMockAnalysis(symbol, mode);
    return NextResponse.json({
      success: true,
      data: {
        task_id: crypto.randomUUID(),
        status: 'completed',
        ...result.data,
      },
      error: null,
    });
  } catch (error) {
    console.error('Analysis start API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}
