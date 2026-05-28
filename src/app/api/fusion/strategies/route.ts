import { NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://127.0.0.1:8000';

const BUILTIN_STRATEGIES = [
  { id: 'ma_crossover', name: '均线交叉', type: 'trend', description: '基于MA5/MA20金叉死叉策略', rating: 4.2, params: { fast_period: 5, slow_period: 20 } },
  { id: 'macd_signal', name: 'MACD信号', type: 'trend', description: 'MACD金叉买入死叉卖出', rating: 4.0, params: { fast: 12, slow: 26, signal: 9 } },
  { id: 'rsi_divergence', name: 'RSI背离', type: 'reversal', description: 'RSI超买超卖与价格背离策略', rating: 3.8, params: { period: 14, overbought: 70, oversold: 30 } },
  { id: 'bollinger_breakout', name: '布林带突破', type: 'volatility', description: '价格突破布林带上下轨策略', rating: 3.9, params: { period: 20, std_dev: 2 } },
  { id: 'kdj_golden_cross', name: 'KDJ金叉', type: 'momentum', description: 'KDJ指标金叉买入策略', rating: 3.7, params: { k_period: 9, d_period: 3, j_period: 3 } },
  { id: 'volume_breakout', name: '放量突破', type: 'volume', description: '成交量突破均线配合价格突破', rating: 3.5, params: { volume_period: 20, volume_ratio: 2.0 } },
  { id: 'double_bottom', name: '双底形态', type: 'pattern', description: 'W底形态确认买入策略', rating: 4.1, params: { lookback: 30, tolerance: 0.02 } },
  { id: 'trend_following', name: '趋势跟踪', type: 'trend', description: '基于ATR的趋势跟踪策略', rating: 4.3, params: { atr_period: 14, atr_multiplier: 3 } },
  { id: 'mean_reversion', name: '均值回归', type: 'reversal', description: '价格偏离均值后回归策略', rating: 3.6, params: { lookback: 20, entry_z: -2, exit_z: 0 } },
  { id: 'momentum_rotation', name: '动量轮动', type: 'momentum', description: '行业板块动量轮动策略', rating: 3.4, params: { period: 20, top_n: 3 } },
  { id: 'breakout_pullback', name: '突破回踩', type: 'pattern', description: '突破关键位后回踩确认买入', rating: 4.0, params: { breakout_period: 20, pullback_pct: 0.03 } },
  { id: 'gap_strategy', name: '缺口策略', type: 'pattern', description: '向上跳空缺口买入策略', rating: 3.3, params: { min_gap_pct: 1.0, hold_days: 5 } },
  { id: 'accumulation_zone', name: '吸筹区间', type: 'volume', description: '识别底部吸筹区间买入', rating: 3.8, params: { volume_threshold: 1.5, price_range: 0.05 } },
  { id: 'dividend_capture', name: '股息捕获', type: 'fundamental', description: '高股息率标的择时策略', rating: 3.2, params: { min_yield: 3.0, ex_div_days: 5 } },
  { id: 'sector_rotation', name: '行业轮动', type: 'framework', description: '基于宏观经济周期的行业轮动', rating: 4.4, params: { cycle_period: 60, sectors: 5 } },
];

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${PYTHON_SERVICE_URL}/api/strategies`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Fallback to built-in strategies
  }

  return NextResponse.json({
    success: true,
    data: BUILTIN_STRATEGIES.map(s => ({ ...s, source: 'local-presets' })),
    error: null,
  });
}
