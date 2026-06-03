'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarClock,
  Plus,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Clock,
  Edit3,
  History,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  Loader2,
  RefreshCw,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DCAPlan {
  id: string;
  symbol: string;
  name: string;
  category: string;
  amount: number;
  period: 'weekly' | 'biweekly' | 'monthly';
  weekDay: number;
  avgCost: number;
  totalInvested: number;
  totalShares: number;
  nextDate: string;
  isActive: boolean;
}

interface ExecutionRecord {
  id: string;
  date: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  shares: number;
  status: 'executed' | 'planned' | 'skipped';
}

interface QuoteData {
  currentPrice: number;
  change: number;
  changePercent: number;
}

interface DCAPlanViewProps {
  onNavigate?: (view: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextTuesday(): string {
  const now = new Date();
  const day = now.getDay();
  // days until next Tuesday (2)
  let daysUntil = (2 - day + 7) % 7;
  if (daysUntil === 0) {
    // If today is Tuesday, check if it's already past market hours (3pm)
    if (now.getHours() >= 15) {
      daysUntil = 7;
    }
  }
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  return next.toISOString().split('T')[0];
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

function getSymbolSuffix(symbol: string): string {
  // ETF symbols starting with 5 or 1 that are on Shanghai exchange
  // 51xxxx, 56xxxx, 58xxxx → SH; 15xxxx, 16xxxx → SZ
  if (symbol.startsWith('51') || symbol.startsWith('56') || symbol.startsWith('58')) {
    return '.SH';
  }
  if (symbol.startsWith('15') || symbol.startsWith('16')) {
    return '.SZ';
  }
  // 518880, 588000 start with 51/58 → SH
  // 159338 starts with 15 → SZ
  return '.SZ';
}

function getCategoryBadge(category: string) {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    liquor: { bg: 'bg-amber-600/10', text: 'text-amber-400', border: 'border-amber-600/20', label: '消费' },
    money: { bg: 'bg-blue-600/10', text: 'text-blue-400', border: 'border-blue-600/20', label: '货币' },
    us: { bg: 'bg-purple-600/10', text: 'text-purple-400', border: 'border-purple-600/20', label: '海外' },
    gold: { bg: 'bg-yellow-600/10', text: 'text-yellow-400', border: 'border-yellow-600/20', label: '商品' },
    tech: { bg: 'bg-cyan-600/10', text: 'text-cyan-400', border: 'border-cyan-600/20', label: '科技' },
  };
  return map[category] || { bg: 'bg-zinc-600/10', text: 'text-zinc-400', border: 'border-zinc-600/20', label: category };
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

// ─── Initial Data ────────────────────────────────────────────────────────────

const INITIAL_PLANS: DCAPlan[] = [
  { id: '1', symbol: '159338', name: '中证白酒ETF', category: 'liquor', amount: 500, period: 'weekly', weekDay: 2, avgCost: 1.25, totalInvested: 10000, totalShares: 8000, nextDate: getNextTuesday(), isActive: true },
  { id: '2', symbol: '511880', name: '华宝添益', category: 'money', amount: 1000, period: 'weekly', weekDay: 2, avgCost: 1.0, totalInvested: 20000, totalShares: 20000, nextDate: getNextTuesday(), isActive: true },
  { id: '3', symbol: '513300', name: '纳斯达克100ETF', category: 'us', amount: 500, period: 'weekly', weekDay: 2, avgCost: 1.85, totalInvested: 8000, totalShares: 4324, nextDate: getNextTuesday(), isActive: true },
  { id: '4', symbol: '513500', name: '标普500ETF', category: 'us', amount: 500, period: 'weekly', weekDay: 2, avgCost: 1.52, totalInvested: 7500, totalShares: 4934, nextDate: getNextTuesday(), isActive: true },
  { id: '5', symbol: '518880', name: '黄金ETF', category: 'gold', amount: 500, period: 'weekly', weekDay: 2, avgCost: 5.2, totalInvested: 12000, totalShares: 2308, nextDate: getNextTuesday(), isActive: true },
  { id: '6', symbol: '588000', name: '科创板50ETF', category: 'tech', amount: 300, period: 'weekly', weekDay: 2, avgCost: 0.95, totalInvested: 4500, totalShares: 4737, nextDate: getNextTuesday(), isActive: true },
];

const ETF_PRESETS = [
  { symbol: '159338', name: '中证白酒ETF', category: 'liquor' },
  { symbol: '511880', name: '华宝添益', category: 'money' },
  { symbol: '513300', name: '纳斯达克100ETF', category: 'us' },
  { symbol: '513500', name: '标普500ETF', category: 'us' },
  { symbol: '518880', name: '黄金ETF', category: 'gold' },
  { symbol: '588000', name: '科创板50ETF', category: 'tech' },
];

const MOCK_EXECUTIONS: ExecutionRecord[] = [
  { id: 'e1', date: '2025-03-04', symbol: '159338', name: '中证白酒ETF', amount: 500, price: 1.23, shares: 406, status: 'executed' },
  { id: 'e2', date: '2025-03-04', symbol: '511880', name: '华宝添益', amount: 1000, price: 1.001, shares: 999, status: 'executed' },
  { id: 'e3', date: '2025-03-04', symbol: '513300', name: '纳斯达克100ETF', amount: 500, price: 1.88, shares: 265, status: 'executed' },
  { id: 'e4', date: '2025-03-04', symbol: '513500', name: '标普500ETF', amount: 500, price: 1.55, shares: 322, status: 'executed' },
  { id: 'e5', date: '2025-03-04', symbol: '518880', name: '黄金ETF', amount: 500, price: 5.38, shares: 92, status: 'executed' },
  { id: 'e6', date: '2025-03-04', symbol: '588000', name: '科创板50ETF', amount: 300, price: 0.92, shares: 326, status: 'executed' },
  { id: 'e7', date: '2025-02-25', symbol: '159338', name: '中证白酒ETF', amount: 500, price: 1.26, shares: 396, status: 'executed' },
  { id: 'e8', date: '2025-02-25', symbol: '511880', name: '华宝添益', amount: 1000, price: 1.001, shares: 999, status: 'executed' },
  { id: 'e9', date: '2025-02-25', symbol: '513300', name: '纳斯达克100ETF', amount: 500, price: 1.82, shares: 274, status: 'executed' },
  { id: 'e10', date: '2025-02-25', symbol: '513500', name: '标普500ETF', amount: 500, price: 1.50, shares: 333, status: 'executed' },
  { id: 'e11', date: '2025-02-25', symbol: '518880', name: '黄金ETF', amount: 500, price: 5.25, shares: 95, status: 'executed' },
  { id: 'e12', date: '2025-02-25', symbol: '588000', name: '科创板50ETF', amount: 300, price: 0.96, shares: 312, status: 'executed' },
  { id: 'e13', date: '2025-02-18', symbol: '518880', name: '黄金ETF', amount: 500, price: 5.15, shares: 97, status: 'skipped' },
  { id: 'e14', date: '2025-03-11', symbol: '159338', name: '中证白酒ETF', amount: 500, price: 0, shares: 0, status: 'planned' },
  { id: 'e15', date: '2025-03-11', symbol: '511880', name: '华宝添益', amount: 1000, price: 0, shares: 0, status: 'planned' },
  { id: 'e16', date: '2025-03-11', symbol: '513300', name: '纳斯达克100ETF', amount: 500, price: 0, shares: 0, status: 'planned' },
  { id: 'e17', date: '2025-03-11', symbol: '513500', name: '标普500ETF', amount: 500, price: 0, shares: 0, status: 'planned' },
  { id: 'e18', date: '2025-03-11', symbol: '518880', name: '黄金ETF', amount: 500, price: 0, shares: 0, status: 'planned' },
  { id: 'e19', date: '2025-03-11', symbol: '588000', name: '科创板50ETF', amount: 300, price: 0, shares: 0, status: 'planned' },
];

const periodLabels: Record<string, Record<string, string>> = {
  weekly: { en: 'Weekly', zh: '每周' },
  biweekly: { en: 'Bi-weekly', zh: '双周' },
  monthly: { en: 'Monthly', zh: '每月' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function DCAPlanView({ onNavigate }: DCAPlanViewProps) {
  const { language, t } = useLanguage();
  const isZh = language === 'zh';

  // State
  const [plans, setPlans] = useState<DCAPlan[]>(INITIAL_PLANS);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DCAPlan | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPlanId, setHistoryPlanId] = useState<string | null>(null);

  // Create form state
  const [newSymbol, setNewSymbol] = useState('');
  const [newAmount, setNewAmount] = useState('500');
  const [newPeriod, setNewPeriod] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [newStartDate, setNewStartDate] = useState(getNextTuesday());

  // Edit form state
  const [editAmount, setEditAmount] = useState('');
  const [editPeriod, setEditPeriod] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');

  // ─── Fetch real-time quotes ──────────────────────────────────────────────

  const fetchQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const results = await Promise.allSettled(
        plans.map(async (plan) => {
          const suffix = getSymbolSuffix(plan.symbol);
          const fullSymbol = plan.symbol + suffix;
          const res = await fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(fullSymbol)}`);
          if (res.ok) {
            const data = await res.json();
            return {
              symbol: plan.symbol,
              currentPrice: data.currentPrice || 0,
              change: data.change || 0,
              changePercent: data.changePercent || 0,
            };
          }
          return null;
        })
      );

      const newQuotes: Record<string, QuoteData> = {};
      plans.forEach((plan, i) => {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          newQuotes[plan.symbol] = result.value;
        }
      });
      setQuotes((prev) => ({ ...prev, ...newQuotes }));
    } catch {
      // silently handle
    } finally {
      setQuotesLoading(false);
    }
  }, [plans]);

  useEffect(() => {
    setLoading(true);
    fetchQuotes().finally(() => setLoading(false));

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchQuotes();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchQuotes]);

  // ─── Computed values ─────────────────────────────────────────────────────

  const activeCount = plans.filter((p) => p.isActive).length;
  const totalInvested = plans.reduce((sum, p) => sum + p.totalInvested, 0);

  // Calculate this month's invested amount
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const investedThisMonth = MOCK_EXECUTIONS
    .filter((e) => e.date >= thisMonthStart && e.status === 'executed')
    .reduce((sum, e) => sum + e.amount, 0);

  const nextTuesday = getNextTuesday();

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleTogglePlan = (planId: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, isActive: !p.isActive } : p
      )
    );
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      toast.success(
        plan.isActive
          ? isZh ? `${plan.name} 定投已暂停` : `${plan.name} DCA paused`
          : isZh ? `${plan.name} 定投已恢复` : `${plan.name} DCA resumed`
      );
    }
  };

  const handleCreatePlan = () => {
    const preset = ETF_PRESETS.find((p) => p.symbol === newSymbol);
    if (!preset) {
      toast.error(isZh ? '请选择ETF' : 'Please select an ETF');
      return;
    }

    // Check if plan already exists
    if (plans.find((p) => p.symbol === newSymbol)) {
      toast.error(isZh ? '该ETF已有定投计划' : 'DCA plan already exists for this ETF');
      return;
    }

    const amount = parseInt(newAmount);
    if (!amount || amount < 100) {
      toast.error(isZh ? '定投金额至少100元' : 'Minimum amount is ¥100');
      return;
    }

    const newPlan: DCAPlan = {
      id: String(Date.now()),
      symbol: preset.symbol,
      name: preset.name,
      category: preset.category,
      amount,
      period: newPeriod,
      weekDay: 2,
      avgCost: 0,
      totalInvested: 0,
      totalShares: 0,
      nextDate: newStartDate,
      isActive: true,
    };

    setPlans((prev) => [...prev, newPlan]);
    setCreateDialogOpen(false);
    resetCreateForm();
    toast.success(isZh ? `${preset.name} 定投计划已创建` : `${preset.name} DCA plan created`);
  };

  const handleEditPlan = () => {
    if (!editingPlan) return;
    const amount = parseInt(editAmount);
    if (!amount || amount < 100) {
      toast.error(isZh ? '定投金额至少100元' : 'Minimum amount is ¥100');
      return;
    }

    setPlans((prev) =>
      prev.map((p) =>
        p.id === editingPlan.id ? { ...p, amount, period: editPeriod } : p
      )
    );
    setEditDialogOpen(false);
    setEditingPlan(null);
    toast.success(isZh ? '定投计划已更新' : 'DCA plan updated');
  };

  const openEditDialog = (plan: DCAPlan) => {
    setEditingPlan(plan);
    setEditAmount(String(plan.amount));
    setEditPeriod(plan.period);
    setEditDialogOpen(true);
  };

  const openHistoryDialog = (planId: string) => {
    setHistoryPlanId(planId);
    setHistoryDialogOpen(true);
  };

  const resetCreateForm = () => {
    setNewSymbol('');
    setNewAmount('500');
    setNewPeriod('weekly');
    setNewStartDate(getNextTuesday());
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-[#111118]" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl bg-[#111118]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ 1. Summary Cards ═══ */}
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
              {activeCount}
              <span className="text-sm text-zinc-500 font-normal">/{plans.length}</span>
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
            <p className="text-2xl font-bold text-white">¥{investedThisMonth.toLocaleString()}</p>
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
            <p className="text-2xl font-bold text-white">¥{totalInvested.toLocaleString()}</p>
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
              {isZh
                ? `${nextTuesday.slice(5).replace("-", "/")} 周二`
                : `Tue ${nextTuesday.slice(5).replace("-", "/")}`
            }
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              <Clock className="w-3 h-3 inline mr-1" />
              {getCountdownToDate(nextTuesday)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ 2. My DCA Plans ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-400">{isZh ? '我的定投计划' : 'My DCA Plans'}</h3>
          {quotesLoading && (
            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchQuotes}
            disabled={quotesLoading}
            className="h-7 px-2 text-zinc-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${quotesLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Plus className="w-4 h-4" />
                {isZh ? '新建定投' : 'New Plan'}
              </Button>
            </DialogTrigger>
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
                  <Select value={newSymbol} onValueChange={setNewSymbol}>
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
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    min={100}
                    step={100}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                    placeholder="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">{isZh ? '定投周期' : 'Period'}</Label>
                  <Select value={newPeriod} onValueChange={(v) => setNewPeriod(v as 'weekly' | 'biweekly' | 'monthly')}>
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
                <div className="space-y-2">
                  <Label className="text-zinc-300">{isZh ? '开始日期' : 'Start Date'}</Label>
                  <Input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
                >
                  {isZh ? '取消' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleCreatePlan}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isZh ? '创建' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const quote = quotes[plan.symbol];
          const currentPrice = quote?.currentPrice || 0;
          const currentValue = currentPrice > 0 ? currentPrice * plan.totalShares : plan.totalInvested;
          const pnl = currentValue - plan.totalInvested;
          const pnlPercent = plan.totalInvested > 0 ? (pnl / plan.totalInvested) * 100 : 0;
          const changePercent = quote?.changePercent || 0;
          const catBadge = getCategoryBadge(plan.category);
          const insight = getSmartInsight(currentPrice, plan.avgCost);

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
                      <span className="text-sm font-bold text-white truncate">{plan.name}</span>
                      <span className="text-xs text-zinc-500 font-mono">{plan.symbol}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}
                      >
                        {catBadge.label}
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
                    <p className="text-sm text-zinc-300 mt-0.5">¥{plan.amount.toLocaleString()}</p>
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

                {/* Next Execution with countdown */}
                <div className="flex items-center justify-between text-xs mb-3 p-2 bg-[#0a0a0f] rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-400">{isZh ? '下次执行' : 'Next'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-300">{plan.nextDate.slice(5).replace('-', '/')}</span>
                    <span className="text-zinc-500 ml-1">({getCountdownToDate(plan.nextDate)})</span>
                  </div>
                </div>

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
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 pt-2 border-t border-[#1e1e2e]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-zinc-500 hover:text-white hover:bg-[#1a1a2e] gap-1 text-xs flex-1"
                    onClick={() => openEditDialog(plan)}
                  >
                    <Edit3 className="w-3 h-3" />
                    {isZh ? '编辑' : 'Edit'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 gap-1 text-xs flex-1 ${
                      plan.isActive
                        ? 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'
                        : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10'
                    }`}
                    onClick={() => handleTogglePlan(plan.id)}
                  >
                    {plan.isActive ? (
                      <>
                        <Pause className="w-3 h-3" />
                        {isZh ? '暂停' : 'Pause'}
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        {isZh ? '恢复' : 'Resume'}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 gap-1 text-xs flex-1"
                    onClick={() => openHistoryDialog(plan.id)}
                  >
                    <History className="w-3 h-3" />
                    {isZh ? '记录' : 'History'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══ 3. Execution History ═══ */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">
                {isZh ? '执行记录' : 'Execution History'}
              </CardTitle>
            </div>
            <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px]">
              {MOCK_EXECUTIONS.length} {isZh ? '条' : 'records'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '日期' : 'Date'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">ETF</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '金额' : 'Amount'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '价格' : 'Price'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '份额' : 'Shares'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '状态' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_EXECUTIONS
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((exec) => {
                    const statusConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
                      executed: {
                        bg: 'bg-emerald-600/10',
                        text: 'text-emerald-400',
                        border: 'border-emerald-600/20',
                        label: isZh ? '已执行' : 'Executed',
                      },
                      planned: {
                        bg: 'bg-blue-600/10',
                        text: 'text-blue-400',
                        border: 'border-blue-600/20',
                        label: isZh ? '待执行' : 'Planned',
                      },
                      skipped: {
                        bg: 'bg-yellow-600/10',
                        text: 'text-yellow-400',
                        border: 'border-yellow-600/20',
                        label: isZh ? '已跳过' : 'Skipped',
                      },
                    };
                    const sc = statusConfig[exec.status] || statusConfig.planned;

                    return (
                      <TableRow key={exec.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                        <TableCell className="text-xs text-zinc-400 font-mono">{exec.date}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-medium text-white">{exec.name}</p>
                            <p className="text-[10px] text-zinc-500">{exec.symbol}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-300">¥{exec.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-zinc-300 font-mono">
                          {exec.price > 0 ? `¥${exec.price.toFixed(3)}` : '--'}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-300 font-mono">
                          {exec.shares > 0 ? exec.shares.toLocaleString() : '--'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${sc.bg} ${sc.text} ${sc.border}`}
                          >
                            {sc.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 4. Smart DCA Insight ═══ */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">
              {isZh ? '智能定投洞察' : 'Smart DCA Insight'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map((plan) => {
              const quote = quotes[plan.symbol];
              const currentPrice = quote?.currentPrice || 0;
              const insight = getSmartInsight(currentPrice, plan.avgCost);
              const changePercent = quote?.changePercent || 0;

              return (
                <div
                  key={plan.id}
                  className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] hover:border-[#2e2e3e] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{plan.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{plan.symbol}</span>
                    </div>
                    {insight.type === 'increase' ? (
                      <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                    ) : insight.type === 'decrease' ? (
                      <ArrowDownCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <MinusCircle className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <span className="text-zinc-500">
                      {isZh ? '当前价' : 'Current'}:
                      <span className="text-zinc-300 ml-1 font-mono">
                        {currentPrice > 0 ? `¥${currentPrice.toFixed(3)}` : '--'}
                      </span>
                    </span>
                    <span className="text-zinc-500">
                      {isZh ? '均价' : 'Avg'}:
                      <span className="text-zinc-300 ml-1 font-mono">¥{plan.avgCost.toFixed(3)}</span>
                    </span>
                  </div>

                  {currentPrice > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                        <span>0.95x</span>
                        <span>1.00x</span>
                        <span>1.15x</span>
                      </div>
                      <div className="relative h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                        {/* Range indicators */}
                        <div className="absolute left-0 top-0 h-full w-[20%] bg-emerald-600/30 rounded-l-full" />
                        <div className="absolute left-[20%] top-0 h-full w-[60%] bg-zinc-600/20" />
                        <div className="absolute right-0 top-0 h-full w-[20%] bg-red-600/30 rounded-r-full" />
                        {/* Current position indicator */}
                        {(() => {
                          const ratio = currentPrice / plan.avgCost;
                          // Map ratio 0.85-1.25 to 0-100%
                          const position = Math.max(0, Math.min(100, ((ratio - 0.85) / 0.4) * 100));
                          return (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-sm"
                              style={{ left: `calc(${position}% - 4px)` }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        insight.type === 'increase'
                          ? 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20'
                          : insight.type === 'decrease'
                          ? 'bg-red-600/10 text-red-400 border-red-600/20'
                          : 'bg-zinc-600/10 text-zinc-400 border-zinc-600/20'
                      }`}
                    >
                      {insight.label}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                    {insight.description}
                  </p>
                  {changePercent !== 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {changePercent >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      <span className={`text-[10px] ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-zinc-600">{isZh ? '今日' : 'today'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isZh ? `编辑定投 - ${editingPlan?.name || ''}` : `Edit DCA - ${editingPlan?.name || ''}`}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {isZh ? '修改定投金额和周期' : 'Modify DCA amount and period'}
            </DialogDescription>
          </DialogHeader>
          {editingPlan && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-zinc-300">{isZh ? '每期金额 (元)' : 'Amount per Period (¥)'}</Label>
                <Input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  min={100}
                  step={100}
                  className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">{isZh ? '定投周期' : 'Period'}</Label>
                <Select value={editPeriod} onValueChange={(v) => setEditPeriod(v as 'weekly' | 'biweekly' | 'monthly')}>
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
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
            >
              {isZh ? '取消' : 'Cancel'}
            </Button>
            <Button
              onClick={handleEditPlan}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isZh ? '保存' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ History Dialog ═══ */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isZh ? '定投记录' : 'DCA History'} - {plans.find((p) => p.id === historyPlanId)?.name || ''}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {isZh ? '历史定投执行记录' : 'Historical DCA execution records'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '日期' : 'Date'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '金额' : 'Amount'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '价格' : 'Price'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '份额' : 'Shares'}</TableHead>
                  <TableHead className="text-zinc-400 text-xs">{isZh ? '状态' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_EXECUTIONS
                  .filter((e) => e.id === historyPlanId || e.symbol === plans.find((p) => p.id === historyPlanId)?.symbol)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((exec) => {
                    const statusConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
                      executed: {
                        bg: 'bg-emerald-600/10',
                        text: 'text-emerald-400',
                        border: 'border-emerald-600/20',
                        label: isZh ? '已执行' : 'Executed',
                      },
                      planned: {
                        bg: 'bg-blue-600/10',
                        text: 'text-blue-400',
                        border: 'border-blue-600/20',
                        label: isZh ? '待执行' : 'Planned',
                      },
                      skipped: {
                        bg: 'bg-yellow-600/10',
                        text: 'text-yellow-400',
                        border: 'border-yellow-600/20',
                        label: isZh ? '已跳过' : 'Skipped',
                      },
                    };
                    const sc = statusConfig[exec.status] || statusConfig.planned;

                    return (
                      <TableRow key={exec.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                        <TableCell className="text-xs text-zinc-400 font-mono">{exec.date}</TableCell>
                        <TableCell className="text-xs text-zinc-300">¥{exec.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-zinc-300 font-mono">
                          {exec.price > 0 ? `¥${exec.price.toFixed(3)}` : '--'}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-300 font-mono">
                          {exec.shares > 0 ? exec.shares.toLocaleString() : '--'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${sc.bg} ${sc.text} ${sc.border}`}
                          >
                            {sc.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHistoryDialogOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
            >
              {isZh ? '关闭' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
