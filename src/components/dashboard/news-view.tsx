'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  Clock,
  Filter,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Globe,
  BookmarkCheck,
  LayoutList,
  Sparkles,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';

interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  sourceName: string;
  url: string;
  image: string;
  summary: string;
  category: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  relatedStocks: string[];
  timestamp: string;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  market: string;
  groupName: string | null;
  sortOrder: number;
}

/** 新闻源定义 */
const NEWS_SOURCES = [
  { value: 'all', label: 'All Sources', labelZh: '全部来源' },
  { value: 'finnhub', label: 'Finnhub', labelZh: 'Finnhub' },
  { value: 'cls', label: 'CLS (财联社)', labelZh: '财联社' },
  { value: 'sina', label: 'Sina Finance', labelZh: '新浪财经' },
  { value: 'wallstreetcn', label: 'Wall Street CN', labelZh: '华尔街见闻' },
] as const;

/** 新闻模式 */
type NewsMode = 'watchlist' | 'all';

const mockNews: NewsArticle[] = [
  {
    id: '1',
    headline: 'S&P 500 Hits New All-Time High as Tech Sector Leads Rally',
    source: 'Reuters',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'The benchmark index climbed to a record close as strong earnings from major technology companies boosted investor sentiment across the board.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['AAPL', 'NVDA', 'MSFT'],
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    headline: 'NVIDIA Surges on AI Chip Demand Forecast, Beats Quarterly Estimates',
    source: 'Bloomberg',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'The chipmaker raised its revenue guidance for the current quarter, citing unprecedented demand for its AI training and inference processors.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['NVDA', 'AMD'],
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '3',
    headline: '国务院常务会议：加大宏观政策调控力度，着力扩大内需',
    source: '财联社',
    sourceName: 'cls',
    url: '#',
    image: '',
    summary: '会议指出，要精准有力实施宏观政策，加强各类政策协调配合，形成共促高质量发展的合力。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: '4',
    headline: 'A股三大指数集体收涨：沪指涨0.82%重返3300点',
    source: '新浪财经',
    sourceName: 'sina',
    url: '#',
    image: '',
    summary: 'A股三大指数今日集体收涨，沪指涨0.82%报3318.66点，深成指涨1.18%，创业板指涨1.56%。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 9000000).toISOString(),
  },
  {
    id: '5',
    headline: '美联储7月纪要：多数官员支持进一步加息，但步伐可能放缓',
    source: '华尔街见闻',
    sourceName: 'wallstreetcn',
    url: '#',
    image: '',
    summary: '美联储7月议息会议纪要显示，多数官员认为需要进一步收紧货币政策以将通胀降至2%目标。',
    category: 'general',
    sentiment: 'bearish',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: '6',
    headline: 'Bitcoin ETFs See Record Inflows on First Day of Trading',
    source: 'CoinDesk',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'Newly approved spot Bitcoin ETFs attracted over $4.6 billion in trading volume on their debut, marking the most successful ETF launch in history.',
    category: 'crypto',
    sentiment: 'bullish',
    relatedStocks: ['COIN'],
    timestamp: new Date(Date.now() - 21600000).toISOString(),
  },
];

function getCategoryColor(category: string): string {
  switch (category) {
    case 'crypto': return 'bg-purple-600/15 text-purple-400 border-purple-600/20';
    case 'forex': return 'bg-cyan-600/15 text-cyan-400 border-cyan-600/20';
    case 'merger': return 'bg-orange-600/15 text-orange-400 border-orange-600/20';
    case 'a_share': return 'bg-red-600/15 text-red-400 border-red-600/20';
    default: return 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20';
  }
}

/** 新闻源标识的颜色 */
function getSourceColor(sourceName: string): string {
  switch (sourceName) {
    case 'finnhub': return 'bg-blue-600/15 text-blue-400 border-blue-600/20';
    case 'cls': return 'bg-red-600/15 text-red-400 border-red-600/20';
    case 'sina': return 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20';
    case 'wallstreetcn': return 'bg-cyan-600/15 text-cyan-400 border-cyan-600/20';
    default: return 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';
  }
}

function getSentimentConfig(sentiment: string): { color: string; icon: React.ReactNode; labelKey: string } {
  switch (sentiment) {
    case 'bullish': return { color: 'bg-emerald-600/15 text-emerald-400', icon: <TrendingUp className="w-3 h-3" />, labelKey: 'news.bullish' };
    case 'bearish': return { color: 'bg-red-600/15 text-red-400', icon: <TrendingDown className="w-3 h-3" />, labelKey: 'news.bearish' };
    default: return { color: 'bg-yellow-600/15 text-yellow-400', icon: <Minus className="w-3 h-3" />, labelKey: 'news.neutral' };
  }
}

function timeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/** 相关股票展示区（含自选股相关度标识） */
function RelatedStocksSection({
  article,
  getRelatedWatchlistStocks,
  onNavigate,
  t,
}: {
  article: NewsArticle;
  watchlistSymbols: string[];
  getRelatedWatchlistStocks: (article: NewsArticle) => string[];
  onNavigate?: (view: string) => void;
  language: string;
  t: (key: string) => string;
}) {
  const relatedWatchlistStocks = getRelatedWatchlistStocks(article);
  const hasContent = relatedWatchlistStocks.length > 0 || (article.relatedStocks && article.relatedStocks.length > 0);

  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-1.5 mb-3">
      {/* Watchlist relevance indicator */}
      {relatedWatchlistStocks.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-400/80 font-medium flex items-center gap-0.5">
            <BookmarkCheck className="w-2.5 h-2.5" />
            {t('news.relevance')}:
          </span>
          {relatedWatchlistStocks.map((stock) => (
            <span
              key={stock}
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-600/20 text-amber-300 border border-amber-600/30"
            >
              {stock}
            </span>
          ))}
        </div>
      )}
      {/* All related stocks */}
      {article.relatedStocks && article.relatedStocks.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-zinc-500">{t('news.analyzeStock')}:</span>
          {article.relatedStocks.map((stock) => (
            <button
              key={stock}
              onClick={(e) => { e.stopPropagation(); onNavigate?.('aiAnalysis'); }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors flex items-center gap-0.5 ${
                relatedWatchlistStocks.includes(stock.toUpperCase())
                  ? 'bg-amber-600/15 text-amber-400 hover:bg-amber-600/25'
                  : 'bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20'
              }`}
            >
              {stock}
              <Brain className="w-2.5 h-2.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NewsViewProps {
  onNavigate?: (view: string) => void;
}

export function MarketNewsView({ onNavigate }: NewsViewProps) {
  const { t, language } = useLanguage();
  const [news, setNews] = useState<NewsArticle[] | null>(null);
  const [newsIsMock, setNewsIsMock] = useState(true);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [symbolFilter, setSymbolFilter] = useState('');

  // 自选股相关状态
  const [newsMode, setNewsMode] = useState<NewsMode>('all');
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [watchlistNames, setWatchlistNames] = useState<Record<string, string>>({});
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistNews, setWatchlistNews] = useState<NewsArticle[]>([]);
  const [watchlistNewsLoading, setWatchlistNewsLoading] = useState(false);
  const [activeSymbolFilter, setActiveSymbolFilter] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const categories = [
    { value: 'all', label: t('news.allCategories') },
    { value: 'general', label: t('news.general') },
    { value: 'a_share', label: t('news.aShare') },
    { value: 'forex', label: t('news.forex') },
    { value: 'crypto', label: t('news.crypto') },
    { value: 'merger', label: t('news.merger') },
  ];

  // 获取自选股列表
  useEffect(() => {
    async function fetchWatchlist() {
      setWatchlistLoading(true);
      try {
        const res = await fetch('/api/watchlist');
        if (res.ok) {
          const data: WatchlistItem[] = await res.json();
          const symbols = data.map(item => item.symbol);
          const nameMap: Record<string, string> = {};
          data.forEach(item => {
            nameMap[item.symbol] = item.name || item.symbol;
          });
          setWatchlistSymbols(symbols);
          setWatchlistNames(nameMap);
          // 如果用户有自选股，默认切换到自选股模式
          if (symbols.length > 0) {
            setNewsMode('watchlist');
          }
        }
      } catch {
        console.warn('[news-view] 获取自选股失败');
      } finally {
        setWatchlistLoading(false);
      }
    }
    fetchWatchlist();
  }, []);

  // 获取自选股相关新闻
  const fetchWatchlistNews = useCallback(async () => {
    if (watchlistSymbols.length === 0) {
      setWatchlistNews([]);
      return;
    }

    setWatchlistNewsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('symbols', watchlistSymbols.join(','));
      params.set('category', category === 'all' ? 'all' : category);
      params.set('sources', sourceFilter);
      params.set('limit', '30');

      const res = await fetch(`/api/fusion/market/news?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const normalized: NewsArticle[] = data.map((item: Record<string, unknown>, i: number) => ({
            id: String(item.id || i),
            headline: item.headline || item.title || '',
            source: item.source || 'Unknown',
            sourceName: item.sourceName || 'unknown',
            url: item.url || '#',
            image: item.image || '',
            summary: item.summary || item.description || '',
            category: item.category || 'general',
            sentiment: item.sentiment || 'neutral',
            relatedStocks: Array.isArray(item.relatedStocks)
              ? item.relatedStocks as string[]
              : Array.isArray(item.related_stocks)
                ? item.related_stocks as string[]
                : [],
            timestamp: item.timestamp || item.datetime || item.publishedAt || new Date().toISOString(),
          }));
          setWatchlistNews(normalized);
        } else {
          setWatchlistNews([]);
        }
      } else {
        setWatchlistNews([]);
      }
    } catch {
      setWatchlistNews([]);
    } finally {
      setWatchlistNewsLoading(false);
    }
  }, [watchlistSymbols, category, sourceFilter]);

  // 当自选股列表加载完成或筛选条件变化时，获取自选股新闻
  useEffect(() => {
    if (!watchlistLoading && watchlistSymbols.length > 0) {
      fetchWatchlistNews();
    }
  }, [watchlistLoading, watchlistSymbols, fetchWatchlistNews]);

  // 获取全部新闻
  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('category', category === 'all' ? 'all' : category);
      params.set('sources', sourceFilter);
      if (symbolFilter.trim()) {
        params.set('symbol', symbolFilter.trim().toUpperCase());
      }

      const res = await fetch(`/api/fusion/market/news?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const normalized: NewsArticle[] = data.map((item: Record<string, unknown>, i: number) => ({
            id: String(item.id || i),
            headline: item.headline || item.title || '',
            source: item.source || 'Unknown',
            sourceName: item.sourceName || 'unknown',
            url: item.url || '#',
            image: item.image || '',
            summary: item.summary || item.description || '',
            category: item.category || 'general',
            sentiment: item.sentiment || 'neutral',
            relatedStocks: Array.isArray(item.relatedStocks)
              ? item.relatedStocks as string[]
              : Array.isArray(item.related_stocks)
                ? item.related_stocks as string[]
                : [],
            timestamp: item.timestamp || item.datetime || item.publishedAt || new Date().toISOString(),
          }));
          setNews(normalized);
          setNewsIsMock(false);
        } else {
          setNews(mockNews);
          setNewsIsMock(true);
        }
      } else {
        setNews(mockNews);
        setNewsIsMock(true);
      }
    } catch {
      setNews(mockNews);
      setNewsIsMock(true);
    } finally {
      setLoading(false);
    }
  }, [category, sourceFilter, symbolFilter]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // 自动刷新：每5分钟刷新新闻数据
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
    }

    autoRefreshRef.current = setInterval(() => {
      fetchNews();
      if (watchlistSymbols.length > 0) {
        fetchWatchlistNews();
      }
      setLastRefreshed(new Date());
    }, 5 * 60 * 1000); // 5分钟

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [fetchNews, fetchWatchlistNews, watchlistSymbols]);

  // 刷新全部新闻
  const handleRefresh = useCallback(() => {
    fetchNews();
    if (watchlistSymbols.length > 0) {
      fetchWatchlistNews();
    }
    setLastRefreshed(new Date());
    toast.success(language === 'zh' ? '新闻已刷新' : 'News refreshed');
  }, [fetchNews, fetchWatchlistNews, watchlistSymbols, language]);

  // 按分类和来源双重过滤（全部新闻）
  const filteredNews = (news || mockNews).filter((n) => {
    if (category !== 'all' && n.category !== category) return false;
    if (sourceFilter !== 'all' && n.sourceName !== sourceFilter) return false;
    return true;
  });

  // 按分类和来源双重过滤（自选股新闻）
  const filteredWatchlistNews = watchlistNews.filter((n) => {
    if (category !== 'all' && n.category !== category) return false;
    if (sourceFilter !== 'all' && n.sourceName !== sourceFilter) return false;
    // 按选中的自选股过滤
    if (activeSymbolFilter) {
      return (n.relatedStocks || []).some(s => s.toUpperCase() === activeSymbolFilter.toUpperCase());
    }
    return true;
  });

  // 获取新闻与自选股的相关股票列表（用于相关度标识）
  const getRelatedWatchlistStocks = useCallback((article: NewsArticle): string[] => {
    if (watchlistSymbols.length === 0) return [];
    const upperRelated = (article.relatedStocks || []).map(s => s.toUpperCase());
    const relatedByField = watchlistSymbols.filter(sym =>
      upperRelated.includes(sym.toUpperCase())
    );
    const relatedByText = watchlistSymbols.filter(sym =>
      article.headline.toUpperCase().includes(sym.toUpperCase()) ||
      article.summary.toUpperCase().includes(sym.toUpperCase())
    );
    // 合并去重
    const allRelated = [...new Set([...relatedByField, ...relatedByText])];
    return allRelated;
  }, [watchlistSymbols]);

  // 当前展示的新闻列表
  const displayNews = newsMode === 'watchlist' ? filteredWatchlistNews : filteredNews;
  const isLoading = newsMode === 'watchlist' ? watchlistNewsLoading : loading;

  // 计算每只自选股的新闻数量
  const watchlistNewsCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    for (const article of watchlistNews) {
      const related = getRelatedWatchlistStocks(article);
      for (const sym of related) {
        counts[sym] = (counts[sym] || 0) + 1;
      }
    }
    return counts;
  }, [watchlistNews, getRelatedWatchlistStocks]);

  if (loading && newsMode === 'all') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-48 bg-[#111118]" />
          <Skeleton className="h-9 w-24 bg-[#111118]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl bg-[#111118]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-medium text-zinc-400">
            {displayNews.length} {t('news.articles')}
          </h3>
          {newsIsMock && newsMode === 'all' && (
            <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[9px] border">DEMO DATA</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Symbol Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              placeholder={t('news.filterBySymbol')}
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="pl-8 bg-[#111118] border-[#1e1e2e] text-white text-sm h-9 w-36"
            />
          </div>
          {/* Category Select */}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36 bg-[#111118] border-[#1e1e2e] text-white text-sm h-9">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-[#1e1e2e]">
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Source Select */}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-36 bg-[#111118] border-[#1e1e2e] text-white text-sm h-9">
              <Globe className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-[#1e1e2e]">
              {NEWS_SOURCES.map((src) => (
                <SelectItem key={src.value} value={src.value} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                  {language === 'zh' ? src.labelZh : src.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px]">
            <Clock className="w-3 h-3" />
            <span>{t('news.autoRefreshIn').replace('{min}', String(Math.max(0, 5 - Math.floor((Date.now() - lastRefreshed.getTime()) / 60000))))}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-9 w-9 text-zinc-400 hover:text-white border border-[#1e1e2e]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mode Tabs: 自选股相关 / 全部新闻 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setNewsMode('watchlist'); setActiveSymbolFilter(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            newsMode === 'watchlist'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
              : 'bg-[#111118] text-zinc-400 border border-[#1e1e2e] hover:text-zinc-300 hover:border-[#2e2e3e]'
          }`}
        >
          <BookmarkCheck className="w-4 h-4" />
          {t('news.watchlistRelated')}
          {watchlistSymbols.length > 0 && (
            <Badge className={`text-[10px] px-1.5 py-0 border ${
              newsMode === 'watchlist'
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-600/40'
                : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
            }`}>
              {watchlistSymbols.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => { setNewsMode('all'); setActiveSymbolFilter(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            newsMode === 'all'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
              : 'bg-[#111118] text-zinc-400 border border-[#1e1e2e] hover:text-zinc-300 hover:border-[#2e2e3e]'
          }`}
        >
          <LayoutList className="w-4 h-4" />
          {t('news.allNews')}
        </button>
      </div>

      {/* Watchlist Mode - Empty State */}
      {newsMode === 'watchlist' && watchlistSymbols.length === 0 && !watchlistLoading && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-8 text-center">
            <BookmarkCheck className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-300 text-sm font-medium mb-1">{t('news.noWatchlistStocks')}</p>
            <p className="text-zinc-500 text-xs">{t('news.addStocksFirst')}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 bg-emerald-600/10 text-emerald-400 border-emerald-600/20 hover:bg-emerald-600/20 hover:text-emerald-300"
              onClick={() => onNavigate?.('watchlist')}
            >
              <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" />
              {language === 'zh' ? '前往自选股' : 'Go to Watchlist'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Watchlist Stock Pills (filterable) */}
      {newsMode === 'watchlist' && watchlistSymbols.length > 0 && !watchlistLoading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400 font-medium">{t('news.watchlistActivity')}</span>
            <Badge className="bg-amber-600/15 text-amber-400 border-amber-600/20 text-[10px] border px-1.5 py-0">
              {t('news.watchlistNewsCount').replace('{count}', String(filteredWatchlistNews.length))}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* All button */}
            <button
              onClick={() => setActiveSymbolFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                activeSymbolFilter === null
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                  : 'bg-[#111118] text-zinc-500 border border-[#1e1e2e] hover:text-zinc-300 hover:border-[#2e2e3e]'
              }`}
            >
              <Tag className="w-3 h-3" />
              {language === 'zh' ? '全部' : 'All'}
            </button>
            {watchlistSymbols.map(sym => {
              const counts = watchlistNewsCounts();
              const count = counts[sym] || 0;
              const isActive = activeSymbolFilter === sym;
              const companyName = watchlistNames[sym] && watchlistNames[sym] !== sym ? watchlistNames[sym] : '';
              return (
                <button
                  key={sym}
                  onClick={() => setActiveSymbolFilter(isActive ? null : sym)}
                  title={companyName || sym}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-amber-600/20 text-amber-300 border border-amber-600/30'
                      : count > 0
                        ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20'
                        : 'bg-[#111118] text-zinc-500 border border-[#1e1e2e] hover:text-zinc-400'
                  }`}
                >
                  <BookmarkCheck className="w-3 h-3" />
                  <span>{sym}</span>
                  {companyName && (
                    <span className={`text-[10px] font-normal max-w-[60px] truncate ${
                      isActive ? 'text-amber-400/70' : count > 0 ? 'text-emerald-400/60' : 'text-zinc-600'
                    }`}>
                      {companyName}
                    </span>
                  )}
                  {count > 0 && (
                    <span className={`text-[10px] px-1 py-0 rounded ${
                      isActive ? 'bg-amber-600/30 text-amber-200' : 'bg-emerald-600/20 text-emerald-300'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Watchlist Mode - No Results State (has stocks but no matching news) */}
      {newsMode === 'watchlist' && watchlistSymbols.length > 0 && !watchlistLoading && !watchlistNewsLoading && filteredWatchlistNews.length === 0 && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500/60 mx-auto mb-3" />
            <p className="text-zinc-300 text-sm font-medium mb-1">{t('news.noWatchlistNews')}</p>
            <p className="text-zinc-500 text-xs mb-3">{t('news.noWatchlistNewsHint')}</p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-emerald-600/10 text-emerald-400 border-emerald-600/20 hover:bg-emerald-600/20 hover:text-emerald-300 text-xs"
                onClick={() => onNavigate?.('settings')}
              >
                {language === 'zh' ? '配置 API Key' : 'Configure API Key'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white text-xs"
                onClick={() => setNewsMode('all')}
              >
                {language === 'zh' ? '查看全部新闻' : 'View All News'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Tabs (quick filter) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {NEWS_SOURCES.map((src) => (
          <button
            key={src.value}
            onClick={() => setSourceFilter(src.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              sourceFilter === src.value
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                : 'bg-[#111118] text-zinc-400 border border-[#1e1e2e] hover:text-zinc-300 hover:border-[#2e2e3e]'
            }`}
          >
            {language === 'zh' ? src.labelZh : src.label}
          </button>
        ))}
      </div>

      {/* News Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl bg-[#111118]" />
          ))}
        </div>
      ) : displayNews.length === 0 && !(newsMode === 'watchlist' && watchlistSymbols.length > 0 && filteredWatchlistNews.length === 0) ? (
        <div className="text-center py-16">
          <Newspaper className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">{t('news.noNews')}</p>
          <p className="text-zinc-500 text-xs mt-1">{t('news.tryChanging')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayNews.map((article) => {
            const sentimentCfg = getSentimentConfig(article.sentiment);
            const isWatchlistRelated = newsMode === 'watchlist' || (
              watchlistSymbols.length > 0 &&
              article.relatedStocks?.some(s => watchlistSymbols.includes(s.toUpperCase()))
            );
            const articleWatchlistStocks = getRelatedWatchlistStocks(article);
            return (
              <Card
                key={article.id}
                className="bg-[#111118] border-[#1e1e2e] rounded-xl hover:border-[#2e2e3e] transition-all duration-300 group cursor-pointer"
                onClick={() => { if (article.url && article.url !== '#') window.open(article.url, '_blank', 'noopener,noreferrer'); }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Category + Source + SourceName + Sentiment + Watchlist Badge */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={`${getCategoryColor(article.category)} border text-[10px] px-1.5 py-0`}>
                          {article.category.toUpperCase()}
                        </Badge>
                        <Badge className={`${getSourceColor(article.sourceName)} border text-[10px] px-1.5 py-0 flex items-center gap-0.5`}>
                          <Globe className="w-2.5 h-2.5" />
                          {article.sourceName === 'cls' ? 'CLS' :
                           article.sourceName === 'sina' ? 'Sina' :
                           article.sourceName === 'wallstreetcn' ? 'WSCN' :
                           article.sourceName.toUpperCase()}
                        </Badge>
                        <Badge className={`${sentimentCfg.color} text-[10px] px-1.5 py-0 flex items-center gap-0.5`}>
                          {sentimentCfg.icon}
                          {t(sentimentCfg.labelKey)}
                        </Badge>
                        {isWatchlistRelated && newsMode !== 'watchlist' && articleWatchlistStocks.length > 0 && (
                          <Badge className="bg-amber-600/15 text-amber-400 border-amber-600/20 border text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                            <BookmarkCheck className="w-2.5 h-2.5" />
                            {articleWatchlistStocks.slice(0, 2).join(', ')}
                            {articleWatchlistStocks.length > 2 && `+${articleWatchlistStocks.length - 2}`}
                          </Badge>
                        )
                        || isWatchlistRelated && newsMode !== 'watchlist' && (
                          <Badge className="bg-amber-600/15 text-amber-400 border-amber-600/20 border text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                            <BookmarkCheck className="w-2.5 h-2.5" />
                            {language === 'zh' ? '自选' : 'WL'}
                          </Badge>
                        )}
                      </div>

                      {/* Headline */}
                      <h4 className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {article.headline}
                      </h4>

                      {/* Summary */}
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-3">
                        {article.summary}
                      </p>

                      {/* Watchlist Stock Badges (prominent in watchlist mode) */}
                      {newsMode === 'watchlist' && articleWatchlistStocks.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-3">
                          {articleWatchlistStocks.map(stock => (
                            <span
                              key={stock}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-600/20 text-amber-300 border border-amber-600/30"
                            >
                              <BookmarkCheck className="w-3 h-3" />
                              {stock}
                              {watchlistNames[stock] && watchlistNames[stock] !== stock && (
                                <span className="text-amber-400/70 font-normal text-[10px]">
                                  {watchlistNames[stock]}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Related Stocks + Watchlist Relevance */}
                      <RelatedStocksSection
                        article={article}
                        watchlistSymbols={watchlistSymbols}
                        getRelatedWatchlistStocks={getRelatedWatchlistStocks}
                        onNavigate={onNavigate}
                        language={language}
                        t={t}
                      />

                      {/* Meta */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px]">{timeAgo(article.timestamp)}</span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px]">{article.source}</span>
                        </div>
                        {article.url && article.url !== '#' && (
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* In watchlist mode, show market headlines section below if there's room */}
      {newsMode === 'watchlist' && watchlistSymbols.length > 0 && !watchlistLoading && filteredWatchlistNews.length > 0 && filteredNews.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-medium">{t('news.marketHeadlines')}</span>
            <div className="flex-1 h-px bg-[#1e1e2e]" />
            <button
              onClick={() => setNewsMode('all')}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {language === 'zh' ? '查看全部 →' : 'View All →'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredNews.slice(0, 3).map((article) => {
              const sentimentCfg = getSentimentConfig(article.sentiment);
              return (
                <Card
                  key={`market-${article.id}`}
                  className="bg-[#0d0d14] border-[#1e1e2e] rounded-lg hover:border-[#2e2e3e] transition-all duration-200 group cursor-pointer"
                  onClick={() => { if (article.url && article.url !== '#') window.open(article.url, '_blank', 'noopener,noreferrer'); }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Badge className={`${getCategoryColor(article.category)} border text-[9px] px-1 py-0`}>
                        {article.category.toUpperCase()}
                      </Badge>
                      <Badge className={`${sentimentCfg.color} text-[9px] px-1 py-0 flex items-center gap-0.5`}>
                        {sentimentCfg.icon}
                      </Badge>
                    </div>
                    <h5 className="text-xs font-medium text-zinc-300 line-clamp-2 group-hover:text-emerald-400 transition-colors mb-1">
                      {article.headline}
                    </h5>
                    <div className="flex items-center gap-1 text-zinc-600">
                      <Clock className="w-2.5 h-2.5" />
                      <span className="text-[9px]">{timeAgo(article.timestamp)}</span>
                      <span className="text-[9px]">·</span>
                      <span className="text-[9px]">{article.source}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
