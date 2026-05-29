import { NextRequest, NextResponse } from 'next/server';
import { getMockQuote, getMockQuotes } from '@/lib/mock-api-data';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';

function toFinnhubSymbol(symbol: string): string {
  if (symbol.startsWith('SH')) return symbol.slice(2) + '.SS';
  if (symbol.startsWith('SZ')) return symbol.slice(2) + '.SZ';
  if (symbol.startsWith('HK')) return symbol.slice(2).replace(/^0*/, '') + '.HK';
  return symbol;
}

const STOCK_NAMES: Record<string, string> = {
  'AAPL': '苹果', 'NVDA': '英伟达', 'TSLA': '特斯拉', 'MSFT': '微软',
  'AMZN': '亚马逊', 'META': 'Meta', 'GOOGL': '谷歌', 'AMD': 'AMD',
  'JPM': '摩根大通', 'V': 'Visa',
  'SH600519': '贵州茅台', 'SH601318': '中国平安', 'SH600036': '招商银行',
  'SZ000858': '五粮液', 'SH601398': '工商银行', 'SZ300750': '宁德时代',
  'SH600276': '恒瑞医药', 'SH600030': '中信证券', 'SZ000333': '美的集团',
  'SH600900': '长江电力', 'SH601899': '紫金矿业', 'SZ002475': '立讯精密',
  'HK00700': '腾讯控股', 'HK09988': '阿里巴巴', 'HK03690': '美团',
  'HK00005': '汇丰控股', 'HK00941': '中国移动', 'HK01299': '友邦保险',
  'HK01810': '小米集团', 'HK09618': '京东集团', 'HK09888': '百度集团', 'HK02015': '理想汽车',
};

async function fetchFinnhubQuote(symbol: string) {
  const finnhubSymbol = toFinnhubSymbol(symbol);
  const data = await finnhubFetch<{
    c: number; // current price
    h: number; // high
    l: number; // low
    o: number; // open
    pc: number; // previous close
    dp: number; // change percent
    d: number; // change
  }>('quote', { symbol: finnhubSymbol });

  if (!data || !data.c || data.c === 0) return null;

  return {
    symbol,
    name: STOCK_NAMES[symbol] || symbol,
    currentPrice: data.c,
    change: data.d || 0,
    changePercent: data.dp || 0,
    high: data.h || 0,
    low: data.l || 0,
    open: data.o || 0,
    prevClose: data.pc || 0,
    volume: 0, // Not available in basic quote
    market: symbol.startsWith('SH') || symbol.startsWith('SZ') ? 'A' : symbol.startsWith('HK') ? 'HK' : 'US',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const symbols = searchParams.get('symbols');

    // Batch quote request
    if (symbols) {
      const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
      if (symbolList.length === 0) {
        return NextResponse.json(
          { success: false, data: null, error: '未提供有效的股票代码' },
          { status: 400 }
        );
      }

      // Try Finnhub for each symbol in parallel (batch of 3 to avoid rate limits)
      const quotes: Array<NonNullable<Awaited<ReturnType<typeof fetchFinnhubQuote>>>> = [];
      let anyRealData = false;

      for (let i = 0; i < symbolList.length; i += 3) {
        const batch = symbolList.slice(i, i + 3);
        const batchResults = await Promise.all(batch.map(s => fetchFinnhubQuote(s)));
        for (const result of batchResults) {
          if (result) {
            quotes.push(result);
            anyRealData = true;
          }
        }
      }

      if (quotes.length > 0) {
        return NextResponse.json({ success: true, data: quotes, error: null });
      }

      // Fallback to mock
      const result = getMockQuotes(symbolList);
      return NextResponse.json(result, { status: result.success ? 200 : 502 });
    }

    // Single quote request
    if (!symbol) {
      return NextResponse.json(
        { success: false, data: null, error: '股票代码参数不能为空' },
        { status: 400 }
      );
    }

    const realQuote = await fetchFinnhubQuote(symbol);
    if (realQuote) {
      return NextResponse.json({ success: true, data: realQuote, error: null });
    }

    // Fallback to mock
    const result = getMockQuote(symbol);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    console.error('Fusion quote API error:', error);
    // Fallback to mock
    const symbols = searchParams.get('symbols');
    const symbol = searchParams.get('symbol');
    if (symbols) {
      const result = getMockQuotes(symbols.split(',').map(s => s.trim()).filter(Boolean));
      return NextResponse.json(result, { status: result.success ? 200 : 502 });
    }
    if (symbol) {
      const result = getMockQuote(symbol);
      return NextResponse.json(result, { status: result.success ? 200 : 404 });
    }
    return NextResponse.json(
      { success: false, data: null, error: '获取行情数据失败' },
      { status: 500 }
    );
  }
}
