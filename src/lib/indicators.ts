/**
 * Technical Indicator Calculations
 * Pure functions for computing common trading indicators
 */

/**
 * Calculate Simple Moving Average
 */
function sma(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

/**
 * Calculate Exponential Moving Average
 */
function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss over the period
 */
export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50; // Neutral if not enough data

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  if (gains.length < period) return 50;

  // Calculate initial average gain/loss
  let avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;

  // Smooth using Wilder's method
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * MACD Line = EMA(fast) - EMA(slow)
 * Signal Line = EMA(MACD Line, signal period)
 * Histogram = MACD - Signal
 */
export function calculateMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: number; signal: number; histogram: number; prevMacd: number; prevSignal: number } {
  const defaultResult = { macd: 0, signal: 0, histogram: 0, prevMacd: 0, prevSignal: 0 };

  if (closes.length < slow + signal) return defaultResult;

  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  const signalLine = ema(macdLine, signal);

  const lastIdx = closes.length - 1;
  const prevIdx = lastIdx - 1;

  const macd = macdLine[lastIdx];
  const signalVal = signalLine[lastIdx];
  const prevMacd = prevIdx >= 0 ? macdLine[prevIdx] : 0;
  const prevSignal = prevIdx >= 0 ? signalLine[prevIdx] : 0;

  return {
    macd: parseFloat(macd.toFixed(4)),
    signal: parseFloat(signalVal.toFixed(4)),
    histogram: parseFloat((macd - signalVal).toFixed(4)),
    prevMacd: parseFloat(prevMacd.toFixed(4)),
    prevSignal: parseFloat(prevSignal.toFixed(4)),
  };
}

/**
 * Calculate Bollinger Bands
 * Middle = SMA(period)
 * Upper = Middle + numStd * StdDev
 * Lower = Middle - numStd * StdDev
 * pricePosition = where current price sits within the bands (0-1)
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  numStd: number = 2
): { upper: number; middle: number; lower: number; pricePosition: number } {
  const defaultResult = { upper: 0, middle: 0, lower: 0, pricePosition: 0.5 };

  if (closes.length < period) return defaultResult;

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

/**
 * Calculate KDJ Indicator
 * K = (2/3) * prevK + (1/3) * RSV
 * D = (2/3) * prevD + (1/3) * K
 * J = 3 * K - 2 * D
 * RSV = (Close - LowestLow) / (HighestHigh - LowestLow) * 100
 */
export function calculateKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  n: number = 9,
  m1: number = 3,
  m2: number = 3
): { k: number; d: number; j: number; prevK: number; prevD: number } {
  const defaultResult = { k: 50, d: 50, j: 50, prevK: 50, prevD: 50 };

  if (closes.length < n || highs.length < n || lows.length < n) return defaultResult;

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
    prevK: parseFloat(prevK.toFixed(4)),
    prevD: parseFloat(prevD.toFixed(4)),
  };
}

/**
 * Calculate Volume Ratio
 * Volume Ratio = Current Volume / Average Volume (over period)
 */
export function calculateVolumeRatio(volumes: number[], period: number = 5): number {
  if (volumes.length < 2) return 1;

  const currentVolume = volumes[volumes.length - 1];
  const avgSlice = volumes.slice(-period - 1, -1);
  const avgVolume = avgSlice.length > 0
    ? avgSlice.reduce((s, v) => s + v, 0) / avgSlice.length
    : currentVolume;

  if (avgVolume === 0) return 1;
  return parseFloat((currentVolume / avgVolume).toFixed(4));
}
