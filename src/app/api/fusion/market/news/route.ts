import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'general';
  
  try {
    const res = await fetch(`http://localhost:8080/api/news?market=${encodeURIComponent(market)}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 502 });
  }
}
