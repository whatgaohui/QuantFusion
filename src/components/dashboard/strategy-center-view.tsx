'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Search,
  Plus,
  Star,
  Play,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  Eye,
  ArrowRight,
  X,
  Loader2,
  Wifi,
  WifiOff,
  Database,
  Brain,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';

type StrategyType = 'trend' | 'reversal' | 'momentum' | 'volatility' | 'volume' | 'pattern';

interface Strategy {
  id: string;
  name: string;
  nameKey: string;
  type: StrategyType;
  rating: number;
  description: string;
  descriptionKey: string;
  parameters: { name: string; default: string; description: string }[];
  entryConditions: string[];
  exitConditions: string[];
  source?: 'ai' | 'built-in' | 'custom';
}

const typeConfig: Record<StrategyType, { labelKey: string; color: string; icon: React.ElementType }> = {
  trend: { labelKey: 'strat.typeTrend', color: 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20', icon: TrendingUp },
  reversal: { labelKey: 'strat.typeReversal', color: 'bg-red-600/15 text-red-400 border-red-600/20', icon: TrendingDown },
  momentum: { labelKey: 'strat.typeMomentum', color: 'bg-purple-600/15 text-purple-400 border-purple-600/20', icon: Activity },
  volatility: { labelKey: 'strat.typeVolatility', color: 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20', icon: Zap },
  volume: { labelKey: 'strat.typeVolume', color: 'bg-cyan-600/15 text-cyan-400 border-cyan-600/20', icon: BarChart3 },
  pattern: { labelKey: 'strat.typePattern', color: 'bg-orange-600/15 text-orange-400 border-orange-600/20', icon: Eye },
};

const builtInStrategies: Strategy[] = [
  {
    id: 'ma-golden-cross',
    name: '均线金叉',
    nameKey: '均线金叉',
    type: 'trend',
    rating: 4.2,
    description: '短期均线上穿长期均线时买入',
    descriptionKey: '短期均线上穿长期均线，表明上行动能转变，为买入信号。',
    parameters: [
      { name: '短周期', default: '5', description: '短期均线周期' },
      { name: '长周期', default: '20', description: '长期均线周期' },
    ],
    entryConditions: ['MA5上穿MA20', '成交量大于20日均量'],
    exitConditions: ['MA5下穿MA20', '止损-5%'],
    source: 'built-in',
  },
  {
    id: 'rsi-divergence',
    name: 'RSI背离',
    nameKey: 'RSI背离',
    type: 'reversal',
    rating: 3.8,
    description: '检测RSI背离捕捉反转信号',
    descriptionKey: '识别价格与RSI指标之间的多头/空头背离，提前捕捉趋势反转。',
    parameters: [
      { name: 'RSI周期', default: '14', description: 'RSI计算周期' },
      { name: '回溯K线数', default: '5', description: '背离回溯K线数量' },
    ],
    entryConditions: ['价格创新低但RSI未创新低（看涨背离）', 'RSI < 30区域优先'],
    exitConditions: ['RSI达到超买区(>70)', '目标收益+8%'],
    source: 'built-in',
  },
  {
    id: 'macd-momentum',
    name: 'MACD动量',
    nameKey: 'MACD动量',
    type: 'momentum',
    rating: 4.0,
    description: 'MACD金叉配合柱状图确认',
    descriptionKey: '在MACD线交叉时结合柱状图方向和零线位置进行确认交易。',
    parameters: [
      { name: '快线周期', default: '12', description: '快线EMA周期' },
      { name: '慢线周期', default: '26', description: '慢线EMA周期' },
      { name: '信号线周期', default: '9', description: '信号线周期' },
    ],
    entryConditions: ['MACD线上穿信号线', '柱状图转为正值'],
    exitConditions: ['MACD线下穿信号线', '柱状图连续3根缩短'],
    source: 'built-in',
  },
  {
    id: 'bollinger-breakout',
    name: '布林带突破',
    nameKey: '布林带突破',
    type: 'volatility',
    rating: 3.5,
    description: '价格突破布林带',
    descriptionKey: '当价格突破布林带时入场，表示波动率扩张和潜在新趋势。',
    parameters: [
      { name: '周期', default: '20', description: '布林带周期' },
      { name: '标准差', default: '2', description: '标准差倍数' },
    ],
    entryConditions: ['收盘价突破上轨', '成交量飙升至1.5倍均量以上'],
    exitConditions: ['价格回到布林带内', '移动止损3%'],
    source: 'built-in',
  },
  {
    id: 'kdj-golden-cross',
    name: 'KDJ金叉',
    nameKey: 'KDJ金叉',
    type: 'momentum',
    rating: 3.6,
    description: 'KDJ指标金叉买入',
    descriptionKey: '在超卖区K线上穿D线时入场，结合J线方向判断。',
    parameters: [
      { name: 'K周期', default: '9', description: 'K线周期' },
      { name: 'D周期', default: '3', description: 'D线平滑周期' },
    ],
    entryConditions: ['K线在20以下上穿D线', 'J线拐头向上'],
    exitConditions: ['K线在80以上下穿D线', '止损-4%'],
    source: 'built-in',
  },
  {
    id: 'volume-breakout',
    name: '放量突破',
    nameKey: '放量突破',
    type: 'volume',
    rating: 3.9,
    description: '高成交量确认突破',
    descriptionKey: '识别由显著高于均量的成交量确认的突破走势，表明市场参与者信心强烈。',
    parameters: [
      { name: '量比阈值', default: '2.0', description: '成交量比率阈值' },
      { name: '价格变动%', default: '3', description: '最低价格变动百分比' },
    ],
    entryConditions: ['成交量大于20日均量2倍', '价格变动超过3%'],
    exitConditions: ['成交量萎缩至均量以下', '价格无法守住突破位'],
    source: 'built-in',
  },
  {
    id: 'low-volume-pullback',
    name: '缩量回踩',
    nameKey: '缩量回踩',
    type: 'volume',
    rating: 3.7,
    description: '缩量回调时买入',
    descriptionKey: '在上升趋势中，价格缩量回调时买入，表明是暂时性弱势而非趋势改变。',
    parameters: [
      { name: '回调%', default: '5', description: '从高点回调百分比' },
      { name: '缩量阈值', default: '0.7', description: '低于此量比表示缩量回调' },
    ],
    entryConditions: ['价格处于上升趋势(站上MA20)', '缩量回调3-7%(量比 < 0.7倍均量)'],
    exitConditions: ['价格创出新高', '反弹时成交量放大'],
    source: 'built-in',
  },
  {
    id: 'three-white-soldiers',
    name: '三白兵',
    nameKey: '三白兵',
    type: 'pattern',
    rating: 3.3,
    description: '经典看涨K线形态',
    descriptionKey: '识别三白兵形态——三根连续阳线且收盘价逐步抬高。',
    parameters: [
      { name: '最小实体比', default: '0.6', description: '最小实体与总振幅的比率' },
    ],
    entryConditions: ['三根连续阳线', '每根收盘价高于前一根', '实体占K线总振幅>60%'],
    exitConditions: ['出现看跌吞没形态', '止损设于最低K线低点'],
    source: 'built-in',
  },
  {
    id: 'ma-death-cross',
    name: '均线死叉做空',
    nameKey: '均线死叉做空',
    type: 'reversal',
    rating: 3.4,
    description: '均线死叉时做空',
    descriptionKey: '短期均线下穿长期均线时做空，表明下行趋势形成。',
    parameters: [
      { name: '短周期', default: '5', description: '短期均线周期' },
      { name: '长周期', default: '20', description: '长期均线周期' },
    ],
    entryConditions: ['MA5下穿MA20', '成交量确认抛压'],
    exitConditions: ['MA5重新上穿MA10', '获利目标+7%'],
    source: 'built-in',
  },
  {
    id: 'double-bottom',
    name: '双底形态',
    nameKey: '双底形态',
    type: 'pattern',
    rating: 3.8,
    description: 'W形反转形态',
    descriptionKey: '检测双底反转形态，配合颈线突破确认。',
    parameters: [
      { name: '最小间距', default: '10', description: '两个底部之间的最小K线数' },
      { name: '容差%', default: '2', description: '两个底部价格的容差百分比' },
    ],
    entryConditions: ['两个底部处于相近价格水平', '颈线突破伴随放量'],
    exitConditions: ['价格达到形态高度的2倍', '止损设于第二个底部下方'],
    source: 'built-in',
  },
  {
    id: 'atr-volatility',
    name: 'ATR波动率收缩',
    nameKey: 'ATR波动率收缩',
    type: 'volatility',
    rating: 3.6,
    description: '交易ATR收缩后的突破',
    descriptionKey: '使用ATR识别低波动率时期，然后交易突破方向。',
    parameters: [
      { name: 'ATR周期', default: '14', description: 'ATR计算周期' },
      { name: '收缩阈值', default: '0.5', description: 'ATR比率收缩阈值' },
    ],
    entryConditions: ['ATR低于收缩阈值', '价格突破近期区间'],
    exitConditions: ['ATR扩张至阈值以上', '基于ATR的移动止损'],
    source: 'built-in',
  },
  {
    id: 'rsi-overbought-oversold',
    name: 'RSI均值回归',
    nameKey: 'RSI均值回归',
    type: 'reversal',
    rating: 3.5,
    description: '交易RSI极端回归',
    descriptionKey: 'RSI超卖时买入、超买时卖出，预期价格回归均值。',
    parameters: [
      { name: 'RSI周期', default: '14', description: 'RSI计算周期' },
      { name: '超卖线', default: '25', description: '超卖阈值' },
      { name: '超买线', default: '75', description: '超买阈值' },
    ],
    entryConditions: ['RSI上穿超卖线(买入)', 'RSI下穿超买线(卖出)'],
    exitConditions: ['RSI达到50(中轴线)', '极端位置紧止损'],
    source: 'built-in',
  },
  {
    id: 'macd-divergence',
    name: 'MACD背离',
    nameKey: 'MACD背离',
    type: 'reversal',
    rating: 3.9,
    description: 'MACD背离反转信号',
    descriptionKey: '检测价格与MACD之间的背离，识别潜在的趋势反转。',
    parameters: [
      { name: '快线周期', default: '12', description: '快线EMA周期' },
      { name: '慢线周期', default: '26', description: '慢线EMA周期' },
    ],
    entryConditions: ['价格创新高但MACD未创新高(看跌背离)', '价格创新低但MACD未创新低(看涨背离)'],
    exitConditions: ['MACD确认新方向', '止损设于背离极值之外'],
    source: 'built-in',
  },
  {
    id: 'volume-profile',
    name: '成交量分布支撑',
    nameKey: '成交量分布支撑',
    type: 'volume',
    rating: 3.7,
    description: '在高成交量节点交易',
    descriptionKey: '使用成交量分布识别高成交量价格节点作为支撑/阻力位。',
    parameters: [
      { name: '回溯周期', default: '30', description: '分析成交量分布的天数' },
      { name: '节点阈值', default: '1.5', description: '显著节点的成交量比率' },
    ],
    entryConditions: ['价格回踩至高成交量节点', '节点成交量 > 1.5倍均量'],
    exitConditions: ['价格移动至下一个成交量节点', '止损设于节点下方1个ATR'],
    source: 'built-in',
  },
  {
    id: 'channel-breakout',
    name: '通道突破',
    nameKey: '通道突破',
    type: 'trend',
    rating: 4.1,
    description: '价格通道突破',
    descriptionKey: '使用线性回归识别价格通道，交易通道边界的突破。',
    parameters: [
      { name: '通道周期', default: '20', description: '通道计算周期' },
      { name: '通道宽度', default: '2', description: '标准差宽度' },
    ],
    entryConditions: ['价格突破上通道线', '收盘价需在通道外'],
    exitConditions: ['价格回到通道内', '通道方向反转'],
    source: 'built-in',
  },
];

interface StrategyCenterViewProps {
  onBacktest?: (strategyId: string) => void;
}

export function StrategyCenterView({ onBacktest }: StrategyCenterViewProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [customStrategies, setCustomStrategies] = useState<Strategy[]>([]);
  const [strategySource, setStrategySource] = useState<'ai' | 'built-in' | 'loading'>('loading');
  const [aiStrategies, setAiStrategies] = useState<Strategy[]>([]);
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    type: 'trend' as StrategyType,
    entryRule: '',
    exitRule: '',
  });

  // Try fetching strategies from AI service on mount
  useEffect(() => {
    const fetchAiStrategies = async () => {
      try {
        const res = await fetch('/api/fusion/strategies');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Map AI strategies to our format
            const mapped: Strategy[] = data.map((s: Record<string, unknown>, i: number) => ({
              id: s.id || `ai-${i}`,
              name: s.name || `AI Strategy ${i + 1}`,
              nameKey: s.name || `AI Strategy ${i + 1}`,
              type: (s.type as StrategyType) || 'trend',
              rating: (s.rating as number) || 3.5,
              description: (s.description as string) || '',
              descriptionKey: (s.description as string) || '',
              parameters: Array.isArray(s.parameters) ? s.parameters : [],
              entryConditions: Array.isArray(s.entryConditions) ? s.entryConditions : [],
              exitConditions: Array.isArray(s.exitConditions) ? s.exitConditions : [],
              source: 'ai' as const,
            }));
            setAiStrategies(mapped);
            setStrategySource('ai');
            return;
          }
        }
        setStrategySource('built-in');
      } catch {
        setStrategySource('built-in');
      }
    };
    fetchAiStrategies();
  }, []);

  // Combine strategies: AI + built-in + custom
  const allStrategies = strategySource === 'ai'
    ? [...aiStrategies, ...builtInStrategies.map(s => ({ ...s, source: 'built-in' as const })), ...customStrategies]
    : [...builtInStrategies.map(s => ({ ...s, source: 'built-in' as const })), ...customStrategies];

  const filteredStrategies = allStrategies.filter((s) => {
    const matchesSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || s.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleCreateStrategy = () => {
    if (!newStrategy.name || !newStrategy.entryRule) return;

    const strategy: Strategy = {
      id: `custom-${Date.now()}`,
      name: newStrategy.name,
      nameKey: newStrategy.name,
      type: newStrategy.type,
      rating: 0,
      description: newStrategy.entryRule,
      descriptionKey: newStrategy.entryRule,
      parameters: [],
      entryConditions: [newStrategy.entryRule],
      exitConditions: [newStrategy.exitRule || '未定义出场规则'],
      source: 'custom',
    };

    setCustomStrategies(prev => [...prev, strategy]);
    setCreateDialogOpen(false);
    setNewStrategy({ name: '', type: 'trend', entryRule: '', exitRule: '' });
  };

  const handleBacktest = (strategyId: string) => {
    if (onBacktest) {
      onBacktest(strategyId);
    }
  };

  const getSourceBadge = (source?: string) => {
    if (source === 'ai') {
      return (
        <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[8px] px-1 py-0">
          <Brain className="w-2.5 h-2.5 mr-0.5" />
          {t('strat.aiGenerated')}
        </Badge>
      );
    }
    if (source === 'custom') {
      return (
        <Badge className="bg-cyan-600/15 text-cyan-400 border-cyan-600/20 text-[8px] px-1 py-0">
          <Plus className="w-2.5 h-2.5 mr-0.5" />
          {t('strat.customCreated')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[8px] px-1 py-0">
        <Database className="w-2.5 h-2.5 mr-0.5" />
        {t('strat.builtInLabel')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder={t('strat.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#111118] border-[#1e1e2e] text-white placeholder:text-zinc-500 focus:border-emerald-600/50"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-36 bg-[#111118] border-[#1e1e2e] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#111118] border-[#1e1e2e]">
            <SelectItem value="all" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">全部类型</SelectItem>
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                {t(cfg.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('strat.customStrategy')}
        </Button>
      </div>

      {/* Source indicator */}
      <div className="flex items-center gap-2">
        <Badge className={`text-[10px] border ${
          strategySource === 'ai'
            ? 'bg-purple-600/15 text-purple-400 border-purple-600/20'
            : strategySource === 'built-in'
            ? 'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
            : 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20'
        }`}>
          {strategySource === 'loading' ? (
            <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{t('common.loading')}</>
          ) : strategySource === 'ai' ? (
            <><Wifi className="w-3 h-3 mr-1" />{t('strat.aiService')}</>
          ) : (
            <><WifiOff className="w-3 h-3 mr-1" />{t('strat.localPresets')}</>
          )}
        </Badge>
        <span className="text-[10px] text-zinc-600">
          {filteredStrategies.length} {strategySource === 'ai' ? t('strat.aiGenerated') : t('strat.builtInLabel').toLowerCase()} + {customStrategies.length} {t('strat.customCreated').toLowerCase()}
        </span>
      </div>

      {/* Strategy Grid */}
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredStrategies.map((strategy) => {
          const cfg = typeConfig[strategy.type];
          const TypeIcon = cfg.icon;
          const isExpanded = expandedStrategy === strategy.id;

          return (
            <Card
              key={strategy.id}
              className={`bg-[#111118] border-[#1e1e2e] rounded-xl transition-all duration-300 hover:border-[#2e2e3e] ${
                isExpanded ? 'sm:col-span-2 lg:col-span-2' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white truncate">{strategy.name}</h3>
                      {getSourceBadge(strategy.source)}
                    </div>
                    <Badge className={`${cfg.color} border text-[9px] mt-1`}>
                      <TypeIcon className="w-2.5 h-2.5 mr-0.5" />
                      {t(cfg.labelKey)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
                    {strategy.rating > 0 && (
                      <>
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-medium text-white">{strategy.rating.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-2">
                  {strategy.description}
                </p>

                {/* Quick Parameters */}
                {strategy.parameters.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {strategy.parameters.map((param) => (
                      <div key={param.name} className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500">{param.name}</span>
                        <span className="text-[10px] font-medium text-zinc-300">{param.default}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}
                    className="h-7 text-xs text-zinc-400 hover:text-white flex-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                    {t('strat.detail')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleBacktest(strategy.id)}
                    className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                  >
                    <Play className="w-3 h-3" />
                    {t('strat.backtest')}
                  </Button>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <>
                    <Separator className="bg-[#1e1e2e] my-3" />
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold text-white mb-1.5">{t('strat.entryConditions')}</h4>
                        <ul className="space-y-1">
                          {strategy.entryConditions.map((cond, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-zinc-300">{cond}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white mb-1.5">{t('strat.exitConditions')}</h4>
                        <ul className="space-y-1">
                          {strategy.exitConditions.map((cond, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <X className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-zinc-300">{cond}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      </div>

      {/* Create Strategy Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e]">
          <DialogHeader>
            <DialogTitle className="text-white">{t('strat.createStrategy')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.strategyName')}</Label>
              <Input
                placeholder="例如，我的自定义策略"
                value={newStrategy.name}
                onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.strategyType')}</Label>
              <Select
                value={newStrategy.type}
                onValueChange={(v) => setNewStrategy({ ...newStrategy, type: v as StrategyType })}
              >
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                      {t(cfg.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.entryRule')}</Label>
              <Textarea
                placeholder="例如，MA5上穿MA20且RSI < 70"
                value={newStrategy.entryRule}
                onChange={(e) => setNewStrategy({ ...newStrategy, entryRule: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.exitRule')}</Label>
              <Textarea
                placeholder="例如，MA5下穿MA10或止损-5%"
                value={newStrategy.exitRule}
                onChange={(e) => setNewStrategy({ ...newStrategy, exitRule: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300"
            >
              {t('pos.cancel')}
            </Button>
            <Button
              onClick={handleCreateStrategy}
              disabled={!newStrategy.name || !newStrategy.entryRule}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {t('strat.saveStrategy')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
