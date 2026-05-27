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

export function SignalScannerView() {
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
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchStockData = useCallback(async (symbol: string) => {
    setLoading(true);
    try {
      const [quoteRes, candleRes] = await Promise.allSettled([
        fetch(`/api/market/quote?symbol=${symbol}`),
        fetch(`/api/market/candle?symbol=${symbol}&resolution=D&from=${Math.floor(Date.now() / 1000) - 90 * 86400}&to=${Math.floor(Date.now() / 1000)}`),
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
          const formatted: CandleData[] = data.c.map((c: number, i: number) => ({
            time: new Date(data.t[i] * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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

      // Auto-scan on select
      const scanRes = await fetch(`/api/signals/scan?symbol=${symbol}`);
      if (scanRes.ok) {
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
      }
    } catch {
      setCandleData([]);
      setIndicators(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSymbol) {
      fetchStockData(selectedSymbol);
    }
  }, [selectedSymbol, fetchStockData]);

  // Quick scan popular stocks
  useEffect(() => {
    const quickScan = async () => {
      for (const stock of popularStocks) {
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
    try {
      const res = await fetch(`/api/signals/scan?symbol=${selectedSymbol}&name=${encodeURIComponent(selectedName)}`);
      if (res.ok) {
        const data = await res.json();
        setSignalResult(data);
        setIndicators({
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
        });
        setScanScores(prev => ({
          ...prev,
          [selectedSymbol]: { score: data.score, signalType: data.signalType, price: data.price },
        }));
      }
    } catch {
      // Handle error
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
            placeholder="Search stocks by symbol or name..."
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
        <Button
          onClick={handleRescan}
          disabled={scanning || !selectedSymbol}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Radar className="w-4 h-4" />
          {scanning ? 'Scanning...' : 'Re-scan'}
        </Button>
      </div>

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
                      {signalResult.signalType}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Price stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#1e1e2e]">
                <div>
                  <span className="text-xs text-zinc-500">Open</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.open || currentPrice).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">High</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.high || currentPrice).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Low</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.low || currentPrice).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Prev Close</span>
                  <p className="text-sm font-medium text-zinc-300">${(quote?.prevClose || currentPrice).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Chart */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white">Price Chart (90 Days)</CardTitle>
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
                  <p className="text-zinc-500 text-sm">No chart data available</p>
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
              <CardTitle className="text-base font-semibold text-white">Signal Score</CardTitle>
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
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Score</span>
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
                  <span className="text-zinc-500">≥50 BUY</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Indicators */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white">Technical Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full bg-[#0a0a0f] rounded" />
                  ))}
                </div>
              ) : (
                <>
                  {/* RSI */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">RSI (14)</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.rsi || 50) > 70 ? 'text-red-400' : (indicators?.rsi || 50) < 30 ? 'text-emerald-400' : 'text-zinc-300'
                      }`}>
                        {(indicators?.rsi || 50).toFixed(1)}
                      </span>
                    </div>
                    <Progress value={indicators?.rsi || 50} className="h-1.5 bg-[#1e1e2e]" />
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>Oversold (&lt;30)</span>
                      <span>Neutral</span>
                      <span>Overbought (&gt;70)</span>
                    </div>
                  </div>

                  <Separator className="bg-[#1e1e2e]" />

                  {/* MACD */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">MACD</span>
                      <span className={`text-xs font-medium ${
                        (indicators?.macdHist || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {(indicators?.macd || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500">Signal: </span>
                        <span className="text-zinc-300">{(indicators?.macdSignal || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Hist: </span>
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
                      <span className="text-xs text-zinc-400">Bollinger Bands</span>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Upper</span>
                        <span className="text-red-400">${(indicators?.bollingerUpper || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Middle</span>
                        <span className="text-yellow-400">${(indicators?.bollingerMiddle || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Lower</span>
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
                      <span className="text-xs text-zinc-400">Volume Ratio</span>
                      <span className="text-xs font-medium text-zinc-300">
                        {(signalResult?.volumeRatio || 1).toFixed(2)}x
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
              <CardTitle className="text-base font-semibold text-white">AI Sentiment Analysis</CardTitle>
              <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[10px]">
                <Sparkles className="w-3 h-3 mr-1" />AI Powered
              </Badge>
            </div>
            <Button
              onClick={handleAnalyzeSentiment}
              disabled={analyzing || !selectedSymbol}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analyzing && !sentiment ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-purple-600 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-purple-400 text-sm font-medium">AI is analyzing {selectedSymbol}...</p>
              <p className="text-zinc-500 text-xs mt-1">Fetching news and market data, then running sentiment analysis</p>
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
                    <span className="text-xs text-zinc-500">Risk Level</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${
                      sentiment.riskLevel === 'LOW' ? 'bg-emerald-600/15 text-emerald-400' :
                      sentiment.riskLevel === 'HIGH' ? 'bg-red-600/15 text-red-400' :
                      'bg-yellow-600/15 text-yellow-400'
                    }`}>
                      {sentiment.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Short-term Outlook</span>
                    <span className="text-xs text-zinc-300 font-medium">{sentiment.shortTermOutlook}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">News Analyzed</span>
                    <span className="text-xs text-zinc-300 font-medium">{sentiment.newsCount} articles</span>
                  </div>
                </div>
              </div>

              {/* Key Factors */}
              {sentiment.factors && sentiment.factors.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 font-medium mb-2">Key Factors</p>
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
                Analyzed: {new Date(sentiment.analyzedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Brain className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">Click "Analyze" to run AI sentiment analysis</p>
              <p className="text-zinc-500 text-xs mt-1">AI will analyze recent news and market data for {selectedSymbol}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Popular Stocks Grid */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white">Popular Stocks</CardTitle>
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
                        {scanData.signalType}
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
