import { NextRequest, NextResponse } from 'next/server';
import { getMockBrief } from '@/lib/mock-api-data';

export async function GET(request: NextRequest) {
  try {
    const result = getMockBrief();
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI brief API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to generate brief' },
      { status: 500 }
    );
  }
}
