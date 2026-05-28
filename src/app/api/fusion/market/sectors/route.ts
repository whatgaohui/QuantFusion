import { NextRequest, NextResponse } from 'next/server';
import { getSectors } from '@/lib/data-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'A';

    const result = await getSectors(market);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    console.error('Fusion sectors API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch sectors data' },
      { status: 500 }
    );
  }
}
