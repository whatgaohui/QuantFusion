'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  DollarSign,
  BarChart3,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';

// ==================== Strategy list (matches StrategyCenterView) ====================

const STRATEGY_LIST = [
  { value: 'ma-golden-cross', label: '均线金叉' },
  { value: 'rsi-divergence', label: 'RSI背离' },
  { value: 'macd-momentum', label: 'MACD动量' },
  { value: 'bollinger-breakout', label: '布林带突破' },
  { value: 'kdj-golden-cross', label: 'KDJ金叉' },
  { value: 'volume-breakout', label: '放量突破' },
  { value: 'low-volume-pullback', label: '缩量回踩' },
  { value: 'three-white-soldiers', label: '三白兵' },
  { value: 'ma-death-cross', label: '均线死叉做空' },
  { value: 'double-bottom', label: '双底形态' },
  { value: 'atr-volatility', label: 'ATR波动率收缩' },
  { value: 'rsi-overbought-oversold', label: 'RSI均值回归' },
  { value: 'macd-divergence', label: 'MACD背离' },
  { value: 'volume-profile', label: '成交量分布支撑' },
  { value: 'channel-breakout', label: '通道突破' },
];

// ==================== Types ====================

interface BacktestConfig {
  strategy: string;
  symbol: string;
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
  profitFactor: number;
  annualReturn: number;
  avgHoldingDays: number;
  equityCurve: { date: string; equity: number }[];
  trades: TradeRecord[];
  isOffline?: boolean;
}

// ==================== Mock Data Generators ====================

function generateRealisticEquityCurve(
  startEquity: number,
  totalReturnPct: number,
  startDate: string,
  endDate: string,
): { date: string; equity: number }[] {
  const data: { date: string; equity: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const numPoints = Math.min(totalDays, Math.max(50, Math.floor(totalDays / 2)));
  const step = totalDays / numPoints;

  let equity = startEquity;
  const targetEquity = startEquity * (1 + totalReturnPct / 100);
  const drift = (targetEquity - startEquity) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const date = new Date(start.getTime() + i * step * 86400000);
    // Add trend + noise
    const noise = equity * (Math.random() - 0.5) * 0.03;
    const trendDrift = drift * (0.5 + Math.random());
    equity = equity + trendDrift + noise;
    equity = Math.max(startEquity * 0.5, equity); // Floor at 50% loss

    data.push({
      date: date.toISOString().split('T')[0],
      equity: Number(equity.toFixed(2)),
    });
  }

  return data;
}

function generateRealisticTrades(
  totalTrades: number,
  winRate: number,
  startDate: string,
  endDate: string,
): TradeRecord[] {
  const symbols = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'JPM', 'V'];
  const trades: TradeRecord[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const avgHoldingDays = Math.max(3, Math.floor(totalDays / totalTrades));

  let currentDate = new Date(start);

  for (let i = 0; i < totalTrades; i++) {
    const symbol = symbols[i % symbols.length];
    const isWin = Math.random() < winRate / 100;
    const side = i % 3 === 0 ? 'SELL' as const : 'BUY' as const;

    const entryPrice = Number((50 + Math.random() * 350).toFixed(2));
    const pnlPercent = isWin
      ? Number((1 + Math.random() * 12).toFixed(2))  // Win: 1-13%
      : Number((-1 - Math.random() * 8).toFixed(2));  // Loss: -1 to -9%
    const exitPrice = Number((entryPrice * (1 + pnlPercent / 100)).toFixed(2));
    const quantity = Math.floor(10 + Math.random() * 90);

    const entryDate = new Date(currentDate);
    const holdingDays = Math.max(1, Math.floor(avgHoldingDays * (0.5 + Math.random())));
    const exitDate = new Date(currentDate.getTime() + holdingDays * 86400000);

    trades.push({
      id: String(i + 1),
      symbol,
      side,
      entryDate: entryDate.toISOString().split('T')[0],
      exitDate: exitDate.toISOString().split('T')[0],
      entryPrice,
      exitPrice,
      quantity,
      pnl: Number(((exitPrice - entryPrice) * quantity * (side === 'SELL' ? -1 : 1)).toFixed(2)),
      pnlPercent,
    });

    // Advance date
    currentDate = new Date(exitDate.getTime() + Math.floor(Math.random() * 3 + 1) * 86400000);
    if (currentDate > end) break;
  }

  return trades;
}

function generateMockBacktestResult(config: BacktestConfig): BacktestResult {
  // Realistic random metrics
  const totalReturnPct = Number((-20 + Math.random() * 100).toFixed(2)); // -20% to +80%
  const totalReturn = Number((config.initialCapital * totalReturnPct / 100).toFixed(2));
  const winRate = Number((40 + Math.random() * 25).toFixed(1)); // 40-65%
  const maxDrawdown = Number(-(5 + Math.random() * 30).toFixed(1)); // -5% to -35%
  const sharpeRatio = Number((0.3 + Math.random() * 2.2).toFixed(2)); // 0.3-2.5
  const totalTrades = Math.floor(10 + Math.random() * 20); // 10-30
  const profitFactor = Number((0.5 + Math.random() * 2.5).toFixed(2)); // 0.5-3.0
  const daysDiff = Math.max(1, Math.floor((new Date(config.endDate).getTime() - new Date(config.startDate).getTime()) / 86400000));
  const annualReturn = Number((totalReturnPct / daysDiff * 365).toFixed(2));
  const avgHoldingDays = Math.max(2, Math.floor(daysDiff / totalTrades));

  const equityCurve = generateRealisticEquityCurve(
    config.initialCapital,
    totalReturnPct,
    config.startDate,
    config.endDate,
  );

  const trades = generateRealisticTrades(
    totalTrades,
    winRate,
    config.startDate,
    config.endDate,
  );

  return {
    totalReturn,
    totalReturnPct,
    winRate,
    maxDrawdown,
    sharpeRatio,
    totalTrades,
    profitFactor,
    annualReturn,
    avgHoldingDays,
    equityCurve,
    trades,
    isOffline: true,
  };
}

// ==================== Default Config ====================

const defaultConfig: BacktestConfig = {
  strategy: 'ma-golden-cross',
  symbol: 'AAPL',
  initialCapital: 100000,
  positionSizePct: 10,
  stopLossPct: 8,
  takeProfitPct: 15,
  cycleDays: 7,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
};

// ==================== Component ====================

interface BacktestViewProps {
  initialStrategy?: string;
}

export function BacktestView({ initialStrategy }: BacktestViewProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<BacktestConfig>({
    ...defaultConfig,
    strategy: initialStrategy || defaultConfig.strategy,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);

  // Update strategy if prop changes
  useEffect(() => {
    if (initialStrategy) {
      setConfig(prev => ({ ...prev, strategy: initialStrategy }));
    }
  }, [initialStrategy]);

  const handleRunBacktest = async () => {
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch('/api/fusion/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        const data = await res.json();
        // Check if the response looks like a valid backtest result
        if (data && (data.totalReturn !== undefined || data.equityCurve || data.trades)) {
          setResult({
            ...data,
            isOffline: false,
          });
        } else {
          // API returned something unexpected, use mock
          setResult(generateMockBacktestResult(config));
        }
      } else {
        // API failed (502 or other), use realistic mock
        setResult(generateMockBacktestResult(config));
      }
    } catch {
      // Network error, use realistic mock
      setResult(generateMockBacktestResult(config));
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setConfig({ ...defaultConfig, strategy: initialStrategy || defaultConfig.strategy });
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('back.config')}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Strategy + Symbol */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.strategy')}</Label>
              <Select value={config.strategy} onValueChange={(v) => setConfig({ ...config, strategy: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                  <SelectValue placeholder={t('back.selectStrategy')} />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  {STRATEGY_LIST.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.symbol')}</Label>
              <Input
                placeholder="例如 AAPL"
                value={config.symbol}
                onChange={(e) => setConfig({ ...config, symbol: e.target.value.toUpperCase() })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.initialCapital')}</Label>
              <Input
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig({ ...config, initialCapital: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.positionSize')}</Label>
              <Input
                type="number"
                value={config.positionSizePct}
                onChange={(e) => setConfig({ ...config, positionSizePct: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.stopLoss')}</Label>
              <Input
                type="number"
                value={config.stopLossPct}
                onChange={(e) => setConfig({ ...config, stopLossPct: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.takeProfit')}</Label>
              <Input
                type="number"
                value={config.takeProfitPct}
                onChange={(e) => setConfig({ ...config, takeProfitPct: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.cycleDays')}</Label>
              <Input
                type="number"
                value={config.cycleDays}
                onChange={(e) => setConfig({ ...config, cycleDays: parseInt(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.startDate')}</Label>
              <Input
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.endDate')}</Label>
              <Input
                type="date"
                value={config.endDate}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRunBacktest}
              disabled={running}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Play className="w-4 h-4" />
              {running ? t('back.running') : t('back.runBacktest')}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('back.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Offline mode indicator */}
          {result.isOffline && (
            <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-xs flex items-center gap-1 w-fit">
              <WifiOff className="w-3 h-3" />
              {t('back.offlineMode')}
            </Badge>
          )}

          {/* Result Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.totalReturn')}</span>
                </div>
                <p className={`text-base font-bold ${result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.totalReturn >= 0 ? '+' : ''}${Math.abs(result.totalReturn).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  {result.totalReturnPct >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.returnPercent')}</span>
                </div>
                <p className={`text-base font-bold ${result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.winRate')}</span>
                </div>
                <p className={`text-base font-bold ${result.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.winRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-3 h-3 text-red-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.maxDrawdown')}</span>
                </div>
                <p className="text-base font-bold text-red-400">{result.maxDrawdown.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.sharpeRatio')}</span>
                </div>
                <p className={`text-base font-bold ${result.sharpeRatio >= 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {result.sharpeRatio.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.totalTrades')}</span>
                </div>
                <p className="text-base font-bold text-white">{result.totalTrades}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.profitFactor')}</span>
                </div>
                <p className={`text-base font-bold ${result.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.profitFactor.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('back.annualReturn')}</span>
                </div>
                <p className={`text-base font-bold ${result.annualReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.annualReturn >= 0 ? '+' : ''}{result.annualReturn.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Equity Curve */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white">{t('back.equityCurve')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equityCurve}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} interval={Math.floor(result.equityCurve.length / 6)} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2e2e3e', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(value: number) => [`¥${value.toLocaleString()}`, '权益']}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Trade List */}
          {result.trades && result.trades.length > 0 && (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-white">{t('back.tradeList')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs">{t('back.symbol')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">方向</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.entryDate')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.exitDate')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.entryPrice')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.exitPrice')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.quantity')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.tradePnl')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.trades.map((trade) => (
                        <TableRow key={trade.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                          <TableCell className="text-sm font-medium text-white">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] px-1.5 py-0 ${trade.side === 'BUY' ? 'bg-emerald-600/15 text-emerald-400' : 'bg-red-600/15 text-red-400'}`}>
                              {trade.side === 'BUY' ? '买入' : '卖出'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-zinc-300">{trade.entryDate}</TableCell>
                          <TableCell className="text-xs text-zinc-300">{trade.exitDate}</TableCell>
                          <TableCell className="text-xs text-zinc-300">${trade.entryPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-zinc-300">${trade.exitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-zinc-300">{trade.quantity}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} ({trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%)
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* No Results State */}
      {!result && !running && (
        <Card className="bg-[#111118] border-[#1e1e2e] border-dashed rounded-xl">
          <CardContent className="py-16 text-center">
            <FlaskConical className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">{t('back.configureAndRun')}</p>
            <p className="text-zinc-500 text-xs mt-1">{t('back.resultsWillAppear')}</p>
          </CardContent>
        </Card>
      )}

      {/* Running State */}
      {running && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-emerald-400 text-sm font-medium">{t('back.runningSimulation')}</p>
            <p className="text-zinc-500 text-xs mt-1">{t('back.analyzingHistorical')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
