'use client';

import { useState, useRef, useCallback } from 'react';
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

export function AIAnalysisView() {
  const { t } = useLanguage();
  const [symbol, setSymbol] = useState('');
  const [mode, setMode] = useState<AnalysisMode>('standard');
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchResults, setSearchResults] = useState<{ symbol: string; description: string }[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

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

    // Simulate agent progression
    for (let i = 0; i < modeAgents.length; i++) {
      setAgents((prev) =>
        prev.map((a, idx) => idx === i ? { ...a, status: 'running' } : a)
      );
      await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 800));
      setAgents((prev) =>
        prev.map((a, idx) => idx === i ? { ...a, status: 'done' } : a)
      );
    }

    // Try real API, fallback to mock
    try {
      const res = await fetch('/api/fusion/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), mode }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        setResult({ ...mockResult, symbol: symbol.toUpperCase() });
      }
    } catch {
      setResult({ ...mockResult, symbol: symbol.toUpperCase() });
    }

    setAnalyzing(false);
  }, [symbol, mode]);

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
                        </div>
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

          {/* Right: Agent Progress + LLM Usage */}
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
                {mockHistory.length}
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
            <div className="space-y-2">
              {mockHistory.map((item) => (
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
    </div>
  );
}
