import { NextRequest, NextResponse } from 'next/server';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;

// --- 技术指标辅助函数 ---

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

function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  numStd: number = 2
): { upper: number; middle: number; lower: number; pricePosition: number } {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, pricePosition: 0.5 };
  const slice = closes.slice(-period);
  const middle = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + numStd * stdDev;
  const lower = middle - numStd * stdDev;
  const currentPrice = closes[closes.length - 1];
  const bandwidth = upper - lower;
  const pricePosition = bandwidth > 0 ? (currentPrice - lower) / bandwidth : 0.5;
  return {
    upper: parseFloat(upper.toFixed(4)),
    middle: parseFloat(middle.toFixed(4)),
    lower: parseFloat(lower.toFixed(4)),
    pricePosition: parseFloat(pricePosition.toFixed(4)),
  };
}

function calculateKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  n: number = 9,
  m1: number = 3,
  m2: number = 3
): { k: number; d: number; j: number } {
  if (closes.length < n || highs.length < n || lows.length < n) return { k: 50, d: 50, j: 50 };
  let prevK = 50;
  let prevD = 50;
  let k = 50;
  let d = 50;
  for (let i = n - 1; i < closes.length; i++) {
    const highSlice = highs.slice(i - n + 1, i + 1);
    const lowSlice = lows.slice(i - n + 1, i + 1);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    const rsv = highestHigh !== lowestLow
      ? ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
      : 50;
    prevK = k;
    prevD = d;
    k = (2 / m1) * prevK + (1 / m1) * rsv;
    d = (2 / m2) * prevD + (1 / m2) * k;
  }
  const j = 3 * k - 2 * d;
  return {
    k: parseFloat(k.toFixed(4)),
    d: parseFloat(d.toFixed(4)),
    j: parseFloat(j.toFixed(4)),
  };
}

function calculateVolumeRatio(volumes: number[], period: number = 5): number {
  if (volumes.length < 2) return 1;
  const currentVolume = volumes[volumes.length - 1];
  const avgSlice = volumes.slice(-period - 1, -1);
  const avgVolume = avgSlice.length > 0
    ? avgSlice.reduce((s, v) => s + v, 0) / avgSlice.length
    : currentVolume;
  if (avgVolume === 0) return 1;
  return parseFloat((currentVolume / avgVolume).toFixed(4));
}

// --- 新增指标计算函数 ---

/** SAR抛物线指标 */
function calculateSAR(
  highs: number[],
  lows: number[],
  closes: number[],
  afStep: number = 0.02,
  afMax: number = 0.2
): { sar: number; trend: 'up' | 'down'; signal: string } {
  if (closes.length < 5 || highs.length < 5 || lows.length < 5) {
    return { sar: 0, trend: 'up', signal: 'NEUTRAL' };
  }
  let isUpTrend = closes[closes.length - 1] > closes[0];
  let af = afStep;
  let sar: number;
  let ep: number;
  if (isUpTrend) {
    sar = Math.min(...lows.slice(0, 5));
    ep = Math.max(...highs.slice(0, 5));
  } else {
    sar = Math.max(...highs.slice(0, 5));
    ep = Math.min(...lows.slice(0, 5));
  }
  for (let i = 5; i < closes.length; i++) {
    sar = sar + af * (ep - sar);
    if (isUpTrend) {
      if (lows[i] < sar) {
        isUpTrend = false;
        sar = ep;
        ep = lows[i];
        af = afStep;
      } else {
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + afStep, afMax);
        }
        const prevLow1 = i >= 1 ? lows[i - 1] : lows[i];
        const prevLow2 = i >= 2 ? lows[i - 2] : prevLow1;
        sar = Math.min(sar, prevLow1, prevLow2);
      }
    } else {
      if (highs[i] > sar) {
        isUpTrend = true;
        sar = ep;
        ep = highs[i];
        af = afStep;
      } else {
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + afStep, afMax);
        }
        const prevHigh1 = i >= 1 ? highs[i - 1] : highs[i];
        const prevHigh2 = i >= 2 ? highs[i - 2] : prevHigh1;
        sar = Math.max(sar, prevHigh1, prevHigh2);
      }
    }
  }
  const currentPrice = closes[closes.length - 1];
  const trend = isUpTrend ? 'up' as const : 'down' as const;
  let signal = 'NEUTRAL';
  if (isUpTrend && currentPrice > sar) signal = 'BULLISH';
  else if (!isUpTrend && currentPrice < sar) signal = 'BEARISH';
  return { sar: parseFloat(sar.toFixed(4)), trend, signal };
}

/** ATR真实波幅 */
function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (closes.length < 2 || highs.length < 2 || lows.length < 2) return 0;
  const trList: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trList.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  if (trList.length < period) return 0;
  let atr = trList.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trList.length; i++) {
    atr = (atr * (period - 1) + trList[i]) / period;
  }
  return parseFloat(atr.toFixed(4));
}

/** Supertrend超级趋势 */
function calculateSupertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3
): { value: number; trend: 'up' | 'down'; signal: string } {
  if (closes.length < period + 1) return { value: 0, trend: 'up', signal: 'NEUTRAL' };
  const atr = calculateATR(highs, lows, closes, period);
  if (atr <= 0) return { value: 0, trend: 'up', signal: 'NEUTRAL' };

  let trend: 'up' | 'down' = 'up';
  let supertrend = 0;
  let prevUpper = Infinity;
  let prevLower = -Infinity;

  for (let i = period; i < closes.length; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    const trSlice: number[] = [];
    for (let j = Math.max(1, i - period * 2); j <= i; j++) {
      trSlice.push(Math.max(highs[j] - lows[j], Math.abs(highs[j] - closes[j - 1]), Math.abs(lows[j] - closes[j - 1])));
    }
    const sliceAtr = trSlice.length >= period
      ? (() => { let a = trSlice.slice(0, period).reduce((s, v) => s + v, 0) / period; for (let k = period; k < trSlice.length; k++) { a = (a * (period - 1) + trSlice[k]) / period; } return a; })()
      : atr;

    const upperBand = hl2 + multiplier * sliceAtr;
    const lowerBand = hl2 - multiplier * sliceAtr;

    let finalLower = lowerBand;
    let finalUpper = upperBand;
    if (closes[i - 1] > prevLower) finalLower = Math.max(lowerBand, prevLower);
    if (closes[i - 1] < prevUpper) finalUpper = Math.min(upperBand, prevUpper);

    if (trend === 'up') {
      if (closes[i] < finalLower) { trend = 'down'; supertrend = finalUpper; }
      else { supertrend = finalLower; }
    } else {
      if (closes[i] > finalUpper) { trend = 'up'; supertrend = finalLower; }
      else { supertrend = finalUpper; }
    }
    prevUpper = finalUpper;
    prevLower = finalLower;
  }

  const currentPrice = closes[closes.length - 1];
  let signal = 'NEUTRAL';
  if (trend === 'up' && currentPrice > supertrend) signal = 'BULLISH';
  else if (trend === 'down' && currentPrice < supertrend) signal = 'BEARISH';

  return { value: parseFloat(supertrend.toFixed(4)), trend, signal };
}

/** CCI商品通道指数 */
function calculateCCI(highs: number[], lows: number[], closes: number[], period: number = 20): { value: number; signal: string } {
  if (closes.length < period) return { value: 0, signal: 'NEUTRAL' };
  const tp: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  const tpSlice = tp.slice(-period);
  const tpSma = tpSlice.reduce((s, v) => s + v, 0) / period;
  const meanDev = tpSlice.reduce((s, v) => s + Math.abs(v - tpSma), 0) / period;
  if (meanDev === 0) return { value: 0, signal: 'NEUTRAL' };
  const cci = (tp[tp.length - 1] - tpSma) / (0.015 * meanDev);
  let signal = 'NEUTRAL';
  if (cci > 100) signal = 'OVERBOUGHT';
  else if (cci < -100) signal = 'OVERSOLD';
  else if (cci > 0) signal = 'BULLISH';
  else signal = 'BEARISH';
  return { value: parseFloat(cci.toFixed(4)), signal };
}

/** Williams %R 威廉指标 */
function calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): { value: number; signal: string } {
  if (closes.length < period) return { value: -50, signal: 'NEUTRAL' };
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highestHigh = Math.max(...highSlice);
  const lowestLow = Math.min(...lowSlice);
  const currentClose = closes[closes.length - 1];
  if (highestHigh === lowestLow) return { value: -50, signal: 'NEUTRAL' };
  const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  let signal = 'NEUTRAL';
  if (williamsR > -20) signal = 'OVERBOUGHT';
  else if (williamsR < -80) signal = 'OVERSOLD';
  else if (williamsR > -50) signal = 'BULLISH';
  else signal = 'BEARISH';
  return { value: parseFloat(williamsR.toFixed(4)), signal };
}

/** OBV能量潮 */
function calculateOBV(closes: number[], volumes: number[]): { value: number; signal: string } {
  if (closes.length < 2 || volumes.length < 2) return { value: 0, signal: 'NEUTRAL' };
  const obvArray: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obvArray.push(obvArray[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obvArray.push(obvArray[i - 1] - volumes[i]);
    else obvArray.push(obvArray[i - 1]);
  }
  const currentOBV = obvArray[obvArray.length - 1];
  let signal = 'NEUTRAL';
  if (obvArray.length >= 5) {
    const obvTrend = obvArray[obvArray.length - 1] - obvArray[obvArray.length - 5];
    const priceTrend = closes[closes.length - 1] - closes[closes.length - 5];
    if (obvTrend > 0 && priceTrend > 0) signal = 'BULLISH_CONFIRM';
    else if (obvTrend < 0 && priceTrend < 0) signal = 'BEARISH_CONFIRM';
    else if (obvTrend > 0 && priceTrend <= 0) signal = 'BULLISH_DIVERGENCE';
    else if (obvTrend < 0 && priceTrend >= 0) signal = 'BEARISH_DIVERGENCE';
  }
  return { value: parseFloat(currentOBV.toFixed(0)), signal };
}

/** MFI资金流量指数 */
function calculateMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): { value: number; signal: string } {
  if (closes.length < period + 1) return { value: 50, signal: 'NEUTRAL' };
  const tp: number[] = [];
  const mf: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
    mf.push(tp[i] * volumes[i]);
  }
  let positiveMF = 0;
  let negativeMF = 0;
  for (let i = tp.length - period; i < tp.length; i++) {
    if (tp[i] > tp[i - 1]) positiveMF += mf[i];
    else negativeMF += mf[i];
  }
  if (negativeMF === 0) return { value: 100, signal: 'OVERBOUGHT' };
  const mfi = 100 - (100 / (1 + positiveMF / negativeMF));
  let signal = 'NEUTRAL';
  if (mfi > 80) signal = 'OVERBOUGHT';
  else if (mfi < 20) signal = 'OVERSOLD';
  else if (mfi > 50) signal = 'BULLISH';
  else signal = 'BEARISH';
  return { value: parseFloat(mfi.toFixed(4)), signal };
}

/** ADX平均趋向指数 */
function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): { adx: number; plusDi: number; minusDi: number; signal: string } {
  if (closes.length < period * 2) return { adx: 0, plusDi: 0, minusDi: 0, signal: 'NO_TREND' };
  const trList: number[] = [];
  const plusDMList: number[] = [];
  const minusDMList: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trList.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDMList.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMList.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  let smoothedTR = trList.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothedPlusDM = plusDMList.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothedMinusDM = minusDMList.slice(0, period).reduce((s, v) => s + v, 0);
  const dxArray: number[] = [];
  for (let i = period; i < trList.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + trList[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMList[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMList[i];
    const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    dxArray.push(diSum > 0 ? Math.abs(plusDI - minusDI) / diSum * 100 : 0);
  }
  let adx = dxArray.length >= period
    ? dxArray.slice(0, period).reduce((s, v) => s + v, 0) / period
    : 0;
  for (let i = period; i < dxArray.length; i++) {
    adx = (adx * (period - 1) + dxArray[i]) / period;
  }
  const plusDi = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
  const minusDi = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
  let signal = 'NO_TREND';
  if (adx > 50) signal = 'STRONG_TREND';
  else if (adx > 25) signal = 'TRENDING';
  return { adx: parseFloat(adx.toFixed(4)), plusDi: parseFloat(plusDi.toFixed(4)), minusDi: parseFloat(minusDi.toFixed(4)), signal };
}

/** Ichimoku一目均衡表 */
function calculateIchimoku(
  highs: number[],
  lows: number[],
  closes: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): { tenkan: number; kijun: number; senkouA: number; senkouB: number; chikou: number; signal: string } {
  if (closes.length < senkouBPeriod) {
    return { tenkan: 0, kijun: 0, senkouA: 0, senkouB: 0, chikou: 0, signal: 'NEUTRAL' };
  }
  const tenkan = (Math.max(...highs.slice(-tenkanPeriod)) + Math.min(...lows.slice(-tenkanPeriod))) / 2;
  const kijun = (Math.max(...highs.slice(-kijunPeriod)) + Math.min(...lows.slice(-kijunPeriod))) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const senkouB = (Math.max(...highs.slice(-senkouBPeriod)) + Math.min(...lows.slice(-senkouBPeriod))) / 2;
  const chikou = closes[closes.length - 1];
  const currentPrice = closes[closes.length - 1];
  let signal = 'NEUTRAL';
  if (currentPrice > Math.max(senkouA, senkouB) && tenkan > kijun) signal = 'STRONG_BULLISH';
  else if (currentPrice > Math.max(senkouA, senkouB)) signal = 'BULLISH';
  else if (currentPrice < Math.min(senkouA, senkouB) && tenkan < kijun) signal = 'STRONG_BEARISH';
  else if (currentPrice < Math.min(senkouA, senkouB)) signal = 'BEARISH';
  else signal = 'RANGE_BOUND';
  return {
    tenkan: parseFloat(tenkan.toFixed(4)),
    kijun: parseFloat(kijun.toFixed(4)),
    senkouA: parseFloat(senkouA.toFixed(4)),
    senkouB: parseFloat(senkouB.toFixed(4)),
    chikou: parseFloat(chikou.toFixed(4)),
    signal,
  };
}

// --- 从Finnhub获取K线数据 ---

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

async function fetchKlineData(symbol: string): Promise<{
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
  source: string;
} | null> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  // Try Finnhub first if API key is available
  if (FINNHUB_API_KEY) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 365 * 86400; // 1年数据用于指标计算

    try {
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`;
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
            source: 'finnhub',
          };
        }
      }
    } catch {
      // Finnhub failed, fall through to Yahoo Finance
    }
  }

  // Try Yahoo Finance as fallback (free, no API key needed)
  try {
    const yfResponse = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
      FINNHUB_TIMEOUT
    );
    if (yfResponse.ok) {
      const yfData = await yfResponse.json();
      const result = yfData?.chart?.result?.[0];
      if (result && result.timestamp && result.indicators?.quote?.[0]) {
        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;
        const closes = quote.close || [];
        const opens = quote.open || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const volumes = quote.volume || [];

        // Filter out any null values (Yahoo sometimes has nulls)
        const validData: { o: number; h: number; l: number; c: number; v: number; t: number }[] = [];
        for (let i = 0; i < closes.length; i++) {
          if (closes[i] != null && opens[i] != null && highs[i] != null && lows[i] != null) {
            validData.push({
              o: opens[i],
              h: highs[i],
              l: lows[i],
              c: closes[i],
              v: volumes[i] || 0,
              t: timestamps[i],
            });
          }
        }

        if (validData.length > 30) {
          return {
            closes: validData.map(d => d.c),
            highs: validData.map(d => d.h),
            lows: validData.map(d => d.l),
            opens: validData.map(d => d.o),
            volumes: validData.map(d => d.v),
            source: 'yahoo-finance',
          };
        }
      }
    }
  } catch {
    // Yahoo Finance failed, fall through to mock
  }

  return null;
}

// --- 模拟指标数据 ---

function generateFallbackIndicators(symbol: string) {
  // 使用符号哈希创建确定性但变化的模拟数据
  const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = (hash % 100) / 100;

  const price = 50 + seed * 300;
  const rsi = 30 + seed * 40;
  const macdVal = (seed - 0.5) * 5;
  const signalVal = macdVal - (seed - 0.5) * 2;

  const bollingerBands = {
    upper: parseFloat((price * 1.05).toFixed(4)),
    middle: parseFloat(price.toFixed(4)),
    lower: parseFloat((price * 0.95).toFixed(4)),
    pricePosition: parseFloat((0.3 + seed * 0.4).toFixed(4)),
  };
  const kdj = {
    k: parseFloat((40 + seed * 30).toFixed(4)),
    d: parseFloat((35 + seed * 35).toFixed(4)),
    j: parseFloat((45 + seed * 25).toFixed(4)),
  };
  const macd = {
    macd: parseFloat(macdVal.toFixed(4)),
    signal: parseFloat(signalVal.toFixed(4)),
    histogram: parseFloat((macdVal - signalVal).toFixed(4)),
  };

  // 新增指标模拟数据
  const atrValue = price * 0.02 * (0.5 + seed);
  const sar = {
    sar: parseFloat((price * (0.97 + seed * 0.06)).toFixed(4)),
    trend: seed > 0.4 ? 'up' as const : 'down' as const,
    signal: seed > 0.4 ? 'BULLISH' : 'BEARISH',
  };
  const supertrend = {
    value: parseFloat((price * (0.96 + seed * 0.04)).toFixed(4)),
    trend: seed > 0.45 ? 'up' as const : 'down' as const,
    signal: seed > 0.45 ? 'BULLISH' : 'BEARISH',
  };
  const cci = {
    value: parseFloat(((seed - 0.5) * 300).toFixed(4)),
    signal: seed > 0.7 ? 'OVERBOUGHT' : seed < 0.3 ? 'OVERSOLD' : seed > 0.5 ? 'BULLISH' : 'BEARISH',
  };
  const williamsR = {
    value: parseFloat((-100 * (1 - seed)).toFixed(4)),
    signal: seed > 0.8 ? 'OVERBOUGHT' : seed < 0.2 ? 'OVERSOLD' : seed > 0.5 ? 'BULLISH' : 'BEARISH',
  };
  const obv = {
    value: parseFloat(((seed - 0.5) * 10000000).toFixed(0)),
    signal: seed > 0.6 ? 'BULLISH_CONFIRM' : seed < 0.4 ? 'BEARISH_CONFIRM' : 'NEUTRAL',
  };
  const mfi = {
    value: parseFloat((20 + seed * 60).toFixed(4)),
    signal: seed > 0.8 ? 'OVERBOUGHT' : seed < 0.2 ? 'OVERSOLD' : seed > 0.5 ? 'BULLISH' : 'BEARISH',
  };
  const adxInd = {
    adx: parseFloat((10 + seed * 40).toFixed(4)),
    plusDi: parseFloat((15 + seed * 20).toFixed(4)),
    minusDi: parseFloat((35 - seed * 20).toFixed(4)),
    signal: seed > 0.6 ? 'TRENDING' : seed > 0.8 ? 'STRONG_TREND' : 'NO_TREND',
  };
  const atrInd = {
    value: parseFloat(atrValue.toFixed(4)),
  };
  const ichimoku = {
    tenkan: parseFloat((price * 0.99 + seed * price * 0.02).toFixed(4)),
    kijun: parseFloat((price * 0.97 + seed * price * 0.03).toFixed(4)),
    senkouA: parseFloat((price * 0.98 + seed * price * 0.02).toFixed(4)),
    senkouB: parseFloat((price * 0.96 + seed * price * 0.04).toFixed(4)),
    chikou: parseFloat(price.toFixed(4)),
    signal: seed > 0.5 ? 'BULLISH' : 'BEARISH',
  };

  return {
    symbol,
    price: parseFloat(price.toFixed(2)),
    // 扁平结构（兼容前端）
    rsi: parseFloat(rsi.toFixed(2)),
    rsiSignal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
    macd,
    bollingerBands,
    kdj,
    ma: {
      ma5: parseFloat(sma([price * 0.97, price * 0.98, price * 0.99, price * 1.0, price], 5).toFixed(2)),
      ma10: parseFloat(sma([price * 0.95, price * 0.96, price * 0.97, price * 0.98, price * 0.99, price * 1.0, price * 1.01, price, price * 0.99, price], 10).toFixed(2)),
      ma20: parseFloat((price * 0.97).toFixed(2)),
      ma60: parseFloat((price * 0.93).toFixed(2)),
    },
    volumeRatio: parseFloat((0.8 + seed * 0.6).toFixed(4)),
    // 新增指标（扁平结构）
    sar,
    supertrend,
    cci,
    williamsR,
    obv,
    mfi,
    adx: adxInd,
    atr: atrInd,
    ichimoku,
    // 嵌套结构（向后兼容）
    indicators: {
      rsi: {
        value: parseFloat(rsi.toFixed(2)),
        period: 14,
        signal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
      },
      macd: {
        ...macd,
        trend: macdVal > signalVal ? 'bullish' : 'bearish',
      },
      bollinger: bollingerBands,
      kdj,
      ma: {
        ma5: parseFloat(sma([price * 0.97, price * 0.98, price * 0.99, price * 1.0, price], 5).toFixed(2)),
        ma10: parseFloat(sma([price * 0.95, price * 0.96, price * 0.97, price * 0.98, price * 0.99, price * 1.0, price * 1.01, price, price * 0.99, price], 10).toFixed(2)),
        ma20: parseFloat((price * 0.97).toFixed(2)),
        ma60: parseFloat((price * 0.93).toFixed(2)),
      },
      volumeRatio: parseFloat((0.8 + seed * 0.6).toFixed(4)),
      // 新增指标
      sar,
      supertrend,
      cci,
      williamsR,
      obv,
      mfi,
      adx: adxInd,
      atr: atrInd,
      ichimoku,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // 尝试获取真实K线数据进行指标计算
    const klineData = await fetchKlineData(symbol);

    if (klineData && klineData.closes.length > 30) {
      const { closes, highs, lows, volumes, source } = klineData;
      const currentPrice = closes[closes.length - 1];

      // 原有指标
      const rsi = calculateRSI(closes);
      const macd = calculateMACD(closes);
      const bollinger = calculateBollingerBands(closes);
      const kdj = calculateKDJ(highs, lows, closes);
      const volumeRatio = calculateVolumeRatio(volumes);

      // 新增指标
      const sar = calculateSAR(highs, lows, closes);
      const atr = { value: calculateATR(highs, lows, closes) };
      const supertrend = calculateSupertrend(highs, lows, closes);
      const cci = calculateCCI(highs, lows, closes);
      const williamsR = calculateWilliamsR(highs, lows, closes);
      const obv = calculateOBV(closes, volumes);
      const mfi = calculateMFI(highs, lows, closes, volumes);
      const adxInd = calculateADX(highs, lows, closes);
      const ichimoku = closes.length >= 52
        ? calculateIchimoku(highs, lows, closes)
        : { tenkan: 0, kijun: 0, senkouA: 0, senkouB: 0, chikou: 0, signal: 'NEUTRAL' };

      return NextResponse.json({
        symbol,
        price: parseFloat(currentPrice.toFixed(2)),
        source,
        // 扁平结构（兼容前端）
        rsi,
        rsiSignal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
        macd,
        bollingerBands: bollinger,
        kdj,
        ma: {
          ma5: parseFloat(sma(closes, 5).toFixed(2)),
          ma10: parseFloat(sma(closes, 10).toFixed(2)),
          ma20: parseFloat(sma(closes, 20).toFixed(2)),
          ma60: parseFloat(sma(closes, Math.min(60, closes.length)).toFixed(2)),
        },
        volumeRatio,
        // 新增指标
        sar,
        supertrend,
        cci,
        williamsR,
        obv,
        mfi,
        adx: adxInd,
        atr,
        ichimoku,
        // 嵌套结构（向后兼容）
        indicators: {
          rsi: {
            value: rsi,
            period: 14,
            signal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
          },
          macd: {
            ...macd,
            trend: macd.macd > macd.signal ? 'bullish' : 'bearish',
          },
          bollinger,
          kdj,
          ma: {
            ma5: parseFloat(sma(closes, 5).toFixed(2)),
            ma10: parseFloat(sma(closes, 10).toFixed(2)),
            ma20: parseFloat(sma(closes, 20).toFixed(2)),
            ma60: parseFloat(sma(closes, Math.min(60, closes.length)).toFixed(2)),
          },
          volumeRatio,
          sar,
          supertrend,
          cci,
          williamsR,
          obv,
          mfi,
          adx: adxInd,
          atr,
          ichimoku,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 回退到模拟指标
    const fallbackResult = generateFallbackIndicators(symbol);
    fallbackResult.source = 'fallback';
    return NextResponse.json(fallbackResult);
  } catch (error) {
    console.error('[fusion/indicators] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate indicators' },
      { status: 500 }
    );
  }
}
