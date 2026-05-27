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
  },
  {
    id: '2', symbol: 'NVDA', name: 'NVIDIA Corp.', buyPrice: 598.30, currentPrice: 615.20,
    quantity: 20, buyDate: '2024-01-12', cycleDays: 7, pnl: 338.00, pnlPercent: 2.82,
    holdingDays: 2, remainingDays: 5, status: 'ACTIVE',
  },
  {
    id: '3', symbol: 'TSLA', name: 'Tesla Inc.', buyPrice: 252.10, currentPrice: 245.80,
    quantity: 30, buyDate: '2024-01-09', cycleDays: 7, pnl: -189.00, pnlPercent: -2.50,
    holdingDays: 5, remainingDays: 2, status: 'ACTIVE',
  },
  {
    id: '4', symbol: 'MSFT', name: 'Microsoft Corp.', buyPrice: 380.20, currentPrice: 388.50,
    quantity: 25, buyDate: '2024-01-13', cycleDays: 7, pnl: 207.50, pnlPercent: 2.18,
    holdingDays: 1, remainingDays: 6, status: 'ACTIVE',
  },
  {
    id: '5', symbol: 'AMZN', name: 'Amazon.com', buyPrice: 175.80, currentPrice: 178.25,
    quantity: 40, buyDate: '2024-01-08', cycleDays: 7, pnl: 98.00, pnlPercent: 1.39,
    holdingDays: 6, remainingDays: 1, status: 'ACTIVE',
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function PositionsView() {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [closedPositions, setClosedPositions] = useState<Position[] | null>(null);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [closedOpen, setClosedOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

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
        setSummary(data);
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
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Total Invested</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalInvested)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Total P&L</span>
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
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Avg Holding Days</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{avgDays.toFixed(1)} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Positions */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-white">Active Positions</CardTitle>
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
              <p className="text-zinc-400 text-sm">No active positions</p>
              <p className="text-zinc-500 text-xs mt-1">Open a position from the Signal Scanner</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs">Symbol</TableHead>
                    <TableHead className="text-zinc-400 text-xs">Buy Price</TableHead>
                    <TableHead className="text-zinc-400 text-xs">Current</TableHead>
                    <TableHead className="text-zinc-400 text-xs">P&L%</TableHead>
                    <TableHead className="text-zinc-400 text-xs">Days</TableHead>
                    <TableHead className="text-zinc-400 text-xs">Remaining</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => (
                    <TableRow key={pos.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                      <TableCell>
                        <div>
                          <p className="text-sm font-semibold text-white">{pos.symbol}</p>
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
                      <TableCell className="text-sm text-zinc-300">{pos.holdingDays}d</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{pos.remainingDays}d left</span>
                            <span className="text-[10px] text-zinc-600">{pos.cycleDays}d cycle</span>
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
                              <AlertDialogTitle className="text-white">Close Position</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">
                                Are you sure you want to close your {pos.symbol} position? This will sell {pos.quantity} shares at the current market price of ${pos.currentPrice.toFixed(2)}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-[#1a1a2e] border-[#2e2e3e] text-zinc-300 hover:bg-[#2e2e3e]">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleClosePosition(pos.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Close Position
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
                  <CardTitle className="text-base font-semibold text-white">Closed Positions</CardTitle>
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
                        <TableHead className="text-zinc-400 text-xs">Buy Price</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Sell Price</TableHead>
                        <TableHead className="text-zinc-400 text-xs">P&L</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Days Held</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Status</TableHead>
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
                              CLOSED
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-sm">No closed positions yet</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
