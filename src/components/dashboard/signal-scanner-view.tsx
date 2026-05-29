'use client';

import { useState, useCallback, useRef } from 'react';
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
  AlertTriangle,
  WifiOff,
  Wifi,
  Zap,
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

// ==================== Types ====================

interface StockQuote {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  market: string;
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
  ma: Record<string, number>;
  rsi: Record<string, number>;
  macd: { macd: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number; pricePosition: number };
  kdj: { k: number; d: number; j: number };
}

interface ScanSignal {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  signalType: 'BUY' | 'SELL' | 'HOLD';
  strength: 'strong' | 'medium' | 'weak';
  indicators: {
    maCross: 'golden' | 'death' | 'none';
    rsiSignal: 'overbought' | 'oversold' | 'neutral';
    macdCross: 'golden' | 'death' | 'none';
    bollingerBreak: 'upper' | 'lower' | 'none';
    kdjCross: 'golden' | 'death' | 'none';
  };
  score: number;
  sector: string;
}

interface SectorInfo {
  name: string;
  change: number;
  changePercent: number;
  leadingStock: string;
  leadingStockChange: number;
}

// ==================== Stock lists per market ====================

const MARKET_STOCKS: Record<string, { symbol: string; name: string }[]> = {
  A: [
    { symbol: 'SH600519', name: '贵州茅台' },
    { symbol: 'SH601318', name: '中国平安' },
    { symbol: 'SH600036', name: '招商银行' },
    { symbol: 'SZ000858', name: '五粮液' },
    { symbol: 'SH601398', name: '工商银行' },
    { symbol: 'SZ300750', name: '宁德时代' },
    { symbol: 'SH600276', name: '恒瑞医药' },
    { symbol: 'SH600030', name: '中信证券' },
    { symbol: 'SZ000333', name: '美的集团' },
    { symbol: 'SH600900', name: '长江电力' },
    { symbol: 'SH601899', name: '紫金矿业' },
    { symbol: 'SZ002475', name: '立讯精密' },
  ],
  HK: [
    { symbol: 'HK00700', name: '腾讯控股' },
    { symbol: 'HK09988', name: '阿里巴巴' },
    { symbol: 'HK03690', name: '美团' },
    { symbol: 'HK00005', name: '汇丰控股' },
    { symbol: 'HK00941', name: '中国移动' },
    { symbol: 'HK01299', name: '友邦保险' },
    { symbol: 'HK01810', name: '小米集团' },
    { symbol: 'HK09618', name: '京东集团' },
    { symbol: 'HK09888', name: '百度集团' },
    { symbol: 'HK02015', name: '理想汽车' },
  ],
  US: [
    { symbol: 'AAPL', name: '苹果' },
    { symbol: 'NVDA', name: '英伟达' },
    { symbol: 'TSLA', name: '特斯拉' },
    { symbol: 'MSFT', name: '微软' },
    { symbol: 'AMZN', name: '亚马逊' },
    { symbol: 'META', name: 'Meta' },
    { symbol: 'GOOGL', name: '谷歌' },
    { symbol: 'AMD', name: 'AMD' },
    { symbol: 'JPM', name: '摩根大通' },
    { symbol: 'V', name: 'Visa' },
  ],
};

// ==================== Helper functions ====================

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

function translateSignalType(signalType: string, t: (key: string) => string): string {
  switch (signalType) {
    case 'BUY': return t('common.buy');
    case 'SELL': return t('common.sell');
    case 'HOLD': return t('common.hold');
    default: return signalType;
  }
}

function getStrengthColor(strength: string): string {
  switch (strength) {
    case 'strong': return 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20';
    case 'medium': return 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20';
    case 'weak': return 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';
    default: return 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20';
  }
}

function analyzeIndicators(
  indicators: TechnicalIndicators,
  currentPrice: number,
  sector: string,
  symbol: string,
  name: string,
  changePercent: number,
): ScanSignal {
  const signals: string[] = [];
  let buyCount = 0;
  let sellCount = 0;

  // MA crossover check
  const ma5 = indicators.ma?.ma5 || 0;
  const ma20 = indicators.ma?.ma20 || 0;
  let maCross: 'golden' | 'death' | 'none' = 'none';
  if (ma5 > 0 && ma20 > 0) {
    if (ma5 > ma20) {
      maCross = 'golden';
      buyCount++;
      signals.push('ma_golden');
    } else {
      maCross = 'death';
      sellCount++;
      signals.push('ma_death');
    }
  }

  // RSI check
  const rsi14 = indicators.rsi?.rsi14 || 50;
  let rsiSignal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
  if (rsi14 > 70) {
    rsiSignal = 'overbought';
    sellCount++;
    signals.push('rsi_overbought');
  } else if (rsi14 < 30) {
    rsiSignal = 'oversold';
    buyCount++;
    signals.push('rsi_oversold');
  }

  // MACD check
  const macdVal = indicators.macd?.macd || 0;
  const macdSignalVal = indicators.macd?.signal || 0;
  const macdHist = indicators.macd?.histogram || 0;
  let macdCross: 'golden' | 'death' | 'none' = 'none';
  if (macdHist > 0 && macdVal > macdSignalVal) {
    macdCross = 'golden';
    buyCount++;
    signals.push('macd_golden');
  } else if (macdHist < 0 && macdVal < macdSignalVal) {
    macdCross = 'death';
    sellCount++;
    signals.push('macd_death');
  }

  // Bollinger Bands check
  const bollinger = indicators.bollinger;
  let bollingerBreak: 'upper' | 'lower' | 'none' = 'none';
  if (bollinger && bollinger.upper > 0) {
    if (currentPrice > bollinger.upper) {
      bollingerBreak = 'upper';
      sellCount++;
      signals.push('bollinger_upper');
    } else if (currentPrice < bollinger.lower) {
      bollingerBreak = 'lower';
      buyCount++;
      signals.push('bollinger_lower');
    }
  }

  // KDJ check
  const kdj = indicators.kdj;
  let kdjCross: 'golden' | 'death' | 'none' = 'none';
  if (kdj && kdj.k > 0) {
    if (kdj.k > kdj.d && kdj.j > kdj.k) {
      kdjCross = 'golden';
      buyCount++;
      signals.push('kdj_golden');
    } else if (kdj.k < kdj.d && kdj.j < kdj.k) {
      kdjCross = 'death';
      sellCount++;
      signals.push('kdj_death');
    }
  }

  // Determine signal type
  let signalType: 'BUY' | 'SELL' | 'HOLD';
  if (buyCount >= 3) signalType = 'BUY';
  else if (sellCount >= 3) signalType = 'SELL';
  else if (buyCount > sellCount) signalType = 'BUY';
  else if (sellCount > buyCount) signalType = 'SELL';
  else signalType = 'HOLD';

  // Calculate score (0-100)
  const totalSignals = buyCount + sellCount;
  const dominantCount = signalType === 'BUY' ? buyCount : signalType === 'SELL' ? sellCount : 0;
  const baseScore = signalType === 'HOLD' ? 30 : (dominantCount / Math.max(totalSignals, 1)) * 70 + 30;

  // Determine strength
  let strength: 'strong' | 'medium' | 'weak';
  if (dominantCount >= 4) strength = 'strong';
  else if (dominantCount >= 2) strength = 'medium';
  else strength = 'weak';

  return {
    symbol,
    name,
    price: currentPrice,
    changePercent,
    signalType,
    strength,
    indicators: {
      maCross,
      rsiSignal,
      macdCross,
      bollingerBreak,
      kdjCross,
    },
    score: Math.round(baseScore),
    sector,
  };
}

// Demo generator removed — scanner now uses real data from backend API

// ==================== Component ====================

export function SignalScannerView() {
  const { t, language } = useLanguage();
  const [market, setMarket] = useState<'A' | 'HK' | 'US'>('US');
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<string>('');
  const [sectors, setSectors] = useState<SectorInfo[]>([]);
  const [signals, setSignals] = useState<ScanSignal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<ScanSignal | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const abortRef = useRef<boolean>(false);

  // Fetch sector data for selected market
  const fetchSectors = useCallback(async (m: string): Promise<SectorInfo[]> => {
    try {
      const res = await fetch(`/api/fusion/market/sectors?market=${m}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setIsOffline(false);
          return data.data;
        }
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  // Fetch batch quotes for symbols
  const fetchBatchQuotes = useCallback(async (symbols: string[]): Promise<StockQuote[]> => {
    try {
      const res = await fetch(`/api/fusion/market/quote?symbols=${symbols.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          return Array.isArray(data.data) ? data.data : [data.data];
        }
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  // Fetch indicators for a single symbol
  const fetchIndicators = useCallback(async (symbol: string): Promise<TechnicalIndicators | null> => {
    try {
      const res = await fetch(`/api/fusion/market/indicators?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          return data.data;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Fetch kline data for chart
  const fetchKline = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`/api/fusion/market/kline?symbol=${symbol}&period=daily&count=90`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data && data.data.c && data.data.c.length > 0) {
          const locale = language === 'zh' ? 'zh-CN' : 'en-US';
          const formatted: CandleData[] = data.data.c.map((c: number, i: number) => ({
            time: new Date(data.data.t[i] * 1000).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
            open: data.data.o[i],
            high: data.data.h[i],
            low: data.data.l[i],
            close: c,
            volume: data.data.v[i],
          }));
          setCandleData(formatted);
        } else {
          setCandleData([]);
        }
      }
    } catch {
      setCandleData([]);
    }
  }, [language]);

  // Main scan function — calls the batch scan API directly
  const handleScan = useCallback(async () => {
    if (scanning) return;
    abortRef.current = false;
    setScanning(true);
    setScanError(null);
    setSignals([]);
    setSelectedSignal(null);
    setIsDemoMode(false);
    setIsOffline(false);

    try {
      // Phase 1: Fetch sectors in parallel with scan
      setScanPhase(t('scanner.scanningSectors'));
      const sectorPromise = fetchSectors(market);

      // Phase 2: Call the batch scan API (handles Finnhub + indicators on backend)
      setScanPhase(t('scanner.analyzingStocks'));
      const scanPromise = fetch('/api/signals/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market }),
      });

      // Wait for both
      const [sectorData, scanRes] = await Promise.all([sectorPromise, scanPromise]);
      setSectors(sectorData);

      if (abortRef.current) return;

      if (scanRes.ok) {
        const scanData = await scanRes.json();
        if (scanData.success && scanData.data?.signals) {
          const apiSignals: ScanSignal[] = scanData.data.signals;
          const summary = scanData.data.summary;

          // Sort signals by score (best first)
          apiSignals.sort((a: ScanSignal, b: ScanSignal) => {
            const aScore = a.signalType === 'BUY' ? a.score : a.signalType === 'SELL' ? 100 - a.score : 30;
            const bScore = b.signalType === 'BUY' ? b.score : b.signalType === 'SELL' ? 100 - b.score : 30;
            return bScore - aScore;
          });

          const hasRealData = summary?.realDataCount > 0;
          const hasMockData = summary?.mockDataCount > 0;

          setSignals(apiSignals);
          setIsDemoMode(!hasRealData && hasMockData);
          setIsOffline(!hasRealData);

          if (apiSignals.length > 0) {
            setSelectedSignal(apiSignals[0]);
            loadSignalDetail(apiSignals[0]);
          }
        } else {
          setScanError(scanData.error || t('scanner.scanError'));
          setIsOffline(true);
        }
      } else {
        setScanError(t('scanner.scanError'));
        setIsOffline(true);
      }
    } catch {
      setScanError(t('scanner.scanError'));
      setIsOffline(true);
    } finally {
      setScanning(false);
      setScanPhase('');
    }
  }, [market, scanning, fetchSectors, t]);

  // Load detail for a selected signal — uses GET /api/signals/scan for comprehensive data
  const loadSignalDetail = useCallback(async (signal: ScanSignal) => {
    setLoading(true);
    setSelectedSignal(signal);
    try {
      // Use the scan API which returns both signal analysis AND candle data
      const res = await fetch(`/api/signals/scan?symbol=${encodeURIComponent(signal.symbol)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const detail = data.data;

          // Update quote from scan result
          setQuote({
            symbol: detail.symbol,
            name: detail.name,
            currentPrice: detail.price,
            change: detail.price * detail.changePercent / 100,
            changePercent: detail.changePercent,
            high: 0, low: 0, open: 0, prevClose: 0, volume: 0,
            market: market,
          });

          // Set indicators from scan result
          if (detail.technicalDetails) {
            setIndicators({
              ma: detail.technicalDetails.ma,
              rsi: { rsi14: detail.technicalDetails.rsi, rsi6: 0, rsi12: 0 },
              macd: detail.technicalDetails.macd,
              bollinger: detail.technicalDetails.bollinger,
              kdj: detail.technicalDetails.kdj,
            });
          }

          // Format candle data for chart
          if (detail.candleData && detail.candleData.c?.length > 0) {
            const locale = language === 'zh' ? 'zh-CN' : 'en-US';
            const formatted: CandleData[] = detail.candleData.c.map((c: number, i: number) => ({
              time: new Date(detail.candleData.t[i] * 1000).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
              open: detail.candleData.o[i],
              high: detail.candleData.h[i],
              low: detail.candleData.l[i],
              close: c,
              volume: detail.candleData.v[i],
            }));
            setCandleData(formatted);
          }
        }
      }
    } catch {
      // Keep existing data
    } finally {
      setLoading(false);
    }
  }, [market, language]);

  const currentPrice = quote?.currentPrice || selectedSignal?.price || 0;
  const priceChange = quote?.change || 0;
  const priceChangePercent = quote?.changePercent || selectedSignal?.changePercent || 0;

  return (
    <div className="space-y-6">
      {/* Scan Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2e] rounded-lg p-1">
          {(['US', 'HK', 'A'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMarket(m); setSignals([]); setSelectedSignal(null); setIsDemoMode(false); setIsOffline(false); setScanError(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                market === m
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Globe className="w-3 h-3" />
              {t(`scanner.market${m}`)}
            </button>
          ))}
        </div>
        <Button
          onClick={handleScan}
          disabled={scanning}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {scanning ? scanPhase : t('scanner.scanMarket')}
        </Button>
        {isOffline && (
          <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-xs flex items-center gap-1 self-center">
            <WifiOff className="w-3 h-3" />
            {t('scanner.demoMode')}
          </Badge>
        )}
      </div>

      {/* Scanning progress */}
      {scanning && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
              <div>
                <p className="text-emerald-400 text-sm font-medium">{scanPhase}</p>
                <p className="text-zinc-500 text-xs">{t('scanner.analyzingStocks')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hot Sectors */}
      {sectors.length > 0 && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white">{t('scanner.hotSectors')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sectors.slice(0, 8).map((sector, i) => (
                <Badge
                  key={i}
                  className={`text-xs border ${
                    sector.changePercent > 0
                      ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                      : sector.changePercent < 0
                      ? 'bg-red-600/15 text-red-400 border-red-600/20'
                      : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                  }`}
                >
                  {sector.name}
                  <span className="ml-1">{sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal Results */}
      {signals.length > 0 && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white">
                {t('scanner.scanResults')}
                <span className="ml-2 text-xs text-zinc-400">{signals.length} {t('scanner.signalsFound')}</span>
              </CardTitle>
              {isDemoMode ? (
                <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[10px]">
                  <WifiOff className="w-3 h-3 mr-1" />
                  {t('scanner.demoMode')}
                </Badge>
              ) : (
                <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                  <Wifi className="w-3 h-3 mr-1" />
                  实时
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-96 overflow-y-auto custom-scrollbar">
              {isDemoMode && (
                <div className="col-span-full mb-1">
                  <p className="text-[11px] text-yellow-500/70 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('scanner.demoNote')}
                  </p>
                </div>
              )}
              {signals.map((signal) => (
                <button
                  key={signal.symbol}
                  onClick={() => loadSignalDetail(signal)}
                  className={`text-left p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01] ${
                    selectedSignal?.symbol === signal.symbol
                      ? 'bg-emerald-600/10 border-emerald-600/30'
                      : 'bg-[#0a0a0f] border-[#1e1e2e] hover:border-[#2e2e3e]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{signal.symbol}</span>
                    <Badge className={`${getRecommendationColor(signal.signalType)} border text-[9px] flex items-center gap-0.5`}>
                      {getRecommendationIcon(signal.signalType)}
                      {translateSignalType(signal.signalType, t)}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-zinc-500 mb-1 truncate">{signal.name}</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-300">
                      {signal.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs ${signal.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {signal.changePercent >= 0 ? '+' : ''}{signal.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge className={`${getStrengthColor(signal.strength)} border text-[8px]`}>
                      {t(`scanner.${signal.strength}`)}
                    </Badge>
                    {signal.indicators.maCross !== 'none' && (
                      <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[8px]">
                        {t(`scanner.${signal.indicators.maCross === 'golden' ? 'goldenCross' : 'deathCross'}`)}
                      </Badge>
                    )}
                    {signal.indicators.rsiSignal !== 'neutral' && (
                      <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[8px]">
                        {t(`scanner.${signal.indicators.rsiSignal === 'overbought' ? 'overboughtSignal' : 'oversoldSignal'}`)}
                      </Badge>
                    )}
                  </div>
                  {/* Signal strength bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${signal.score}%`,
                          backgroundColor: getSignalColor(signal.score),
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: getSignalColor(signal.score) }}>
                      {signal.score}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No signals state (shouldn't appear anymore since we always have demo fallback) */}
      {!scanning && signals.length === 0 && !scanError && !isDemoMode && (
        <Card className="bg-[#111118] border-[#1e1e2e] border-dashed rounded-xl">
          <CardContent className="py-12 text-center">
            <Radar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">{t('scanner.noSignals')}</p>
            <p className="text-zinc-500 text-xs mt-1">{t('scanner.scanMarket')}</p>
          </CardContent>
        </Card>
      )}

      {/* Selected Signal Detail */}
      {selectedSignal && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Price + Chart */}
          <div className="lg:col-span-2 space-y-4">
            {/* Price Header */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-white">{selectedSignal.symbol}</h3>
                      <span className="text-sm text-zinc-400">{selectedSignal.name}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold text-white">
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <div className={`flex items-center gap-1 ${priceChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {priceChangePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="text-sm font-medium">
                          {priceChangePercent >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getRecommendationColor(selectedSignal.signalType)} border text-xs flex items-center gap-1`}>
                      {getRecommendationIcon(selectedSignal.signalType)}
                      {translateSignalType(selectedSignal.signalType, t)}
                    </Badge>
                    <Badge className={`${getStrengthColor(selectedSignal.strength)} border text-xs flex items-center gap-1`}>
                      <Zap className="w-3 h-3" />
                      {t(`scanner.${selectedSignal.strength}`)}
                    </Badge>
                  </div>
                </div>

                {/* Signal Indicators Breakdown */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#1e1e2e]">
                  {selectedSignal.indicators.maCross !== 'none' && (
                    <Badge className={`text-[10px] border ${
                      selectedSignal.indicators.maCross === 'golden'
                        ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                        : 'bg-red-600/15 text-red-400 border-red-600/20'
                    }`}>
                      {t('scanner.maCross')}: {t(`scanner.${selectedSignal.indicators.maCross === 'golden' ? 'goldenCross' : 'deathCross'}`)}
                    </Badge>
                  )}
                  {selectedSignal.indicators.rsiSignal !== 'neutral' && (
                    <Badge className={`text-[10px] border ${
                      selectedSignal.indicators.rsiSignal === 'oversold'
                        ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                        : 'bg-red-600/15 text-red-400 border-red-600/20'
                    }`}>
                      {t('scanner.rsiSignal')}: {t(`scanner.${selectedSignal.indicators.rsiSignal === 'overbought' ? 'overboughtSignal' : 'oversoldSignal'}`)}
                    </Badge>
                  )}
                  {selectedSignal.indicators.macdCross !== 'none' && (
                    <Badge className={`text-[10px] border ${
                      selectedSignal.indicators.macdCross === 'golden'
                        ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                        : 'bg-red-600/15 text-red-400 border-red-600/20'
                    }`}>
                      {t('scanner.macdCross')}: {t(`scanner.${selectedSignal.indicators.macdCross === 'golden' ? 'goldenCross' : 'deathCross'}`)}
                    </Badge>
                  )}
                  {selectedSignal.indicators.bollingerBreak !== 'none' && (
                    <Badge className={`text-[10px] border ${
                      selectedSignal.indicators.bollingerBreak === 'lower'
                        ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                        : 'bg-red-600/15 text-red-400 border-red-600/20'
                    }`}>
                      {t('scanner.bollingerBreak')}: {t(`scanner.${selectedSignal.indicators.bollingerBreak === 'upper' ? 'breakoutUp' : 'breakoutDown'}`)}
                    </Badge>
                  )}
                  {selectedSignal.indicators.kdjCross !== 'none' && (
                    <Badge className={`text-[10px] border ${
                      selectedSignal.indicators.kdjCross === 'golden'
                        ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                        : 'bg-red-600/15 text-red-400 border-red-600/20'
                    }`}>
                      {t('scanner.kdjCross')}: {t(`scanner.${selectedSignal.indicators.kdjCross === 'golden' ? 'goldenCross' : 'deathCross'}`)}
                    </Badge>
                  )}
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
                    onClick={() => selectedSignal && fetchKline(selectedSignal.symbol)}
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
                        {indicators && indicators.bollinger && indicators.bollinger.middle > 0 && (
                          <ReferenceLine
                            y={indicators.bollinger.middle}
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

          {/* Right Panel - Signal Score & Indicators */}
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
                        stroke={getSignalColor(selectedSignal?.score || 0)}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${((selectedSignal?.score || 0) / 100) * 314} 314`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold" style={{ color: getSignalColor(selectedSignal?.score || 0) }}>
                        {selectedSignal?.score ?? '—'}
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
                <CardTitle className="text-base font-semibold text-white">{t('scanner.techIndicators')}</CardTitle>
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
                        <span className="text-xs text-zinc-400">{t('scanner.rsi14')}</span>
                        <span className={`text-xs font-medium ${
                          (indicators?.rsi?.rsi14 || 50) > 70 ? 'text-red-400' : (indicators?.rsi?.rsi14 || 50) < 30 ? 'text-emerald-400' : 'text-zinc-300'
                        }`}>
                          {(indicators?.rsi?.rsi14 || 50).toFixed(1)}
                        </span>
                      </div>
                      <Progress value={indicators?.rsi?.rsi14 || 50} className="h-1.5 bg-[#1e1e2e]" />
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
                          (indicators?.macd?.histogram || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {(indicators?.macd?.macd || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-zinc-500">{t('scanner.signal')}: </span>
                          <span className="text-zinc-300">{(indicators?.macd?.signal || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">{t('scanner.hist')}: </span>
                          <span className={(indicators?.macd?.histogram || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {(indicators?.macd?.histogram || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        selectedSignal.indicators.macdCross === 'golden'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : selectedSignal.indicators.macdCross === 'death'
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {selectedSignal.indicators.macdCross === 'golden'
                          ? t('scanner.goldenCross')
                          : selectedSignal.indicators.macdCross === 'death'
                          ? t('scanner.deathCross')
                          : '—'
                        }
                      </Badge>
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
                          <span className="text-red-400">${(indicators?.bollinger?.upper || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t('scanner.middle')}</span>
                          <span className="text-yellow-400">${(indicators?.bollinger?.middle || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t('scanner.lower')}</span>
                          <span className="text-emerald-400">${(indicators?.bollinger?.lower || 0).toFixed(2)}</span>
                        </div>
                      </div>
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        selectedSignal.indicators.bollingerBreak === 'upper'
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : selectedSignal.indicators.bollingerBreak === 'lower'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {selectedSignal.indicators.bollingerBreak === 'upper'
                          ? t('scanner.breakoutUp')
                          : selectedSignal.indicators.bollingerBreak === 'lower'
                          ? t('scanner.breakoutDown')
                          : '—'
                        }
                      </Badge>
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
                          <p className="text-emerald-400 font-medium">{(indicators?.kdj?.k || 50).toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-zinc-500">D</p>
                          <p className="text-yellow-400 font-medium">{(indicators?.kdj?.d || 50).toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-zinc-500">J</p>
                          <p className="text-zinc-300 font-medium">{(indicators?.kdj?.j || 50).toFixed(1)}</p>
                        </div>
                      </div>
                      <Badge className={`text-[10px] px-1.5 py-0 ${
                        selectedSignal.indicators.kdjCross === 'golden'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                          : selectedSignal.indicators.kdjCross === 'death'
                          ? 'bg-red-600/15 text-red-400 border-red-600/20'
                          : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                      }`}>
                        {selectedSignal.indicators.kdjCross === 'golden'
                          ? t('scanner.goldenCross')
                          : selectedSignal.indicators.kdjCross === 'death'
                          ? t('scanner.deathCross')
                          : '—'
                        }
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
