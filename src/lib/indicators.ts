/**
 * 技术指标计算库 - QuantFusion
 * 纯函数实现常用交易指标计算
 * 包含: RSI, MACD, 布林带, KDJ, 量比, MA
 * 新增: SAR, Supertrend, CCI, Williams%R, OBV, MFI, ADX, ATR, Ichimoku
 */

// ============================================================
// 基础辅助函数
// ============================================================

/**
 * 计算简单移动平均
 */
function sma(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

/**
 * 计算指数移动平均（返回完整数组）
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

// ============================================================
// 原有指标
// ============================================================

/**
 * RSI (相对强弱指数)
 * RSI = 100 - (100 / (1 + RS))
 * RS = 平均涨幅 / 平均跌幅
 */
export function calculateRSI(closes: number[], period: number = 14): number {
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
  return 100 - 100 / (1 + rs);
}

/**
 * MACD (移动平均收敛/发散)
 * MACD线 = EMA(快) - EMA(慢)
 * 信号线 = EMA(MACD线, 信号周期)
 * 柱状 = MACD - 信号
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
 * 布林带
 * 中轨 = SMA(period)
 * 上轨 = 中轨 + numStd * 标准差
 * 下轨 = 中轨 - numStd * 标准差
 * pricePosition = 价格在带内的位置 (0-1)
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
 * KDJ 指标
 * K = (2/3) * 前K + (1/3) * RSV
 * D = (2/3) * 前D + (1/3) * K
 * J = 3 * K - 2 * D
 * RSV = (收盘 - 最低价) / (最高价 - 最低价) * 100
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
 * 量比
 * 量比 = 当前成交量 / 平均成交量
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

// ============================================================
// 新增指标
// ============================================================

/**
 * SAR (抛物线指标)
 * 用于判断趋势方向和设置止损位
 * AF从0.02开始，最高0.2，每次创新高/低增加0.02
 */
export function calculateSAR(
  highs: number[],
  lows: number[],
  closes: number[],
  afStep: number = 0.02,
  afMax: number = 0.2
): { sar: number; trend: 'up' | 'down'; signal: string } {
  const defaultResult = { sar: 0, trend: 'up' as const, signal: 'NEUTRAL' };

  if (closes.length < 5 || highs.length < 5 || lows.length < 5) {
    return defaultResult;
  }

  // 初始化：使用前几根K线判断初始趋势
  let isUpTrend = closes[closes.length - 1] > closes[0];
  let af = afStep;
  let sar: number;
  let ep: number; // 极值点

  if (isUpTrend) {
    sar = Math.min(...lows.slice(0, 5));
    ep = Math.max(...highs.slice(0, 5));
  } else {
    sar = Math.max(...highs.slice(0, 5));
    ep = Math.min(...lows.slice(0, 5));
  }

  // 逐根计算SAR
  for (let i = 5; i < closes.length; i++) {
    // 计算SAR
    sar = sar + af * (ep - sar);

    if (isUpTrend) {
      // 上升趋势
      if (lows[i] < sar) {
        // 趋势翻转
        isUpTrend = false;
        sar = ep;
        ep = lows[i];
        af = afStep;
      } else {
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + afStep, afMax);
        }
        // SAR不能高于前两根K线的最低价
        const prevLow1 = i >= 1 ? lows[i - 1] : lows[i];
        const prevLow2 = i >= 2 ? lows[i - 2] : prevLow1;
        sar = Math.min(sar, prevLow1, prevLow2);
      }
    } else {
      // 下降趋势
      if (highs[i] > sar) {
        // 趋势翻转
        isUpTrend = true;
        sar = ep;
        ep = highs[i];
        af = afStep;
      } else {
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + afStep, afMax);
        }
        // SAR不能低于前两根K线的最高价
        const prevHigh1 = i >= 1 ? highs[i - 1] : highs[i];
        const prevHigh2 = i >= 2 ? highs[i - 2] : prevHigh1;
        sar = Math.max(sar, prevHigh1, prevHigh2);
      }
    }
  }

  const currentPrice = closes[closes.length - 1];
  const trend = isUpTrend ? 'up' as const : 'down' as const;

  // 信号判断
  let signal = 'NEUTRAL';
  if (isUpTrend && currentPrice > sar) {
    signal = 'BULLISH';
  } else if (!isUpTrend && currentPrice < sar) {
    signal = 'BEARISH';
  }

  return {
    sar: parseFloat(sar.toFixed(4)),
    trend,
    signal,
  };
}

/**
 * Supertrend (超级趋势指标)
 * 基于ATR的趋势跟踪指标
 * 上轨 = (最高+最低)/2 + 乘数*ATR
 * 下轨 = (最高+最低)/2 - 乘数*ATR
 */
export function calculateSupertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3
): { value: number; trend: 'up' | 'down'; signal: string } {
  const defaultResult = { value: 0, trend: 'up' as const, signal: 'NEUTRAL' };

  if (closes.length < period + 1 || highs.length < period || lows.length < period) {
    return defaultResult;
  }

  // 先计算ATR
  const atr = calculateATR(highs, lows, closes, period);
  if (atr <= 0) return defaultResult;

  // 计算基础通道
  const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
  const upperBand = hl2 + multiplier * atr;
  const lowerBand = hl2 - multiplier * atr;

  // 简化：用当前价格判断趋势
  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];

  // 逐步计算Supertrend（简化版本）
  let supertrend = lowerBand;
  let trend: 'up' | 'down' = 'up';
  let prevUpperBand = upperBand;
  let prevLowerBand = lowerBand;

  for (let i = period; i < closes.length; i++) {
    const currentHl2 = (highs[i] + lows[i]) / 2;
    const currentAtr = calculateATRFromSlice(highs, lows, closes, i, period);
    if (currentAtr <= 0) continue;

    const currentUpperBand = currentHl2 + multiplier * currentAtr;
    const currentLowerBand = currentHl2 - multiplier * currentAtr;

    // Supertrend逻辑
    let finalLower = currentLowerBand;
    let finalUpper = currentUpperBand;

    if (prevLowerBand > 0 && closes[i - 1] > prevLowerBand) {
      finalLower = Math.max(currentLowerBand, prevLowerBand);
    }
    if (prevUpperBand > 0 && closes[i - 1] < prevUpperBand) {
      finalUpper = Math.min(currentUpperBand, prevUpperBand);
    }

    if (trend === 'up') {
      if (closes[i] < finalLower) {
        trend = 'down';
        supertrend = finalUpper;
      } else {
        supertrend = finalLower;
      }
    } else {
      if (closes[i] > finalUpper) {
        trend = 'up';
        supertrend = finalLower;
      } else {
        supertrend = finalUpper;
      }
    }

    prevUpperBand = finalUpper;
    prevLowerBand = finalLower;
  }

  let signal = 'NEUTRAL';
  if (trend === 'up') {
    signal = currentPrice > supertrend ? 'BULLISH' : 'NEUTRAL';
  } else {
    signal = currentPrice < supertrend ? 'BEARISH' : 'NEUTRAL';
  }

  return {
    value: parseFloat(supertrend.toFixed(4)),
    trend,
    signal,
  };
}

/**
 * CCI (商品通道指数)
 * CCI = (TP - SMA(TP)) / (0.015 * MeanDev)
 * TP = (最高+最低+收盘)/3
 */
export function calculateCCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): { value: number; signal: string } {
  const defaultResult = { value: 0, signal: 'NEUTRAL' };

  if (closes.length < period || highs.length < period || lows.length < period) {
    return defaultResult;
  }

  // 计算典型价格(TP)数组
  const tp: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  // 计算最近period根K线的CCI
  const tpSlice = tp.slice(-period);
  const tpSma = tpSlice.reduce((s, v) => s + v, 0) / period;
  const meanDev = tpSlice.reduce((s, v) => s + Math.abs(v - tpSma), 0) / period;

  if (meanDev === 0) return defaultResult;

  const cci = (tp[tp.length - 1] - tpSma) / (0.015 * meanDev);

  // 信号判断
  let signal = 'NEUTRAL';
  if (cci > 100) signal = 'OVERBOUGHT';
  else if (cci < -100) signal = 'OVERSOLD';
  else if (cci > 0) signal = 'BULLISH';
  else signal = 'BEARISH';

  return {
    value: parseFloat(cci.toFixed(4)),
    signal,
  };
}

/**
 * Williams %R (威廉指标)
 * %R = (HighestHigh - Close) / (HighestHigh - LowestLow) * -100
 * 范围: -100 到 0
 * 超买: > -20, 超卖: < -80
 */
export function calculateWilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { value: number; signal: string } {
  const defaultResult = { value: -50, signal: 'NEUTRAL' };

  if (closes.length < period || highs.length < period || lows.length < period) {
    return defaultResult;
  }

  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highestHigh = Math.max(...highSlice);
  const lowestLow = Math.min(...lowSlice);
  const currentClose = closes[closes.length - 1];

  if (highestHigh === lowestLow) return defaultResult;

  const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;

  let signal = 'NEUTRAL';
  if (williamsR > -20) signal = 'OVERBOUGHT';
  else if (williamsR < -80) signal = 'OVERSOLD';
  else if (williamsR > -50) signal = 'BULLISH';
  else signal = 'BEARISH';

  return {
    value: parseFloat(williamsR.toFixed(4)),
    signal,
  };
}

/**
 * OBV (能量潮指标)
 * OBV += volume (if close > prev_close)
 * OBV -= volume (if close < prev_close)
 * 用于确认价格趋势和发现背离
 */
export function calculateOBV(
  closes: number[],
  volumes: number[]
): { value: number; signal: string } {
  const defaultResult = { value: 0, signal: 'NEUTRAL' };

  if (closes.length < 2 || volumes.length < 2) return defaultResult;

  // 计算完整OBV序列
  const obvArray: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obvArray.push(obvArray[i - 1] + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      obvArray.push(obvArray[i - 1] - volumes[i]);
    } else {
      obvArray.push(obvArray[i - 1]);
    }
  }

  const currentOBV = obvArray[obvArray.length - 1];

  // 信号判断：比较OBV和价格的5日趋势
  let signal = 'NEUTRAL';
  if (obvArray.length >= 5) {
    const obvRecent = obvArray.slice(-5);
    const priceRecent = closes.slice(-5);
    const obvTrend = obvRecent[obvRecent.length - 1] - obvRecent[0];
    const priceTrend = priceRecent[priceRecent.length - 1] - priceRecent[0];

    if (obvTrend > 0 && priceTrend > 0) {
      signal = 'BULLISH_CONFIRM'; // 量价齐升
    } else if (obvTrend < 0 && priceTrend < 0) {
      signal = 'BEARISH_CONFIRM'; // 量价齐跌
    } else if (obvTrend > 0 && priceTrend <= 0) {
      signal = 'BULLISH_DIVERGENCE'; // 底背离
    } else if (obvTrend < 0 && priceTrend >= 0) {
      signal = 'BEARISH_DIVERGENCE'; // 顶背离
    }
  }

  return {
    value: parseFloat(currentOBV.toFixed(0)),
    signal,
  };
}

/**
 * MFI (资金流量指数)
 * MF = TP * Volume
 * MFI = 100 - (100 / (1 + 正MF/负MF))
 * 范围: 0-100, 超买>80, 超卖<20
 */
export function calculateMFI(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14
): { value: number; signal: string } {
  const defaultResult = { value: 50, signal: 'NEUTRAL' };

  if (closes.length < period + 1 || highs.length < period + 1 || lows.length < period + 1 || volumes.length < period + 1) {
    return defaultResult;
  }

  // 计算典型价格和资金流量
  const tp: number[] = [];
  const mf: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
    mf.push(tp[i] * volumes[i]);
  }

  // 计算正/负资金流量
  let positiveMF = 0;
  let negativeMF = 0;
  for (let i = tp.length - period; i < tp.length; i++) {
    if (tp[i] > tp[i - 1]) {
      positiveMF += mf[i];
    } else {
      negativeMF += mf[i];
    }
  }

  if (negativeMF === 0) return { value: 100, signal: 'OVERBOUGHT' };

  const mfi = 100 - (100 / (1 + positiveMF / negativeMF));

  let signal = 'NEUTRAL';
  if (mfi > 80) signal = 'OVERBOUGHT';
  else if (mfi < 20) signal = 'OVERSOLD';
  else if (mfi > 50) signal = 'BULLISH';
  else signal = 'BEARISH';

  return {
    value: parseFloat(mfi.toFixed(4)),
    signal,
  };
}

/**
 * ADX (平均趋向指数)
 * 衡量趋势强度（不判断方向）
 * ADX > 25: 趋势明确, ADX < 20: 无明确趋势
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { adx: number; plusDi: number; minusDi: number; signal: string } {
  const defaultResult = { adx: 0, plusDi: 0, minusDi: 0, signal: 'NO_TREND' };

  if (closes.length < period * 2 || highs.length < period * 2 || lows.length < period * 2) {
    return defaultResult;
  }

  // 计算真实波幅、+DM、-DM
  const trList: number[] = [];
  const plusDMList: number[] = [];
  const minusDMList: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trList.push(tr);

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDMList.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMList.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // 用Wilder平滑计算
  let smoothedTR = trList.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothedPlusDM = plusDMList.slice(0, period).reduce((s, v) => s + v, 0);
  let smoothedMinusDM = minusDMList.slice(0, period).reduce((s, v) => s + v, 0);

  // DX数组
  const dxArray: number[] = [];

  for (let i = period; i < trList.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + trList[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMList[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMList[i];

    const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? Math.abs(plusDI - minusDI) / diSum * 100 : 0;
    dxArray.push(dx);
  }

  // 计算ADX
  let adx = dxArray.length >= period
    ? dxArray.slice(0, period).reduce((s, v) => s + v, 0) / period
    : 0;

  for (let i = period; i < dxArray.length; i++) {
    adx = (adx * (period - 1) + dxArray[i]) / period;
  }

  // 当前+DI/-DI
  const plusDi = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
  const minusDi = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

  // 信号判断
  let signal = 'NO_TREND';
  if (adx > 50) signal = 'STRONG_TREND';
  else if (adx > 25) signal = 'TRENDING';
  else if (adx < 20) signal = 'NO_TREND';

  return {
    adx: parseFloat(adx.toFixed(4)),
    plusDi: parseFloat(plusDi.toFixed(4)),
    minusDi: parseFloat(minusDi.toFixed(4)),
    signal,
  };
}

/**
 * ATR (真实波幅)
 * TR = max(H-L, |H-prevC|, |L-prevC|)
 * ATR = SMA(TR, period)
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number {
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

  // Wilder平滑
  let atr = trList.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trList.length; i++) {
    atr = (atr * (period - 1) + trList[i]) / period;
  }

  return parseFloat(atr.toFixed(4));
}

/**
 * 辅助函数：从切片计算ATR（给Supertrend使用）
 */
function calculateATRFromSlice(
  highs: number[],
  lows: number[],
  closes: number[],
  endIndex: number,
  period: number
): number {
  if (endIndex < period) return 0;

  const trList: number[] = [];
  const startIdx = Math.max(1, endIndex - period * 2);
  for (let i = startIdx; i <= endIndex; i++) {
    trList.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  if (trList.length < period) {
    return trList.length > 0 ? trList.reduce((s, v) => s + v, 0) / trList.length : 0;
  }

  let atr = trList.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trList.length; i++) {
    atr = (atr * (period - 1) + trList[i]) / period;
  }

  return parseFloat(atr.toFixed(4));
}

/**
 * Ichimoku Cloud (一目均衡表)
 * 转换线 = (9日最高 + 9日最低) / 2
 * 基准线 = (26日最高 + 26日最低) / 2
 * 先行带A = (转换线 + 基准线) / 2
 * 先行带B = (52日最高 + 52日最低) / 2
 */
export function calculateIchimoku(
  highs: number[],
  lows: number[],
  closes: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): {
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  chikou: number;
  signal: string;
} {
  const defaultResult = {
    tenkan: 0, kijun: 0, senkouA: 0, senkouB: 0, chikou: 0, signal: 'NEUTRAL',
  };

  if (closes.length < senkouBPeriod || highs.length < senkouBPeriod || lows.length < senkouBPeriod) {
    return defaultResult;
  }

  // 转换线 (Tenkan-sen)
  const tenkanHigh = Math.max(...highs.slice(-tenkanPeriod));
  const tenkanLow = Math.min(...lows.slice(-tenkanPeriod));
  const tenkan = (tenkanHigh + tenkanLow) / 2;

  // 基准线 (Kijun-sen)
  const kijunHigh = Math.max(...highs.slice(-kijunPeriod));
  const kijunLow = Math.min(...lows.slice(-kijunPeriod));
  const kijun = (kijunHigh + kijunLow) / 2;

  // 先行带A (Senkou Span A)
  const senkouA = (tenkan + kijun) / 2;

  // 先行带B (Senkou Span B)
  const senkouBHigh = Math.max(...highs.slice(-senkouBPeriod));
  const senkouBLow = Math.min(...lows.slice(-senkouBPeriod));
  const senkouB = (senkouBHigh + senkouBLow) / 2;

  // 迟行线 (Chikou Span) = 当前收盘价
  const chikou = closes[closes.length - 1];

  // 信号判断
  const currentPrice = closes[closes.length - 1];
  let signal = 'NEUTRAL';

  // 价格在云层之上且转换线>基准线 → 看多
  if (currentPrice > Math.max(senkouA, senkouB) && tenkan > kijun) {
    signal = 'STRONG_BULLISH';
  } else if (currentPrice > Math.max(senkouA, senkouB)) {
    signal = 'BULLISH';
  }
  // 价格在云层之下且转换线<基准线 → 看空
  else if (currentPrice < Math.min(senkouA, senkouB) && tenkan < kijun) {
    signal = 'STRONG_BEARISH';
  } else if (currentPrice < Math.min(senkouA, senkouB)) {
    signal = 'BEARISH';
  }
  // 价格在云层内 → 震荡
  else {
    signal = 'RANGE_BOUND';
  }

  return {
    tenkan: parseFloat(tenkan.toFixed(4)),
    kijun: parseFloat(kijun.toFixed(4)),
    senkouA: parseFloat(senkouA.toFixed(4)),
    senkouB: parseFloat(senkouB.toFixed(4)),
    chikou: parseFloat(chikou.toFixed(4)),
    signal,
  };
}
