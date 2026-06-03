'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  BarChart3,
  RefreshCw,
  Loader2,
  Brain,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  CalendarDays,
  CalendarClock,
  Plus,
  Play,
  Pause,
  Clock,
  Edit3,
  History,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Filter,
  ListFilter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/lib/i18n';
import { AddPositionDialog } from '@/components/dashboard/add-position-dialog';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Position {
  id: string;
  symbol: string;
  market: string;
  side: string;
  status: string;
  avgCost: number;
  quantity: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  lots: Array<{
    id: string;
    quantity: number;
    costPrice: number;
    openDate: string;
    closeDate: string | null;
  }>;
}

interface DCAPlan {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  market: string;
  amountPerPeriod: number;
  period: string;
  weekDay: number;
  isActive: boolean;
  totalInvested: number;
  totalShares: number;
  avgCost: number;
  nextDate: string | null;
  startDate: string;
  createdAt: string;
  updatedAt: string;
  records?: DCAScheduleRecord[];
}

interface DCAScheduleRecord {
  id: string;
  planId: string;
  symbol: string;
  planDate: string;
  amount: number;
  status: string;
  executedAt: string | null;
  execPrice: number | null;
  execShares: number | null;
  notes: string | null;
  plan?: {
    id: string;
    name: string;
    symbol: string;
    period: string;
    amountPerPeriod: number;
  };
}

interface TradeRecord {
  id: string;
  userId: string;
  symbol: string;
  market: string;
  side: string;
  quantity: number;
  price: number;
  totalAmount: number;
  commission: number;
  tradeTime: string;
  source: string;
  strategyId: string | null;
  notes: string | null;
}

interface QuoteData {
  currentPrice: number;
  change: number;
  changePercent: number;
  source?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCNY(value: number): string {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function getSymbolSuffix(symbol: string): string {
  if (symbol.startsWith('51') || symbol.startsWith('56') || symbol.startsWith('58')) {
    return '.SH';
  }
  if (symbol.startsWith('15') || symbol.startsWith('16')) {
    return '.SZ';
  }
  return '.SZ';
}

function getETFName(symbol: string): string {
  const nameMap: Record<string, string> = {
    '159338': '中证白酒ETF',
    '511880': '华宝添益',
    '513300': '纳斯达克100ETF',
    '513500': '标普500ETF',
    '518880': '黄金ETF',
    '588000': '科创板50ETF',
  };
  return nameMap[symbol] || symbol;
}

function getCategoryFromSymbol(symbol: string): { label: string; color: string } {
  const catMap: Record<string, { label: string; color: string }> = {
    '159338': { label: '消费', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
    '511880': { label: '货币', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
    '513300': { label: '海外', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
    '513500': { label: '海外', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
    '518880': { label: '商品', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    '588000': { label: '科技', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  };
  return catMap[symbol] || { label: '其他', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' };
}

function getSmartInsight(currentPrice: number, avgCost: number): {
  type: 'increase' | 'decrease' | 'normal';
  label: string;
  description: string;
} {
  if (currentPrice <= 0 || avgCost <= 0) {
    return { type: 'normal', label: '正常定投', description: '数据不足，建议正常定投' };
  }
  const ratio = currentPrice / avgCost;
  if (ratio < 0.95) {
    return {
      type: 'increase',
      label: '建议加仓',
      description: `当前价低于均价${((1 - ratio) * 100).toFixed(1)}%，处于低估区间`,
    };
  }
  if (ratio > 1.15) {
    return {
      type: 'decrease',
      label: '建议减仓',
      description: `当前价高于均价${((ratio - 1) * 100).toFixed(1)}%，注意止盈`,
    };
  }
  return {
    type: 'normal',
    label: '正常定投',
    description: `当前价偏离均价${((ratio - 1) * 100).toFixed(1)}%，维持定投计划`,
  };
}

function getCountdownToDate(targetDate: string): string {
  const now = new Date();
  const target = new Date(targetDate + 'T10:00:00');
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return '今天';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0) return `${hours}小时后`;
  return `${days}天${hours}小时后`;
}

const periodLabels: Record<string, Record<string, string>> = {
  weekly: { en: 'Weekly', zh: '每周' },
  biweekly: { en: 'Bi-weekly', zh: '双周' },
  monthly: { en: 'Monthly', zh: '每月' },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function PortfolioView({ onNavigate }: { onNavigate: (view: string, extra?: { symbol?: string }) => void }) {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';

  // ── Data state ──
  const [positions, setPositions] = useState<Position[]>([]);
  const [dcaPlans, setDcaPlans] = useState<DCAPlan[]>([]);
  const [dcaSchedules, setDcaSchedules] = useState<DCAScheduleRecord[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});

  // ── UI state ──
  const [activeTab, setActiveTab] = useState('positions');
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [createDCAOpen, setCreateDCAOpen] = useState(false);
  const [newDCASymbol, setNewDCASymbol] = useState('');
  const [newDCAAmount, setNewDCAAmount] = useState('500');
  const [newDCAPeriod, setNewDCAPeriod] = useState<string>('weekly');
  const [planSchedules, setPlanSchedules] = useState<Record<string, DCAScheduleRecord[]>>({});
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);

  // ── Fetch positions ──
  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio/positions');
      if (res.ok) {
        const data = await res.json();
        setPositions(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently handle
    }
  }, []);

  // ── Fetch DCA plans ──
  const fetchDCAPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/dca/plans');
      if (res.ok) {
        const data = await res.json();
        setDcaPlans(data?.data ? data.data : (Array.isArray(data) ? data : []));
      }
    } catch {
      // silently handle
    }
  }, []);

  // ── Fetch DCA schedules ──
  const fetchDCASchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/dca/schedules?limit=100');
      if (res.ok) {
        const data = await res.json();
        setDcaSchedules(data?.data ? data.data : (Array.isArray(data) ? data : []));
      }
    } catch {
      // silently handle
    }
  }, []);

  // ── Fetch trades ──
  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/trades');
      if (res.ok) {
        const data = await res.json();
        setTrades(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently handle
    }
  }, []);

  // ── Fetch quotes ──
  const fetchQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setQuotesLoading(true);
    const newQuotes: Record<string, QuoteData> = {};

    const promises = symbols.map(async (symbol) => {
      try {
        const suffix = getSymbolSuffix(symbol);
        const fullSymbol = symbol + suffix;
        const res = await fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(fullSymbol)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.currentPrice && data.currentPrice > 0) {
            newQuotes[symbol] = {
              currentPrice: data.currentPrice,
              change: data.change ?? 0,
              changePercent: data.changePercent ?? 0,
              source: data.source,
            };
          }
        }
      } catch {
        // Individual fetch error
      }
    });

    await Promise.allSettled(promises);
    setQuotes((prev) => ({ ...prev, ...newQuotes }));
    setQuotesLoading(false);
  }, []);

  // ── Fetch plan-specific schedules ──
  const fetchPlanSchedules = useCallback(async (planId: string) => {
    try {
      const res = await fetch(`/api/dca/schedules?planId=${planId}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        const schedules = data?.data ? data.data : (Array.isArray(data) ? data : []);
        setPlanSchedules((prev) => ({ ...prev, [planId]: schedules }));
      }
    } catch {
      // silently handle
    }
  }, []);

  // ── Initial data load ──
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.allSettled([
        fetchPositions(),
        fetchDCAPlans(),
        fetchDCASchedules(),
        fetchTrades(),
      ]);
      setLoading(false);
    };
    init();
  }, [fetchPositions, fetchDCAPlans, fetchDCASchedules, fetchTrades]);

  // ── Fetch quotes after positions and plans load ──
  useEffect(() => {
    if (positions.length > 0 || dcaPlans.length > 0) {
      const symbols = new Set<string>();
      positions.forEach((p) => { if (p.symbol) symbols.add(p.symbol); });
      dcaPlans.forEach((p) => { if (p.symbol) symbols.add(p.symbol); });
      fetchQuotes(Array.from(symbols));
    }
  }, [positions, dcaPlans, fetchQuotes]);

  // ── Auto-refresh quotes ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const symbols = new Set<string>();
        positions.forEach((p) => { if (p.symbol) symbols.add(p.symbol); });
        dcaPlans.forEach((p) => { if (p.symbol) symbols.add(p.symbol); });
        if (symbols.size > 0) fetchQuotes(Array.from(symbols));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [positions, dcaPlans, fetchQuotes]);

  // ── Computed: Position summary ──
  const positionSummary = useMemo(() => {
    let totalMarketValue = 0;
    let totalInvested = 0;
    positions.forEach((pos) => {
      const price = quotes[pos.symbol]?.currentPrice || pos.currentPrice || pos.avgCost;
      totalMarketValue += price * pos.quantity;
      totalInvested += pos.avgCost * pos.quantity;
    });
    const totalPnl = totalMarketValue - totalInvested;
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    return { totalMarketValue, totalInvested, totalPnl, totalPnlPercent };
  }, [positions, quotes]);

  // ── Computed: DCA plan for a position ──
  const getDCAForSymbol = useCallback((symbol: string): DCAPlan | undefined => {
    return dcaPlans.find((p) => p.symbol === symbol && p.isActive);
  }, [dcaPlans]);

  // ── Computed: Allocation percentage ──
  const getAllocationPercent = useCallback((symbol: string): number => {
    if (positionSummary.totalMarketValue <= 0) return 0;
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) return 0;
    const price = quotes[pos.symbol]?.currentPrice || pos.currentPrice || pos.avgCost;
    return ((price * pos.quantity) / positionSummary.totalMarketValue) * 100;
  }, [positions, quotes, positionSummary]);

  // ── Computed: DCA summary ──
  const dcaSummary = useMemo(() => {
    const activePlans = dcaPlans.filter((p) => p.isActive);
    const totalInvested = dcaPlans.reduce((sum, p) => sum + p.totalInvested, 0);
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const thisMonthTotal = dcaSchedules
      .filter((s) => {
        const dateStr = s.executedAt ? new Date(s.executedAt).toISOString().split('T')[0] : '';
        return s.status === 'executed' && dateStr >= thisMonthStart;
      })
      .reduce((sum, s) => sum + s.amount, 0);

    let nextDate: string | null = null;
    activePlans.forEach((p) => {
      if (p.nextDate) {
        const d = new Date(p.nextDate).toISOString().split('T')[0];
        if (!nextDate || d < nextDate) nextDate = d;
      }
    });

    return { activeCount: activePlans.length, totalPlans: dcaPlans.length, totalInvested, thisMonthTotal, nextDate };
  }, [dcaPlans, dcaSchedules]);

  // ── Computed: Merged trade records ──
  const mergedTrades = useMemo(() => {
    const all: Array<{
      id: string;
      date: string;
      symbol: string;
      type: 'DCA' | 'Manual' | 'AI';
      amount: number;
      price: number;
      shares: number;
      source: string;
      side: string;
    }> = [];

    // DCA schedules
    dcaSchedules.forEach((s) => {
      if (s.status === 'executed') {
        all.push({
          id: `dca-${s.id}`,
          date: s.executedAt ? new Date(s.executedAt).toISOString().split('T')[0] : new Date(s.planDate).toISOString().split('T')[0],
          symbol: s.symbol,
          type: 'DCA',
          amount: s.amount,
          price: s.execPrice || 0,
          shares: s.execShares || 0,
          source: 'dca',
          side: 'buy',
        });
      }
    });

    // Manual / AI trades
    trades.forEach((tr) => {
      const isDCA = tr.source === 'dca';
      // Skip DCA trades that are already in schedules to avoid duplicates
      if (isDCA) return;
      all.push({
        id: `trade-${tr.id}`,
        date: new Date(tr.tradeTime).toISOString().split('T')[0],
        symbol: tr.symbol,
        type: tr.source === 'ai' ? 'AI' : 'Manual',
        amount: tr.totalAmount,
        price: tr.price,
        shares: tr.quantity,
        source: tr.source || 'manual',
        side: tr.side,
      });
    });

    // Sort by date (newest first)
    all.sort((a, b) => b.date.localeCompare(a.date));
    return all;
  }, [dcaSchedules, trades]);

  // ── Filtered trades ──
  const filteredTrades = useMemo(() => {
    if (tradeFilter === 'all') return mergedTrades;
    if (tradeFilter === 'dca') return mergedTrades.filter((t) => t.type === 'DCA');
    if (tradeFilter === 'manual') return mergedTrades.filter((t) => t.type === 'Manual');
    if (tradeFilter === 'ai') return mergedTrades.filter((t) => t.type === 'AI');
    return mergedTrades;
  }, [mergedTrades, tradeFilter]);

  // ── Handlers ──
  const handleExecuteDCA = async (planId: string) => {
    setExecutingPlanId(planId);
    try {
      const res = await fetch(`/api/dca/plans/${planId}/execute`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(isZh ? '定投执行成功' : 'DCA executed successfully');
          await Promise.all([fetchDCAPlans(), fetchDCASchedules(), fetchTrades()]);
        } else {
          toast.error(data.error || (isZh ? '执行失败' : 'Execution failed'));
        }
      } else {
        toast.error(isZh ? '执行失败' : 'Execution failed');
      }
    } catch {
      toast.error(isZh ? '网络错误' : 'Network error');
    } finally {
      setExecutingPlanId(null);
    }
  };

  const handleCreateDCA = async () => {
    if (!newDCASymbol) {
      toast.error(isZh ? '请选择ETF' : 'Please select an ETF');
      return;
    }
    const amount = parseInt(newDCAAmount);
    if (!amount || amount < 100) {
      toast.error(isZh ? '定投金额至少100元' : 'Minimum amount is ¥100');
      return;
    }

    try {
      const res = await fetch('/api/dca/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newDCASymbol,
          name: getETFName(newDCASymbol),
          amountPerPeriod: amount,
          period: newDCAPeriod,
          weekDay: 2,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          toast.success(isZh ? '定投计划已创建' : 'DCA plan created');
          setCreateDCAOpen(false);
          setNewDCASymbol('');
          setNewDCAAmount('500');
          setNewDCAPeriod('weekly');
          await fetchDCAPlans();
        } else {
          toast.error(data.error || (isZh ? '创建失败' : 'Creation failed'));
        }
      } else {
        toast.error(isZh ? '创建失败' : 'Creation failed');
      }
    } catch {
      toast.error(isZh ? '网络错误' : 'Network error');
    }
  };

  const handleToggleExpand = (planId: string) => {
    if (expandedPlanId === planId) {
      setExpandedPlanId(null);
    } else {
      setExpandedPlanId(planId);
      if (!planSchedules[planId]) {
        fetchPlanSchedules(planId);
      }
    }
  };

  // ── ETF presets for DCA creation ──
  const ETF_PRESETS = [
    { symbol: '159338', name: '中证白酒ETF' },
    { symbol: '511880', name: '华宝添益' },
    { symbol: '513300', name: '纳斯达克100ETF' },
    { symbol: '513500', name: '标普500ETF' },
    { symbol: '518880', name: '黄金ETF' },
    { symbol: '588000', name: '科创板50ETF' },
  ];

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-[#111118]" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl bg-[#111118]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-[#111118] border border-[#1e1e2e]">
            <TabsTrigger value="positions" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
              <Wallet className="w-3.5 h-3.5 mr-1" />
              {isZh ? '持仓概览' : 'Positions'}
            </TabsTrigger>
            <TabsTrigger value="dca" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
              <CalendarDays className="w-3.5 h-3.5 mr-1" />
              {isZh ? '定投管理' : 'DCA'}
            </TabsTrigger>
            <TabsTrigger value="trades" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              {isZh ? '交易记录' : 'Trades'}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {quotesLoading && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{isZh ? '更新中...' : 'Updating...'}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const symbols = new Set<string>();
                positions.forEach((p) => { if (p.symbol) symbols.add(p.symbol); });
                dcaPlans.forEach((p) => { if (p.symbol) symbols.add(p.symbol); });
                fetchQuotes(Array.from(symbols));
              }}
              disabled={quotesLoading}
              className="h-7 px-2 text-zinc-400 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${quotesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 1: 持仓概览 (Positions Overview)
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="positions" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 总市值 */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">{isZh ? '总市值' : 'Total Value'}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{formatCNY(positionSummary.totalMarketValue)}</p>
                <p className="text-xs text-zinc-500 mt-1">{positions.length} {isZh ? '只基金' : 'funds'}</p>
              </CardContent>
            </Card>

            {/* 总投入 */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">{isZh ? '总投入' : 'Total Invested'}</span>
                  <div className="w-8 h-8 rounded-lg bg-sky-600/10 flex items-center justify-center">
                    <PiggyBank className="w-4 h-4 text-sky-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{formatCNY(positionSummary.totalInvested)}</p>
                <p className="text-xs text-zinc-500 mt-1">{isZh ? '累计投入本金' : 'Total cost basis'}</p>
              </CardContent>
            </Card>

            {/* 总收益 */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">{isZh ? '总收益' : 'Total P&L'}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    {positionSummary.totalPnl >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-bold ${positionSummary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCNY(positionSummary.totalPnl)}
                  </p>
                  <span className={`text-sm font-medium ${positionSummary.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(positionSummary.totalPnlPercent)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Position Cards Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-400">
              {isZh ? 'ETF 持仓' : 'ETF Positions'}
            </h3>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={() => setAddPositionOpen(true)}
            >
              <Plus className="w-4 h-4" />
              {isZh ? '添加持仓' : 'Add Position'}
            </Button>
          </div>

          {/* Position Cards or Empty State */}
          {positions.length === 0 ? (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-8 text-center">
                <Wallet className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 mb-2">{isZh ? '暂无持仓' : 'No Positions Yet'}</p>
                <p className="text-xs text-zinc-500 mb-4">
                  {isZh ? '添加您的第一个ETF持仓开始管理投资组合' : 'Add your first ETF position to start managing your portfolio'}
                </p>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => setAddPositionOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  {isZh ? '添加持仓' : 'Add Position'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {positions.map((pos) => {
                const quote = quotes[pos.symbol];
                const currentPrice = quote?.currentPrice || pos.currentPrice || pos.avgCost;
                const marketValue = currentPrice * pos.quantity;
                const invested = pos.avgCost * pos.quantity;
                const pnl = marketValue - invested;
                const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
                const isPositive = pnl >= 0;
                const dcaPlan = getDCAForSymbol(pos.symbol);
                const allocation = getAllocationPercent(pos.symbol);
                const cat = getCategoryFromSymbol(pos.symbol);
                const changePercent = quote?.changePercent || 0;

                return (
                  <Card
                    key={pos.id}
                    className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]"
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Header: Code + Name + Category */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base font-bold text-white">{pos.symbol}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 border ${cat.color}`}>
                              {cat.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-zinc-400 truncate">{getETFName(pos.symbol)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className="text-[8px] px-1 py-0 bg-zinc-700/30 text-zinc-400 border-zinc-600/20">
                            {pos.market === 'A' ? (isZh ? 'A股' : 'A-Share') : pos.market}
                          </Badge>
                          {quote?.source && quote.source !== 'unavailable' && (
                            <Badge className="text-[8px] px-1 py-0 bg-emerald-600/15 text-emerald-400 border-emerald-600/20 flex items-center gap-0.5">
                              <Activity className="w-2 h-2" />
                              {quote.source === 'eastmoney' ? '东财' : 'LIVE'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Price + P&L */}
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs text-zinc-500 mb-0.5">{isZh ? '现价' : 'Price'}</p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold text-white">
                              ¥{currentPrice.toFixed(3)}
                            </span>
                            {quote && (
                              <span className={`text-xs font-medium ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatPercent(changePercent)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-500 mb-0.5">{isZh ? '盈亏' : 'P&L'}</p>
                          <div className="flex items-center gap-1 justify-end">
                            {isPositive ? (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            )}
                            <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatCNY(pnl)}
                            </span>
                          </div>
                          <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatPercent(pnlPercent)}
                          </span>
                        </div>
                      </div>

                      {/* Detail grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-2 border-t border-[#1e1e2e]">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{isZh ? '成本价' : 'Cost'}</span>
                          <span className="text-zinc-300">¥{pos.avgCost.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{isZh ? '持有份额' : 'Shares'}</span>
                          <span className="text-zinc-300">{pos.quantity.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{isZh ? '市值' : 'Value'}</span>
                          <span className="text-white font-medium">{formatCNY(marketValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{isZh ? '占比' : 'Alloc'}</span>
                          <span className="text-zinc-300">{allocation.toFixed(1)}%</span>
                        </div>
                      </div>

                      {/* Allocation bar */}
                      <div className="pt-1">
                        <Progress
                          value={Math.min(allocation, 100)}
                          className="h-1 bg-[#1e1e2e] [&>div]:bg-emerald-500"
                        />
                      </div>

                      {/* DCA Status */}
                      <div className="pt-2 border-t border-[#1e1e2e]">
                        {dcaPlan ? (
                          <div className="flex items-center justify-between">
                            <Badge className="text-[10px] px-2 py-0.5 bg-emerald-600/15 text-emerald-400 border-emerald-600/20 gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {isZh ? `定投中 ¥${dcaPlan.amountPerPeriod}/${periodLabels[dcaPlan.period]?.zh || dcaPlan.period}` : `DCA ¥${dcaPlan.amountPerPeriod}/${periodLabels[dcaPlan.period]?.en || dcaPlan.period}`}
                            </Badge>
                            <span className="text-[10px] text-zinc-500">
                              {isZh ? '累计 ¥' : 'Total ¥'}{dcaPlan.totalInvested.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setNewDCASymbol(pos.symbol);
                              setCreateDCAOpen(true);
                            }}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            {isZh ? '未设置定投，点击创建' : 'No DCA set, click to create'}
                          </button>
                        )}
                      </div>

                      {/* AI 分析 Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/10 hover:text-emerald-300"
                        onClick={() => onNavigate('aiInsights', { symbol: pos.symbol })}
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        {isZh ? 'AI 分析' : 'AI Analysis'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 2: 定投管理 (DCA Management)
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dca" className="space-y-4">
          {/* DCA Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 活跃定投 */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">{isZh ? '活跃定投' : 'Active Plans'}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <Play className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">
                  {dcaSummary.activeCount}
                  <span className="text-sm text-zinc-500 font-normal">/{dcaSummary.totalPlans}</span>
                </p>
              </CardContent>
            </Card>

            {/* 本月已投 */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">{isZh ? '本月已投' : 'Invested This Month'}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">¥{dcaSummary.thisMonthTotal.toLocaleString()}</p>
              </CardContent>
            </Card>

            {/* 累计投入 */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">{isZh ? '累计投入' : 'Total Invested'}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">¥{dcaSummary.totalInvested.toLocaleString()}</p>
              </CardContent>
            </Card>

            {/* 下次定投 */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">{isZh ? '下次定投' : 'Next DCA'}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                    <CalendarClock className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">
                  {dcaSummary.nextDate
                    ? (isZh
                        ? `${dcaSummary.nextDate.slice(5).replace('-', '/')}`
                        : dcaSummary.nextDate.slice(5).replace('-', '/'))
                    : '--'}
                </p>
                {dcaSummary.nextDate && (
                  <p className="text-xs text-zinc-500 mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {getCountdownToDate(dcaSummary.nextDate)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* DCA Plan Cards Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-zinc-400">{isZh ? '我的定投计划' : 'My DCA Plans'}</h3>
              {quotesLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
              )}
            </div>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={() => setCreateDCAOpen(true)}
            >
              <Plus className="w-4 h-4" />
              {isZh ? '新建定投' : 'New Plan'}
            </Button>
          </div>

          {/* DCA Plan Cards or Empty State */}
          {dcaPlans.length === 0 ? (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-8 text-center">
                <CalendarDays className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 mb-2">{isZh ? '暂无定投计划' : 'No DCA Plans'}</p>
                <p className="text-xs text-zinc-500 mb-4">
                  {isZh ? '创建您的第一个定投计划，开启智能定投' : 'Create your first DCA plan to start smart investing'}
                </p>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => setCreateDCAOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  {isZh ? '新建定投' : 'New Plan'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dcaPlans.map((plan) => {
                const quote = quotes[plan.symbol];
                const currentPrice = quote?.currentPrice || 0;
                const currentValue = currentPrice > 0 ? currentPrice * plan.totalShares : plan.totalInvested;
                const pnl = currentValue - plan.totalInvested;
                const pnlPercent = plan.totalInvested > 0 ? (pnl / plan.totalInvested) * 100 : 0;
                const changePercent = quote?.changePercent || 0;
                const cat = getCategoryFromSymbol(plan.symbol);
                const insight = getSmartInsight(currentPrice, plan.avgCost);
                const isExpanded = expandedPlanId === plan.id;
                const schedules = planSchedules[plan.id] || plan.records || [];

                return (
                  <Card
                    key={plan.id}
                    className={`bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e] ${
                      !plan.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      {/* Header: Name + Badge + Status */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white truncate">{plan.name || getETFName(plan.symbol)}</span>
                            <span className="text-xs text-zinc-500 font-mono">{plan.symbol}</span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 ${cat.color}`}
                            >
                              {cat.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {currentPrice > 0 ? (
                              <div className="flex items-center gap-1">
                                <span className="text-lg font-bold text-white">¥{currentPrice.toFixed(3)}</span>
                                <span className={`text-xs font-medium ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-500">--</span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                            plan.isActive
                              ? 'border-emerald-600/30 text-emerald-400 bg-emerald-600/10'
                              : 'border-zinc-600/30 text-zinc-500 bg-zinc-600/10'
                          }`}
                        >
                          {plan.isActive ? (isZh ? '运行中' : 'Active') : (isZh ? '已暂停' : 'Paused')}
                        </Badge>
                      </div>

                      {/* Plan Details Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{isZh ? '每期金额' : 'Amount'}</p>
                          <p className="text-sm text-zinc-300 mt-0.5">¥{plan.amountPerPeriod.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{isZh ? '定投周期' : 'Period'}</p>
                          <p className="text-sm text-zinc-300 mt-0.5">
                            {periodLabels[plan.period]?.[isZh ? 'zh' : 'en'] || plan.period}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{isZh ? '累计投入' : 'Invested'}</p>
                          <p className="text-sm text-zinc-300 mt-0.5">¥{plan.totalInvested.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{isZh ? '当前市值' : 'Value'}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-sm text-white font-medium">¥{currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span className={`text-[10px] font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* P&L Bar */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1">
                          <Progress
                            value={Math.min(Math.abs(pnlPercent) * 3, 100)}
                            className={`h-1.5 bg-[#1e1e2e] ${pnlPercent >= 0 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-red-500'}`}
                          />
                        </div>
                        <span className={`text-xs font-semibold min-w-[70px] text-right ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}¥{Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>

                      {/* Average Cost */}
                      <div className="flex items-center justify-between text-xs mb-3">
                        <span className="text-zinc-500">{isZh ? '平均成本价' : 'Avg Cost'}</span>
                        <span className="text-zinc-300 font-mono">¥{plan.avgCost.toFixed(3)}</span>
                      </div>

                      {/* Next Execution */}
                      {plan.nextDate && (
                        <div className="flex items-center justify-between text-xs mb-3 p-2 bg-[#0a0a0f] rounded-lg">
                          <div className="flex items-center gap-1.5">
                            <CalendarClock className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-400">{isZh ? '下次执行' : 'Next'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-300">{new Date(plan.nextDate).toISOString().split('T')[0].slice(5).replace('-', '/')}</span>
                            <span className="text-zinc-500 ml-1">({getCountdownToDate(new Date(plan.nextDate).toISOString().split('T')[0])})</span>
                          </div>
                        </div>
                      )}

                      {/* Smart Insight Mini */}
                      <div className={`flex items-center gap-1.5 text-xs mb-3 p-1.5 rounded-md ${
                        insight.type === 'increase' ? 'bg-emerald-600/10' :
                        insight.type === 'decrease' ? 'bg-red-600/10' :
                        'bg-zinc-600/10'
                      }`}>
                        {insight.type === 'increase' ? (
                          <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        ) : insight.type === 'decrease' ? (
                          <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        ) : (
                          <MinusCircle className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        )}
                        <span className={`font-medium ${
                          insight.type === 'increase' ? 'text-emerald-400' :
                          insight.type === 'decrease' ? 'text-red-400' :
                          'text-zinc-400'
                        }`}>
                          {insight.label}
                        </span>
                        <span className="text-zinc-500 text-[10px] ml-1">{insight.description}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 pt-2 border-t border-[#1e1e2e]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 gap-1 text-xs flex-1"
                          onClick={() => handleExecuteDCA(plan.id)}
                          disabled={executingPlanId === plan.id || !plan.isActive}
                        >
                          {executingPlanId === plan.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          {isZh ? '立即执行' : 'Execute'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-zinc-500 hover:text-white hover:bg-[#1a1a2e] gap-1 text-xs flex-1"
                          onClick={() => handleToggleExpand(plan.id)}
                        >
                          <History className="w-3 h-3" />
                          {isZh ? '记录' : 'History'}
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </Button>
                      </div>

                      {/* Expanded History */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[#1e1e2e]">
                          {schedules.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 py-4">
                              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                              <span className="text-xs text-zinc-500">{isZh ? '加载中...' : 'Loading...'}</span>
                            </div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                              {schedules.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-[#0a0a0f]"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-zinc-400 font-mono">
                                      {new Date(rec.planDate).toISOString().split('T')[0]}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[8px] px-1 py-0 ${
                                        rec.status === 'executed'
                                          ? 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20'
                                          : rec.status === 'planned'
                                          ? 'bg-blue-600/10 text-blue-400 border-blue-600/20'
                                          : 'bg-yellow-600/10 text-yellow-400 border-yellow-600/20'
                                      }`}
                                    >
                                      {rec.status === 'executed' ? (isZh ? '已执行' : 'Done') :
                                       rec.status === 'planned' ? (isZh ? '待执行' : 'Planned') :
                                       (isZh ? '已跳过' : 'Skipped')}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-zinc-300">¥{rec.amount.toLocaleString()}</span>
                                    {rec.execPrice && rec.execPrice > 0 && (
                                      <span className="text-zinc-500 font-mono">@¥{rec.execPrice.toFixed(3)}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 3: 交易记录 (Trade Records)
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="trades" className="space-y-4">
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-base font-semibold text-white">
                    {isZh ? '交易记录' : 'Trade Records'}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={tradeFilter} onValueChange={setTradeFilter}>
                    <SelectTrigger className="h-7 w-[120px] text-xs bg-[#0a0a0f] border-[#1e1e2e] text-zinc-300">
                      <ListFilter className="w-3 h-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                      <SelectItem value="all" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                        {isZh ? '全部' : 'All'}
                      </SelectItem>
                      <SelectItem value="dca" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                        {isZh ? '定投' : 'DCA'}
                      </SelectItem>
                      <SelectItem value="manual" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                        {isZh ? '手动' : 'Manual'}
                      </SelectItem>
                      <SelectItem value="ai" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                        AI
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px]">
                    {filteredTrades.length} {isZh ? '条' : 'records'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTrades.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 mb-1">{isZh ? '暂无交易记录' : 'No Trade Records'}</p>
                  <p className="text-xs text-zinc-500">
                    {isZh ? '定投执行或手动交易后将在此显示' : 'Records will appear here after DCA execution or manual trades'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs">{isZh ? '日期' : 'Date'}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">ETF</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{isZh ? '类型' : 'Type'}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{isZh ? '金额' : 'Amount'}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{isZh ? '价格' : 'Price'}</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{isZh ? '来源' : 'Source'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTrades.map((rec) => (
                        <TableRow key={rec.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                          <TableCell className="text-sm text-zinc-300 whitespace-nowrap font-mono">
                            {rec.date}
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="text-sm font-medium text-white">{rec.symbol}</span>
                              <span className="text-xs text-zinc-500 ml-1.5">{getETFName(rec.symbol)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] px-1.5 py-0 border ${
                                rec.type === 'DCA'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                  : rec.type === 'AI'
                                  ? 'bg-violet-500/15 text-violet-400 border-violet-500/20'
                                  : 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                              }`}
                            >
                              {rec.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-white font-medium">
                            {formatCNY(rec.amount)}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-300 font-mono">
                            {rec.price > 0 ? `¥${rec.price.toFixed(3)}` : '--'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] px-1.5 py-0 border ${
                                rec.source === 'dca'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                  : rec.source === 'ai'
                                  ? 'bg-violet-500/15 text-violet-400 border-violet-500/20'
                                  : 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                              }`}
                            >
                              {rec.source === 'dca' ? (isZh ? '定投' : 'DCA') :
                               rec.source === 'ai' ? 'AI' :
                               rec.source === 'strategy' ? (isZh ? '策略' : 'Strategy') :
                               (isZh ? '手动' : 'Manual')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add Position Dialog ── */}
      <AddPositionDialog
        open={addPositionOpen}
        onOpenChange={setAddPositionOpen}
        onPositionAdded={() => fetchPositions()}
      />

      {/* ── Create DCA Plan Dialog ── */}
      <Dialog open={createDCAOpen} onOpenChange={setCreateDCAOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{isZh ? '创建定投计划' : 'Create DCA Plan'}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {isZh ? '选择ETF并设置定投参数' : 'Select an ETF and configure DCA parameters'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">{isZh ? '选择ETF' : 'Select ETF'}</Label>
              <Select value={newDCASymbol} onValueChange={setNewDCASymbol}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white w-full">
                  <SelectValue placeholder={isZh ? '选择ETF...' : 'Select ETF...'} />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  {ETF_PRESETS.map((etf) => (
                    <SelectItem key={etf.symbol} value={etf.symbol} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                      {etf.symbol} - {etf.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">{isZh ? '每期金额 (元)' : 'Amount per Period (¥)'}</Label>
              <Input
                type="number"
                value={newDCAAmount}
                onChange={(e) => setNewDCAAmount(e.target.value)}
                min={100}
                step={100}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                placeholder="500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">{isZh ? '定投周期' : 'Period'}</Label>
              <Select value={newDCAPeriod} onValueChange={setNewDCAPeriod}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  <SelectItem value="weekly" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                    {isZh ? '每周 (周二)' : 'Weekly (Tuesday)'}
                  </SelectItem>
                  <SelectItem value="biweekly" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                    {isZh ? '双周' : 'Bi-weekly'}
                  </SelectItem>
                  <SelectItem value="monthly" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                    {isZh ? '每月' : 'Monthly'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDCAOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
            >
              {isZh ? '取消' : 'Cancel'}
            </Button>
            <Button
              onClick={handleCreateDCA}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isZh ? '创建' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
