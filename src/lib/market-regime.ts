/**
 * 市场状态检测器
 * 基于MA斜率 + ATR波动率 + ADX趋势强度判断市场状态
 * 纯算法实现，不依赖AI
 */

import type { MarketRegime } from './strategy-config';

/** K线数据接口 */
export interface KlineData {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

/** 市场状态检测结果 */
export interface MarketRegimeResult {
  /** 市场状态 */
  regime: MarketRegime;
  /** 置信度 0-100 */
  confidence: number;
  /** 趋势强度（ADX值） */
  trendStrength: number;
  /** 波动率（ATR/价格的百分比） */
  volatility: number;
  /** MA斜率方向 -1/0/1 */
  maSlopeDirection: number;
  /** 各指标详情 */
  details: {
    maSlope: number;
    atrPct: number;
    adx: number;
  };
}

/**
 * 计算简单移动平均
 */
function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(data[i]);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    result.push(sum / period);
  }
  return result;
}

/**
 * 计算ATR（平均真实波幅）
 */
function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const trueRanges: number[] = [];
  for (let i = 0; i < highs.length; i++) {
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
  // 平滑
  const atrValues: number[] = [];
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      atrValues.push(trueRanges[i]);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += trueRanges[j];
      atrValues.push(sum / period);
    } else {
      atrValues.push((atrValues[i - 1] * (period - 1) + trueRanges[i]) / period);
    }
  }
  return atrValues;
}

/**
 * 计算ADX（平均趋向指数）- 简化版
 */
function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trValues: number[] = [];

  // 第一步：计算+DM, -DM, TR
  plusDM.push(0);
  minusDM.push(0);
  trValues.push(highs[0] - lows[0]);

  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    trValues.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  // 第二步：平滑
  function smooth(values: number[], p: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < p - 1) {
        result.push(0);
      } else if (i === p - 1) {
        let sum = 0;
        for (let j = 0; j < p; j++) sum += values[j];
        result.push(sum);
      } else {
        result.push(result[i - 1] - result[i - 1] / p + values[i]);
      }
    }
    return result;
  }

  const smoothPlusDM = smooth(plusDM, period);
  const smoothMinusDM = smooth(minusDM, period);
  const smoothTR = smooth(trValues, period);

  // 第三步：计算+DI, -DI
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < smoothTR.length; i++) {
    const pdi = smoothTR[i] > 0 ? (smoothPlusDM[i] / smoothTR[i]) * 100 : 0;
    const mdi = smoothTR[i] > 0 ? (smoothMinusDM[i] / smoothTR[i]) * 100 : 0;
    plusDI.push(pdi);
    minusDI.push(mdi);

    const diSum = pdi + mdi;
    const diDiff = Math.abs(pdi - mdi);
    dx.push(diSum > 0 ? (diDiff / diSum) * 100 : 0);
  }

  // 第四步：ADX = DX的移动平均
  const adxValues: number[] = [];
  for (let i = 0; i < dx.length; i++) {
    if (i < 2 * period - 1) {
      adxValues.push(dx[i]);
    } else if (i === 2 * period - 1) {
      let sum = 0;
      for (let j = period - 1; j <= i; j++) sum += dx[j];
      adxValues.push(sum / period);
    } else {
      adxValues.push((adxValues[i - 1] * (period - 1) + dx[i]) / period);
    }
  }

  return adxValues;
}

/**
 * 计算MA斜率
 * 返回MA最近N根K线的线性回归斜率
 */
function calculateMASlope(maValues: number[], lookback: number = 5): number {
  const len = maValues.length;
  if (len < lookback) return 0;

  const recentValues = maValues.slice(-lookback);
  // 简单线性回归斜率
  const n = recentValues.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentValues[i];
    sumXY += i * recentValues[i];
    sumXX += i * i;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) return 0;
  const slope = (n * sumXY - sumX * sumY) / denominator;

  // 归一化为百分比
  const avgPrice = sumY / n;
  if (avgPrice === 0) return 0;
  return (slope / avgPrice) * 100;
}

/**
 * 检测市场状态
 * @param kline K线数据
 * @returns 市场状态检测结果
 */
export function detectMarketRegime(kline: KlineData): MarketRegimeResult {
  const { closes, highs, lows } = kline;

  // 数据不足时返回默认值
  if (closes.length < 30) {
    return {
      regime: 'range_bound',
      confidence: 30,
      trendStrength: 0,
      volatility: 0,
      maSlopeDirection: 0,
      details: { maSlope: 0, atrPct: 0, adx: 0 },
    };
  }

  // 1. 计算MA20
  const ma20 = sma(closes, 20);

  // 2. 计算MA斜率
  const maSlope = calculateMASlope(ma20, 5);

  // 3. 计算ATR波动率
  const atrValues = calculateATR(highs, lows, closes, 14);
  const currentATR = atrValues[atrValues.length - 1] || 0;
  const currentPrice = closes[closes.length - 1] || 1;
  const atrPct = (currentATR / currentPrice) * 100; // ATR占价格的百分比

  // 4. 计算ADX
  const adxValues = calculateADX(highs, lows, closes, 14);
  const currentADX = adxValues[adxValues.length - 1] || 0;

  // 5. 判断市场状态
  let regime: MarketRegime;
  let confidence = 50;

  // 波动率阈值：ATR/Price > 2% 视为高波动
  const isVolatile = atrPct > 2.0;
  // ADX > 25 视为有趋势
  const hasTrend = currentADX > 25;
  // MA斜率阈值：|slope| > 0.1% 视为有方向
  const slopeThreshold = 0.1;

  if (isVolatile && !hasTrend) {
    // 高波动但无明确趋势
    regime = 'volatile';
    confidence = Math.min(90, 50 + (atrPct - 2.0) * 20 + (25 - currentADX) * 1.5);
  } else if (hasTrend) {
    // 有趋势
    if (maSlope > slopeThreshold) {
      regime = 'trending_up';
      confidence = Math.min(90, 50 + (currentADX - 25) * 1.5 + Math.min(maSlope * 10, 20));
    } else if (maSlope < -slopeThreshold) {
      regime = 'trending_down';
      confidence = Math.min(90, 50 + (currentADX - 25) * 1.5 + Math.min(Math.abs(maSlope) * 10, 20));
    } else {
      // ADX高但MA斜率不明确，可能是震荡
      regime = 'range_bound';
      confidence = Math.min(70, 40 + (25 - Math.abs(maSlope) * 100) * 0.5);
    }
  } else {
    // 低波动且无趋势 -> 震荡
    regime = 'range_bound';
    confidence = Math.min(80, 50 + (25 - currentADX) * 1.2 + (2.0 - atrPct) * 10);
  }

  // MA斜率方向
  const maSlopeDirection = maSlope > slopeThreshold ? 1 : maSlope < -slopeThreshold ? -1 : 0;

  return {
    regime,
    confidence: Math.round(Math.max(20, Math.min(95, confidence))),
    trendStrength: parseFloat(currentADX.toFixed(2)),
    volatility: parseFloat(atrPct.toFixed(4)),
    maSlopeDirection,
    details: {
      maSlope: parseFloat(maSlope.toFixed(4)),
      atrPct: parseFloat(atrPct.toFixed(4)),
      adx: parseFloat(currentADX.toFixed(2)),
    },
  };
}
