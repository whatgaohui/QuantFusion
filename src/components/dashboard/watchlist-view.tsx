'use client';

import { useState, useCallback, useEffect } from 'react';
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
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: { v: number }[];
  market?: string;
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

// Map fusion API alert to our AlertItem interface
interface FusionAlert {
  id: string;
  symbol: string;
  alertType: string;
  targetValue: number;
  isActive: boolean;
  isTriggered: boolean;
  createdAt: string;
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

const mockWatchlist: WatchlistItem[] = [
  { id: '1', symbol: 'AAPL', name: '苹果', price: 189.45, change: 2.34, changePercent: 1.25, sparkline: generateSparkline() },
  { id: '2', symbol: 'NVDA', name: '英伟达', price: 615.20, change: 8.45, changePercent: 1.39, sparkline: generateSparkline() },
  { id: '3', symbol: 'TSLA', name: '特斯拉', price: 245.80, change: -3.67, changePercent: -1.47, sparkline: generateSparkline() },
  { id: '4', symbol: 'MSFT', name: '微软', price: 388.50, change: 1.89, changePercent: 0.49, sparkline: generateSparkline() },
  { id: '5', symbol: 'AMZN', name: '亚马逊', price: 178.25, change: -0.45, changePercent: -0.25, sparkline: generateSparkline() },
  { id: '6', symbol: 'META', name: 'Meta', price: 374.20, change: 5.67, changePercent: 1.54, sparkline: generateSparkline() },
];

const mockAlerts: AlertItem[] = [
  { id: '1', symbol: 'AAPL', targetPrice: 195.00, direction: 'above', active: true, createdAt: '2024-01-15', expiryDate: '2024-02-15' },
  { id: '2', symbol: 'TSLA', targetPrice: 240.00, direction: 'below', active: true, createdAt: '2024-01-14', expiryDate: '2024-02-14' },
  { id: '3', symbol: 'NVDA', targetPrice: 650.00, direction: 'above', active: true, createdAt: '2024-01-13', expiryDate: '2024-02-13' },
];

export function WatchlistView() {
  const { t, language } = useLanguage();
  const [watchlist, setWatchlist] = useState<WatchlistItem[] | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingQuotes, setRefreshingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
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

  // Fetch real-time quotes for all watchlist items
  const fetchQuotes = useCallback(async (items: { symbol: string; id: string; name: string; market?: string }[]) => {
    if (items.length === 0) return;

    setRefreshingQuotes(true);
    setQuotesError(null);

    try {
      const symbols = items.map(item => item.symbol).join(',');
      const res = await fetch(`/api/fusion/market/quote?symbols=${encodeURIComponent(symbols)}`);

      if (res.ok) {
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          const quoteMap = new Map<string, { currentPrice: number; change: number; changePercent: number }>();
          for (const q of result.data) {
            quoteMap.set(q.symbol, {
              currentPrice: q.currentPrice,
              change: q.change,
              changePercent: q.changePercent,
            });
          }

          setWatchlist(prev => {
            if (!prev) return prev;
            return prev.map(item => {
              const quote = quoteMap.get(item.symbol);
              if (quote) {
                return {
                  ...item,
                  price: quote.currentPrice || item.price,
                  change: quote.change ?? item.change,
                  changePercent: quote.changePercent ?? item.changePercent,
                };
              }
              return item;
            });
          });
        }
      } else {
        setQuotesError(t('watch.quotesError'));
      }
    } catch {
      setQuotesError(t('watch.quotesError'));
    } finally {
      setRefreshingQuotes(false);
    }
  }, [t]);

  const fetchData = useCallback(async () => {
    try {
      let watchlistRes: Response | null = null;
      let alertsRes: Response | null = null;
      try { watchlistRes = await fetch('/api/watchlist'); } catch { /* ignore */ }
      try { alertsRes = await fetch('/api/alerts'); } catch { /* ignore */ }

      let watchlistItems: { symbol: string; id: string; name: string; market?: string }[] = [];

      if (watchlistRes && watchlistRes.ok) {
        const data = await watchlistRes.json();
        if (Array.isArray(data) && data.length > 0) {
          watchlistItems = data.map((item: { id: string; symbol: string; name?: string; market?: string }) => ({
            id: item.id,
            symbol: item.symbol,
            name: item.name || item.symbol,
            market: item.market,
          }));
          const mapped: WatchlistItem[] = data.map((item: { id: string; symbol: string; name?: string; market?: string }) => ({
            id: item.id,
            symbol: item.symbol,
            name: item.name || item.symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            sparkline: generateSparkline(),
            market: item.market,
          }));
          setWatchlist(mapped);
        } else {
          setWatchlist(mockWatchlist);
          watchlistItems = mockWatchlist.map(i => ({ symbol: i.symbol, id: i.id, name: i.name }));
        }
      } else {
        setWatchlist(mockWatchlist);
        watchlistItems = mockWatchlist.map(i => ({ symbol: i.symbol, id: i.id, name: i.name }));
      }

      // Fetch real quotes for watchlist items
      if (watchlistItems.length > 0) {
        await fetchQuotes(watchlistItems);
      }

      // Process alerts from fusion API
      if (alertsRes && alertsRes.ok) {
        const data = await alertsRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: AlertItem[] = data.map((a: FusionAlert) => ({
            id: a.id,
            symbol: a.symbol,
            targetPrice: a.targetValue || 0,
            direction: (a.alertType === 'price_below' ? 'below' : 'above') as 'above' | 'below',
            active: a.isActive ?? true,
            createdAt: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          }));
          setAlerts(mapped);
        } else {
          setAlerts(mockAlerts);
        }
      } else {
        setAlerts(mockAlerts);
      }

      setLastUpdated(new Date());
    } catch {
      setWatchlist(mockWatchlist);
      setAlerts(mockAlerts);
    } finally {
      setLoading(false);
    }
  }, [fetchQuotes]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (watchlist && watchlist.length > 0) {
        fetchQuotes(watchlist);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchQuotes, watchlist?.length]);

  const handleRemoveFromWatchlist = async (id: string) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setWatchlist((prev) => prev?.filter((item) => item.id !== id) || null);
      }
    } catch {
      setWatchlist((prev) => prev?.filter((item) => item.id !== id) || null);
    }
  };

  const handleAddToWatchlist = async (symbol: string, name: string) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, name }),
      });
      if (res.ok) {
        const newItem = await res.json();
        // Fetch the current price for the added stock
        let price = 0, change = 0, changePercent = 0;
        try {
          const quoteRes = await fetch(`/api/fusion/market/quote?symbol=${symbol}`);
          if (quoteRes.ok) {
            const result = await quoteRes.json();
            if (result.success && result.data) {
              price = result.data.currentPrice || 0;
              change = result.data.change || 0;
              changePercent = result.data.changePercent || 0;
            }
          }
        } catch { /* use defaults */ }

        setWatchlist((prev) => [...(prev || []), {
          id: newItem.id || Date.now().toString(),
          symbol,
          name,
          price,
          change,
          changePercent,
          sparkline: generateSparkline(),
          market: newItem.market,
        }]);
      }
    } catch {
      setWatchlist((prev) => [...(prev || []), {
        id: Date.now().toString(),
        symbol,
        name,
        price: 150 + Math.random() * 100,
        change: (Math.random() - 0.5) * 5,
        changePercent: (Math.random() - 0.5) * 3,
        sparkline: generateSparkline(),
      }]);
    }
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleCreateAlert = async () => {
    if (!alertSymbol || !alertTargetPrice) return;
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: alertSymbol,
          alertType: alertDirection === 'above' ? 'price_above' : 'price_below',
          targetValue: parseFloat(alertTargetPrice),
        }),
      });
      if (res.ok) {
        const newAlertData = await res.json();
        const newAlert: AlertItem = {
          id: newAlertData.id || Date.now().toString(),
          symbol: alertSymbol,
          targetPrice: parseFloat(alertTargetPrice),
          direction: alertDirection,
          active: true,
          createdAt: new Date().toISOString().split('T')[0],
          expiryDate: alertExpiry || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        };
        setAlerts((prev) => [...(prev || []), newAlert]);
      }
    } catch {
      // Fallback: add locally
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
    }
    setAlertDialogOpen(false);
    setAlertSymbol('');
    setAlertTargetPrice('');
    setAlertDirection('above');
    setAlertExpiry('');
  };

  const handleRefreshQuotes = () => {
    if (watchlist && watchlist.length > 0) {
      fetchQuotes(watchlist);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data.slice(0, 10) : []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredSearchResults = searchResults.filter(
    (s) => !watchlist?.some((w) => w.symbol === s.symbol)
  );

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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder={t('watch.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            className="pl-9 bg-[#111118] border-[#1e1e2e] text-white placeholder:text-zinc-500 focus:border-emerald-600/50"
          />
          {showSearch && searchQuery && filteredSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111118] border border-[#1e1e2e] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
              {filteredSearchResults.map((result) => (
                <div
                  key={result.symbol}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a2e] transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium text-white">{result.symbol}</span>
                    <span className="text-xs text-zinc-500 ml-2">{result.description}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddToWatchlist(result.symbol, result.description)}
                    className="h-6 px-2 text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {showSearch && searchQuery && filteredSearchResults.length === 0 && !searching && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111118] border border-[#1e1e2e] rounded-lg shadow-xl z-50 p-4">
              <p className="text-sm text-zinc-500 text-center">{t('watch.noStocksFound')}</p>
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
                    placeholder="例如 AAPL"
                    value={alertSymbol}
                    onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('watch.targetPrice')}</Label>
                  <Input
                    type="number"
                    placeholder="例如 195.00"
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
            variant="outline"
            onClick={handleRefreshQuotes}
            disabled={refreshingQuotes}
            className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingQuotes ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('watch.refreshQuotes')}</span>
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <p className="text-[10px] text-zinc-600">{t('watch.lastUpdated')}: {lastUpdated.toLocaleTimeString()}</p>
        )}
        {quotesError && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-yellow-400" />
            <p className="text-[10px] text-yellow-400">{quotesError}</p>
          </div>
        )}
        {refreshingQuotes && (
          <p className="text-[10px] text-emerald-400">{t('watch.refreshing')}</p>
        )}
      </div>

      {/* Watchlist Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(watchlist || []).map((item) => (
          <Card
            key={item.id}
            className="bg-[#111118] border-[#1e1e2e] rounded-xl glow-hover transition-all duration-300 group"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{item.symbol}</h3>
                    {item.changePercent >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    )}
                    {item.market && (
                      <Badge
                        variant="secondary"
                        className={`text-[8px] px-1 py-0 ${
                          item.market === 'A' ? 'bg-red-600/15 text-red-400' :
                          item.market === 'HK' ? 'bg-yellow-600/15 text-yellow-400' :
                          'bg-emerald-600/15 text-emerald-400'
                        }`}
                      >
                        {item.market}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{item.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromWatchlist(item.id)}
                    className="h-6 w-6 p-0 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-zinc-600 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('watch.quickAnalyze')}
                  >
                    <Brain className="w-3.5 h-3.5" />
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
                    <div className="space-y-1">
                      <Skeleton className="h-6 w-20 bg-[#1a1a2e]" />
                      <Skeleton className="h-3 w-28 bg-[#1a1a2e]" />
                    </div>
                  )}
                </div>
                <div className="w-24 h-10">
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
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Stock Card */}
        <Card className="bg-[#111118] border-[#1e1e2e] border-dashed rounded-xl hover:border-emerald-600/30 transition-colors cursor-pointer group">
          <CardContent
            className="p-4 flex flex-col items-center justify-center h-full min-h-[120px]"
            onClick={() => {
              const input = document.querySelector(`input[placeholder="${t('watch.searchPlaceholder')}"]`) as HTMLInputElement;
              input?.focus();
            }}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-600/10 flex items-center justify-center mb-2 group-hover:bg-emerald-600/20 transition-colors">
              <Plus className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">{t('watch.addStock')}</span>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-white">{t('watch.activeAlerts')}</CardTitle>
            <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[10px]">
              {alerts?.filter(a => a.active).length || 0}
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
                          {alert.direction === 'above' ? '↑ 高于' : '↓ 低于'} ${alert.targetPrice.toFixed(2)}
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
                      onCheckedChange={async (checked) => {
                        // Update alert status via API
                        try {
                          await fetch('/api/alerts', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: alert.id, isActive: checked }),
                          });
                        } catch { /* local fallback */ }
                        setAlerts((prev) =>
                          prev?.map((a) => a.id === alert.id ? { ...a, active: checked } : a) || []
                        );
                      }}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch('/api/alerts', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: alert.id }),
                          });
                        } catch { /* local fallback */ }
                        setAlerts((prev) => prev?.filter((a) => a.id !== alert.id) || []);
                      }}
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
    </div>
  );
}
