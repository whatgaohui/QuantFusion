import { NextRequest, NextResponse } from 'next/server';
import { getMockStrategies } from '@/lib/mock-api-data';

export async function GET(request: NextRequest) {
  try {
    const result = getMockStrategies();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fusion strategies API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '获取策略失败' },
      { status: 500 }
    );
  }
}
