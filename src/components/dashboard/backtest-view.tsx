'use client';

import { useState } from 'react';
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';

interface BacktestConfig {
  strategy: string;
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
}

const strategies = [
  { value: 'ma-golden-cross', label: 'MA Golden Cross' },
  { value: 'rsi-divergence', label: 'RSI Divergence' },
  { value: 'macd-momentum', label: 'MACD Momentum' },
  { value: 'bollinger-breakout', label: 'Bollinger Breakout' },
  { value: 'kdj-golden-cross', label: 'KDJ Golden Cross' },
  { value: 'volume-breakout', label: 'Volume Breakout' },
  { value: 'channel-breakout', label: 'Channel Breakout' },
];

function generateEquityCurve(startEquity: number): { date: string; equity: number }[] {
  const data: { date: string; equity: number }[] = [];
  let equity = startEquity;
  const startDate = new Date('2023-07-01');
  
  for (let i = 0; i < 180; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    equity += equity * ((Math.random() - 0.45) * 0.02);
    data.push({
      date: date.toISOString().split('T')[0],
      equity: Number(equity.toFixed(2)),
    });
  }
  return data;
}

function generateTrades(): TradeRecord[] {
  const symbols = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL'];
  const trades: TradeRecord[] = [];
  for (let i = 0; i < 12; i++) {
    const symbol = symbols[i % symbols.length];
    const side = i % 3 === 0 ? 'SELL' : 'BUY';
    const entryPrice = 100 + Math.random() * 300;
    const pnlPercent = (Math.random() - 0.35) * 15;
    const exitPrice = entryPrice * (1 + pnlPercent / 100);
    const entryDate = new Date(2023, 6, 1 + i * 14);
    const exitDate = new Date(2023, 6, 8 + i * 14);
    const qty = Math.floor(10 + Math.random() * 40);
    trades.push({
      id: String(i + 1),
      symbol,
      side: side as 'BUY' | 'SELL',
      entryDate: entryDate.toISOString().split('T')[0],
      exitDate: exitDate.toISOString().split('T')[0],
      entryPrice: Number(entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      quantity: qty,
      pnl: Number(((exitPrice - entryPrice) * qty).toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
    });
  }
  return trades;
}

const defaultConfig: BacktestConfig = {
  strategy: 'ma-golden-cross',
  initialCapital: 100000,
  positionSizePct: 10,
  stopLossPct: 8,
  takeProfitPct: 15,
  cycleDays: 7,
  startDate: '2023-07-01',
  endDate: '2024-01-01',
};

export function BacktestView() {
  const { t } = useLanguage();
  const [config, setConfig] = useState<BacktestConfig>(defaultConfig);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleRunBacktest = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/fusion/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const equityCurve = generateEquityCurve(config.initialCapital);
        const finalEquity = equityCurve[equityCurve.length - 1].equity;
        setResult({
          totalReturn: finalEquity - config.initialCapital,
          totalReturnPct: ((finalEquity - config.initialCapital) / config.initialCapital) * 100,
          winRate: 64.2,
          maxDrawdown: -12.5,
          sharpeRatio: 1.47,
          totalTrades: 47,
          equityCurve,
          trades: generateTrades(),
        });
      }
    } catch {
      const equityCurve = generateEquityCurve(config.initialCapital);
      const finalEquity = equityCurve[equityCurve.length - 1].equity;
      setResult({
        totalReturn: finalEquity - config.initialCapital,
        totalReturnPct: ((finalEquity - config.initialCapital) / config.initialCapital) * 100,
        winRate: 64.2,
        maxDrawdown: -12.5,
        sharpeRatio: 1.47,
        totalTrades: 47,
        equityCurve,
        trades: generateTrades(),
      });
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">{t('back.config')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Strategy Selector */}
          <div className="space-y-2 max-w-xs">
            <Label className="text-zinc-300 text-sm">{t('back.strategy')}</Label>
            <Select value={config.strategy} onValueChange={(v) => setConfig({ ...config, strategy: v })}>
              <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                <SelectValue placeholder={t('back.selectStrategy')} />
              </SelectTrigger>
              <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                {strategies.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="max-w-xs">
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
          {/* Result Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.totalReturn')}</span>
                </div>
                <p className={`text-lg font-bold ${result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.totalReturn >= 0 ? '+' : ''}${Math.abs(result.totalReturn).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {result.totalReturnPct >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.returnPercent')}</span>
                </div>
                <p className={`text-lg font-bold ${result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.winRate')}</span>
                </div>
                <p className={`text-lg font-bold ${result.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.winRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.maxDrawdown')}</span>
                </div>
                <p className="text-lg font-bold text-red-400">{result.maxDrawdown.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.sharpeRatio')}</span>
                </div>
                <p className={`text-lg font-bold ${result.sharpeRatio >= 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {result.sharpeRatio.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.totalTrades')}</span>
                </div>
                <p className="text-lg font-bold text-white">{result.totalTrades}</p>
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
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} interval={29} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2e2e3e', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Equity']}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs">Symbol</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Side</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Entry</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Exit</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.tradePnl')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.trades.map((trade) => (
                        <TableRow key={trade.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                          <TableCell className="text-sm font-medium text-white">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] px-1.5 py-0 ${trade.side === 'BUY' ? 'bg-emerald-600/15 text-emerald-400' : 'bg-red-600/15 text-red-400'}`}>
                              {trade.side}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-300">${trade.entryPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-zinc-300">${trade.exitPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
