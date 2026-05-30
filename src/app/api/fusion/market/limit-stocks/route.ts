import { NextRequest, NextResponse } from 'next/server';

// 涨跌停股票数据 - A股特色数据
// 优先尝试东方财富公开API，失败时回退到模拟数据

const TIMEOUT = 8000;

interface LimitStock {
  symbol: string;           // 股票代码
  name: string;             // 股票名称
  closePrice: number;       // 收盘价
  changePercent: number;    // 涨跌幅%
  turnoverRate: number;     // 换手率%
  volume: number;           // 成交量（手）
  amount: number;           // 成交额（万元）
  limitTime: string;        // 封板时间
  openTimes: number;        // 开板次数
  continuousDays: number;   // 连板天数
  reason: string;           // 涨跌停原因/所属板块
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

// 从东方财富API获取真实涨跌停数据
async function fetchRealData(type: 'limit_up' | 'limit_down'): Promise<LimitStock[]> {
  const reportName = type === 'limit_up' ? 'RPT_ZTZSTOCKDETAILS' : 'RPT_DTZTSTOCKDETAILS';
  const url = `https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=FIRST_LIMIT_TIME&sortTypes=1&pageSize=50&pageNumber=1&reportName=${reportName}&columns=ALL&source=WEB&client=WEB`;

  const response = await fetchWithTimeout(url, TIMEOUT);
  if (!response.ok) throw new Error('东方财富API请求失败');

  const data = await response.json();
  if (!data?.result?.data) throw new Error('东方财富API返回数据为空');

  return data.result.data.map((item: Record<string, unknown>) => ({
    symbol: String(item.SECURITY_CODE || ''),
    name: String(item.SECURITY_NAME_ABBR || ''),
    closePrice: Number(item.NEW_PRICE || 0),
    changePercent: Number(item.CHANGE_RATE || 0),
    turnoverRate: Number(item.TURNOVERRATE || 0),
    volume: Number(item.VOLUME || 0) / 100,
    amount: Number(item.DEAL_AMOUNT || 0) / 10000,
    limitTime: String(item.FIRST_LIMIT_TIME || ''),
    openTimes: Number(item.OPEN_TIMES || 0),
    continuousDays: Number(item.CONTINUOUS_DAYS || 1),
    reason: String(item.INDUSTRY || ''),
    isSimulated: false,
  }));
}

// 生成模拟涨跌停数据
function generateMockData(type: 'limit_up' | 'limit_down'): LimitStock[] {
  const rand = (min: number, max: number) => Number((min + Math.random() * (max - min)).toFixed(2));
  const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

  const limitUpStocks = [
    { symbol: '300750', name: '宁德时代', reason: '新能源' },
    { symbol: '002049', name: '紫光国微', reason: '芯片半导体' },
    { symbol: '601012', name: '隆基绿能', reason: '光伏' },
    { symbol: '300059', name: '东方财富', reason: '券商' },
    { symbol: '002594', name: '比亚迪', reason: '新能源汽车' },
    { symbol: '300274', name: '阳光电源', reason: '储能' },
    { symbol: '688981', name: '中芯国际', reason: '芯片代工' },
    { symbol: '603259', name: '药明康德', reason: '医药CXO' },
    { symbol: '600745', name: '闻泰科技', reason: '消费电子' },
    { symbol: '002475', name: '立讯精密', reason: '苹果产业链' },
    { symbol: '300124', name: '汇川技术', reason: '工控' },
    { symbol: '688012', name: '中微公司', reason: '半导体设备' },
  ];

  const limitDownStocks = [
    { symbol: '600030', name: '中信证券', reason: '券商' },
    { symbol: '000002', name: '万科A', reason: '房地产' },
    { symbol: '601688', name: '华泰证券', reason: '券商' },
    { symbol: '600048', name: '保利发展', reason: '房地产' },
    { symbol: '000651', name: '格力电器', reason: '家电' },
    { symbol: '600585', name: '海螺水泥', reason: '建材' },
    { symbol: '601668', name: '中国建筑', reason: '基建' },
    { symbol: '601857', name: '中国石油', reason: '石油' },
  ];

  const stocks = type === 'limit_up' ? limitUpStocks : limitDownStocks;

  return stocks.map((stock) => {
    const changePercent = type === 'limit_up' ? rand(9.8, 10.02) : rand(-10.02, -9.8);
    return {
      symbol: stock.symbol,
      name: stock.name,
      closePrice: rand(10, 200),
      changePercent,
      turnoverRate: rand(3, 25),
      volume: randInt(50000, 2000000),
      amount: randInt(10000, 500000),
      limitTime: `${9 + randInt(0, 3)}:${randInt(0, 59).toString().padStart(2, '0')}`,
      openTimes: randInt(0, 4),
      continuousDays: randInt(1, type === 'limit_up' ? 8 : 3),
      reason: stock.reason,
      isSimulated: true,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') === 'limit_down' ? 'limit_down' : 'limit_up';

    // 优先尝试真实数据源
    try {
      const realData = await fetchRealData(type);
      if (realData && realData.length > 0) {
        return NextResponse.json({
          success: true,
          data: realData,
          type,
          isSimulated: false,
          timestamp: Date.now(),
        });
      }
    } catch {
      console.log('[fusion/limit-stocks] 真实数据获取失败，回退到模拟数据');
    }

    // 回退到模拟数据
    const mockData = generateMockData(type);
    return NextResponse.json({
      success: true,
      data: mockData,
      type,
      isSimulated: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[fusion/limit-stocks] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch limit stocks data' },
      { status: 500 }
    );
  }
}
