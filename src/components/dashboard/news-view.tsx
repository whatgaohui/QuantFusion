'use client';

import { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  image: string;
  summary: string;
  category: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  relatedStocks: string[];
  timestamp: string;
}

const mockNews: NewsArticle[] = [
  {
    id: '1',
    headline: 'S&P 500 Hits New All-Time High as Tech Sector Leads Rally',
    source: 'Reuters',
    url: '#',
    image: '',
    summary: 'The benchmark index climbed to a record close as strong earnings from major technology companies boosted investor sentiment across the board.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['AAPL', 'NVDA', 'MSFT'],
    timestamp: '2024-01-15T14:30:00Z',
  },
  {
    id: '2',
    headline: 'NVIDIA Surges on AI Chip Demand Forecast, Beats Quarterly Estimates',
    source: 'Bloomberg',
    url: '#',
    image: '',
    summary: 'The chipmaker raised its revenue guidance for the current quarter, citing unprecedented demand for its AI training and inference processors.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['NVDA', 'AMD'],
    timestamp: '2024-01-15T12:15:00Z',
  },
  {
    id: '3',
    headline: 'Federal Reserve Signals Potential Rate Cuts in Coming Months',
    source: 'CNBC',
    url: '#',
    image: '',
    summary: 'Fed officials indicated that inflation data has been moving in the right direction, opening the door for possible interest rate reductions.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: '2024-01-15T10:45:00Z',
  },
  {
    id: '4',
    headline: 'Bitcoin ETFs See Record Inflows on First Day of Trading',
    source: 'CoinDesk',
    url: '#',
    image: '',
    summary: 'Newly approved spot Bitcoin ETFs attracted over $4.6 billion in trading volume on their debut, marking the most successful ETF launch in history.',
    category: 'crypto',
    sentiment: 'bullish',
    relatedStocks: ['COIN'],
    timestamp: '2024-01-15T09:00:00Z',
  },
  {
    id: '5',
    headline: 'Dollar Weakens Against Major Currencies After Fed Comments',
    source: 'Financial Times',
    url: '#',
    image: '',
    summary: 'The greenback fell sharply against the euro and yen as traders priced in a higher probability of rate cuts in the first half of the year.',
    category: 'forex',
    sentiment: 'neutral',
    relatedStocks: [],
    timestamp: '2024-01-14T16:30:00Z',
  },
  {
    id: '6',
    headline: 'Pfizer Announces $43B Acquisition of Cancer Drug Maker Seagen',
    source: 'WSJ',
    url: '#',
    image: '',
    summary: 'The pharmaceutical giant will acquire Seagen to bolster its oncology pipeline, in one of the largest healthcare deals in recent years.',
    category: 'merger',
    sentiment: 'neutral',
    relatedStocks: ['PFE', 'SGEN'],
    timestamp: '2024-01-14T14:00:00Z',
  },
  {
    id: '7',
    headline: 'Oil Prices Steady as OPEC+ Maintains Production Cuts',
    source: 'MarketWatch',
    url: '#',
    image: '',
    summary: 'Crude oil futures traded in a narrow range after OPEC+ reaffirmed its commitment to supply restrictions through the end of Q1.',
    category: 'general',
    sentiment: 'neutral',
    relatedStocks: ['XOM', 'CVX'],
    timestamp: '2024-01-14T11:30:00Z',
  },
  {
    id: '8',
    headline: 'Ethereum Layer 2 Solutions See Surge in Transaction Volume',
    source: 'The Block',
    url: '#',
    image: '',
    summary: 'Arbitrum and Optimism processed a combined 5 million transactions in 24 hours, driven by increased DeFi activity and lower fees.',
    category: 'crypto',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: '2024-01-14T09:15:00Z',
  },
  {
    id: '9',
    headline: 'Tesla Faces Increased Competition in China EV Market',
    source: 'Nikkei Asia',
    url: '#',
    image: '',
    summary: 'Domestic EV makers are capturing growing market share, pressuring Tesla to cut prices and accelerate new model launches.',
    category: 'general',
    sentiment: 'bearish',
    relatedStocks: ['TSLA'],
    timestamp: '2024-01-13T16:00:00Z',
  },
];

function getCategoryColor(category: string): string {
  switch (category) {
    case 'crypto': return 'bg-purple-600/15 text-purple-400 border-purple-600/20';
    case 'forex': return 'bg-cyan-600/15 text-cyan-400 border-cyan-600/20';
    case 'merger': return 'bg-orange-600/15 text-orange-400 border-orange-600/20';
    default: return 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20';
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

export function MarketNewsView() {
  const { t } = useLanguage();
  const [news, setNews] = useState<NewsArticle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const categories = [
    { value: 'all', label: t('news.allCategories') },
    { value: 'general', label: t('news.general') },
    { value: 'forex', label: t('news.forex') },
    { value: 'crypto', label: t('news.crypto') },
    { value: 'merger', label: t('news.merger') },
  ];

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market/news?category=${category === 'all' ? 'general' : category}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setNews(data);
        } else {
          setNews(mockNews);
        }
      } else {
        setNews(mockNews);
      }
    } catch {
      setNews(mockNews);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const filteredNews = category === 'all'
    ? (news || mockNews)
    : (news || mockNews).filter((n) => n.category === category);

  if (loading) {
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
            {filteredNews.length} {t('news.articles')}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 bg-[#111118] border-[#1e1e2e] text-white text-sm h-9">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchNews}
            className="h-9 w-9 text-zinc-400 hover:text-white border border-[#1e1e2e]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* News Grid */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">{t('news.noNews')}</p>
          <p className="text-zinc-500 text-xs mt-1">{t('news.tryChanging')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNews.map((article) => {
            const sentimentCfg = getSentimentConfig(article.sentiment);
            return (
              <Card
                key={article.id}
                className="bg-[#111118] border-[#1e1e2e] rounded-xl hover:border-[#2e2e3e] transition-all duration-300 group cursor-pointer"
                onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Category + Source + Sentiment */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={`${getCategoryColor(article.category)} border text-[10px] px-1.5 py-0`}>
                          {article.category.toUpperCase()}
                        </Badge>
                        <Badge className={`${sentimentCfg.color} text-[10px] px-1.5 py-0 flex items-center gap-0.5`}>
                          {sentimentCfg.icon}
                          {t(sentimentCfg.labelKey)}
                        </Badge>
                        <span className="text-[10px] text-zinc-500">{article.source}</span>
                      </div>

                      {/* Headline */}
                      <h4 className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {article.headline}
                      </h4>

                      {/* Summary */}
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-3">
                        {article.summary}
                      </p>

                      {/* Related Stocks */}
                      {article.relatedStocks && article.relatedStocks.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="text-[10px] text-zinc-500">{t('news.analyzeStock')}:</span>
                          {article.relatedStocks.map((stock) => (
                            <button
                              key={stock}
                              onClick={(e) => { e.stopPropagation(); }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 transition-colors flex items-center gap-0.5"
                            >
                              {stock}
                              <Brain className="w-2.5 h-2.5" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px]">{timeAgo(article.timestamp)}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
