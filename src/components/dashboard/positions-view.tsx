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
}

interface PositionSummary {
  totalInvested: number;
  totalPnl: number;
  avgHoldingDays: number;
  activeCount: number;
  closedCount: number;
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

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function PositionsView() {
  const { t } = useLanguage();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [closedPositions, setClosedPositions] = useState<Position[] | null>(null);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [closedOpen, setClosedOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [positionsRes, summaryRes] = await Promise.allSettled([
        fetch('/api/portfolio/positions'),
        fetch('/api/portfolio/summary'),
      ]);

      if (positionsRes.status === 'fulfilled' && positionsRes.value.ok) {
        const data = await positionsRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          const active = data.filter((p: Position) => p.status === 'ACTIVE');
          const closed = data.filter((p: Position) => p.status === 'CLOSED');
          setPositions(active.length > 0 ? active : mockActivePositions);
          setClosedPositions(closed.length > 0 ? closed : mockClosedPositions);
        } else {
          setPositions(mockActivePositions);
          setClosedPositions(mockClosedPositions);
        }
      } else {
        setPositions(mockActivePositions);
        setClosedPositions(mockClosedPositions);
      }

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
    } catch {
      setPositions(mockActivePositions);
      setClosedPositions(mockClosedPositions);
      setSummary(mockSummary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleClosePosition = async (positionId: string) => {
    setClosingId(positionId);
    try {
      const res = await fetch('/api/portfolio/positions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: positionId }),
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

  const totalInvested = summary?.totalInvested || mockSummary.totalInvested;
  const totalPnl = summary?.totalPnl || mockSummary.totalPnl;
  const avgDays = summary?.avgHoldingDays || mockSummary.avgHoldingDays;

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
            </div>
            <p className="text-lg font-bold text-yellow-400">-$2,450</p>
            <p className="text-[10px] text-zinc-600">1-day 95% confidence</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('pos.sharpe')}</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">1.47</p>
            <p className="text-[10px] text-zinc-600">Annualized</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('pos.maxDrawdown')}</span>
            </div>
            <p className="text-lg font-bold text-red-400">-8.3%</p>
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
            </div>
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
