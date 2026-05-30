import { NextRequest, NextResponse } from 'next/server';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
import { db } from '@/lib/db';

const FINNHUB_TIMEOUT = 8000;

// ===================== 类型定义 =====================

interface BacktestConfig {
  strategy: string;
  symbol?: string;
  initialCapital: number;
  positionSizePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  cycleDays: number;
  startDate: string;
  endDate: string;
}

interface TradeRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
}

interface BacktestResult {
  totalReturn: number;
  totalReturnPct: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  equityCurve: { date: string; equity: number }[];
  trades: TradeRecord[];
  /** 数据来源: 'finnhub'=真实数据, 'simulated'=模拟数据 */
  dataSource: 'finnhub' | 'simulated';
}

/** K线原始数据 */
interface CandleData {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
  timestamps: number[];
}

// ===================== 工具函数 =====================

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/** 从Finnhub获取历史K线数据 */
async function fetchHistoricalData(symbol: string, startDate: string, endDate: string): Promise<CandleData | null> {
  const finnhubApiKey = await getFinnhubApiKey();
  if (!finnhubApiKey) return null;

  // 将起止日期向前扩展120个交易日，确保长周期指标（如MA60）有足够预热数据
  const extendedFrom = new Date(startDate);
  extendedFrom.setDate(extendedFrom.getDate() - 200);
  const from = Math.floor(extendedFrom.getTime() / 1000);
  const to = Math.floor(new Date(endDate).getTime() / 1000);

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol || 'AAPL')}&resolution=D&from=${from}&to=${to}&token=${finnhubApiKey}`;
    const response = await fetchWithTimeout(url, FINNHUB_TIMEOUT);

    if (response.ok) {
      const data = await response.json();
      if (data.s === 'ok' && data.c && data.c.length > 0) {
        return {
          closes: data.c as number[],
          highs: data.h as number[],
          lows: data.l as number[],
          opens: data.o as number[],
          volumes: data.v as number[],
          timestamps: data.t as number[],
        };
      }
    }
  } catch {
    // Finnhub请求失败
  }
  return null;
}

// ===================== 技术指标计算（数组版本） =====================

/** 简单移动平均线（返回与输入等长的数组，前period-1个位置为NaN） */
function smaArray(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

/** 指数移动平均线（返回与输入等长的数组） */
function emaArray(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** RSI数组（返回与输入等长的数组） */
function rsiArray(closes: number[], period: number = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  // 计算价格变动
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // 初始平均涨跌幅
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // 第一个RSI值
  const firstIdx = period; // 对应closes中的索引
  if (avgLoss === 0) {
    result[firstIdx] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[firstIdx] = 100 - 100 / (1 + rs);
  }

  // 逐步计算后续RSI
  for (let i = firstIdx + 1; i < closes.length; i++) {
    const change = changes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

/** MACD数组（返回macdLine, signalLine, histogram数组） */
function macdArrays(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const emaFast = emaArray(closes, fast);
  const emaSlow = emaArray(closes, slow);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  const signalLine = emaArray(macdLine, signal);
  const histogram: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }

  return { macdLine, signalLine, histogram };
}

/** 布林带数组（返回upper, middle, lower数组） */
function bollingerArrays(
  closes: number[],
  period: number = 20,
  numStd: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = smaArray(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const avg = middle[i];
      const variance = slice.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(avg + numStd * stdDev);
      lower.push(avg - numStd * stdDev);
    }
  }

  return { upper, middle, lower };
}

/** KDJ数组（返回k, d, j数组） */
function kdjArrays(
  highs: number[],
  lows: number[],
  closes: number[],
  n: number = 9,
  m1: number = 3,
  m2: number = 3
): { k: number[]; d: number[]; j: number[] } {
  const kArr: number[] = new Array(closes.length).fill(NaN);
  const dArr: number[] = new Array(closes.length).fill(NaN);
  const jArr: number[] = new Array(closes.length).fill(NaN);

  if (closes.length < n) return { k: kArr, d: dArr, j: jArr };

  let prevK = 50;
  let prevD = 50;

  for (let i = n - 1; i < closes.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - n + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }

    const rsv = highestHigh !== lowestLow
      ? ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
      : 50;

    const k = (2 / m1) * prevK + (1 / m1) * rsv;
    const d = (2 / m2) * prevD + (1 / m2) * k;
    const j = 3 * k - 2 * d;

    kArr[i] = k;
    dArr[i] = d;
    jArr[i] = j;

    prevK = k;
    prevD = d;
  }

  return { k: kArr, d: dArr, j: jArr };
}

/** 成交量均线数组 */
function volumeSmaArray(volumes: number[], period: number = 20): number[] {
  return smaArray(volumes, period);
}

/** 通道突破：基于N日最高价/最低价通道 */
function channelArrays(
  highs: number[],
  lows: number[],
  period: number = 20
): { upper: number[]; lower: number[] } {
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      let maxH = -Infinity;
      let minL = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (highs[j] > maxH) maxH = highs[j];
        if (lows[j] < minL) minL = lows[j];
      }
      upper.push(maxH);
      lower.push(minL);
    }
  }

  return { upper, lower };
}

/** ATR数组（Average True Range） */
function atrArray(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < 2) return result;

  const trueRanges: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
  }

  // First ATR value: simple average of first `period` TRs
  if (trueRanges.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  result[period - 1] = sum / period;

  // Subsequent ATR values: smoothed average
  for (let i = period; i < closes.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + trueRanges[i]) / period;
  }

  return result;
}

/** SAR Parabolic数组 */
function sarArray(
  highs: number[],
  lows: number[],
  closes: number[],
  afStep: number = 0.02,
  afMax: number = 0.2
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < 2) return result;

  let isUpTrend = closes[1] > closes[0];
  let sar = isUpTrend ? lows[0] : highs[0];
  let ep = isUpTrend ? highs[0] : lows[0];
  let af = afStep;

  result[0] = sar;

  for (let i = 1; i < closes.length; i++) {
    // Update SAR
    sar = sar + af * (ep - sar);

    if (isUpTrend) {
      // SAR should not be higher than the previous two lows
      if (i >= 2) {
        sar = Math.min(sar, lows[i - 1], lows[i - 2]);
      } else {
        sar = Math.min(sar, lows[i - 1]);
      }

      if (lows[i] < sar) {
        // Trend reversal: switch to downtrend
        isUpTrend = false;
        sar = ep; // Previous extreme point
        ep = lows[i];
        af = afStep;
      } else {
        // Update extreme point and acceleration factor
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + afStep, afMax);
        }
      }
    } else {
      // SAR should not be lower than the previous two highs
      if (i >= 2) {
        sar = Math.max(sar, highs[i - 1], highs[i - 2]);
      } else {
        sar = Math.max(sar, highs[i - 1]);
      }

      if (highs[i] > sar) {
        // Trend reversal: switch to uptrend
        isUpTrend = true;
        sar = ep;
        ep = highs[i];
        af = afStep;
      } else {
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + afStep, afMax);
        }
      }
    }

    result[i] = sar;
  }

  return result;
}

/** Supertrend数组（返回supertrend值和方向：1=上涨, -1=下跌） */
function supertrendArrays(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3
): { supertrend: number[]; direction: number[] } {
  const atr = atrArray(highs, lows, closes, period);
  const supertrend: number[] = new Array(closes.length).fill(NaN);
  const direction: number[] = new Array(closes.length).fill(0);

  if (closes.length < period) return { supertrend, direction };

  // Calculate basic bands
  const upperBand: number[] = new Array(closes.length).fill(NaN);
  const lowerBand: number[] = new Array(closes.length).fill(NaN);

  for (let i = 0; i < closes.length; i++) {
    if (isNaN(atr[i])) continue;
    const hl2 = (highs[i] + lows[i]) / 2;
    upperBand[i] = hl2 + multiplier * atr[i];
    lowerBand[i] = hl2 - multiplier * atr[i];
  }

  // Initialize first valid value
  let prevUpper = upperBand[period - 1];
  let prevLower = lowerBand[period - 1];
  let prevSuper = upperBand[period - 1];
  let prevDir = 1; // start as downtrend

  if (!isNaN(prevSuper)) {
    supertrend[period - 1] = prevSuper;
    direction[period - 1] = prevDir;
  }

  for (let i = period; i < closes.length; i++) {
    if (isNaN(atr[i])) continue;

    // Lower band: can only move up
    const currLower = lowerBand[i];
    const finalLower = (currLower > prevLower || closes[i - 1] < prevLower)
      ? currLower
      : prevLower;

    // Upper band: can only move down
    const currUpper = upperBand[i];
    const finalUpper = (currUpper < prevUpper || closes[i - 1] > prevUpper)
      ? currUpper
      : prevUpper;

    let currDir: number;
    let currSuper: number;

    if (prevDir === 1) {
      // Was in downtrend
      if (closes[i] > prevUpper) {
        currDir = -1; // switch to uptrend
        currSuper = finalLower;
      } else {
        currDir = 1;
        currSuper = finalUpper;
      }
    } else {
      // Was in uptrend
      if (closes[i] < prevLower) {
        currDir = 1; // switch to downtrend
        currSuper = finalUpper;
      } else {
        currDir = -1;
        currSuper = finalLower;
      }
    }

    supertrend[i] = currSuper;
    direction[i] = currDir;
    prevUpper = finalUpper;
    prevLower = finalLower;
    prevSuper = currSuper;
    prevDir = currDir;
  }

  return { supertrend, direction };
}

/** CCI数组（Commodity Channel Index） */
function cciArray(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return result;

  const tp: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  for (let i = period - 1; i < closes.length; i++) {
    let sumTp = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumTp += tp[j];
    }
    const meanTp = sumTp / period;

    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) {
      meanDev += Math.abs(tp[j] - meanTp);
    }
    meanDev /= period;

    result[i] = meanDev > 0 ? (tp[i] - meanTp) / (0.015 * meanDev) : 0;
  }

  return result;
}

/** Williams %R数组 */
function williamsRArray(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return result;

  for (let i = period - 1; i < closes.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    result[i] = range > 0 ? ((highestHigh - closes[i]) / range) * -100 : -50;
  }

  return result;
}

/** OBV数组（On-Balance Volume） */
function obvArray(closes: number[], volumes: number[]): number[] {
  if (closes.length === 0) return [];
  const result: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      result.push(result[i - 1] + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      result.push(result[i - 1] - volumes[i]);
    } else {
      result.push(result[i - 1]);
    }
  }
  return result;
}

/** MFI数组（Money Flow Index） */
function mfiArray(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  const typicalPrice: number[] = [];
  const moneyFlow: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    typicalPrice.push(tp);
    moneyFlow.push(tp * volumes[i]);
  }

  for (let i = period; i < closes.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrice[j] > typicalPrice[j - 1]) {
        positiveFlow += moneyFlow[j];
      } else if (typicalPrice[j] < typicalPrice[j - 1]) {
        negativeFlow += moneyFlow[j];
      }
    }
    const mfRatio = negativeFlow > 0 ? positiveFlow / negativeFlow : 1;
    result[i] = 100 - 100 / (1 + mfRatio);
  }

  return result;
}

/** ADX数组（Average Directional Index）返回 adx, plusDI, minusDI */
function adxArrays(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { adx: number[]; plusDI: number[]; minusDI: number[] } {
  const len = closes.length;
  const adx: number[] = new Array(len).fill(NaN);
  const plusDI: number[] = new Array(len).fill(NaN);
  const minusDI: number[] = new Array(len).fill(NaN);

  if (len < 2) return { adx, plusDI, minusDI };

  // Calculate +DM, -DM, and TR
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const trArr: number[] = [highs[0] - lows[0]];

  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    trArr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  // Smooth using Wilder's method
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;
  let smoothTR = 0;

  for (let i = 0; i < period && i < len; i++) {
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
    smoothTR += trArr[i];
  }

  if (smoothTR === 0) return { adx, plusDI, minusDI };

  const firstIdx = period - 1;
  plusDI[firstIdx] = (smoothPlusDM / smoothTR) * 100;
  minusDI[firstIdx] = (smoothMinusDM / smoothTR) * 100;

  const dx: number[] = new Array(len).fill(NaN);
  const sumDI = plusDI[firstIdx] + minusDI[firstIdx];
  dx[firstIdx] = sumDI > 0 ? (Math.abs(plusDI[firstIdx] - minusDI[firstIdx]) / sumDI) * 100 : 0;

  for (let i = period; i < len; i++) {
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    smoothTR = smoothTR - smoothTR / period + trArr[i];

    if (smoothTR > 0) {
      plusDI[i] = (smoothPlusDM / smoothTR) * 100;
      minusDI[i] = (smoothMinusDM / smoothTR) * 100;
    }

    const sumDI2 = plusDI[i] + minusDI[i];
    dx[i] = sumDI2 > 0 ? (Math.abs(plusDI[i] - minusDI[i]) / sumDI2) * 100 : 0;
  }

  // Smooth DX to get ADX
  let adxVal = 0;
  for (let i = firstIdx; i < firstIdx + period && i < len; i++) {
    adxVal += dx[i] || 0;
  }
  adxVal /= period;
  adx[firstIdx + period - 1] = adxVal;

  for (let i = firstIdx + period; i < len; i++) {
    adxVal = (adxVal * (period - 1) + (dx[i] || 0)) / period;
    adx[i] = adxVal;
  }

  return { adx, plusDI, minusDI };
}

/** Ichimoku Cloud数组（返回tenkan, kijun, spanA, spanB） */
function ichimokuArrays(
  highs: number[],
  lows: number[],
  closes: number[],
  conversionPeriod: number = 9,
  basePeriod: number = 26,
  spanBPeriod: number = 52
): { tenkan: number[]; kijun: number[]; spanA: number[]; spanB: number[] } {
  const len = closes.length;
  const tenkan: number[] = new Array(len).fill(NaN);
  const kijun: number[] = new Array(len).fill(NaN);
  const spanA: number[] = new Array(len).fill(NaN);
  const spanB: number[] = new Array(len).fill(NaN);

  function periodHighLow(start: number, end: number): { high: number; low: number } {
    let h = -Infinity;
    let l = Infinity;
    for (let j = start; j <= end; j++) {
      if (highs[j] > h) h = highs[j];
      if (lows[j] < l) l = lows[j];
    }
    return { high: h, low: l };
  }

  for (let i = 0; i < len; i++) {
    if (i >= conversionPeriod - 1) {
      const { high, low } = periodHighLow(i - conversionPeriod + 1, i);
      tenkan[i] = (high + low) / 2;
    }
    if (i >= basePeriod - 1) {
      const { high, low } = periodHighLow(i - basePeriod + 1, i);
      kijun[i] = (high + low) / 2;
    }
    if (!isNaN(tenkan[i]) && !isNaN(kijun[i])) {
      spanA[i] = (tenkan[i] + kijun[i]) / 2;
    }
    if (i >= spanBPeriod - 1) {
      const { high, low } = periodHighLow(i - spanBPeriod + 1, i);
      spanB[i] = (high + low) / 2;
    }
  }

  return { tenkan, kijun, spanA, spanB };
}

/** Stochastic Oscillator数组（返回%K和%D） */
function stochasticArrays(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  kSmooth: number = 3,
  dSmooth: number = 3
): { k: number[]; d: number[] } {
  const len = closes.length;
  const rawK: number[] = new Array(len).fill(NaN);
  const kArr: number[] = new Array(len).fill(NaN);
  const dArr: number[] = new Array(len).fill(NaN);

  if (len < kPeriod) return { k: kArr, d: dArr };

  // Raw %K
  for (let i = kPeriod - 1; i < len; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    rawK[i] = range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
  }

  // Smoothed %K (SMA of raw %K)
  for (let i = kPeriod - 1 + kSmooth - 1; i < len; i++) {
    let sum = 0;
    for (let j = i - kSmooth + 1; j <= i; j++) {
      sum += rawK[j];
    }
    kArr[i] = sum / kSmooth;
  }

  // %D (SMA of %K)
  const dStart = kPeriod - 1 + kSmooth - 1 + dSmooth - 1;
  for (let i = dStart; i < len; i++) {
    let sum = 0;
    for (let j = i - dSmooth + 1; j <= i; j++) {
      sum += kArr[j];
    }
    dArr[i] = sum / dSmooth;
  }

  return { k: kArr, d: dArr };
}

// ===================== 策略信号生成器 =====================

type SignalType = 'BUY' | 'SELL' | 'NONE';

interface StrategySignal {
  signal: SignalType;
  reason: string;
}

/**
 * 判断金叉：前一日短均线<=长均线，当日短均线>长均线
 * 判断死叉：前一日短均线>=长均线，当日短均线<长均线
 */
function maGoldenCrossSignal(
  i: number,
  shortMA: number[],
  longMA: number[]
): StrategySignal {
  if (i < 1 || isNaN(shortMA[i]) || isNaN(longMA[i]) || isNaN(shortMA[i - 1]) || isNaN(longMA[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // 金叉：短均线从下方穿越长均线
  if (shortMA[i - 1] <= longMA[i - 1] && shortMA[i] > longMA[i]) {
    return { signal: 'BUY', reason: 'MA5上穿MA20金叉' };
  }
  // 死叉：短均线从上方穿越长均线
  if (shortMA[i - 1] >= longMA[i - 1] && shortMA[i] < longMA[i]) {
    return { signal: 'SELL', reason: 'MA5下穿MA20死叉' };
  }

  return { signal: 'NONE', reason: '' };
}

/** MACD信号：金叉买入，死叉卖出 */
function macdSignal(
  i: number,
  macdLine: number[],
  signalLine: number[]
): StrategySignal {
  if (i < 1 || isNaN(macdLine[i]) || isNaN(signalLine[i]) || isNaN(macdLine[i - 1]) || isNaN(signalLine[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // MACD金叉：MACD线从下方穿越信号线
  if (macdLine[i - 1] <= signalLine[i - 1] && macdLine[i] > signalLine[i]) {
    return { signal: 'BUY', reason: 'MACD金叉' };
  }
  // MACD死叉：MACD线从上方穿越信号线
  if (macdLine[i - 1] >= signalLine[i - 1] && macdLine[i] < signalLine[i]) {
    return { signal: 'SELL', reason: 'MACD死叉' };
  }

  return { signal: 'NONE', reason: '' };
}

/** RSI背离信号：RSI<30买入（超卖），RSI>70卖出（超买） */
function rsiSignal(
  i: number,
  rsi: number[]
): StrategySignal {
  if (isNaN(rsi[i])) {
    return { signal: 'NONE', reason: '' };
  }

  if (rsi[i] < 30) {
    return { signal: 'BUY', reason: `RSI超卖(${rsi[i].toFixed(1)})` };
  }
  if (rsi[i] > 70) {
    return { signal: 'SELL', reason: `RSI超买(${rsi[i].toFixed(1)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 布林带突破：突破下轨买入，突破上轨卖出 */
function bollingerSignal(
  i: number,
  closes: number[],
  upper: number[],
  lower: number[]
): StrategySignal {
  if (isNaN(upper[i]) || isNaN(lower[i])) {
    return { signal: 'NONE', reason: '' };
  }

  // 价格突破下轨：超卖，买入信号
  if (closes[i] < lower[i]) {
    return { signal: 'BUY', reason: '价格突破布林带下轨' };
  }
  // 价格突破上轨：超买，卖出信号
  if (closes[i] > upper[i]) {
    return { signal: 'SELL', reason: '价格突破布林带上轨' };
  }

  return { signal: 'NONE', reason: '' };
}

/** KDJ金叉信号：K线上穿D线买入，下穿卖出 */
function kdjSignal(
  i: number,
  k: number[],
  d: number[]
): StrategySignal {
  if (i < 1 || isNaN(k[i]) || isNaN(d[i]) || isNaN(k[i - 1]) || isNaN(d[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // KDJ金叉
  if (k[i - 1] <= d[i - 1] && k[i] > d[i]) {
    return { signal: 'BUY', reason: 'KDJ金叉' };
  }
  // KDJ死叉
  if (k[i - 1] >= d[i - 1] && k[i] < d[i]) {
    return { signal: 'SELL', reason: 'KDJ死叉' };
  }

  return { signal: 'NONE', reason: '' };
}

/** 量价突破：放量上涨买入，放量下跌卖出 */
function volumeBreakoutSignal(
  i: number,
  closes: number[],
  volumes: number[],
  volSma: number[]
): StrategySignal {
  if (i < 1 || isNaN(volSma[i])) {
    return { signal: 'NONE', reason: '' };
  }

  const priceChange = closes[i] - closes[i - 1];
  const volumeRatio = volumes[i] / volSma[i];

  // 放量上涨：成交量大于均值1.5倍且价格上涨
  if (volumeRatio > 1.5 && priceChange > 0) {
    return { signal: 'BUY', reason: `放量上涨(量比${volumeRatio.toFixed(2)})` };
  }
  // 放量下跌：成交量大于均值1.5倍且价格下跌
  if (volumeRatio > 1.5 && priceChange < 0) {
    return { signal: 'SELL', reason: `放量下跌(量比${volumeRatio.toFixed(2)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 通道突破：突破N日最高价买入，跌破N日最低价卖出 */
function channelBreakoutSignal(
  i: number,
  closes: number[],
  highs: number[],
  lows: number[],
  chUpper: number[],
  chLower: number[]
): StrategySignal {
  if (i < 1 || isNaN(chUpper[i]) || isNaN(chLower[i])) {
    return { signal: 'NONE', reason: '' };
  }

  // 收盘价突破通道上轨（前一日N日最高价）
  if (closes[i] > chUpper[i - 1] && !isNaN(chUpper[i - 1])) {
    return { signal: 'BUY', reason: '突破通道上轨' };
  }
  // 收盘价跌破通道下轨（前一日N日最低价）
  if (closes[i] < chLower[i - 1] && !isNaN(chLower[i - 1])) {
    return { signal: 'SELL', reason: '跌破通道下轨' };
  }

  return { signal: 'NONE', reason: '' };
}

// ===================== 逐日模拟引擎 =====================

/** 持仓信息 */
interface Position {
  entryPrice: number;
  entryDate: string;
  quantity: number;
  entryIdx: number;
  reason: string;
}

/**
 * 根据策略名称获取信号
 */
/** 自定义策略组合信号：综合多个指标，当2+个指标同意时产生信号 */
function customCombinedSignal(
  i: number,
  data: CandleData,
  indicators: BacktestIndicators
): StrategySignal {
  const signals: StrategySignal[] = [
    maGoldenCrossSignal(i, indicators.ma5, indicators.ma20),
    macdSignal(i, indicators.macdLine, indicators.signalLine),
    rsiSignal(i, indicators.rsi),
    bollingerSignal(i, data.closes, indicators.bollUpper, indicators.bollLower),
    kdjSignal(i, indicators.kdjK, indicators.kdjD),
  ];

  const buyReasons: string[] = [];
  const sellReasons: string[] = [];

  for (const sig of signals) {
    if (sig.signal === 'BUY' && sig.reason) buyReasons.push(sig.reason);
    if (sig.signal === 'SELL' && sig.reason) sellReasons.push(sig.reason);
  }

  // 当2+个指标同意买入时产生买入信号
  if (buyReasons.length >= 2) {
    return { signal: 'BUY', reason: `组合买入(${buyReasons.join('+')})` };
  }
  // 当2+个指标同意卖出时产生卖出信号
  if (sellReasons.length >= 2) {
    return { signal: 'SELL', reason: `组合卖出(${sellReasons.join('+')})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 缩量回踩信号：收盘价>MA20，量比<0.7，回踩幅度小 */
function shrinkPullbackSignal(
  i: number,
  closes: number[],
  volumes: number[],
  volSma: number[],
  ma20: number[]
): StrategySignal {
  if (isNaN(ma20[i]) || isNaN(volSma[i]) || i < 20) {
    return { signal: 'NONE', reason: '' };
  }

  const closeAboveMA20 = closes[i] > ma20[i];
  const volumeRatio = volumes[i] / volSma[i];
  const lowVolume = volumeRatio < 0.7;

  // 回踩幅度：相对近20日最高价的回撤
  const recentHigh = Math.max(...closes.slice(Math.max(0, i - 19), i + 1));
  const pullbackPct = recentHigh > 0 ? ((recentHigh - closes[i]) / recentHigh) * 100 : 0;
  const smallPullback = pullbackPct < 7;

  if (closeAboveMA20 && lowVolume && smallPullback) {
    return { signal: 'BUY', reason: `缩量回踩(量比${volumeRatio.toFixed(2)}, 回踩${pullbackPct.toFixed(1)}%)` };
  }
  // 退出条件：收盘价>MA5或量比>1.5
  if (closeAboveMA20 && volumeRatio > 1.5) {
    return { signal: 'SELL', reason: `放量反弹(量比${volumeRatio.toFixed(2)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 波浪理论信号（简化版）：收盘>MA20, MA5>MA10, MACD>0 → 买入 */
function waveTheorySignal(
  i: number,
  closes: number[],
  ma5: number[],
  ma20: number[],
  macdLine: number[],
  rsi: number[]
): StrategySignal {
  if (isNaN(ma20[i]) || isNaN(ma5[i]) || isNaN(macdLine[i]) || isNaN(rsi[i])) {
    return { signal: 'NONE', reason: '' };
  }

  const ma5Arr = ma5;
  const ma10 = smaArray(closes, 10);
  if (isNaN(ma10[i])) return { signal: 'NONE', reason: '' };

  // 买入：收盘>MA20, MA5>MA10, MACD>0
  if (closes[i] > ma20[i] && ma5Arr[i] > ma10[i] && macdLine[i] > 0) {
    return { signal: 'BUY', reason: '波浪理论买入(趋势向上+动量确认)' };
  }
  // 卖出：RSI>70 或 MA5下穿MA10
  if (rsi[i] > 70) {
    return { signal: 'SELL', reason: `波浪理论卖出(RSI超买${rsi[i].toFixed(1)})` };
  }
  if (i > 0 && !isNaN(ma5Arr[i - 1]) && !isNaN(ma10[i - 1]) && ma5Arr[i - 1] >= ma10[i - 1] && ma5Arr[i] < ma10[i]) {
    return { signal: 'SELL', reason: '波浪理论卖出(MA5下穿MA10)' };
  }

  return { signal: 'NONE', reason: '' };
}

/** 箱体震荡信号：价格位置<0.2且RSI<35买入，价格位置>0.8且RSI>65卖出 */
function boxOscillationSignal(
  i: number,
  closes: number[],
  bollUpper: number[],
  bollLower: number[],
  rsi: number[]
): StrategySignal {
  if (isNaN(bollUpper[i]) || isNaN(bollLower[i]) || isNaN(rsi[i])) {
    return { signal: 'NONE', reason: '' };
  }

  const bandwidth = bollUpper[i] - bollLower[i];
  const pricePosition = bandwidth > 0 ? (closes[i] - bollLower[i]) / bandwidth : 0.5;

  if (pricePosition < 0.2 && rsi[i] < 35) {
    return { signal: 'BUY', reason: `箱体底部买入(位置${(pricePosition * 100).toFixed(0)}%, RSI${rsi[i].toFixed(1)})` };
  }
  if (pricePosition > 0.8 && rsi[i] > 65) {
    return { signal: 'SELL', reason: `箱体顶部卖出(位置${(pricePosition * 100).toFixed(0)}%, RSI${rsi[i].toFixed(1)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 事件驱动信号（简化版）：量比>3.0且价格变化>2% */
function eventDrivenSignal(
  i: number,
  closes: number[],
  volumes: number[],
  volSma: number[],
  ma5: number[]
): StrategySignal {
  if (isNaN(volSma[i]) || isNaN(ma5[i]) || i < 1) {
    return { signal: 'NONE', reason: '' };
  }

  const volumeRatio = volumes[i] / volSma[i];
  const priceChangePct = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100;

  // 异常放量+价格上涨
  if (volumeRatio > 3.0 && priceChangePct > 2) {
    return { signal: 'BUY', reason: `事件驱动买入(量比${volumeRatio.toFixed(1)}, 涨${priceChangePct.toFixed(1)}%)` };
  }
  // 异常放量+价格下跌
  if (volumeRatio > 3.0 && priceChangePct < -2) {
    return { signal: 'SELL', reason: `事件驱动卖出(量比${volumeRatio.toFixed(1)}, 跌${Math.abs(priceChangePct).toFixed(1)}%)` };
  }
  // 退出：量比<1.0 或 收盘价<MA5
  if (volumeRatio < 1.0 && closes[i] < ma5[i]) {
    return { signal: 'SELL', reason: '事件驱动退出(缩量跌破MA5)' };
  }

  return { signal: 'NONE', reason: '' };
}

/** SAR Parabolic信号：价格上穿SAR买入，下穿SAR卖出 */
function sarParabolicSignal(
  i: number,
  closes: number[],
  sar: number[]
): StrategySignal {
  if (i < 1 || isNaN(sar[i]) || isNaN(sar[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // 价格从SAR下方穿越到上方（SAR翻转）
  if (closes[i - 1] < sar[i - 1] && closes[i] > sar[i]) {
    return { signal: 'BUY', reason: 'SAR翻转为上升趋势' };
  }
  // 价格从SAR上方穿越到下方（SAR翻转）
  if (closes[i - 1] > sar[i - 1] && closes[i] < sar[i]) {
    return { signal: 'SELL', reason: 'SAR翻转为下降趋势' };
  }

  return { signal: 'NONE', reason: '' };
}

/** Supertrend信号：价格上穿Supertrend买入，下穿卖出 */
function supertrendSignal(
  i: number,
  closes: number[],
  supertrend: number[],
  direction: number[]
): StrategySignal {
  if (i < 1 || isNaN(supertrend[i]) || isNaN(supertrend[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // Direction changes from downtrend (1) to uptrend (-1)
  if (direction[i - 1] === 1 && direction[i] === -1) {
    return { signal: 'BUY', reason: 'Supertrend翻绿(上升趋势)' };
  }
  // Direction changes from uptrend (-1) to downtrend (1)
  if (direction[i - 1] === -1 && direction[i] === 1) {
    return { signal: 'SELL', reason: 'Supertrend翻红(下降趋势)' };
  }

  return { signal: 'NONE', reason: '' };
}

/** CCI背离信号：简化版 - CCI从超卖区回升买入，从超买区回落卖出 */
function cciDivergenceSignal(
  i: number,
  closes: number[],
  cci: number[]
): StrategySignal {
  if (i < 1 || isNaN(cci[i]) || isNaN(cci[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // CCI底背离简化：CCI从超卖区(-100以下)回升
  if (cci[i - 1] < -100 && cci[i] > -100 && closes[i] < closes[i - 1]) {
    return { signal: 'BUY', reason: `CCI底背离(CCI${cci[i].toFixed(0)})` };
  }
  // CCI超卖后回升
  if (cci[i - 1] < -100 && cci[i] >= -100 && cci[i] > cci[i - 1]) {
    return { signal: 'BUY', reason: `CCI超卖回升(${cci[i].toFixed(0)})` };
  }
  // CCI顶背离简化：CCI从超买区(100以上)回落，且价格创新高
  if (cci[i - 1] > 100 && cci[i] < 100 && closes[i] > closes[i - 1]) {
    return { signal: 'SELL', reason: `CCI顶背离(CCI${cci[i].toFixed(0)})` };
  }
  // CCI超买后回落
  if (cci[i - 1] > 100 && cci[i] <= 100 && cci[i] < cci[i - 1]) {
    return { signal: 'SELL', reason: `CCI超买回落(${cci[i].toFixed(0)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** Williams %R信号：超卖区回升买入，超买区回落卖出 */
function williamsRSignal(
  i: number,
  williamsR: number[]
): StrategySignal {
  if (i < 1 || isNaN(williamsR[i]) || isNaN(williamsR[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // Williams %R从超卖区(-80以下)回升
  if (williamsR[i - 1] < -80 && williamsR[i] >= -80) {
    return { signal: 'BUY', reason: `Williams %R超卖回升(${williamsR[i].toFixed(1)})` };
  }
  // Williams %R从超买区(-20以上)回落
  if (williamsR[i - 1] > -20 && williamsR[i] <= -20) {
    return { signal: 'SELL', reason: `Williams %R超买回落(${williamsR[i].toFixed(1)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** OBV突破信号：OBV突破N日高点买入，跌破N日低点卖出 */
function obvBreakoutSignal(
  i: number,
  closes: number[],
  obv: number[],
  period: number = 20
): StrategySignal {
  if (i < period || isNaN(obv[i])) {
    return { signal: 'NONE', reason: '' };
  }

  // Check if OBV breaks period-high
  let obvHigh = -Infinity;
  let obvLow = Infinity;
  for (let j = i - period; j < i; j++) {
    if (obv[j] > obvHigh) obvHigh = obv[j];
    if (obv[j] < obvLow) obvLow = obv[j];
  }

  if (obv[i] > obvHigh && closes[i] > closes[i - 1]) {
    return { signal: 'BUY', reason: `OBV突破${period}日新高` };
  }
  if (obv[i] < obvLow && closes[i] < closes[i - 1]) {
    return { signal: 'SELL', reason: `OBV跌破${period}日新低` };
  }

  return { signal: 'NONE', reason: '' };
}

/** MFI背离信号：简化版 - MFI从超卖区回升买入，从超买区回落卖出 */
function mfiDivergenceSignal(
  i: number,
  closes: number[],
  mfi: number[]
): StrategySignal {
  if (i < 1 || isNaN(mfi[i]) || isNaN(mfi[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // MFI底背离简化：MFI从超卖区(20以下)回升，且价格仍下跌
  if (mfi[i - 1] < 20 && mfi[i] >= 20 && closes[i] < closes[i - 1]) {
    return { signal: 'BUY', reason: `MFI底背离(MFI${mfi[i].toFixed(1)})` };
  }
  // MFI超卖回升
  if (mfi[i - 1] < 20 && mfi[i] >= 20) {
    return { signal: 'BUY', reason: `MFI超卖回升(${mfi[i].toFixed(1)})` };
  }
  // MFI顶背离简化：MFI从超买区(80以上)回落，且价格仍上涨
  if (mfi[i - 1] > 80 && mfi[i] <= 80 && closes[i] > closes[i - 1]) {
    return { signal: 'SELL', reason: `MFI顶背离(MFI${mfi[i].toFixed(1)})` };
  }
  // MFI超买回落
  if (mfi[i - 1] > 80 && mfi[i] <= 80) {
    return { signal: 'SELL', reason: `MFI超买回落(${mfi[i].toFixed(1)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** ADX趋势强度信号：ADX>25且+DI>-DI买入，ADX<20或+DI<-DI卖出 */
function adxTrendSignal(
  i: number,
  adx: number[],
  plusDI: number[],
  minusDI: number[]
): StrategySignal {
  if (i < 1 || isNaN(adx[i]) || isNaN(plusDI[i]) || isNaN(minusDI[i])) {
    return { signal: 'NONE', reason: '' };
  }

  // 买入：ADX>25且+DI上穿-DI
  if (adx[i] > 25 && plusDI[i - 1] <= minusDI[i - 1] && plusDI[i] > minusDI[i]) {
    return { signal: 'BUY', reason: `ADX趋势确认(+DI上穿-DI, ADX${adx[i].toFixed(1)})` };
  }
  // 卖出：ADX<20或+DI下穿-DI
  if (plusDI[i - 1] >= minusDI[i - 1] && plusDI[i] < minusDI[i]) {
    return { signal: 'SELL', reason: `ADX趋势反转(+DI下穿-DI, ADX${adx[i].toFixed(1)})` };
  }
  if (adx[i] < 20 && adx[i - 1] >= 20) {
    return { signal: 'SELL', reason: `ADX趋势减弱(ADX${adx[i].toFixed(1)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 一目均衡表信号：价格突破云层买入，跌破云层卖出 */
function ichimokuCloudSignal(
  i: number,
  closes: number[],
  tenkan: number[],
  kijun: number[],
  spanA: number[],
  spanB: number[]
): StrategySignal {
  if (i < 1 || isNaN(spanA[i]) || isNaN(spanB[i]) || isNaN(tenkan[i]) || isNaN(kijun[i])) {
    return { signal: 'NONE', reason: '' };
  }

  const cloudTop = Math.max(spanA[i], spanB[i]);
  const cloudBottom = Math.min(spanA[i], spanB[i]);
  const prevCloudTop = isNaN(spanA[i - 1]) || isNaN(spanB[i - 1])
    ? cloudTop : Math.max(spanA[i - 1], spanB[i - 1]);
  const prevCloudBottom = isNaN(spanA[i - 1]) || isNaN(spanB[i - 1])
    ? cloudBottom : Math.min(spanA[i - 1], spanB[i - 1]);

  // 价格从云层下方突破到云层上方
  if (closes[i - 1] <= prevCloudTop && closes[i] > cloudTop) {
    return { signal: 'BUY', reason: '价格突破云层上方' };
  }
  // 转换线上穿基准线（金叉）
  if (tenkan[i - 1] <= kijun[i - 1] && tenkan[i] > kijun[i]) {
    return { signal: 'BUY', reason: '转换线上穿基准线(金叉)' };
  }
  // 价格从云层上方跌破到云层下方
  if (closes[i - 1] >= prevCloudBottom && closes[i] < cloudBottom) {
    return { signal: 'SELL', reason: '价格跌破云层下方' };
  }
  // 转换线下穿基准线（死叉）
  if (tenkan[i - 1] >= kijun[i - 1] && tenkan[i] < kijun[i]) {
    return { signal: 'SELL', reason: '转换线下穿基准线(死叉)' };
  }

  return { signal: 'NONE', reason: '' };
}

/** ATR动态止损信号：基于ATR通道判断突破方向 */
function atrTrailingStopSignal(
  i: number,
  closes: number[],
  atr: number[],
  multiplier: number = 2
): StrategySignal {
  if (i < 1 || isNaN(atr[i]) || isNaN(atr[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // ATR通道上轨和下轨
  const upperChannel = closes[i - 1] + multiplier * atr[i - 1];
  const lowerChannel = closes[i - 1] - multiplier * atr[i - 1];

  // 价格突破ATR通道上轨
  if (closes[i] > upperChannel) {
    return { signal: 'BUY', reason: `突破ATR上轨(${closes[i].toFixed(2)} > ${upperChannel.toFixed(2)})` };
  }
  // 价格跌破ATR通道下轨
  if (closes[i] < lowerChannel) {
    return { signal: 'SELL', reason: `跌破ATR下轨(${closes[i].toFixed(2)} < ${lowerChannel.toFixed(2)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 随机指标信号：%K上穿%D且处于超卖区买入，下穿且处于超买区卖出 */
function stochasticSignal(
  i: number,
  stochK: number[],
  stochD: number[]
): StrategySignal {
  if (i < 1 || isNaN(stochK[i]) || isNaN(stochD[i]) || isNaN(stochK[i - 1]) || isNaN(stochD[i - 1])) {
    return { signal: 'NONE', reason: '' };
  }

  // %K上穿%D且处于超卖区
  if (stochK[i - 1] <= stochD[i - 1] && stochK[i] > stochD[i] && stochK[i] < 20) {
    return { signal: 'BUY', reason: `随机指标金叉超卖区(%K${stochK[i].toFixed(1)})` };
  }
  // %K下穿%D且处于超买区
  if (stochK[i - 1] >= stochD[i - 1] && stochK[i] < stochD[i] && stochK[i] > 80) {
    return { signal: 'SELL', reason: `随机指标死叉超买区(%K${stochK[i].toFixed(1)})` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 龙虎榜跟庄信号：大额放量+价格上涨 */
function dragonTigerSignal(
  i: number,
  closes: number[],
  volumes: number[],
  volSma: number[]
): StrategySignal {
  if (i < 2 || isNaN(volSma[i])) {
    return { signal: 'NONE', reason: '' };
  }

  const volumeRatio = volumes[i] / volSma[i];
  const priceChangePct = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100;
  const prevVolumeRatio = volumes[i - 1] / volSma[i - 1];
  const consecutiveVolumeUp = volumeRatio > 2.5 && prevVolumeRatio > 1.5;

  // 连续放量+价格上涨
  if (consecutiveVolumeUp && priceChangePct > 3) {
    return { signal: 'BUY', reason: `龙虎榜跟庄(量比${volumeRatio.toFixed(1)}, 涨${priceChangePct.toFixed(1)}%)` };
  }
  // 缩量跌破
  if (volumeRatio < 0.8 && priceChangePct < -1) {
    return { signal: 'SELL', reason: `主力出货(量比${volumeRatio.toFixed(2)}, 跌${Math.abs(priceChangePct).toFixed(1)}%)` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 涨停板突破信号：大幅上涨+放量+收盘接近最高 */
function limitUpBreakoutSignal(
  i: number,
  closes: number[],
  highs: number[],
  volumes: number[],
  volSma: number[]
): StrategySignal {
  if (i < 1 || isNaN(volSma[i])) {
    return { signal: 'NONE', reason: '' };
  }

  const priceChangePct = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100;
  const volumeRatio = volumes[i] / volSma[i];
  const closeToHigh = highs[i] > 0 ? (closes[i] / highs[i]) : 0;

  // 大幅上涨+放量+收盘接近最高价
  if (priceChangePct > 5 && volumeRatio > 2.0 && closeToHigh > 0.97) {
    return { signal: 'BUY', reason: `涨停突破(涨${priceChangePct.toFixed(1)}%, 量比${volumeRatio.toFixed(1)})` };
  }
  // 大幅下跌+缩量
  if (priceChangePct < -2 && volumeRatio < 0.5) {
    return { signal: 'SELL', reason: `动量衰竭(跌${Math.abs(priceChangePct).toFixed(1)}%, 缩量)` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 北向资金流入信号：连续放量+累计涨幅 */
function northboundCapitalSignal(
  i: number,
  closes: number[],
  volumes: number[],
  volSma: number[]
): StrategySignal {
  if (i < 3 || isNaN(volSma[i])) {
    return { signal: 'NONE', reason: '' };
  }

  // Check consecutive volume increase
  const volRatios: number[] = [];
  for (let j = i - 2; j <= i; j++) {
    if (!isNaN(volSma[j])) {
      volRatios.push(volumes[j] / volSma[j]);
    }
  }

  const consecutiveHigh = volRatios.length === 3 && volRatios.every(r => r > 1.5);
  const cumulativeReturn = ((closes[i] - closes[i - 3]) / closes[i - 3]) * 100;
  const currentVolRatio = volumes[i] / volSma[i];

  // 连续放量+累计涨幅>2%
  if (consecutiveHigh && cumulativeReturn > 2) {
    return { signal: 'BUY', reason: `北向资金流入(连续放量, 累计涨${cumulativeReturn.toFixed(1)}%)` };
  }
  // 缩量+收盘价低于MA5（简化）
  if (currentVolRatio < 0.7 && closes[i] < closes[i - 1]) {
    return { signal: 'SELL', reason: `资金流出(量比${currentVolRatio.toFixed(2)}, 缩量下跌)` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 融资融券信号：放量+波动率扩张+突破 */
function marginTradingSignal(
  i: number,
  closes: number[],
  volumes: number[],
  volSma: number[],
  atr: number[]
): StrategySignal {
  if (i < 1 || isNaN(volSma[i]) || isNaN(atr[i])) {
    return { signal: 'NONE', reason: '' };
  }

  const volumeRatio = volumes[i] / volSma[i];
  const priceChangePct = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100;

  // Check ATR expansion (volatility increasing)
  const atrSma = atr.slice(Math.max(0, i - 9), i + 1).filter(v => !isNaN(v));
  const avgATR = atrSma.length > 0 ? atrSma.reduce((s, v) => s + v, 0) / atrSma.length : 0;
  const atrExpansion = avgATR > 0 && atr[i] > avgATR * 1.5;

  // 放量+波动率扩张+上涨
  if (volumeRatio > 2.0 && atrExpansion && priceChangePct > 1) {
    return { signal: 'BUY', reason: `融资买入信号(量比${volumeRatio.toFixed(1)}, 波动率扩张)` };
  }
  // 缩量+波动率收缩+下跌
  if (volumeRatio < 0.8 && avgATR > 0 && atr[i] < avgATR * 0.7 && priceChangePct < -1) {
    return { signal: 'SELL', reason: `融资卖出信号(量比${volumeRatio.toFixed(2)}, 波动率收缩)` };
  }

  return { signal: 'NONE', reason: '' };
}

/** 板块轮动信号：基于相对强弱+回调买入 */
function sectorRotationSignal(
  i: number,
  closes: number[],
  volumes: number[],
  volSma: number[],
  ma20: number[]
): StrategySignal {
  if (i < 14 || isNaN(ma20[i]) || isNaN(volSma[i])) {
    return { signal: 'NONE', reason: '' };
  }

  // Relative strength: price vs MA20
  const relativeStrength = closes[i] / ma20[i];
  const volumeRatio = volumes[i] / volSma[i];

  // Calculate recent price momentum (14-day return)
  const priceMomentum = i >= 14 ? ((closes[i] - closes[i - 14]) / closes[i - 14]) * 100 : 0;

  // Strong relative strength + pullback on low volume
  if (relativeStrength > 1.02 && priceMomentum > 5 && volumeRatio < 0.8 && closes[i] > ma20[i]) {
    return { signal: 'BUY', reason: `板块轮动买入(相对强度${(relativeStrength * 100).toFixed(0)}%, 缩量回调)` };
  }
  // Weak relative strength + volume on bounce
  if (relativeStrength < 0.98 && priceMomentum < -5 && closes[i] < ma20[i]) {
    return { signal: 'SELL', reason: `板块轮动卖出(相对强度${(relativeStrength * 100).toFixed(0)}%, 跌破MA20)` };
  }

  return { signal: 'NONE', reason: '' };
}

function getSignal(
  strategy: string,
  i: number,
  data: CandleData,
  indicators: BacktestIndicators
): StrategySignal {
  switch (strategy) {
    case 'ma-golden-cross':
      return maGoldenCrossSignal(i, indicators.ma5, indicators.ma20);
    case 'macd-signal':
      return macdSignal(i, indicators.macdLine, indicators.signalLine);
    case 'rsi-oversold-overbought':
      return rsiSignal(i, indicators.rsi);
    case 'bollinger-breakout':
      return bollingerSignal(i, data.closes, indicators.bollUpper, indicators.bollLower);
    case 'kdj-golden-cross':
      return kdjSignal(i, indicators.kdjK, indicators.kdjD);
    case 'volume-breakout':
      return volumeBreakoutSignal(i, data.closes, data.volumes, indicators.volSma);
    case 'shrink-pullback':
      return shrinkPullbackSignal(i, data.closes, data.volumes, indicators.volSma, indicators.ma20);
    case 'wave-theory':
      return waveTheorySignal(i, data.closes, indicators.ma5, indicators.ma20, indicators.macdLine, indicators.rsi);
    case 'box-oscillation':
      return boxOscillationSignal(i, data.closes, indicators.bollUpper, indicators.bollLower, indicators.rsi);
    case 'event-driven':
      return eventDrivenSignal(i, data.closes, data.volumes, indicators.volSma, indicators.ma5);
    case 'sar-parabolic':
      return sarParabolicSignal(i, data.closes, indicators.sar);
    case 'supertrend':
      return supertrendSignal(i, data.closes, indicators.supertrend, indicators.supertrendDir);
    case 'cci-divergence':
      return cciDivergenceSignal(i, data.closes, indicators.cci);
    case 'williams-r':
      return williamsRSignal(i, indicators.williamsR);
    case 'obv-breakout':
      return obvBreakoutSignal(i, data.closes, indicators.obv, 20);
    case 'mfi-divergence':
      return mfiDivergenceSignal(i, data.closes, indicators.mfi);
    case 'adx-trend':
      return adxTrendSignal(i, indicators.adx, indicators.plusDI, indicators.minusDI);
    case 'ichimoku-cloud':
      return ichimokuCloudSignal(i, data.closes, indicators.ichimokuTenkan, indicators.ichimokuKijun, indicators.ichimokuSpanA, indicators.ichimokuSpanB);
    case 'atr-trailing-stop':
      return atrTrailingStopSignal(i, data.closes, indicators.atr, 2);
    case 'stochastic-oscillator':
      return stochasticSignal(i, indicators.stochK, indicators.stochD);
    case 'dragon-tiger':
      return dragonTigerSignal(i, data.closes, data.volumes, indicators.volSma);
    case 'limit-up-breakout':
      return limitUpBreakoutSignal(i, data.closes, data.highs, data.volumes, indicators.volSma);
    case 'northbound-capital':
      return northboundCapitalSignal(i, data.closes, data.volumes, indicators.volSma);
    case 'margin-trading':
      return marginTradingSignal(i, data.closes, data.volumes, indicators.volSma, indicators.atr);
    case 'sector-rotation':
      return sectorRotationSignal(i, data.closes, data.volumes, indicators.volSma, indicators.ma20);
    default:
      // 自定义策略（custom- 开头 或 DB cuid格式）使用组合信号
      if (strategy.startsWith('custom-') || isCustomStrategyId(strategy)) {
        return customCombinedSignal(i, data, indicators);
      }
      // 其他未知策略默认用MA金叉
      return maGoldenCrossSignal(i, indicators.ma5, indicators.ma20);
  }
}

/** Check if a strategy ID looks like a database cuid (e.g., 'clxxxx...') */
function isCustomStrategyId(id: string): boolean {
  // Prisma cuid IDs start with 'c' and are 25+ chars
  return /^c[a-z0-9]{20,}$/.test(id);
}

/** 所有指标数组的集合 */
interface BacktestIndicators {
  ma5: number[];
  ma20: number[];
  macdLine: number[];
  signalLine: number[];
  rsi: number[];
  bollUpper: number[];
  bollLower: number[];
  kdjK: number[];
  kdjD: number[];
  volSma: number[];
  chUpper: number[];
  chLower: number[];
  // New indicators
  sar: number[];
  supertrend: number[];
  supertrendDir: number[];
  cci: number[];
  williamsR: number[];
  obv: number[];
  mfi: number[];
  adx: number[];
  plusDI: number[];
  minusDI: number[];
  ichimokuTenkan: number[];
  ichimokuKijun: number[];
  ichimokuSpanA: number[];
  ichimokuSpanB: number[];
  atr: number[];
  stochK: number[];
  stochD: number[];
}

/**
 * 核心回测函数：逐日遍历，根据策略信号决定买卖
 */
function runBacktest(config: BacktestConfig, data: CandleData): BacktestResult {
  const { closes, highs, lows, volumes, timestamps } = data;
  const capital = config.initialCapital;
  const trades: TradeRecord[] = [];
  const equityCurve: { date: string; equity: number }[] = [];

  // ---- 计算所有指标数组 ----
  const ma5 = smaArray(closes, 5);
  const ma20 = smaArray(closes, 20);
  const { macdLine, signalLine } = macdArrays(closes, 12, 26, 9);
  const rsi = rsiArray(closes, 14);
  const { upper: bollUpper, lower: bollLower } = bollingerArrays(closes, 20, 2);
  const { k: kdjK, d: kdjD } = kdjArrays(highs, lows, closes, 9, 3, 3);
  const volSma = volumeSmaArray(volumes, 20);
  const { upper: chUpper, lower: chLower } = channelArrays(highs, lows, 20);

  // New indicators
  const sar = sarArray(highs, lows, closes, 0.02, 0.2);
  const { supertrend: supertrendArr, direction: supertrendDir } = supertrendArrays(highs, lows, closes, 10, 3);
  const cci = cciArray(highs, lows, closes, 20);
  const williamsR = williamsRArray(highs, lows, closes, 14);
  const obv = obvArray(closes, volumes);
  const mfi = mfiArray(highs, lows, closes, volumes, 14);
  const { adx: adxArr, plusDI, minusDI } = adxArrays(highs, lows, closes, 14);
  const { tenkan: ichimokuTenkan, kijun: ichimokuKijun, spanA: ichimokuSpanA, spanB: ichimokuSpanB } = ichimokuArrays(highs, lows, closes, 9, 26, 52);
  const atr = atrArray(highs, lows, closes, 14);
  const { k: stochK, d: stochD } = stochasticArrays(highs, lows, closes, 14, 3, 3);

  const indicators: BacktestIndicators = {
    ma5, ma20, macdLine, signalLine, rsi,
    bollUpper, bollLower, kdjK, kdjD, volSma, chUpper, chLower,
    sar, supertrend: supertrendArr, supertrendDir,
    cci, williamsR, obv, mfi,
    adx: adxArr, plusDI, minusDI,
    ichimokuTenkan, ichimokuKijun, ichimokuSpanA, ichimokuSpanB,
    atr, stochK, stochD,
  };

  // ---- 找到回测起始索引（用户指定的startDate） ----
  const startTs = new Date(config.startDate).getTime();
  const endTs = new Date(config.endDate).getTime();
  let startIdx = 0;
  for (let i = 0; i < timestamps.length; i++) {
    if (timestamps[i] * 1000 >= startTs) {
      startIdx = i;
      break;
    }
  }

  // ---- 确定有效指标起始索引（跳过NaN预热期） ----
  // MA20需要至少20个数据点，MACD需要26+9个数据点，Ichimoku需要52个数据点
  const warmupIdx = Math.max(startIdx, 55);

  // ---- 逐日模拟 ----
  let equity = capital;
  let position: Position | null = null;

  for (let i = warmupIdx; i < closes.length; i++) {
    const currentTs = timestamps[i] * 1000;

    // 超出回测结束日期则停止
    if (currentTs > endTs + 86400000) break;

    const date = new Date(currentTs).toISOString().split('T')[0];
    const currentPrice = closes[i];
    const dayHigh = highs[i];
    const dayLow = lows[i];

    // ---- 如果有持仓，先检查止损/止盈（日内优先检查） ----
    if (position) {
      const pnlPctFromEntry = (currentPrice - position.entryPrice) / position.entryPrice * 100;
      const holdingDays = i - position.entryIdx;

      // 日内止损检查：当日最低价触及止损线
      const stopLossPrice = position.entryPrice * (1 - config.stopLossPct / 100);
      const takeProfitPrice = position.entryPrice * (1 + config.takeProfitPct / 100);

      let shouldExit = false;
      let exitPrice = currentPrice;
      let exitReason = '';

      // 优先检查日内止损（用最低价模拟日内触价）
      if (dayLow <= stopLossPrice) {
        shouldExit = true;
        exitPrice = stopLossPrice;
        exitReason = `止损(${config.stopLossPct}%)`;
      }
      // 日内止盈检查（用最高价模拟日内触价）
      else if (dayHigh >= takeProfitPrice) {
        shouldExit = true;
        exitPrice = takeProfitPrice;
        exitReason = `止盈(${config.takeProfitPct}%)`;
      }
      // 收盘价止损/止盈（如果日内没有触发）
      else if (pnlPctFromEntry <= -config.stopLossPct) {
        shouldExit = true;
        exitPrice = currentPrice;
        exitReason = `收盘止损(${pnlPctFromEntry.toFixed(1)}%)`;
      } else if (pnlPctFromEntry >= config.takeProfitPct) {
        shouldExit = true;
        exitPrice = currentPrice;
        exitReason = `收盘止盈(${pnlPctFromEntry.toFixed(1)}%)`;
      }

      // 最大持仓周期限制
      if (!shouldExit && holdingDays >= config.cycleDays) {
        shouldExit = true;
        exitPrice = currentPrice;
        exitReason = `最大持仓${config.cycleDays}天到期`;
      }

      // 策略卖出信号（非止损止盈）
      if (!shouldExit) {
        const sig = getSignal(config.strategy, i, data, indicators);
        if (sig.signal === 'SELL') {
          shouldExit = true;
          exitPrice = currentPrice;
          exitReason = sig.reason;
        }
      }

      // 执行卖出
      if (shouldExit) {
        const pnl = (exitPrice - position.entryPrice) * position.quantity;
        const pnlPercent = (exitPrice - position.entryPrice) / position.entryPrice * 100;

        trades.push({
          id: String(trades.length + 1),
          symbol: config.symbol || 'AAPL',
          side: 'SELL',
          entryDate: position.entryDate,
          exitDate: date,
          entryPrice: Number(position.entryPrice.toFixed(2)),
          exitPrice: Number(exitPrice.toFixed(2)),
          quantity: position.quantity,
          pnl: Number(pnl.toFixed(2)),
          pnlPercent: Number(pnlPercent.toFixed(2)),
        });

        equity += pnl;
        position = null;
      }
    }

    // ---- 如果没有持仓，检查买入信号 ----
    if (!position) {
      const sig = getSignal(config.strategy, i, data, indicators);

      if (sig.signal === 'BUY') {
        // 优先用次日开盘价成交（更真实的模拟），但此处简化为当日收盘价
        const entryPrice = currentPrice;
        const positionSize = equity * (config.positionSizePct / 100);
        const quantity = Math.floor(positionSize / entryPrice);

        if (quantity > 0) {
          position = {
            entryPrice,
            entryDate: date,
            quantity,
            entryIdx: i,
            reason: sig.reason,
          };
        }
      }
    }

    // ---- 记录当日权益 ----
    // 如果有持仓，权益 = 现金 + 持仓市值
    let dailyEquity = equity;
    if (position) {
      dailyEquity += (currentPrice - position.entryPrice) * position.quantity;
    }
    equityCurve.push({
      date,
      equity: Number(dailyEquity.toFixed(2)),
    });
  }

  // ---- 回测结束，强制平仓 ----
  if (position) {
    const lastIdx = closes.length - 1;
    const exitPrice = closes[lastIdx];
    const pnl = (exitPrice - position.entryPrice) * position.quantity;
    const pnlPercent = (exitPrice - position.entryPrice) / position.entryPrice * 100;

    equity += pnl;
    trades.push({
      id: String(trades.length + 1),
      symbol: config.symbol || 'AAPL',
      side: 'SELL',
      entryDate: position.entryDate,
      exitDate: new Date(timestamps[lastIdx] * 1000).toISOString().split('T')[0],
      entryPrice: Number(position.entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      quantity: position.quantity,
      pnl: Number(pnl.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
    });
    position = null;
  }

  // ---- 计算统计指标 ----
  const totalReturn = equity - capital;
  const totalReturnPct = (totalReturn / capital) * 100;

  // 胜率
  const winTrades = trades.filter(t => t.pnl >= 0).length;
  const winRate = trades.length > 0 ? (winTrades / trades.length) * 100 : 0;

  // 最大回撤
  let maxDrawdown = 0;
  let peak = capital;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = ((peak - point.equity) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // 夏普比率（年化）
  // Standard formula: Sharpe = (mean_daily_return - risk_free_daily) / std_daily_return * sqrt(252)
  const dailyReturns = equityCurve.slice(1).map((point, idx) =>
    (point.equity - equityCurve[idx].equity) / equityCurve[idx].equity
  );
  const n = dailyReturns.length;
  const avgReturn = n > 0 ? dailyReturns.reduce((s, r) => s + r, 0) / n : 0;
  // Use sample standard deviation (N-1) — the standard in finance
  const stdReturn = n > 1
    ? Math.sqrt(dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (n - 1))
    : 0;
  const riskFreeRate = 0.01 / 252; // 年化1%无风险利率，换算为日利率
  // Guard against division by near-zero std (produces extreme/unstable ratios)
  const sharpeRatio = stdReturn > 1e-8
    ? ((avgReturn - riskFreeRate) / stdReturn) * Math.sqrt(252)
    : 0;

  return {
    totalReturn: Number(totalReturn.toFixed(2)),
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    maxDrawdown: Number(maxDrawdown.toFixed(1)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    totalTrades: trades.length,
    equityCurve,
    trades,
    dataSource: 'finnhub', // 默认值，调用处会覆盖
  };
}

// ===================== 模拟K线数据生成（当Finnhub不可用时） =====================

/**
 * 生成模拟K线数据
 * 基于几何布朗运动模型，产生具有真实感的OHLCV数据
 * 注意：回测引擎本身是真实的，只是输入数据是模拟的
 */
function generateSimulatedCandleData(symbol: string, startDate: string, endDate: string): CandleData {
  // 根据股票代码确定基础价格（确定性映射）
  const symbolHash = symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const basePrice = 50 + (symbolHash % 50) * 5; // 50~295之间

  // 计算交易日数（向前扩展200天用于指标预热）
  const extendedStart = new Date(startDate);
  extendedStart.setDate(extendedStart.getDate() - 200);
  const endMs = new Date(endDate).getTime();
  const startMs = extendedStart.getTime();
  const calendarDays = Math.floor((endMs - startMs) / 86400000);
  const tradingDays = Math.floor(calendarDays * 5 / 7); // 大约5/7是交易日

  // 使用确定性伪随机数（基于symbol），保证同一股票每次生成相同数据
  let seed = symbolHash;
  function seededRandom(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const opens: number[] = [];
  const volumes: number[] = [];
  const timestamps: number[] = [];

  let price = basePrice * (0.8 + seededRandom() * 0.2); // 起始价格有轻微随机偏移
  const dailyVolatility = 0.02; // 日波动率2%
  const dailyDrift = 0.0003; // 微弱上涨倾向

  let dayTs = Math.floor(startMs / 1000);

  for (let i = 0; i < tradingDays; i++) {
    // 跳过周末
    const dayOfWeek = new Date(dayTs * 1000).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      dayTs += 86400;
      i--;
      continue;
    }

    // 几何布朗运动
    const randomReturn = dailyDrift + dailyVolatility * (seededRandom() - 0.5) * 2;
    const open = Number(price.toFixed(2));
    const close = Number((price * (1 + randomReturn)).toFixed(2));
    const intraVolatility = Math.abs(randomReturn) + dailyVolatility * 0.5 * seededRandom();
    const high = Number((Math.max(open, close) * (1 + intraVolatility * seededRandom())).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - intraVolatility * seededRandom())).toFixed(2));
    const volume = Math.floor(30000000 + seededRandom() * 70000000);

    opens.push(open);
    closes.push(close);
    highs.push(high);
    lows.push(low);
    volumes.push(volume);
    timestamps.push(dayTs);

    price = close;
    dayTs += 86400;
  }

  return { closes, highs, lows, opens, volumes, timestamps };
}

// ===================== API入口 =====================

interface CustomStrategyInfo {
  name: string;
  entryConditions: string[];
  exitConditions: string[];
  description?: string;
}

interface BacktestRequestBody extends BacktestConfig {
  customStrategy?: CustomStrategyInfo;
}

export async function POST(request: NextRequest) {
  try {
    const body: BacktestRequestBody = await request.json();
    let customStrategyInfo = body.customStrategy;

    if (!body.strategy) {
      return NextResponse.json(
        { error: 'Strategy is required' },
        { status: 400 }
      );
    }

    // Resolve custom strategy from database if the ID is a cuid (not custom- prefix)
    let isCustomStrategy = body.strategy.startsWith('custom-');
    if (!isCustomStrategy && isCustomStrategyId(body.strategy)) {
      try {
        const dbStrategy = await db.strategy.findUnique({ where: { id: body.strategy } });
        if (dbStrategy && !dbStrategy.isBuiltin) {
          isCustomStrategy = true;
          const config = dbStrategy.config ? JSON.parse(dbStrategy.config) : {};
          customStrategyInfo = {
            name: dbStrategy.name,
            entryConditions: config.entryCondition ? config.entryCondition.split('；').filter(Boolean) : [],
            exitConditions: config.exitCondition ? config.exitCondition.split('；').filter(Boolean) : [],
            description: dbStrategy.description || undefined,
          };
        }
      } catch {
        // DB lookup failed, proceed without custom strategy resolution
      }
    }

    // 填充默认值
    const fullConfig: BacktestConfig = {
      strategy: body.strategy,
      symbol: body.symbol || 'AAPL',
      initialCapital: body.initialCapital || 100000,
      positionSizePct: body.positionSizePct || 10,
      stopLossPct: body.stopLossPct || 8,
      takeProfitPct: body.takeProfitPct || 15,
      cycleDays: body.cycleDays || 7,
      startDate: body.startDate || '2023-07-01',
      endDate: body.endDate || new Date().toISOString().split('T')[0],
    };

    // 从Finnhub获取历史K线数据（向前扩展200天用于指标预热）
    let priceData = await fetchHistoricalData(fullConfig.symbol, fullConfig.startDate, fullConfig.endDate);
    let dataSource: 'finnhub' | 'simulated' = 'finnhub';

    // 如果Finnhub数据不可用，生成模拟K线数据（回测引擎本身仍然真实运行）
    if (!priceData || priceData.closes.length < 40) {
      priceData = generateSimulatedCandleData(fullConfig.symbol, fullConfig.startDate, fullConfig.endDate);
      dataSource = 'simulated';
    }

    // 执行真实回测
    const result = runBacktest(fullConfig, priceData);
    result.dataSource = dataSource;

    // Add custom strategy metadata if applicable
    const response = {
      ...result,
      strategyName: isCustomStrategy && customStrategyInfo
        ? customStrategyInfo.name
        : undefined,
      strategyType: isCustomStrategy ? 'custom' : 'builtin',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[fusion/backtest/run] Error:', error);
    return NextResponse.json(
      { error: '回测执行失败，请检查参数或稍后重试' },
      { status: 500 }
    );
  }
}
