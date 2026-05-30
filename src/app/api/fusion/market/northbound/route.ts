import { NextRequest, NextResponse } from 'next/server';

// 北向资金数据 - A股特色数据
// 优先尝试东方财富公开API，失败时回退到模拟数据

const TIMEOUT = 8000;

interface NorthboundData {
  date: string;            // 日期
  hkToShNet: number;       // 沪股通净买入（亿元）
  hkToSzNet: number;       // 深股通净买入（亿元）
  totalNet: number;        // 北向合计净买入（亿元）
  hkToShBuy: number;       // 沪股通买入（亿元）
  hkToShSell: number;      // 沪股通卖出（亿元）
  hkToSzBuy: number;       // 深股通买入（亿元）
  hkToSzSell: number;      // 深股通卖出（亿元）
  totalBuy: number;        // 合计买入（亿元）
  totalSell: number;       // 合计卖出（亿元）
  isSimulated?: boolean;
}

interface NorthboundStock {
  symbol: string;
  name: string;
  netBuy: number;          // 净买入（亿元）
  buyAmount: number;       // 买入额（亿元）
  sellAmount: number;      // 卖出额（亿元）
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

// 从东方财富API获取真实北向资金数据
async function fetchRealData(): Promise<{ summary: NorthboundData; topStocks: NorthboundStock[] } | null> {
  const url = 'https://datacenter-web.eastmoney.com/api/data/v1/get?sortColumns=TRADE_DATE&sortTypes=-1&pageSize=1&pageNumber=1&reportName=RPT_HKSHSZ_STODETAILS_NEW&columns=ALL&source=WEB&client=WEB';

  const response = await fetchWithTimeout(url, TIMEOUT);
  if (!response.ok) throw new Error('东方财富API请求失败');

  const data = await response.json();
  if (!data?.result?.data?.[0]) throw new Error('东方财富API返回数据为空');

  const item = data.result.data[0];
  const hkToShNet = Number(item.SH_NET_AMOUNT || 0) / 100000000;
  const hkToSzNet = Number(item.SZ_NET_AMOUNT || 0) / 100000000;
  const hkToShBuy = Number(item.SH_BUY_AMOUNT || 0) / 100000000;
  const hkToShSell = Number(item.SH_SELL_AMOUNT || 0) / 100000000;
  const hkToSzBuy = Number(item.SZ_BUY_AMOUNT || 0) / 100000000;
  const hkToSzSell = Number(item.SZ_SELL_AMOUNT || 0) / 100000000;

  const summary: NorthboundData = {
    date: String(item.TRADE_DATE || '').split(' ')[0],
    hkToShNet: Number(hkToShNet.toFixed(2)),
    hkToSzNet: Number(hkToSzNet.toFixed(2)),
    totalNet: Number((hkToShNet + hkToSzNet).toFixed(2)),
    hkToShBuy: Number(hkToShBuy.toFixed(2)),
    hkToShSell: Number(hkToShSell.toFixed(2)),
    hkToSzBuy: Number(hkToSzBuy.toFixed(2)),
    hkToSzSell: Number(hkToSzSell.toFixed(2)),
    totalBuy: Number((hkToShBuy + hkToSzBuy).toFixed(2)),
    totalSell: Number((hkToShSell + hkToSzSell).toFixed(2)),
    isSimulated: false,
  };

  return { summary, topStocks: [] };
}

// 生成模拟北向资金数据
function generateMockData(): { summary: NorthboundData; topStocks: NorthboundStock[] } {
  const rand = (min: number, max: number) => Number((min + Math.random() * (max - min)).toFixed(2));

  const hkToShBuy = rand(200, 600);
  const hkToShSell = rand(150, 500);
  const hkToSzBuy = rand(150, 450);
  const hkToSzSell = rand(100, 400);
  const hkToShNet = Number((hkToShBuy - hkToShSell).toFixed(2));
  const hkToSzNet = Number((hkToSzBuy - hkToSzSell).toFixed(2));

  const today = new Date().toISOString().split('T')[0];

  const topStocks: NorthboundStock[] = [
    { symbol: '600519', name: '贵州茅台', netBuy: rand(3, 15), buyAmount: rand(8, 25), sellAmount: rand(2, 10), changePercent: rand(-2, 3) },
    { symbol: '300750', name: '宁德时代', netBuy: rand(2, 12), buyAmount: rand(5, 18), sellAmount: rand(1, 8), changePercent: rand(-2, 4) },
    { symbol: '601318', name: '中国平安', netBuy: rand(2, 10), buyAmount: rand(4, 15), sellAmount: rand(1, 7), changePercent: rand(-1, 2) },
    { symbol: '600036', name: '招商银行', netBuy: rand(1, 8), buyAmount: rand(3, 12), sellAmount: rand(1, 6), changePercent: rand(-1, 2) },
    { symbol: '000858', name: '五粮液', netBuy: rand(1, 7), buyAmount: rand(3, 10), sellAmount: rand(1, 5), changePercent: rand(-2, 3) },
    { symbol: '601012', name: '隆基绿能', netBuy: rand(-5, 5), buyAmount: rand(2, 8), sellAmount: rand(2, 10), changePercent: rand(-3, 2) },
    { symbol: '600276', name: '恒瑞医药', netBuy: rand(1, 6), buyAmount: rand(2, 8), sellAmount: rand(1, 5), changePercent: rand(-1, 3) },
    { symbol: '002415', name: '海康威视', netBuy: rand(-3, 4), buyAmount: rand(2, 7), sellAmount: rand(2, 8), changePercent: rand(-2, 2) },
    { symbol: '601888', name: '中国中免', netBuy: rand(-2, 5), buyAmount: rand(2, 6), sellAmount: rand(1, 7), changePercent: rand(-2, 3) },
    { symbol: '000333', name: '美的集团', netBuy: rand(1, 5), buyAmount: rand(2, 7), sellAmount: rand(1, 4), changePercent: rand(-1, 2) },
  ];

  return {
    summary: {
      date: today,
      hkToShNet,
      hkToSzNet,
      totalNet: Number((hkToShNet + hkToSzNet).toFixed(2)),
      hkToShBuy,
      hkToShSell,
      hkToSzBuy,
      hkToSzSell,
      totalBuy: Number((hkToShBuy + hkToSzBuy).toFixed(2)),
      totalSell: Number((hkToShSell + hkToSzSell).toFixed(2)),
      isSimulated: true,
    },
    topStocks,
  };
}

export async function GET(_request: NextRequest) {
  try {
    // 优先尝试真实数据源
    try {
      const realData = await fetchRealData();
      if (realData) {
        return NextResponse.json({
          success: true,
          data: {
            ...realData,
            topStocks: realData.topStocks.length > 0 ? realData.topStocks : generateMockData().topStocks,
          },
          isSimulated: false,
          timestamp: Date.now(),
        });
      }
    } catch {
      console.log('[fusion/northbound] 真实数据获取失败，回退到模拟数据');
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
    console.error('[fusion/northbound] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch northbound data' },
      { status: 500 }
    );
  }
}
