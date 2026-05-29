import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
      return NextResponse.json(
        { error: '搜索查询参数"q"为必填项' },
        { status: 400 }
      );
    }

    if (!FINNHUB_API_KEY) {
      return NextResponse.json(
        { error: 'Finnhub API密钥未配置' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub API错误: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const results = (data.result || [])
      .filter((item: Record<string, string>) => item.symbol && item.symbol.trim() !== '')
      .map((item: Record<string, string>) => ({
        symbol: item.symbol,
        description: item.description,
        type: item.type,
      }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: '搜索股票失败' },
      { status: 500 }
    );
  }
}
