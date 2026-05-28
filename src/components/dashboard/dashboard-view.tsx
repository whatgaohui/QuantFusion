'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Target,
  RefreshCw,
  Radar,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';

interface PortfolioSummary {
  totalValue: number;
  todayPnl: number;
  todayPnlPercent: number;
  activePositions: number;
  winRate: number;
  totalInvested: number;
  totalPnl: number;
}

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface Trade {
  id: string;
  symbol: string;
  name: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  total: number;
  timestamp: string;
}

const defaultSummary: PortfolioSummary = {
  totalValue: 125750.50,
  todayPnl: 2340.80,
  todayPnlPercent: 1.89,
  activePositions: 8,
  winRate: 68.5,
  totalInvested: 100000,
  totalPnl: 25750.50,
};

const defaultIndices: MarketIndex[] = [
  { symbol: '^GSPC', name: 'S&P 500', price: 5248.32, change: 28.45, changePercent: 0.54 },
  { symbol: '^IXIC', name: 'NASDAQ', price: 16742.39, change: 156.78, changePercent: 0.94 },
  { symbol: '^DJI', name: 'DOW', price: 39142.23, change: -45.12, changePercent: -0.12 },
];

const defaultTrades: Trade[] = [
  { id: '1', symbol: 'AAPL', name: 'Apple Inc.', side: 'BUY', price: 189.45, quantity: 50, total: 9472.50, timestamp: '2024-01-15T10:30:00Z' },
  { id: '2', symbol: 'NVDA', name: 'NVIDIA Corp.', side: 'BUY', price: 615.20, quantity: 20, total: 12304.00, timestamp: '2024-01-15T09:45:00Z' },
  { id: '3', symbol: 'TSLA', name: 'Tesla Inc.', side: 'SELL', price: 245.80, quantity: 30, total: 7374.00, timestamp: '2024-01-14T14:20:00Z' },
  { id: '4', symbol: 'MSFT', name: 'Microsoft Corp.', side: 'BUY', price: 388.50, quantity: 25, total: 9712.50, timestamp: '2024-01-14T11:15:00Z' },
  { id: '5', symbol: 'META', name: 'Meta Platforms', side: 'SELL', price: 374.20, quantity: 15, total: 5613.00, timestamp: '2024-01-13T15:45:00Z' },
];

const miniSparklineData = [
  { v: 5200 }, { v: 5220 }, { v: 5195 }, { v: 5235 }, { v: 5248 },
];

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function DashboardView() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [indices, setIndices] = useState<MarketIndex[] | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const allocationData = [
    { name: t('alloc.technology'), value: 35, color: '#10b981' },
    { name: t('alloc.healthcare'), value: 20, color: '#0FEDBE' },
    { name: t('alloc.finance'), value: 18, color: '#22c55e' },
    { name: t('alloc.energy'), value: 15, color: '#f59e0b' },
    { name: t('alloc.consumer'), value: 12, color: '#8b5cf6' },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, sp500Res, nasdaqRes, dowRes, tradesRes] = await Promise.allSettled([
        fetch('/api/portfolio/summary'),
        fetch('/api/market/quote?symbol=^GSPC'),
        fetch('/api/market/quote?symbol=^IXIC'),
        fetch('/api/market/quote?symbol=^DJI'),
        fetch('/api/trades'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const data = await summaryRes.value.json();
        // Map API response fields to frontend interface
        setSummary({
          totalValue: data.totalValue ?? 0,
          todayPnl: data.todayPnl ?? 0,
          todayPnlPercent: data.todayPnlPercent ?? data.totalProfitPct ?? 0,
          activePositions: data.activePositions ?? 0,
          winRate: data.winRate ?? 0,
          totalInvested: data.totalInvested ?? data.totalCost ?? 0,
          totalPnl: data.totalPnl ?? data.totalProfit ?? 0,
        });
      } else {
        setSummary(defaultSummary);
      }

      // Fetch all 3 indices
      const indexResults: MarketIndex[] = [];
      const indexData = [
        { res: sp500Res, symbol: '^GSPC', name: 'S&P 500' },
        { res: nasdaqRes, symbol: '^IXIC', name: 'NASDAQ' },
        { res: dowRes, symbol: '^DJI', name: 'DOW' },
      ];
      for (const idx of indexData) {
        if (idx.res.status === 'fulfilled' && idx.res.value.ok) {
          try {
            const data = await idx.res.value.json();
            indexResults.push({
              symbol: idx.symbol,
              name: idx.name,
              price: data.currentPrice || data.c || 0,
              change: data.change || data.d || 0,
              changePercent: data.changePercent || data.dp || 0,
            });
          } catch {
            const def = defaultIndices.find(d => d.symbol === idx.symbol);
            if (def) indexResults.push(def);
          }
        } else {
          const def = defaultIndices.find(d => d.symbol === idx.symbol);
          if (def) indexResults.push(def);
        }
      }
      setIndices(indexResults.length > 0 ? indexResults : defaultIndices);

      if (tradesRes.status === 'fulfilled' && tradesRes.value.ok) {
        const data = await tradesRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          setTrades(data.map((tradeItem: { symbol: string; name: string; action: string; price: number; quantity: number; profitPct?: number; reason?: string; createdAt: string }) => ({
            id: tradeItem.symbol + tradeItem.createdAt,
            symbol: tradeItem.symbol,
            name: tradeItem.name || tradeItem.symbol,
            side: (tradeItem.action || 'BUY') as 'BUY' | 'SELL',
            price: tradeItem.price,
            quantity: tradeItem.quantity,
            total: tradeItem.price * tradeItem.quantity,
            timestamp: tradeItem.createdAt,
          })));
        } else {
          setTrades(defaultTrades);
        }
      } else {
        setTrades(defaultTrades);
      }

      setLastUpdated(new Date());
    } catch {
      setSummary(defaultSummary);
      setIndices(defaultIndices);
      setTrades(defaultTrades);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const metricCards = summary ? [
    {
      title: t('dash.portfolioValue'),
      value: formatCurrency(summary.totalValue),
      change: formatPercent(summary.todayPnlPercent),
      positive: summary.todayPnl >= 0,
      icon: DollarSign,
    },
    {
      title: t('dash.todayPnl'),
      value: formatCurrency(summary.todayPnl),
      change: formatPercent(summary.todayPnlPercent),
      positive: summary.todayPnl >= 0,
      icon: summary.todayPnl >= 0 ? TrendingUp : TrendingDown,
    },
    {
      title: t('dash.activePositions'),
      value: summary.activePositions.toString(),
      change: t('dash.openTrades'),
      positive: true,
      icon: Briefcase,
    },
    {
      title: t('dash.winRate'),
      value: `${summary.winRate}%`,
      change: summary.winRate >= 60 ? t('dash.aboveTarget') : t('dash.belowTarget'),
      positive: summary.winRate >= 60,
      icon: Target,
    },
  ] : [];

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-[#111118]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl bg-[#111118]" />
          <Skeleton className="h-48 rounded-xl bg-[#111118]" />
          <Skeleton className="h-48 rounded-xl bg-[#111118]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-zinc-400 font-medium">{card.title}</span>
                  <div className="w-9 h-9 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                  <div className="flex items-center gap-1.5">
                    {card.positive ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-xs font-medium ${card.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {card.change}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Market Indices + Portfolio Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Market Indices */}
        <Card className="lg:col-span-2 bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white">{t('dash.marketIndices')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchData}
                className="h-7 px-2 text-zinc-400 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(indices || defaultIndices).map((index) => (
                <div
                  key={index.symbol}
                  className="bg-[#0a0a0f] rounded-lg p-4 border border-[#1e1e2e] hover:border-[#2e2e3e] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-400">{index.name}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${
                        index.change >= 0
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : 'bg-red-600/15 text-red-400 border-red-600/20'
                      }`}
                    >
                      {index.change >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-white">{index.price.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {index.change >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-xs font-medium ${index.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)}
                    </span>
                  </div>
                  {/* Mini sparkline */}
                  <div className="mt-3 h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={miniSparklineData}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={index.change >= 0 ? '#10b981' : '#ef4444'}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
            {lastUpdated && (
              <p className="text-[10px] text-zinc-600 mt-3 text-right">
                {t('dash.lastUpdated')}: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Portfolio Allocation */}
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white">{t('dash.allocation')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#1a1a2e',
                      border: '1px solid #2e2e3e',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {allocationData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-zinc-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-medium text-zinc-300">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Trades */}
        <Card className="lg:col-span-2 bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white">{t('dash.recentTrades')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs">{t('dash.symbol')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('dash.side')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('dash.price')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('dash.qty')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">{t('dash.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(trades || defaultTrades).map((trade) => (
                    <TableRow key={trade.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-white">{trade.symbol}</p>
                          <p className="text-xs text-zinc-500">{trade.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${
                            trade.side === 'BUY'
                              ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                              : 'bg-red-600/15 text-red-400 border-red-600/20'
                          }`}
                        >
                          {trade.side === 'BUY' ? t('common.buy') : t('common.sell')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300">${trade.price.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-zinc-300">{trade.quantity}</TableCell>
                      <TableCell className="text-sm text-white text-right font-medium">
                        {formatCurrency(trade.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white">{t('dash.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-start gap-2">
              <Radar className="w-4 h-4" />
              {t('dash.scanSignals')}
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white justify-start gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('dash.addPosition')}
            </Button>
            <div className="pt-4 border-t border-[#1e1e2e] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{t('dash.marketStatus')}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
                  <span className="text-xs text-emerald-400 font-medium">{t('dash.open')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{t('dash.nextClose')}</span>
                <span className="text-xs text-zinc-300 font-medium">4:00 PM ET</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{t('dash.activeAlerts')}</span>
                <span className="text-xs text-emerald-400 font-medium">3</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
