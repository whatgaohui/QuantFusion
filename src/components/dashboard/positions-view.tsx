'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  Wifi,
  WifiOff,
  Zap,
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
import { toast } from 'sonner';

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
  lots?: { buyDate: string; qty: number; price: number }[];
  /** Whether the current price comes from real-time Finnhub data */
  isLivePrice?: boolean;
}

interface PositionSummary {
  totalInvested: number;
  totalPnl: number;
  avgHoldingDays: number;
  activeCount: number;
  closedCount: number;
}

interface RiskData {
  var95: number;
  sharpeRatio: number;
  maxDrawdown: number;
  portfolioValue: number;
  dailyReturn: number;
  mock?: boolean;
}

const mockActivePositions: Position[] = [
  {
    id: '1', symbol: 'AAPL', name: 'Apple Inc.', buyPrice: 182.50, currentPrice: 189.45,
    quantity: 50, buyDate: '2024-01-10', cycleDays: 7, pnl: 347.50, pnlPercent: 3.81,
    holdingDays: 4, remainingDays: 3, status: 'ACTIVE',
    lots: [{ buyDate: '2024-01-10', qty: 30, price: 181.00 }, { buyDate: '2024-01-11', qty: 20, price: 184.75 }],
  },
  {
    id: '2', symbol: 'NVDA', name: 'NVIDIA Corp.', buyPrice: 598.30, currentPrice: 615.20,
    quantity: 20, buyDate: '2024-01-12', cycleDays: 7, pnl: 338.00, pnlPercent: 2.82,
    holdingDays: 2, remainingDays: 5, status: 'ACTIVE',
    lots: [{ buyDate: '2024-01-12', qty: 20, price: 598.30 }],
  },
  {
    id: '3', symbol: 'TSLA', name: 'Tesla Inc.', buyPrice: 252.10, currentPrice: 245.80,
    quantity: 30, buyDate: '2024-01-09', cycleDays: 7, pnl: -189.00, pnlPercent: -2.50,
    holdingDays: 5, remainingDays: 2, status: 'ACTIVE',
    lots: [{ buyDate: '2024-01-09', qty: 30, price: 252.10 }],
  },
  {
    id: '4', symbol: 'MSFT', name: 'Microsoft Corp.', buyPrice: 380.20, currentPrice: 388.50,
    quantity: 25, buyDate: '2024-01-13', cycleDays: 7, pnl: 207.50, pnlPercent: 2.18,
    holdingDays: 1, remainingDays: 6, status: 'ACTIVE',
    lots: [{ buyDate: '2024-01-13', qty: 25, price: 380.20 }],
  },
  {
    id: '5', symbol: 'AMZN', name: 'Amazon.com', buyPrice: 175.80, currentPrice: 178.25,
    quantity: 40, buyDate: '2024-01-08', cycleDays: 7, pnl: 98.00, pnlPercent: 1.39,
    holdingDays: 6, remainingDays: 1, status: 'ACTIVE',
    lots: [{ buyDate: '2024-01-08', qty: 40, price: 175.80 }],
  },
];

const mockClosedPositions: Position[] = [
  {
    id: '6', symbol: 'META', name: 'Meta Platforms', buyPrice: 360.50, currentPrice: 374.20,
    quantity: 15, buyDate: '2024-01-02', cycleDays: 7, pnl: 205.50, pnlPercent: 3.80,
    holdingDays: 7, remainingDays: 0, status: 'CLOSED',
  },
  {
    id: '7', symbol: 'GOOGL', name: 'Alphabet Inc.', buyPrice: 145.20, currentPrice: 142.65,
    quantity: 35, buyDate: '2024-01-01', cycleDays: 7, pnl: -89.25, pnlPercent: -1.76,
    holdingDays: 7, remainingDays: 0, status: 'CLOSED',
  },
];

const mockSummary: PositionSummary = {
  totalInvested: 87560.00,
  totalPnl: 810.75,
  avgHoldingDays: 4.2,
  activeCount: 5,
  closedCount: 2,
};

const mockRiskData: RiskData = {
  var95: 2450,
  sharpeRatio: 1.47,
  maxDrawdown: 8.3,
  portfolioValue: 87560,
  dailyReturn: 0.12,
  mock: true,
};

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function PositionsView() {
  const { t } = useLanguage();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [closedPositions, setClosedPositions] = useState<Position[] | null>(null);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [positionsIsMock, setPositionsIsMock] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /** Fetch real-time prices from Finnhub for all active positions */
  const fetchRealtimePrices = useCallback(async (currentPositions: Position[]) => {
    if (!currentPositions || currentPositions.length === 0) return;

    setPricesLoading(true);
    const symbols = currentPositions.map((p) => p.symbol);
    const updatedPositions = [...currentPositions];

    try {
      const pricePromises = symbols.map(async (symbol) => {
        try {
          const res = await fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(symbol)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.currentPrice && data.currentPrice > 0) {
              return { symbol, price: data.currentPrice, isLive: true };
            }
          }
        } catch {
          // ignore individual fetch errors
        }
        return { symbol, price: 0, isLive: false };
      });

      const priceResults = await Promise.all(pricePromises);
      const priceMap = new Map(priceResults.map((r) => [r.symbol, r]));

      for (let i = 0; i < updatedPositions.length; i++) {
        const pos = updatedPositions[i];
        const priceInfo = priceMap.get(pos.symbol);
        if (priceInfo && priceInfo.price > 0) {
          updatedPositions[i] = {
            ...pos,
            currentPrice: priceInfo.price,
            isLivePrice: priceInfo.isLive,
            pnl: (priceInfo.price - pos.buyPrice) * pos.quantity,
            pnlPercent: pos.buyPrice > 0 ? ((priceInfo.price - pos.buyPrice) / pos.buyPrice) * 100 : 0,
          };
        } else {
          // Mark as stale if we couldn't get live price
          updatedPositions[i] = { ...pos, isLivePrice: false };
        }
      }

      setPositions(updatedPositions);

      // Recalculate summary totalPnl from updated positions
      const totalPnl = updatedPositions.reduce((sum, p) => sum + p.pnl, 0);
      setSummary((prev) => prev ? { ...prev, totalPnl } : null);
    } catch {
      // Silently handle errors, positions will show stale prices
    } finally {
      setPricesLoading(false);
    }
  }, []);

  /** Fetch risk metrics from the API */
  const fetchRiskMetrics = useCallback(async () => {
    setRiskLoading(true);
    try {
      const res = await fetch('/api/portfolio/risk');
      if (res.ok) {
        const data: RiskData = await res.json();
        setRiskData(data);
      } else {
        setRiskData(mockRiskData);
      }
    } catch {
      setRiskData(mockRiskData);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [positionsRes, summaryRes] = await Promise.allSettled([
        fetch('/api/portfolio/positions'),
        fetch('/api/portfolio/summary'),
      ]);

      let activePositions: Position[] = mockActivePositions;
      let closed: Position[] = mockClosedPositions;
      let isMockData = true;

      if (positionsRes.status === 'fulfilled' && positionsRes.value.ok) {
        const data = await positionsRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          const active = data
            .filter((p: Record<string, unknown>) => p.status === 'open')
            .map((p: Record<string, unknown>) => mapDbPosition(p));
          const closedData = data
            .filter((p: Record<string, unknown>) => p.status === 'closed')
            .map((p: Record<string, unknown>) => mapDbPosition(p));
          activePositions = active.length > 0 ? active : mockActivePositions;
          closed = closedData.length > 0 ? closedData : mockClosedPositions;
          isMockData = active.length === 0 && closedData.length === 0;
        }
      }
      setPositionsIsMock(isMockData);

      setPositions(activePositions);
      setClosedPositions(closed);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const data = await summaryRes.value.json();
        setSummary({
          totalInvested: data.totalInvested ?? data.totalCost ?? 0,
          totalPnl: data.totalPnl ?? data.totalProfit ?? 0,
          avgHoldingDays: data.avgHoldingDays ?? 4.2,
          activeCount: data.activePositions ?? data.activeCount ?? 0,
          closedCount: data.closedCount ?? 0,
        });
      } else {
        setSummary(mockSummary);
      }

      // Fetch real-time prices immediately after loading positions
      await fetchRealtimePrices(activePositions);
    } catch {
      setPositions(mockActivePositions);
      setClosedPositions(mockClosedPositions);
      setSummary(mockSummary);
      setPositionsIsMock(true);
    } finally {
      setLoading(false);
    }
  }, [fetchRealtimePrices]);

  /** Periodic price refresh (every 30 seconds) */
  useEffect(() => {
    fetchData();
    // Fetch risk metrics separately
    fetchRiskMetrics();

    // Set up 30-second interval for price refresh
    priceIntervalRef.current = setInterval(() => {
      setPositions((currentPositions) => {
        if (currentPositions && currentPositions.length > 0) {
          fetchRealtimePrices(currentPositions);
        }
        return currentPositions;
      });
      fetchRiskMetrics();
    }, 30000);

    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
      }
    };
  }, [fetchData, fetchRealtimePrices, fetchRiskMetrics]);

  const handleClosePosition = async (positionId: string) => {
    setClosingId(positionId);
    try {
      const pos = positions?.find((p) => p.id === positionId);
      const closePrice = pos?.currentPrice ?? 0;
      const res = await fetch('/api/portfolio/positions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: positionId, closePrice }),
      });
      if (res.ok) {
        setPositions((prev) => prev?.filter((p) => p.id !== positionId) || null);
      } else {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.error || errorData?.message || `Request failed with status ${res.status}`;
        toast.error(`Failed to close position: ${errorMessage}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      toast.error(`Failed to close position: ${message}`);
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#111118]" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl bg-[#111118]" />
      </div>
    );
  }

  const totalInvested = summary?.totalInvested || mockSummary.totalInvested;
  const totalPnl = summary?.totalPnl || mockSummary.totalPnl;
  const avgDays = summary?.avgHoldingDays || mockSummary.avgHoldingDays;
  const risk = riskData || mockRiskData;

  return (
    <div className="space-y-6">
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
              {risk.mock && (
                <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[8px] px-1 py-0">
                  {t('pos.estimated')}
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold text-yellow-400">
              {riskLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  --
                </span>
              ) : (
                `-${formatCurrency(risk.var95)}`
              )}
            </p>
            <p className="text-[10px] text-zinc-600">1-day 95% confidence</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('pos.sharpe')}</span>
              {risk.mock && (
                <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[8px] px-1 py-0">
                  {t('pos.estimated')}
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold text-emerald-400">
              {riskLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  --
                </span>
              ) : (
                risk.sharpeRatio.toFixed(2)
              )}
            </p>
            <p className="text-[10px] text-zinc-600">Annualized</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('pos.maxDrawdown')}</span>
              {risk.mock && (
                <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[8px] px-1 py-0">
                  {t('pos.estimated')}
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold text-red-400">
              {riskLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  --
                </span>
              ) : (
                `-${risk.maxDrawdown.toFixed(1)}%`
              )}
            </p>
            <p className="text-[10px] text-zinc-600">Portfolio level</p>
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
              {positionsIsMock && (
                <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[9px] border">DEMO</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pricesLoading && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t('pos.updatingPrices')}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (positions) fetchRealtimePrices(positions);
                  fetchRiskMetrics();
                }}
                disabled={pricesLoading}
                className="h-7 px-2 text-zinc-400 hover:text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${pricesLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
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
                    <TableHead className="text-zinc-400 text-xs">Symbol</TableHead>
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
                          </div>
                          <p className="text-xs text-zinc-500">{pos.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-300">${pos.buyPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-white font-medium">${pos.currentPrice.toFixed(2)}</span>
                          {pos.isLivePrice === true ? (
                            <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[8px] px-1 py-0 flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" />
                              {t('pos.realtime')}
                            </Badge>
                          ) : pos.isLivePrice === false && pos.currentPrice > 0 ? (
                            <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[8px] px-1 py-0 flex items-center gap-0.5">
                              <WifiOff className="w-2.5 h-2.5" />
                              {t('pos.stale')}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
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
                  {positionsIsMock && (
                    <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[9px] border">DEMO</Badge>
                  )}
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
                        <TableHead className="text-zinc-400 text-xs">Symbol</TableHead>
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

/** Map a database position row to the frontend Position interface */
function mapDbPosition(p: Record<string, unknown>): Position {
  const avgCost = typeof p.avgCost === 'number' ? p.avgCost : 0;
  const currentPrice = typeof p.currentPrice === 'number' ? p.currentPrice : avgCost;
  const quantity = typeof p.quantity === 'number' ? p.quantity : 0;
  const pnl = (currentPrice - avgCost) * quantity;
  const pnlPercent = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

  // Calculate days from openedAt
  const openedAt = p.openedAt ? new Date(p.openedAt as string) : new Date();
  const now = new Date();
  const holdingDays = Math.max(1, Math.floor((now.getTime() - openedAt.getTime()) / (1000 * 60 * 60 * 24)));
  const cycleDays = 7;
  const remainingDays = Math.max(0, cycleDays - holdingDays);

  // Map lots if present
  const lots = Array.isArray(p.lots)
    ? p.lots.map((lot: Record<string, unknown>) => ({
        buyDate: lot.openDate ? new Date(lot.openDate as string).toISOString().split('T')[0] : '',
        qty: typeof lot.quantity === 'number' ? lot.quantity : 0,
        price: typeof lot.costPrice === 'number' ? lot.costPrice : 0,
      }))
    : undefined;

  return {
    id: (p.id as string) || '',
    symbol: (p.symbol as string) || '',
    name: (p.symbol as string) || '',
    buyPrice: avgCost,
    currentPrice,
    quantity,
    buyDate: openedAt.toISOString().split('T')[0],
    cycleDays,
    pnl: parseFloat(pnl.toFixed(2)),
    pnlPercent: parseFloat(pnlPercent.toFixed(2)),
    holdingDays,
    remainingDays,
    status: (p.status as string) === 'closed' ? 'CLOSED' : 'ACTIVE',
    lots,
    isLivePrice: false,
  };
}
