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

// --- Mock data generators for offline mode ---

const aShareStocks: Record<string, string> = {
  '600519': '贵州茅台', '000858': '五粮液', '601318': '中国平安',
  '300750': '宁德时代', '600036': '招商银行', '000333': '美的集团',
  '601012': '隆基绿能', '600900': '长江电力', '000001': '平安银行',
  '601398': '工商银行', '600276': '恒瑞医药', '002475': '立讯精密',
};

const usStocks: Record<string, string> = {
  'AAPL': '苹果', 'NVDA': '英伟达', 'TSLA': '特斯拉',
  'MSFT': '微软', 'GOOGL': '谷歌', 'AMZN': '亚马逊',
  'META': 'Meta', 'JPM': '摩根大通', 'V': 'Visa',
};

const hkStocks: Record<string, string> = {
  '00700': '腾讯控股', '09988': '阿里巴巴', '03690': '美团',
  '09618': '京东集团', '01810': '小米集团', '02318': '中国平安',
};

function generateMockAnalysis(symbol: string, mode: AnalysisMode, lang: 'en' | 'zh'): AnalysisResult {
  const score = Math.floor(Math.random() * 40) + 40; // 40-79
  const recommendation: 'BUY' | 'HOLD' | 'SELL' = score >= 65 ? 'BUY' : score >= 45 ? 'HOLD' : 'SELL';
  const riskScore = Math.floor(Math.random() * 50) + 15;
  const riskLevel = riskScore < 30 ? 'LOW' : riskScore < 55 ? 'MEDIUM' : 'HIGH';
  const tokens = Math.floor(Math.random() * 3000) + 1500;
  const cost = +(tokens * 0.000008).toFixed(3);

  // Detect market
  const cleanSymbol = symbol.replace(/^(SH|SZ|HK)/i, '');
  const stockName = aShareStocks[cleanSymbol] || usStocks[symbol] || hkStocks[cleanSymbol] || symbol;
  const isAShare = symbol.match(/^(SH|SZ)\d+$/i) || aShareStocks[cleanSymbol];
  const isHK = symbol.match(/^HK\d+$/i) || hkStocks[cleanSymbol];

  const rsi = (50 + Math.random() * 25).toFixed(1);
  const ma5 = isAShare ? (1500 + Math.random() * 500).toFixed(2) : (150 + Math.random() * 100).toFixed(2);
  const supportLevel = isAShare ? (1700 + Math.random() * 200).toFixed(0) : (140 + Math.random() * 30).toFixed(2);
  const resistLevel = isAShare ? (1900 + Math.random() * 200).toFixed(0) : (190 + Math.random() * 30).toFixed(2);

  if (lang === 'zh') {
    const technicalSummary = `${stockName}(${symbol})当前运行于5日均线上方，短期趋势偏强。RSI(14)为${rsi}，处于中性偏多区域。MACD红柱持续放大，DIF线在DEA线上方，确认多头动能。5日均线 ¥${ma5} 构成短线支撑，下方关键支撑 ¥${supportLevel}，上方阻力 ¥${resistLevel}。成交量温和放大，量价配合良好。`;

    const peRatio = (15 + Math.random() * 30).toFixed(1);
    const revenueGrowth = (5 + Math.random() * 20).toFixed(1);
    const fundamentalSummary = `${stockName}最新财报显示营收同比增长${revenueGrowth}%，利润端表现稳健。市盈率${peRatio}倍，处于行业${parseFloat(peRatio) > 25 ? '偏高' : '合理'}水平。${isAShare ? '经营性现金流充裕，分红率稳定，具备防御价值。' : '核心业务竞争力突出，市场份额持续提升。'}毛利率保持稳定，费用管控良好。`;

    const analystBuyPct = Math.floor(55 + Math.random() * 30);
    const sentimentSummary = `市场情绪整体偏正面。${analystBuyPct}%的分析师给出买入/增持评级。近期新闻覆盖以正面为主，${isAShare ? '政策面持续释放利好信号，北向资金净流入趋势延续。' : '行业景气度回升，市场对盈利前景持乐观预期。'}社交媒体讨论热度上升，散户情绪指标从中性转向积极。`;

    const bullCase = recommendation === 'BUY'
      ? `核心业务增长强劲，行业景气周期延续。估值相对合理，存在上行空间。${isAShare ? '政策催化叠加资金面改善，有望迎来估值修复行情。' : '技术面多头排列，动能指标确认趋势。'}中长线配置价值突出。`
      : `当前估值处于历史低位区间，安全边际较高。若宏观环境改善，存在估值修复空间。建议关注催化剂出现后的布局机会。`;

    const bearCase = recommendation === 'SELL'
      ? `${isAShare ? '行业监管不确定性增加，' : '竞争加剧导致市场份额承压，'}盈利增长预期下调。技术面破位下行，短期卖压明显。建议暂时规避，等待风险释放。`
      : `宏观经济下行风险可能拖累业绩，${isAShare ? '地缘政治因素' : '利率环境变化'}带来不确定性。短期波动加剧，需关注关键支撑位得失。`;

    const report = `# ${stockName}(${symbol}) 综合分析报告

## 执行摘要
${stockName}(${symbol}) 综合评分 **${score}/100**，投资建议为 **${recommendation === 'BUY' ? '买入' : recommendation === 'SELL' ? '卖出' : '持有'}**。${recommendation === 'BUY' ? '多个维度共振偏多，中长期配置价值突出。' : recommendation === 'SELL' ? '风险收益比不佳，建议谨慎应对。' : '多空因素交织，建议观望为主。'}

## 技术分析
- **趋势判断**: ${score >= 60 ? '短期趋势向上，均线多头排列' : '趋势不明朗，震荡格局'}
- **动量指标**: RSI(14) = ${rsi}，${parseFloat(rsi) > 65 ? '接近超买区域' : '中性偏多区域'}
- **MACD**: ${parseFloat(rsi) > 55 ? '红柱扩大，多头动能增强' : '绿柱收敛，空头动能减弱'}
- **关键位**: 支撑 ¥${supportLevel} / 阻力 ¥${resistLevel}

## 基本面分析
- **营收增速**: ${revenueGrowth}% YoY
- **估值水平**: PE ${peRatio}x
- **盈利质量**: ${parseFloat(peRatio) < 25 ? '盈利质量优秀' : '需关注盈利持续性'}

## 情绪分析
- **分析师共识**: ${analystBuyPct}% 买入评级
- **新闻情绪**: 偏正面
- **资金流向**: ${isAShare ? '北向资金' : '主力资金'}${Math.random() > 0.4 ? '净流入' : '净流出'}

## 风险评估
- **风险等级**: ${riskLevel === 'LOW' ? '低' : riskLevel === 'HIGH' ? '高' : '中'} (评分: ${riskScore}/100)
- **主要风险**: ${isAShare ? '政策变动、行业竞争、宏观经济' : '市场波动、行业周期、竞争格局'}

## 总结
${recommendation === 'BUY' ? '综合技术面、基本面及情绪面分析，当前具备较好的风险收益比，建议逢低布局。' : recommendation === 'SELL' ? '多个信号偏空，建议减仓或规避，等待更好的入场时机。' : '多空因素相对均衡，建议持有观望，关注关键位突破方向。'}`;

    return {
      symbol,
      recommendation,
      score,
      technicalSummary,
      fundamentalSummary,
      sentimentSummary,
      riskLevel,
      riskScore,
      bullCase: mode === 'debate' ? bullCase : undefined,
      bearCase: mode === 'debate' ? bearCase : undefined,
      report,
      provider: 'mock-deepseek',
      tokens,
      cost,
    };
  }

  // 中文 mock（英文回退也使用中文）
  const technicalSummary = `${stockName}(${symbol})当前运行于5日均线上方，短期趋势偏强。RSI(14)为${rsi}，处于中性偏多区域。MACD红柱持续放大，DIF线在DEA线上方，确认多头动能。5日均线 ¥${ma5} 构成短线支撑，下方关键支撑 ¥${supportLevel}，上方阻力 ¥${resistLevel}。成交量温和放大，量价配合良好。`;

  const peRatio = (15 + Math.random() * 30).toFixed(1);
  const revenueGrowth = (5 + Math.random() * 20).toFixed(1);
  const fundamentalSummary = `${stockName}最新财报显示营收同比增长${revenueGrowth}%，利润端表现稳健。市盈率${peRatio}倍，处于行业${parseFloat(peRatio) > 25 ? '偏高' : '合理'}水平。${isAShare ? '经营性现金流充裕，分红率稳定，具备防御价值。' : '核心业务竞争力突出，市场份额持续提升。'}毛利率保持稳定，费用管控良好。`;

  const analystBuyPct = Math.floor(55 + Math.random() * 30);
  const sentimentSummary = `市场情绪整体偏正面。${analystBuyPct}%的分析师给出买入/增持评级。近期新闻覆盖以正面为主，${isAShare ? '政策面持续释放利好信号，北向资金净流入趋势延续。' : '行业景气度回升，市场对盈利前景持乐观预期。'}社交媒体讨论热度上升，散户情绪指标从中性转向积极。`;

  const bullCase = recommendation === 'BUY'
    ? `核心业务增长强劲，行业景气周期延续。估值相对合理，存在上行空间。${isAShare ? '政策催化叠加资金面改善，有望迎来估值修复行情。' : '技术面多头排列，动能指标确认趋势。'}中长线配置价值突出。`
    : `当前估值处于历史低位区间，安全边际较高。若宏观环境改善，存在估值修复空间。建议关注催化剂出现后的布局机会。`;

  const bearCase = recommendation === 'SELL'
    ? `${isAShare ? '行业监管不确定性增加，' : '竞争加剧导致市场份额承压，'}盈利增长预期下调。技术面破位下行，短期卖压明显。建议暂时规避，等待风险释放。`
    : `宏观经济下行风险可能拖累业绩，${isAShare ? '地缘政治因素' : '利率环境变化'}带来不确定性。短期波动加剧，需关注关键支撑位得失。`;

  const report = `# ${stockName}(${symbol}) 综合分析报告

## 执行摘要
${stockName}(${symbol}) 综合评分 **${score}/100**，投资建议为 **${recommendation === 'BUY' ? '买入' : recommendation === 'SELL' ? '卖出' : '持有'}**。${recommendation === 'BUY' ? '多个维度共振偏多，中长期配置价值突出。' : recommendation === 'SELL' ? '风险收益比不佳，建议谨慎应对。' : '多空因素交织，建议观望为主。'}

## 技术分析
- **趋势判断**: ${score >= 60 ? '短期趋势向上，均线多头排列' : '趋势不明朗，震荡格局'}
- **动量指标**: RSI(14) = ${rsi}，${parseFloat(rsi) > 65 ? '接近超买区域' : '中性偏多区域'}
- **MACD**: ${parseFloat(rsi) > 55 ? '红柱扩大，多头动能增强' : '绿柱收敛，空头动能减弱'}
- **关键位**: 支撑 ¥${supportLevel} / 阻力 ¥${resistLevel}

## 基本面分析
- **营收增速**: ${revenueGrowth}% YoY
- **估值水平**: PE ${peRatio}x
- **盈利质量**: ${parseFloat(peRatio) < 25 ? '盈利质量优秀' : '需关注盈利持续性'}

## 情绪分析
- **分析师共识**: ${analystBuyPct}% 买入评级
- **新闻情绪**: 偏正面
- **资金流向**: ${isAShare ? '北向资金' : '主力资金'}${Math.random() > 0.4 ? '净流入' : '净流出'}

## 风险评估
- **风险等级**: ${riskLevel === 'LOW' ? '低' : riskLevel === 'HIGH' ? '高' : '中'} (评分: ${riskScore}/100)
- **主要风险**: ${isAShare ? '政策变动、行业竞争、宏观经济' : '市场波动、行业周期、竞争格局'}

## 总结
${recommendation === 'BUY' ? '综合技术面、基本面及情绪面分析，当前具备较好的风险收益比，建议逢低布局。' : recommendation === 'SELL' ? '多个信号偏空，建议减仓或规避，等待更好的入场时机。' : '多空因素相对均衡，建议持有观望，关注关键位突破方向。'}`;

  return {
    symbol,
    recommendation,
    score,
    technicalSummary,
    fundamentalSummary,
    sentimentSummary,
    riskLevel,
    riskScore,
    bullCase: mode === 'debate' ? bullCase : undefined,
    bearCase: mode === 'debate' ? bearCase : undefined,
    report,
    provider: 'mock-deepseek',
    tokens,
    cost,
  };
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

  const runMockAnalysis = useCallback(async (sym: string, analysisMode: AnalysisMode) => {
    const modeAgents = modeConfig[analysisMode].agents;
    const initialAgents: AgentState[] = modeAgents.map((id) => ({
      id,
      nameKey: agentInfo[id].nameKey,
      status: 'pending' as AgentStatus,
      icon: agentInfo[id].icon,
    }));
    setAgents(initialAgents);
    setIsOfflineMode(true);

    // Simulate agent progression
    for (let i = 0; i < modeAgents.length; i++) {
      if (abortRef.current) return;
      setAgents((prev) =>
        prev.map((a, idx) => idx === i ? { ...a, status: 'running' } : a)
      );
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));
      if (abortRef.current) return;
      setAgents((prev) =>
        prev.map((a, idx) => idx === i ? { ...a, status: 'done' } : a)
      );
    }

    const mockResult = generateMockAnalysis(sym, analysisMode, language);
    setResult(mockResult);

    // Add to history
    const historyItem: HistoryItem = {
      id: Date.now().toString(),
      symbol: sym,
      mode: analysisMode,
      recommendation: mockResult.recommendation,
      score: mockResult.score,
      timestamp: new Date().toISOString(),
    };
    setHistory((prev) => [historyItem, ...prev].slice(0, 10));
  }, [language]);

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

    // Start by calling the API
    let taskId: string | null = null;
    try {
      const res = await fetch('/api/fusion/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, mode: analysisMode }),
      });

      if (!res.ok) {
        // API returned error, fall back to mock
        await runMockAnalysis(sym, analysisMode);
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
      // API unreachable, fall back to mock
      await runMockAnalysis(sym, analysisMode);
      return;
    }

    if (!taskId) {
      await runMockAnalysis(sym, analysisMode);
      return;
    }

    // Poll for results
    let pollCount = 0;
    const maxPolls = 60; // 60 * 2s = 2 min max
    const pollInterval = 2000;

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
          const runningAgentIdx = Math.min(
            Math.floor((progress / 100) * modeAgents.length),
            modeAgents.length - 1
          );
          setAgents((prev) =>
            prev.map((a, idx) => ({
              ...a,
              status: idx < runningAgentIdx ? 'done' : idx === runningAgentIdx ? 'running' : 'pending',
            }) as AgentState)
          );
        }

        if (taskStatus === 'completed' || taskStatus === 'done') {
          // All agents done
          setAgents((prev) => prev.map((a) => ({ ...a, status: 'done' as AgentStatus })));

          const analysisResult = pollData?.data?.result || pollData?.result;
          if (analysisResult) {
            // Map the real API result to our AnalysisResult interface
            const mapped: AnalysisResult = {
              symbol: sym,
              recommendation: analysisResult.recommendation || analysisResult.recommend || 'HOLD',
              score: analysisResult.score || 50,
              technicalSummary: analysisResult.technical_summary || analysisResult.technicalSummary || '',
              fundamentalSummary: analysisResult.fundamental_summary || analysisResult.fundamentalSummary || '',
              sentimentSummary: analysisResult.sentiment_summary || analysisResult.sentimentSummary || '',
              riskLevel: analysisResult.risk_level || analysisResult.riskLevel || 'MEDIUM',
              riskScore: analysisResult.risk_score || analysisResult.riskScore || 50,
              bullCase: analysisResult.bull_case || analysisResult.bullCase,
              bearCase: analysisResult.bear_case || analysisResult.bearCase,
              report: analysisResult.report || analysisResult.full_report || '',
              provider: analysisResult.provider || 'deepseek',
              tokens: analysisResult.tokens || 0,
              cost: analysisResult.cost || 0,
            };
            setResult(mapped);

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
          // Task failed, fall back to mock
          await runMockAnalysis(sym, analysisMode);
          return;
        }
      } catch {
        // Polling error, continue trying
      }
    }

    // Timeout - fall back to mock
    await runMockAnalysis(sym, analysisMode);
  }, [runMockAnalysis]);

  const handleStartAnalysis = useCallback(async () => {
    if (!symbol.trim()) return;
    abortRef.current = false;
    setAnalyzing(true);
    setResult(null);
    setShowReport(false);

    // Try real API first, fallback to mock
    await runRealAnalysis(symbol.toUpperCase(), mode);

    setAnalyzing(false);
  }, [symbol, mode, runRealAnalysis]);

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
