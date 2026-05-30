'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Search,
  Plus,
  Star,
  Play,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  Eye,
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Trash2,
  Compass,
  Radio,
  FlaskConical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';

type StrategyType = 'trend' | 'reversal' | 'momentum' | 'volatility' | 'volume' | 'pattern' | 'breakout' | 'event';

interface Strategy {
  id: string;
  name: string;
  nameKey: string;
  type: StrategyType;
  rating: number;
  description: string;
  descriptionKey: string;
  parameters: { name: string; default: string; description: string }[];
  entryConditions: string[];
  exitConditions: string[];
  source?: 'builtin' | 'api' | 'custom';
  /** 适用市场状态 */
  marketRegimes?: string[];
}

interface ExecutionResult {
  strategyId: string;
  symbol: string;
  action: string;
  confidence: number;
  reasoning: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  keyLevels?: {
    support: number;
    resistance: number;
  };
  warnings?: string[];
  provider?: string;
  matchedConditions?: string[];
  marketRegime?: {
    regime: string;
    confidence: number;
    trendStrength: number;
    volatility: number;
  };
}

/** 推荐策略 */
interface RecommendedStrategy {
  strategy: {
    id: string;
    name: string;
    displayName: string;
    type: string;
    description: string;
    parameters: { name: string; default: string; description: string }[];
    marketRegimes: string[];
    rating: number;
  };
  matchScore: number;
  reason: string;
}

/** 市场状态 */
interface MarketRegimeData {
  regime: string;
  confidence: number;
  trendStrength: number;
  volatility: number;
  description?: string;
}

const CUSTOM_STRATEGIES_KEY = 'quantfusion-custom-strategies';

const typeConfig: Record<StrategyType, { labelKey: string; color: string; icon: React.ElementType }> = {
  trend: { labelKey: 'strat.typeTrend', color: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20', icon: TrendingUp },
  reversal: { labelKey: 'strat.typeReversal', color: 'bg-red-600/15 text-red-400 border-red-600/20', icon: TrendingDown },
  momentum: { labelKey: 'strat.typeMomentum', color: 'bg-purple-600/15 text-purple-400 border-purple-600/20', icon: Activity },
  volatility: { labelKey: 'strat.typeVolatility', color: 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20', icon: Zap },
  volume: { labelKey: 'strat.typeVolume', color: 'bg-cyan-600/15 text-cyan-400 border-cyan-600/20', icon: BarChart3 },
  pattern: { labelKey: 'strat.typePattern', color: 'bg-orange-600/15 text-orange-400 border-orange-600/20', icon: Eye },
  breakout: { labelKey: 'strat.typeBreakout', color: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20', icon: Target },
  event: { labelKey: 'strat.typeEvent', color: 'bg-rose-600/15 text-rose-400 border-rose-600/20', icon: Radio },
};

/** 市场状态配色和图标 */
const regimeConfig: Record<string, { labelKey: string; color: string; icon: React.ElementType }> = {
  trending_up: { labelKey: 'strat.regimeTrendingUp', color: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20', icon: TrendingUp },
  trending_down: { labelKey: 'strat.regimeTrendingDown', color: 'bg-red-600/15 text-red-400 border-red-600/20', icon: TrendingDown },
  range_bound: { labelKey: 'strat.regimeRangeBound', color: 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20', icon: Activity },
  volatile: { labelKey: 'strat.regimeVolatile', color: 'bg-orange-600/15 text-orange-400 border-orange-600/20', icon: Zap },
};

const builtInStrategies: Strategy[] = [
  {
    id: 'ma-golden-cross',
    name: 'MA Golden Cross',
    nameKey: 'MA Golden Cross',
    type: 'trend',
    rating: 4.2,
    description: '短期均线上穿长期均线，表明上升趋势形成。配合量能确认信号有效性。',
    descriptionKey: 'Buy when short-term MA crosses above long-term MA, indicating upward momentum shift.',
    parameters: [
      { name: 'Short Period', default: '5', description: 'Short-term MA period' },
      { name: 'Long Period', default: '20', description: 'Long-term MA period' },
    ],
    entryConditions: ['MA5上穿MA20', '量比 > 1.2'],
    exitConditions: ['MA5下穿MA10', '收盘价 < MA20'],
    source: 'builtin',
    marketRegimes: ['trending_up'],
  },
  {
    id: 'macd-signal',
    name: 'MACD Signal',
    nameKey: 'MACD Signal',
    type: 'trend',
    rating: 4.0,
    description: 'MACD金叉买入、死叉卖出，结合柱状图方向确认动量。',
    descriptionKey: 'MACD golden cross buy, death cross sell with histogram confirmation.',
    parameters: [
      { name: 'Fast Period', default: '12', description: 'Fast EMA period' },
      { name: 'Slow Period', default: '26', description: 'Slow EMA period' },
      { name: 'Signal Period', default: '9', description: 'Signal line period' },
    ],
    entryConditions: ['MACD上穿信号线', '柱状图 > 0'],
    exitConditions: ['MACD下穿信号线', '柱状图 < 0'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'trending_down'],
  },
  {
    id: 'rsi-oversold-overbought',
    name: 'RSI Oversold/Overbought',
    nameKey: 'RSI Oversold/Overbought',
    type: 'reversal',
    rating: 3.8,
    description: 'RSI低于超卖线买入，高于超买线卖出，预期均值回归。',
    descriptionKey: 'Buy when RSI is oversold and selling when overbought, expecting mean reversion.',
    parameters: [
      { name: 'RSI Period', default: '14', description: 'RSI calculation period' },
      { name: 'Oversold', default: '30', description: 'Oversold threshold' },
      { name: 'Overbought', default: '70', description: 'Overbought threshold' },
    ],
    entryConditions: ['RSI < 30', '量比 > 0.8'],
    exitConditions: ['RSI > 70', 'RSI >= 50'],
    source: 'builtin',
    marketRegimes: ['range_bound'],
  },
  {
    id: 'bollinger-breakout',
    name: 'Bollinger Breakout',
    nameKey: 'Bollinger Breakout',
    type: 'volatility',
    rating: 3.5,
    description: '价格突破布林带上轨买入，跌破下轨卖出。捕捉波动率扩张带来的趋势。',
    descriptionKey: 'Enter when price breaks out of Bollinger Bands, indicating a volatility expansion.',
    parameters: [
      { name: 'Period', default: '20', description: 'BB period' },
      { name: 'Std Dev', default: '2', description: 'Standard deviation multiplier' },
    ],
    entryConditions: ['收盘价 > 布林上轨', '量比 > 1.5'],
    exitConditions: ['收盘价 < 布林中轨', '收盘价 < 布林下轨'],
    source: 'builtin',
    marketRegimes: ['volatile', 'trending_up'],
  },
  {
    id: 'kdj-golden-cross',
    name: 'KDJ Golden Cross',
    nameKey: 'KDJ Golden Cross',
    type: 'momentum',
    rating: 3.6,
    description: 'K线上穿D线且处于超卖区，结合J值方向确认买入信号。',
    descriptionKey: 'Enter when K line crosses above D line in oversold zone, combined with J line direction.',
    parameters: [
      { name: 'K Period', default: '9', description: 'K line period' },
      { name: 'D Period', default: '3', description: 'D line smoothing' },
    ],
    entryConditions: ['K上穿D', 'J < 20'],
    exitConditions: ['K下穿D', 'J > 80'],
    source: 'builtin',
    marketRegimes: ['range_bound', 'trending_up'],
  },
  {
    id: 'volume-breakout',
    name: 'Volume Breakout',
    nameKey: 'Volume Breakout',
    type: 'volume',
    rating: 3.9,
    description: '成交量显著放大且价格突破，确认趋势突破的有效性。',
    descriptionKey: 'Identify breakout moves confirmed by significantly above-average volume.',
    parameters: [
      { name: 'Volume Ratio', default: '2.0', description: 'Volume ratio threshold' },
      { name: 'Price Change %', default: '3', description: 'Minimum price change %' },
    ],
    entryConditions: ['量比 > 2.0', '涨跌幅 > 3%'],
    exitConditions: ['量比 < 0.8', '收盘价 < MA5'],
    source: 'builtin',
    marketRegimes: ['volatile', 'trending_up'],
  },
  {
    id: 'shrink-pullback',
    name: 'Shrink Pullback',
    nameKey: 'Shrink Pullback',
    type: 'volume',
    rating: 3.7,
    description: '上升趋势中价格回踩且成交量萎缩，表明为暂时性调整而非趋势反转。',
    descriptionKey: 'In an uptrend, buy when price pulls back on low volume.',
    parameters: [
      { name: 'Pullback %', default: '5', description: 'Pullback percentage from high' },
      { name: 'Volume Threshold', default: '0.7', description: 'Volume ratio below this indicates pullback' },
    ],
    entryConditions: ['收盘价 > MA20', '量比 < 0.7', '回踩幅度 < 7%'],
    exitConditions: ['收盘价 > MA5', '量比 > 1.5'],
    source: 'builtin',
    marketRegimes: ['trending_up'],
  },
  {
    id: 'wave-theory',
    name: 'Wave Theory',
    nameKey: 'Wave Theory',
    type: 'trend',
    rating: 3.4,
    description: '基于艾略特波浪理论，在第三浪启动时买入，第五浪末卖出。',
    descriptionKey: 'Based on Elliott Wave Theory, buy at wave 3 start, sell at wave 5 end.',
    parameters: [
      { name: 'Wave Period', default: '20', description: 'Wave detection period' },
      { name: 'Trend MA', default: '20', description: 'Trend MA period' },
    ],
    entryConditions: ['收盘价 > MA20', 'MA5 > MA10', 'MACD > 0'],
    exitConditions: ['RSI > 70', 'MA5下穿MA10'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'trending_down'],
  },
  {
    id: 'box-oscillation',
    name: 'Box Oscillation',
    nameKey: 'Box Oscillation',
    type: 'pattern',
    rating: 3.6,
    description: '价格在支撑位买入、阻力位卖出，适合横盘震荡行情。',
    descriptionKey: 'Buy at support, sell at resistance. Best for range-bound markets.',
    parameters: [
      { name: 'Box Period', default: '20', description: 'Box detection period' },
      { name: 'Support %', default: '0.2', description: 'Support position' },
      { name: 'Resistance %', default: '0.8', description: 'Resistance position' },
    ],
    entryConditions: ['价格位置 < 0.2', 'RSI < 35'],
    exitConditions: ['价格位置 > 0.8', 'RSI > 65'],
    source: 'builtin',
    marketRegimes: ['range_bound'],
  },
  {
    id: 'event-driven',
    name: 'Event Driven',
    nameKey: 'Event Driven',
    type: 'event',
    rating: 3.5,
    description: '基于重大事件引发的波动进行交易。简化版基于异常量价检测。',
    descriptionKey: 'Trade on significant events. Simplified version uses abnormal volume/price detection.',
    parameters: [
      { name: 'Volume Spike', default: '3.0', description: 'Volume spike threshold' },
      { name: 'Price Move %', default: '2', description: 'Minimum price move %' },
    ],
    entryConditions: ['量比 > 3.0', '涨跌幅 > 2%'],
    exitConditions: ['量比 < 1.0', '收盘价 < MA5'],
    source: 'builtin',
    marketRegimes: ['volatile'],
  },
  {
    id: 'sar-parabolic',
    name: 'SAR Parabolic',
    nameKey: 'SAR Parabolic',
    type: 'trend',
    rating: 3.8,
    description: '抛物线指标追踪价格趋势，提供动态止损位。当价格在SAR上方时持有多头，下方时持有空头。',
    descriptionKey: 'Parabolic SAR tracks price trends with dynamic stop-loss levels. Hold long when price is above SAR, short when below.',
    parameters: [
      { name: 'AF Step', default: '0.02', description: 'Acceleration factor step' },
      { name: 'AF Max', default: '0.2', description: 'Maximum acceleration factor' },
    ],
    entryConditions: ['价格上穿SAR', 'SAR翻转为上升趋势'],
    exitConditions: ['价格下穿SAR', 'SAR翻转为下降趋势'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'trending_down'],
  },
  {
    id: 'supertrend',
    name: 'Supertrend',
    nameKey: 'Supertrend',
    type: 'trend',
    rating: 4.1,
    description: '超级趋势指标基于ATR，在趋势明确时发出信号。价格上穿Supertrend买入，下穿卖出。',
    descriptionKey: 'Supertrend indicator based on ATR, signals in clear trends. Buy when price crosses above, sell when below.',
    parameters: [
      { name: 'ATR Period', default: '10', description: 'ATR calculation period' },
      { name: 'Multiplier', default: '3', description: 'ATR multiplier' },
    ],
    entryConditions: ['价格上穿Supertrend', 'Supertrend颜色翻绿'],
    exitConditions: ['价格下穿Supertrend', 'Supertrend颜色翻红'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'trending_down'],
  },
  {
    id: 'cci-divergence',
    name: 'CCI Divergence',
    nameKey: 'CCI Divergence',
    type: 'reversal',
    rating: 3.6,
    description: 'CCI背离策略，当价格与CCI指标走势出现背离时产生交易信号，预示趋势可能反转。',
    descriptionKey: 'CCI divergence strategy. Signals when price and CCI indicator diverge, indicating potential trend reversal.',
    parameters: [
      { name: 'CCI Period', default: '20', description: 'CCI calculation period' },
      { name: 'Overbought', default: '100', description: 'CCI overbought threshold' },
      { name: 'Oversold', default: '-100', description: 'CCI oversold threshold' },
    ],
    entryConditions: ['CCI底背离(价格新低CCI不新低)', 'CCI < -100后回升'],
    exitConditions: ['CCI顶背离(价格新高CCI不新高)', 'CCI > 100后回落'],
    source: 'builtin',
    marketRegimes: ['range_bound', 'volatile'],
  },
  {
    id: 'williams-r',
    name: 'Williams %R',
    nameKey: 'Williams %R',
    type: 'reversal',
    rating: 3.7,
    description: '威廉指标衡量超买超卖状态。指标值低于-80为超卖买入，高于-20为超买卖出。',
    descriptionKey: 'Williams %R measures overbought/oversold conditions. Buy below -80, sell above -20.',
    parameters: [
      { name: 'Period', default: '14', description: 'Lookback period' },
      { name: 'Overbought', default: '-20', description: 'Overbought threshold' },
      { name: 'Oversold', default: '-80', description: 'Oversold threshold' },
    ],
    entryConditions: ['Williams %R < -80 (超卖)', '%R从超卖区回升'],
    exitConditions: ['Williams %R > -20 (超买)', '%R从超买区回落'],
    source: 'builtin',
    marketRegimes: ['range_bound'],
  },
  {
    id: 'obv-breakout',
    name: 'OBV Breakout',
    nameKey: 'OBV Breakout',
    type: 'volume',
    rating: 3.9,
    description: '能量潮突破策略，OBV领先价格变动。OBV突破N日高点时确认上涨，跌破N日低点时确认下跌。',
    descriptionKey: 'On-Balance Volume breakout. OBV leads price changes. Buy when OBV breaks N-day high, sell on N-day low break.',
    parameters: [
      { name: 'OBV Period', default: '20', description: 'OBV breakout lookback period' },
      { name: 'Price Confirm %', default: '1', description: 'Price confirmation threshold %' },
    ],
    entryConditions: ['OBV突破20日新高', '价格上涨确认'],
    exitConditions: ['OBV跌破20日新低', '价格下跌确认'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'trending_down'],
  },
  {
    id: 'mfi-divergence',
    name: 'MFI Divergence',
    nameKey: 'MFI Divergence',
    type: 'momentum',
    rating: 3.5,
    description: '资金流量指标背离策略，结合价格和成交量判断资金流向。MFI与价格背离预示趋势反转。',
    descriptionKey: 'Money Flow Index divergence strategy. MFI combines price and volume. Divergence signals potential reversal.',
    parameters: [
      { name: 'MFI Period', default: '14', description: 'MFI calculation period' },
      { name: 'Overbought', default: '80', description: 'MFI overbought threshold' },
      { name: 'Oversold', default: '20', description: 'MFI oversold threshold' },
    ],
    entryConditions: ['MFI底背离(价格新低MFI不新低)', 'MFI < 20后回升'],
    exitConditions: ['MFI顶背离(价格新高MFI不新高)', 'MFI > 80后回落'],
    source: 'builtin',
    marketRegimes: ['range_bound', 'volatile'],
  },
  {
    id: 'adx-trend',
    name: 'ADX Trend Strength',
    nameKey: 'ADX Trend Strength',
    type: 'trend',
    rating: 4.0,
    description: 'ADX趋势强度确认策略。ADX>25表示趋势形成，配合+DI/-DI方向确认买卖信号。',
    descriptionKey: 'ADX trend strength confirmation. ADX>25 indicates a strong trend. Use +DI/-DI direction for buy/sell signals.',
    parameters: [
      { name: 'ADX Period', default: '14', description: 'ADX calculation period' },
      { name: 'Trend Threshold', default: '25', description: 'ADX trend strength threshold' },
    ],
    entryConditions: ['ADX > 25', '+DI > -DI'],
    exitConditions: ['ADX < 20', '+DI < -DI'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'trending_down'],
  },
  {
    id: 'ichimoku-cloud',
    name: 'Ichimoku Cloud',
    nameKey: 'Ichimoku Cloud',
    type: 'trend',
    rating: 4.3,
    description: '一目均衡表策略，综合趋势、动量和支撑阻力。价格在云上方为多头市场，云下方为空头市场。',
    descriptionKey: 'Ichimoku Cloud strategy combining trend, momentum, and support/resistance. Price above cloud = bullish, below = bearish.',
    parameters: [
      { name: 'Conversion Period', default: '9', description: 'Tenkan-sen period' },
      { name: 'Base Period', default: '26', description: 'Kijun-sen period' },
      { name: 'Span B Period', default: '52', description: 'Senkou Span B period' },
    ],
    entryConditions: ['价格突破云层上方', '转换线上穿基准线'],
    exitConditions: ['价格跌破云层下方', '转换线下穿基准线'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'trending_down'],
  },
  {
    id: 'atr-trailing-stop',
    name: 'ATR Trailing Stop',
    nameKey: 'ATR Trailing Stop',
    type: 'volatility',
    rating: 3.7,
    description: 'ATR动态止损策略，根据波动率调整止损位。价格上涨时止损上移，保护利润。',
    descriptionKey: 'ATR trailing stop strategy, adjusts stop-loss based on volatility. Stop moves up with price to protect profits.',
    parameters: [
      { name: 'ATR Period', default: '14', description: 'ATR calculation period' },
      { name: 'Multiplier', default: '2', description: 'ATR multiplier for stop distance' },
    ],
    entryConditions: ['价格突破ATR通道上轨', 'ATR止损翻转向上'],
    exitConditions: ['价格跌破ATR止损位', 'ATR止损翻转向下'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'volatile'],
  },
  {
    id: 'stochastic-oscillator',
    name: 'Stochastic Oscillator',
    nameKey: 'Stochastic Oscillator',
    type: 'momentum',
    rating: 3.8,
    description: '随机指标策略，%K线上穿%D线且处于超卖区买入，下穿且处于超买区卖出。',
    descriptionKey: 'Stochastic oscillator strategy. Buy when %K crosses above %D in oversold zone, sell when crossing below in overbought.',
    parameters: [
      { name: '%K Period', default: '14', description: '%K lookback period' },
      { name: '%K Smoothing', default: '3', description: '%K smoothing period' },
      { name: '%D Smoothing', default: '3', description: '%D smoothing period' },
    ],
    entryConditions: ['%K上穿%D', '%K < 20 (超卖区)'],
    exitConditions: ['%K下穿%D', '%K > 80 (超买区)'],
    source: 'builtin',
    marketRegimes: ['range_bound'],
  },
  {
    id: 'dragon-tiger',
    name: 'Dragon Tiger Battle',
    nameKey: 'Dragon Tiger Battle',
    type: 'pattern',
    rating: 3.4,
    description: '龙虎榜跟庄策略，追踪主力资金动向。当出现大额净买入且价格上涨时跟随买入。',
    descriptionKey: 'Follow institutional money flow. Buy when large net buying occurs with rising prices.',
    parameters: [
      { name: 'Volume Ratio', default: '2.5', description: 'Volume ratio threshold' },
      { name: 'Price Change %', default: '3', description: 'Minimum price change %' },
      { name: 'Hold Days', default: '5', description: 'Maximum holding days' },
    ],
    entryConditions: ['量比 > 2.5', '涨跌幅 > 3%', '连续2日放量'],
    exitConditions: ['量比 < 0.8', '收盘价 < MA5', '持仓超过5天'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'volatile'],
  },
  {
    id: 'limit-up-breakout',
    name: 'Limit Up Breakout',
    nameKey: 'Limit Up Breakout',
    type: 'momentum',
    rating: 3.3,
    description: '涨停板突破策略，捕捉强势股突破后的惯性上涨。简化版基于大幅上涨后的动量延续。',
    descriptionKey: 'Limit-up breakout strategy. Captures momentum continuation after strong upward moves. Simplified version.',
    parameters: [
      { name: 'Price Change %', default: '5', description: 'Minimum daily gain %' },
      { name: 'Volume Ratio', default: '2.0', description: 'Volume confirmation ratio' },
      { name: 'Hold Days', default: '3', description: 'Maximum holding days' },
    ],
    entryConditions: ['涨跌幅 > 5%', '量比 > 2.0', '收盘价接近当日最高'],
    exitConditions: ['涨跌幅 < -2%', '量比 < 0.5', '持仓超过3天'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'volatile'],
  },
  {
    id: 'northbound-capital',
    name: 'Northbound Capital',
    nameKey: 'Northbound Capital',
    type: 'event',
    rating: 3.6,
    description: '北向资金流入策略，追踪外资动向。当持续放量且价格走强时跟随买入，资金流出时卖出。',
    descriptionKey: 'Track northbound capital flows. Buy when sustained volume increase with rising prices, sell on outflows.',
    parameters: [
      { name: 'Volume Trend Days', default: '3', description: 'Consecutive volume increase days' },
      { name: 'Volume Ratio', default: '1.5', description: 'Volume ratio threshold' },
      { name: 'Price Trend %', default: '2', description: 'Cumulative price change %' },
    ],
    entryConditions: ['连续3日放量', '量比 > 1.5', '累计涨幅 > 2%'],
    exitConditions: ['量比 < 0.7', '收盘价 < MA5', '连续缩量'],
    source: 'builtin',
    marketRegimes: ['trending_up'],
  },
  {
    id: 'margin-trading',
    name: 'Margin Trading Signal',
    nameKey: 'Margin Trading Signal',
    type: 'volume',
    rating: 3.4,
    description: '融资融券信号策略，通过量价异常波动推测杠杆资金动向。放量突破时跟随，缩量回落时退出。',
    descriptionKey: 'Margin trading signal strategy. Detects leveraged capital flow via volume/price anomalies. Follow breakouts, exit on decline.',
    parameters: [
      { name: 'Volume Ratio', default: '2.0', description: 'Volume ratio threshold' },
      { name: 'ATR Multiple', default: '1.5', description: 'ATR multiple for breakout' },
      { name: 'Volatility Window', default: '10', description: 'Volatility lookback window' },
    ],
    entryConditions: ['量比 > 2.0', '价格突破ATR通道', '波动率扩张'],
    exitConditions: ['量比 < 0.8', '价格跌破MA10', '波动率收缩'],
    source: 'builtin',
    marketRegimes: ['volatile', 'trending_up'],
  },
  {
    id: 'sector-rotation',
    name: 'Sector Rotation',
    nameKey: 'Sector Rotation',
    type: 'trend',
    rating: 3.5,
    description: '板块轮动策略，基于相对强弱判断资金流向。强势板块回调时买入，弱势板块反弹时卖出。',
    descriptionKey: 'Sector rotation strategy based on relative strength. Buy strong sectors on pullbacks, sell weak sectors on bounces.',
    parameters: [
      { name: 'RS Period', default: '14', description: 'Relative strength period' },
      { name: 'MA Period', default: '20', description: 'Trend MA period' },
      { name: 'Pullback %', default: '3', description: 'Pullback percentage threshold' },
    ],
    entryConditions: ['相对强度 > 阈值', '价格回踩MA20', '缩量回调'],
    exitConditions: ['相对强度 < 阈值', '价格跌破MA20', '放量滞涨'],
    source: 'builtin',
    marketRegimes: ['trending_up', 'range_bound'],
  },
];

// localStorage migration helper — moves old localStorage strategies to the server DB
async function migrateLocalStorageStrategies(
  onMigrated: (strategies: Strategy[]) => void,
): Promise<void> {
  try {
    const raw = localStorage.getItem(CUSTOM_STRATEGIES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    // Migrate each localStorage strategy to the server
    const migrated: Strategy[] = [];
    for (const s of parsed as Strategy[]) {
      try {
        const res = await fetch('/api/fusion/strategies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: s.name,
            type: s.type,
            description: s.description,
            entryConditions: s.entryConditions,
            exitConditions: s.exitConditions,
            parameters: s.parameters,
            marketRegimes: s.marketRegimes || [],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          migrated.push({
            id: data.id,
            name: data.name,
            nameKey: data.name,
            type: (data.type as StrategyType) || s.type,
            rating: data.rating || 0,
            description: data.description || s.description,
            descriptionKey: data.description || s.description,
            parameters: data.parameters || s.parameters,
            entryConditions: s.entryConditions,
            exitConditions: s.exitConditions,
            source: 'custom',
            marketRegimes: data.marketRegimes || s.marketRegimes,
          });
        }
      } catch {
        // Individual migration failure — skip
      }
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(CUSTOM_STRATEGIES_KEY);
    if (migrated.length > 0) {
      onMigrated(migrated);
    }
  } catch {
    // Migration failed — will retry next time
  }
}

function getActionColor(action: string) {
  switch (action.toUpperCase()) {
    case 'BUY': return 'text-emerald-400';
    case 'SELL': return 'text-red-400';
    case 'HOLD': return 'text-yellow-400';
    case 'SKIP': return 'text-zinc-400';
    default: return 'text-zinc-400';
  }
}

function getActionBgColor(action: string) {
  switch (action.toUpperCase()) {
    case 'BUY': return 'bg-emerald-600/15 border-emerald-600/20';
    case 'SELL': return 'bg-red-600/15 border-red-600/20';
    case 'HOLD': return 'bg-yellow-600/15 border-yellow-600/20';
    case 'SKIP': return 'bg-zinc-600/15 border-zinc-600/20';
    default: return 'bg-zinc-600/15 border-zinc-600/20';
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 70) return 'text-emerald-400';
  if (confidence >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

interface BacktestNavExtra {
  strategy?: string;
  symbol?: string;
}

interface StrategyCenterViewProps {
  onNavigate?: (view: 'dashboard' | 'aiAnalysis' | 'agentChat' | 'scanner' | 'positions' | 'watchlist' | 'strategies' | 'news' | 'backtest' | 'settings', extra?: BacktestNavExtra) => void;
}

export function StrategyCenterView({ onNavigate }: StrategyCenterViewProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [strategyToDelete, setStrategyToDelete] = useState<Strategy | null>(null);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    type: 'trend' as StrategyType,
    description: '',
    entryRule: '',
    exitRule: '',
    parameters: [] as { name: string; default: string; description: string }[],
    marketRegimes: [] as string[],
  });

  // Execution dialog state
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executeStrategy, setExecuteStrategy] = useState<Strategy | null>(null);
  const [executeSymbol, setExecuteSymbol] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Strategies from API (includes both built-in from server + custom from DB)
  const [apiStrategies, setApiStrategies] = useState<Strategy[]>([]);
  const [apiStrategiesLoading, setApiStrategiesLoading] = useState(false);

  // Custom strategies from server DB
  const [customStrategies, setCustomStrategies] = useState<Strategy[]>([]);

  // Creating strategy state
  const [creating, setCreating] = useState(false);

  // 市场状态 + 策略推荐
  const [recommendSymbol, setRecommendSymbol] = useState('AAPL');
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [marketRegime, setMarketRegime] = useState<MarketRegimeData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedStrategy[]>([]);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  // Fetch strategies from API on mount
  useEffect(() => {
    async function fetchApiStrategies() {
      setApiStrategiesLoading(true);
      try {
        // First, migrate any old localStorage strategies to the server
        await migrateLocalStorageStrategies((migrated) => {
          setCustomStrategies((prev) => [...prev, ...migrated]);
        });

        const res = await fetch('/api/fusion/strategies');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const customFromApi: Strategy[] = [];
            // Transform API strategies to match our interface
            const transformed: Strategy[] = data.map((s: Record<string, unknown>) => {
              const source = (s.source as 'builtin' | 'api' | 'custom') || 'api';
              const strategy: Strategy = {
                id: s.id as string || String(s.name).toLowerCase().replace(/\s+/g, '-'),
                name: s.name as string,
                nameKey: s.name as string,
                type: (s.type as StrategyType) || 'trend',
                rating: (s.rating as number) || 3.5,
                description: s.description as string || '',
                descriptionKey: s.description as string || '',
                parameters: Array.isArray(s.parameters)
                  ? (s.parameters as Record<string, string>[]).map((p) => ({
                      name: p.name || '',
                      default: p.default || '',
                      description: p.description || '',
                    }))
                  : [],
                entryConditions: s.entryCondition ? [s.entryCondition as string] : [],
                exitConditions: s.exitCondition ? [s.exitCondition as string] : [],
                marketRegimes: Array.isArray(s.marketRegimes) ? s.marketRegimes as string[] : [],
                source,
              };
              if (source === 'custom') {
                customFromApi.push(strategy);
              }
              return strategy;
            });
            // Only add non-custom API strategies that aren't already in built-in
            const builtInIds = new Set(builtInStrategies.map((b) => b.id));
            const newApiStrategies = transformed.filter(
              (s) => s.source !== 'custom' && !builtInIds.has(s.id) && !builtInIds.has(s.name.toLowerCase().replace(/\s+/g, '-'))
            );
            setApiStrategies(newApiStrategies);
            // Set custom strategies from DB (replaces any migrated ones)
            if (customFromApi.length > 0) {
              setCustomStrategies(customFromApi);
            }
          }
        }
      } catch {
        // Silently fail, use built-in only
      } finally {
        setApiStrategiesLoading(false);
      }
    }
    fetchApiStrategies();
  }, []);

  const allStrategies = [...builtInStrategies, ...apiStrategies, ...customStrategies];

  const filteredStrategies = allStrategies.filter((s) => {
    const matchesSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || s.type === selectedType;
    return matchesSearch && matchesType;
  });

  // 获取推荐策略集合
  const recommendedIds = new Set(recommendations.slice(0, 3).map((r) => r.strategy.id));

  const handleCreateStrategy = useCallback(async () => {
    if (!newStrategy.name || !newStrategy.entryRule) return;
    setCreating(true);
    try {
      const res = await fetch('/api/fusion/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStrategy.name,
          type: newStrategy.type,
          description: newStrategy.description || `Custom strategy: ${newStrategy.entryRule}`,
          entryConditions: [newStrategy.entryRule],
          exitConditions: [newStrategy.exitRule],
          parameters: newStrategy.parameters,
          marketRegimes: newStrategy.marketRegimes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const customStrategy: Strategy = {
          id: data.id,
          name: data.name,
          nameKey: data.name,
          type: (data.type as StrategyType) || newStrategy.type,
          rating: 0,
          description: data.description || newStrategy.description || `Custom strategy: ${newStrategy.entryRule}`,
          descriptionKey: data.description || newStrategy.description || `Custom strategy: ${newStrategy.entryRule}`,
          parameters: data.parameters || newStrategy.parameters,
          entryConditions: [newStrategy.entryRule],
          exitConditions: [newStrategy.exitRule],
          source: 'custom' as const,
          marketRegimes: data.marketRegimes || newStrategy.marketRegimes,
        };
        setCustomStrategies((prev) => [...prev, customStrategy]);
        setCreateDialogOpen(false);
        setNewStrategy({
          name: '',
          type: 'trend',
          description: '',
          entryRule: '',
          exitRule: '',
          parameters: [],
          marketRegimes: [],
        });
      } else {
        // Fallback: save locally if API fails
        const customStrategy: Strategy = {
          id: `custom-${Date.now()}`,
          name: newStrategy.name,
          nameKey: newStrategy.name,
          type: newStrategy.type,
          rating: 0,
          description: newStrategy.description || `Custom strategy: ${newStrategy.entryRule}`,
          descriptionKey: newStrategy.description || `Custom strategy: ${newStrategy.entryRule}`,
          parameters: newStrategy.parameters,
          entryConditions: [newStrategy.entryRule],
          exitConditions: [newStrategy.exitRule],
          source: 'custom' as const,
          marketRegimes: newStrategy.marketRegimes,
        };
        setCustomStrategies((prev) => [...prev, customStrategy]);
        setCreateDialogOpen(false);
        setNewStrategy({
          name: '',
          type: 'trend',
          description: '',
          entryRule: '',
          exitRule: '',
          parameters: [],
          marketRegimes: [],
        });
      }
    } catch {
      // Fallback: save locally if network error
      const customStrategy: Strategy = {
        id: `custom-${Date.now()}`,
        name: newStrategy.name,
        nameKey: newStrategy.name,
        type: newStrategy.type,
        rating: 0,
        description: newStrategy.description || `Custom strategy: ${newStrategy.entryRule}`,
        descriptionKey: newStrategy.description || `Custom strategy: ${newStrategy.entryRule}`,
        parameters: newStrategy.parameters,
        entryConditions: [newStrategy.entryRule],
        exitConditions: [newStrategy.exitRule],
        source: 'custom' as const,
        marketRegimes: newStrategy.marketRegimes,
      };
      setCustomStrategies((prev) => [...prev, customStrategy]);
      setCreateDialogOpen(false);
      setNewStrategy({
        name: '',
        type: 'trend',
        description: '',
        entryRule: '',
        exitRule: '',
        parameters: [],
        marketRegimes: [],
      });
    } finally {
      setCreating(false);
    }
  }, [newStrategy]);

  const handleDeleteStrategy = useCallback((strategy: Strategy) => {
    setStrategyToDelete(strategy);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDeleteStrategy = useCallback(async () => {
    if (!strategyToDelete) return;
    try {
      // Try to delete from server DB
      await fetch(`/api/fusion/strategies?id=${encodeURIComponent(strategyToDelete.id)}`, {
        method: 'DELETE',
      });
    } catch {
      // Network error — still remove from local state
    }
    setCustomStrategies((prev) => prev.filter((s) => s.id !== strategyToDelete.id));
    if (expandedStrategy === strategyToDelete.id) {
      setExpandedStrategy(null);
    }
    setDeleteConfirmOpen(false);
    setStrategyToDelete(null);
  }, [strategyToDelete, expandedStrategy]);

  const handleOpenExecuteDialog = (strategy: Strategy) => {
    setExecuteStrategy(strategy);
    setExecuteSymbol('');
    setExecutionResult(null);
    setExecuteDialogOpen(true);
  };

  const handleGoToBacktest = (strategy: Strategy) => {
    onNavigate?.('backtest', { strategy: strategy.id });
  };

  const handleExecuteStrategy = async () => {
    if (!executeStrategy || !executeSymbol) return;
    setExecuting(true);
    setExecutionResult(null);
    try {
      const isCustom = executeStrategy.source === 'custom';
      const requestBody: Record<string, unknown> = {
        strategyId: executeStrategy.id,
        symbol: executeSymbol,
        parameters: executeStrategy.parameters.reduce((acc, p) => {
          acc[p.name] = p.default;
          return acc;
        }, {} as Record<string, string>),
        mode: 'paper',
      };

      // For custom strategies, send the strategy details so the AI can analyze them
      if (isCustom) {
        requestBody.customStrategy = {
          name: executeStrategy.name,
          entryConditions: executeStrategy.entryConditions,
          exitConditions: executeStrategy.exitConditions,
          description: executeStrategy.description,
        };
      }

      const res = await fetch('/api/fusion/strategies/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const data = await res.json();
        setExecutionResult(data);
      } else {
        setExecutionResult({
          strategyId: executeStrategy.id,
          symbol: executeSymbol.toUpperCase(),
          action: 'HOLD',
          confidence: 50,
          reasoning: 'Unable to get strategy execution result from server. Please try again.',
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          riskRewardRatio: 0,
          provider: 'error',
        });
      }
    } catch {
      setExecutionResult({
        strategyId: executeStrategy?.id || '',
        symbol: executeSymbol.toUpperCase(),
        action: 'HOLD',
        confidence: 50,
        reasoning: 'Network error occurred while executing strategy. Please check your connection.',
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        riskRewardRatio: 0,
        provider: 'error',
      });
    } finally {
      setExecuting(false);
    }
  };

  // 获取市场状态和策略推荐
  const handleGetRecommendations = async () => {
    if (!recommendSymbol) return;
    setRecommendLoading(true);
    setRecommendError(null);
    try {
      const res = await fetch(`/api/fusion/strategies/recommend?symbol=${encodeURIComponent(recommendSymbol)}`);
      if (res.ok) {
        const data = await res.json();
        setMarketRegime(data.marketRegime);
        setRecommendations(data.recommendations || []);
      } else {
        setRecommendError('Failed to get recommendations');
      }
    } catch {
      setRecommendError('Network error. Please try again.');
    } finally {
      setRecommendLoading(false);
    }
  };

  // 获取市场状态颜色
  const getRegimeColor = (regime: string) => {
    const cfg = regimeConfig[regime];
    return cfg ? cfg.color : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';
  };

  return (
    <div className="space-y-6">
      {/* 市场状态 & 策略推荐区 */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Compass className="w-4 h-4 text-emerald-400" />
            {t('strat.marketStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 输入股票代码获取推荐 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder={t('strat.noRecommendations')}
                value={recommendSymbol}
                onChange={(e) => setRecommendSymbol(e.target.value.toUpperCase())}
                className="pl-9 bg-[#0a0a0f] border-[#1e1e2e] text-white uppercase"
                onKeyDown={(e) => e.key === 'Enter' && handleGetRecommendations()}
              />
            </div>
            <Button
              onClick={handleGetRecommendations}
              disabled={recommendLoading || !recommendSymbol}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {recommendLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Compass className="w-4 h-4" />
              )}
              {recommendLoading ? t('strat.recommendLoading') : t('strat.getRecommendations')}
            </Button>
          </div>

          {/* 市场状态显示 */}
          {marketRegime && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{t('strat.marketRegime')}:</span>
                {(() => {
                  const cfg = regimeConfig[marketRegime.regime] || regimeConfig.range_bound;
                  const RegimeIcon = cfg.icon;
                  return (
                    <Badge className={`${cfg.color} border text-xs gap-1`}>
                      <RegimeIcon className="w-3 h-3" />
                      {t(cfg.labelKey)}
                    </Badge>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">{t('strat.regimeConfidence')}:</span>
                <span className="text-xs font-medium text-white">{marketRegime.confidence}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">{t('strat.trendStrength')}:</span>
                <span className="text-xs font-medium text-white">{marketRegime.trendStrength?.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">{t('strat.volatility')}:</span>
                <span className="text-xs font-medium text-white">{marketRegime.volatility?.toFixed(2)}%</span>
              </div>
            </div>
          )}

          {/* 推荐策略列表 */}
          {recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                {t('strat.recommendFor')} {recommendSymbol}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {recommendations.slice(0, 3).map((rec) => {
                  const strategy = rec.strategy;
                  const stConfig = typeConfig[strategy.type as StrategyType] || typeConfig.trend;
                  const TypeIcon = stConfig.icon;
                  return (
                    <div
                      key={strategy.id}
                      className="p-3 bg-[#0a0a0f] rounded-lg border border-emerald-600/20 hover:border-emerald-600/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TypeIcon className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          <span className="text-xs font-bold text-white truncate">{strategy.name}</span>
                        </div>
                        <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 border text-[9px]">
                          {rec.matchScore}% {t('strat.matchScore')}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-2">{rec.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recommendError && (
            <p className="text-xs text-red-400">{recommendError}</p>
          )}
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder={t('strat.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#111118] border-[#1e1e2e] text-white placeholder:text-zinc-500 focus:border-emerald-600/50"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-36 bg-[#111118] border-[#1e1e2e] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#111118] border-[#1e1e2e]">
            <SelectItem value="all" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">{t('strat.allTypes')}</SelectItem>
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                {t(cfg.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('strat.customStrategy')}
        </Button>
      </div>

      {/* Strategy Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredStrategies.map((strategy) => {
          const cfg = typeConfig[strategy.type] || typeConfig.trend;
          const TypeIcon = cfg.icon;
          const isExpanded = expandedStrategy === strategy.id;
          const isCustom = strategy.source === 'custom';
          const isRecommended = recommendedIds.has(strategy.id);

          return (
            <Card
              key={strategy.id}
              className={`bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e] ${
                isExpanded ? 'sm:col-span-2 lg:col-span-2' : ''
              } ${isRecommended ? 'ring-1 ring-emerald-600/30' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{strategy.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge className={`${cfg.color} border text-[9px]`}>
                        <TypeIcon className="w-2.5 h-2.5 mr-0.5" />
                        {t(cfg.labelKey)}
                      </Badge>
                      {isRecommended && (
                        <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 border text-[9px]">
                          ★ {t('strat.recommended')}
                        </Badge>
                      )}
                      {strategy.source === 'api' && (
                        <Badge className="bg-blue-600/15 text-blue-400 border-blue-600/20 border text-[9px]">
                          API
                        </Badge>
                      )}
                      {isCustom && (
                        <Badge className="bg-pink-600/15 text-pink-400 border-pink-600/20 border text-[9px]">
                          {t('strat.customBadge')}
                        </Badge>
                      )}
                      {/* 适用市场状态标签 */}
                      {strategy.marketRegimes && strategy.marketRegimes.length > 0 && (
                        strategy.marketRegimes.slice(0, 1).map((regime) => {
                          const rCfg = regimeConfig[regime];
                          if (!rCfg) return null;
                          return (
                            <Badge key={regime} className={`${getRegimeColor(regime)} border text-[8px]`}>
                              {t(rCfg.labelKey)}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    {strategy.rating > 0 ? (
                      <>
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-medium text-white">{strategy.rating.toFixed(1)}</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-500 italic">{t('strat.unrated')}</span>
                    )}
                    {isCustom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStrategy(strategy)}
                        className="h-5 w-5 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-600/10"
                        title={t('strat.deleteStrategy')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-2">
                  {strategy.description}
                </p>

                {/* Quick Parameters */}
                <div className="space-y-1.5 mb-3">
                  {strategy.parameters.slice(0, 3).map((param) => (
                    <div key={param.name} className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">{param.name}</span>
                      <span className="text-[10px] font-medium text-zinc-300">{param.default}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}
                    className="h-7 text-xs text-zinc-400 hover:text-white flex-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                    {t('strat.detail')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/10 gap-1"
                    onClick={() => handleOpenExecuteDialog(strategy)}
                    title={t('strat.executeSignal')}
                  >
                    <Zap className="w-3 h-3" />
                    {t('strat.executeSignal')}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                    onClick={() => handleGoToBacktest(strategy)}
                  >
                    <FlaskConical className="w-3 h-3" />
                    {t('strat.backtest')}
                  </Button>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <>
                    <Separator className="bg-[#1e1e2e] my-3" />
                    <div className="space-y-3">
                      {strategy.entryConditions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-white mb-1.5">{t('strat.entryConditions')}</h4>
                          <ul className="space-y-1">
                            {strategy.entryConditions.map((cond, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-zinc-300">{cond}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {strategy.exitConditions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-white mb-1.5">{t('strat.exitConditions')}</h4>
                          <ul className="space-y-1">
                            {strategy.exitConditions.map((cond, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <X className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-zinc-300">{cond}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* 适用市场状态 */}
                      {strategy.marketRegimes && strategy.marketRegimes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-white mb-1.5">{t('strat.marketRegime')}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {strategy.marketRegimes.map((regime) => {
                              const rCfg = regimeConfig[regime];
                              if (!rCfg) return null;
                              const RIcon = rCfg.icon;
                              return (
                                <Badge key={regime} className={`${rCfg.color} border text-[10px] gap-1`}>
                                  <RIcon className="w-2.5 h-2.5" />
                                  {t(rCfg.labelKey)}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Strategy Execution Dialog */}
      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              {t('strat.executeSignal')}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {executeStrategy?.name} — {t('strat.executeSignalDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.symbol')}</Label>
              <Input
                placeholder="e.g., AAPL"
                value={executeSymbol}
                onChange={(e) => setExecuteSymbol(e.target.value.toUpperCase())}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white uppercase"
              />
            </div>

            {/* Execution Result */}
            {executionResult && (
              <div className="space-y-3 p-4 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                {/* 市场状态信息 */}
                {executionResult.marketRegime && (
                  <div className="flex items-center gap-2 pb-2 border-b border-[#1e1e2e]">
                    <span className="text-[10px] text-zinc-500 uppercase">{t('strat.marketRegime')}:</span>
                    <Badge className={`${getRegimeColor(executionResult.marketRegime.regime)} border text-[10px]`}>
                      {t(regimeConfig[executionResult.marketRegime.regime]?.labelKey || 'strat.regimeRangeBound')}
                    </Badge>
                    <span className="text-[10px] text-zinc-400">
                      {executionResult.marketRegime.confidence}% {t('strat.regimeConfidence')}
                    </span>
                  </div>
                )}

                {/* Action & Confidence */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getActionBgColor(executionResult.action)} border ${getActionColor(executionResult.action)} text-sm px-3 py-1`}>
                      {executionResult.action}
                    </Badge>
                    <span className={`text-sm font-medium ${getConfidenceColor(executionResult.confidence)}`}>
                      {executionResult.confidence}% {t('strat.confidence')}
                    </span>
                  </div>
                  {executionResult.provider?.includes('z-ai') && (
                    <Badge className="bg-blue-600/15 text-blue-400 border-blue-600/20 border text-[9px]">
                      {t('strat.aiPowered')}
                    </Badge>
                  )}
                  {executionResult.provider === 'engine' && (
                    <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 border text-[9px]">
                      {t('strat.engineSignal')}
                    </Badge>
                  )}
                </div>

                {/* 匹配的条件 */}
                {executionResult.matchedConditions && executionResult.matchedConditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-zinc-500">{t('strat.matchedConditions')}:</span>
                    {executionResult.matchedConditions.map((cond, i) => (
                      <Badge key={i} className="bg-emerald-600/10 text-emerald-400 border-emerald-600/20 border text-[9px]">
                        ✓ {cond}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Price Levels */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-[#111118] rounded-md">
                    <p className="text-[10px] text-zinc-500 uppercase">{t('strat.entryPrice')}</p>
                    <p className="text-sm font-bold text-white">${executionResult.entryPrice?.toFixed(2) || '--'}</p>
                  </div>
                  <div className="text-center p-2 bg-[#111118] rounded-md">
                    <p className="text-[10px] text-zinc-500 uppercase">{t('strat.stopLoss')}</p>
                    <p className="text-sm font-bold text-red-400">${executionResult.stopLoss?.toFixed(2) || '--'}</p>
                  </div>
                  <div className="text-center p-2 bg-[#111118] rounded-md">
                    <p className="text-[10px] text-zinc-500 uppercase">{t('strat.takeProfit')}</p>
                    <p className="text-sm font-bold text-emerald-400">${executionResult.takeProfit?.toFixed(2) || '--'}</p>
                  </div>
                </div>

                {/* Risk/Reward & Key Levels */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-zinc-400" />
                    <span className="text-zinc-500">R/R:</span>
                    <span className="text-zinc-300 font-medium">{executionResult.riskRewardRatio?.toFixed(2) || '--'}</span>
                  </div>
                  {executionResult.keyLevels && (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-500">Support:</span>
                        <span className="text-emerald-400">${executionResult.keyLevels.support?.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-zinc-500">Resistance:</span>
                        <span className="text-red-400">${executionResult.keyLevels.resistance?.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Reasoning */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase mb-1">{t('strat.reasoning')}</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{executionResult.reasoning}</p>
                </div>

                {/* Warnings */}
                {executionResult.warnings && executionResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {executionResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <span className="text-[10px] text-yellow-400/80">{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExecuteDialogOpen(false);
                setExecutionResult(null);
              }}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300"
            >
              {t('watch.cancel')}
            </Button>
            <Button
              onClick={handleExecuteStrategy}
              disabled={executing || !executeSymbol}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {executing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('strat.executing')}
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  {t('strat.runExecution')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Strategy Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{t('strat.createStrategy')}</DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              {t('strat.createStrategyDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 1. Strategy Name */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.strategyName')}</Label>
              <Input
                placeholder="e.g., My Custom Strategy"
                value={newStrategy.name}
                onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>

            {/* 2. Strategy Type */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.strategyType')}</Label>
              <Select
                value={newStrategy.type}
                onValueChange={(v) => setNewStrategy({ ...newStrategy, type: v as StrategyType })}
              >
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                      {t(cfg.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Description */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.description')}</Label>
              <Textarea
                placeholder="e.g., A trend-following strategy that combines MA cross with volume confirmation"
                value={newStrategy.description}
                onChange={(e) => setNewStrategy({ ...newStrategy, description: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white min-h-[60px]"
              />
            </div>

            {/* 4. Entry Rule */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.entryRule')}</Label>
              <Textarea
                placeholder="e.g., MA5 crosses above MA20 and RSI < 70"
                value={newStrategy.entryRule}
                onChange={(e) => setNewStrategy({ ...newStrategy, entryRule: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white min-h-[80px]"
              />
            </div>

            {/* 5. Exit Rule */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.exitRule')}</Label>
              <Textarea
                placeholder="e.g., MA5 crosses below MA10 or stop loss at -5%"
                value={newStrategy.exitRule}
                onChange={(e) => setNewStrategy({ ...newStrategy, exitRule: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white min-h-[80px]"
              />
            </div>

            {/* 6. Parameters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300 text-sm">{t('strat.parameters')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-emerald-400 hover:text-emerald-300 gap-1"
                  onClick={() => setNewStrategy({
                    ...newStrategy,
                    parameters: [...newStrategy.parameters, { name: '', default: '', description: '' }],
                  })}
                >
                  <Plus className="w-3 h-3" />
                  {t('strat.addParameter')}
                </Button>
              </div>
              {newStrategy.parameters.length === 0 && (
                <p className="text-[10px] text-zinc-600 italic">{t('strat.noParametersHint')}</p>
              )}
              <div className="space-y-3">
                {newStrategy.parameters.map((param, idx) => (
                  <div key={idx} className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder={t('strat.paramName')}
                          value={param.name}
                          onChange={(e) => {
                            const updated = [...newStrategy.parameters];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setNewStrategy({ ...newStrategy, parameters: updated });
                          }}
                          className="bg-[#111118] border-[#1e1e2e] text-white text-xs h-7"
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          placeholder={t('strat.paramDefault')}
                          value={param.default}
                          onChange={(e) => {
                            const updated = [...newStrategy.parameters];
                            updated[idx] = { ...updated[idx], default: e.target.value };
                            setNewStrategy({ ...newStrategy, parameters: updated });
                          }}
                          className="bg-[#111118] border-[#1e1e2e] text-white text-xs h-7"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-600/10 flex-shrink-0"
                        onClick={() => {
                          const updated = newStrategy.parameters.filter((_, i) => i !== idx);
                          setNewStrategy({ ...newStrategy, parameters: updated });
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <Input
                      placeholder={t('strat.paramDescription')}
                      value={param.description}
                      onChange={(e) => {
                        const updated = [...newStrategy.parameters];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setNewStrategy({ ...newStrategy, parameters: updated });
                      }}
                      className="bg-[#111118] border-[#1e1e2e] text-white text-xs h-7"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 7. Market Regimes */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.applicableRegimes')}</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(regimeConfig).map(([key, cfg]) => {
                  const RegimeIcon = cfg.icon;
                  const isSelected = newStrategy.marketRegimes.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const updated = isSelected
                          ? newStrategy.marketRegimes.filter((r) => r !== key)
                          : [...newStrategy.marketRegimes, key];
                        setNewStrategy({ ...newStrategy, marketRegimes: updated });
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition-colors ${
                        isSelected
                          ? `${cfg.color} border-current`
                          : 'bg-[#0a0a0f] border-[#1e1e2e] text-zinc-500 hover:border-zinc-600'
                      }`}
                    >
                      <RegimeIcon className="w-3 h-3" />
                      {t(cfg.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreateStrategy}
              disabled={!newStrategy.name || !newStrategy.entryRule || creating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('strat.saving') || 'Saving...'}
                </>
              ) : (
                t('strat.saveStrategy')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              {t('strat.deleteStrategy')}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t('strat.deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={confirmDeleteStrategy}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('strat.deleteStrategy')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
