'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Eye,
  Search,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Bell,
  BellRing,
  RefreshCw,
  X,
  Brain,
  Loader2,
  PlusCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';
import { AddPositionDialog } from '@/components/dashboard/add-position-dialog';

// ============================================================
// Types
// ============================================================

/** Shape returned by the /api/watchlist Prisma model */
interface WatchlistApiItem {
  id: string;
  userId: string;
  symbol: string;
  market: string;
  name: string | null;
  groupName: string | null;
  sortOrder: number;
  createdAt: string;
}

/** UI-level watchlist item with price data */
interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: { v: number }[];
}

interface AlertItem {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  active: boolean;
  createdAt: string;
  expiryDate: string;
}

interface SearchResult {
  symbol: string;
  description: string;
  type: string;
}

// ============================================================
// Helpers
// ============================================================

/** Map a Prisma WatchlistApiItem to a UI WatchlistItem with safe defaults */
function mapApiItemToWatchlistItem(apiItem: WatchlistApiItem): WatchlistItem {
  return {
    id: apiItem.id,
    symbol: apiItem.symbol,
    name: apiItem.name || apiItem.symbol,
    price: 0,
    change: 0,
    changePercent: 0,
    sparkline: generateSparkline(),
  };
}

/**
 * 将API返回的alerts数据转换为前端AlertItem格式
 * 支持两种数据源：SignalAlert（/api/alerts）和 DB Alert（Prisma）
 */
function normalizeAlertItem(raw: Record<string, unknown>): AlertItem | null {
  // 已经是 AlertItem 格式（有 targetPrice）
  if (typeof raw.targetPrice === 'number') {
    return {
      id: String(raw.id),
      symbol: String(raw.symbol),
      targetPrice: raw.targetPrice,
      direction: (raw.direction as 'above' | 'below') || 'above',
      active: raw.active !== false,
      createdAt: String(raw.createdAt || new Date().toISOString().split('T')[0]),
      expiryDate: String(raw.expiryDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
    };
  }

  // DB Alert 格式（有 targetValue）
  if (typeof raw.targetValue === 'number') {
    return {
      id: String(raw.id),
      symbol: String(raw.symbol),
      targetPrice: raw.targetValue,
      direction: (raw.alertType as string)?.includes('below') ? 'below' : 'above',
      active: raw.isActive !== false,
      createdAt: String(raw.createdAt || new Date().toISOString().split('T')[0]),
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    };
  }

  // SignalAlert 格式（/api/alerts 返回的格式）
  if (raw.message && raw.type) {
    return {
      id: String(raw.id),
      symbol: String(raw.symbol),
      targetPrice: 0,
      direction: 'above',
      active: true,
      createdAt: String(raw.timestamp || new Date().toISOString().split('T')[0]),
      expiryDate: new Date((raw.ttl as number) || Date.now() + 30 * 86400000).toISOString().split('T')[0],
    };
  }

  // 无法识别的格式，跳过
  return null;
}

function generateSparkline(): { v: number }[] {
  const data: { v: number }[] = [];
  let base = 100 + Math.random() * 50;
  for (let i = 0; i < 20; i++) {
    base += (Math.random() - 0.48) * 3;
    data.push({ v: Number(base.toFixed(2)) });
  }
  return data;
}

const mockAlerts: AlertItem[] = [
  { id: '1', symbol: 'AAPL', targetPrice: 195.00, direction: 'above', active: true, createdAt: '2024-01-15', expiryDate: '2024-02-15' },
  { id: '2', symbol: 'TSLA', targetPrice: 240.00, direction: 'below', active: true, createdAt: '2024-01-14', expiryDate: '2024-02-14' },
  { id: '3', symbol: 'NVDA', targetPrice: 650.00, direction: 'above', active: true, createdAt: '2024-01-13', expiryDate: '2024-02-13' },
];

// ============================================================
// Component
// ============================================================

interface WatchlistViewProps {
  onNavigate?: (view: string, extra?: Record<string, string>) => void;
}

export function WatchlistView({ onNavigate }: WatchlistViewProps) {
  const { t, language } = useLanguage();
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertSymbol, setAlertSymbol] = useState('');
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above');
  const [alertExpiry, setAlertExpiry] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [addPositionSymbol, setAddPositionSymbol] = useState('');
  const [addPositionPrice, setAddPositionPrice] = useState<number | undefined>(undefined);
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch real-time prices for all watchlist symbols
  const fetchPrices = useCallback(async (items: WatchlistItem[]): Promise<WatchlistItem[]> => {
    if (!items || items.length === 0) return items;

    const updated = await Promise.all(
      items.map(async (item) => {
        try {
          const [quoteRes, klineRes] = await Promise.allSettled([
            fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(item.symbol)}`),
            fetch(`/api/fusion/market/kline?symbol=${encodeURIComponent(item.symbol)}&period=D&count=20`),
          ]);

          let price = item.price;
          let change = item.change;
          let changePercent = item.changePercent;
          let sparkline = item.sparkline;

          if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
            const quoteData = await quoteRes.value.json();
            if (quoteData.currentPrice && quoteData.currentPrice > 0) {
              price = quoteData.currentPrice;
              change = quoteData.change ?? 0;
              changePercent = quoteData.changePercent ?? 0;
            }
          }

          if (klineRes.status === 'fulfilled' && klineRes.value.ok) {
            const klineData = await klineRes.value.json();
            if (klineData.c && Array.isArray(klineData.c) && klineData.c.length > 0) {
              // Use the last 20 close prices for sparkline
              const closes = klineData.c.slice(-20);
              sparkline = closes.map((v: number) => ({ v }));
            }
          }

          return { ...item, price, change, changePercent, sparkline };
        } catch {
          return item;
        }
      })
    );

    return updated;
  }, []);

  // Initial data fetch
  const fetchData = useCallback(async () => {
    try {
      const [watchlistRes, alertsRes] = await Promise.allSettled([
        fetch('/api/watchlist'),
        fetch('/api/alerts'),
      ]);

      let currentWatchlist: WatchlistItem[];

      if (watchlistRes.status === 'fulfilled' && watchlistRes.value.ok) {
        const data = await watchlistRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          // Properly map API items (Prisma model) to UI WatchlistItem format
          currentWatchlist = (data as WatchlistApiItem[]).map(mapApiItemToWatchlistItem);
        } else {
          // API returned empty array — show empty state, don't use mock data
          currentWatchlist = [];
        }
      } else {
        // API call completely failed — show empty state
        currentWatchlist = [];
      }

      // Fetch real prices for the watchlist
      const updatedWatchlist = await fetchPrices(currentWatchlist);
      setWatchlist(updatedWatchlist);

      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const data = await alertsRes.value.json();
        if (Array.isArray(data) && data.length > 0) {
          // 将API数据转换为AlertItem格式，过滤掉无法识别的数据
          const normalized = data
            .map((item: Record<string, unknown>) => normalizeAlertItem(item))
            .filter((item: AlertItem | null): item is AlertItem => item !== null);
          setAlerts(normalized.length > 0 ? normalized : mockAlerts);
        } else {
          setAlerts(mockAlerts);
        }
      } else {
        setAlerts(mockAlerts);
      }

      setLastUpdated(new Date());
    } catch {
      setWatchlist([]);
      setAlerts(mockAlerts);
    } finally {
      setLoading(false);
    }
  }, [fetchPrices]);

  // Periodic price refresh (every 30s)
  const refreshPrices = useCallback(async () => {
    if (!watchlist || watchlist.length === 0) return;
    setRefreshingPrices(true);
    try {
      const updated = await fetchPrices(watchlist);
      setWatchlist(updated);
      setLastUpdated(new Date());
    } catch {
      // Silently fail on background refresh
    } finally {
      setRefreshingPrices(false);
    }
  }, [watchlist, fetchPrices]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    priceIntervalRef.current = setInterval(refreshPrices, 30000);
    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
      }
    };
  }, [refreshPrices]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRemoveFromWatchlist = async (id: string, symbol: string) => {
    // Optimistically remove from local state
    setWatchlist((prev) => prev?.filter((item) => item.id !== id) || null);

    try {
      // Try deleting by ID first
      let res = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      // If ID-based delete fails (e.g. item not found), try by symbol
      if (!res.ok) {
        res = await fetch('/api/watchlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
      }

      if (!res.ok) {
        // If both fail, still keep the item removed from local state
        // (it might have been a mock/phantom item)
        console.warn(`Failed to delete watchlist item (id=${id}, symbol=${symbol}) from server`);
      }
    } catch {
      // Network error — item already removed from local state
    }
  };

  const handleAddToWatchlist = async (symbol: string, name: string) => {
    // Check if already in local watchlist
    if (watchlist?.some((item) => item.symbol.toUpperCase() === symbol.toUpperCase())) {
      toast.info(language === 'zh' ? '该股票已在自选股中' : 'Stock already in watchlist');
      setShowSearch(false);
      setSearchQuery('');
      return;
    }

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, name }),
      });

      if (res.status === 409) {
        // Stock already in watchlist on server
        toast.info(language === 'zh' ? '该股票已在自选股中' : 'Stock already in watchlist');
        setShowSearch(false);
        setSearchQuery('');
        return;
      }

      if (res.ok) {
        // Parse the server-returned item to get the real database ID
        const serverItem = (await res.json()) as WatchlistApiItem;
        const newItem: WatchlistItem = {
          id: serverItem.id,
          symbol: serverItem.symbol,
          name: serverItem.name || serverItem.symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          sparkline: generateSparkline(),
        };

        // Add to local state immediately, then fetch real price
        setWatchlist((prev) => [...(prev || []), newItem]);

        // Fetch real price in background and update
        try {
          const priced = await fetchPrices([newItem]);
          if (priced[0]) {
            setWatchlist((prev) =>
              prev?.map((item) => item.id === serverItem.id ? priced[0] : item) || []
            );
          }
        } catch {
          // Price fetch failed, keep the item with defaults
        }

        toast.success(language === 'zh' ? `已添加 ${symbol} 到自选股` : `Added ${symbol} to watchlist`);
      } else {
        // Server error — don't add to local state, show error
        toast.error(language === 'zh' ? '添加失败，请重试' : 'Failed to add, please retry');
      }
    } catch {
      // Network error — don't add to local state
      toast.error(language === 'zh' ? '网络错误，请重试' : 'Network error, please retry');
    }

    setShowSearch(false);
    setSearchQuery('');
  };

  const handleCreateAlert = () => {
    if (!alertSymbol || !alertTargetPrice) return;
    const newAlert: AlertItem = {
      id: Date.now().toString(),
      symbol: alertSymbol,
      targetPrice: parseFloat(alertTargetPrice),
      direction: alertDirection,
      active: true,
      createdAt: new Date().toISOString().split('T')[0],
      expiryDate: alertExpiry || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    };
    setAlerts((prev) => [...(prev || []), newAlert]);
    setAlertDialogOpen(false);
    setAlertSymbol('');
    setAlertTargetPrice('');
    setAlertDirection('above');
    setAlertExpiry('');
  };

  // Debounced search - also supports Chinese fund codes (510880, etc.)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        // Search both general market and ETF/fund databases
        const [marketRes, etfRes] = await Promise.allSettled([
          fetch(`/api/market/search?q=${encodeURIComponent(searchQuery)}`),
          fetch(`/api/etf/search?q=${encodeURIComponent(searchQuery)}`),
        ]);

        const allResults: SearchResult[] = [];
        const seenSymbols = new Set<string>();

        // Process market search results
        if (marketRes.status === 'fulfilled' && marketRes.value.ok) {
          const data = await marketRes.value.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              if (!seenSymbols.has(item.symbol.toUpperCase())) {
                seenSymbols.add(item.symbol.toUpperCase());
                allResults.push({ symbol: item.symbol, description: item.description || item.symbol, type: item.type || 'Stock' });
              }
            }
          }
        }

        // Process ETF/fund search results (these include Chinese fund codes)
        if (etfRes.status === 'fulfilled' && etfRes.value.ok) {
          const data = await etfRes.value.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              if (!seenSymbols.has(item.symbol.toUpperCase())) {
                seenSymbols.add(item.symbol.toUpperCase());
                allResults.push({ symbol: item.symbol, description: item.name || item.symbol, type: item.category || 'ETF' });
              }
            }
          }
        }

        setSearchResults(allResults.slice(0, 15));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredSearchResults = searchResults.filter(
    (s) => !watchlist?.some((w) => w.symbol.toUpperCase() === s.symbol.toUpperCase())
  );

  /** Focus the search input (used by the "Add Stock" card) */
  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus();
    setShowSearch(true);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-[#111118]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1" ref={searchContainerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            ref={searchInputRef}
            placeholder={t('watch.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            className="pl-9 bg-[#111118] border-[#1e1e2e] text-white placeholder:text-zinc-500 focus:border-emerald-600/50"
          />
          {/* Search dropdown */}
          {showSearch && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111118] border border-[#1e1e2e] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
              {searching && (
                <div className="flex items-center justify-center gap-2 px-4 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  <span className="text-sm text-zinc-400">
                    {language === 'zh' ? '搜索中...' : 'Searching...'}
                  </span>
                </div>
              )}
              {!searching && filteredSearchResults.length > 0 && (
                filteredSearchResults.map((result) => (
                  <div
                    key={result.symbol}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a2e] transition-colors cursor-pointer"
                    onClick={() => handleAddToWatchlist(result.symbol, result.description)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{result.symbol}</span>
                      <span className="text-xs text-zinc-500 ml-2 truncate">{result.description}</span>
                    </div>
                    <Plus className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />
                  </div>
                ))
              )}
              {!searching && filteredSearchResults.length === 0 && searchResults.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-sm text-zinc-500 text-center">
                    {language === 'zh' ? '所有搜索结果已在自选股中' : 'All results already in watchlist'}
                  </p>
                </div>
              )}
              {!searching && searchResults.length === 0 && (
                <div className="px-4 py-3">
                  <p className="text-sm text-zinc-500 text-center">{t('watch.noStocksFound')}</p>
                  <button
                    className="mt-2 w-full text-sm text-emerald-400 hover:text-emerald-300 py-1.5 rounded-md border border-emerald-600/30 hover:border-emerald-600/50 transition-colors"
                    onClick={() => handleAddToWatchlist(searchQuery.toUpperCase().trim(), searchQuery.toUpperCase().trim())}
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    {language === 'zh' ? `直接添加 ${searchQuery.toUpperCase().trim()}` : `Add ${searchQuery.toUpperCase().trim()} directly`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-2">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">{t('watch.createAlert')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111118] border-[#1e1e2e]">
              <DialogHeader>
                <DialogTitle className="text-white">{t('watch.createPriceAlert')}</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  {t('watch.alertDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('watch.symbol')}</Label>
                  <Input
                    placeholder="e.g., AAPL"
                    value={alertSymbol}
                    onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('watch.targetPrice')}</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 195.00"
                    value={alertTargetPrice}
                    onChange={(e) => setAlertTargetPrice(e.target.value)}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('watch.direction')}</Label>
                  <Select value={alertDirection} onValueChange={(v) => setAlertDirection(v as 'above' | 'below')}>
                    <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                      <SelectItem value="above">{t('watch.priceGoesAbove')}</SelectItem>
                      <SelectItem value="below">{t('watch.priceGoesBelow')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('watch.expiryDate')}</Label>
                  <Input
                    type="date"
                    value={alertExpiry}
                    onChange={(e) => setAlertExpiry(e.target.value)}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAlertDialogOpen(false)}
                  className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300"
                >
                  {t('watch.cancel')}
                </Button>
                <Button
                  onClick={handleCreateAlert}
                  disabled={!alertSymbol || !alertTargetPrice}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {t('watch.createAlertBtn')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshPrices}
            disabled={refreshingPrices}
            className="text-zinc-400 hover:text-white border-[#1e1e2e]"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingPrices ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-[10px] text-zinc-600 -mt-4">
          {t('watch.lastUpdated')}: {lastUpdated.toLocaleTimeString()}
          {refreshingPrices && (
            <span className="ml-2 text-emerald-500 inline-flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {t('watch.refreshing')}
            </span>
          )}
        </p>
      )}

      {/* Watchlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(watchlist || []).map((item) => (
          <Card
            key={item.id}
            className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300 group cursor-pointer"
            onClick={() => onNavigate?.('etfDetail', { symbol: item.symbol, name: item.name })}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{item.symbol}</h3>
                    {item.changePercent >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.name}</p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddPositionSymbol(item.symbol);
                      setAddPositionPrice(item.price > 0 ? item.price : undefined);
                      setAddPositionOpen(true);
                    }}
                    className="h-6 w-6 p-0 text-zinc-600 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('pos.addPosition')}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromWatchlist(item.id, item.symbol)}
                    className="h-6 w-6 p-0 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  {item.price > 0 ? (
                    <>
                      <p className="text-lg font-bold text-white">${item.price.toFixed(2)}</p>
                      <p className={`text-xs font-medium ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-zinc-500">--</p>
                      <p className="text-xs text-zinc-600">{t('watch.loadingPrice')}</p>
                    </>
                  )}
                </div>
                <div className="w-24 h-10">
                  {item.sparkline && item.sparkline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={item.sparkline}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={item.change >= 0 ? '#10b981' : '#ef4444'}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Eye className="w-4 h-4 text-zinc-600" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Stock Card */}
        <Card
          className="bg-[#111118] border-[#1e1e2e] border-dashed rounded-xl hover:border-emerald-600/30 transition-colors cursor-pointer group"
          onClick={focusSearchInput}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[120px]">
            <div className="w-10 h-10 rounded-full bg-emerald-600/10 flex items-center justify-center mb-2 group-hover:bg-emerald-600/20 transition-colors">
              <Plus className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">{t('watch.addStock')}</span>
          </CardContent>
        </Card>
      </div>

      {/* Empty state when no stocks */}
      {(!watchlist || watchlist.length === 0) && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-8 text-center">
            <Eye className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm font-medium">
              {language === 'zh' ? '自选股列表为空' : 'Your watchlist is empty'}
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              {language === 'zh' ? '使用上方搜索框搜索并添加股票' : 'Use the search bar above to find and add stocks'}
            </p>
            <Button
              variant="outline"
              className="mt-4 border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/10 hover:text-emerald-300 gap-2"
              onClick={focusSearchInput}
            >
              <Plus className="w-4 h-4" />
              {language === 'zh' ? '添加第一只股票' : 'Add your first stock'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-white">{t('watch.activeAlerts')}</CardTitle>
            <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[10px]">
              {alerts?.length || 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!alerts || alerts.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">{t('watch.noActiveAlerts')}</p>
              <p className="text-zinc-500 text-xs mt-1">{t('watch.createAlertHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      alert.active ? 'bg-yellow-600/10' : 'bg-zinc-600/10'
                    }`}>
                      {alert.active ? (
                        <BellRing className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <Bell className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{alert.symbol}</span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 ${
                            alert.direction === 'above'
                              ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                              : 'bg-red-600/15 text-red-400 border-red-600/20'
                          }`}
                        >
                          {alert.direction === 'above' ? '↑ Above' : '↓ Below'} ${(alert.targetPrice ?? 0).toFixed(2)}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {t('watch.expires')}: {alert.expiryDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={alert.active}
                      onCheckedChange={(checked) => {
                        setAlerts((prev) =>
                          prev?.map((a) => a.id === alert.id ? { ...a, active: checked } : a) || []
                        );
                      }}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAlerts((prev) => prev?.filter((a) => a.id !== alert.id) || [])}
                      className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Position Dialog */}
      <AddPositionDialog
        open={addPositionOpen}
        onOpenChange={setAddPositionOpen}
        symbol={addPositionSymbol}
        price={addPositionPrice}
      />
    </div>
  );
}
