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
  Brain,
  Zap,
  ChevronRight,
  Sparkles,
  Bell,
  AlertTriangle,
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
  totalPnl: number;
  totalPnlPercent: number;
  activePositions: number;
  winRate: number;
  totalInvested: number;
}

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  market: string;
}

interface AlertItem {
  id: string;
  symbol: string;
  alertType: string;
  targetValue: number;
  isActive: boolean;
  isTriggered: boolean;
  createdAt: string;
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
  totalPnl: 25750.50,
  totalPnlPercent: 25.75,
  activePositions: 8,
  winRate: 68.5,
  totalInvested: 100000,
};

const defaultIndices: MarketIndex[] = [
  { symbol: 'SH000001', name: 'SSE Composite', price: 3156.28, change: 12.45, changePercent: 0.40, market: 'A' },
  { symbol: 'SZ399001', name: 'SZSE Component', price: 10245.67, change: 53.21, changePercent: 0.52, market: 'A' },
  { symbol: 'HSI', name: 'Hang Seng', price: 18942.35, change: 154.32, changePercent: 0.82, market: 'HK' },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 189.45, change: 1.23, changePercent: 0.65, market: 'US' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.65, change: 0.89, changePercent: 0.63, market: 'US' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 388.50, change: 2.15, changePercent: 0.56, market: 'US' },
];

const defaultTrades: Trade[] = [
  { id: '1', symbol: 'AAPL', name: 'Apple Inc.', side: 'BUY', price: 189.45, quantity: 50, total: 9472.50, timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: '2', symbol: 'NVDA', name: 'NVIDIA Corp.', side: 'BUY', price: 615.20, quantity: 20, total: 12304.00, timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '3', symbol: 'TSLA', name: 'Tesla Inc.', side: 'SELL', price: 245.80, quantity: 30, total: 7374.00, timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: '4', symbol: 'MSFT', name: 'Microsoft Corp.', side: 'BUY', price: 388.50, quantity: 25, total: 9712.50, timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: '5', symbol: 'META', name: 'Meta Platforms', side: 'SELL', price: 374.20, quantity: 15, total: 5613.00, timestamp: new Date(Date.now() - 2 * 86400000).toISOString() },
];

const defaultAlerts: AlertItem[] = [
  { id: '1', symbol: 'NVDA', alertType: 'price_above', targetValue: 650, isActive: true, isTriggered: false, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: '2', symbol: 'AAPL', alertType: 'price_above', targetValue: 195, isActive: true, isTriggered: true, createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: '3', symbol: 'TSLA', alertType: 'price_below', targetValue: 240, isActive: true, isTriggered: false, createdAt: new Date(Date.now() - 8 * 3600000).toISOString() },
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

function getAlertTypeLabel(alertType: string): string {
  switch (alertType) {
    case 'price_above': return 'price';
    case 'price_below': return 'price';
    case 'volume': return 'signal';
    case 'rsi': return 'signal';
    case 'macd': return 'signal';
    default: return 'signal';
  }
}

export function DashboardView() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [indices, setIndices] = useState<MarketIndex[] | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const allocationData = [
    { name: t('alloc.technology'), value: 35, color: '#10b981' },
    { name: t('alloc.healthcare'), value: 20, color: '#0FEDBE' },
    { name: t('alloc.finance'), value: 18, color: '#22c55e' },
    { name: t('alloc.energy'), value: 15, color: '#f59e0b' },
    { name: t('alloc.consumer'), value: 12, color: '#8b5cf6' },
  ];

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch indices via fusion batch quote API
      // A-share indices: SH000001, SZ399001
      // HK index: HSI
      // US stocks as proxy for US market (free Finnhub doesn't have index quotes)
      const indexSymbols = 'SH000001,SZ399001,HSI,AAPL,GOOGL,MSFT';

      // Sequential fetch to prevent server crashes in resource-constrained environments
      let summaryRes: Response | null = null;
      let indicesRes: Response | null = null;
      let alertsRes: Response | null = null;

      try { summaryRes = await fetch('/api/portfolio/summary'); } catch { /* ignore */ }
      try { indicesRes = await fetch(`/api/fusion/market/quote?symbols=${indexSymbols}`); } catch { /* ignore */ }
      try { alertsRes = await fetch('/api/alerts'); } catch { /* ignore */ }

      // Process portfolio summary
      if (summaryRes && summaryRes.ok) {
        try {
          const data = await summaryRes.json();
          const apiSummary: PortfolioSummary = {
            totalValue: data.totalValue ?? 0,
            todayPnl: data.todayPnl ?? 0,
            todayPnlPercent: data.todayPnlPercent ?? data.totalProfitPct ?? 0,
            totalPnl: data.totalPnl ?? data.totalProfit ?? 0,
            totalPnlPercent: data.totalPnlPercent ?? 0,
            activePositions: data.activePositions ?? 0,
            winRate: data.winRate ?? 0,
            totalInvested: data.totalInvested ?? data.totalCost ?? 0,
          };
          // If API returns empty/zero data, use demo fallback
          if (apiSummary.totalValue <= 0 || (apiSummary.totalPnl === 0 && apiSummary.winRate === 0 && apiSummary.activePositions <= 1)) {
            setSummary(defaultSummary);
          } else {
            setSummary(apiSummary);
          }
        } catch {
          setSummary(defaultSummary);
        }
      } else {
        setSummary(defaultSummary);
      }

      // Process indices from fusion batch quote
      if (indicesRes && indicesRes.ok) {
        try {
          const result = await indicesRes.json();
          if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            const indexResults: MarketIndex[] = result.data.map((q: { symbol: string; name: string; currentPrice: number; change: number; changePercent: number; market: string }) => ({
              symbol: q.symbol,
              name: q.name || q.symbol,
              price: q.currentPrice || 0,
              change: q.change || 0,
              changePercent: q.changePercent || 0,
              market: q.market || 'US',
            }));
            setIndices(indexResults);
          } else {
            setIndices(defaultIndices);
          }
        } catch {
          setIndices(defaultIndices);
        }
      } else {
        setIndices(defaultIndices);
        if (!indicesRes) {
          setError(t('dash.fetchError'));
        }
      }

      // Process alerts
      if (alertsRes && alertsRes.ok) {
        try {
          const data = await alertsRes.json();
          if (Array.isArray(data) && data.length > 0) {
            const mappedAlerts: AlertItem[] = data.slice(0, 5).map((a: { id: string; symbol: string; alertType: string; targetValue: number; isActive: boolean; isTriggered: boolean; createdAt: string }) => ({
              id: a.id,
              symbol: a.symbol,
              alertType: a.alertType || 'custom',
              targetValue: a.targetValue || 0,
              isActive: a.isActive ?? true,
              isTriggered: a.isTriggered ?? false,
              createdAt: a.createdAt || new Date().toISOString(),
            }));
            setAlerts(mappedAlerts);
          } else {
            setAlerts(defaultAlerts);
          }
        } catch {
          setAlerts(defaultAlerts);
        }
      } else {
        setAlerts(defaultAlerts);
      }

      // Fetch recent trades (from trade logs)
      try {
        const tradesRes = await fetch('/api/portfolio/positions');
        if (tradesRes.ok) {
          const data = await tradesRes.json();
          if (Array.isArray(data) && data.length > 0) {
            // Map positions as recent trades (open positions represent recent activity)
            const recentTrades: Trade[] = data.slice(0, 5).map((p: { id: string; symbol: string; market: string; side: string; avgCost: number; quantity: number; openedAt: string }) => ({
              id: p.id,
              symbol: p.symbol,
              name: p.symbol,
              side: (p.side === 'long' ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
              price: p.avgCost || 0,
              quantity: p.quantity || 0,
              total: (p.avgCost || 0) * (p.quantity || 0),
              timestamp: p.openedAt || new Date().toISOString(),
            }));
            setTrades(recentTrades.length > 0 ? recentTrades : defaultTrades);
          } else {
            setTrades(defaultTrades);
          }
        } else {
          setTrades(defaultTrades);
        }
      } catch {
        setTrades(defaultTrades);
      }

      setLastUpdated(new Date());
    } catch {
      setError(t('dash.fetchError'));
      setSummary(defaultSummary);
      setIndices(defaultIndices);
      setTrades(defaultTrades);
      setAlerts(defaultAlerts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
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
      title: t('dash.totalPnl'),
      value: formatCurrency(summary.totalPnl),
      change: formatPercent(summary.totalPnlPercent),
      positive: summary.totalPnl >= 0,
      icon: summary.totalPnl >= 0 ? TrendingUp : TrendingDown,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
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
      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-yellow-400">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData()}
            className="ml-auto h-6 px-2 text-yellow-400 hover:text-yellow-300 text-xs"
          >
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400 font-medium">{card.title}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-white">{card.value}</p>
                  <div className="flex items-center gap-1">
                    {card.positive ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-[11px] font-medium ${card.positive ? 'text-emerald-400' : 'text-red-400'}`}>
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
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="h-7 px-2 text-zinc-400 hover:text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(indices || defaultIndices).map((index) => (
                <div
                  key={index.symbol}
                  className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] hover:border-[#2e2e3e] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-zinc-400 truncate">{index.name}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[8px] px-1 py-0 ${
                        index.market === 'A' ? 'bg-red-600/15 text-red-400' :
                        index.market === 'HK' ? 'bg-yellow-600/15 text-yellow-400' :
                        'bg-emerald-600/15 text-emerald-400'
                      }`}
                    >
                      {index.market === 'A' ? t('dash.marketA') :
                       index.market === 'HK' ? t('dash.marketHK') : t('dash.marketUS')}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-white">{index.price.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {index.change >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-[10px] font-medium ${index.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {index.change >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-2 h-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={miniSparklineData}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={index.change >= 0 ? '#10b981' : '#ef4444'}
                          strokeWidth={1}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
            {lastUpdated && (
              <p className="text-[10px] text-zinc-600 mt-2 text-right">
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
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
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
            <div className="space-y-1.5 mt-1">
              {allocationData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-zinc-400">{item.name}</span>
                  </div>
                  <span className="text-xs font-medium text-zinc-300">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Market Brief + Quick Actions + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Market Brief */}
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('dash.aiBrief')}</CardTitle>
              <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[9px]">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />AI
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500 mb-2">{t('dash.aiBriefDesc')}</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{t('dash.aiBriefContent')}</p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white">{t('dash.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-start gap-2 h-9 text-sm">
              <Brain className="w-4 h-4" />
              {t('dash.analyzeStock')}
            </Button>
            <Button className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/20 justify-start gap-2 h-9 text-sm">
              <Radar className="w-4 h-4" />
              {t('dash.scanSignals')}
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white justify-start gap-2 h-9 text-sm"
            >
              <Target className="w-4 h-4" />
              {t('dash.viewStrategies')}
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white justify-start gap-2 h-9 text-sm"
            >
              <Plus className="w-4 h-4" />
              {t('dash.addPosition')}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('dash.recentAlerts')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(alerts || defaultAlerts).map((alert) => {
              const alertType = getAlertTypeLabel(alert.alertType);
              const timeAgo = (() => {
                const diff = Date.now() - new Date(alert.createdAt).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 1) return t('common.justNow');
                if (mins < 60) return `${mins}${t('common.minutesAgo')}`;
                const hours = Math.floor(mins / 60);
                if (hours < 24) return `${hours}${t('common.hoursAgo')}`;
                return `${Math.floor(hours / 24)}${t('common.daysAgo')}`;
              })();
              return (
                <div key={alert.id} className="flex items-start gap-3 p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alertType === 'signal' ? 'bg-emerald-600/10' :
                    alertType === 'price' ? 'bg-yellow-600/10' :
                    'bg-purple-600/10'
                  }`}>
                    {alertType === 'signal' ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> :
                     alertType === 'price' ? <TrendingUp className="w-3.5 h-3.5 text-yellow-400" /> :
                     <Briefcase className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{alert.symbol}</span>
                      <ChevronRight className="w-3 h-3 text-zinc-600" />
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {alert.alertType === 'price_above' ? `${t('watch.priceGoesAbove')} $${alert.targetValue.toFixed(2)}` :
                       alert.alertType === 'price_below' ? `${t('watch.priceGoesBelow')} $${alert.targetValue.toFixed(2)}` :
                       `${alert.alertType}: ${alert.targetValue}`}
                    </p>
                    <p className="text-[10px] text-zinc-600">{timeAgo}</p>
                  </div>
                  {alert.isTriggered && (
                    <Badge className="bg-emerald-600/15 text-emerald-400 text-[8px] px-1 py-0">Triggered</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
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
    </div>
  );
}
