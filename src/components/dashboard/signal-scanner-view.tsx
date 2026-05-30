'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Radar,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  Brain,
  Sparkles,
  Globe,
  PlusCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import { AddPositionDialog } from '@/components/dashboard/add-position-dialog';
import { AShareFeatureTab } from '@/components/dashboard/ashare-feature-tab';

interface StockQuote {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  kdjK: number;
  kdjD: number;
  kdjJ: number;
  volumeRatio?: number;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  // 扩展指标
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

interface SignalResult {
  symbol: string;
  score: number;
  signalType: 'BUY' | 'HOLD' | 'SELL';
  rsi: number;
  macdSignal: string;
  bollingerSignal: string;
  kdjSignal: string;
  volumeRatio: number;
  price: number;
  macd?: { macd: number; signal: number; histogram: number };
  bollingerBands?: { upper: number; middle: number; lower: number };
  kdj?: { k: number; d: number; j: number };
}

interface SearchResult {
  symbol: string;
  description: string;
  type: string;
}

interface SectorData {
  name: string;
  change: number;
  volume?: string;
  topStocks?: string[];
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

const popularStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'AMZN', name: 'Amazon.com' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMD', name: 'AMD Inc.' },
];

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

// Sector name English → Chinese translation mapping
const sectorNameZhMap: Record<string, string> = {
  // US sectors
  'Technology': '科技',
  'Healthcare': '医疗保健',
  'Finance': '金融',
  'Financials': '金融',
  'Energy': '能源',
  'Consumer Discretionary': '可选消费',
  'Consumer Staples': '必选消费',
  'Industrials': '工业',
  'Materials': '原材料',
  'Basic Materials': '原材料',
  'Utilities': '公用事业',
  'Real Estate': '房地产',
  'Communication Services': '通信服务',
  'Telecommunications': '电信',
  'Semiconductor': '半导体',
  'Semiconductors': '半导体',
  'Internet': '互联网',
  'New Energy': '新能源',
  'Automotive': '汽车',
  'Banking': '银行',
  'Banks': '银行',
  'Insurance': '保险',
  'Securities': '证券',
  'Pharmaceutical': '医药',
  'Pharmaceuticals': '医药',
  'Food & Beverage': '食品饮料',
  'Electronics': '电子',
  'Software': '软件',
  'AI': '人工智能',
  'Artificial Intelligence': '人工智能',
  'Aerospace & Defense': '航天国防',
  'Biotechnology': '生物技术',
  'Retail': '零售',
  'Media': '媒体',
  'Mining': '矿业',
  'Chemicals': '化工',
  'Construction': '建筑',
  'Transportation': '交通运输',
  'Travel & Leisure': '旅游休闲',
  // HK sectors
  'Conglomerate': '综合企业',
  'Conglomerates': '综合企业',
  'Properties': '地产',
  'Property & Construction': '地产建筑',
  'Finance & Investment': '金融投资',
  'Information Technology': '信息技术',
  'Utilities & Telecom': '公用事业及电信',
  'Energy & Resources': '能源资源',
  'Consumer Goods': '消费品',
  'Industrial Goods': '工业品',
  'Services': '服务业',
  // A-share sectors
  '银行': '银行',
  '房地产': '房地产',
  '医药生物': '医药生物',
  '食品饮料': '食品饮料',
  '电子': '电子',
  '计算机': '计算机',
  '传媒': '传媒',
  '通信': '通信',
  '电力设备': '电力设备',
  '新能源汽车': '新能源汽车',
  '汽车': '汽车',
  '有色金属': '有色金属',
  '煤炭': '煤炭',
  '石油石化': '石油石化',
  '基础化工': '基础化工',
  '钢铁': '钢铁',
  '建筑材料': '建筑材料',
  '建筑装饰': '建筑装饰',
  '机械设备': '机械设备',
  '国防军工': '国防军工',
  '公用事业': '公用事业',
  '交通运输': '交通运输',
  '农林牧渔': '农林牧渔',
  '商贸零售': '商贸零售',
  '社会服务': '社会服务',
  '纺织服饰': '纺织服饰',
  '轻工制造': '轻工制造',
  '综合': '综合',
  '环保': '环保',
  '美容护理': '美容护理',
  '非银金融': '非银金融',
  '家用电器': '家用电器',
};

/** Translate a sector name to Chinese if the language is zh, otherwise return as-is */
function translateSectorName(name: string, language: string): string {
  if (language !== 'zh') return name;
  return sectorNameZhMap[name] || name;
}

function translateSignalType(signalType: string, t: (key: string) => string): string {
  switch (signalType) {
    case 'BUY': return t('common.buy');
    case 'SELL': return t('common.sell');
    case 'HOLD': return t('common.hold');
    default: return signalType;
  }
}

// Compute signal score from indicators
function computeSignal(indicators: TechnicalIndicators, price: number): SignalResult {
  let score = 50;
  let macdSignalStr = 'NEUTRAL';
  let bollingerSignalStr = 'NEUTRAL';
  let kdjSignalStr = 'NEUTRAL';

  // RSI signals
  if (indicators.rsi < 30) score += 20;
  else if (indicators.rsi < 40) score += 10;
  else if (indicators.rsi > 70) score -= 20;
  else if (indicators.rsi > 60) score -= 5;

  // MACD signals
  if (indicators.macdHist > 0 && indicators.macd > indicators.macdSignal) {
    score += 15;
    macdSignalStr = 'BULLISH';
  } else if (indicators.macdHist < 0 && indicators.macd < indicators.macdSignal) {
    score -= 15;
    macdSignalStr = 'BEARISH';
  }

  // Bollinger signals
  if (price < indicators.bollingerLower) {
    score += 10;
    bollingerSignalStr = 'BELOW_LOWER';
  } else if (price > indicators.bollingerUpper) {
    score -= 10;
    bollingerSignalStr = 'ABOVE_UPPER';
  } else if (price < indicators.bollingerMiddle) {
    bollingerSignalStr = 'BELOW_MIDDLE';
  } else {
    bollingerSignalStr = 'ABOVE_MIDDLE';
  }

  // KDJ signals
  if (indicators.kdjK > indicators.kdjD && indicators.kdjJ < 20) {
    score += 15;
    kdjSignalStr = 'GOLDEN_CROSS';
  } else if (indicators.kdjK < indicators.kdjD && indicators.kdjJ > 80) {
    score -= 15;
    kdjSignalStr = 'DEATH_CROSS';
  }

  score = Math.max(0, Math.min(100, score));
  const signalType = score >= 55 ? 'BUY' : score <= 45 ? 'SELL' : 'HOLD';

  return {
    symbol: '',
    score,
    signalType,
    rsi: indicators.rsi,
    macdSignal: macdSignalStr,
    bollingerSignal: bollingerSignalStr,
    kdjSignal: kdjSignalStr,
    volumeRatio: indicators.volumeRatio || 1,
    price,
    macd: { macd: indicators.macd, signal: indicators.macdSignal, histogram: indicators.macdHist },
    bollingerBands: { upper: indicators.bollingerUpper, middle: indicators.bollingerMiddle, lower: indicators.bollingerLower },
    kdj: { k: indicators.kdjK, d: indicators.kdjD, j: indicators.kdjJ },
  };
}

export function SignalScannerView() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [selectedName, setSelectedName] = useState('Apple Inc.');
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [signalResult, setSignalResult] = useState<SignalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanScores, setScanScores] = useState<Record<string, { score: number; signalType: string; price: number }>>({});
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [market, setMarket] = useState<'A' | 'HK' | 'US'>('US');
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const [indicatorTab, setIndicatorTab] = useState<'basic' | 'extended'>('basic');
  const [dataSource, setDataSource] = useState<'real' | 'fallback' | 'loading' | 'unknown'>('loading');
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchStockData = useCallback(async (symbol: string) => {
    setLoading(true);
    setDataSource('loading');
    try {
      // Fetch quote from fusion API
      const [quoteRes, candleRes, indicatorsRes] = await Promise.allSettled([
        fetch(`/api/fusion/market/quote?symbol=${symbol}`),
        fetch(`/api/market/candle?symbol=${symbol}&resolution=D&from=${Math.floor(Date.now() / 1000) - 90 * 86400}&to=${Math.floor(Date.now() / 1000)}`),
        fetch(`/api/fusion/market/indicators?symbol=${symbol}`),
      ]);

      if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
        const data = await quoteRes.value.json();
        setQuote(data);
      } else {
        setQuote(null);
      }

      if (candleRes.status === 'fulfilled' && candleRes.value.ok) {
        const data = await candleRes.value.json();
        if (data.c && data.c.length > 0) {
          const locale = language === 'zh' ? 'zh-CN' : 'en-US';
          const formatted: CandleData[] = data.c.map((c: number, i: number) => ({
            time: new Date(data.t[i] * 1000).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: c,
            volume: data.v[i],
          }));
          setCandleData(formatted);
        } else {
          setCandleData([]);
        }
      } else {
        setCandleData([]);
      }

      // Use fusion indicators API
      if (indicatorsRes.status === 'fulfilled' && indicatorsRes.value.ok) {
        const data = await indicatorsRes.value.json();
        // Track data source
        if (data.source === 'finnhub') {
          setDataSource('real');
        } else if (data.source === 'fallback' || data.source === 'mock') {
          setDataSource('fallback');
        } else {
          // If source field exists but is something else, still treat as real if it's not fallback
          setDataSource(data.source ? 'real' : 'unknown');
        }
        const techIndicators: TechnicalIndicators = {
          rsi: data.rsi || 50,
          macd: data.macd?.macd || 0,
          macdSignal: data.macd?.signal || 0,
          macdHist: data.macd?.histogram || 0,
          bollingerUpper: data.bollingerBands?.upper || 0,
          bollingerMiddle: data.bollingerBands?.middle || 0,
          bollingerLower: data.bollingerBands?.lower || 0,
          kdjK: data.kdj?.k || 50,
          kdjD: data.kdj?.d || 50,
          kdjJ: data.kdj?.j || 50,
          volumeRatio: data.volumeRatio || 1,
          ma5: data.ma?.ma5 || 0,
          ma10: data.ma?.ma10 || 0,
          ma20: data.ma?.ma20 || 0,
          // 扩展指标
          sar: data.sar || undefined,
          supertrend: data.supertrend || undefined,
          cci: data.cci || undefined,
          williamsR: data.williamsR || undefined,
          obv: data.obv || undefined,
          mfi: data.mfi || undefined,
          adx: data.adx || undefined,
          atr: data.atr || undefined,
          ichimoku: data.ichimoku || undefined,
        };
        setIndicators(techIndicators);

        // Compute signal from indicators
        const currentPrice = quote?.currentPrice || techIndicators.bollingerMiddle || 0;
        const signal = computeSignal(techIndicators, currentPrice);
        signal.symbol = symbol;
        setSignalResult(signal);
        setScanScores(prev => ({
          ...prev,
          [symbol]: { score: signal.score, signalType: signal.signalType, price: signal.price },
        }));
      } else {
        // Fallback: try the signals/scan API
        const scanRes = await fetch(`/api/signals/scan?symbol=${symbol}`);
        if (scanRes.ok) {
          setDataSource('fallback');
          const scanData = await scanRes.json();
          setSignalResult(scanData);
          setIndicators({
            rsi: scanData.rsi || 50,
            macd: scanData.macd?.macd || 0,
            macdSignal: scanData.macd?.signal || 0,
            macdHist: scanData.macd?.histogram || 0,
            bollingerUpper: scanData.bollingerBands?.upper || 0,
            bollingerMiddle: scanData.bollingerBands?.middle || 0,
            bollingerLower: scanData.bollingerBands?.lower || 0,
            kdjK: scanData.kdj?.k || 50,
            kdjD: scanData.kdj?.d || 50,
            kdjJ: scanData.kdj?.j || 50,
          });
          setScanScores(prev => ({
            ...prev,
            [symbol]: { score: scanData.score, signalType: scanData.signalType, price: scanData.price },
          }));
        } else {
          setDataSource('unknown');
        }
      }
    } catch {
      setCandleData([]);
      setIndicators(null);
      setDataSource('unknown');
    } finally {
      setLoading(false);
    }
  }, [language]);

  // Fetch sectors data
  const fetchSectors = useCallback(async () => {
    setSectorsLoading(true);
    try {
      const res = await fetch(`/api/fusion/market/sectors?market=${market}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSectors(data);
        } else if (data.sectors && Array.isArray(data.sectors)) {
          setSectors(data.sectors);
        }
      }
    } catch {
      // Keep existing sectors or empty
    } finally {
      setSectorsLoading(false);
    }
  }, [market]);

  useEffect(() => {
    if (selectedSymbol) {
      fetchStockData(selectedSymbol);
    }
  }, [selectedSymbol, fetchStockData]);

  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);

  // Quick scan popular stocks
  useEffect(() => {
    const quickScan = async () => {
      for (const stock of popularStocks) {
        try {
          const res = await fetch(`/api/fusion/market/indicators?symbol=${stock.symbol}`);
          if (res.ok) {
            const data = await res.json();
            const techInd: TechnicalIndicators = {
              rsi: data.rsi || 50,
              macd: data.macd?.macd || 0,
              macdSignal: data.macd?.signal || 0,
              macdHist: data.macd?.histogram || 0,
              bollingerUpper: data.bollingerBands?.upper || 0,
              bollingerMiddle: data.bollingerBands?.middle || 0,
              bollingerLower: data.bollingerBands?.lower || 0,
              kdjK: data.kdj?.k || 50,
              kdjD: data.kdj?.d || 50,
              kdjJ: data.kdj?.j || 50,
              volumeRatio: data.volumeRatio || 1,
            };
            const signal = computeSignal(techInd, techInd.bollingerMiddle || 100);
            setScanScores(prev => ({
              ...prev,
              [stock.symbol]: { score: signal.score, signalType: signal.signalType, price: signal.price },
            }));
          }
        } catch {
          // Try fallback
          try {
            const res = await fetch(`/api/signals/scan?symbol=${stock.symbol}`);
            if (res.ok) {
              const data = await res.json();
              setScanScores(prev => ({
                ...prev,
                [stock.symbol]: { score: data.score, signalType: data.signalType, price: data.price },
              }));
            }
          } catch {
            // Skip
          }
        }
      }
    };
    quickScan();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${query}`);
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
  };

  const handleSelectStock = (symbol: string, name: string) => {
    setSelectedSymbol(symbol);
    setSelectedName(name);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRescan = async () => {
    if (!selectedSymbol) return;
    setScanning(true);
    setDataSource('loading');
    try {
      // Fetch fresh indicators and recompute
      const res = await fetch(`/api/fusion/market/indicators?symbol=${selectedSymbol}`);
      if (res.ok) {
        const data = await res.json();
        // Track data source
        if (data.source === 'finnhub') {
          setDataSource('real');
        } else if (data.source === 'fallback' || data.source === 'mock') {
          setDataSource('fallback');
        } else {
          setDataSource(data.source ? 'real' : 'unknown');
        }
        const techInd: TechnicalIndicators = {
          rsi: data.rsi || 50,
          macd: data.macd?.macd || 0,
          macdSignal: data.macd?.signal || 0,
          macdHist: data.macd?.histogram || 0,
          bollingerUpper: data.bollingerBands?.upper || 0,
          bollingerMiddle: data.bollingerBands?.middle || 0,
          bollingerLower: data.bollingerBands?.lower || 0,
          kdjK: data.kdj?.k || 50,
          kdjD: data.kdj?.d || 50,
          kdjJ: data.kdj?.j || 50,
          volumeRatio: data.volumeRatio || 1,
        };
        setIndicators(techInd);
        const currentPrice = quote?.currentPrice || techInd.bollingerMiddle || 0;
        const signal = computeSignal(techInd, currentPrice);
        signal.symbol = selectedSymbol;
        setSignalResult(signal);
        setScanScores(prev => ({
          ...prev,
          [selectedSymbol]: { score: signal.score, signalType: signal.signalType, price: signal.price },
        }));
      }
    } catch {
      // Handle error
      setDataSource('unknown');
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyzeSentiment = async () => {
    if (!selectedSymbol) return;
    setAnalyzing(true);
    setSentiment(null);
    try {
      const res = await fetch(`/api/ai/sentiment?symbol=${selectedSymbol}&name=${encodeURIComponent(selectedName)}`);
      if (res.ok) {
        const data = await res.json();
        setSentiment(data);
      }
    } catch {
      // Handle error
    } finally {
      setAnalyzing(false);
    }
  };

  const currentPrice = quote?.currentPrice || signalResult?.price || 0;
  const priceChange = quote?.change || 0;
  const priceChangePercent = quote?.changePercent || 0;

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder={t('scanner.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-[#111118] border-[#1e1e2e] text-white placeholder:text-zinc-500 focus:border-emerald-600/50"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
            </div>
          )}
          {searchQuery && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111118] border border-[#1e1e2e] rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
              {searchResults.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock.symbol, stock.description)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a2e] transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-white">{stock.symbol}</span>
                    <span className="text-xs text-zinc-500 ml-2">{stock.description}</span>
                  </div>
                  <span className="text-xs text-zinc-600">{stock.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2e] rounded-lg p-1">
          {(['US', 'HK', 'A'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                market === m
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t(`scanner.market${m}`)}
            </button>
          ))}
        </div>
        <Button
          onClick={handleRescan}
          disabled={scanning || !selectedSymbol}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Radar className="w-4 h-4" />
          {scanning ? t('scanner.scanning') : t('scanner.rescan')}
        </Button>
        <Button
          onClick={() => setAddPositionOpen(true)}
          disabled={!selectedSymbol || !currentPrice}
          variant="outline"
          className="border-emerald-600/30 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          {t('pos.addPosition')}
        </Button>
      </div>

      {/* Add Position Dialog */}
      <AddPositionDialog
        open={addPositionOpen}
        onOpenChange={setAddPositionOpen}
        symbol={selectedSymbol}
        price={currentPrice}
      />

      {/* Sectors Overview */}
      {(sectors.length > 0 || sectorsLoading) && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm font-semibold text-white">
                  {t('scanner.sectorOverview')} — {market}
                </CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchSectors} className="h-6 px-2 text-zinc-400 hover:text-white">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sectorsLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-16 w-28 flex-shrink-0 bg-[#0a0a0f] rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 custom-scrollbar">
                {sectors.map((sector, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] min-w-[120px]"
                  >
                    <p className="text-xs text-zinc-400 truncate">{translateSectorName(sector.name, language)}</p>
                    <p className={`text-sm font-bold mt-1 ${sector.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* A股特色数据 Tab - 仅在A股市场时显示 */}
      {market === 'A' && <AShareFeatureTab />}

      {/* Selected Stock Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Price + Chart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Price Header */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-white">{selectedSymbol}</h3>
                    <span className="text-sm text-zinc-400">{selectedName}</span>
                    <Badge className={`text-[9px] px-1.5 py-0 ${
                      dataSource === 'real' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                      dataSource === 'fallback' ? 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20' :
                      dataSource === 'loading' ? 'bg-zinc-600/15 text-zinc-300 border-zinc-600/20' :
                      'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                    } border`}>
                      {dataSource === 'real' ? 'LIVE' : dataSource === 'fallback' ? 'SIMULATED' : dataSource === 'loading' ? 'LOADING...' : 'UNKNOWN'}
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-white">
                      ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className={`flex items-center gap-1 ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="text-sm font-medium">
                        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
                {signalResult && (
                  <div className="flex items-center gap-2">
                    <Badge className={`${getRecommendationColor(signalResult.signalType)} border text-xs flex items-center gap-1`}>
                      {getRecommendationIcon(signalResult.signalType)}
                      {translateSignalType(signalResult.signalType, t)}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Price stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#1e1e2e]">
                <div>
                  <span className="text-xs text-zinc-500">{t('scanner.open')}</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.open || currentPrice).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">{t('scanner.high')}</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.high || currentPrice).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">{t('scanner.low')}</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.low || currentPrice).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">{t('scanner.prevClose')}</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.prevClose || currentPrice).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Chart */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white">{t('scanner.priceChart')}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchStockData(selectedSymbol)}
                  className="h-7 px-2 text-zinc-400 hover:text-white"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full bg-[#0a0a0f] rounded-lg" />
              ) : candleData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={candleData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                      <XAxis
                        dataKey="time"
                        stroke="#71717a"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#1e1e2e' }}
                        interval={14}
                      />
                      <YAxis
                        stroke="#71717a"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#1e1e2e' }}
                        domain={['auto', 'auto']}
                        yAxisId="price"
                      />
                      <YAxis
                        stroke="#71717a"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#1e1e2e' }}
                        orientation="right"
                        yAxisId="volume"
                        tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1a1a2e',
                          border: '1px solid #2e2e3e',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        itemStyle={{ color: '#e4e4e7' }}
                      />
                      <Bar
                        dataKey="volume"
                        fill="#1e1e2e"
                        opacity={0.3}
                        yAxisId="volume"
                      />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#10b981' }}
                        yAxisId="price"
                      />
                      <Line
                        type="monotone"
                        dataKey="high"
                        stroke="#22c55e"
                        strokeWidth={0.5}
                        dot={false}
                        strokeDasharray="3 3"
                        yAxisId="price"
                      />
                      <Line
                        type="monotone"
                        dataKey="low"
                        stroke="#ef4444"
                        strokeWidth={0.5}
                        dot={false}
                        strokeDasharray="3 3"
                        yAxisId="price"
                      />
                      {indicators && indicators.bollingerMiddle > 0 && (
                        <ReferenceLine
                          y={indicators.bollingerMiddle}
                          stroke="#f59e0b"
                          strokeDasharray="5 5"
                          strokeWidth={1}
                          yAxisId="price"
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-zinc-500 text-sm">{t('scanner.noChartData')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Signal & Indicators */}
        <div className="space-y-4">
          {/* Signal Score */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white">{t('scanner.signalScore')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1e1e2e" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={getSignalColor(signalResult?.score || 0)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${((signalResult?.score || 0) / 100) * 314} 314`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold" style={{ color: getSignalColor(signalResult?.score || 0) }}>
                      {signalResult?.score ?? '—'}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('scanner.score')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-zinc-500">&lt;20</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-zinc-500">20-49</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-zinc-500">{t('scanner.buySignal')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Indicators */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white">{t('scanner.techIndicators')}</CardTitle>
                <div className="flex items-center gap-1 bg-[#0a0a0f] rounded-md p-0.5">
                  <button
                    onClick={() => setIndicatorTab('basic')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      indicatorTab === 'basic'
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    RSI/MACD/KDJ
                  </button>
                  <button
                    onClick={() => setIndicatorTab('extended')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      indicatorTab === 'extended'
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t('scanner.extendedIndicators')}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full bg-[#0a0a0f] rounded" />
                  ))}
                </div>
              ) : indicatorTab === 'extended' ? (
                <>
                  {/* SAR 抛物线指标 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.sar')}</span>
                      <span className="text-xs font-medium text-zinc-300">
                        {(indicators?.sar?.sar || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        indicators?.sar?.trend === 'up'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : 'bg-red-600/15 text-red-400 border-red-600/20'
                      }`}>
                        {indicators?.sar?.trend === 'up' ? t('scanner.trendUp') : t('scanner.trendDown')}
                      </Badge>
                      {indicators?.sar?.signal && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${
                          indicators.sar.signal === 'BULLISH'
                            ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                            : indicators.sar.signal === 'BEARISH'
                            ? 'bg-red-600/15 text-red-400 border-red-600/20'
                            : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                        }`}>
                          {indicators.sar.signal}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* Supertrend 超级趋势 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.supertrend')}</span>
                      <span className="text-xs font-medium text-zinc-300">
                        {(indicators?.supertrend?.value || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        indicators?.supertrend?.trend === 'up'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : 'bg-red-600/15 text-red-400 border-red-600/20'
                      }`}>
                        {indicators?.supertrend?.trend === 'up' ? t('scanner.trendUp') : t('scanner.trendDown')}
                      </Badge>
                      {indicators?.supertrend?.signal && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${
                          indicators.supertrend.signal === 'BULLISH'
                            ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                            : indicators.supertrend.signal === 'BEARISH'
                            ? 'bg-red-600/15 text-red-400 border-red-600/20'
                            : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                        }`}>
                          {indicators.supertrend.signal}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* CCI 商品通道指数 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.cci')}</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.cci?.value || 0) > 100 ? 'text-red-400'
                        : (indicators?.cci?.value || 0) < -100 ? 'text-emerald-400'
                        : 'text-zinc-300'
                      }`}>
                        {(indicators?.cci?.value || 0).toFixed(1)}
                      </span>
                    </div>
                    {indicators?.cci?.signal && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        indicators.cci.signal === 'OVERBOUGHT'
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : indicators.cci.signal === 'OVERSOLD'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : indicators.cci.signal === 'BULLISH'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : 'bg-red-600/15 text-red-400 border-red-600/20'
                      }`}>
                        {t(`scanner.${indicators.cci.signal.toLowerCase()}`) !== `scanner.${indicators.cci.signal.toLowerCase()}` 
                          ? t(`scanner.${indicators.cci.signal.toLowerCase()}`) 
                          : indicators.cci.signal}
                      </Badge>
                    )}
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* Williams %R */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.williamsR')}</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.williamsR?.value || -50) > -20 ? 'text-red-400'
                        : (indicators?.williamsR?.value || -50) < -80 ? 'text-emerald-400'
                        : 'text-zinc-300'
                      }`}>
                        {(indicators?.williamsR?.value || -50).toFixed(1)}
                      </span>
                    </div>
                    {indicators?.williamsR?.signal && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        indicators.williamsR.signal === 'OVERBOUGHT'
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : indicators.williamsR.signal === 'OVERSOLD'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {indicators.williamsR.signal}
                      </Badge>
                    )}
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* OBV 能量潮 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.obv')}</span>
                      <span className="text-xs font-medium text-zinc-300">
                        {indicators?.obv?.value ? (indicators.obv.value / 1000000).toFixed(2) + 'M' : '—'}
                      </span>
                    </div>
                    {indicators?.obv?.signal && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        indicators.obv.signal.includes('BULLISH')
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : indicators.obv.signal.includes('BEARISH')
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {indicators.obv.signal.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* MFI 资金流量 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.mfi')}</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.mfi?.value || 50) > 80 ? 'text-red-400'
                        : (indicators?.mfi?.value || 50) < 20 ? 'text-emerald-400'
                        : 'text-zinc-300'
                      }`}>
                        {(indicators?.mfi?.value || 50).toFixed(1)}
                      </span>
                    </div>
                    <Progress value={indicators?.mfi?.value || 50} className="h-1.5 bg-[#1e1e2e]" />
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>{t('scanner.oversold')} (&lt;20)</span>
                      <span>{t('scanner.overbought')} (&gt;80)</span>
                    </div>
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* ADX 平均趋向 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.adx')}</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.adx?.adx || 0) > 25 ? 'text-emerald-400' : 'text-zinc-400'
                      }`}>
                        {(indicators?.adx?.adx || 0).toFixed(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500">{t('scanner.plusDi')}: </span>
                        <span className="text-emerald-400">{(indicators?.adx?.plusDi || 0).toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('scanner.minusDi')}: </span>
                        <span className="text-red-400">{(indicators?.adx?.minusDi || 0).toFixed(1)}</span>
                      </div>
                    </div>
                    {indicators?.adx?.signal && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        indicators.adx.signal === 'STRONG_TREND'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : indicators.adx.signal === 'TRENDING'
                          ? 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                          : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {indicators.adx.signal === 'STRONG_TREND' ? t('scanner.strongTrend')
                          : indicators.adx.signal === 'TRENDING' ? t('scanner.trending')
                          : t('scanner.noTrend')}
                      </Badge>
                    )}
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* ATR 真实波幅 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.atr')}</span>
                      <span className="text-xs font-medium text-zinc-300">
                        {(indicators?.atr?.value || 0).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* Ichimoku 一目均衡 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.ichimoku')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500">{t('scanner.tenkan')}: </span>
                        <span className="text-emerald-400">{(indicators?.ichimoku?.tenkan || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('scanner.kijun')}: </span>
                        <span className="text-yellow-400">{(indicators?.ichimoku?.kijun || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('scanner.senkouA')}: </span>
                        <span className="text-cyan-400">{(indicators?.ichimoku?.senkouA || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('scanner.senkouB')}: </span>
                        <span className="text-orange-400">{(indicators?.ichimoku?.senkouB || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    {indicators?.ichimoku?.signal && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        indicators.ichimoku.signal.includes('BULLISH')
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : indicators.ichimoku.signal.includes('BEARISH')
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                      }`}>
                        {indicators.ichimoku.signal === 'STRONG_BULLISH' ? t('scanner.strongBullish')
                          : indicators.ichimoku.signal === 'STRONG_BEARISH' ? t('scanner.strongBearish')
                          : indicators.ichimoku.signal === 'BULLISH' ? t('scanner.trendUp')
                          : indicators.ichimoku.signal === 'BEARISH' ? t('scanner.trendDown')
                          : indicators.ichimoku.signal === 'RANGE_BOUND' ? t('scanner.rangeBound')
                          : indicators.ichimoku.signal}
                      </Badge>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* RSI */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.rsi14')}</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.rsi || 50) > 70 ? 'text-red-400' : (indicators?.rsi || 50) < 30 ? 'text-emerald-400' : 'text-zinc-300'
                      }`}>
                        {(indicators?.rsi || 50).toFixed(1)}
                      </span>
                    </div>
                    <Progress value={indicators?.rsi || 50} className="h-1.5 bg-[#1e1e2e]" />
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>{t('scanner.oversold')}</span>
                      <span>{t('scanner.neutral')}</span>
                      <span>{t('scanner.overbought')}</span>
                    </div>
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* MACD */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.macd')}</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.macdHist || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {(indicators?.macd || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500">{t('scanner.signal')}: </span>
                        <span className="text-zinc-300">{(indicators?.macdSignal || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('scanner.hist')}: </span>
                        <span className={(indicators?.macdHist || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {(indicators?.macdHist || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {signalResult?.macdSignal && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        signalResult.macdSignal === 'GOLDEN_CROSS' || signalResult.macdSignal === 'BULLISH'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : signalResult.macdSignal === 'DEATH_CROSS' || signalResult.macdSignal === 'BEARISH'
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {signalResult.macdSignal.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* Bollinger */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.bollingerBands')}</span>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{t('scanner.upper')}</span>
                        <span className="text-red-400">${(indicators?.bollingerUpper || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{t('scanner.middle')}</span>
                        <span className="text-yellow-400">${(indicators?.bollingerMiddle || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{t('scanner.lower')}</span>
                        <span className="text-emerald-400">${(indicators?.bollingerLower || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    {signalResult?.bollingerSignal && (
                      <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px] px-1.5 py-0">
                        {signalResult.bollingerSignal.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* KDJ */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">KDJ</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="text-center">
                        <p className="text-zinc-500">K</p>
                        <p className="text-emerald-400 font-medium">{(indicators?.kdjK || 50).toFixed(1)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-500">D</p>
                        <p className="text-yellow-400 font-medium">{(indicators?.kdjD || 50).toFixed(1)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-zinc-500">J</p>
                        <p className="text-zinc-300 font-medium">{(indicators?.kdjJ || 50).toFixed(1)}</p>
                      </div>
                    </div>
                    {signalResult?.kdjSignal && (
                      <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px] px-1.5 py-0">
                        {signalResult.kdjSignal.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* Volume */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">{t('scanner.volumeRatio')}</span>
                      <span className="text-xs font-medium text-zinc-300">
                        {(signalResult?.volumeRatio || indicators?.volumeRatio || 1).toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Sentiment Analysis */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('scanner.aiSentiment')}</CardTitle>
              <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[10px]">
                <Sparkles className="w-3 h-3 mr-1" />{t('scanner.aiPowered')}
              </Badge>
            </div>
            <Button
              onClick={handleAnalyzeSentiment}
              disabled={analyzing || !selectedSymbol}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? t('scanner.analyzing') : t('scanner.analyze')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analyzing && !sentiment ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-purple-600 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-purple-400 text-sm font-medium">{t('scanner.aiAnalyzing')} {selectedSymbol}...</p>
              <p className="text-zinc-500 text-xs mt-1">{t('scanner.fetchingNews')}</p>
            </div>
          ) : sentiment ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {/* Sentiment Score Gauge */}
                <div className="flex flex-col items-center">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#1e1e2e" strokeWidth="8" />
                      <circle
                        cx="60" cy="60" r="50" fill="none"
                        stroke={sentiment.score >= 30 ? '#10b981' : sentiment.score >= 0 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${((sentiment.score + 100) / 200) * 314} 314`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: sentiment.score >= 30 ? '#10b981' : sentiment.score >= 0 ? '#f59e0b' : '#ef4444' }}>
                        {sentiment.score > 0 ? '+' : ''}{sentiment.score}
                      </span>
                    </div>
                  </div>
                  <Badge className={`mt-1 text-[10px] px-1.5 py-0 ${
                    sentiment.label === 'STRONG_BUY' || sentiment.label === 'BUY'
                      ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                      : sentiment.label === 'STRONG_SELL' || sentiment.label === 'SELL'
                      ? 'bg-red-600/15 text-red-400 border-red-600/20'
                      : 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
                  }`}>
                    {sentiment.label.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {/* Key Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{t('scanner.riskLevel')}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${
                      sentiment.riskLevel === 'LOW' ? 'bg-emerald-600/15 text-emerald-400' :
                      sentiment.riskLevel === 'HIGH' ? 'bg-red-600/15 text-red-400' :
                      'bg-yellow-600/15 text-yellow-400'
                    }`}>
                      {sentiment.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{t('scanner.shortTermOutlook')}</span>
                    <span className="text-xs text-zinc-300 font-medium">{sentiment.shortTermOutlook}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{t('scanner.newsAnalyzed')}</span>
                    <span className="text-xs text-zinc-300 font-medium">{sentiment.newsCount} {t('scanner.articles')}</span>
                  </div>
                </div>
              </div>

              {/* Key Factors */}
              {sentiment.factors && sentiment.factors.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 font-medium mb-2">{t('scanner.keyFactors')}</p>
                  <div className="space-y-1">
                    {sentiment.factors.map((factor, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                        <span className="text-xs text-zinc-300">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {sentiment.summary && (
                <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                  <p className="text-xs text-zinc-300 leading-relaxed">{sentiment.summary}</p>
                </div>
              )}

              <p className="text-[10px] text-zinc-600 text-right">
                {t('scanner.analyzed')}: {new Date(sentiment.analyzedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Brain className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">{t('scanner.clickAnalyze')}</p>
              <p className="text-zinc-500 text-xs mt-1">{t('scanner.aiWillAnalyze')} {selectedSymbol}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Popular Stocks Grid */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">{t('scanner.popularStocks')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {popularStocks.map((stock) => {
              const scanData = scanScores[stock.symbol];
              return (
                <button
                  key={stock.symbol}
                  onClick={() => { setSelectedSymbol(stock.symbol); setSelectedName(stock.name); }}
                  className={`text-left p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
                    selectedSymbol === stock.symbol
                      ? 'bg-emerald-600/10 border-emerald-600/30'
                      : 'bg-[#0a0a0f] border-[#1e1e2e] hover:border-[#2e2e3e]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{stock.symbol}</span>
                    {scanData ? (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          backgroundColor: `${getSignalColor(scanData.score)}20`,
                          color: getSignalColor(scanData.score),
                        }}
                      >
                        {scanData.score}
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-zinc-800">
                        <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 mb-1 truncate">{stock.name}</p>
                  {scanData && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">${scanData.price.toFixed(2)}</span>
                      <Badge className={`text-[8px] px-1 py-0 ${
                        scanData.signalType === 'BUY'
                          ? 'bg-emerald-600/15 text-emerald-400'
                          : scanData.signalType === 'SELL'
                          ? 'bg-red-600/15 text-red-400'
                          : 'bg-yellow-600/15 text-yellow-400'
                      }`}>
                        {translateSignalType(scanData.signalType, t)}
                      </Badge>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
