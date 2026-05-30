import { NextRequest, NextResponse } from 'next/server';

// 融资融券数据 - A股特色数据
// 优先尝试东方财富公开API，失败时回退到模拟数据

const TIMEOUT = 8000;

interface MarginData {
  symbol: string;          // 股票代码
  name: string;            // 股票名称
  rzBuyAmount: number;     // 融资买入额（万元）
  rqBuyVolume: number;     // 融券买入量（万股）
  rzBalance: number;       // 融资余额（万元）
  rqBalance: number;       // 融券余额（万元）
  rzRqBalance: number;     // 融资融券余额（万元）
  rzBalanceChange: number; // 融资余额较前日增减（万元）
  rqBalanceChange: number; // 融券余额较前日增减（万元）
  changePercent: number;   // 当日涨跌幅%
  isSimulated?: boolean;
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// 从东方财富API获取真实融资融券数据
async function fetchRealData(symbol?: string): Promise<MarginData[]> {
  const pageSize = symbol ? 1 : 20;
  let filter = '';
  if (symbol) {
    // 将A股代码转换为东方财富格式
    filter = `(SECURITY_CODE%3D%22${symbol}%22)`;
  }

  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=RZ_RQYE&sortTypes=-1&pageSize=${pageSize}&pageNumber=1&reportName=RPT_RZRQ_LSHJ&columns=ALL&source=WEB&client=WEB${filter ? '&filter=' + filter : ''}`;

  const response = await fetchWithTimeout(url, TIMEOUT);
  if (!response.ok) throw new Error('东方财富API请求失败');

  const data = await response.json();
  if (!data?.result?.data) throw new Error('东方财富API返回数据为空');

  return data.result.data.map((item: Record<string, unknown>) => ({
    symbol: String(item.SECURITY_CODE || ''),
    name: String(item.SECURITY_NAME_ABBR || ''),
    rzBuyAmount: Number(item.RZ_MRE || 0) / 10000,
    rqBuyVolume: Number(item.RQ_MRE || 0) / 10000,
    rzBalance: Number(item.RZ_YE || 0) / 10000,
    rqBalance: Number(item.RQ_YE || 0) / 10000,
    rzRqBalance: Number(item.RZRQ_YE || 0) / 10000,
    rzBalanceChange: Number(item.RZ_YE_ZJZC || 0) / 10000,
    rqBalanceChange: Number(item.RQ_YE_ZJZC || 0) / 10000,
    changePercent: Number(item.CHANGE_RATE || 0),
    isSimulated: false,
  }));
}

// 生成模拟融资融券数据
function generateMockData(symbol?: string): MarginData[] {
  const rand = (min: number, max: number) => Number((min + Math.random() * (max - min)).toFixed(2));

  const topMarginStocks = [
    { symbol: '600519', name: '贵州茅台' },
    { symbol: '300750', name: '宁德时代' },
    { symbol: '601318', name: '中国平安' },
    { symbol: '600036', name: '招商银行' },
    { symbol: '000858', name: '五粮液' },
    { symbol: '601012', name: '隆基绿能' },
    { symbol: '000333', name: '美的集团' },
    { symbol: '002415', name: '海康威视' },
    { symbol: '600276', name: '恒瑞医药' },
    { symbol: '601888', name: '中国中免' },
    { symbol: '000538', name: '云南白药' },
    { symbol: '600030', name: '中信证券' },
  ];

  const stocks = symbol
    ? topMarginStocks.filter(s => s.symbol === symbol).length > 0
      ? topMarginStocks.filter(s => s.symbol === symbol)
      : [{ symbol, name: symbol }]
    : topMarginStocks;

  return stocks.map((stock) => {
    const rzBalance = rand(50000, 2000000);
    const rqBalance = rand(500, 50000);
    return {
      symbol: stock.symbol,
      name: stock.name,
      rzBuyAmount: rand(5000, 100000),
      rqBuyVolume: rand(10, 500),
      rzBalance,
      rqBalance,
      rzRqBalance: Number((rzBalance + rqBalance).toFixed(2)),
      rzBalanceChange: rand(-30000, 30000),
      rqBalanceChange: rand(-2000, 2000),
      changePercent: rand(-3, 3),
      isSimulated: true,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;

    // 优先尝试真实数据源
    try {
      const realData = await fetchRealData(symbol);
      if (realData && realData.length > 0) {
        return NextResponse.json({
          success: true,
          data: realData,
          isSimulated: false,
          timestamp: Date.now(),
        });
      }
    } catch {
      console.log('[fusion/margin-trading] 真实数据获取失败，回退到模拟数据');
    }

    // 回退到模拟数据
    const mockData = generateMockData(symbol);
    return NextResponse.json({
      success: true,
      data: mockData,
      isSimulated: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[fusion/margin-trading] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch margin trading data' },
      { status: 500 }
    );
  }
}
