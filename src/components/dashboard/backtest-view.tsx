'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  DollarSign,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  Search,
  Compass,
  Loader2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';

interface BacktestConfig {
  strategy: string;
  symbol: string;
  initialCapital: number;
  positionSizePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  cycleDays: number;
  startDate: string;
  endDate: string;
}

interface TradeRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
}

interface BacktestResult {
  totalReturn: number;
  totalReturnPct: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  equityCurve: { date: string; equity: number }[];
  trades: TradeRecord[];
  /** Data source: 'finnhub'=real data, 'simulated'=simulated data */
  dataSource?: 'finnhub' | 'simulated';
}

interface SearchResult {
  symbol: string;
  description: string;
  type: string;
}

interface BacktestViewProps {
  initialStrategy?: string;
  initialSymbol?: string;
  onNavigate?: (view: string) => void;
}

// Synced with strategy center's builtInStrategies
const builtInStrategies = [
  { value: 'ma-golden-cross', label: 'MA Golden Cross', isCustom: false },
  { value: 'macd-signal', label: 'MACD Signal', isCustom: false },
  { value: 'rsi-oversold-overbought', label: 'RSI Oversold/Overbought', isCustom: false },
  { value: 'bollinger-breakout', label: 'Bollinger Breakout', isCustom: false },
  { value: 'kdj-golden-cross', label: 'KDJ Golden Cross', isCustom: false },
  { value: 'volume-breakout', label: 'Volume Breakout', isCustom: false },
  { value: 'shrink-pullback', label: 'Shrink Pullback', isCustom: false },
  { value: 'wave-theory', label: 'Wave Theory', isCustom: false },
  { value: 'box-oscillation', label: 'Box Oscillation', isCustom: false },
  { value: 'event-driven', label: 'Event Driven', isCustom: false },
];

interface CustomStrategy {
  id: string;
  name: string;
  entryConditions: string[];
  exitConditions: string[];
  description?: string;
}

function getTodayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const defaultConfig: BacktestConfig = {
  strategy: 'ma-golden-cross',
  symbol: 'AAPL',
  initialCapital: 100000,
  positionSizePct: 10,
  stopLossPct: 8,
  takeProfitPct: 15,
  cycleDays: 7,
  startDate: '2024-06-01',
  endDate: getTodayStr(),
};

export function BacktestView({ initialStrategy, initialSymbol, onNavigate }: BacktestViewProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<BacktestConfig>(() => ({
    ...defaultConfig,
    ...(initialStrategy ? { strategy: initialStrategy } : {}),
    ...(initialSymbol ? { symbol: initialSymbol } : {}),
  }));
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom strategies loaded from API (database)
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>([]);

  // Combined strategies list for dropdown
  const allStrategies = [
    ...builtInStrategies,
    ...customStrategies.map((s) => ({ value: s.id, label: `${s.name} (Custom)`, isCustom: true })),
  ];

  // Symbol search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch custom strategies from API on mount
  useEffect(() => {
    async function fetchCustomStrategies() {
      try {
        const res = await fetch('/api/fusion/strategies');
        if (res.ok) {
          const data = await res.json();
          const custom = data
            .filter((s: { source?: string }) => s.source === 'custom')
            .map((s: { id: string; name: string; entryCondition?: string; exitCondition?: string; description?: string }) => ({
              id: s.id,
              name: s.name,
              entryConditions: s.entryCondition ? s.entryCondition.split('；').filter(Boolean) : [],
              exitConditions: s.exitCondition ? s.exitCondition.split('；').filter(Boolean) : [],
              description: s.description || '',
            }));
          setCustomStrategies(custom);
        }
      } catch {
        // Failed to fetch custom strategies, keep empty
      }
    }
    fetchCustomStrategies();
  }, []);

  // Update config when props change (e.g. navigation from strategy center)
  useEffect(() => {
    if (initialStrategy) {
      setConfig((prev) => ({ ...prev, strategy: initialStrategy }));
    }
    // Also refresh custom strategies when navigating from strategy center
    async function refetchCustomStrategies() {
      try {
        const res = await fetch('/api/fusion/strategies');
        if (res.ok) {
          const data = await res.json();
          const custom = data
            .filter((s: { source?: string }) => s.source === 'custom')
            .map((s: { id: string; name: string; entryCondition?: string; exitCondition?: string; description?: string }) => ({
              id: s.id,
              name: s.name,
              entryConditions: s.entryCondition ? s.entryCondition.split('；').filter(Boolean) : [],
              exitConditions: s.exitCondition ? s.exitCondition.split('；').filter(Boolean) : [],
              description: s.description || '',
            }));
          setCustomStrategies(custom);
        }
      } catch {
        // Failed to refresh custom strategies
      }
    }
    refetchCustomStrategies();
  }, [initialStrategy]);

  useEffect(() => {
    if (initialSymbol) {
      setConfig((prev) => ({ ...prev, symbol: initialSymbol }));
    }
  }, [initialSymbol]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Symbol search with debounce
  const handleSymbolSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setConfig((prev) => ({ ...prev, symbol: query.toUpperCase() }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
          setShowDropdown(true);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectSymbol = (symbol: string) => {
    setConfig((prev) => ({ ...prev, symbol }));
    setSearchQuery(symbol);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleRunBacktest = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      // Check if this is a custom strategy (either old localStorage 'custom-' prefix or DB cuid)
      const isBuiltInStrategy = builtInStrategies.some((s) => s.value === config.strategy);
      const isCustomStrategy = !isBuiltInStrategy;
      const requestBody: Record<string, unknown> = { ...config };

      // For custom strategies, send the strategy details
      if (isCustomStrategy) {
        const customStrat = customStrategies.find((s) => s.id === config.strategy);
        if (customStrat) {
          requestBody.customStrategy = {
            name: customStrat.name,
            entryConditions: customStrat.entryConditions,
            exitConditions: customStrat.exitConditions,
            description: customStrat.description,
          };
        }
      }

      const res = await fetch('/api/fusion/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        let errorMsg = t('back.backtestFailed');
        try {
          const errData = await res.json();
          if (errData.error) {
            errorMsg = errData.error;
          }
        } catch {
          // JSON parse failed, use default error message
        }
        setError(errorMsg);
      }
    } catch {
      setError(t('back.networkError'));
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setConfig({ ...defaultConfig, endDate: getTodayStr() });
    setResult(null);
    setError(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('back.config')}</CardTitle>
            </div>

          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Strategy Selector + Symbol */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.strategy')}</Label>
              <Select value={config.strategy} onValueChange={(v) => setConfig({ ...config, strategy: v })}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                  <SelectValue placeholder={t('back.selectStrategy')} />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  {allStrategies.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                      {s.isCustom ? `⭐ ${s.label}` : s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.symbol')}</Label>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                  <Input
                    ref={inputRef}
                    placeholder={t('back.searchSymbol')}
                    value={searchQuery || config.symbol}
                    onChange={(e) => handleSymbolSearch(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowDropdown(true);
                    }}
                    className="pl-9 pr-8 bg-[#0a0a0f] border-[#1e1e2e] text-white uppercase"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 animate-spin" />
                  )}
                  {!searching && searchQuery && (
                    <button
                      onClick={() => {
                        handleSymbolSearch('');
                        inputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Autocomplete Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#111118] border border-[#1e1e2e] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {searchResults.map((stock) => (
                      <button
                        key={stock.symbol}
                        onClick={() => handleSelectSymbol(stock.symbol)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#1a1a2e] transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-white">{stock.symbol}</span>
                          <span className="text-xs text-zinc-400 truncate">{stock.description}</span>
                        </div>
                        <Badge className="bg-[#1e1e2e] text-zinc-500 text-[9px] border-0 flex-shrink-0">
                          {stock.type}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.initialCapital')}</Label>
              <Input
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig({ ...config, initialCapital: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.positionSize')}</Label>
              <Input
                type="number"
                value={config.positionSizePct}
                onChange={(e) => setConfig({ ...config, positionSizePct: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.stopLoss')}</Label>
              <Input
                type="number"
                value={config.stopLossPct}
                onChange={(e) => setConfig({ ...config, stopLossPct: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.takeProfit')}</Label>
              <Input
                type="number"
                value={config.takeProfitPct}
                onChange={(e) => setConfig({ ...config, takeProfitPct: parseFloat(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.cycleDays')}</Label>
              <Input
                type="number"
                value={config.cycleDays}
                onChange={(e) => setConfig({ ...config, cycleDays: parseInt(e.target.value) || 0 })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.startDate')}</Label>
              <Input
                type="date"
                value={config.startDate}
                max={config.endDate}
                onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
          </div>

          <div className="max-w-xs">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('back.endDate')}</Label>
              <Input
                type="date"
                value={config.endDate}
                min={config.startDate}
                max={getTodayStr()}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRunBacktest}
              disabled={running || !config.symbol}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Play className="w-4 h-4" />
              {running ? t('back.running') : t('back.runBacktest')}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('back.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Simulated Data Warning Banner */}
          {result.dataSource === 'simulated' && (
            <Card className="bg-yellow-900/20 border-yellow-600/30 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 border text-xs font-semibold">
                        {t('back.simulatedData')}
                      </Badge>
                    </div>
                    <p className="text-yellow-300/80 text-sm leading-relaxed">
                      {t('back.simulatedWarning')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.totalReturn')}</span>
                </div>
                <p className={`text-lg font-bold ${result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.totalReturn >= 0 ? '+' : ''}${Math.abs(result.totalReturn).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {result.totalReturnPct >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.returnPercent')}</span>
                </div>
                <p className={`text-lg font-bold ${result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.winRate')}</span>
                </div>
                <p className={`text-lg font-bold ${result.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.winRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.maxDrawdown')}</span>
                </div>
                <p className="text-lg font-bold text-red-400">{result.maxDrawdown.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.sharpeRatio')}</span>
                </div>
                <p className={`text-lg font-bold ${result.sharpeRatio >= 1 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {result.sharpeRatio.toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('back.totalTrades')}</span>
                </div>
                <p className="text-lg font-bold text-white">{result.totalTrades}</p>
              </CardContent>
            </Card>
          </div>

          {/* Equity Curve */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-white">{t('back.equityCurve')}</CardTitle>
                <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                  {config.symbol}
                </Badge>
                {result.dataSource === 'simulated' && (
                  <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[10px]">
                    {t('back.simulatedData')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equityCurve}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} interval={29} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2e2e3e', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Equity']}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Trade List */}
          {result.trades && result.trades.length > 0 && (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-white">{t('back.tradeList')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs">Symbol</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Side</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Entry</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Exit</TableHead>
                        <TableHead className="text-zinc-400 text-xs">{t('back.tradePnl')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.trades.map((trade) => (
                        <TableRow key={trade.id} className="border-[#1e1e2e] hover:bg-[#1a1a2e]/50">
                          <TableCell className="text-sm font-medium text-white">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] px-1.5 py-0 ${trade.side === 'BUY' ? 'bg-emerald-600/15 text-emerald-400' : 'bg-red-600/15 text-red-400'}`}>
                              {trade.side}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-zinc-300">${trade.entryPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-zinc-300">${trade.exitPrice.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} ({trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%)
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Error State */}
      {error && !running && (
        <Card className="bg-[#111118] border-red-900/30 rounded-xl">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 text-sm font-medium mb-2">{t('back.backtestFailed')}</p>
            <p className="text-zinc-400 text-xs max-w-md mx-auto">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* No Results State */}
      {!result && !running && !error && (
        <Card className="bg-[#111118] border-[#1e1e2e] border-dashed rounded-xl">
          <CardContent className="py-16 text-center">
            <FlaskConical className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">{t('back.configureAndRun')}</p>
            <p className="text-zinc-500 text-xs mt-1">{t('back.resultsWillAppear')}</p>
          </CardContent>
        </Card>
      )}

      {/* Running State */}
      {running && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-emerald-400 text-sm font-medium">{t('back.runningSimulation')}</p>
            <p className="text-zinc-500 text-xs mt-1">{t('back.analyzingHistorical')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
