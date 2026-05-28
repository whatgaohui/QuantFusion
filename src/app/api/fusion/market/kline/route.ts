import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || '';
  const resolution = searchParams.get('resolution') || 'D';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  
  try {
    const params = new URLSearchParams({ symbol, resolution });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`http://localhost:8080/api/kline?${params.toString()}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch kline' }, { status: 502 });
  }
}
