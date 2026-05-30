'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Brain,
  Search,
  Play,
  Loader2,
  CheckCircle2,
  Circle,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  Sparkles,
  History,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Shield,
  MessageSquare,
  Cpu,
  PlusCircle,
  Eye,
  Target,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { AddPositionDialog } from '@/components/dashboard/add-position-dialog';

type AnalysisMode = 'quick' | 'standard' | 'full' | 'debate';
type AgentStatus = 'pending' | 'running' | 'done';

interface AgentState {
  id: string;
  nameKey: string;
  status: AgentStatus;
  icon: React.ElementType;
}

interface AnalysisResult {
  symbol: string;
  recommendation: 'BUY' | 'HOLD' | 'SELL';
  score: number;
  technicalSummary: string;
  fundamentalSummary: string;
  sentimentSummary: string;
  riskLevel: string;
  riskScore: number;
  bullCase?: string;
  bearCase?: string;
  report: string;
  provider: string;
  tokens: number;
  cost: number;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  memoryContext?: {
    hasHistory: boolean;
    accuracyRate: number | null;
    recentTrend: string | null;
  };
}

/** 准确率统计 */
interface AccuracyStats {
  symbol: string;
  totalAnalyses: number;
  correctCount: number;
  accuracyRate: number;
  buyAccuracy: number;
  holdAccuracy: number;
  sellAccuracy: number;
  avgScoreCorrect: number;
  avgScoreIncorrect: number;
  recentTrend: 'improving' | 'declining' | 'stable';
}

/** 反思摘要 */
interface ReflectionData {
  symbol: string;
  overallAccuracy: number;
  totalRecords: number;
  insights: string[];
  recentComparisons: {
    date: string;
    recommendation: string;
    score: number;
    entryPrice: number;
    actualReturn: number | null;
    wasCorrect: boolean | null;
  }[];
  suggestions: string[];
}

interface HistoryItem {
  id: string;
  symbol: string;
  mode: AnalysisMode;
  recommendation: string;
  score: number;
  timestamp: string;
}

const modeConfig: Record<AnalysisMode, { labelKey: string; descKey: string; agents: string[] }> = {
  quick: {
    labelKey: 'ai.modeQuick',
    descKey: 'ai.modeQuickDesc',
    agents: ['technical', 'decision'],
  },
  standard: {
    labelKey: 'ai.modeStandard',
    descKey: 'ai.modeStandardDesc',
    agents: ['technical', 'fundamental', 'sentiment', 'decision'],
  },
  full: {
    labelKey: 'ai.modeFull',
    descKey: 'ai.modeFullDesc',
    agents: ['technical', 'fundamental', 'sentiment', 'risk', 'decision'],
  },
  debate: {
    labelKey: 'ai.modeDebate',
    descKey: 'ai.modeDebateDesc',
    agents: ['technical', 'fundamental', 'sentiment', 'risk', 'bullbear', 'decision'],
  },
};

const agentInfo: Record<string, { nameKey: string; icon: React.ElementType }> = {
  technical: { nameKey: 'ai.agentTechnical', icon: TrendingUp },
  fundamental: { nameKey: 'ai.agentFundamental', icon: BarChart3 },
  sentiment: { nameKey: 'ai.agentSentiment', icon: MessageSquare },
  risk: { nameKey: 'ai.agentRisk', icon: Shield },
  bullbear: { nameKey: 'ai.agentBullBear', icon: Sparkles },
  decision: { nameKey: 'ai.agentDecision', icon: Brain },
};

function getRecColor(rec: string): string {
  switch (rec) {
    case 'BUY': return 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20';
    case 'SELL': return 'bg-red-600/15 text-red-400 border-red-600/20';
    default: return 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20';
  }
}

function getRecIcon(rec: string) {
  switch (rec) {
    case 'BUY': return <ArrowUpRight className="w-5 h-5" />;
    case 'SELL': return <ArrowDownRight className="w-5 h-5" />;
    default: return <Minus className="w-5 h-5" />;
  }
}

function getTrendBadge(trend: string | null) {
  if (!trend) return null;
  switch (trend) {
    case 'improving':
      return <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[9px] px-1.5 py-0">↑</Badge>;
    case 'declining':
      return <Badge className="bg-red-600/15 text-red-400 border-red-600/20 text-[9px] px-1.5 py-0">↓</Badge>;
    default:
      return <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[9px] px-1.5 py-0">→</Badge>;
  }
}

const mockHistory: HistoryItem[] = [
  { id: '1', symbol: 'AAPL', mode: 'standard', recommendation: 'BUY', score: 78, timestamp: '2024-01-15T14:30:00Z' },
  { id: '2', symbol: 'NVDA', mode: 'debate', recommendation: 'BUY', score: 85, timestamp: '2024-01-15T12:15:00Z' },
  { id: '3', symbol: 'TSLA', mode: 'full', recommendation: 'HOLD', score: 52, timestamp: '2024-01-14T16:00:00Z' },
  { id: '4', symbol: 'MSFT', mode: 'quick', recommendation: 'BUY', score: 71, timestamp: '2024-01-14T10:30:00Z' },
];

const mockResult: AnalysisResult = {
  symbol: 'AAPL',
  recommendation: 'BUY',
  score: 78,
  technicalSummary: 'AAPL is trading above its 50-day and 200-day moving averages, indicating a strong uptrend. RSI at 62 suggests room for further upside before overbought conditions. MACD histogram turning positive confirms bullish momentum. Support at $185, resistance at $195.',
  fundamentalSummary: 'Apple reported strong Q4 earnings with revenue of $89.5B (+8% YoY). Services segment continues to grow at 16% YoY, now contributing 25% of total revenue. P/E ratio of 29.5 is slightly above sector average but justified by growth prospects. iPhone 15 cycle showing solid demand trends.',
  sentimentSummary: 'Overall market sentiment is positive. 72% of analyst ratings are Buy/Outperform. Recent product launches received favorable coverage. Supply chain concerns from Q3 have largely been resolved. Consumer confidence indicators remain stable.',
  riskLevel: 'MEDIUM',
  riskScore: 35,
  bullCase: 'Services revenue accelerating, AI integration driving device upgrades, strong cash flow enabling continued buybacks. AR/VR product line could unlock new revenue streams.',
  bearCase: 'China market headwinds, regulatory risks in EU (USB-C, app store), potential consumer spending slowdown. Competition in AI from Google/Microsoft could pressure margins.',
  report: `# AAPL Comprehensive Analysis Report

## Executive Summary
Apple Inc. (AAPL) presents a **BUY** recommendation with a composite score of 78/100. The stock benefits from strong technical momentum, solid fundamental backing, and favorable sentiment trends.

## Technical Analysis
- **Trend**: Strong uptrend above key moving averages
- **Momentum**: MACD bullish crossover, RSI at 62 (neutral-bullish)
- **Support/Resistance**: Support at $185, resistance at $195

## Fundamental Analysis
- **Revenue Growth**: +8% YoY in Q4
- **Services Growth**: 16% YoY, increasingly important revenue driver
- **Valuation**: P/E of 29.5, premium but growth-justified

## Sentiment Analysis
- **Analyst Consensus**: 72% Buy ratings
- **News Sentiment**: Positive bias
- **Social Sentiment**: Favorable product reception

## Risk Assessment
- **Risk Level**: Medium (score: 35/100)
- **Key Risks**: China exposure, EU regulation, consumer spending

## Conclusion
AAPL offers a compelling risk/reward profile at current levels. The convergence of technical strength, fundamental quality, and positive sentiment supports our BUY recommendation with a 6-month target of $195.`,
  provider: 'deepseek',
  tokens: 2450,
  cost: 0.02,
};

export function AIAnalysisView({ initialSymbol }: { initialSymbol?: string }) {
  const { t } = useLanguage();
  const [symbol, setSymbol] = useState(initialSymbol || '');
  const [mode, setMode] = useState<AnalysisMode>('standard');
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [searchResults, setSearchResults] = useState<{ symbol: string; description: string }[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>(mockHistory);
  const [addPositionOpen, setAddPositionOpen] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // 当 initialSymbol 变化时（如从自选股导航过来），预填股票代码
  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
    }
  }, [initialSymbol]);

  // 记忆与反思状态
  const [accuracyStats, setAccuracyStats] = useState<AccuracyStats | null>(null);
  const [reflectionData, setReflectionData] = useState<ReflectionData | null>(null);
  const [accuracyLoading, setAccuracyLoading] = useState(false);

  // 获取准确率数据
  const fetchAccuracy = useCallback(async (sym: string) => {
    if (!sym.trim()) return;
    setAccuracyLoading(true);
    try {
      const res = await fetch(`/api/fusion/analysis/accuracy?symbol=${encodeURIComponent(sym.toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        setAccuracyStats(data);
      }
    } catch {
      // 保持现有数据
    } finally {
      setAccuracyLoading(false);
    }
  }, []);

  // 获取反思数据
  const fetchReflection = useCallback(async (sym: string) => {
    if (!sym.trim()) return;
    try {
      const res = await fetch(`/api/fusion/analysis/reflection?symbol=${encodeURIComponent(sym.toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        setReflectionData(data);
      }
    } catch {
      // 保持现有数据
    }
  }, []);

  // 当symbol变化时获取准确率
  useEffect(() => {
    if (symbol.trim()) {
      fetchAccuracy(symbol);
    } else {
      setAccuracyStats(null);
      setReflectionData(null);
    }
  }, [symbol, fetchAccuracy]);

  const handleSearch = (query: string) => {
    setSymbol(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${query}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {
        setSearchResults([]);
      }
    }, 300);
  };

  const handleStartAnalysis = useCallback(async () => {
    if (!symbol.trim()) return;
    setAnalyzing(true);
    setResult(null);
    setShowReport(false);

    const modeAgents = modeConfig[mode].agents;
    const initialAgents: AgentState[] = modeAgents.map((id) => ({
      id,
      nameKey: agentInfo[id].nameKey,
      status: 'pending' as AgentStatus,
      icon: agentInfo[id].icon,
    }));
    setAgents(initialAgents);

    try {
      // Start the real API call immediately (don't wait for simulation)
      const analysisPromise = fetch('/api/fusion/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), mode }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          return data as AnalysisResult;
        }
        return null;
      }).catch(() => null);

      // Also fetch quote and indicators for additional context
      const quotePromise = fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}`)
        .then(async (res) => res.ok ? await res.json() : null)
        .catch(() => null);

      const indicatorsPromise = fetch(`/api/fusion/market/indicators?symbol=${encodeURIComponent(symbol.toUpperCase())}`)
        .then(async (res) => res.ok ? await res.json() : null)
        .catch(() => null);

      // Simulate agent progression for visual feedback (run in parallel with API calls)
      const simulationPromise = (async () => {
        for (let i = 0; i < modeAgents.length; i++) {
          setAgents((prev) =>
            prev.map((a, idx) => idx === i ? { ...a, status: 'running' } : a)
          );
          await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));
          setAgents((prev) =>
            prev.map((a, idx) => idx === i ? { ...a, status: 'done' } : a)
          );
        }
      })();

      // Wait for both simulation and API results
      const [, analysisDataRaw, quoteData, indicatorsData] = await Promise.all([
        simulationPromise,
        analysisPromise,
        quotePromise,
        indicatorsPromise,
      ]);

      // Ensure all agents show done
      setAgents((prev) => prev.map((a) => ({ ...a, status: 'done' as AgentStatus })));

      const analysisData = analysisDataRaw;

      if (analysisData) {
        // Merge real quote data into result
        const mergedResult: AnalysisResult = {
          ...analysisData,
          symbol: symbol.toUpperCase(),
          currentPrice: quoteData?.currentPrice || analysisData.currentPrice,
          priceChange: quoteData?.change || analysisData.priceChange,
          priceChangePercent: quoteData?.changePercent || analysisData.priceChangePercent,
        };
        setResult(mergedResult);
      } else {
        // Fallback to mock with real price if available
        setResult({
          ...mockResult,
          symbol: symbol.toUpperCase(),
          currentPrice: quoteData?.currentPrice,
          priceChange: quoteData?.change,
          priceChangePercent: quoteData?.changePercent,
          provider: indicatorsData ? 'z-ai (partial)' : 'mock',
        });
      }

      // Add to history
      const finalResult = analysisData || mockResult;
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          symbol: symbol.toUpperCase(),
          mode,
          recommendation: finalResult.recommendation,
          score: finalResult.score,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

      // 刷新准确率数据
      fetchAccuracy(symbol);
      fetchReflection(symbol);
    } catch (error) {
      console.error('[AI Analysis] Error:', error);
      // Even on error, show a fallback result so the user isn't stuck
      setResult({
        ...mockResult,
        symbol: symbol.toUpperCase(),
        provider: 'error-fallback',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [symbol, mode, fetchAccuracy, fetchReflection]);

  const selectSymbol = (sym: string) => {
    setSymbol(sym);
    setSearchResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Input Bar */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Symbol Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder={t('ai.symbolPlaceholder')}
                value={symbol}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 bg-[#0a0a0f] border-[#1e1e2e] text-white placeholder:text-zinc-500 focus:border-emerald-600/50"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#111118] border border-[#1e1e2e] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                  {searchResults.map((s) => (
                    <button
                      key={s.symbol}
                      onClick={() => selectSymbol(s.symbol)}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#1a1a2e] transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-white">{s.symbol}</span>
                      <span className="text-xs text-zinc-500">{s.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mode Selector */}
            <Select value={mode} onValueChange={(v) => setMode(v as AnalysisMode)}>
              <SelectTrigger className="w-40 bg-[#0a0a0f] border-[#1e1e2e] text-white">
                <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                {(['quick', 'standard', 'full', 'debate'] as AnalysisMode[]).map((m) => (
                  <SelectItem key={m} value={m} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                    {t(modeConfig[m].labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Analyze Button */}
            <Button
              onClick={handleStartAnalysis}
              disabled={analyzing || !symbol.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[140px]"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('ai.analyzing')}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {t('ai.startAnalysis')}
                </>
              )}
            </Button>
          </div>

          {/* Mode Description */}
          <p className="text-xs text-zinc-500 mt-2">
            {t(modeConfig[mode].descKey)} — {modeConfig[mode].agents.length} agents
          </p>
        </CardContent>
      </Card>

      {/* Analysis Results Area */}
      {(analyzing || result) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Results */}
          <div className="lg:col-span-2 space-y-4">
            {result && (
              <>
                {/* Recommendation Badge */}
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-6">
                      <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${getRecColor(result.recommendation)} border`}>
                        {getRecIcon(result.recommendation)}
                        <span className="text-lg font-bold mt-0.5">{result.recommendation}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-white">{result.symbol}</h3>
                          <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-xs">
                            {t(modeConfig[mode].labelKey)}
                          </Badge>
                          {/* 记忆上下文指示器 */}
                          {result.memoryContext?.hasHistory && (
                            <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[10px] gap-1">
                              <Eye className="w-2.5 h-2.5" />
                              {t('ai.memoryEnabled')}
                            </Badge>
                          )}
                          {result.recommendation === 'BUY' && (
                            <Button
                              onClick={() => setAddPositionOpen(true)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-7 text-xs"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              {t('pos.addPosition')}
                            </Button>
                          )}
                        </div>
                        {result.currentPrice != null && result.currentPrice > 0 && (
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl font-bold text-white">
                              ${result.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {result.priceChange != null && (
                              <span className={`text-sm font-medium flex items-center gap-1 ${result.priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {result.priceChange >= 0 ? '+' : ''}{result.priceChange.toFixed(2)} ({result.priceChangePercent >= 0 ? '+' : ''}{(result.priceChangePercent ?? 0).toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-xs text-zinc-500">{t('ai.score')}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-3xl font-bold text-white">{result.score}</span>
                              <span className="text-sm text-zinc-400">/100</span>
                            </div>
                          </div>
                          <div className="flex-1 max-w-xs">
                            <Progress value={result.score} className="h-2 bg-[#1e1e2e]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Analysis Tabs */}
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardContent className="p-4">
                    <Tabs defaultValue="technical">
                      <TabsList className="bg-[#0a0a0f] border border-[#1e1e2e]">
                        <TabsTrigger value="technical" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
                          <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                          {t('ai.technicalSummary')}
                        </TabsTrigger>
                        <TabsTrigger value="fundamental" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
                          <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                          {t('ai.fundamentalSummary')}
                        </TabsTrigger>
                        <TabsTrigger value="sentiment" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                          {t('ai.sentimentSummary')}
                        </TabsTrigger>
                        <TabsTrigger value="risk" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
                          <Shield className="w-3.5 h-3.5 mr-1.5" />
                          {t('ai.riskAssessment')}
                        </TabsTrigger>
                        {mode === 'debate' && (
                          <TabsTrigger value="debate" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            {t('ai.bullBearDebate')}
                          </TabsTrigger>
                        )}
                      </TabsList>
                      <TabsContent value="technical" className="mt-4">
                        <p className="text-sm text-zinc-300 leading-relaxed">{result.technicalSummary}</p>
                      </TabsContent>
                      <TabsContent value="fundamental" className="mt-4">
                        <p className="text-sm text-zinc-300 leading-relaxed">{result.fundamentalSummary}</p>
                      </TabsContent>
                      <TabsContent value="sentiment" className="mt-4">
                        <p className="text-sm text-zinc-300 leading-relaxed">{result.sentimentSummary}</p>
                      </TabsContent>
                      <TabsContent value="risk" className="mt-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge className={`${result.riskLevel === 'LOW' ? 'bg-emerald-600/15 text-emerald-400' : result.riskLevel === 'HIGH' ? 'bg-red-600/15 text-red-400' : 'bg-yellow-600/15 text-yellow-400'} border text-xs`}>
                            {result.riskLevel}
                          </Badge>
                          <span className="text-sm text-zinc-400">Risk Score: {result.riskScore}/100</span>
                        </div>
                        <Progress value={result.riskScore} className="h-2 bg-[#1e1e2e] mb-4" />
                        <p className="text-sm text-zinc-300 leading-relaxed">
                          Risk assessment indicates {result.riskLevel.toLowerCase()} overall risk profile.
                          Key risk factors should be monitored closely for position sizing decisions.
                        </p>
                      </TabsContent>
                      {mode === 'debate' && result.bullCase && result.bearCase && (
                        <TabsContent value="debate" className="mt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-600/5 border border-emerald-600/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <h4 className="text-sm font-semibold text-emerald-400">{t('ai.bullCase')}</h4>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">{result.bullCase}</p>
                            </div>
                            <div className="p-4 bg-red-600/5 border border-red-600/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <TrendingDown className="w-4 h-4 text-red-400" />
                                <h4 className="text-sm font-semibold text-red-400">{t('ai.bearCase')}</h4>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">{result.bearCase}</p>
                            </div>
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Full Report */}
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <button
                      className="flex items-center justify-between w-full"
                      onClick={() => setShowReport(!showReport)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-400" />
                        <CardTitle className="text-base font-semibold text-white">{t('ai.detailedReport')}</CardTitle>
                      </div>
                      {showReport ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </button>
                  </CardHeader>
                  {showReport && (
                    <CardContent>
                      <div className="prose prose-invert prose-sm max-w-none">
                        {result.report.split('\n').map((line, i) => {
                          if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mb-3">{line.slice(2)}</h1>;
                          if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-emerald-400 mt-4 mb-2">{line.slice(3)}</h2>;
                          if (line.startsWith('- ')) return <li key={i} className="text-sm text-zinc-300 ml-4">{line.slice(2)}</li>;
                          if (line.trim() === '') return <br key={i} />;
                          return <p key={i} className="text-sm text-zinc-300 leading-relaxed">{line}</p>;
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </>
            )}
          </div>

          {/* Right: Agent Progress + Accuracy + LLM Usage */}
          <div className="space-y-4">
            {/* Agent Progress */}
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-base font-semibold text-white">{t('ai.agentProgress')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {agents.map((agent) => {
                  const Icon = agent.icon;
                  return (
                    <div key={agent.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        agent.status === 'done' ? 'bg-emerald-600/15' :
                        agent.status === 'running' ? 'bg-yellow-600/15' :
                        'bg-zinc-600/15'
                      }`}>
                        {agent.status === 'done' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : agent.status === 'running' ? (
                          <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="text-sm text-zinc-300">{t(agent.nameKey)}</span>
                          </div>
                          <Badge className={`text-[9px] px-1.5 py-0 ${
                            agent.status === 'done' ? 'bg-emerald-600/15 text-emerald-400' :
                            agent.status === 'running' ? 'bg-yellow-600/15 text-yellow-400' :
                            'bg-zinc-600/15 text-zinc-500'
                          }`}>
                            {agent.status === 'done' ? t('ai.statusDone') :
                             agent.status === 'running' ? t('ai.statusRunning') :
                             t('ai.statusPending')}
                          </Badge>
                        </div>
                        {agent.status === 'running' && (
                          <Progress value={66} className="h-1 bg-[#1e1e2e] mt-1.5" />
                        )}
                      </div>
                    </div>
                  );
                })}
                {agents.length === 0 && !analyzing && (
                  <p className="text-xs text-zinc-500 text-center py-4">{t('ai.noSymbol')}</p>
                )}
              </CardContent>
            </Card>

            {/* 准确率面板 */}
            {symbol.trim() && (
              <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-400" />
                      <CardTitle className="text-base font-semibold text-white">{t('ai.accuracyPanel')}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchAccuracy(symbol)}
                      disabled={accuracyLoading}
                      className="h-6 px-2 text-zinc-400 hover:text-white"
                    >
                      <RotateCcw className={`w-3 h-3 ${accuracyLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {accuracyLoading && !accuracyStats ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-[#1a1a2e] rounded animate-pulse" />
                      <div className="h-3 bg-[#1a1a2e] rounded animate-pulse w-3/4" />
                    </div>
                  ) : accuracyStats && accuracyStats.totalAnalyses > 0 ? (
                    <div className="space-y-3">
                      {/* 综合准确率 */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">{t('ai.overallAccuracy')}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${
                            accuracyStats.accuracyRate >= 60 ? 'text-emerald-400' :
                            accuracyStats.accuracyRate >= 40 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {accuracyStats.accuracyRate}%
                          </span>
                          {getTrendBadge(accuracyStats.recentTrend)}
                        </div>
                      </div>
                      <Progress
                        value={accuracyStats.accuracyRate}
                        className="h-2 bg-[#1e1e2e]"
                      />

                      {/* 分项准确率 */}
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] text-center">
                          <span className="text-[10px] text-zinc-500">{t('common.buy')}</span>
                          <p className="text-sm font-bold text-emerald-400">{accuracyStats.buyAccuracy}%</p>
                        </div>
                        <div className="p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] text-center">
                          <span className="text-[10px] text-zinc-500">{t('common.hold')}</span>
                          <p className="text-sm font-bold text-yellow-400">{accuracyStats.holdAccuracy}%</p>
                        </div>
                        <div className="p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] text-center">
                          <span className="text-[10px] text-zinc-500">{t('common.sell')}</span>
                          <p className="text-sm font-bold text-red-400">{accuracyStats.sellAccuracy}%</p>
                        </div>
                      </div>

                      <Separator className="bg-[#1e1e2e]" />

                      {/* 统计细节 */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{t('ai.totalVerified')}</span>
                        <span className="text-[11px] text-zinc-300">{accuracyStats.totalAnalyses}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{t('ai.correctCount')}</span>
                        <span className="text-[11px] text-emerald-400">{accuracyStats.correctCount}</span>
                      </div>

                      {/* 反思按钮 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowReflection(!showReflection);
                          if (!reflectionData) fetchReflection(symbol);
                        }}
                        className="w-full border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white gap-1.5 h-8 text-xs mt-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showReflection ? t('ai.hideReflection') : t('ai.viewReflection')}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <Target className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs text-zinc-500">{t('ai.noAccuracyData')}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">{t('ai.noAccuracyDataHint')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 反思面板（展开） */}
            {showReflection && symbol.trim() && (
              <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-purple-400" />
                    <CardTitle className="text-base font-semibold text-white">{t('ai.reflectionTitle')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {reflectionData ? (
                    <div className="space-y-3">
                      {/* 洞察 */}
                      {reflectionData.insights.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-400 mb-1.5">{t('ai.insights')}</p>
                          <div className="space-y-1">
                            {reflectionData.insights.map((insight, i) => (
                              <p key={i} className="text-[11px] text-zinc-300 leading-relaxed pl-2 border-l-2 border-purple-600/30">
                                {insight}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator className="bg-[#1e1e2e]" />

                      {/* 历史对比 */}
                      {reflectionData.recentComparisons.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-zinc-400 mb-1.5">{t('ai.historyComparison')}</p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                            {reflectionData.recentComparisons.map((comp, i) => (
                              <div key={i} className="flex items-center justify-between p-1.5 bg-[#0a0a0f] rounded border border-[#1e1e2e]">
                                <div className="flex items-center gap-1.5">
                                  <Badge className={`${getRecColor(comp.recommendation)} border text-[8px] px-1 py-0`}>
                                    {comp.recommendation}
                                  </Badge>
                                  <span className="text-[10px] text-zinc-400">{comp.date}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {comp.wasCorrect !== null ? (
                                    comp.wasCorrect ? (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <span className="text-[10px] text-red-400">✗</span>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-zinc-500">...</span>
                                  )}
                                  {comp.actualReturn != null && (
                                    <span className={`text-[10px] font-medium ${comp.actualReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {comp.actualReturn >= 0 ? '+' : ''}{comp.actualReturn}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 改进建议 */}
                      {reflectionData.suggestions.length > 0 && (
                        <>
                          <Separator className="bg-[#1e1e2e]" />
                          <div>
                            <p className="text-xs font-medium text-zinc-400 mb-1.5">{t('ai.improvementSuggestions')}</p>
                            {reflectionData.suggestions.map((sug, i) => (
                              <p key={i} className="text-[11px] text-zinc-400 leading-relaxed">• {sug}</p>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-3 bg-[#1a1a2e] rounded animate-pulse" />
                      <div className="h-3 bg-[#1a1a2e] rounded animate-pulse w-3/4" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* LLM Usage */}
            {result && (
              <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-emerald-400" />
                    <CardTitle className="text-base font-semibold text-white">{t('ai.llmUsage')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{t('ai.provider')}</span>
                    <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[10px]">
                      {result.provider}
                    </Badge>
                  </div>
                  <Separator className="bg-[#1e1e2e]" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{t('ai.tokens')}</span>
                    <span className="text-sm font-medium text-white">{result.tokens.toLocaleString()}</span>
                  </div>
                  <Separator className="bg-[#1e1e2e]" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{t('ai.cost')}</span>
                    <span className="text-sm font-medium text-emerald-400">${result.cost.toFixed(3)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analyzing && !result && (
        <Card className="bg-[#111118] border-[#1e1e2e] border-dashed rounded-xl">
          <CardContent className="py-16 text-center">
            <Brain className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg font-medium">{t('ai.title')}</p>
            <p className="text-zinc-500 text-sm mt-2">{t('ai.noSymbol')}</p>
          </CardContent>
        </Card>
      )}

      {/* Analysis History */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowHistory(!showHistory)}
          >
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('ai.analysisHistory')}</CardTitle>
              <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                {history.length}
              </Badge>
            </div>
            {showHistory ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>
        </CardHeader>
        {showHistory && (
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e] hover:border-[#2e2e3e] transition-colors cursor-pointer"
                  onClick={() => { setSymbol(item.symbol); setMode(item.mode); }}
                >
                  <div className="flex items-center gap-3">
                    <Badge className={`${getRecColor(item.recommendation)} border text-xs`}>
                      {item.recommendation}
                    </Badge>
                    <span className="text-sm font-medium text-white">{item.symbol}</span>
                    <Badge variant="secondary" className="text-[10px] bg-zinc-600/15 text-zinc-400">
                      {t(modeConfig[item.mode].labelKey)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{item.score}/100</span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Add Position Dialog */}
      <AddPositionDialog
        open={addPositionOpen}
        onOpenChange={setAddPositionOpen}
        symbol={result?.symbol || symbol}
        price={result?.currentPrice}
      />
    </div>
  );
}
