/**
 * 策略配置系统
 * 定义10个内置策略，包含入场/出场规则、参数、适用市场状态
 */

/** 策略分类 */
export type StrategyCategory = 'trend' | 'reversal' | 'momentum' | 'volatility' | 'volume' | 'pattern' | 'event';

/** 市场状态类型 */
export type MarketRegime = 'trending_up' | 'trending_down' | 'range_bound' | 'volatile';

/** 信号类型 */
export type SignalAction = 'BUY' | 'SELL' | 'HOLD';

/** 条件运算符 */
export type ConditionOperator = 'AND' | 'OR';

/** 指标条件 */
export interface IndicatorCondition {
  /** 指标名称，如 ma5, ma20, rsi, macd, k, d, j, upper, lower, volumeRatio */
  indicator: string;
  /** 比较运算符 */
  operator: '>' | '<' | '>=' | '<=' | '==' | 'crosses_above' | 'crosses_below';
  /** 比较值（数字或另一指标名） */
  value: number | string;
}

/** 复合条件（支持AND/OR） */
export interface CompositeCondition {
  /** 条件运算符 */
  operator: ConditionOperator;
  /** 子条件列表 */
  conditions: (IndicatorCondition | CompositeCondition)[];
}

/** 策略参数定义 */
export interface StrategyParameter {
  name: string;
  default: string;
  description: string;
}

/** 风控配置 */
export interface RiskManagement {
  stopLossPct: number;
  takeProfitPct: number;
}

/** 策略配置接口 */
export interface StrategyConfig {
  /** 策略ID */
  id: string;
  /** 英文名 */
  name: string;
  /** 显示名（含中文） */
  displayName: string;
  /** 策略分类 */
  category: StrategyCategory;
  /** 描述 */
  description: string;
  /** 入场规则 */
  entryRules: CompositeCondition;
  /** 出场规则 */
  exitRules: CompositeCondition;
  /** 策略参数 */
  parameters: StrategyParameter[];
  /** 适用市场状态 */
  marketRegimes: MarketRegime[];
  /** 评分 */
  rating: number;
  /** 风控 */
  riskManagement: RiskManagement;
}

// ============ 10个内置策略 ============

/** 1. 均线金叉策略 */
export const MA_GOLDEN_CROSS: StrategyConfig = {
  id: 'ma-golden-cross',
  name: 'MA Golden Cross',
  displayName: '均线金叉',
  category: 'trend',
  description: '短期均线上穿长期均线，表明上升趋势形成。配合量能确认信号有效性。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'ma5', operator: 'crosses_above', value: 'ma20' },
      { indicator: 'volumeRatio', operator: '>', value: 1.2 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'ma5', operator: 'crosses_below', value: 'ma10' },
      { indicator: 'close', operator: '<', value: 'ma20' },
    ],
  },
  parameters: [
    { name: 'short_period', default: '5', description: '短期均线周期' },
    { name: 'long_period', default: '20', description: '长期均线周期' },
  ],
  marketRegimes: ['trending_up'],
  rating: 4.2,
  riskManagement: { stopLossPct: 0.05, takeProfitPct: 0.15 },
};

/** 2. MACD信号策略 */
export const MACD_SIGNAL: StrategyConfig = {
  id: 'macd-signal',
  name: 'MACD Signal',
  displayName: 'MACD信号',
  category: 'trend',
  description: 'MACD金叉买入、死叉卖出，结合柱状图方向确认动量。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'macd', operator: 'crosses_above', value: 'signal' },
      { indicator: 'histogram', operator: '>', value: 0 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'macd', operator: 'crosses_below', value: 'signal' },
      { indicator: 'histogram', operator: '<', value: 0 },
    ],
  },
  parameters: [
    { name: 'fast_period', default: '12', description: '快线EMA周期' },
    { name: 'slow_period', default: '26', description: '慢线EMA周期' },
    { name: 'signal_period', default: '9', description: '信号线周期' },
  ],
  marketRegimes: ['trending_up', 'trending_down'],
  rating: 4.0,
  riskManagement: { stopLossPct: 0.05, takeProfitPct: 0.18 },
};

/** 3. RSI超卖超买策略 */
export const RSI_OVERSOLD_OVERBOUGHT: StrategyConfig = {
  id: 'rsi-oversold-overbought',
  name: 'RSI Oversold/Overbought',
  displayName: 'RSI超卖超买',
  category: 'reversal',
  description: 'RSI低于超卖线买入，高于超买线卖出，预期均值回归。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'rsi', operator: '<', value: 30 },
      { indicator: 'volumeRatio', operator: '>', value: 0.8 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'rsi', operator: '>', value: 70 },
      { indicator: 'rsi', operator: '>=', value: 50 },
    ],
  },
  parameters: [
    { name: 'rsi_period', default: '14', description: 'RSI计算周期' },
    { name: 'oversold', default: '30', description: '超卖阈值' },
    { name: 'overbought', default: '70', description: '超买阈值' },
  ],
  marketRegimes: ['range_bound'],
  rating: 3.8,
  riskManagement: { stopLossPct: 0.07, takeProfitPct: 0.12 },
};

/** 4. 布林带突破策略 */
export const BOLLINGER_BREAKOUT: StrategyConfig = {
  id: 'bollinger-breakout',
  name: 'Bollinger Breakout',
  displayName: '布林带突破',
  category: 'volatility',
  description: '价格突破布林带上轨买入，跌破下轨卖出。捕捉波动率扩张带来的趋势。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'close', operator: '>', value: 'upper' },
      { indicator: 'volumeRatio', operator: '>', value: 1.5 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'close', operator: '<', value: 'middle' },
      { indicator: 'close', operator: '<', value: 'lower' },
    ],
  },
  parameters: [
    { name: 'period', default: '20', description: '布林带周期' },
    { name: 'std_dev', default: '2.0', description: '标准差倍数' },
  ],
  marketRegimes: ['volatile', 'trending_up'],
  rating: 3.5,
  riskManagement: { stopLossPct: 0.04, takeProfitPct: 0.12 },
};

/** 5. KDJ金叉策略 */
export const KDJ_GOLDEN_CROSS: StrategyConfig = {
  id: 'kdj-golden-cross',
  name: 'KDJ Golden Cross',
  displayName: 'KDJ金叉',
  category: 'momentum',
  description: 'K线上穿D线且处于超卖区，结合J值方向确认买入信号。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'k', operator: 'crosses_above', value: 'd' },
      { indicator: 'j', operator: '<', value: 20 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'k', operator: 'crosses_below', value: 'd' },
      { indicator: 'j', operator: '>', value: 80 },
    ],
  },
  parameters: [
    { name: 'k_period', default: '9', description: 'K线周期' },
    { name: 'd_period', default: '3', description: 'D线平滑周期' },
  ],
  marketRegimes: ['range_bound', 'trending_up'],
  rating: 3.6,
  riskManagement: { stopLossPct: 0.06, takeProfitPct: 0.15 },
};

/** 6. 放量突破策略 */
export const VOLUME_BREAKOUT: StrategyConfig = {
  id: 'volume-breakout',
  name: 'Volume Breakout',
  displayName: '放量突破',
  category: 'volume',
  description: '成交量显著放大且价格突破，确认趋势突破的有效性。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'volumeRatio', operator: '>', value: 2.0 },
      { indicator: 'priceChangePct', operator: '>', value: 3 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'volumeRatio', operator: '<', value: 0.8 },
      { indicator: 'close', operator: '<', value: 'ma5' },
    ],
  },
  parameters: [
    { name: 'volume_ratio_threshold', default: '2.0', description: '量比阈值' },
    { name: 'price_change_pct', default: '3', description: '最小价格变化百分比' },
  ],
  marketRegimes: ['volatile', 'trending_up'],
  rating: 3.9,
  riskManagement: { stopLossPct: 0.04, takeProfitPct: 0.10 },
};

/** 7. 缩量回踩策略 */
export const SHRINK_PULLBACK: StrategyConfig = {
  id: 'shrink-pullback',
  name: 'Shrink Pullback',
  displayName: '缩量回踩',
  category: 'volume',
  description: '上升趋势中价格回踩且成交量萎缩，表明为暂时性调整而非趋势反转。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'close', operator: '>', value: 'ma20' },
      { indicator: 'volumeRatio', operator: '<', value: 0.7 },
      { indicator: 'pullbackPct', operator: '<', value: 7 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'close', operator: '>', value: 'ma5' },
      { indicator: 'volumeRatio', operator: '>', value: 1.5 },
    ],
  },
  parameters: [
    { name: 'pullback_pct', default: '5', description: '回踩百分比' },
    { name: 'volume_threshold', default: '0.7', description: '缩量阈值' },
  ],
  marketRegimes: ['trending_up'],
  rating: 3.7,
  riskManagement: { stopLossPct: 0.05, takeProfitPct: 0.12 },
};

/** 8. 波浪理论策略 */
export const WAVE_THEORY: StrategyConfig = {
  id: 'wave-theory',
  name: 'Wave Theory',
  displayName: '波浪理论',
  category: 'trend',
  description: '基于艾略特波浪理论，在第三浪启动时买入，第五浪末卖出。简化版判断。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'close', operator: '>', value: 'ma20' },
      { indicator: 'ma5', operator: '>', value: 'ma10' },
      { indicator: 'macd', operator: '>', value: 0 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'rsi', operator: '>', value: 70 },
      { indicator: 'ma5', operator: 'crosses_below', value: 'ma10' },
    ],
  },
  parameters: [
    { name: 'wave_period', default: '20', description: '波浪判断周期' },
    { name: 'trend_ma', default: '20', description: '趋势均线周期' },
  ],
  marketRegimes: ['trending_up', 'trending_down'],
  rating: 3.4,
  riskManagement: { stopLossPct: 0.06, takeProfitPct: 0.20 },
};

/** 9. 箱体震荡策略 */
export const BOX_OSCILLATION: StrategyConfig = {
  id: 'box-oscillation',
  name: 'Box Oscillation',
  displayName: '箱体震荡',
  category: 'pattern',
  description: '价格在支撑位买入、阻力位卖出，适合横盘震荡行情。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'pricePosition', operator: '<', value: 0.2 },
      { indicator: 'rsi', operator: '<', value: 35 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'pricePosition', operator: '>', value: 0.8 },
      { indicator: 'rsi', operator: '>', value: 65 },
    ],
  },
  parameters: [
    { name: 'box_period', default: '20', description: '箱体判断周期' },
    { name: 'support_pct', default: '0.2', description: '支撑位百分比' },
    { name: 'resistance_pct', default: '0.8', description: '阻力位百分比' },
  ],
  marketRegimes: ['range_bound'],
  rating: 3.6,
  riskManagement: { stopLossPct: 0.04, takeProfitPct: 0.08 },
};

/** 10. 事件驱动策略 */
export const EVENT_DRIVEN: StrategyConfig = {
  id: 'event-driven',
  name: 'Event Driven',
  displayName: '事件驱动',
  category: 'event',
  description: '基于重大事件（财报、政策等）引发的波动进行交易。简化版基于异常量价检测。',
  entryRules: {
    operator: 'AND',
    conditions: [
      { indicator: 'volumeRatio', operator: '>', value: 3.0 },
      { indicator: 'priceChangePct', operator: '>', value: 2 },
    ],
  },
  exitRules: {
    operator: 'OR',
    conditions: [
      { indicator: 'volumeRatio', operator: '<', value: 1.0 },
      { indicator: 'close', operator: '<', value: 'ma5' },
    ],
  },
  parameters: [
    { name: 'volume_spike', default: '3.0', description: '放量倍数阈值' },
    { name: 'price_move_pct', default: '2', description: '最小价格波动百分比' },
  ],
  marketRegimes: ['volatile'],
  rating: 3.5,
  riskManagement: { stopLossPct: 0.05, takeProfitPct: 0.15 },
};

/** 所有内置策略配置 */
export const BUILTIN_STRATEGIES: StrategyConfig[] = [
  MA_GOLDEN_CROSS,
  MACD_SIGNAL,
  RSI_OVERSOLD_OVERBOUGHT,
  BOLLINGER_BREAKOUT,
  KDJ_GOLDEN_CROSS,
  VOLUME_BREAKOUT,
  SHRINK_PULLBACK,
  WAVE_THEORY,
  BOX_OSCILLATION,
  EVENT_DRIVEN,
];

/** 根据ID获取策略配置 */
export function getStrategyById(id: string): StrategyConfig | undefined {
  return BUILTIN_STRATEGIES.find((s) => s.id === id);
}

/** 根据分类获取策略列表 */
export function getStrategiesByCategory(category: StrategyCategory): StrategyConfig[] {
  return BUILTIN_STRATEGIES.filter((s) => s.category === category);
}

/** 将策略配置转换为API响应格式 */
export function strategyConfigToApiFormat(config: StrategyConfig) {
  return {
    id: config.id,
    name: config.name,
    displayName: config.displayName,
    type: config.category,
    description: config.description,
    parameters: config.parameters,
    entryCondition: compositeConditionToString(config.entryRules),
    exitCondition: compositeConditionToString(config.exitRules),
    marketRegimes: config.marketRegimes,
    riskManagement: config.riskManagement,
    rating: config.rating,
  };
}

/** 将复合条件转为可读字符串 */
export function compositeConditionToString(condition: CompositeCondition): string {
  const parts = condition.conditions.map((c) => {
    if ('operator' in c && 'conditions' in c) {
      return `(${compositeConditionToString(c as CompositeCondition)})`;
    }
    const ic = c as IndicatorCondition;
    const opMap: Record<string, string> = {
      '>': '>',
      '<': '<',
      '>=': '≥',
      '<=': '≤',
      '==': '=',
      'crosses_above': 'crosses above',
      'crosses_below': 'crosses below',
    };
    return `${ic.indicator} ${opMap[ic.operator] || ic.operator} ${ic.value}`;
  });
  return parts.join(` ${condition.operator} `);
}
