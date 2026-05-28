import { NextRequest, NextResponse } from 'next/server';
import { getMockNews } from '@/lib/mock-api-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'general';
    const count = parseInt(searchParams.get('count') || '20', 10);

    const result = getMockNews(market, count);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('Fusion news API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch news data' },
      { status: 500 }
    );
  }
}
