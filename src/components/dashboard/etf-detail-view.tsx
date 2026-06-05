'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Brain,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Globe,
  Layers,
  Newspaper,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';
import { CN_ETF_DB } from '@/lib/cn-etf-db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ETFDetailViewProps {
  symbol: string;
  name?: string;
  market?: 'A' | 'US' | 'HK';
  onBack?: () => void;
}

interface QuoteData {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
}

interface KlineDataPoint {
  time: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

interface ETFProfile {
  id?: string;
  symbol: string;
  name: string;
  market?: string;
  category?: string | null;
  expenseRatio?: number | null;
  trackingIndex?: string | null;
  aum?: number | null;
  dividendYield?: number | null;
  peRatio?: number | null;
  pbRatio?: number | null;
  beta?: number | null;
  sharpe1y?: number | null;
  volatility1y?: number | null;
  returns1y?: number | null;
  returns3y?: number | null;
  returns5y?: number | null;
  topHoldings?: Array<{ symbol: string; name: string; weight: number }> | null;
  sectorWeights?: Array<{ sector: string; weight: number }> | null;
  regionWeights?: Array<{ region: string; weight: number }> | null;
}

interface PositionInfo {
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  value: number;
  unrealizedPnl: number;
  weight: number;
  targetWeight: number;
}

interface IndicatorsData {
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  bollingerBands: { upper: number; middle: number; lower: number };
  kdj: { k: number; d: number; j: number };
  volumeRatio: number;
  source?: string;
  sar?: { sar: number; trend: 'up' | 'down'; signal: string };
  supertrend?: { value: number; trend: 'up' | 'down'; signal: string };
  cci?: { value: number; signal: string };
  williamsR?: { value: number; signal: string };
  obv?: { value: number; signal: string };
  mfi?: { value: number; signal: string };
  adx?: { adx: number; plusDi: number; minusDi: number; signal: string };
  atr?: { value: number };
  ichimoku?: { tenkan: number; kijun: number; senkouA: number; senkouB: number; chikou: number; signal: string };
}

interface AnalysisResult {
  symbol: string;
  recommendation: string;
  score: number;
  technicalSummary: string;
  fundamentalSummary: string;
  sentimentSummary: string;
  riskLevel: string;
  riskScore: number;
  bullCase?: string;
  bearCase?: string;
  report?: string;
  provider?: string;
  tokens?: number;
  cost?: number;
}

interface SentimentResult {
  symbol: string;
  name: string;
  score: number;
  label: string;
  factors: string[];
  riskLevel: string;
  shortTermOutlook: string;
  summary: string;
  newsCount: number;
  analyzedAt: string;
}

interface NewsArticle {
  id?: string;
  headline: string;
  source: string;
  time: string;
  sentiment?: string;
  url?: string;
  relatedStocks?: string[];
}

interface RebalanceSuggestion {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  currentWeight: number;
  targetWeight: number;
  weightDiff: number;
  estimatedAmount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | undefined | null, market?: string): string {
  if (value == null || isNaN(value)) return market === 'A' ? '¥0.00' : '$0.00';
  if (market === 'A') {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number | undefined | null, decimals = 2): string {
  if (value == null || isNaN(value)) return '0.00%';
  return `${value >= 0 ? '' : ''}${value.toFixed(decimals)}%`;
}

function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value == null || isNaN(value)) return '—';
  return value.toFixed(decimals);
}

function formatVolume(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—';
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function isChineseEtfSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(symbol);
}

function getSignalColor(score: number): string {
  if (score >= 50) return '#10b981';
  if (score >= 20) return '#f59e0b';
  return '#ef4444';
}

function getRecommendationColor(rec: string): string {
  switch (rec) {
    case 'BUY': return 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20';
    case 'SELL': return 'bg-red-600/15 text-red-400 border-red-600/20';
    default: return 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20';
  }
}

function getRecommendationIcon(rec: string) {
  switch (rec) {
    case 'BUY': return <ArrowUpRight className="w-3 h-3" />;
    case 'SELL': return <ArrowDownRight className="w-3 h-3" />;
    default: return <Minus className="w-3 h-3" />;
  }
}

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  broad_market: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20',
  sector: 'bg-purple-600/15 text-purple-400 border-purple-600/20',
  bond: 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20',
  commodity: 'bg-amber-600/15 text-amber-400 border-amber-600/20',
  international: 'bg-blue-600/15 text-blue-400 border-blue-600/20',
  thematic: 'bg-pink-600/15 text-pink-400 border-pink-600/20',
  leveraged: 'bg-red-600/15 text-red-400 border-red-600/20',
  inverse: 'bg-orange-600/15 text-orange-400 border-orange-600/20',
  cn_broad_market: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20',
  cn_cross_border: 'bg-blue-600/15 text-blue-400 border-blue-600/20',
};

const ALLOCATION_PIE_COLORS = ['#10b981', '#8b5cf6', '#eab308', '#f59e0b', '#3b82f6', '#ec4899', '#ef4444', '#22c55e', '#0FEDBE'];

// ─── Component ───────────────────────────────────────────────────────────────

export function ETFDetailView({ symbol, name, market, onBack }: ETFDetailViewProps) {
  const { t, language } = useLanguage();

  // ─── Derived ───────────────────────────────────────────────────────────
  const isCnSymbol = isChineseEtfSymbol(symbol);
  const effectiveMarket = market || (isCnSymbol ? 'A' : 'US');
  const resolvedName = name || (isCnSymbol ? (CN_ETF_DB.find(e => e.symbol === symbol)?.name || symbol) : symbol);

  // ─── State ─────────────────────────────────────────────────────────────
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [klineData, setKlineData] = useState<KlineDataPoint[]>([]);
  const [profile, setProfile] = useState<ETFProfile | null>(null);
  const [indicators, setIndicators] = useState<IndicatorsData | null>(null);
  const [position, setPosition] = useState<PositionInfo | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [rebalanceData, setRebalanceData] = useState<{ suggestions: RebalanceSuggestion[]; totalRebalanceAmount: number } | null>(null);

  const [timeRange, setTimeRange] = useState<'1W' | '1M' | '3M' | '6M' | '1Y'>('3M');
  const [dataSource, setDataSource] = useState<'real' | 'fallback' | 'loading' | 'unknown'>('loading');
  const [indicatorTab, setIndicatorTab] = useState<'basic' | 'extended'>('basic');
  const [analysisMode, setAnalysisMode] = useState<'quick' | 'standard' | 'full' | 'debate'>('standard');
  const [analyzing, setAnalyzing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingTargetWeight, setEditingTargetWeight] = useState(false);
  const [newTargetWeight, setNewTargetWeight] = useState('');

  const [quoteLoading, setQuoteLoading] = useState(true);
  const [klineLoading, setKlineLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [indicatorsLoading, setIndicatorsLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ─── Fetch Quote ───────────────────────────────────────────────────────
  const fetchQuote = useCallback(async () => {
    setQuoteLoading(true);
    try {
      const res = await fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        setQuote(data);
      } else {
        setQuote(null);
      }
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [symbol]);

  // ─── Fetch Kline ───────────────────────────────────────────────────────
  const fetchKline = useCallback(async (range: string) => {
    setKlineLoading(true);
    const countMap: Record<string, number> = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const count = countMap[range] || 90;
    try {
      const res = await fetch(`/api/fusion/market/kline?symbol=${encodeURIComponent(symbol)}&period=D&count=${count}`);
      if (res.ok) {
        const data = await res.json();
        if (data.c && data.c.length > 0) {
          const locale = language === 'zh' ? 'zh-CN' : 'en-US';
          const formatted: KlineDataPoint[] = data.c.map((c: number, i: number) => ({
            time: new Date(data.t[i] * 1000).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
            close: c,
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            volume: data.v[i],
          }));
          setKlineData(formatted);
          if (data.source === 'eastmoney' || data.source === 'finnhub') {
            setDataSource('real');
          } else if (data.source === 'fallback' || data.source === 'mock') {
            setDataSource('fallback');
          } else {
            setDataSource(data.source ? 'real' : 'unknown');
          }
        } else {
          setKlineData([]);
        }
      } else {
        setKlineData([]);
      }
    } catch {
      setKlineData([]);
    } finally {
      setKlineLoading(false);
    }
  }, [symbol, language]);

  // ─── Fetch Profile ─────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/etf/profile/${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        // Build basic profile from CN_ETF_DB if available
        if (isCnSymbol) {
          const cnEtf = CN_ETF_DB.find(e => e.symbol === symbol);
          if (cnEtf) {
            setProfile({
              symbol: cnEtf.symbol,
              name: cnEtf.name,
              market: 'A',
              category: cnEtf.category,
              expenseRatio: cnEtf.expenseRatio,
              trackingIndex: cnEtf.trackingIndex,
              aum: cnEtf.aum,
              dividendYield: cnEtf.dividendYield,
              peRatio: cnEtf.peRatio,
              pbRatio: cnEtf.pbRatio,
              beta: cnEtf.beta,
              sharpe1y: cnEtf.sharpe1y,
              volatility1y: cnEtf.volatility1y,
              returns1y: cnEtf.returns1y,
              returns3y: cnEtf.returns3y,
              returns5y: cnEtf.returns5y,
              topHoldings: cnEtf.topHoldings ? JSON.parse(cnEtf.topHoldings) : null,
              sectorWeights: cnEtf.sectorWeights ? JSON.parse(cnEtf.sectorWeights) : null,
              regionWeights: cnEtf.regionWeights ? JSON.parse(cnEtf.regionWeights) : null,
            });
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [symbol, isCnSymbol]);

  // ─── Fetch Indicators ──────────────────────────────────────────────────
  const fetchIndicators = useCallback(async () => {
    setIndicatorsLoading(true);
    try {
      const res = await fetch(`/api/fusion/market/indicators?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        setIndicators(data);
      } else {
        setIndicators(null);
      }
    } catch {
      setIndicators(null);
    } finally {
      setIndicatorsLoading(false);
    }
  }, [symbol]);

  // ─── Fetch Position ────────────────────────────────────────────────────
  const fetchPosition = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio/positions');
      if (res.ok) {
        const data = await res.json();
        const positions = data.positions || data;
        if (Array.isArray(positions)) {
          const found = positions.find((p: Record<string, unknown>) =>
            (p.symbol as string)?.toUpperCase() === symbol.toUpperCase()
          );
          if (found) {
            setPosition({
              id: String(found.id || ''),
              symbol: String(found.symbol || symbol),
              quantity: typeof found.quantity === 'number' ? found.quantity : 0,
              avgCost: typeof found.avgCost === 'number' ? found.avgCost : typeof found.buyPrice === 'number' ? found.buyPrice : 0,
              currentPrice: typeof found.currentPrice === 'number' ? found.currentPrice : 0,
              value: typeof found.value === 'number' ? found.value : 0,
              unrealizedPnl: typeof found.unrealizedPnl === 'number' ? found.unrealizedPnl : 0,
              weight: typeof found.weight === 'number' ? found.weight : 0,
              targetWeight: typeof found.targetWeight === 'number' ? found.targetWeight : 0,
            });
          } else {
            setPosition(null);
          }
        }
      }
    } catch {
      setPosition(null);
    }
  }, [symbol]);

  // ─── Fetch News ────────────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch(`/api/fusion/market/news?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        const articles = Array.isArray(data) ? data : (data.articles || data.news || []);
        setNews(articles.slice(0, 15));
      } else {
        setNews([]);
      }
    } catch {
      setNews([]);
    } finally {
      setNewsLoading(false);
    }
  }, [symbol]);

  // ─── Fetch Rebalance ───────────────────────────────────────────────────
  const fetchRebalance = useCallback(async () => {
    try {
      const res = await fetch('/api/etf/portfolio/rebalance');
      if (res.ok) {
        const data = await res.json();
        setRebalanceData(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  // ─── Compute Signal Score ──────────────────────────────────────────────
  const computeSignalScore = useCallback((): { score: number; signalType: 'BUY' | 'HOLD' | 'SELL' } => {
    if (!indicators) return { score: 50, signalType: 'HOLD' };
    let score = 50;
    if (indicators.rsi < 30) score += 20;
    else if (indicators.rsi < 40) score += 10;
    else if (indicators.rsi > 70) score -= 20;
    else if (indicators.rsi > 60) score -= 5;

    if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) score += 15;
    else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) score -= 15;

    const currentPrice = quote?.currentPrice || indicators.bollingerBands.middle || 0;
    if (currentPrice < indicators.bollingerBands.lower) score += 10;
    else if (currentPrice > indicators.bollingerBands.upper) score -= 10;

    if (indicators.kdj.k > indicators.kdj.d && indicators.kdj.j < 20) score += 15;
    else if (indicators.kdj.k < indicators.kdj.d && indicators.kdj.j > 80) score -= 15;

    score = Math.max(0, Math.min(100, score));
    const signalType = score >= 55 ? 'BUY' : score <= 45 ? 'SELL' : 'HOLD';
    return { score, signalType };
  }, [indicators, quote]);

  // ─── AI Analysis ───────────────────────────────────────────────────────
  const handleStartAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch('/api/fusion/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, mode: analysisMode }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        toast.success(t('detail.analysisComplete') || 'Analysis complete');
      } else {
        toast.error(t('detail.analysisFailed') || 'Analysis failed');
      }
    } catch {
      toast.error(t('detail.analysisFailed') || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [symbol, analysisMode, t]);

  // ─── AI Sentiment ──────────────────────────────────────────────────────
  const fetchSentiment = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/sentiment?symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(resolvedName)}`);
      if (res.ok) {
        const data = await res.json();
        setSentiment(data);
      }
    } catch {
      // Ignore
    }
  }, [symbol, resolvedName]);

  // ─── Update Target Weight ──────────────────────────────────────────────
  const handleUpdateTargetWeight = useCallback(async () => {
    if (!position || !newTargetWeight) return;
    try {
      const res = await fetch('/api/portfolio/positions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: position.id, targetWeight: parseFloat(newTargetWeight) }),
      });
      if (res.ok) {
        toast.success(t('etf.weightUpdated'));
        setEditingTargetWeight(false);
        fetchPosition();
        fetchRebalance();
      } else {
        toast.error(t('etf.weightUpdateFailed'));
      }
    } catch {
      toast.error(t('etf.weightUpdateFailed'));
    }
  }, [position, newTargetWeight, t, fetchPosition, fetchRebalance]);

  // ─── Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchQuote();
    fetchKline(timeRange);
    fetchProfile();
    fetchIndicators();
    fetchPosition();
  }, [symbol]);

  useEffect(() => {
    fetchKline(timeRange);
  }, [timeRange]);

  // ─── Computed ──────────────────────────────────────────────────────────
  const signalScore = computeSignalScore();
  const currentPrice = quote?.currentPrice || 0;
  const priceChange = quote?.change || 0;
  const priceChangePercent = quote?.changePercent || 0;
  const isPositive = priceChange >= 0;

  // ─── Rebalance suggestion for this symbol ──────────────────────────────
  const rebalanceSuggestion = rebalanceData?.suggestions?.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ─── Header Bar (sticky) ──────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-[#1e1e2e] -mx-4 md:-mx-6 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0 text-zinc-400 hover:text-white flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white truncate">{symbol}</h2>
                <span className="text-sm text-zinc-400 truncate max-w-[200px]">{resolvedName}</span>
                <Badge className={`text-[9px] px-1.5 py-0 border ${
                  effectiveMarket === 'A' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                  effectiveMarket === 'HK' ? 'bg-amber-600/15 text-amber-400 border-amber-600/20' :
                  'bg-blue-600/15 text-blue-400 border-blue-600/20'
                }`}>
                  {effectiveMarket === 'A' ? 'A-Share' : effectiveMarket === 'HK' ? 'HK' : 'US'}
                </Badge>
                <Badge className={`text-[9px] px-1.5 py-0 border ${
                  dataSource === 'real' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                  dataSource === 'fallback' ? 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20' :
                  dataSource === 'loading' ? 'bg-zinc-600/15 text-zinc-300 border-zinc-600/20' :
                  'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                }`}>
                  {dataSource === 'real' ? 'LIVE' : dataSource === 'fallback' ? 'SIMULATED' : dataSource === 'loading' ? 'LOADING...' : 'UNKNOWN'}
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                {quoteLoading ? (
                  <Skeleton className="h-7 w-24 bg-[#1e1e2e]" />
                ) : (
                  <>
                    <span className="text-2xl font-bold text-white">
                      {effectiveMarket === 'A' ? '¥' : '$'}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className={`flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span className="text-xs font-medium">
                        {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { fetchQuote(); fetchIndicators(); }} className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Price Chart Section ──────────────────────────────────────── */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-white">{t('detail.priceChart') || 'Price Chart'}</CardTitle>
            <div className="flex items-center gap-1 bg-[#0a0a0f] rounded-md p-0.5">
              {(['1W', '1M', '3M', '6M', '1Y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    timeRange === range ? 'bg-emerald-600/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {klineLoading ? (
            <Skeleton className="h-56 w-full bg-[#0a0a0f] rounded-lg" />
          ) : klineData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={klineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="time" stroke="#71717a" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} interval={Math.floor(klineData.length / 6)} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} domain={['auto', 'auto']} yAxisId="price" />
                  <YAxis stroke="#71717a" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1e1e2e' }} orientation="right" yAxisId="volume" tickFormatter={(v: number) => formatVolume(v)} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2e2e3e', borderRadius: '8px', fontSize: '11px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Bar dataKey="volume" fill="#1e1e2e" opacity={0.4} yAxisId="volume" />
                  <Line type="monotone" dataKey="close" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#10b981' }} yAxisId="price" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-zinc-500 text-sm">{t('scanner.noChartData')}</p>
            </div>
          )}
          {/* Price Stats */}
          {quote && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 pt-3 border-t border-[#1e1e2e]">
              <div>
                <span className="text-[10px] text-zinc-500">{t('scanner.open')}</span>
                <p className="text-xs font-medium text-zinc-300">{effectiveMarket === 'A' ? '¥' : '$'}{quote.open.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500">{t('scanner.high')}</span>
                <p className="text-xs font-medium text-zinc-300">{effectiveMarket === 'A' ? '¥' : '$'}{quote.high.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500">{t('scanner.low')}</span>
                <p className="text-xs font-medium text-zinc-300">{effectiveMarket === 'A' ? '¥' : '$'}{quote.low.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500">{t('scanner.prevClose')}</span>
                <p className="text-xs font-medium text-zinc-300">{effectiveMarket === 'A' ? '¥' : '$'}{quote.prevClose.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500">{t('scanner.volume')}</span>
                <p className="text-xs font-medium text-zinc-300">{formatVolume(quote.volume)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Tab Section ──────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-[#111118] border border-[#1e1e2e] w-full h-9 p-0.5 rounded-lg">
          <TabsTrigger value="overview" className="text-xs flex-1 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            {t('detail.tabOverview') || '概览'}
          </TabsTrigger>
          <TabsTrigger value="signals" className="text-xs flex-1 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            {t('detail.tabSignals') || '信号'}
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs flex-1 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            {t('detail.tabAI') || 'AI分析'}
          </TabsTrigger>
          <TabsTrigger value="news" className="text-xs flex-1 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            {t('detail.tabNews') || '资讯'}
          </TabsTrigger>
          {position && (
            <TabsTrigger value="rebalance" className="text-xs flex-1 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
              {t('detail.tabRebalance') || '调仓'}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─── Overview Tab ───────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {profileLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 rounded-lg bg-[#0a0a0f]" />)}
            </div>
          ) : profile ? (
            <>
              {/* Profile Info Grid */}
              <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <CardTitle className="text-sm font-semibold text-white">{t('detail.profileInfo') || 'ETF Profile'}</CardTitle>
                    {profile.category && (
                      <Badge className={`text-[9px] border ${CATEGORY_BADGE_STYLES[profile.category] || 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'}`}>
                        {t(`etf.cat_${profile.category}`) || profile.category}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                    {profile.trackingIndex && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('detail.trackingIndex') || 'Tracking Index'}</p>
                        <p className="text-sm font-medium text-white">{profile.trackingIndex}</p>
                      </div>
                    )}
                    {profile.expenseRatio != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('etf.expenseRatio')}</p>
                        <p className="text-sm font-medium text-white">{formatPercent(profile.expenseRatio, 3)}</p>
                      </div>
                    )}
                    {profile.dividendYield != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('etf.dividendYield')}</p>
                        <p className="text-sm font-medium text-white">{formatPercent(profile.dividendYield)}</p>
                      </div>
                    )}
                    {profile.aum != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('detail.aum') || 'AUM'}</p>
                        <p className="text-sm font-medium text-white">{profile.aum >= 1000 ? `${(profile.aum / 1000).toFixed(1)}B` : `${profile.aum}M`}</p>
                      </div>
                    )}
                    {profile.peRatio != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">PE Ratio</p>
                        <p className="text-sm font-medium text-white">{formatNumber(profile.peRatio)}</p>
                      </div>
                    )}
                    {profile.pbRatio != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">PB Ratio</p>
                        <p className="text-sm font-medium text-white">{formatNumber(profile.pbRatio)}</p>
                      </div>
                    )}
                    {profile.beta != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Beta</p>
                        <p className="text-sm font-medium text-white">{formatNumber(profile.beta)}</p>
                      </div>
                    )}
                    {profile.sharpe1y != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sharpe 1Y</p>
                        <p className="text-sm font-medium text-white">{formatNumber(profile.sharpe1y)}</p>
                      </div>
                    )}
                    {profile.volatility1y != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('detail.volatility1y') || 'Volatility 1Y'}</p>
                        <p className="text-sm font-medium text-white">{formatPercent(profile.volatility1y)}</p>
                      </div>
                    )}
                    {profile.returns1y != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">1Y Return</p>
                        <p className={`text-sm font-medium ${profile.returns1y >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPercent(profile.returns1y)}</p>
                      </div>
                    )}
                    {profile.returns3y != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">3Y Return</p>
                        <p className={`text-sm font-medium ${profile.returns3y >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPercent(profile.returns3y)}</p>
                      </div>
                    )}
                    {profile.returns5y != null && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">5Y Return</p>
                        <p className={`text-sm font-medium ${profile.returns5y >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPercent(profile.returns5y)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Position Info (if held) */}
              {position && (
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-400" />
                      <CardTitle className="text-sm font-semibold text-white">{t('detail.positionInfo') || 'Position Info'}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('detail.shares') || 'Shares'}</p>
                        <p className="text-sm font-medium text-white">{position.quantity}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('detail.avgCost') || 'Avg Cost'}</p>
                        <p className="text-sm font-medium text-white">{formatCurrency(position.avgCost, effectiveMarket)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('detail.currentValue') || 'Current Value'}</p>
                        <p className="text-sm font-medium text-white">{formatCurrency(position.value, effectiveMarket)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('detail.unrealizedPnl') || 'Unrealized P&L'}</p>
                        <p className={`text-sm font-medium ${position.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {position.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnl, effectiveMarket)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('etf.weight')}</p>
                        <p className="text-sm font-medium text-white">{formatPercent(position.weight)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('etf.targetWeight')}</p>
                        {editingTargetWeight ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              value={newTargetWeight}
                              onChange={e => setNewTargetWeight(e.target.value)}
                              className="h-6 w-16 text-xs bg-[#0a0a0f] border-[#1e1e2e] text-white"
                            />
                            <Button size="sm" className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleUpdateTargetWeight}>
                              OK
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium text-white">{formatPercent(position.targetWeight)}</p>
                            <button
                              onClick={() => { setEditingTargetWeight(true); setNewTargetWeight(String(position.targetWeight || '')); }}
                              className="text-zinc-500 hover:text-white"
                            >
                              <Zap className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Holdings */}
              {profile.topHoldings && profile.topHoldings.length > 0 && (
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <CardTitle className="text-sm font-semibold text-white">{t('detail.topHoldings') || 'Top Holdings'}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.topHoldings.slice(0, 10).map((holding, i) => (
                        <Badge key={i} className="bg-[#1e1e2e] text-zinc-300 border-[#2e2e3e] text-[10px]">
                          {holding.symbol} <span className="text-zinc-500 ml-1">{holding.weight}%</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sector/Region Allocation Mini Charts */}
              {(profile.sectorWeights || profile.regionWeights) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {profile.sectorWeights && profile.sectorWeights.length > 0 && (
                    <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <PieChartIcon className="w-4 h-4 text-emerald-400" />
                          <CardTitle className="text-sm font-semibold text-white">{t('etf.bySector')}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className="w-28 h-28 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={profile.sectorWeights.map((s, i) => ({ name: s.sector, value: s.weight, color: ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length] }))}
                                  cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2} dataKey="value" stroke="none"
                                >
                                  {profile.sectorWeights.map((_, i) => (
                                    <Cell key={i} fill={ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex-1 space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                            {profile.sectorWeights.slice(0, 6).map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length] }} />
                                  <span className="text-zinc-400 truncate max-w-[80px]">{item.sector}</span>
                                </div>
                                <span className="text-zinc-300 font-medium">{item.weight.toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {profile.regionWeights && profile.regionWeights.length > 0 && (
                    <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-emerald-400" />
                          <CardTitle className="text-sm font-semibold text-white">{t('etf.byRegion')}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className="w-28 h-28 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={profile.regionWeights.map((r, i) => ({ name: r.region, value: r.weight, color: ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length] }))}
                                  cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2} dataKey="value" stroke="none"
                                >
                                  {profile.regionWeights.map((_, i) => (
                                    <Cell key={i} fill={ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex-1 space-y-1">
                            {profile.regionWeights.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALLOCATION_PIE_COLORS[i % ALLOCATION_PIE_COLORS.length] }} />
                                  <span className="text-zinc-400">{item.region}</span>
                                </div>
                                <span className="text-zinc-300 font-medium">{item.weight.toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="py-12 text-center">
                <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">{t('detail.noProfileData') || 'No profile data available'}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Signals Tab ────────────────────────────────────────────── */}
        <TabsContent value="signals" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Signal Score Gauge */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-white">{t('scanner.signalScore')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {indicatorsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-zinc-400 animate-spin" /></div>
                ) : (
                  <>
                    <div className="flex flex-col items-center">
                      <div className="relative w-28 h-28">
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="50" fill="none" stroke="#1e1e2e" strokeWidth="8" />
                          <circle
                            cx="60" cy="60" r="50" fill="none"
                            stroke={getSignalColor(signalScore.score)}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${(signalScore.score / 100) * 314} 314`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold" style={{ color: getSignalColor(signalScore.score) }}>
                            {signalScore.score}
                          </span>
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('scanner.score')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <Badge className={`${getRecommendationColor(signalScore.signalType)} border text-xs flex items-center gap-1`}>
                        {getRecommendationIcon(signalScore.signalType)}
                        {signalScore.signalType === 'BUY' ? t('common.buy') : signalScore.signalType === 'SELL' ? t('common.sell') : t('common.hold')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-[10px]">
                      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /><span className="text-zinc-500">&lt;20</span></div>
                      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500" /><span className="text-zinc-500">20-49</span></div>
                      <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-zinc-500">≥50</span></div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Basic / Extended Indicators */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-white">{t('scanner.techIndicators')}</CardTitle>
                    <div className="flex items-center gap-1 bg-[#0a0a0f] rounded-md p-0.5">
                      <button onClick={() => setIndicatorTab('basic')} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${indicatorTab === 'basic' ? 'bg-emerald-600/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        RSI/MACD/KDJ
                      </button>
                      <button onClick={() => setIndicatorTab('extended')} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${indicatorTab === 'extended' ? 'bg-emerald-600/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {t('scanner.extendedIndicators')}
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {indicatorsLoading ? (
                    <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full bg-[#0a0a0f] rounded" />)}</div>
                  ) : indicators ? (
                    indicatorTab === 'basic' ? (
                      <>
                        {/* RSI */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.rsi14')}</span>
                            <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.rsi)}</span>
                          </div>
                          <Badge className={`text-[9px] px-1.5 py-0 border ${
                            indicators.rsi < 30 ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                            indicators.rsi > 70 ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                            'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                          }`}>
                            {indicators.rsi < 30 ? t('scanner.oversold') : indicators.rsi > 70 ? t('scanner.overbought') : t('scanner.neutral')}
                          </Badge>
                        </div>
                        <Separator className="bg-[#1e1e2e]" />
                        {/* MACD */}
                        <div className="space-y-1">
                          <span className="text-xs text-zinc-400">{t('scanner.macd')}</span>
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div><span className="text-zinc-500">MACD</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.macd.macd, 4)}</p></div>
                            <div><span className="text-zinc-500">{t('scanner.signal')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.macd.signal, 4)}</p></div>
                            <div><span className="text-zinc-500">{t('scanner.hist')}</span><p className={`font-medium ${indicators.macd.histogram >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatNumber(indicators.macd.histogram, 4)}</p></div>
                          </div>
                        </div>
                        <Separator className="bg-[#1e1e2e]" />
                        {/* Bollinger Bands */}
                        <div className="space-y-1">
                          <span className="text-xs text-zinc-400">{t('scanner.bollingerBands')}</span>
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div><span className="text-zinc-500">{t('scanner.upper')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.bollingerBands.upper)}</p></div>
                            <div><span className="text-zinc-500">{t('scanner.middle')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.bollingerBands.middle)}</p></div>
                            <div><span className="text-zinc-500">{t('scanner.lower')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.bollingerBands.lower)}</p></div>
                          </div>
                        </div>
                        <Separator className="bg-[#1e1e2e]" />
                        {/* KDJ */}
                        <div className="space-y-1">
                          <span className="text-xs text-zinc-400">KDJ</span>
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div><span className="text-zinc-500">K</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.kdj.k)}</p></div>
                            <div><span className="text-zinc-500">D</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.kdj.d)}</p></div>
                            <div><span className="text-zinc-500">J</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.kdj.j)}</p></div>
                          </div>
                        </div>
                        <Separator className="bg-[#1e1e2e]" />
                        {/* Volume Ratio */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">{t('scanner.volumeRatio')}</span>
                          <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.volumeRatio)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* SAR */}
                        {indicators.sar && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.sar')}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.sar.sar)}</span>
                              <Badge className={`text-[9px] px-1.5 py-0 border ${indicators.sar.trend === 'up' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' : 'bg-red-600/15 text-red-400 border-red-600/20'}`}>
                                {indicators.sar.trend === 'up' ? t('scanner.trendUp') : t('scanner.trendDown')}
                              </Badge>
                            </div>
                          </div>
                        )}
                        {/* Supertrend */}
                        {indicators.supertrend && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.supertrend')}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.supertrend.value)}</span>
                              <Badge className={`text-[9px] px-1.5 py-0 border ${indicators.supertrend.trend === 'up' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' : 'bg-red-600/15 text-red-400 border-red-600/20'}`}>
                                {indicators.supertrend.trend === 'up' ? t('scanner.trendUp') : t('scanner.trendDown')}
                              </Badge>
                            </div>
                          </div>
                        )}
                        {/* CCI */}
                        {indicators.cci && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.cci')}</span>
                            <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.cci.value)}</span>
                          </div>
                        )}
                        {/* Williams %R */}
                        {indicators.williamsR && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.williamsR')}</span>
                            <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.williamsR.value)}</span>
                          </div>
                        )}
                        {/* OBV */}
                        {indicators.obv && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.obv')}</span>
                            <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.obv.value)}</span>
                          </div>
                        )}
                        {/* MFI */}
                        {indicators.mfi && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.mfi')}</span>
                            <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.mfi.value)}</span>
                          </div>
                        )}
                        {/* ADX */}
                        {indicators.adx && (
                          <div className="space-y-1">
                            <span className="text-xs text-zinc-400">{t('scanner.adx')}</span>
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div><span className="text-zinc-500">ADX</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.adx.adx)}</p></div>
                              <div><span className="text-zinc-500">{t('scanner.plusDi')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.adx.plusDi)}</p></div>
                              <div><span className="text-zinc-500">{t('scanner.minusDi')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.adx.minusDi)}</p></div>
                            </div>
                          </div>
                        )}
                        {/* ATR */}
                        {indicators.atr && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">{t('scanner.atr')}</span>
                            <span className="text-xs font-medium text-zinc-300">{formatNumber(indicators.atr.value)}</span>
                          </div>
                        )}
                        {/* Ichimoku */}
                        {indicators.ichimoku && (
                          <div className="space-y-1">
                            <span className="text-xs text-zinc-400">{t('scanner.ichimoku')}</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                              <div><span className="text-zinc-500">{t('scanner.tenkan')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.ichimoku.tenkan)}</p></div>
                              <div><span className="text-zinc-500">{t('scanner.kijun')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.ichimoku.kijun)}</p></div>
                              <div><span className="text-zinc-500">{t('scanner.senkouA')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.ichimoku.senkouA)}</p></div>
                              <div><span className="text-zinc-500">{t('scanner.senkouB')}</span><p className="text-zinc-300 font-medium">{formatNumber(indicators.ichimoku.senkouB)}</p></div>
                            </div>
                          </div>
                        )}
                        {!indicators.sar && !indicators.supertrend && !indicators.cci && !indicators.williamsR && !indicators.obv && !indicators.mfi && !indicators.adx && !indicators.atr && !indicators.ichimoku && (
                          <p className="text-xs text-zinc-500 text-center py-4">{t('scanner.noData')}</p>
                        )}
                      </>
                    )
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-4">{t('scanner.noData')}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── AI Analysis Tab ─────────────────────────────────────────── */}
        <TabsContent value="ai" className="space-y-4">
          {/* Mode Selector + Start */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm font-semibold text-white">{t('ai.mode')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {(['quick', 'standard', 'full', 'debate'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAnalysisMode(mode)}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      analysisMode === mode
                        ? 'border-emerald-600/50 bg-emerald-600/10'
                        : 'border-[#1e1e2e] bg-[#0a0a0f] hover:border-zinc-600'
                    }`}
                  >
                    <p className={`text-xs font-medium ${analysisMode === mode ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      {t(`ai.mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{t(`ai.mode${mode.charAt(0).toUpperCase() + mode.slice(1)}Desc`)}</p>
                  </button>
                ))}
              </div>
              <Button
                onClick={handleStartAnalysis}
                disabled={analyzing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? (t('ai.analyzing')) : (t('ai.startAnalysis'))}
              </Button>
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {analysis && (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <CardTitle className="text-sm font-semibold text-white">{t('ai.recommendation')}</CardTitle>
                  </div>
                  <Badge className={`${getRecommendationColor(analysis.recommendation)} border text-xs flex items-center gap-1`}>
                    {getRecommendationIcon(analysis.recommendation)}
                    {analysis.recommendation}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Score */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">{t('ai.score')}</span>
                  <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${analysis.score}%`, backgroundColor: getSignalColor(analysis.score) }} />
                  </div>
                  <span className="text-sm font-bold" style={{ color: getSignalColor(analysis.score) }}>{analysis.score}/100</span>
                </div>

                <Separator className="bg-[#1e1e2e]" />

                {/* Summaries */}
                <div className="space-y-2">
                  {analysis.technicalSummary && (
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{t('ai.technicalSummary')}</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{analysis.technicalSummary}</p>
                    </div>
                  )}
                  {analysis.fundamentalSummary && (
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{t('ai.fundamentalSummary')}</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{analysis.fundamentalSummary}</p>
                    </div>
                  )}
                  {analysis.sentimentSummary && (
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{t('ai.sentimentSummary')}</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{analysis.sentimentSummary}</p>
                    </div>
                  )}
                  {analysis.riskLevel && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('ai.riskAssessment')}</span>
                      <Badge className={`text-[9px] border ${
                        analysis.riskLevel === 'LOW' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                        analysis.riskLevel === 'HIGH' ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                        'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                      }`}>
                        {analysis.riskLevel}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Bull/Bear (debate mode) */}
                {analysis.bullCase && analysis.bearCase && (
                  <>
                    <Separator className="bg-[#1e1e2e]" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-emerald-600/5 border border-emerald-600/10">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs font-medium text-emerald-400">{t('ai.bullCase')}</span>
                        </div>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">{analysis.bullCase}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-600/5 border border-red-600/10">
                        <div className="flex items-center gap-1 mb-1">
                          <TrendingDown className="w-3 h-3 text-red-400" />
                          <span className="text-xs font-medium text-red-400">{t('ai.bearCase')}</span>
                        </div>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">{analysis.bearCase}</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Detailed Report */}
                {analysis.report && (
                  <Collapsible open={reportOpen} onOpenChange={setReportOpen}>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 w-full">
                      <FileText className="w-3 h-3" />
                      {t('ai.detailedReport')}
                      {reportOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] max-h-72 overflow-y-auto custom-scrollbar">
                        <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{analysis.report}</div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* LLM Usage */}
                {analysis.provider && (
                  <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                    <span>{t('ai.provider')}: {analysis.provider}</span>
                    {analysis.tokens != null && <span>{t('ai.tokens')}: {analysis.tokens}</span>}
                    {analysis.cost != null && <span>{t('ai.cost')}: ${analysis.cost.toFixed(3)}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Sentiment */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold text-white">{t('scanner.aiSentiment')}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchSentiment} className="h-7 px-2 text-zinc-400 hover:text-white">
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sentiment ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge className={`text-[9px] border ${
                      sentiment.label === 'Bullish' || sentiment.label === 'Positive' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                      sentiment.label === 'Bearish' || sentiment.label === 'Negative' ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                      'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                    }`}>
                      {sentiment.label}
                    </Badge>
                    <span className="text-xs text-zinc-400">{t('scanner.riskLevel')}: {sentiment.riskLevel}</span>
                    <span className="text-xs text-zinc-400">{t('scanner.shortTermOutlook')}: {sentiment.shortTermOutlook}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{sentiment.summary}</p>
                  {sentiment.factors && sentiment.factors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sentiment.factors.slice(0, 5).map((factor, i) => (
                        <Badge key={i} className="bg-[#1e1e2e] text-zinc-400 border-[#2e2e3e] text-[10px]">{factor}</Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-600">{t('scanner.newsAnalyzed')}: {sentiment.newsCount} {t('scanner.articles')}</p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 text-center py-4">
                  {t('scanner.clickAnalyze')} — {symbol}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── News Tab ────────────────────────────────────────────────── */}
        <TabsContent value="news" className="space-y-4">
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold text-white">{t('detail.relatedNews') || 'Related News'}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchNews} className="h-7 px-2 text-zinc-400 hover:text-white">
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {newsLoading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full bg-[#0a0a0f] rounded" />)}</div>
              ) : news.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {news.map((article, i) => (
                    <div key={article.id || i} className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] hover:border-zinc-700 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-200 leading-relaxed line-clamp-2">{article.headline}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-500">{article.source}</span>
                            <span className="text-[10px] text-zinc-600">{article.time}</span>
                            {article.sentiment && (
                              <Badge className={`text-[8px] px-1 py-0 border ${
                                article.sentiment === 'Bullish' || article.sentiment === 'Positive' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                                article.sentiment === 'Bearish' || article.sentiment === 'Negative' ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                                'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                              }`}>
                                {article.sentiment}
                              </Badge>
                            )}
                            {article.relatedStocks && article.relatedStocks.length > 0 && (
                              <span className="text-[10px] text-amber-400/70">{article.relatedStocks.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        {article.url && (
                          <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white flex-shrink-0">
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Newspaper className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">{t('news.noNews')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Rebalance Tab ───────────────────────────────────────────── */}
        {position && (
          <TabsContent value="rebalance" className="space-y-4">
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-400" />
                    <CardTitle className="text-sm font-semibold text-white">{t('etf.rebalancing')}</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchRebalance} className="h-7 px-2 text-zinc-400 hover:text-white">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current vs Target Weight */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-400">{t('detail.weightComparison') || 'Current vs Target Weight'}</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-zinc-500">{t('etf.currentWeight')}</span>
                        <span className="text-zinc-300">{formatPercent(position.weight)}</span>
                      </div>
                      <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-400/60 rounded-full" style={{ width: `${Math.min(position.weight, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="text-zinc-500">{t('etf.targetWeight')}</span>
                        <span className="text-emerald-400">{formatPercent(position.targetWeight)}</span>
                      </div>
                      <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(position.targetWeight, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="bg-[#1e1e2e]" />

                {/* Rebalance Suggestion */}
                {rebalanceSuggestion ? (
                  <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`text-[9px] border ${
                        rebalanceSuggestion.action === 'buy' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                        rebalanceSuggestion.action === 'sell' ? 'bg-red-600/15 text-red-400 border-red-600/20' :
                        'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {rebalanceSuggestion.action === 'buy' ? t('etf.underweight') : rebalanceSuggestion.action === 'sell' ? t('etf.overweight') : t('etf.onTarget')}
                      </Badge>
                      <span className="text-xs text-zinc-300">
                        {rebalanceSuggestion.action === 'buy' ? t('etf.buy') : rebalanceSuggestion.action === 'sell' ? t('etf.sell') : t('common.hold')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500">{t('detail.weightDiff') || 'Weight Diff'}</span>
                        <p className={`font-medium ${rebalanceSuggestion.weightDiff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {rebalanceSuggestion.weightDiff > 0 ? '+' : ''}{formatPercent(rebalanceSuggestion.weightDiff)}
                        </p>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('etf.estimatedAmount')}</span>
                        <p className="font-medium text-zinc-300">{formatCurrency(Math.abs(rebalanceSuggestion.estimatedAmount), effectiveMarket)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-2">{t('etf.onTarget')}</p>
                )}

                <Separator className="bg-[#1e1e2e]" />

                {/* Edit Target Weight */}
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">{t('etf.editWeight')}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.5"
                      value={newTargetWeight}
                      onChange={e => setNewTargetWeight(e.target.value)}
                      placeholder={String(position.targetWeight || '')}
                      className="h-8 flex-1 bg-[#0a0a0f] border-[#1e1e2e] text-white text-sm"
                    />
                    <span className="text-xs text-zinc-500">%</span>
                    <Button
                      size="sm"
                      onClick={handleUpdateTargetWeight}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {t('etf.updateWeight')}
                    </Button>
                  </div>
                </div>

                {/* Total rebalance amount */}
                {rebalanceData && rebalanceData.totalRebalanceAmount > 0 && (
                  <div className="p-3 rounded-lg bg-amber-600/5 border border-amber-600/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-amber-400">{t('etf.estimatedAmount')}: {formatCurrency(rebalanceData.totalRebalanceAmount, effectiveMarket)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
