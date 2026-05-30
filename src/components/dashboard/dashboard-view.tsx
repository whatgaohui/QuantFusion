'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Loader2,
  AlertTriangle,
  Shield,
  Circle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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

interface SignalAlert {
  id: string;
  symbol: string;
  message: string;
  type: 'signal' | 'price' | 'position' | 'risk';
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface AllocationEntry {
  name: string;
  value: number;
  color: string;
  dollarValue?: number;
}

/** 市场红绿灯数据 */
interface MarketTrafficLight {
  market: string;
  marketName: string;
  trafficLight: 'GREEN' | 'YELLOW' | 'RED';
  overallScore: number;
  dimensions: {
    name: string;
    score: number;
    signal: 'bullish' | 'neutral' | 'bearish';
    detail: string;
  }[];
  summary: string;
  updatedAt: string;
}

interface MarketReviewData {
  markets: MarketTrafficLight[];
  overallLight: 'GREEN' | 'YELLOW' | 'RED';
  overallScore: number;
  overallSummary: string;
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
  { symbol: '000001', name: 'SSE Composite', price: 3156.28, change: 12.45, changePercent: 0.40, market: 'A' },
  { symbol: '399001', name: 'SZSE Component', price: 10245.67, change: 53.21, changePercent: 0.52, market: 'A' },
  { symbol: 'HSI', name: 'Hang Seng', price: 18942.35, change: 154.32, changePercent: 0.82, market: 'HK' },
  { symbol: '^GSPC', name: 'S&P 500', price: 5248.32, change: 28.45, changePercent: 0.54, market: 'US' },
  { symbol: '^IXIC', name: 'NASDAQ', price: 16742.39, change: 156.78, changePercent: 0.94, market: 'US' },
  { symbol: '^DJI', name: 'DOW', price: 39142.23, change: -45.12, changePercent: -0.12, market: 'US' },
];

const defaultTrades: Trade[] = [
  { id: '1', symbol: 'AAPL', name: 'Apple Inc.', side: 'BUY', price: 189.45, quantity: 50, total: 9472.50, timestamp: '2024-01-15T10:30:00Z' },
  { id: '2', symbol: 'NVDA', name: 'NVIDIA Corp.', side: 'BUY', price: 615.20, quantity: 20, total: 12304.00, timestamp: '2024-01-15T09:45:00Z' },
  { id: '3', symbol: 'TSLA', name: 'Tesla Inc.', side: 'SELL', price: 245.80, quantity: 30, total: 7374.00, timestamp: '2024-01-14T14:20:00Z' },
  { id: '4', symbol: 'MSFT', name: 'Microsoft Corp.', side: 'BUY', price: 388.50, quantity: 25, total: 9712.50, timestamp: '2024-01-14T11:15:00Z' },
  { id: '5', symbol: 'META', name: 'Meta Platforms', side: 'SELL', price: 374.20, quantity: 15, total: 5613.00, timestamp: '2024-01-13T15:45:00Z' },
];

const INDEX_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', '^HSI', '000001.SS', '399001.SZ'];

const ALLOCATION_COLORS = ['#10b981', '#0FEDBE', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#3b82f6'];

const defaultAllocationData: AllocationEntry[] = [
  { name: 'Technology', value: 35, color: '#10b981' },
  { name: 'Healthcare', value: 20, color: '#0FEDBE' },
  { name: 'Finance', value: 18, color: '#22c55e' },
  { name: 'Energy', value: 15, color: '#f59e0b' },
  { name: 'Consumer', value: 12, color: '#8b5cf6' },
];

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatAlertTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function getAlertIcon(type: string) {
  switch (type) {
    case 'signal': return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
    case 'price': return <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />;
    case 'position': return <Briefcase className="w-3.5 h-3.5 text-purple-400" />;
    case 'risk': return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    default: return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
  }
}

function getAlertBg(type: string) {
  switch (type) {
    case 'signal': return 'bg-emerald-600/10';
    case 'price': return 'bg-yellow-600/10';
    case 'position': return 'bg-purple-600/10';
    case 'risk': return 'bg-red-600/10';
    default: return 'bg-emerald-600/10';
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'high': return 'bg-red-600/15 text-red-400 border-red-600/20';
    case 'medium': return 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20';
    case 'low': return 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';
    default: return 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';
  }
}

/** 红绿灯组件 */
function TrafficLightIndicator({ light, size = 'md' }: { light: 'GREEN' | 'YELLOW' | 'RED'; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
  const colors: Record<string, { bg: string; ring: string; glow: string }> = {
    GREEN: { bg: 'bg-emerald-500', ring: 'ring-emerald-500/30', glow: 'shadow-emerald-500/50' },
    YELLOW: { bg: 'bg-yellow-500', ring: 'ring-yellow-500/30', glow: 'shadow-yellow-500/50' },
    RED: { bg: 'bg-red-500', ring: 'ring-red-500/30', glow: 'shadow-red-500/50' },
  };
  const c = colors[light];

  return (
    <div className={`${sizeClass} rounded-full ${c.bg} ring-2 ${c.ring} shadow-lg ${c.glow} flex items-center justify-center`}>
      <Circle className={`${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} text-white/80 fill-current`} />
    </div>
  );
}

interface DashboardViewProps {
  onNavigate?: (view: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [indices, setIndices] = useState<MarketIndex[] | null>(null);
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [briefContent, setBriefContent] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefProvider, setBriefProvider] = useState<string>('');
  const [alerts, setAlerts] = useState<SignalAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [sparklineData, setSparklineData] = useState<Record<string, { v: number }[]>>({});
  const [summaryIsMock, setSummaryIsMock] = useState(true);
  const alertsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 市场红绿灯状态
  const [marketReview, setMarketReview] = useState<MarketReviewData | null>(null);
  const [marketReviewLoading, setMarketReviewLoading] = useState(true);

  const fetchSparklines = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        INDEX_SYMBOLS.map(async (symbol) => {
          const res = await fetch(`/api/fusion/market/kline?symbol=${encodeURIComponent(symbol)}&resolution=D`);
          if (res.ok) {
            const data = await res.json();
            if (data.c && Array.isArray(data.c) && data.c.length > 0) {
              const closes = data.c.slice(-30);
              return { symbol, data: closes.map((v: number) => ({ v })) };
            }
          }
          return { symbol, data: [] as { v: number }[] };
        })
      );

      const newData: Record<string, { v: number }[]> = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          newData[INDEX_SYMBOLS[i]] = result.value.data;
        }
      });

      setSparklineData(prev => {
        const merged = { ...prev };
        Object.keys(newData).forEach(k => {
          if (newData[k].length > 0) merged[k] = newData[k];
        });
        return merged;
      });
    } catch {
      // Silently fail
    }
  }, []);

  const fetchBrief = useCallback(async () => {
    setBriefLoading(true);
    try {
      const res = await fetch('/api/fusion/market/brief');
      if (res.ok) {
        const data = await res.json();
        setBriefContent(data.content);
        setBriefProvider(data.provider);
      } else {
        setBriefContent(t('dash.aiBriefContent'));
        setBriefProvider('fallback');
      }
    } catch {
      setBriefContent(t('dash.aiBriefContent'));
      setBriefProvider('fallback');
    } finally {
      setBriefLoading(false);
    }
  }, [t]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAlerts(data);
        }
      }
    } catch {
      // Keep existing alerts
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const handleScanSignals = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/alerts/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setScanResult(`Scanned ${data.scanned} stocks, ${data.newAlerts} new alerts`);
        await fetchAlerts();
      } else {
        setScanResult('Scan failed');
      }
    } catch {
      setScanResult('Scan failed');
    } finally {
      setScanning(false);
      setTimeout(() => setScanResult(null), 5000);
    }
  }, [fetchAlerts]);

  const [allocationData, setAllocationData] = useState<AllocationEntry[]>(defaultAllocationData);
  const [allocationIsLive, setAllocationIsLive] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);

  const fetchAllocation = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio/positions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const grouped: Record<string, number> = {};
          let totalValue = 0;
          for (const pos of data) {
            const symbol = pos.symbol || 'Unknown';
            const value = (pos.quantity || 0) * (pos.currentPrice || pos.avgCost || 0);
            grouped[symbol] = (grouped[symbol] || 0) + value;
            totalValue += value;
          }

          if (totalValue > 0) {
            const entries = Object.entries(grouped)
              .sort((a, b) => b[1] - a[1]);

            const top = entries.slice(0, 6);
            const othersValue = entries.slice(6).reduce((sum, [, v]) => sum + v, 0);

            const result: AllocationEntry[] = top.map(([name, value], i) => ({
              name,
              value: Math.round((value / totalValue) * 100),
              color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
              dollarValue: value,
            }));

            if (othersValue > 0) {
              result.push({
                name: 'Others',
                value: Math.round((othersValue / totalValue) * 100),
                color: ALLOCATION_COLORS[6],
                dollarValue: othersValue,
              });
            }

            setAllocationData(result);
            setAllocationIsLive(true);
            setTotalPortfolioValue(totalValue);
          } else {
            setAllocationData(defaultAllocationData);
            setAllocationIsLive(false);
          }
        } else {
          setAllocationData(defaultAllocationData);
          setAllocationIsLive(false);
        }
      } else {
        setAllocationData(defaultAllocationData);
        setAllocationIsLive(false);
      }
    } catch {
      setAllocationData(defaultAllocationData);
      setAllocationIsLive(false);
    }
  }, []);

  // 获取市场红绿灯
  const fetchMarketReview = useCallback(async () => {
    setMarketReviewLoading(true);
    try {
      const res = await fetch('/api/fusion/market/market-review');
      if (res.ok) {
        const data = await res.json();
        setMarketReview(data);
      }
    } catch {
      // 保持现有数据
    } finally {
      setMarketReviewLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, sp500Res, nasdaqRes, dowRes, hsiRes, sseRes, szseRes, tradesRes] = await Promise.allSettled([
        fetch('/api/portfolio/summary'),
        fetch('/api/fusion/market/quote?symbol=^GSPC'),
        fetch('/api/fusion/market/quote?symbol=^IXIC'),
        fetch('/api/fusion/market/quote?symbol=^DJI'),
        fetch('/api/fusion/market/quote?symbol=^HSI'),
        fetch('/api/fusion/market/quote?symbol=000001.SS'),
        fetch('/api/fusion/market/quote?symbol=399001.SZ'),
        fetch('/api/trades'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const data = await summaryRes.value.json();
        setSummary({
          totalValue: data.totalValue ?? 0,
          todayPnl: data.todayPnl ?? 0,
          todayPnlPercent: data.todayPnlPercent ?? data.totalProfitPct ?? 0,
          totalPnl: data.totalPnl ?? data.totalProfit ?? 0,
          totalPnlPercent: data.totalPnlPercent ?? 0,
          activePositions: data.activePositions ?? 0,
          winRate: data.winRate ?? 0,
          totalInvested: data.totalInvested ?? data.totalCost ?? 0,
        });
        setSummaryIsMock(false);
      } else {
        setSummary(defaultSummary);
        setSummaryIsMock(true);
      }

      const indexResults: MarketIndex[] = [];
      const indexData = [
        { res: sseRes, symbol: '000001.SS', name: 'SSE Composite', market: 'A' },
        { res: szseRes, symbol: '399001.SZ', name: 'SZSE Component', market: 'A' },
        { res: hsiRes, symbol: '^HSI', name: 'Hang Seng', market: 'HK' },
        { res: sp500Res, symbol: '^GSPC', name: 'S&P 500', market: 'US' },
        { res: nasdaqRes, symbol: '^IXIC', name: 'NASDAQ', market: 'US' },
        { res: dowRes, symbol: '^DJI', name: 'DOW', market: 'US' },
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
              market: idx.market,
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
      setSummaryIsMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchBrief();
    fetchAlerts();
    fetchAllocation();
    fetchSparklines();
    fetchMarketReview();

    const dataInterval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 120000);
    alertsIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchAlerts();
    }, 180000);
    const sparklineInterval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchSparklines();
    }, 300000);
    const marketReviewInterval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMarketReview();
    }, 600000); // 10-minute refresh for market review

    // Re-fetch when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
        fetchAlerts();
        fetchSparklines();
        fetchMarketReview();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(dataInterval);
      if (alertsIntervalRef.current) clearInterval(alertsIntervalRef.current);
      clearInterval(sparklineInterval);
      clearInterval(marketReviewInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, fetchBrief, fetchAlerts, fetchAllocation, fetchSparklines, fetchMarketReview]);

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
      {/* Metric Cards */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">{t('dash.portfolioOverview')}</h3>
        {summaryIsMock && (
          <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[9px] border">DEMO DATA</Badge>
        )}
      </div>
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

      {/* 市场红绿灯组件 */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('dash.marketTrafficLight')}</CardTitle>
              {marketReview && (
                <Badge className={`text-[9px] border ${
                  marketReview.overallLight === 'GREEN' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                  marketReview.overallLight === 'RED' ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                  'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                }`}>
                  {marketReview.overallScore}/100
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMarketReview}
              disabled={marketReviewLoading}
              className="h-7 px-2 text-zinc-400 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${marketReviewLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {marketReviewLoading && !marketReview ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg bg-[#0a0a0f]" />
              ))}
            </div>
          ) : marketReview ? (
            <div className="space-y-3">
              {/* 三市场红绿灯 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {marketReview.markets.map((market) => (
                  <div
                    key={market.market}
                    className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] hover:border-[#2e2e3e] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrafficLightIndicator light={market.trafficLight} size="sm" />
                        <span className="text-sm font-semibold text-white">{market.marketName}</span>
                      </div>
                      <Badge className={`text-[9px] border ${
                        market.trafficLight === 'GREEN' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                        market.trafficLight === 'RED' ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                        'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                      }`}>
                        {market.overallScore}
                      </Badge>
                    </div>
                    <Progress
                      value={market.overallScore}
                      className="h-1.5 bg-[#1e1e2e] mb-2"
                    />
                    {/* 分项指标 */}
                    <div className="flex flex-wrap gap-1">
                      {market.dimensions.slice(0, 3).map((dim) => (
                        <div key={dim.name} className="flex items-center gap-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            dim.signal === 'bullish' ? 'bg-emerald-400' :
                            dim.signal === 'bearish' ? 'bg-red-400' :
                            'bg-yellow-400'
                          }`} />
                          <span className="text-[9px] text-zinc-500">{dim.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 综合解读 */}
              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                <div className="flex items-center gap-2 mb-1">
                  <TrafficLightIndicator light={marketReview.overallLight} size="sm" />
                  <span className="text-xs font-medium text-white">{t('dash.overallSignal')}</span>
                  <Badge className={`text-[9px] border ${
                    marketReview.overallLight === 'GREEN' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                    marketReview.overallLight === 'RED' ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                    'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                  }`}>
                    {marketReview.overallLight === 'GREEN' ? t('dash.signalGreen') :
                     marketReview.overallLight === 'RED' ? t('dash.signalRed') :
                     t('dash.signalYellow')}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{marketReview.overallSummary}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Zap className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">{t('dash.noTrafficLightData')}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                      {index.market}
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
                      <LineChart data={sparklineData[index.symbol] || []}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={index.change >= 0 ? '#10b981' : '#ef4444'}
                          strokeWidth={1}
                          dot={false}
                          isAnimationActive={false}
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white">{t('dash.allocation')}</CardTitle>
              {allocationIsLive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-600/15 border border-emerald-600/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-emerald-400">LIVE</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-36 relative">
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
                    formatter={(value: number, name: string, props: { payload?: AllocationEntry }) => {
                      const entry = props.payload;
                      if (entry?.dollarValue != null) {
                        return [`${value}% (${formatCurrency(entry.dollarValue)})`, name];
                      }
                      return [`${value}%`, name];
                    }}
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
              {allocationIsLive && totalPortfolioValue > 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500">Total</p>
                    <p className="text-xs font-bold text-white">{formatCurrency(totalPortfolioValue)}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5 mt-1">
              {allocationData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-zinc-400">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.dollarValue != null && (
                      <span className="text-[10px] text-zinc-500">{formatCurrency(item.dollarValue)}</span>
                    )}
                    <span className="text-xs font-medium text-zinc-300">{item.value}%</span>
                  </div>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('dash.aiBrief')}</CardTitle>
                <Badge className={`text-[9px] ${briefProvider === 'z-ai' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' : briefProvider === 'mock' ? 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20' : 'bg-purple-600/15 text-purple-400 border-purple-600/20'}`}>
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />{briefProvider === 'z-ai' ? 'AI' : briefProvider === 'mock' ? 'MOCK' : 'AI'}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchBrief}
                disabled={briefLoading}
                className="h-7 px-2 text-zinc-400 hover:text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${briefLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500 mb-2">{t('dash.aiBriefDesc')}</p>
            {briefLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full bg-[#1a1a2e]" />
                <Skeleton className="h-3 w-4/5 bg-[#1a1a2e]" />
                <Skeleton className="h-3 w-3/5 bg-[#1a1a2e]" />
              </div>
            ) : (
              <>
                {briefProvider === 'mock' && (
                  <div className="flex items-center gap-1.5 p-2 mb-2 rounded-lg bg-yellow-600/10 border border-yellow-600/20">
                    <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                    <span className="text-[10px] text-yellow-400">{t('dash.mockDataWarning') || 'Using simulated data — connect API for live analysis'}</span>
                  </div>
                )}
                <p className="text-sm text-zinc-300 leading-relaxed">{briefContent || t('dash.aiBriefContent')}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white">{t('dash.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white justify-start gap-2 h-9 text-sm" onClick={() => onNavigate?.('aiAnalysis')}>
              <Brain className="w-4 h-4" />
              {t('dash.analyzeStock')}
            </Button>
            <Button className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/20 justify-start gap-2 h-9 text-sm" onClick={() => onNavigate?.('scanner')}>
              <Radar className="w-4 h-4" />
              {t('dash.scanSignals')}
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white justify-start gap-2 h-9 text-sm"
              onClick={() => onNavigate?.('strategies')}
            >
              <Target className="w-4 h-4" />
              {t('dash.viewStrategies')}
            </Button>
            <Button
              variant="outline"
              className="w-full border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white justify-start gap-2 h-9 text-sm"
              onClick={() => onNavigate?.('watchlist')}
            >
              <Plus className="w-4 h-4" />
              {t('dash.addPosition')}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('dash.recentAlerts')}</CardTitle>
                {alerts.length > 0 && (
                  <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px] px-1.5 py-0">
                    {alerts.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleScanSignals}
                disabled={scanning}
                className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/10"
                title={t('dash.scanNow')}
              >
                {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scanResult && (
              <div className="mb-2 p-2 bg-emerald-600/10 rounded-lg border border-emerald-600/20">
                <p className="text-[11px] text-emerald-400">{scanResult}</p>
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {alertsLoading && alerts.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full bg-[#0a0a0f] rounded-lg" />
                  ))}
                </div>
              ) : alerts.length > 0 ? (
                alerts.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] hover:border-[#2e2e3e] transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${getAlertBg(alert.type)}`}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{alert.symbol}</span>
                        <Badge className={`text-[8px] px-1 py-0 border ${getPriorityBadge(alert.priority)}`}>
                          {alert.priority}
                        </Badge>
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">{alert.message}</p>
                      <p className="text-[10px] text-zinc-600">{formatAlertTime(alert.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <Shield className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">{t('dash.noAlerts')}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">{t('dash.clickScanHint')}</p>
                  <Button
                    size="sm"
                    onClick={handleScanSignals}
                    disabled={scanning}
                    className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-7 text-xs"
                  >
                    {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
                    {scanning ? t('dash.scanning') : t('dash.scanNow')}
                  </Button>
                </div>
              )}
            </div>
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
