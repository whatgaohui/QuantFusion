import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || '';
  
  try {
    const res = await fetch(`http://localhost:8080/api/indicators?symbol=${encodeURIComponent(symbol)}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch indicators' }, { status: 502 });
  }
}
