import { NextRequest, NextResponse } from 'next/server';

// 龙虎榜数据 - A股特色数据
// 优先尝试东方财富公开API，失败时回退到模拟数据

const TIMEOUT = 8000;

// 龙虎榜条目类型
interface DragonTigerEntry {
  symbol: string;        // 股票代码
  name: string;          // 股票名称
  date: string;          // 上榜日期
  closePrice: number;    // 收盘价
  changePercent: number; // 涨跌幅%
  reason: string;        // 上榜原因
  turnover: number;      // 上榜成交额（万元）
  buyAmount: number;     // 买入总额（万元）
  sellAmount: number;    // 卖出总额（万元）
  netAmount: number;     // 净买入额（万元）
  departments: {         // 营业部详情
    name: string;
    buyAmount: number;
    sellAmount: number;
  }[];
  isSimulated?: boolean; // 是否为模拟数据
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

// 从东方财富API获取真实龙虎榜数据
async function fetchRealData(date?: string): Promise<DragonTigerEntry[]> {
  const dateParam = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=TRADE_DATE&sortTypes=-1&pageSize=20&pageNumber=1&reportName=R_DAILYBOARD_DETAILSNEW&columns=ALL&source=WEB&client=WEB&filter=(TRADE_DATE%3D%27${dateParam}%27)`;

  const response = await fetchWithTimeout(url, TIMEOUT);
  if (!response.ok) throw new Error('东方财富API请求失败');

  const data = await response.json();
  if (!data?.result?.data) throw new Error('东方财富API返回数据为空');

  return data.result.data.map((item: Record<string, unknown>) => ({
    symbol: String(item.SECURITY_CODE || ''),
    name: String(item.SECURITY_NAME_ABBR || ''),
    date: String(item.TRADE_DATE || '').split(' ')[0],
    closePrice: Number(item.CLOSE_PRICE || 0),
    changePercent: Number(item.CHANGE_RATE || 0),
    reason: String(item.EXPLAIN || ''),
    turnover: Number(item.DEAL_AMOUNT || 0) / 10000,
    buyAmount: Number(item.BUY_AMOUNT || 0) / 10000,
    sellAmount: Number(item.SELL_AMOUNT || 0) / 10000,
    netAmount: Number(item.NET_BUY_AMOUNT || 0) / 10000,
    departments: [],
    isSimulated: false,
  }));
}

// 生成模拟龙虎榜数据
function generateMockData(): DragonTigerEntry[] {
  const rand = (min: number, max: number) => Number((min + Math.random() * (max - min)).toFixed(2));
  const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

  const stocks = [
    { symbol: '300750', name: '宁德时代' },
    { symbol: '002415', name: '海康威视' },
    { symbol: '600519', name: '贵州茅台' },
    { symbol: '000858', name: '五粮液' },
    { symbol: '601398', name: '工商银行' },
    { symbol: '600036', name: '招商银行' },
    { symbol: '300760', name: '迈瑞医疗' },
    { symbol: '002049', name: '紫光国微' },
    { symbol: '601012', name: '隆基绿能' },
    { symbol: '000538', name: '云南白药' },
    { symbol: '600276', name: '恒瑞医药' },
    { symbol: '601888', name: '中国中免' },
  ];

  const reasons = [
    '日涨幅偏离值达7%',
    '日换手率达到20%',
    '日涨幅偏离值达7%',
    '连续三个交易日涨幅偏离值累计达20%',
    '日振幅值达15%',
    '日换手率达到20%',
  ];

  const departments = [
    '东方财富证券拉萨团结路第二营业部',
    '国泰君安证券上海江苏路营业部',
    '华鑫证券上海分公司',
    '中信证券上海分公司',
    '中国银河证券绍兴营业部',
    '招商证券深圳深南东路营业部',
  ];

  const today = new Date().toISOString().split('T')[0];

  return stocks.slice(0, 8 + randInt(0, 5)).map((stock) => {
    const changePercent = rand(-3, 10);
    const buyAmount = randInt(5000, 80000);
    const sellAmount = randInt(3000, 60000);
    const netAmount = buyAmount - sellAmount;

    return {
      symbol: stock.symbol,
      name: stock.name,
      date: today,
      closePrice: rand(20, 2000),
      changePercent,
      reason: reasons[randInt(0, reasons.length)],
      turnover: buyAmount + sellAmount + randInt(1000, 10000),
      buyAmount,
      sellAmount,
      netAmount,
      departments: departments.slice(0, 2 + randInt(0, 3)).map((dept) => ({
        name: dept,
        buyAmount: randInt(1000, 30000),
        sellAmount: randInt(500, 20000),
      })),
      isSimulated: true,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;

    // 优先尝试真实数据源
    try {
      const realData = await fetchRealData(date);
      if (realData && realData.length > 0) {
        return NextResponse.json({
          success: true,
          data: realData,
          isSimulated: false,
          timestamp: Date.now(),
        });
      }
    } catch {
      console.log('[fusion/dragon-tiger] 真实数据获取失败，回退到模拟数据');
    }

    // 回退到模拟数据
    const mockData = generateMockData();
    return NextResponse.json({
      success: true,
      data: mockData,
      isSimulated: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[fusion/dragon-tiger] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dragon-tiger data' },
      { status: 500 }
    );
  }
}
