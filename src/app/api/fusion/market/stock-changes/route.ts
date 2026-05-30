import { NextRequest, NextResponse } from 'next/server';

// 异动监控数据 - A股特色数据
// 优先尝试东方财富公开API，失败时回退到模拟数据

const TIMEOUT = 8000;

type ChangeType = 'surge' | 'plunge' | 'volume' | 'turnover' | 'amplitude';

interface StockChange {
  symbol: string;           // 股票代码
  name: string;             // 股票名称
  price: number;            // 当前价格
  changePercent: number;    // 涨跌幅%
  volume: number;           // 成交量（手）
  amount: number;           // 成交额（万元）
  turnoverRate: number;     // 换手率%
  amplitude: number;        // 振幅%
  volumeRatio: number;      // 量比
  changeType: ChangeType;   // 异动类型
  changeTime: string;       // 异动时间
  description: string;      // 异动描述
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

// 从东方财富API获取真实异动数据
async function fetchRealData(): Promise<StockChange[]> {
  // 东方财富异动数据接口 - 快速拉升
  const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f4,f5,f6,f7,f8,f12,f14';

  const response = await fetchWithTimeout(url, TIMEOUT);
  if (!response.ok) throw new Error('东方财富API请求失败');

  const data = await response.json();
  if (!data?.data?.diff) throw new Error('东方财富API返回数据为空');

  return data.data.diff.slice(0, 20).map((item: Record<string, number | string>) => {
    const changePercent = Number(item.f3 || 0);
    let changeType: ChangeType = 'surge';
    let description = '';

    if (changePercent > 5) {
      changeType = 'surge';
      description = `快速拉升，涨幅${changePercent.toFixed(2)}%`;
    } else if (changePercent < -5) {
      changeType = 'plunge';
      description = `快速下跌，跌幅${Math.abs(changePercent).toFixed(2)}%`;
    } else {
      changeType = 'volume';
      description = '成交量异动';
    }

    return {
      symbol: String(item.f12 || ''),
      name: String(item.f14 || ''),
      price: Number(item.f2 || 0),
      changePercent,
      volume: Number(item.f5 || 0),
      amount: Number(item.f6 || 0) / 10000,
      turnoverRate: Number(item.f8 || 0),
      amplitude: Number(item.f7 || 0),
      volumeRatio: Number(item.f10 || 1),
      changeType,
      changeTime: new Date().toLocaleTimeString('zh-CN'),
      description,
      isSimulated: false,
    };
  });
}

// 生成模拟异动数据
function generateMockData(): StockChange[] {
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
    { symbol: '000333', name: '美的集团' },
    { symbol: '002594', name: '比亚迪' },
    { symbol: '300059', name: '东方财富' },
    { symbol: '600030', name: '中信证券' },
  ];

  const changeTypes: ChangeType[] = ['surge', 'plunge', 'volume', 'turnover', 'amplitude'];

  const descriptions: Record<ChangeType, string[]> = {
    surge: ['快速拉升', '直线拉升', '大幅上涨', '暴力拉升'],
    plunge: ['快速下跌', '直线跳水', '大幅下挫', '断崖下跌'],
    volume: ['成交量骤增', '量比超5倍', '成交异动放大'],
    turnover: ['换手率超20%', '换手异动', '高换手'],
    amplitude: ['振幅超10%', '剧烈震荡', '大幅波动'],
  };

  return stocks.slice(0, 8 + randInt(0, 8)).map((stock) => {
    const changeType = changeTypes[randInt(0, changeTypes.length)];
    const changePercent = changeType === 'surge' ? rand(5, 10)
      : changeType === 'plunge' ? rand(-10, -5)
      : rand(-3, 3);
    const descList = descriptions[changeType];

    return {
      symbol: stock.symbol,
      name: stock.name,
      price: rand(15, 2000),
      changePercent,
      volume: randInt(10000, 5000000),
      amount: randInt(5000, 300000),
      turnoverRate: changeType === 'turnover' ? rand(15, 30) : rand(1, 10),
      amplitude: changeType === 'amplitude' ? rand(10, 18) : rand(2, 8),
      volumeRatio: changeType === 'volume' ? rand(3, 8) : rand(0.5, 2.5),
      changeType,
      changeTime: `${9 + randInt(0, 6)}:${randInt(0, 59).toString().padStart(2, '0')}:${randInt(0, 59).toString().padStart(2, '0')}`,
      description: descList[randInt(0, descList.length)],
      isSimulated: true,
    };
  });
}

export async function GET(_request: NextRequest) {
  try {
    // 优先尝试真实数据源
    try {
      const realData = await fetchRealData();
      if (realData && realData.length > 0) {
        return NextResponse.json({
          success: true,
          data: realData,
          isSimulated: false,
          timestamp: Date.now(),
        });
      }
    } catch {
      console.log('[fusion/stock-changes] 真实数据获取失败，回退到模拟数据');
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
    console.error('[fusion/stock-changes] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock changes data' },
      { status: 500 }
    );
  }
}
