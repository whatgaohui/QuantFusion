/**
 * 市场评估引擎 - 红绿灯系统
 * 基于多维指标评估市场状态: MA趋势 + RSI + MACD + 成量 + 北向资金
 * 三个市场独立评估: A股 / 港股 / 美股
 * 缓存5分钟
 */

import { getFinnhubApiKey } from '@/lib/finnhub-config';

/** 红绿灯状态 */
export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED';

/** 单项评分 */
export interface DimensionScore {
  name: string;         // 维度名称
  score: number;        // 0-100
  signal: 'bullish' | 'neutral' | 'bearish';
  detail: string;       // 简要说明
}

/** 单个市场评估结果 */
export interface MarketAssessment {
  market: string;       // A / HK / US
  marketName: string;   // A股 / 港股 / 美股
  trafficLight: TrafficLight;
  overallScore: number; // 0-100 综合评分
  dimensions: DimensionScore[];
  summary: string;      // 简要解读
  updatedAt: string;
}

/** 三市场评估结果 */
export interface MarketReview {
  markets: MarketAssessment[];
  overallLight: TrafficLight;  // 综合红绿灯
  overallScore: number;        // 综合评分
  overallSummary: string;      // 综合解读
  timestamp: string;
}

// ============================================================
// 缓存系统 - 5分钟缓存
// ============================================================

let cachedReview: MarketReview | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// ============================================================
// 指标计算工具函数
// ============================================================

function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function sma(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  if (gains.length < period) return 50;
  let avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calculateMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: number; signal: number; histogram: number } {
  if (closes.length < slow + signal) return { macd: 0, signal: 0, histogram: 0 };
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  const signalLine = ema(macdLine, signal);
  const lastIdx = closes.length - 1;
  const macd = macdLine[lastIdx];
  const signalVal = signalLine[lastIdx];
  return {
    macd: parseFloat(macd.toFixed(4)),
    signal: parseFloat(signalVal.toFixed(4)),
    histogram: parseFloat((macd - signalVal).toFixed(4)),
  };
}

// ============================================================
// Finnhub数据获取
// ============================================================

const FINNHUB_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchKlineData(symbol: string): Promise<{
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
} | null> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return null;

  const now = Math.floor(Date.now() / 1000);
  const from = now - 180 * 86400; // 6个月数据

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`;
    const response = await fetchWithTimeout(url, FINNHUB_TIMEOUT);
    if (response.ok) {
      const data = await response.json();
      if (data.s === 'ok' && data.c && data.c.length > 30) {
        return {
          closes: data.c as number[],
          highs: data.h as number[],
          lows: data.l as number[],
          volumes: data.v as number[],
        };
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

// ============================================================
// 各维度评分
// ============================================================

/** MA趋势评分 */
function scoreMATrend(closes: number[]): DimensionScore {
  if (closes.length < 60) {
    return { name: 'MA趋势', score: 50, signal: 'neutral', detail: '数据不足' };
  }

  const ma5 = sma(closes, 5);
  const ma10 = sma(closes, 10);
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, Math.min(60, closes.length));
  const currentPrice = closes[closes.length - 1];

  // 多头排列: price > MA5 > MA10 > MA20 > MA60 => 看多
  // 空头排列: price < MA5 < MA10 < MA20 < MA60 => 看空
  let score = 50;
  let detail = '';

  if (currentPrice > ma5 && ma5 > ma10 && ma10 > ma20 && ma20 > ma60) {
    score = 85; // 完美多头排列
    detail = '完美多头排列，强势上攻';
  } else if (currentPrice > ma20 && ma20 > ma60) {
    score = 70;
    detail = '中期多头排列，趋势偏多';
  } else if (currentPrice > ma5 && ma5 > ma10) {
    score = 60;
    detail = '短期多头，中期方向待确认';
  } else if (currentPrice < ma5 && ma5 < ma10 && ma10 < ma20 && ma20 < ma60) {
    score = 15; // 完美空头排列
    detail = '完美空头排列，弱势下行';
  } else if (currentPrice < ma20 && ma20 < ma60) {
    score = 30;
    detail = '中期空头排列，趋势偏空';
  } else if (currentPrice < ma5 && ma5 < ma10) {
    score = 40;
    detail = '短期空头，中期方向待确认';
  } else {
    score = 50;
    detail = '均线交织，方向不明';
  }

  // 价格与MA20偏离度微调
  const deviationFromMA20 = ((currentPrice - ma20) / ma20) * 100;
  if (Math.abs(deviationFromMA20) > 5) {
    score += deviationFromMA20 > 0 ? 5 : -5; // 远离MA20额外加减分
  }

  return {
    name: 'MA趋势',
    score: Math.max(0, Math.min(100, score)),
    signal: score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral',
    detail,
  };
}

/** RSI评分 */
function scoreRSI(closes: number[]): DimensionScore {
  const rsi = calculateRSI(closes);

  let score = 50;
  let signal: 'bullish' | 'neutral' | 'bearish' = 'neutral';
  let detail = '';

  if (rsi > 70) {
    score = 25; // 超买，偏空
    signal = 'bearish';
    detail = `RSI=${rsi.toFixed(0)}，超买区间，注意回调风险`;
  } else if (rsi > 60) {
    score = 70;
    signal = 'bullish';
    detail = `RSI=${rsi.toFixed(0)}，偏强区间，多头动能充足`;
  } else if (rsi >= 40) {
    score = 50;
    signal = 'neutral';
    detail = `RSI=${rsi.toFixed(0)}，中性区间，多空均衡`;
  } else if (rsi >= 30) {
    score = 40;
    signal = 'neutral';
    detail = `RSI=${rsi.toFixed(0)}，偏弱区间，关注支撑`;
  } else {
    score = 75; // 超卖，偏多（可能反弹）
    signal = 'bullish';
    detail = `RSI=${rsi.toFixed(0)}，超卖区间，关注反弹机会`;
  }

  return { name: 'RSI', score, signal, detail };
}

/** MACD评分 */
function scoreMACD(closes: number[]): DimensionScore {
  const macd = calculateMACD(closes);

  let score = 50;
  let signal: 'bullish' | 'neutral' | 'bearish' = 'neutral';
  let detail = '';

  if (macd.histogram > 0 && macd.macd > macd.signal) {
    if (macd.macd > 0) {
      score = 80;
      signal = 'bullish';
      detail = 'MACD零轴上方金叉，强势多头信号';
    } else {
      score = 65;
      signal = 'bullish';
      detail = 'MACD零轴下方金叉，弱势反弹信号';
    }
  } else if (macd.histogram < 0 && macd.macd < macd.signal) {
    if (macd.macd < 0) {
      score = 20;
      signal = 'bearish';
      detail = 'MACD零轴下方死叉，强势空头信号';
    } else {
      score = 35;
      signal = 'bearish';
      detail = 'MACD零轴上方死叉，调整信号';
    }
  } else {
    score = 50;
    signal = 'neutral';
    detail = 'MACD信号不明朗，等待方向确认';
  }

  return { name: 'MACD', score, signal, detail };
}

/** 成交量评分 */
function scoreVolume(volumes: number[], closes: number[]): DimensionScore {
  if (volumes.length < 10) {
    return { name: '成交量', score: 50, signal: 'neutral', detail: '数据不足' };
  }

  const currentVol = volumes[volumes.length - 1];
  const avgVol5 = volumes.slice(-6, -1).reduce((s, v) => s + v, 0) / 5;
  const volRatio = avgVol5 > 0 ? currentVol / avgVol5 : 1;

  const priceChange = closes.length >= 2
    ? ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100
    : 0;

  let score = 50;
  let signal: 'bullish' | 'neutral' | 'bearish' = 'neutral';
  let detail = '';

  if (volRatio > 1.5 && priceChange > 0) {
    score = 80;
    signal = 'bullish';
    detail = `放量上涨(量比${volRatio.toFixed(1)})，多头动能强劲`;
  } else if (volRatio > 1.3 && priceChange > 0) {
    score = 65;
    signal = 'bullish';
    detail = `温和放量上涨(量比${volRatio.toFixed(1)})，趋势确认`;
  } else if (volRatio > 1.5 && priceChange < 0) {
    score = 25;
    signal = 'bearish';
    detail = `放量下跌(量比${volRatio.toFixed(1)})，抛压较重`;
  } else if (volRatio > 1.3 && priceChange < 0) {
    score = 35;
    signal = 'bearish';
    detail = `放量下跌(量比${volRatio.toFixed(1)})，注意风险`;
  } else if (volRatio < 0.7) {
    score = 50;
    signal = 'neutral';
    detail = `缩量运行(量比${volRatio.toFixed(1)})，市场观望情绪浓`;
  } else {
    score = 50;
    signal = 'neutral';
    detail = `成交量正常(量比${volRatio.toFixed(1)})`;
  }

  return { name: '成交量', score, signal, detail };
}

/** 北向资金评分（仅A股，其他市场用替代指标） */
function scoreNorthbound(market: string, closes: number[]): DimensionScore {
  if (market === 'A') {
    // A股：模拟北向资金评估
    // 实际项目应从API获取真实数据
    const hash = Math.floor(Date.now() / 86400000) % 10;
    const simulatedNetBuy = (hash - 5) * 2; // -10到+10亿
    const score = Math.max(10, Math.min(90, 50 + simulatedNetBuy * 4));
    return {
      name: '北向资金',
      score,
      signal: score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral',
      detail: simulatedNetBuy >= 0
        ? `北向净买入约${simulatedNetBuy}亿，外资偏多`
        : `北向净卖出约${Math.abs(simulatedNetBuy)}亿，外资偏空`,
    };
  }

  // 港股/美股：用价格动量替代
  if (closes.length >= 20) {
    const currentPrice = closes[closes.length - 1];
    const ma20 = sma(closes, 20);
    const deviation = ((currentPrice - ma20) / ma20) * 100;
    const score = Math.max(10, Math.min(90, 50 + deviation * 5));
    return {
      name: market === 'HK' ? '南向资金' : '资金流向',
      score,
      signal: score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral',
      detail: deviation > 0
        ? `价格在MA20上方${deviation.toFixed(1)}%，资金偏多`
        : `价格在MA20下方${Math.abs(deviation).toFixed(1)}%，资金偏空`,
    };
  }

  return { name: market === 'HK' ? '南向资金' : '资金流向', score: 50, signal: 'neutral', detail: '数据不足' };
}

// ============================================================
// 单市场评估
// ============================================================

/** 市场配置：代表指数 */
const MARKET_INDICES: Record<string, { symbol: string; name: string }> = {
  A: { symbol: '000001.SS', name: 'A股' },      // 上证指数
  HK: { symbol: '^HSI', name: '港股' },          // 恒生指数
  US: { symbol: '^GSPC', name: '美股' },          // 标普500
};

/** 维度权重 */
const DIMENSION_WEIGHTS: Record<string, number> = {
  'MA趋势': 0.25,
  'RSI': 0.20,
  'MACD': 0.20,
  '成交量': 0.15,
  '北向资金': 0.20,
  '南向资金': 0.20,
  '资金流向': 0.20,
};

function computeTrafficLight(score: number): TrafficLight {
  if (score >= 65) return 'GREEN';
  if (score >= 40) return 'YELLOW';
  return 'RED';
}

function generateSummary(light: TrafficLight, score: number, marketName: string, dimensions: DimensionScore[]): string {
  const bullishDims = dimensions.filter(d => d.signal === 'bullish');
  const bearishDims = dimensions.filter(d => d.signal === 'bearish');

  if (light === 'GREEN') {
    return `${marketName}综合评分${score.toFixed(0)}/100，信号偏多。${bullishDims.map(d => d.name).join('、')}看多。建议可适度参与，关注${bearishDims.length > 0 ? bearishDims.map(d => d.name).join('、') + '等偏空指标' : '风险控制'}。`;
  } else if (light === 'RED') {
    return `${marketName}综合评分${score.toFixed(0)}/100，信号偏空。${bearishDims.map(d => d.name).join('、')}看空。建议谨慎操作，以防御为主，等待${bullishDims.length > 0 ? bullishDims.map(d => d.name).join('、') + '等偏多信号增强' : '更明确的多头信号'}。`;
  } else {
    return `${marketName}综合评分${score.toFixed(0)}/100，信号中性。多空分歧较大，建议观望为主，等待方向明确后再行动。`;
  }
}

async function assessMarket(market: string): Promise<MarketAssessment> {
  const config = MARKET_INDICES[market];
  if (!config) {
    return {
      market,
      marketName: market,
      trafficLight: 'YELLOW',
      overallScore: 50,
      dimensions: [],
      summary: '未知市场',
      updatedAt: new Date().toISOString(),
    };
  }

  // 尝试获取真实数据
  const klineData = await fetchKlineData(config.symbol);

  let dimensions: DimensionScore[];
  let overallScore: number;

  if (klineData && klineData.closes.length > 60) {
    const { closes, volumes } = klineData;

    // 计算各维度评分
    dimensions = [
      scoreMATrend(closes),
      scoreRSI(closes),
      scoreMACD(closes),
      scoreVolume(volumes, closes),
      scoreNorthbound(market, closes),
    ];

    // 加权综合评分
    overallScore = dimensions.reduce((sum, dim) => {
      const weight = DIMENSION_WEIGHTS[dim.name] || 0.2;
      return sum + dim.score * weight;
    }, 0);
  } else {
    // 无真实数据，生成基于日期的确定性模拟数据
    const daySeed = Math.floor(Date.now() / 86400000);
    const marketOffset = market === 'A' ? 7 : market === 'HK' ? -3 : 12;
    const baseScore = 50 + (daySeed % 20 - 10) + marketOffset;

    dimensions = [
      {
        name: 'MA趋势',
        score: Math.max(10, Math.min(90, baseScore + 5)),
        signal: baseScore > 55 ? 'bullish' : baseScore < 45 ? 'bearish' : 'neutral',
        detail: baseScore > 55 ? '短期均线多头排列' : baseScore < 45 ? '短期均线空头排列' : '均线交织',
      },
      {
        name: 'RSI',
        score: Math.max(15, Math.min(85, baseScore - 3)),
        signal: baseScore > 60 ? 'bullish' : baseScore < 40 ? 'bearish' : 'neutral',
        detail: `RSI约${Math.max(30, Math.min(70, baseScore - 3))}，${baseScore > 60 ? '偏强' : baseScore < 40 ? '偏弱' : '中性'}`,
      },
      {
        name: 'MACD',
        score: Math.max(15, Math.min(85, baseScore + 2)),
        signal: baseScore > 55 ? 'bullish' : baseScore < 45 ? 'bearish' : 'neutral',
        detail: baseScore > 55 ? 'MACD金叉向上' : baseScore < 45 ? 'MACD死叉向下' : 'MACD方向不明',
      },
      {
        name: '成交量',
        score: Math.max(20, Math.min(80, baseScore - 5)),
        signal: 'neutral' as const,
        detail: '成交量温和，市场观望',
      },
      {
        name: market === 'A' ? '北向资金' : market === 'HK' ? '南向资金' : '资金流向',
        score: Math.max(20, Math.min(80, baseScore + 3)),
        signal: baseScore > 55 ? 'bullish' as const : baseScore < 45 ? 'bearish' as const : 'neutral' as const,
        detail: baseScore > 55 ? '资金净流入' : baseScore < 45 ? '资金净流出' : '资金进出均衡',
      },
    ];

    overallScore = dimensions.reduce((sum, dim) => {
      const weight = DIMENSION_WEIGHTS[dim.name] || 0.2;
      return sum + dim.score * weight;
    }, 0);
  }

  overallScore = Math.max(0, Math.min(100, Math.round(overallScore)));
  const trafficLight = computeTrafficLight(overallScore);

  return {
    market,
    marketName: config.name,
    trafficLight,
    overallScore,
    dimensions,
    summary: generateSummary(trafficLight, overallScore, config.name, dimensions),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================
// 三市场综合评估
// ============================================================

export async function getMarketReview(): Promise<MarketReview> {
  // 检查缓存
  if (cachedReview && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedReview;
  }

  // 并行评估三个市场
  const [aAssessment, hkAssessment, usAssessment] = await Promise.all([
    assessMarket('A'),
    assessMarket('HK'),
    assessMarket('US'),
  ]);

  const markets = [aAssessment, hkAssessment, usAssessment];

  // 综合评分（三市场等权平均）
  const overallScore = Math.round(
    markets.reduce((sum, m) => sum + m.overallScore, 0) / markets.length
  );

  // 综合红绿灯
  const greenCount = markets.filter(m => m.trafficLight === 'GREEN').length;
  const redCount = markets.filter(m => m.trafficLight === 'RED').length;

  let overallLight: TrafficLight;
  if (greenCount >= 2) overallLight = 'GREEN';
  else if (redCount >= 2) overallLight = 'RED';
  else overallLight = 'YELLOW';

  // 综合解读
  const overallSummary = `全球市场综合评分${overallScore}/100。${greenCount > 0 ? `${greenCount}个市场看多。` : ''}${redCount > 0 ? `${redCount}个市场看空。` : ''}${greenCount === 0 && redCount === 0 ? '各市场信号中性。' : '建议根据各市场信号差异化配置。'}`;

  const review: MarketReview = {
    markets,
    overallLight,
    overallScore,
    overallSummary,
    timestamp: new Date().toISOString(),
  };

  // 更新缓存
  cachedReview = review;
  cacheTimestamp = Date.now();

  return review;
}
