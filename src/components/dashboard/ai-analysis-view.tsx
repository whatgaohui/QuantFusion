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
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
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
  isMock?: boolean;
  errorMessage?: string;
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

export function AIAnalysisView() {
  const { t, language } = useLanguage();
  const [symbol, setSymbol] = useState('');
  const [mode, setMode] = useState<AnalysisMode>('standard');
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchResults, setSearchResults] = useState<{ symbol: string; description: string }[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<boolean>(false);

  const handleSearch = (query: string) => {
    setSymbol(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.data?.symbol) {
            setSearchResults([{ symbol: data.data.symbol, description: data.data.name || data.data.symbol }]);
          } else {
            setSearchResults([]);
          }
        }
      } catch {
        setSearchResults([]);
      }
    }, 300);
  };

  const runRealAnalysis = useCallback(async (sym: string, analysisMode: AnalysisMode) => {
    const modeAgents = modeConfig[analysisMode].agents;
    const initialAgents: AgentState[] = modeAgents.map((id) => ({
      id,
      nameKey: agentInfo[id].nameKey,
      status: 'pending' as AgentStatus,
      icon: agentInfo[id].icon,
    }));
    setAgents(initialAgents);
    setIsOfflineMode(false);
    setErrorMessage(null);

    // Start by calling the API
    let taskId: string | null = null;
    try {
      const res = await fetch('/api/fusion/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, mode: analysisMode }),
      });

      if (!res.ok) {
        // API returned error - set error state, no mock fallback
        setErrorMessage('AI服务暂时不可用，请稍后重试');
        return;
      }

      const data = await res.json();
      taskId = data?.data?.task_id || data?.task_id || null;
      
      // Check if the new API returns completed analysis directly (no polling needed)
      const directStatus = data?.data?.status;
      const directAnalysis = data?.data?.analysis;
      if (directStatus === 'completed' && directAnalysis) {
        // AI returned analysis immediately - display it
        setAgents((prev) => prev.map((a) => ({ ...a, status: 'done' as AgentStatus })));
        
        const source = data?.data?.source || 'ai';
        const mapped: AnalysisResult = {
          symbol: sym,
          recommendation: directAnalysis.recommendation || 'HOLD',
          score: directAnalysis.score || 50,
          technicalSummary: directAnalysis.technical || '',
          fundamentalSummary: directAnalysis.fundamental || '',
          sentimentSummary: directAnalysis.sentiment || '',
          riskLevel: directAnalysis.confidence === 'high' ? 'LOW' : directAnalysis.confidence === 'low' ? 'HIGH' : 'MEDIUM',
          riskScore: 100 - (directAnalysis.score || 50),
          bullCase: directAnalysis.bullCase,
          bearCase: directAnalysis.bearCase,
          report: directAnalysis.summary || '',
          provider: source === 'ai' ? 'z-ai' : 'mock',
          tokens: 0,
          cost: 0,
          isMock: source === 'mock',
        };
        setResult(mapped);
        setIsOffline(source === 'mock');

        const historyItem: HistoryItem = {
          id: Date.now().toString(),
          symbol: sym,
          mode: analysisMode,
          recommendation: mapped.recommendation,
          score: mapped.score,
          timestamp: new Date().toISOString(),
        };
        setHistory((prev) => [historyItem, ...prev].slice(0, 10));
        return;
      }
    } catch {
      // API unreachable - set error state, no mock fallback
      setErrorMessage('AI服务连接失败，请检查网络后重试');
      return;
    }

    if (!taskId) {
      setErrorMessage('分析任务创建失败，请稍后重试');
      return;
    }

    // Poll for results - adjust max polls based on mode
    const modeTimeouts: Record<AnalysisMode, number> = { quick: 30, standard: 60, full: 90, debate: 150 };
    const maxPolls = modeTimeouts[analysisMode]; // Each poll = 2s
    const pollInterval = 2000;
    let pollCount = 0;

    while (pollCount < maxPolls) {
      if (abortRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      pollCount++;

      try {
        const pollRes = await fetch(`/api/fusion/analysis/${taskId}`);
        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();
        const taskStatus = pollData?.data?.status || pollData?.status;

        // Update agent progress based on task status
        if (taskStatus === 'processing' || taskStatus === 'running') {
          const progress = pollData?.data?.progress || pollData?.progress || 0;
          const currentAgent = pollData?.data?.current_agent || pollData?.data?.current_step || '';
          
          // Find which agent matches the current step
          const runningAgentIdx = Math.min(
            Math.floor((progress / 100) * modeAgents.length),
            modeAgents.length - 1
          );
          
          // Also try to match by agent name
          let matchedIdx = -1;
          if (currentAgent) {
            const agentNameMap: Record<string, string> = {
              '技术分析师': 'technical',
              '基本面分析师': 'fundamental',
              '情绪分析师': 'sentiment',
              '多头研究员': 'bullbear',
              '空头研究员': 'bullbear',
              '研究经理': 'decision',
              '激进风险分析师': 'risk',
              '保守风险分析师': 'risk',
              '中性风险分析师': 'risk',
              '风险管理经理': 'decision',
              '决策引擎': 'decision',
            };
            const matchedId = agentNameMap[currentAgent];
            if (matchedId) {
              matchedIdx = modeAgents.indexOf(matchedId);
              if (matchedIdx === -1) matchedIdx = modeAgents.findIndex(id => id === matchedId);
            }
          }
          
          const activeIdx = matchedIdx >= 0 ? matchedIdx : runningAgentIdx;
          
          setAgents((prev) =>
            prev.map((a, idx) => ({
              ...a,
              status: idx < activeIdx ? 'done' : idx === activeIdx ? 'running' : 'pending',
            }) as AgentState)
          );
        }

        if (taskStatus === 'completed' || taskStatus === 'done') {
          // All agents done
          setAgents((prev) => prev.map((a) => ({ ...a, status: 'done' as AgentStatus })));

          const d = pollData?.data;
          if (d) {
            // Map the multi-agent analysis result to our AnalysisResult interface
            const mapped: AnalysisResult = {
              symbol: sym,
              recommendation: d.recommendation || 'HOLD',
              score: d.score || 50,
              technicalSummary: d.technical_summary || '',
              fundamentalSummary: d.fundamental_summary || '',
              sentimentSummary: d.sentiment_summary || '',
              riskLevel: d.risk_level || 'MEDIUM',
              riskScore: d.risk_score || 50,
              bullCase: d.bull_thesis || '',
              bearCase: d.bear_thesis || '',
              report: d.final_decision || d.investment_plan || d.risk_assessment || '',
              provider: d.source === 'ai-multi-agent' ? 'z-ai-multi-agent' : d.source === 'ai-partial' ? 'z-ai-partial' : 'mock',
              tokens: d.llm_calls ? d.llm_calls * 800 : 0, // Rough estimate
              cost: d.llm_calls ? +(d.llm_calls * 800 * 0.000008).toFixed(3) : 0,
              isMock: false,
            };
            setResult(mapped);
            setIsOffline(false);

            const historyItem: HistoryItem = {
              id: Date.now().toString(),
              symbol: sym,
              mode: analysisMode,
              recommendation: mapped.recommendation,
              score: mapped.score,
              timestamp: new Date().toISOString(),
            };
            setHistory((prev) => [historyItem, ...prev].slice(0, 10));
            return;
          }
        }

        if (taskStatus === 'failed' || taskStatus === 'error') {
          // Task failed - set error state, no mock fallback
          const failReason = pollData?.data?.error || 'AI分析失败，请稍后重试';
          setErrorMessage(failReason);
          return;
        }
      } catch {
        // Polling error, continue trying
      }
    }

    // Timeout - set error state, no mock fallback
    setErrorMessage('AI分析超时，请尝试快速分析模式');
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    if (!symbol.trim()) return;
    abortRef.current = false;
    setAnalyzing(true);
    setResult(null);
    setShowReport(false);
    setErrorMessage(null);

    // Always try real API first
    await runRealAnalysis(symbol.toUpperCase(), mode);

    setAnalyzing(false);
  }, [symbol, mode, runRealAnalysis]);

  const handleRetry = useCallback(() => {
    handleStartAnalysis();
  }, [handleStartAnalysis]);

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

          {/* Mode Description + Offline Indicator */}
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-zinc-500">
              {t(modeConfig[mode].descKey)} — {modeConfig[mode].agents.length} 个智能体
            </p>
            {result && (
              <div className="flex items-center gap-1.5">
                {isOfflineMode ? (
                  <>
                    <WifiOff className="w-3 h-3 text-yellow-500" />
                    <span className="text-[10px] text-yellow-500">{t('ai.offlineMode')}</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-500">{t('ai.realtimeMode')}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error / Warning Banner */}
      {(result?.isMock || errorMessage) && (
        <Card className={`${!result && errorMessage ? 'bg-red-600/5 border-red-600/20' : 'bg-yellow-600/5 border-yellow-600/20'} rounded-xl`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              {!result && errorMessage ? (
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-yellow-500 shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${!result && errorMessage ? 'text-red-400' : 'text-yellow-400'}`}>
                  {!result && errorMessage ? 'AI分析失败' : result?.isMock ? '当前显示模拟分析数据' : 'AI分析异常'}
                </p>
                {errorMessage && (
                  <p className={`text-xs mt-0.5 ${!result ? 'text-red-500/80' : 'text-yellow-500/80'}`}>{errorMessage}</p>
                )}
              </div>
              {!result && errorMessage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={analyzing}
                  className="h-7 gap-1.5 text-xs border-red-600/30 text-red-400 hover:bg-red-600/10 hover:text-red-300"
                >
                  <RefreshCw className="w-3 h-3" />
                  重试
                </Button>
              )}
              {result?.isMock && (
                <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[10px]">
                  演示数据
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Success Banner */}
      {result && !result.isMock && (
        <Card className="bg-emerald-600/5 border-emerald-600/20 rounded-xl">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-400 font-medium">
                AI多智能体分析完成 — 真实分析结果
              </p>
              <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                {result.provider === 'z-ai-multi-agent' ? `${modeConfig[mode].agents.length}智能体协作` : 'AI分析'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results Area */}
      {(analyzing || result || errorMessage) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Error State Card */}
            {!result && errorMessage && !analyzing && (
              <Card className="bg-[#111118] border-red-600/20 rounded-xl">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">AI分析失败</h3>
                  <p className="text-sm text-zinc-400 mb-1">{errorMessage}</p>
                  <p className="text-xs text-zinc-500 mb-6">请检查网络连接或稍后重试，也可以尝试切换到快速分析模式</p>
                  <Button
                    onClick={handleRetry}
                    disabled={analyzing}
                    className="bg-red-600 hover:bg-red-700 text-white gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重试
                  </Button>
                </CardContent>
              </Card>
            )}

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
                            {t('ai.riskLevel')}: {result.riskLevel}
                          </Badge>
                          <span className="text-sm text-zinc-400">{t('ai.riskScore')}: {result.riskScore}/100</span>
                        </div>
                        <Progress value={result.riskScore} className="h-2 bg-[#1e1e2e] mb-4" />
                        <p className="text-sm text-zinc-300 leading-relaxed">
                          {language === 'zh'
                            ? `风险评估显示整体风险等级为${result.riskLevel === 'LOW' ? '低' : result.riskLevel === 'HIGH' ? '高' : '中'}。建议密切关注关键风险因素，合理控制仓位。`
                            : `Risk assessment indicates ${result.riskLevel.toLowerCase()} overall risk profile. Key risk factors should be monitored closely for position sizing decisions.`
                          }
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
      {!analyzing && !result && !errorMessage && (
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
            {history.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">{t('ai.noHistory')}</p>
            ) : (
              <div className="space-y-2">
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
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
