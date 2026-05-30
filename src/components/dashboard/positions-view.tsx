'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Shield,
  Activity,
  Layers,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLanguage } from '@/lib/i18n';

interface PositionLot {
  id: string;
  quantity: number;
  costPrice: number;
  openDate: string;
  closeDate?: string | null;
  closePrice?: number | null;
  realizedPnl: number;
}

interface Position {
  id: string;
  symbol: string;
  name: string;
  buyPrice: number;
  currentPrice: number;
  quantity: number;
  buyDate: string;
  cycleDays: number;
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
  remainingDays: number;
  status: 'ACTIVE' | 'CLOSED';
  lots?: PositionLot[];
  market?: string;
}

interface PositionSummary {
  totalInvested: number;
  totalPnl: number;
  avgHoldingDays: number;
  activeCount: number;
  closedCount: number;
}

interface RiskMetrics {
  var95: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

const zeroRiskMetrics: RiskMetrics = {
  var95: 0,
  sharpeRatio: 0,
  maxDrawdown: 0,
};

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}

function calculateRiskMetrics(positions: Position[]): RiskMetrics {
  if (positions.length === 0) return zeroRiskMetrics;

  const totalValue = positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
  const returns = positions.map(p => p.pnlPercent / 100);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // VaR 95% (1-day, parametric)
  const var95 = -(totalValue * 1.65 * stdDev / Math.sqrt(252));

  // Sharpe Ratio (annualized, assuming risk-free rate of 5%)
  const annualReturn = avgReturn * 252;
  const annualStdDev = stdDev * Math.sqrt(252);
  const sharpeRatio = annualStdDev > 0 ? (annualReturn - 0.05) / annualStdDev : 0;

  // Max Drawdown (from positions)
  const pnlValues = positions.map(p => p.pnl);
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  for (const pnl of pnlValues) {
    cumulative += pnl;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  const maxDrawdownPercent = totalValue > 0 ? -(maxDrawdown / totalValue) * 100 : 0;

  return {
    var95: parseFloat(var95.toFixed(0)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdownPercent.toFixed(1)),
  };
}

export function PositionsView() {
  const { t } = useLanguage();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [closedPositions, setClosedPositions] = useState<Position[] | null>(null);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
  const [isDemoRisk, setIsDemoRisk] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      let positionsRes: Response | null = null;
      let summaryRes: Response | null = null;
      try { positionsRes = await fetch('/api/portfolio/positions'); } catch { /* ignore */ }
      try { summaryRes = await fetch('/api/portfolio/summary'); } catch { /* ignore */ }

      let activePositions: Position[] = [];
      let closedPositionsList: Position[] = [];

      if (positionsRes && positionsRes.ok) {
        const data = await positionsRes.json();
        if (Array.isArray(data) && data.length > 0) {
          // Map DB positions to our Position interface
          const allPositions: Position[] = data.map((p: {
            id: string;
            symbol: string;
            market?: string;
            side?: string;
            avgCost: number;
            quantity: number;
            currentPrice: number;
            unrealizedPnl: number;
            realizedPnl: number;
            openedAt: string;
            closedAt?: string | null;
            status: string;
            lots?: PositionLot[];
            notes?: string | null;
          }) => {
            const cost = p.avgCost * p.quantity;
            const currentValue = p.currentPrice * p.quantity;
            const pnl = p.unrealizedPnl || (currentValue - cost);
            const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
            const openedAt = new Date(p.openedAt);
            const now = new Date();
            const holdingDays = Math.floor((now.getTime() - openedAt.getTime()) / 86400000);
            const cycleDays = 7; // Default cycle
            const remainingDays = Math.max(0, cycleDays - holdingDays);

            return {
              id: p.id,
              symbol: p.symbol,
              name: p.symbol,
              buyPrice: p.avgCost,
              currentPrice: p.currentPrice || p.avgCost,
              quantity: p.quantity,
              buyDate: openedAt.toISOString().split('T')[0],
              cycleDays,
              pnl: parseFloat(pnl.toFixed(2)),
              pnlPercent: parseFloat(pnlPercent.toFixed(2)),
              holdingDays,
              remainingDays,
              status: p.status === 'open' ? 'ACTIVE' as const : 'CLOSED' as const,
              lots: p.lots || undefined,
              market: p.market,
            };
          });

          activePositions = allPositions.filter(p => p.status === 'ACTIVE');
          closedPositionsList = allPositions.filter(p => p.status === 'CLOSED');

          setPositions(activePositions.length > 0 ? activePositions : []);
          setClosedPositions(closedPositionsList.length > 0 ? closedPositionsList : []);
        } else {
          setPositions([]);
          setClosedPositions([]);
          activePositions = [];
        }
      } else {
        setPositions([]);
        setClosedPositions([]);
        activePositions = [];
      }

      // Fetch current prices from fusion API for active positions
      if (activePositions.length > 0) {
        try {
          const symbols = activePositions.map(p => p.symbol).join(',');
          const quoteRes = await fetch(`/api/fusion/market/quote?symbols=${encodeURIComponent(symbols)}`);
          if (quoteRes.ok) {
            const quoteResult = await quoteRes.json();
            if (quoteResult.success && Array.isArray(quoteResult.data)) {
              const quoteMap = new Map<string, { currentPrice: number; change: number; changePercent: number }>();
              for (const q of quoteResult.data) {
                quoteMap.set(q.symbol, {
                  currentPrice: q.currentPrice,
                  change: q.change,
                  changePercent: q.changePercent,
                });
              }

              setPositions(prev => {
                if (!prev) return prev;
                return prev.map(pos => {
                  const quote = quoteMap.get(pos.symbol);
                  if (quote && quote.currentPrice > 0) {
                    const cost = pos.buyPrice * pos.quantity;
                    const currentValue = quote.currentPrice * pos.quantity;
                    const pnl = currentValue - cost;
                    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                    return {
                      ...pos,
                      currentPrice: quote.currentPrice,
                      pnl: parseFloat(pnl.toFixed(2)),
                      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
                    };
                  }
                  return pos;
                });
              });

              // Recalculate risk metrics with updated prices
              const updatedPositions = activePositions.map(pos => {
                const quote = quoteMap.get(pos.symbol);
                if (quote && quote.currentPrice > 0) {
                  const cost = pos.buyPrice * pos.quantity;
                  const currentValue = quote.currentPrice * pos.quantity;
                  const pnl = currentValue - cost;
                  const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                  return { ...pos, currentPrice: quote.currentPrice, pnl, pnlPercent };
                }
                return pos;
              });
              const calculatedMetrics = calculateRiskMetrics(updatedPositions);
              setRiskMetrics(calculatedMetrics);
              setIsDemoRisk(Math.abs(calculatedMetrics.var95) < 1 && Math.abs(calculatedMetrics.sharpeRatio) < 0.01 && Math.abs(calculatedMetrics.maxDrawdown) < 0.1);
            }
          }
        } catch {
          const fallbackMetrics = calculateRiskMetrics(activePositions);
          setRiskMetrics(fallbackMetrics);
          setIsDemoRisk(Math.abs(fallbackMetrics.var95) < 1 && Math.abs(fallbackMetrics.sharpeRatio) < 0.01 && Math.abs(fallbackMetrics.maxDrawdown) < 0.1);
        }
      } else {
        setRiskMetrics(zeroRiskMetrics);
        setIsDemoRisk(true);
      }

      if (summaryRes && summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary({
          totalInvested: data.totalInvested ?? data.totalCost ?? 0,
          totalPnl: data.totalPnl ?? data.totalProfit ?? 0,
          avgHoldingDays: data.avgHoldingDays ?? 4.2,
          activeCount: data.activePositions ?? data.activeCount ?? activePositions.length,
          closedCount: data.closedCount ?? closedPositionsList.length,
        });
      } else {
        setSummary({ totalInvested: 0, totalPnl: 0, avgHoldingDays: 0, activeCount: 0, closedCount: 0 });
      }
    } catch {
      setError(t('pos.pricesError'));
      setPositions([]);
      setClosedPositions([]);
      setSummary({ totalInvested: 0, totalPnl: 0, avgHoldingDays: 0, activeCount: 0, closedCount: 0 });
      setRiskMetrics(zeroRiskMetrics);
      setIsDemoRisk(true);
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

  const handleClosePosition = async (positionId: string) => {
    setClosingId(positionId);
    try {
      // Find the position to get current price
      const pos = positions?.find(p => p.id === positionId);
      const closePrice = pos?.currentPrice || 0;

      const res = await fetch('/api/portfolio/positions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: positionId, closePrice }),
      });
      if (res.ok) {
        setPositions((prev) => prev?.filter((p) => p.id !== positionId) || null);
      }
    } catch {
      // Handle error silently
    } finally {
      setClosingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-[#111118]" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl bg-[#111118]" />
      </div>
    );
  }

  const totalInvested = summary?.totalInvested ?? 0;
  const totalPnl = summary?.totalPnl ?? 0;
  const avgDays = summary?.avgHoldingDays ?? 0;
  const currentRisk = riskMetrics ?? zeroRiskMetrics;

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

      {/* Demo Mode Banner — shown when risk metrics are zero/insufficient */}
      {isDemoRisk && (
        <div className="flex items-center gap-3 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-600/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-yellow-400">{t('pos.demoBanner')}</p>
            <p className="text-[10px] text-yellow-500/80 mt-0.5">{t('pos.demoBannerDesc')}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">{t('pos.totalInvested')}</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalInvested)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">{t('pos.totalPnl')}</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                {totalPnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>
            <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(totalPnl)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">{t('pos.avgHoldingDays')}</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{avgDays.toFixed(1)} {t('pos.days')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('pos.var')}</span>
              {isDemoRisk && <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[8px] px-1 py-0 ml-auto">{t('pos.demo')}</Badge>}
            </div>
            <p className="text-lg font-bold text-yellow-400">{formatCurrency(currentRisk.var95)}</p>
            <p className="text-[10px] text-zinc-600">{t('pos.confidence95')}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('pos.sharpe')}</span>
              {isDemoRisk && <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[8px] px-1 py-0 ml-auto">{t('pos.demo')}</Badge>}
            </div>
            <p className={`text-lg font-bold ${currentRisk.sharpeRatio >= 1 ? 'text-emerald-400' : currentRisk.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {currentRisk.sharpeRatio.toFixed(2)}
            </p>
            <p className="text-[10px] text-zinc-600">{t('pos.annualized')}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('pos.maxDrawdown')}</span>
              {isDemoRisk && <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[8px] px-1 py-0 ml-auto">{t('pos.demo')}</Badge>}
            </div>
            <p className="text-lg font-bold text-red-400">{currentRisk.maxDrawdown.toFixed(1)}%</p>
            <p className="text-[10px] text-zinc-600">{t('pos.portfolioLevel')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Positions */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-white">{t('pos.activePositions')}</CardTitle>
              <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                {positions?.length || 0}
              </Badge>
            </div>
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
          {!positions || positions.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">{t('pos.noActivePositions')}</p>
              <p className="text-zinc-500 text-xs mt-1">{t('pos.openFromScanner')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs">代码</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('pos.buyPrice')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('pos.current')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('pos.pnlPercent')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('pos.cycleCountdown')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs">{t('pos.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => (
                    <TableRow key={pos.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">{pos.symbol}</p>
                            {pos.lots && pos.lots.length > 1 && (
                              <button onClick={() => setExpandedLotId(expandedLotId === pos.id ? null : pos.id)}>
                                <Layers className={`w-3 h-3 text-zinc-500 hover:text-emerald-400 transition-colors ${expandedLotId === pos.id ? 'text-emerald-400' : ''}`} />
                              </button>
                            )}
                            {pos.market && (
                              <Badge
                                variant="secondary"
                                className={`text-[8px] px-1 py-0 ${
                                  pos.market === 'A' ? 'bg-red-600/15 text-red-400' :
                                  pos.market === 'HK' ? 'bg-yellow-600/15 text-yellow-400' :
                                  'bg-emerald-600/15 text-emerald-400'
                                }`}
                              >
                                {pos.market}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">{pos.name}</p>
                          {/* Expanded Lot Detail */}
                          {expandedLotId === pos.id && pos.lots && pos.lots.length > 1 && (
                            <div className="mt-2 space-y-1 pl-2 border-l-2 border-emerald-600/20">
                              {pos.lots.map((lot, idx) => (
                                <div key={lot.id || idx} className="flex items-center gap-3 text-[10px] text-zinc-400">
                                  <span>{lot.openDate ? new Date(lot.openDate).toLocaleDateString() : lot.buyDate}</span>
                                  <span>{lot.quantity || (lot as { qty?: number }).qty} 股</span>
                                  <span>@ ${(lot.costPrice || (lot as { price?: number }).price || 0).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300">${pos.buyPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-white font-medium">${pos.currentPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {pos.pnlPercent >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                          <span className={`text-sm font-medium ${pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Timer className="w-3 h-3 text-zinc-500" />
                              <span className="text-xs text-zinc-400">{pos.remainingDays}d {t('pos.left')}</span>
                            </div>
                            <span className="text-[10px] text-zinc-600">{pos.cycleDays}d {t('pos.cycle')}</span>
                          </div>
                          <Progress
                            value={((pos.cycleDays - pos.remainingDays) / pos.cycleDays) * 100}
                            className="h-1.5 bg-[#1e1e2e]"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={closingId === pos.id}
                              className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-600/10"
                            >
                              {closingId === pos.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#111118] border-[#1e1e2e]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">{t('pos.closePosition')}</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">
                                {t('pos.closePositionConfirm').replace('{symbol}', pos.symbol).replace('{quantity}', pos.quantity.toString()).replace('{price}', pos.currentPrice.toFixed(2))}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-[#1a1a2e] border-[#2e2e3e] text-zinc-300 hover:bg-[#2e2e3e]">
                                {t('pos.cancel')}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleClosePosition(pos.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                {t('pos.closePosition')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closed Positions */}
      <Collapsible open={closedOpen} onOpenChange={setClosedOpen}>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-0 cursor-pointer hover:bg-[#1a1a2e]/30 transition-colors rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold text-white">{t('pos.closedPositions')}</CardTitle>
                  <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px]">
                    {closedPositions?.length || 0}
                  </Badge>
                </div>
                {closedOpen ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-3">
              {closedPositions && closedPositions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs">代码</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('pos.buyPrice')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('pos.sellPrice')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('pos.pnl')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('pos.daysHeld')}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('pos.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closedPositions.map((pos) => (
                        <TableRow key={pos.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                          <TableCell>
                            <div>
                              <p className="text-sm font-semibold text-zinc-300">{pos.symbol}</p>
                              <p className="text-xs text-zinc-600">{pos.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-400">${pos.buyPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-zinc-300">${pos.currentPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-400">{pos.holdingDays}d</TableCell>
                          <TableCell>
                            <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px]">
                              {t('common.closed')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-sm">{t('pos.noClosedPositions')}</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
