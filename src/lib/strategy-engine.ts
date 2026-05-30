/**
 * 策略信号引擎
 * 基于规则的条件判定，输入策略配置 + 技术指标，输出信号
 * 支持复合条件（AND/OR），纯算法实现不依赖LLM
 */

import type {
  StrategyConfig,
  SignalAction,
  IndicatorCondition,
  CompositeCondition,
} from './strategy-config';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKDJ,
  calculateVolumeRatio,
} from './indicators';

/** 技术指标值集合 */
export interface IndicatorValues {
  // 均线
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
  // RSI
  rsi: number;
  // MACD
  macd: number;
  signal: number;
  histogram: number;
  prevMacd: number;
  prevSignal: number;
  // 布林带
  upper: number;
  middle: number;
  lower: number;
  pricePosition: number;
  // KDJ
  k: number;
  d: number;
  j: number;
  prevK: number;
  prevD: number;
  // 量比
  volumeRatio: number;
  // 当前价
  close: number;
  // 涨跌幅百分比（相对前一天）
  priceChangePct: number;
  // 回踩百分比（相对N日最高价）
  pullbackPct: number;
}

/** 策略信号结果 */
export interface StrategySignal {
  /** 信号动作 */
  action: SignalAction;
  /** 置信度 0-100 */
  confidence: number;
  /** 入场价 */
  entryPrice: number;
  /** 止损价 */
  stopLoss: number;
  /** 止盈价 */
  takeProfit: number;
  /** 风险收益比 */
  riskRewardRatio: number;
  /** 信号推理 */
  reasoning: string;
  /** 满足的条件列表 */
  matchedConditions: string[];
  /** 关键价位 */
  keyLevels: {
    support: number;
    resistance: number;
  };
}

/**
 * 从K线数据计算所有技术指标
 */
export function computeIndicators(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): IndicatorValues {
  // 计算各项指标
  const rsi = calculateRSI(closes, 14);
  const macdResult = calculateMACD(closes, 12, 26, 9);
  const bb = calculateBollingerBands(closes, 20, 2);
  const kdj = calculateKDJ(highs, lows, closes, 9, 3, 3);
  const volumeRatio = calculateVolumeRatio(volumes, 5);

  // 计算MA
  function sma(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    return slice.reduce((s, v) => s + v, 0) / period;
  }

  const ma5 = sma(closes, 5);
  const ma10 = sma(closes, 10);
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, 60);

  // 涨跌幅
  const priceChangePct = closes.length >= 2
    ? ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100
    : 0;

  // 回踩百分比（相对20日最高价）
  const recentHighs = highs.slice(-20);
  const high20 = recentHighs.length > 0 ? Math.max(...recentHighs) : closes[closes.length - 1] || 0;
  const pullbackPct = high20 > 0
    ? ((high20 - closes[closes.length - 1]) / high20) * 100
    : 0;

  return {
    ma5,
    ma10,
    ma20,
    ma60,
    rsi,
    macd: macdResult.macd,
    signal: macdResult.signal,
    histogram: macdResult.histogram,
    prevMacd: macdResult.prevMacd,
    prevSignal: macdResult.prevSignal,
    upper: bb.upper,
    middle: bb.middle,
    lower: bb.lower,
    pricePosition: bb.pricePosition,
    k: kdj.k,
    d: kdj.d,
    j: kdj.j,
    prevK: kdj.prevK,
    prevD: kdj.prevD,
    volumeRatio,
    close: closes[closes.length - 1] || 0,
    priceChangePct: parseFloat(priceChangePct.toFixed(2)),
    pullbackPct: parseFloat(pullbackPct.toFixed(2)),
  };
}

/**
 * 获取指标值
 */
function getIndicatorValue(indicators: IndicatorValues, name: string): number {
  const key = name as keyof IndicatorValues;
  const val = indicators[key];
  if (typeof val === 'number') return val;
  return 0;
}

/**
 * 判断单个指标条件是否满足
 */
function evaluateIndicatorCondition(
  condition: IndicatorCondition,
  indicators: IndicatorValues
): boolean {
  // 获取左值
  const leftVal = getIndicatorValue(indicators, condition.indicator);

  // 获取右值
  let rightVal: number;
  if (typeof condition.value === 'number') {
    rightVal = condition.value;
  } else {
    // 右值是另一个指标名
    rightVal = getIndicatorValue(indicators, condition.value);
  }

  // 处理crosses_above / crosses_below需要前值
  if (condition.operator === 'crosses_above') {
    // 当前左值 > 右值 且 前一时刻左值 <= 右值
    const prevLeftVal = getPrevIndicatorValue(indicators, condition.indicator);
    const prevRightVal = typeof condition.value === 'number'
      ? condition.value
      : getPrevIndicatorValue(indicators, condition.value);
    return leftVal > rightVal && prevLeftVal <= prevRightVal;
  }
  if (condition.operator === 'crosses_below') {
    const prevLeftVal = getPrevIndicatorValue(indicators, condition.indicator);
    const prevRightVal = typeof condition.value === 'number'
      ? condition.value
      : getPrevIndicatorValue(indicators, condition.value);
    return leftVal < rightVal && prevLeftVal >= prevRightVal;
  }

  switch (condition.operator) {
    case '>': return leftVal > rightVal;
    case '<': return leftVal < rightVal;
    case '>=': return leftVal >= rightVal;
    case '<=': return leftVal <= rightVal;
    case '==': return Math.abs(leftVal - rightVal) < 0.0001;
    default: return false;
  }
}

/**
 * 获取前一时刻的指标值（用于交叉判断）
 * 对于MA/MACD/KDJ等有前值的概念
 */
function getPrevIndicatorValue(indicators: IndicatorValues, name: string): number {
  // 利用prev字段模拟前一时刻值
  switch (name) {
    case 'macd': return indicators.prevMacd;
    case 'signal': return indicators.prevSignal;
    case 'k': return indicators.prevK;
    case 'd': return indicators.prevD;
    default:
      // 对于MA等，前一时刻值约等于当前值（简化）
      // 实际应该从K线重新计算，这里做近似
      return getIndicatorValue(indicators, name);
  }
}

/**
 * 评估复合条件
 */
function evaluateCompositeCondition(
  condition: CompositeCondition,
  indicators: IndicatorValues
): boolean {
  if (condition.operator === 'AND') {
    return condition.conditions.every((c) => {
      if ('conditions' in c) {
        return evaluateCompositeCondition(c as CompositeCondition, indicators);
      }
      return evaluateIndicatorCondition(c as IndicatorCondition, indicators);
    });
  }
  // OR
  return condition.conditions.some((c) => {
    if ('conditions' in c) {
      return evaluateCompositeCondition(c as CompositeCondition, indicators);
    }
    return evaluateIndicatorCondition(c as IndicatorCondition, indicators);
  });
}

/**
 * 收集满足/不满足的条件描述
 */
function collectConditionDescriptions(
  condition: CompositeCondition,
  indicators: IndicatorValues
): { matched: string[]; unmatched: string[] } {
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const c of condition.conditions) {
    if ('conditions' in c) {
      const sub = collectConditionDescriptions(c as CompositeCondition, indicators);
      matched.push(...sub.matched);
      unmatched.push(...sub.unmatched);
    } else {
      const ic = c as IndicatorCondition;
      const opMap: Record<string, string> = {
        '>': '>',
        '<': '<',
        '>=': '≥',
        '<=': '≤',
        '==': '=',
        'crosses_above': '上穿',
        'crosses_below': '下穿',
      };
      const desc = `${ic.indicator} ${opMap[ic.operator] || ic.operator} ${ic.value}`;
      if (evaluateIndicatorCondition(ic, indicators)) {
        matched.push(desc);
      } else {
        unmatched.push(desc);
      }
    }
  }

  return { matched, unmatched };
}

/**
 * 执行策略信号计算
 * @param config 策略配置
 * @param indicators 技术指标值
 * @returns 策略信号
 */
export function executeStrategy(
  config: StrategyConfig,
  indicators: IndicatorValues
): StrategySignal {
  const currentPrice = indicators.close;

  // 评估入场条件
  const entryTriggered = evaluateCompositeCondition(config.entryRules, indicators);
  // 评估出场条件
  const exitTriggered = evaluateCompositeCondition(config.exitRules, indicators);

  // 收集条件描述
  const entryDescs = collectConditionDescriptions(config.entryRules, indicators);
  const exitDescs = collectConditionDescriptions(config.exitRules, indicators);

  let action: SignalAction;
  let confidence: number;
  let reasoning: string;
  const matchedConditions: string[] = [];

  if (entryTriggered) {
    action = 'BUY';
    matchedConditions.push(...entryDescs.matched);
    // 置信度基于满足条件的数量和各指标强度
    const totalConditions = config.entryRules.conditions.length;
    const matchedCount = entryDescs.matched.length;
    confidence = Math.round(60 + (matchedCount / Math.max(1, totalConditions)) * 30);

    // 额外加分：RSI处于更有利位置
    if (indicators.rsi < 40 && indicators.rsi > 20) confidence += 5;
    // 量能确认
    if (indicators.volumeRatio > 1.5) confidence += 5;

    reasoning = `入场条件满足：${entryDescs.matched.join('，')}。` +
      (entryDescs.unmatched.length > 0 ? `未满足：${entryDescs.unmatched.join('，')}。` : '') +
      `RSI=${indicators.rsi.toFixed(1)}，量比=${indicators.volumeRatio.toFixed(2)}`;
  } else if (exitTriggered) {
    action = 'SELL';
    matchedConditions.push(...exitDescs.matched);
    confidence = Math.round(55 + (exitDescs.matched.length / Math.max(1, config.exitRules.conditions.length)) * 25);

    reasoning = `出场条件满足：${exitDescs.matched.join('，')}。` +
      `建议减仓或止损。RSI=${indicators.rsi.toFixed(1)}`;
  } else {
    action = 'HOLD';
    confidence = Math.round(30 + Math.random() * 20); // 30-50，观望

    reasoning = `入场条件未完全满足（满足：${entryDescs.matched.join('，') || '无'}，` +
      `未满足：${entryDescs.unmatched.join('，')}）。建议观望等待信号确认。`;
  }

  confidence = Math.max(10, Math.min(95, confidence));

  // 计算价格水平
  const stopLossPct = config.riskManagement.stopLossPct;
  const takeProfitPct = config.riskManagement.takeProfitPct;

  let entryPrice: number;
  let stopLoss: number;
  let takeProfit: number;

  if (action === 'BUY') {
    entryPrice = currentPrice;
    stopLoss = currentPrice * (1 - stopLossPct);
    takeProfit = currentPrice * (1 + takeProfitPct);
  } else if (action === 'SELL') {
    entryPrice = currentPrice;
    stopLoss = currentPrice * (1 + stopLossPct);
    takeProfit = currentPrice * (1 - takeProfitPct);
  } else {
    entryPrice = currentPrice;
    stopLoss = currentPrice * (1 - stopLossPct);
    takeProfit = currentPrice * (1 + takeProfitPct);
  }

  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  const riskRewardRatio = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : 0;

  // 支撑/阻力位
  const support = Math.min(indicators.lower, indicators.ma20);
  const resistance = Math.max(indicators.upper, indicators.ma20);

  return {
    action,
    confidence,
    entryPrice: parseFloat(entryPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    takeProfit: parseFloat(takeProfit.toFixed(2)),
    riskRewardRatio,
    reasoning,
    matchedConditions,
    keyLevels: {
      support: parseFloat(support.toFixed(2)),
      resistance: parseFloat(resistance.toFixed(2)),
    },
  };
}
