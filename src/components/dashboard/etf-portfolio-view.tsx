'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  AlertTriangle,
  ShoppingCart,
  ArrowDownCircle,
  ArrowUpCircle,
  MinusCircle,
  Layers,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';
import { AddPositionDialog } from './add-position-dialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ETFHolding {
  id: string;
  symbol: string;
  name: string;
  category: string;
  currentPrice: number;
  shares: number;
  value: number;
  weight: number;
  targetWeight: number;
  pnl: number;
  pnlPercent: number;
  avgCost: number;
  expenseRatio: number;
  dividendYield: number;
  trackingIndex: string;
  topHoldings: string[];
}

interface PortfolioAnalysis {
  totalValue: number;
  weightedExpenseRatio: number;
  weightedDividendYield: number;
  portfolioBeta: number;
  holdings: ETFHolding[];
  allocationByCategory: { name: string; value: number; color: string }[];
  allocationBySector: { name: string; value: number; color: string }[];
  allocationByRegion: { name: string; value: number; color: string }[];
  concentrationRisks: string[];
}

interface RebalanceSuggestion {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  currentWeight: number;
  targetWeight: number;
  weightDiff: number;
  estimatedAmount: number;
}

interface PopularETF {
  symbol: string;
  name: string;
  category: string;
  expenseRatio: number;
  returns1y: number;
  dividendYield: number;
  aum: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  broad_market: '#10b981',
  sector: '#8b5cf6',
  bond: '#eab308',
  commodity: '#f59e0b',
  international: '#3b82f6',
  thematic: '#ec4899',
};

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  broad_market: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20',
  sector: 'bg-purple-600/15 text-purple-400 border-purple-600/20',
  bond: 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20',
  commodity: 'bg-amber-600/15 text-amber-400 border-amber-600/20',
  international: 'bg-blue-600/15 text-blue-400 border-blue-600/20',
  thematic: 'bg-pink-600/15 text-pink-400 border-pink-600/20',
};

const ALLOCATION_PIE_COLORS = ['#10b981', '#8b5cf6', '#eab308', '#f59e0b', '#3b82f6', '#ec4899', '#ef4444', '#22c55e', '#0FEDBE'];

function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number | undefined | null, decimals = 2): string {
  if (value == null || isNaN(value)) return '0.00%';
  return `${value >= 0 ? '' : ''}${value.toFixed(decimals)}%`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ETFPortfolioView() {
  const { t } = useLanguage();
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [rebalanceData, setRebalanceData] = useState<{ suggestions: RebalanceSuggestion[]; totalRebalanceAmount: number } | null>(null);
  const [popularETFs, setPopularETFs] = useState<PopularETF[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [popularLoading, setPopularLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [popularOpen, setPopularOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; category: string; expenseRatio: number; trackingIndex: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSymbol, setAddSymbol] = useState('');

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/etf/portfolio/analysis');
      if (res.ok) {
        const raw = await res.json();
        // Transform API response to match PortfolioAnalysis interface
        // API returns 'positions' (not 'holdings'), allocations with {name,weight,value}
        // (not {name,value,color}), and concentration risks as objects (not strings)
        const holdings: ETFHolding[] = (raw.positions || []).map((p: Record<string, unknown>) => ({
          id: String(p.id || ''),
          symbol: String(p.symbol || ''),
          name: (p.profile as Record<string, unknown>)?.name ? String((p.profile as Record<string, unknown>).name) : String(p.symbol || ''),
          category: (p.profile as Record<string, unknown>)?.category ? String((p.profile as Record<string, unknown>).category) : 'broad_market',
          currentPrice: typeof p.currentPrice === 'number' ? p.currentPrice : 0,
          shares: typeof p.quantity === 'number' ? p.quantity : 0,
          value: typeof p.value === 'number' ? p.value : 0,
          weight: typeof p.weight === 'number' ? p.weight : 0,
          targetWeight: typeof p.targetWeight === 'number' ? p.targetWeight : 0,
          pnl: typeof p.unrealizedPnl === 'number' ? p.unrealizedPnl : 0,
          pnlPercent: (typeof p.unrealizedPnl === 'number' && typeof p.value === 'number' && p.value > 0)
            ? ((p.unrealizedPnl as number) / ((p.value as number) - (p.unrealizedPnl as number))) * 100
            : 0,
          avgCost: typeof p.avgCost === 'number' ? p.avgCost : 0,
          expenseRatio: (p.profile as Record<string, unknown>)?.expenseRatio != null ? Number((p.profile as Record<string, unknown>).expenseRatio) : 0,
          dividendYield: (p.profile as Record<string, unknown>)?.dividendYield != null ? Number((p.profile as Record<string, unknown>).dividendYield) : 0,
          trackingIndex: (p.profile as Record<string, unknown>)?.trackingIndex ? String((p.profile as Record<string, unknown>).trackingIndex) : '',
          topHoldings: [],
        }));

        const transformAllocation = (items: Array<Record<string, unknown>> | undefined) =>
          (items || []).map((item, i) => ({
            name: String(item.name || 'Unknown'),
            value: typeof item.weight === 'number' ? item.weight : 0,
            color: ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length],
          }));

        const concentrationRisks: string[] = (raw.concentrationRisks || []).map(
          (risk: Record<string, unknown>) =>
            `${risk.symbol || 'Unknown'} is ${(risk.currentWeight as number || 0).toFixed(1)}% (> ${(risk.threshold as number || 30)}% threshold)`
        );

        const analysis: PortfolioAnalysis = {
          totalValue: typeof raw.totalValue === 'number' ? raw.totalValue : 0,
          weightedExpenseRatio: typeof raw.weightedExpenseRatio === 'number' ? raw.weightedExpenseRatio : 0,
          weightedDividendYield: typeof raw.weightedDividendYield === 'number' ? raw.weightedDividendYield : 0,
          portfolioBeta: typeof raw.portfolioBeta === 'number' ? raw.portfolioBeta : 0,
          holdings,
          allocationByCategory: transformAllocation(raw.allocationByCategory as Array<Record<string, unknown>> | undefined),
          allocationBySector: transformAllocation(raw.allocationBySector as Array<Record<string, unknown>> | undefined),
          allocationByRegion: transformAllocation(raw.allocationByRegion as Array<Record<string, unknown>> | undefined),
          concentrationRisks,
        };
        setAnalysis(analysis);
      } else {
        setAnalysis(getMockAnalysis());
      }
    } catch {
      setAnalysis(getMockAnalysis());
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRebalance = useCallback(async () => {
    setRebalanceLoading(true);
    try {
      const res = await fetch('/api/etf/portfolio/rebalance');
      if (res.ok) {
        const data = await res.json();
        setRebalanceData(data);
      } else {
        setRebalanceData({ suggestions: [], totalRebalanceAmount: 0 });
      }
    } catch {
      setRebalanceData({ suggestions: [], totalRebalanceAmount: 0 });
    } finally {
      setRebalanceLoading(false);
    }
  }, []);

  const fetchPopular = useCallback(async () => {
    setPopularLoading(true);
    try {
      const res = await fetch('/api/etf/popular');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPopularETFs(data.slice(0, 20).map((etf: Record<string, unknown>) => ({
            symbol: (etf.symbol as string) || '',
            name: (etf.name as string) || '',
            category: (etf.category as string) || 'broad_market',
            expenseRatio: typeof etf.expenseRatio === 'number' ? etf.expenseRatio : 0,
            returns1y: typeof etf.returns1y === 'number' ? etf.returns1y : 0,
            dividendYield: typeof etf.dividendYield === 'number' ? etf.dividendYield : 0,
            aum: typeof etf.aum === 'number' ? etf.aum : 0,
          })));
        } else {
          setPopularETFs(getMockPopularETFs());
        }
      } else {
        setPopularETFs(getMockPopularETFs());
      }
    } catch {
      setPopularETFs(getMockPopularETFs());
    } finally {
      setPopularLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/etf/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
    fetchRebalance();
  }, [fetchAnalysis, fetchRebalance]);

  // ─── Add ETF handler ────────────────────────────────────────────────────

  const handleAddETF = (symbol: string) => {
    setAddSymbol(symbol);
    setShowAddDialog(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-[#111118]" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl bg-[#111118]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl bg-[#111118]" />
          ))}
        </div>
      </div>
    );
  }

  const data = analysis || getMockAnalysis();
  const suggestions = rebalanceData?.suggestions || [];

  return (
    <div className="space-y-6">
      {/* ─── A. Portfolio Overview Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium">{t('etf.portfolioValue')}</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(data.totalValue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium">{t('etf.expenseRatio')}</span>
              <div className="w-8 h-8 rounded-lg bg-purple-600/10 flex items-center justify-center">
                <Percent className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatPercent(data.weightedExpenseRatio, 3)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{t('etf.weightedAvg')}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium">{t('etf.dividendYield')}</span>
              <div className="w-8 h-8 rounded-lg bg-yellow-600/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{formatPercent(data.weightedDividendYield)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{t('etf.weightedAvg')}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium">{t('etf.beta')}</span>
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{data.portfolioBeta.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {data.portfolioBeta < 1 ? t('etf.betaLow') : data.portfolioBeta > 1 ? t('etf.betaHigh') : t('etf.betaMarket')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Concentration Risk Warning */}
      {data.concentrationRisks && data.concentrationRisks.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-600/10 border border-red-600/20">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div className="text-xs text-red-400">
            {data.concentrationRisks.map((risk, i) => (
              <span key={i}>{risk}{i < data.concentrationRisks.length - 1 ? ' · ' : ''}</span>
            ))}
          </div>
        </div>
      )}

      {/* ─── B. ETF Holdings Table ──────────────────────────────────────── */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-white">{t('etf.holdings')}</CardTitle>
              <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                {data.holdings.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { fetchAnalysis(); fetchRebalance(); }}
                className="h-7 px-2 text-zinc-400 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleAddETF('')}
                className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              >
                <Plus className="w-3 h-3" />
                {t('etf.addEtf')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.holdings.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">{t('etf.noEtfHoldings')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddETF('')}
                className="mt-3 border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/10"
              >
                <Plus className="w-3 h-3 mr-1" />
                {t('etf.addEtf')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs">Symbol</TableHead>
                    <TableHead className="text-zinc-400 text-xs hidden md:table-cell">{t('etf.category')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">{t('dash.price')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right hidden sm:table-cell">Shares</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">{t('dash.total')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">{t('etf.weight')}</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right">P&L</TableHead>
                    <TableHead className="text-zinc-400 text-xs text-right hidden lg:table-cell">{t('etf.targetWeight')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.holdings.map((holding) => {
                    const isExpanded = expandedRow === holding.id;
                    const badgeStyle = CATEGORY_BADGE_STYLES[holding.category] || 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';

                    return (
                      <TableRow
                        key={holding.id}
                        className="border-[#1e1e2e] cursor-pointer hover:bg-[#1a1a2e]/50"
                        onClick={() => setExpandedRow(isExpanded ? null : holding.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{holding.symbol}</p>
                              <p className="text-xs text-zinc-500 truncate max-w-[120px]">{holding.name}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-zinc-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge className={`text-[9px] border ${badgeStyle}`}>
                            {t(`etf.cat_${holding.category}`) || holding.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-white text-right">${holding.currentPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-zinc-300 text-right hidden sm:table-cell">{holding.shares}</TableCell>
                        <TableCell className="text-sm text-white text-right">{formatCurrency(holding.value)}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium text-zinc-300">{formatPercent(holding.weight)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {holding.pnl >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            )}
                            <span className={`text-sm font-medium ${holding.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {holding.pnl >= 0 ? '+' : ''}{formatPercent(holding.pnlPercent)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell">
                          {holding.targetWeight > 0 ? (
                            <span className="text-sm text-zinc-400">{formatPercent(holding.targetWeight)}</span>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Expanded Details Row */}
              {expandedRow && data.holdings.find(h => h.id === expandedRow) && (
                <div className="mt-2 p-4 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                  {(() => {
                    const h = data.holdings.find(h => h.id === expandedRow)!;
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('etf.expenseRatio')}</p>
                          <p className="text-sm font-medium text-white">{formatPercent(h.expenseRatio, 3)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Tracking Index</p>
                          <p className="text-sm font-medium text-white">{h.trackingIndex || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Dividend Yield</p>
                          <p className="text-sm font-medium text-white">{formatPercent(h.dividendYield)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Avg Cost</p>
                          <p className="text-sm font-medium text-white">${h.avgCost.toFixed(2)}</p>
                        </div>
                        {h.topHoldings && h.topHoldings.length > 0 && (
                          <div className="sm:col-span-2 lg:col-span-4">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Top Holdings</p>
                            <div className="flex flex-wrap gap-1.5">
                              {h.topHoldings.slice(0, 10).map((ticker) => (
                                <Badge key={ticker} className="bg-[#1e1e2e] text-zinc-300 border-[#2e2e3e] text-[10px]">
                                  {ticker}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── C. Asset Allocation Visualization ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: t('etf.byCategory'), data: data.allocationByCategory },
          { title: t('etf.bySector'), data: data.allocationBySector },
          { title: t('etf.byRegion'), data: data.allocationByRegion },
        ].map((chart) => (
          <Card key={chart.title} className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm font-semibold text-white">{chart.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {chart.data && chart.data.length > 0 ? (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chart.data}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {chart.data.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color || ALLOCATION_PIE_COLORS[index % ALLOCATION_PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
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
                  <div className="space-y-1.5 mt-2 max-h-28 overflow-y-auto custom-scrollbar">
                    {chart.data.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: item.color || ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length] }}
                          />
                          <span className="text-xs text-zinc-400">{item.name}</span>
                        </div>
                        <span className="text-xs font-medium text-zinc-300">{item.value.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-44">
                  <p className="text-xs text-zinc-500">{t('etf.noEtfHoldings')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── D. Rebalancing Suggestions Panel ───────────────────────────── */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('etf.rebalancing')}</CardTitle>
              {suggestions.length > 0 && (
                <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                  {suggestions.length}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRebalance}
              disabled={rebalanceLoading}
              className="h-7 px-2 text-zinc-400 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rebalanceLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rebalanceLoading && !rebalanceData ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg bg-[#0a0a0f]" />
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-4">
              {/* Bar Chart: Current vs Target */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={suggestions.map(s => ({
                    symbol: s.symbol,
                    current: parseFloat(s.currentWeight.toFixed(1)),
                    target: parseFloat(s.targetWeight.toFixed(1)),
                  }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="symbol" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#1e1e2e' }} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#1e1e2e' }} tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [`${value}%`, name === 'current' ? t('etf.currentWeight') : t('etf.targetWeight')]}
                      contentStyle={{
                        backgroundColor: '#1a1a2e',
                        border: '1px solid #2e2e3e',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Legend
                      formatter={(value: string) => value === 'current' ? t('etf.currentWeight') : t('etf.targetWeight')}
                      wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }}
                    />
                    <Bar dataKey="current" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="target" fill="#10b98133" stroke="#10b981" strokeWidth={1} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Suggestions List */}
              <div className="space-y-2">
                {suggestions.map((s) => {
                  const isOverweight = s.action === 'sell';
                  const isUnderweight = s.action === 'buy';
                  const isOnTarget = s.action === 'hold';

                  return (
                    <div
                      key={s.symbol}
                      className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] hover:border-[#2e2e3e] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isUnderweight ? (
                          <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                        ) : isOverweight ? (
                          <ArrowUpCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <MinusCircle className="w-4 h-4 text-zinc-500" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-white">{s.symbol}</p>
                          <p className="text-[10px] text-zinc-500">
                            {formatPercent(s.currentWeight)} → {formatPercent(s.targetWeight)}
                            <span className={`ml-1 ${isUnderweight ? 'text-emerald-400' : isOverweight ? 'text-red-400' : 'text-zinc-500'}`}>
                              ({s.weightDiff > 0 ? '+' : ''}{formatPercent(s.weightDiff)})
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[9px] border ${
                          isUnderweight ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                          isOverweight ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                          'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                        }`}>
                          {isUnderweight ? t('etf.underweight') : isOverweight ? t('etf.overweight') : t('etf.onTarget')}
                        </Badge>
                        {Math.abs(s.estimatedAmount) > 0 && (
                          <span className={`text-xs font-medium ${isUnderweight ? 'text-emerald-400' : isOverweight ? 'text-red-400' : 'text-zinc-400'}`}>
                            {isUnderweight ? t('etf.buy') : t('etf.sell')} {formatCurrency(Math.abs(s.estimatedAmount))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Rebalance Amount */}
              {rebalanceData && rebalanceData.totalRebalanceAmount > 0 && (
                <div className="flex items-center justify-between p-3 bg-emerald-600/5 rounded-lg border border-emerald-600/20">
                  <span className="text-xs text-zinc-400">{t('etf.estimatedAmount')}</span>
                  <span className="text-sm font-semibold text-emerald-400">{formatCurrency(rebalanceData.totalRebalanceAmount)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">{t('etf.noEtfHoldings')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── E. Popular ETFs Quick Add ──────────────────────────────────── */}
      <Collapsible open={popularOpen} onOpenChange={(open) => { setPopularOpen(open); if (open && popularETFs.length === 0) fetchPopular(); }}>
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-0 cursor-pointer hover:bg-[#1a1a2e]/30 transition-colors rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-base font-semibold text-white">{t('etf.popularEtfs')}</CardTitle>
                </div>
                {popularOpen ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-3">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder={t('etf.searchEtf')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                  </button>
                )}
                {searching && (
                  <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 animate-spin" />
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mb-4 p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] max-h-48 overflow-y-auto custom-scrollbar">
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => handleAddETF(result.symbol)}
                      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-[#1a1a2e] transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{result.symbol}</p>
                        <p className="text-xs text-zinc-500 truncate max-w-[200px]">{result.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.expenseRatio > 0 && (
                          <span className="text-[10px] text-zinc-400">{formatPercent(result.expenseRatio, 3)}</span>
                        )}
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Popular ETF Grid */}
              {popularLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-lg bg-[#0a0a0f]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {popularETFs.map((etf) => {
                    const badgeStyle = CATEGORY_BADGE_STYLES[etf.category] || 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';
                    return (
                      <div
                        key={etf.symbol}
                        className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] hover:border-emerald-600/30 transition-all duration-200 cursor-pointer group"
                        onClick={() => handleAddETF(etf.symbol)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{etf.symbol}</p>
                            <p className="text-[10px] text-zinc-500 truncate max-w-[140px]">{etf.name}</p>
                          </div>
                          <Plus className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge className={`text-[8px] border ${badgeStyle}`}>
                            {t(`etf.cat_${etf.category}`) || etf.category}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-500">{t('etf.expenseRatio')}: <span className="text-zinc-300">{formatPercent(etf.expenseRatio, 3)}</span></span>
                          {etf.returns1y !== 0 && (
                            <span className={etf.returns1y >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              1Y: {etf.returns1y >= 0 ? '+' : ''}{formatPercent(etf.returns1y)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Add Position Dialog */}
      <AddPositionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        symbol={addSymbol}
        onPositionAdded={() => { fetchAnalysis(); fetchRebalance(); }}
      />
    </div>
  );
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

function getMockAnalysis(): PortfolioAnalysis {
  return {
    totalValue: 85420.50,
    weightedExpenseRatio: 0.09,
    weightedDividendYield: 1.82,
    portfolioBeta: 0.95,
    holdings: [
      {
        id: '1', symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', category: 'broad_market',
        currentPrice: 528.45, shares: 25, value: 13211.25, weight: 15.46, targetWeight: 20,
        pnl: 1211.25, pnlPercent: 10.1, avgCost: 480.05, expenseRatio: 0.09,
        dividendYield: 1.4, trackingIndex: 'S&P 500 Index', topHoldings: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META'],
      },
      {
        id: '2', symbol: 'QQQ', name: 'Invesco QQQ Trust', category: 'broad_market',
        currentPrice: 449.35, shares: 30, value: 13480.50, weight: 15.78, targetWeight: 15,
        pnl: 2480.50, pnlPercent: 22.5, avgCost: 366.67, expenseRatio: 0.20,
        dividendYield: 0.6, trackingIndex: 'NASDAQ-100 Index', topHoldings: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META'],
      },
      {
        id: '3', symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', category: 'broad_market',
        currentPrice: 263.80, shares: 40, value: 10552.00, weight: 12.35, targetWeight: 15,
        pnl: 552.00, pnlPercent: 5.5, avgCost: 250.00, expenseRatio: 0.03,
        dividendYield: 1.3, trackingIndex: 'CRSP US Total Market Index', topHoldings: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META'],
      },
      {
        id: '4', symbol: 'BND', name: 'Vanguard Total Bond Market ETF', category: 'bond',
        currentPrice: 72.15, shares: 100, value: 7215.00, weight: 8.44, targetWeight: 15,
        pnl: -285.00, pnlPercent: -3.8, avgCost: 75.00, expenseRatio: 0.03,
        dividendYield: 3.5, trackingIndex: 'Bloomberg US Aggregate Float Adjusted Index', topHoldings: ['US Treasury', 'FNMA', 'FHLMC'],
      },
      {
        id: '5', symbol: 'XLF', name: 'Financial Select Sector SPDR Fund', category: 'sector',
        currentPrice: 42.30, shares: 80, value: 3384.00, weight: 3.96, targetWeight: 5,
        pnl: 384.00, pnlPercent: 12.8, avgCost: 37.50, expenseRatio: 0.12,
        dividendYield: 1.5, trackingIndex: 'Financial Select Sector Index', topHoldings: ['BRK.B', 'JPM', 'V', 'MA', 'BAC'],
      },
      {
        id: '6', symbol: 'VWO', name: 'Vanguard Emerging Markets ETF', category: 'international',
        currentPrice: 44.85, shares: 60, value: 2691.00, weight: 3.15, targetWeight: 5,
        pnl: -309.00, pnlPercent: -10.3, avgCost: 50.00, expenseRatio: 0.08,
        dividendYield: 2.8, trackingIndex: 'FTSE Emerging Index', topHoldings: ['TSM', 'TCEHY', 'SE', 'PDD', 'INFY'],
      },
      {
        id: '7', symbol: 'GLD', name: 'SPDR Gold Shares', category: 'commodity',
        currentPrice: 215.40, shares: 20, value: 4308.00, weight: 5.04, targetWeight: 5,
        pnl: 508.00, pnlPercent: 13.4, avgCost: 190.00, expenseRatio: 0.40,
        dividendYield: 0, trackingIndex: 'Gold Price', topHoldings: ['Gold'],
      },
      {
        id: '8', symbol: 'VGT', name: 'Vanguard Information Technology ETF', category: 'thematic',
        currentPrice: 512.70, shares: 40, value: 20508.00, weight: 24.0, targetWeight: 10,
        pnl: 6508.00, pnlPercent: 46.5, avgCost: 350.00, expenseRatio: 0.10,
        dividendYield: 0.9, trackingIndex: 'MSCI US Investable Market Info Tech 25/50 Index', topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'CRM'],
      },
    ],
    allocationByCategory: [
      { name: 'Broad Market', value: 43.6, color: '#10b981' },
      { name: 'Bond', value: 8.4, color: '#eab308' },
      { name: 'Sector', value: 4.0, color: '#8b5cf6' },
      { name: 'International', value: 3.2, color: '#3b82f6' },
      { name: 'Commodity', value: 5.0, color: '#f59e0b' },
      { name: 'Thematic', value: 24.0, color: '#ec4899' },
    ],
    allocationBySector: [
      { name: 'Technology', value: 52.3, color: '#10b981' },
      { name: 'Finance', value: 6.5, color: '#8b5cf6' },
      { name: 'Healthcare', value: 4.2, color: '#0FEDBE' },
      { name: 'Consumer', value: 5.8, color: '#f59e0b' },
      { name: 'Energy', value: 2.1, color: '#ef4444' },
      { name: 'Bonds', value: 8.4, color: '#eab308' },
      { name: 'Commodities', value: 5.0, color: '#f59e0b' },
      { name: 'Other', value: 15.7, color: '#3b82f6' },
    ],
    allocationByRegion: [
      { name: 'US', value: 83.5, color: '#10b981' },
      { name: 'International', value: 8.0, color: '#3b82f6' },
      { name: 'Emerging', value: 3.2, color: '#f59e0b' },
      { name: 'Other', value: 5.3, color: '#8b5cf6' },
    ],
    concentrationRisks: ['VGT (24.0%) exceeds 20% concentration threshold'],
  };
}

function getMockPopularETFs(): PopularETF[] {
  return [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', category: 'broad_market', expenseRatio: 0.09, returns1y: 26.5, dividendYield: 1.4, aum: 530000000000 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', category: 'broad_market', expenseRatio: 0.20, returns1y: 38.2, dividendYield: 0.6, aum: 260000000000 },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market', category: 'broad_market', expenseRatio: 0.03, returns1y: 25.8, dividendYield: 1.3, aum: 340000000000 },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', category: 'broad_market', expenseRatio: 0.03, returns1y: 26.4, dividendYield: 1.4, aum: 440000000000 },
    { symbol: 'BND', name: 'Vanguard Total Bond Market', category: 'bond', expenseRatio: 0.03, returns1y: -1.5, dividendYield: 3.5, aum: 100000000000 },
    { symbol: 'GLD', name: 'SPDR Gold Shares', category: 'commodity', expenseRatio: 0.40, returns1y: 12.3, dividendYield: 0, aum: 60000000000 },
    { symbol: 'VWO', name: 'Vanguard Emerging Markets', category: 'international', expenseRatio: 0.08, returns1y: 5.2, dividendYield: 2.8, aum: 80000000000 },
    { symbol: 'XLF', name: 'Financial Select Sector SPDR', category: 'sector', expenseRatio: 0.12, returns1y: 18.5, dividendYield: 1.5, aum: 40000000000 },
    { symbol: 'VGT', name: 'Vanguard Info Tech ETF', category: 'thematic', expenseRatio: 0.10, returns1y: 42.1, dividendYield: 0.9, aum: 75000000000 },
    { symbol: 'IWM', name: 'iShares Russell 2000 ETF', category: 'broad_market', expenseRatio: 0.19, returns1y: 15.3, dividendYield: 1.2, aum: 60000000000 },
    { symbol: 'EFA', name: 'iShares MSCI EAFE ETF', category: 'international', expenseRatio: 0.32, returns1y: 14.8, dividendYield: 3.1, aum: 55000000000 },
    { symbol: 'XLK', name: 'Technology Select Sector SPDR', category: 'sector', expenseRatio: 0.10, returns1y: 40.5, dividendYield: 0.8, aum: 45000000000 },
  ];
}
