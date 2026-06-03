'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Brain,
  Play,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Shield,
  BarChart3,
  Target,
  Clock,
  AlertTriangle,
  Lightbulb,
  Landmark,
  Coins,
  Activity,
  Gauge,
  RefreshCw,
  CheckCircle2,
  Circle,
  CalendarClock,
  Search,
  Save,
  Wallet,
  TrendingUp,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n';

// ─── ETF Definitions ─────────────────────────────────────────────────────────
interface ETFInfo {
  code: string;
  name: string;
  trackingIndex: string;
  category: string;
  fundSize: string;
  peRange: string;
  exchange: string; // SH or SZ
}

const ETF_LIST: ETFInfo[] = [
  { code: '159338', name: '中证白酒ETF', trackingIndex: '中证白酒指数', category: '消费', fundSize: '约700亿', peRange: '25-45', exchange: 'SZ' },
  { code: '511880', name: '华宝添益', trackingIndex: '银行间质押式回购利率', category: '货币', fundSize: '约2000亿', peRange: 'N/A', exchange: 'SH' },
  { code: '513300', name: '纳斯达克100ETF', trackingIndex: '纳斯达克100指数', category: '海外科技', fundSize: '约300亿', peRange: '20-35', exchange: 'SH' },
  { code: '513500', name: '标普500ETF', trackingIndex: '标普500指数', category: '海外宽基', fundSize: '约100亿', peRange: '18-28', exchange: 'SH' },
  { code: '518880', name: '黄金ETF', trackingIndex: '上海金Au99.99', category: '商品', fundSize: '约280亿', peRange: 'N/A', exchange: 'SH' },
  { code: '588000', name: '科创板50ETF', trackingIndex: '科创50指数', category: '科技', fundSize: '约400亿', peRange: '30-60', exchange: 'SH' },
];

// ─── Analysis Mode ───────────────────────────────────────────────────────────
type AnalysisMode = 'dcaTiming' | 'positionAssessment' | 'allocationAdvice';

interface ModeConfig {
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  apiMode: string;
  steps: string[];
  stepsEn: string[];
}

const MODE_CONFIG: Record<AnalysisMode, ModeConfig> = {
  dcaTiming: {
    label: '定投时机分析',
    labelEn: 'DCA Timing',
    description: '现在适合开始/继续定投吗？',
    descriptionEn: 'Is this a good time to start/continue DCA?',
    icon: CalendarClock,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-600/15',
    borderColor: 'border-emerald-600/20',
    apiMode: 'dcaTiming',
    steps: ['评估市场环境', '分析估值水平', '检查技术信号', '定投时机研判', '生成定投建议'],
    stepsEn: ['Evaluating market', 'Valuation analysis', 'Technical signals', 'DCA timing assessment', 'Generating advice'],
  },
  positionAssessment: {
    label: '持仓评估',
    labelEn: 'Position Assessment',
    description: '我的持仓健康度如何？',
    descriptionEn: 'How is my position health?',
    icon: Shield,
    color: 'text-amber-400',
    bgColor: 'bg-amber-600/15',
    borderColor: 'border-amber-600/20',
    apiMode: 'positionAssessment',
    steps: ['评估持仓状态', '超买超卖分析', '再平衡需求', '风险评估', '生成持仓建议'],
    stepsEn: ['Position status', 'Overbought/oversold', 'Rebalancing needs', 'Risk assessment', 'Generating advice'],
  },
  allocationAdvice: {
    label: '长期配置建议',
    labelEn: 'Allocation Advice',
    description: '长期资产配置建议',
    descriptionEn: 'Long-term portfolio allocation',
    icon: Landmark,
    color: 'text-teal-400',
    bgColor: 'bg-teal-600/15',
    borderColor: 'border-teal-600/20',
    apiMode: 'allocationAdvice',
    steps: ['评估长期价值', '行业分散化分析', '风险管理评估', '配置比例建议', '生成配置方案'],
    stepsEn: ['Long-term value', 'Sector diversification', 'Risk management', 'Allocation ratio', 'Generating plan'],
  },
};

// ─── Analysis Result ─────────────────────────────────────────────────────────
interface AnalysisResult {
  score: number;
  recommendation: 'BUY' | 'HOLD' | 'SELL';
  recommendationLabel: string;
  keyFactors: string[];
  timingAssessment: string;
  riskWarning: string;
  actionAdvice: string;
  detailReport: string;
  provider: string;
  tokens: number;
  etfCode: string;
  mode: AnalysisMode;
  timestamp: string;
}

// ─── Position & DCA Data ─────────────────────────────────────────────────────
interface PositionData {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

interface DCAData {
  symbol: string;
  name: string;
  amountPerPeriod: number;
  period: string;
  nextDate: string | null;
  isActive: boolean;
}

// ─── ETF Overview Data ───────────────────────────────────────────────────────
interface ETFOverview {
  code: string;
  name: string;
  currentPrice: number | null;
  changePercent: number | null;
  week52High: number | null;
  week52Low: number | null;
  positionInRange: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getScoreColor(score: number): string {
  if (score > 60) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreStrokeColor(score: number): string {
  if (score > 60) return '#10b981'; // emerald-500
  if (score >= 40) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

function getScoreBgColor(score: number): string {
  if (score > 60) return 'bg-emerald-600/15';
  if (score >= 40) return 'bg-amber-600/15';
  return 'bg-red-600/15';
}

function getScoreBorderColor(score: number): string {
  if (score > 60) return 'border-emerald-600/30';
  if (score >= 40) return 'border-amber-600/30';
  return 'border-red-600/30';
}

function getRecommendationLabel(rec: string, isZh: boolean): string {
  switch (rec) {
    case 'BUY': return isZh ? '适合定投/加仓' : 'Good for DCA/Add';
    case 'SELL': return isZh ? '考虑减仓' : 'Consider Reducing';
    default: return isZh ? '持有/正常定投' : 'Hold/Normal DCA';
  }
}

function getRecommendationBadgeClass(rec: string): string {
  switch (rec) {
    case 'BUY': return 'bg-emerald-600/15 text-emerald-400 border-emerald-600/30';
    case 'SELL': return 'bg-red-600/15 text-red-400 border-red-600/30';
    default: return 'bg-amber-600/15 text-amber-400 border-amber-600/30';
  }
}

function parseAnalysisResult(
  raw: string,
  etfCode: string,
  mode: AnalysisMode,
  provider: string,
  tokens: number,
  isZh: boolean
): AnalysisResult {
  const fallback: AnalysisResult = {
    score: 50,
    recommendation: 'HOLD',
    recommendationLabel: isZh ? '持有/正常定投' : 'Hold/Normal DCA',
    keyFactors: [isZh ? '数据不足，请稍后重试' : 'Insufficient data, please retry'],
    timingAssessment: raw.slice(0, 200),
    riskWarning: isZh ? 'AI分析结果解析异常，建议谨慎参考' : 'AI analysis parsing error, use with caution',
    actionAdvice: isZh ? '建议结合个人判断进行操作' : 'Consider your own judgment',
    detailReport: raw,
    provider,
    tokens,
    etfCode,
    mode,
    timestamp: new Date().toISOString(),
  };

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50;
    const rec = ['BUY', 'HOLD', 'SELL'].includes(parsed.recommendation) ? parsed.recommendation : 'HOLD';

    return {
      score,
      recommendation: rec,
      recommendationLabel: getRecommendationLabel(rec, isZh),
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.slice(0, 5) : [isZh ? '暂无关键因素' : 'No key factors'],
      timingAssessment: typeof parsed.timingAssessment === 'string' ? parsed.timingAssessment : '',
      riskWarning: typeof parsed.riskWarning === 'string' ? parsed.riskWarning : '',
      actionAdvice: typeof parsed.actionAdvice === 'string' ? parsed.actionAdvice : '',
      detailReport: typeof parsed.detailReport === 'string' ? parsed.detailReport : raw,
      provider,
      tokens,
      etfCode,
      mode,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

// ─── Score Circle SVG ────────────────────────────────────────────────────────
function ScoreCircle({ score, size = 100 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreStrokeColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e1e2e"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-[10px] text-zinc-500">/100</span>
      </div>
    </div>
  );
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function MarkdownText({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mb-3">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-emerald-400 mt-4 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-white mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith('- ')) return <li key={i} className="text-xs text-zinc-300 ml-4 leading-relaxed">{line.slice(2)}</li>;
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-xs text-white font-semibold mt-1">{line.slice(2, -2)}</p>;
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-xs text-zinc-300 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export function AIInsightsView({ initialSymbol }: { initialSymbol?: string }) {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';

  // State
  const [selectedETF, setSelectedETF] = useState<string>(initialSymbol || '518880');
  const [mode, setMode] = useState<AnalysisMode>('dcaTiming');
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar data
  const [etfOverview, setEtfOverview] = useState<ETFOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [positionData, setPositionData] = useState<PositionData | null>(null);
  const [dcaData, setDcaData] = useState<DCAData | null>(null);

  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Find current ETF info
  const currentETF = ETF_LIST.find((e) => e.code === selectedETF) || ETF_LIST[4];

  // Sync initialSymbol
  useEffect(() => {
    if (initialSymbol) setSelectedETF(initialSymbol);
  }, [initialSymbol]);

  // Fetch ETF overview when selection changes
  useEffect(() => {
    const fetchOverview = async () => {
      setOverviewLoading(true);
      try {
        const res = await fetch(`/api/fusion/market/quote?symbol=${encodeURIComponent(selectedETF)}`);
        if (res.ok) {
          const data = await res.json();
          const currentPrice = data.currentPrice || data.c || null;
          const changePercent = data.changePercent ?? data.dp ?? null;
          // Estimate 52-week range from available data
          const high = data.high || null;
          const low = data.low || null;
          let positionInRange: number | null = null;
          if (currentPrice && high && low && high > low) {
            positionInRange = Math.round(((currentPrice - low) / (high - low)) * 100);
          }
          setEtfOverview({
            code: selectedETF,
            name: currentETF.name,
            currentPrice,
            changePercent,
            week52High: high,
            week52Low: low,
            positionInRange,
          });
        }
      } catch {
        // Keep existing overview
      } finally {
        setOverviewLoading(false);
      }
    };
    fetchOverview();
  }, [selectedETF, currentETF.name]);

  // Fetch position & DCA data
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        // Fetch positions
        const posRes = await fetch('/api/portfolio/positions');
        if (posRes.ok) {
          const posData = await posRes.json();
          const positions = Array.isArray(posData) ? posData : posData.positions || [];
          const found = positions.find((p: { symbol: string }) => p.symbol === selectedETF);
          if (found) {
            setPositionData({
              symbol: found.symbol,
              quantity: found.quantity || 0,
              avgCost: found.avgCost || 0,
              currentPrice: found.currentPrice || 0,
              unrealizedPnl: found.unrealizedPnl || 0,
              unrealizedPnlPercent: found.avgCost > 0 ? ((found.currentPrice - found.avgCost) / found.avgCost) * 100 : 0,
            });
          } else {
            setPositionData(null);
          }
        }
      } catch {
        setPositionData(null);
      }

      try {
        // Fetch DCA plans
        const dcaRes = await fetch('/api/dca/plans');
        if (dcaRes.ok) {
          const dcaPlans = await dcaRes.json();
          const plans = Array.isArray(dcaPlans) ? dcaPlans : [];
          const found = plans.find((p: { symbol: string }) => p.symbol === selectedETF);
          if (found) {
            setDcaData({
              symbol: found.symbol,
              name: found.name,
              amountPerPeriod: found.amountPerPeriod || 0,
              period: found.period || 'weekly',
              nextDate: found.nextDate || null,
              isActive: found.isActive ?? true,
            });
          } else {
            setDcaData(null);
          }
        }
      } catch {
        setDcaData(null);
      }
    };
    fetchSidebarData();
  }, [selectedETF]);

  // Filter ETFs by search
  const filteredETFs = searchQuery.trim()
    ? ETF_LIST.filter(
        (e) =>
          e.code.includes(searchQuery) ||
          e.name.includes(searchQuery) ||
          e.trackingIndex.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ETF_LIST;

  // Start analysis
  const handleStartAnalysis = useCallback(async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setResult(null);
    setShowDetail(false);
    setCurrentStep(0);

    const modeCfg = MODE_CONFIG[mode];
    const steps = isZh ? modeCfg.steps : modeCfg.stepsEn;

    // Animate steps
    let stepIdx = 0;
    stepTimerRef.current = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setCurrentStep(stepIdx);
      } else {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      }
    }, 1500);

    const symbolWithSuffix = `${selectedETF}.${currentETF.exchange}`;

    try {
      // Primary: fusion analysis API
      const res = await fetch('/api/fusion/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbolWithSuffix,
          market: 'A',
          mode: modeCfg.apiMode,
          agents: ['fundamental', 'technical', 'sentiment', 'risk'],
        }),
      });

      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setCurrentStep(steps.length - 1);

      if (res.ok) {
        const data = await res.json();

        // Map fusion analysis result to our format
        const score = typeof data.score === 'number' ? Math.max(0, Math.min(100, data.score)) : 50;
        const rec = ['BUY', 'HOLD', 'SELL'].includes(data.recommendation) ? data.recommendation : 'HOLD';

        const analysisResult: AnalysisResult = {
          score,
          recommendation: rec,
          recommendationLabel: getRecommendationLabel(rec, isZh),
          keyFactors: data.keyFactors
            ? (Array.isArray(data.keyFactors) ? data.keyFactors.slice(0, 5) : [String(data.keyFactors)])
            : [
                data.technicalSummary?.slice(0, 50) || (isZh ? '技术面分析完成' : 'Technical analysis done'),
                data.fundamentalSummary?.slice(0, 50) || (isZh ? '基本面分析完成' : 'Fundamental analysis done'),
                data.sentimentSummary?.slice(0, 50) || (isZh ? '情绪面分析完成' : 'Sentiment analysis done'),
              ].filter(Boolean),
          timingAssessment: data.technicalSummary || data.timingAssessment || '',
          riskWarning: data.riskLevel
            ? `${isZh ? '风险等级' : 'Risk Level'}: ${data.riskLevel}${data.riskScore ? ` (${data.riskScore}/100)` : ''}`
            : (data.riskWarning || ''),
          actionAdvice: data.fundamentalSummary || data.actionAdvice || '',
          detailReport: data.report || data.detailReport || JSON.stringify(data, null, 2),
          provider: data.provider || 'fusion',
          tokens: data.tokens || data.tokenUsage || 0,
          etfCode: selectedETF,
          mode,
          timestamp: new Date().toISOString(),
        };

        setResult(analysisResult);
      } else {
        // Fallback to sentiment API
        throw new Error('Fusion analysis failed');
      }
    } catch {
      // Fallback to sentiment API
      try {
        const sentimentRes = await fetch(
          `/api/ai/sentiment?symbol=${encodeURIComponent(symbolWithSuffix)}&name=${encodeURIComponent(currentETF.name)}`
        );

        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        setCurrentStep(steps.length - 1);

        if (sentimentRes.ok) {
          const sData = await sentimentRes.json();
          const score = typeof sData.score === 'number' ? Math.max(0, Math.min(100, sData.score)) : 50;
          const rec = score > 60 ? 'BUY' : score < 40 ? 'SELL' : 'HOLD';

          setResult({
            score,
            recommendation: rec,
            recommendationLabel: getRecommendationLabel(rec, isZh),
            keyFactors: Array.isArray(sData.factors) ? sData.factors.slice(0, 5) : [isZh ? '基础分析完成' : 'Basic analysis done'],
            timingAssessment: sData.shortTermOutlook || sData.summary || '',
            riskWarning: sData.riskLevel
              ? `${isZh ? '风险等级' : 'Risk Level'}: ${sData.riskLevel}`
              : (isZh ? '请关注市场波动风险' : 'Monitor market volatility risk'),
            actionAdvice: sData.summary || '',
            detailReport: [
              `# ${currentETF.name} (${currentETF.code})`,
              '',
              `## ${isZh ? '情绪分析' : 'Sentiment Analysis'}`,
              `- ${isZh ? '评分' : 'Score'}: ${score}/100`,
              `- ${isZh ? '标签' : 'Label'}: ${sData.label || 'N/A'}`,
              `- ${isZh ? '风险等级' : 'Risk Level'}: ${sData.riskLevel || 'N/A'}`,
              '',
              `## ${isZh ? '简要分析' : 'Summary'}`,
              sData.summary || (isZh ? '暂无详细分析' : 'No detailed analysis available'),
            ].join('\n'),
            provider: sData.provider || 'sentiment-fallback',
            tokens: 0,
            etfCode: selectedETF,
            mode,
            timestamp: new Date().toISOString(),
          });
        } else {
          setResult({
            score: 0,
            recommendation: 'HOLD',
            recommendationLabel: isZh ? '持有/正常定投' : 'Hold/Normal DCA',
            keyFactors: [isZh ? '分析请求失败，请稍后重试' : 'Analysis request failed, please retry'],
            timingAssessment: isZh ? 'AI服务暂不可用' : 'AI service unavailable',
            riskWarning: isZh ? '无法获取分析结果' : 'Unable to get analysis results',
            actionAdvice: isZh ? '请检查网络连接和AI服务配置' : 'Check network and AI service config',
            detailReport: isZh ? '分析请求失败，请稍后重试。' : 'Analysis request failed, please retry later.',
            provider: 'error',
            tokens: 0,
            etfCode: selectedETF,
            mode,
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        setResult({
          score: 0,
          recommendation: 'HOLD',
          recommendationLabel: isZh ? '持有/正常定投' : 'Hold/Normal DCA',
          keyFactors: [isZh ? '网络错误' : 'Network error'],
          timingAssessment: isZh ? '无法连接AI服务' : 'Cannot connect to AI service',
          riskWarning: isZh ? '请检查网络连接' : 'Check your network connection',
          actionAdvice: isZh ? '请稍后重试' : 'Please retry later',
          detailReport: isZh ? '网络错误，请稍后重试。' : 'Network error, please retry later.',
          provider: 'error',
          tokens: 0,
          etfCode: selectedETF,
          mode,
          timestamp: new Date().toISOString(),
        });
      }
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, mode, currentETF, selectedETF, isZh]);

  // Save report
  const handleSaveReport = useCallback(async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      await fetch('/api/fusion/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: `${selectedETF}.${currentETF.exchange}`,
          market: 'A',
          mode: MODE_CONFIG[result.mode].apiMode,
          saveReport: true,
          reportData: {
            score: result.score,
            recommendation: result.recommendation,
            keyFactors: result.keyFactors,
            timingAssessment: result.timingAssessment,
            riskWarning: result.riskWarning,
            actionAdvice: result.actionAdvice,
            detailReport: result.detailReport,
          },
        }),
      });
    } catch {
      // Silently handle save failure
    } finally {
      setSaving(false);
    }
  }, [result, saving, selectedETF, currentETF.exchange]);

  // Clear analysis
  const handleReset = useCallback(() => {
    setResult(null);
    setShowDetail(false);
    setCurrentStep(0);
  }, []);

  // Format DCA period
  const formatPeriod = (period: string) => {
    switch (period) {
      case 'weekly': return isZh ? '每周' : 'Weekly';
      case 'biweekly': return isZh ? '每两周' : 'Bi-weekly';
      case 'monthly': return isZh ? '每月' : 'Monthly';
      default: return period;
    }
  };

  return (
    <div className="space-y-4">
      {/* ── ETF Quick Select Bar ──────────────────────────────────────── */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">
              {isZh ? '选择ETF基金' : 'Select ETF Fund'}
            </span>
          </div>

          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder={isZh ? '搜索ETF代码或名称...' : 'Search ETF code or name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#0a0a0f] border-[#1e1e2e] text-white placeholder:text-zinc-600 h-9 text-sm"
            />
          </div>

          {/* ETF Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {filteredETFs.map((etf) => {
              const isSelected = selectedETF === etf.code;
              return (
                <button
                  key={etf.code}
                  onClick={() => { setSelectedETF(etf.code); setResult(null); }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border text-left ${
                    isSelected
                      ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                      : 'bg-[#0a0a0f] text-zinc-400 border-[#1e1e2e] hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  <span className="font-bold block">{etf.code}</span>
                  <span className="text-[10px] opacity-80 block mt-0.5 truncate">{etf.name}</span>
                </button>
              );
            })}
          </div>

          {filteredETFs.length === 0 && (
            <div className="text-center py-4 text-sm text-zinc-500">
              {isZh ? '未找到匹配的ETF' : 'No matching ETF found'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Main Content Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Analysis Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* ── Analysis Mode Selection ──────────────────────────────── */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-white">
                  {isZh ? '分析模式' : 'Analysis Mode'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.entries(MODE_CONFIG) as [AnalysisMode, ModeConfig][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isActive = mode === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { setMode(key); setResult(null); }}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                        isActive
                          ? `${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`
                          : 'bg-[#0a0a0f] border-[#1e1e2e] text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <div className="text-left">
                        <div className="text-sm font-semibold">{isZh ? cfg.label : cfg.labelEn}</div>
                        <div className="text-[10px] opacity-70">
                          {isZh ? cfg.description : cfg.descriptionEn}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Start Button */}
              <div className="flex items-center gap-3 mt-4">
                <Button
                  onClick={handleStartAnalysis}
                  disabled={analyzing}
                  className={`bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[160px] ${
                    analyzing ? 'opacity-80' : ''
                  }`}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isZh ? '分析中...' : 'Analyzing...'}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      {isZh ? '开始分析' : 'Start Analysis'}
                    </>
                  )}
                </Button>
                {result && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-400 hover:text-white hover:bg-[#1a1a2e] gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isZh ? '重新分析' : 'Reset'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Animated Progress ────────────────────────────────────── */}
          {analyzing && (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-sm font-medium text-white">
                    {isZh
                      ? `正在分析 ${currentETF.name} - ${MODE_CONFIG[mode].label}`
                      : `Analyzing ${currentETF.name} - ${MODE_CONFIG[mode].labelEn}`}
                  </span>
                </div>
                <div className="space-y-2">
                  {(isZh ? MODE_CONFIG[mode].steps : MODE_CONFIG[mode].stepsEn).map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        idx < currentStep ? 'bg-emerald-600/15' :
                        idx === currentStep ? 'bg-yellow-600/15' :
                        'bg-zinc-700/15'
                      }`}>
                        {idx < currentStep ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : idx === currentStep ? (
                          <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </div>
                      <span className={`text-xs ${
                        idx < currentStep ? 'text-emerald-400' :
                        idx === currentStep ? 'text-yellow-400' :
                        'text-zinc-500'
                      }`}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                <Progress
                  value={((currentStep + 1) / MODE_CONFIG[mode].steps.length) * 100}
                  className="h-1.5 bg-[#1e1e2e] mt-3 [&>div]:bg-emerald-500"
                />
              </CardContent>
            </Card>
          )}

          {/* ── Analysis Results ─────────────────────────────────────── */}
          {result && !analyzing && (
            <>
              {/* Score & Recommendation Card */}
              <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-6 flex-wrap">
                    {/* Score Circle */}
                    <ScoreCircle score={result.score} size={100} />

                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-2xl font-bold text-white">{currentETF.name}</h3>
                        <span className="text-sm text-zinc-500">{currentETF.code}</span>
                        <Badge className={`${MODE_CONFIG[mode].bgColor} ${MODE_CONFIG[mode].color} ${MODE_CONFIG[mode].borderColor} border text-xs`}>
                          {isZh ? MODE_CONFIG[mode].label : MODE_CONFIG[mode].labelEn}
                        </Badge>
                      </div>

                      {/* Recommendation Badge */}
                      <div className="mb-3">
                        <Badge className={`${getRecommendationBadgeClass(result.recommendation)} border text-sm px-3 py-1`}>
                          {result.recommendationLabel}
                        </Badge>
                      </div>

                      {/* Provider info */}
                      {result.provider && result.provider !== 'error' && (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                          <Gauge className="w-3 h-3" />
                          <span>AI: {result.provider}</span>
                          {result.tokens > 0 && <span>· {result.tokens} tokens</span>}
                          <span>· {new Date(result.timestamp).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Structured Results Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Key Factors */}
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-emerald-400" />
                      <CardTitle className="text-sm font-semibold text-white">
                        {isZh ? '关键因素' : 'Key Factors'}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.keyFactors.map((factor, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-600/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-emerald-400">{idx + 1}</span>
                          </div>
                          <span className="text-xs text-zinc-300 leading-relaxed">{factor}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Timing / Assessment */}
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <CardTitle className="text-sm font-semibold text-white">
                        {mode === 'dcaTiming'
                          ? (isZh ? '定投时机判断' : 'DCA Timing Assessment')
                          : mode === 'positionAssessment'
                          ? (isZh ? '持仓状态评估' : 'Position Status')
                          : (isZh ? '配置时机判断' : 'Allocation Timing')}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-300 leading-relaxed">{result.timingAssessment || (isZh ? '暂无' : 'N/A')}</p>
                  </CardContent>
                </Card>

                {/* Risk Warning */}
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <CardTitle className="text-sm font-semibold text-white">
                        {isZh ? '风险提示' : 'Risk Warning'}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-300 leading-relaxed">{result.riskWarning || (isZh ? '暂无' : 'N/A')}</p>
                  </CardContent>
                </Card>

                {/* Action Advice */}
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-400" />
                      <CardTitle className="text-sm font-semibold text-white">
                        {isZh ? '投资建议' : 'Investment Advice'}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-300 leading-relaxed">{result.actionAdvice || (isZh ? '暂无' : 'N/A')}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Report (Collapsible) */}
              <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                <CardHeader className="pb-3">
                  <button
                    className="flex items-center justify-between w-full"
                    onClick={() => setShowDetail(!showDetail)}
                  >
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      <CardTitle className="text-sm font-semibold text-white">
                        {isZh ? '详细分析报告' : 'Detailed Report'}
                      </CardTitle>
                    </div>
                    {showDetail ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                </CardHeader>
                {showDetail && (
                  <CardContent>
                    <MarkdownText content={result.detailReport} />
                  </CardContent>
                )}
              </Card>

              {/* Save Report Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveReport}
                  disabled={saving}
                  className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-400 hover:text-white hover:bg-[#1a1a2e] gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {isZh ? '保存报告' : 'Save Report'}
                </Button>
              </div>
            </>
          )}

          {/* Empty state */}
          {!result && !analyzing && (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-600/10 flex items-center justify-center mb-4">
                    <Brain className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {isZh ? 'AI ETF 长期投资分析' : 'AI ETF Long-term Investment Analysis'}
                  </h3>
                  <p className="text-sm text-zinc-400 text-center max-w-md mb-4">
                    {isZh
                      ? '选择ETF基金和分析模式，点击"开始分析"获取AI驱动的定投时机、持仓评估和长期配置建议'
                      : 'Select an ETF and analysis mode, then click "Start Analysis" to get AI-driven DCA timing, position assessment, and allocation advice'}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge className="bg-emerald-600/10 text-emerald-400 border-emerald-600/20 text-[10px]">
                      <CalendarClock className="w-3 h-3 mr-1" />
                      {isZh ? '定投时机' : 'DCA Timing'}
                    </Badge>
                    <Badge className="bg-amber-600/10 text-amber-400 border-amber-600/20 text-[10px]">
                      <Shield className="w-3 h-3 mr-1" />
                      {isZh ? '持仓评估' : 'Position'}
                    </Badge>
                    <Badge className="bg-teal-600/10 text-teal-400 border-teal-600/20 text-[10px]">
                      <Landmark className="w-3 h-3 mr-1" />
                      {isZh ? '长期配置' : 'Allocation'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right Sidebar (hidden on mobile) ──────────────────────── */}
        <div className="hidden lg:block space-y-4">
          {/* ETF Info Card */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-sm font-semibold text-white">
                    {isZh ? 'ETF 信息' : 'ETF Info'}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOverviewLoading(true);
                    const code = selectedETF;
                    setSelectedETF('');
                    setTimeout(() => setSelectedETF(code), 50);
                  }}
                  disabled={overviewLoading}
                  className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                >
                  <RefreshCw className={`w-3 h-3 ${overviewLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* ETF Name & Code */}
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{currentETF.name}</span>
                  <Badge className="bg-zinc-700/30 text-zinc-300 border-zinc-600/30 text-[10px]">
                    {currentETF.code}
                  </Badge>
                </div>

                {/* Current Price */}
                {etfOverview?.currentPrice != null && etfOverview.currentPrice > 0 ? (
                  <div>
                    <span className="text-2xl font-bold text-white">
                      ¥{etfOverview.currentPrice.toFixed(3)}
                    </span>
                    {etfOverview.changePercent != null && (
                      <span className={`ml-2 text-sm font-medium ${
                        etfOverview.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {etfOverview.changePercent >= 0 ? '+' : ''}{etfOverview.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">
                    {overviewLoading ? (isZh ? '加载中...' : 'Loading...') : (isZh ? '暂无实时报价' : 'No live quote')}
                  </div>
                )}

                <Separator className="bg-[#1e1e2e]" />

                {/* 52-Week Range */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-500">{isZh ? '52周范围' : '52-Week Range'}</span>
                    {etfOverview?.positionInRange != null && (
                      <span className="text-[10px] text-zinc-400">
                        {isZh ? '当前位置' : 'Position'}: {etfOverview.positionInRange}%
                      </span>
                    )}
                  </div>
                  {etfOverview?.week52Low != null && etfOverview?.week52High != null && etfOverview.week52High > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                        <span>¥{etfOverview.week52Low.toFixed(3)}</span>
                        <span>¥{etfOverview.week52High.toFixed(3)}</span>
                      </div>
                      <div className="relative h-1.5 bg-[#1e1e2e] rounded-full">
                        <div
                          className="absolute top-0 h-1.5 rounded-full bg-emerald-500/60"
                          style={{ width: `${etfOverview.positionInRange ?? 50}%` }}
                        />
                        {etfOverview?.currentPrice != null && etfOverview.positionInRange != null && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#111118]"
                            style={{ left: `calc(${etfOverview.positionInRange}% - 5px)` }}
                          />
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-zinc-600">{isZh ? '暂无区间数据' : 'No range data'}</p>
                  )}
                </div>

                <Separator className="bg-[#1e1e2e]" />

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                    <span className="text-[10px] text-zinc-500">{isZh ? '跟踪指数' : 'Index'}</span>
                    <p className="text-xs font-medium text-emerald-400 truncate">{currentETF.trackingIndex}</p>
                  </div>
                  <div className="p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                    <span className="text-[10px] text-zinc-500">{isZh ? '基金规模' : 'Fund Size'}</span>
                    <p className="text-xs font-medium text-zinc-300">{currentETF.fundSize}</p>
                  </div>
                  <div className="p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                    <span className="text-[10px] text-zinc-500">{isZh ? '市盈率区间' : 'P/E Range'}</span>
                    <p className="text-xs font-medium text-zinc-300">{currentETF.peRange}</p>
                  </div>
                  <div className="p-2 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                    <span className="text-[10px] text-zinc-500">{isZh ? '类型' : 'Category'}</span>
                    <p className="text-xs font-medium text-zinc-300">{currentETF.category}</p>
                  </div>
                </div>

                <Separator className="bg-[#1e1e2e]" />

                {/* My Position */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-white">
                      {isZh ? '我的持仓' : 'My Position'}
                    </span>
                  </div>
                  {positionData && positionData.quantity > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">{isZh ? '持有份额' : 'Shares'}</span>
                        <span className="text-zinc-300">{positionData.quantity}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">{isZh ? '平均成本' : 'Avg Cost'}</span>
                        <span className="text-zinc-300">¥{positionData.avgCost.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">{isZh ? '当前盈亏' : 'P&L'}</span>
                        <span className={positionData.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {positionData.unrealizedPnl >= 0 ? '+' : ''}¥{positionData.unrealizedPnl.toFixed(2)}
                          <span className="ml-1 text-[10px]">
                            ({positionData.unrealizedPnlPercent >= 0 ? '+' : ''}{positionData.unrealizedPnlPercent.toFixed(2)}%)
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                      <Info className="w-3 h-3" />
                      <span>{isZh ? '暂无持仓' : 'No position held'}</span>
                    </div>
                  )}
                </div>

                <Separator className="bg-[#1e1e2e]" />

                {/* DCA Plan */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-white">
                      {isZh ? '定投计划' : 'DCA Plan'}
                    </span>
                  </div>
                  {dcaData && dcaData.isActive ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">{isZh ? '定投金额' : 'DCA Amount'}</span>
                        <span className="text-zinc-300">¥{dcaData.amountPerPeriod.toFixed(0)}/{formatPeriod(dcaData.period)}</span>
                      </div>
                      {dcaData.nextDate && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-zinc-500">{isZh ? '下次定投' : 'Next DCA'}</span>
                          <span className="text-emerald-400">
                            {new Date(dcaData.nextDate).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                      <Info className="w-3 h-3" />
                      <span>{isZh ? '暂无定投计划' : 'No DCA plan active'}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
