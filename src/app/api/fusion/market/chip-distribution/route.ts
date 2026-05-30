import { NextRequest, NextResponse } from 'next/server';

// 筹码分布数据 - A股特色数据
// 优先尝试东方财富公开API，失败时回退到模拟数据

const TIMEOUT = 8000;

interface ChipDistribution {
  symbol: string;             // 股票代码
  name: string;               // 股票名称
  currentPrice: number;       // 当前价格
  avgCost: number;            // 平均成本
  profitRatio: number;        // 获利比例%
  chips: {                    // 筹码分布
    price: number;            // 价格区间
    ratio: number;            // 筹码比例%
    type: 'profit' | 'loss';  // 获利/套牢
  }[];
  supportPrice: number;       // 支撑位
  resistancePrice: number;    // 压力位
  concentration: number;      // 筹码集中度（90%成本范围占比）
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

// 从东方财富API获取真实筹码分布数据
async function fetchRealData(symbol: string): Promise<ChipDistribution | null> {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.${symbol}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=120`;

  const response = await fetchWithTimeout(url, TIMEOUT);
  if (!response.ok) throw new Error('东方财富API请求失败');

  const data = await response.json();
  if (!data?.data?.klines) throw new Error('东方财富API返回数据为空');

  // 根据历史K线数据计算简化的筹码分布
  const klines = data.data.klines as string[];
  if (klines.length < 10) throw new Error('K线数据不足');

  const closes = klines.map(k => Number(k.split(',')[2])).filter(v => v > 0);
  const currentPrice = closes[closes.length - 1];
  const minPrice = Math.min(...closes);
  const maxPrice = Math.max(...closes);

  // 简化筹码计算：按价格区间统计
  const range = maxPrice - minPrice;
  const bins = 20;
  const binSize = range / bins;
  const counts = new Array(bins).fill(0);

  for (const price of closes) {
    const idx = Math.min(Math.floor((price - minPrice) / binSize), bins - 1);
    counts[idx]++;
  }

  const total = counts.reduce((a, b) => a + b, 0);
  const chips = counts.map((count, i) => {
    const price = Number((minPrice + (i + 0.5) * binSize).toFixed(2));
    const ratio = Number((count / total * 100).toFixed(2));
    return { price, ratio, type: price <= currentPrice ? 'profit' as const : 'loss' as const };
  });

  const profitCount = chips.filter(c => c.type === 'profit').reduce((s, c) => s + c.ratio, 0);
  const avgCost = Number((chips.reduce((s, c) => s + c.price * c.ratio, 0) / 100).toFixed(2));

  // 90%筹码集中度
  const sortedChips = [...chips].sort((a, b) => b.ratio - a.ratio);
  let cumRatio = 0;
  let lowPrice = currentPrice;
  let highPrice = currentPrice;
  for (const chip of sortedChips) {
    cumRatio += chip.ratio;
    lowPrice = Math.min(lowPrice, chip.price);
    highPrice = Math.max(highPrice, chip.price);
    if (cumRatio >= 90) break;
  }

  return {
    symbol,
    name: data.data.name || symbol,
    currentPrice: Number(currentPrice.toFixed(2)),
    avgCost,
    profitRatio: Number(profitCount.toFixed(2)),
    chips,
    supportPrice: Number(lowPrice.toFixed(2)),
    resistancePrice: Number(highPrice.toFixed(2)),
    concentration: Number(((highPrice - lowPrice) / currentPrice * 100).toFixed(2)),
    isSimulated: false,
  };
}

// 生成模拟筹码分布数据
function generateMockData(symbol: string): ChipDistribution {
  const currentPrice = symbol === '600519' ? 1688.50
    : symbol === '300750' ? 218.35
    : symbol === '000858' ? 142.60
    : 25 + Math.random() * 100;

  const spread = currentPrice * 0.15; // 15%的价格范围
  const avgCost = Number((currentPrice - spread * 0.1 + Math.random() * spread * 0.2).toFixed(2));

  // 生成正态分布的筹码
  const bins = 20;
  const minPrice = Number((currentPrice - spread).toFixed(2));
  const maxPrice = Number((currentPrice + spread).toFixed(2));
  const binSize = (maxPrice - minPrice) / bins;

  // 用正态分布模拟筹码集中
  const mean = avgCost;
  const std = spread / 3;
  const rawChips: number[] = [];
  for (let i = 0; i < bins; i++) {
    const price = minPrice + (i + 0.5) * binSize;
    const z = (price - mean) / std;
    rawChips.push(Math.exp(-0.5 * z * z));
  }
  const totalRaw = rawChips.reduce((a, b) => a + b, 0);

  const chips = rawChips.map((raw, i) => {
    const price = Number((minPrice + (i + 0.5) * binSize).toFixed(2));
    const ratio = Number((raw / totalRaw * 100).toFixed(2));
    return { price, ratio, type: price <= currentPrice ? 'profit' as const : 'loss' as const };
  });

  const profitRatio = Number(chips.filter(c => c.type === 'profit').reduce((s, c) => s + c.ratio, 0).toFixed(2));

  return {
    symbol,
    name: symbol === '600519' ? '贵州茅台' : symbol === '300750' ? '宁德时代' : symbol === '000858' ? '五粮液' : symbol,
    currentPrice: Number(currentPrice.toFixed(2)),
    avgCost,
    profitRatio,
    chips,
    supportPrice: Number((currentPrice - spread * 0.8).toFixed(2)),
    resistancePrice: Number((currentPrice + spread * 0.6).toFixed(2)),
    concentration: Number((15 + Math.random() * 10).toFixed(2)),
    isSimulated: true,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // 优先尝试真实数据源
    try {
      const realData = await fetchRealData(symbol);
      if (realData) {
        return NextResponse.json({
          success: true,
          data: realData,
          isSimulated: false,
          timestamp: Date.now(),
        });
      }
    } catch {
      console.log('[fusion/chip-distribution] 真实数据获取失败，回退到模拟数据');
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
    console.error('[fusion/chip-distribution] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chip distribution data' },
      { status: 500 }
    );
  }
}
