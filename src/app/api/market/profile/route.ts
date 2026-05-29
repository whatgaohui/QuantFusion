import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: '股票代码参数不能为空' },
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
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Finnhub API错误: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data || !data.name) {
      return NextResponse.json(
        { error: '未找到该股票的公司资料' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      country: data.country,
      currency: data.currency,
      exchange: data.exchange,
      finnhubIndustry: data.finnhubIndustry,
      ipo: data.ipo,
      logo: data.logo,
      marketCapitalization: data.marketCapitalization,
      name: data.name,
      phone: data.phone,
      shareOutstanding: data.shareOutstanding,
      ticker: data.ticker,
      weburl: data.weburl,
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: '获取公司资料失败' },
      { status: 500 }
    );
  }
}
