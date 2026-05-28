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
    name: 'MA Golden Cross',
    nameKey: 'MA Golden Cross',
    type: 'trend',
    rating: 4.2,
    description: 'Buy when short-term MA crosses above long-term MA',
    descriptionKey: 'Buy when short-term MA crosses above long-term MA, indicating upward momentum shift.',
    parameters: [
      { name: 'Short Period', default: '5', description: 'Short-term MA period' },
      { name: 'Long Period', default: '20', description: 'Long-term MA period' },
    ],
    entryConditions: ['MA5 crosses above MA20', 'Volume > 20-day average'],
    exitConditions: ['MA5 crosses below MA20', 'Stop loss at -5%'],
    source: 'built-in',
  },
  {
    id: 'rsi-divergence',
    name: 'RSI Divergence',
    nameKey: 'RSI Divergence',
    type: 'reversal',
    rating: 3.8,
    description: 'Detect RSI divergence for reversal signals',
    descriptionKey: 'Identify bullish/bearish divergence between price and RSI indicator to catch trend reversals early.',
    parameters: [
      { name: 'RSI Period', default: '14', description: 'RSI calculation period' },
      { name: 'Divergence Bars', default: '5', description: 'Bars to look back for divergence' },
    ],
    entryConditions: ['Price makes lower low but RSI makes higher low (bullish)', 'RSI < 30 zone preferred'],
    exitConditions: ['RSI reaches overbought (>70)', 'Target profit at +8%'],
    source: 'built-in',
  },
  {
    id: 'macd-momentum',
    name: 'MACD Momentum',
    nameKey: 'MACD Momentum',
    type: 'momentum',
    rating: 4.0,
    description: 'MACD crossover with histogram confirmation',
    descriptionKey: 'Trade MACD line crossovers confirmed by histogram direction and zero-line position.',
    parameters: [
      { name: 'Fast Period', default: '12', description: 'Fast EMA period' },
      { name: 'Slow Period', default: '26', description: 'Slow EMA period' },
      { name: 'Signal Period', default: '9', description: 'Signal line period' },
    ],
    entryConditions: ['MACD line crosses above signal line', 'Histogram turns positive'],
    exitConditions: ['MACD crosses below signal', 'Histogram shrinks for 3 bars'],
    source: 'built-in',
  },
  {
    id: 'bollinger-breakout',
    name: 'Bollinger Breakout',
    nameKey: 'Bollinger Breakout',
    type: 'volatility',
    rating: 3.5,
    description: 'Breakout from Bollinger Bands',
    descriptionKey: 'Enter when price breaks out of Bollinger Bands, indicating a volatility expansion and potential new trend.',
    parameters: [
      { name: 'Period', default: '20', description: 'BB period' },
      { name: 'Std Dev', default: '2', description: 'Standard deviation multiplier' },
    ],
    entryConditions: ['Price closes above upper band', 'Volume spike > 1.5x average'],
    exitConditions: ['Price returns inside bands', 'Trailing stop at 3%'],
    source: 'built-in',
  },
  {
    id: 'kdj-golden-cross',
    name: 'KDJ Golden Cross',
    nameKey: 'KDJ Golden Cross',
    type: 'momentum',
    rating: 3.6,
    description: 'KDJ indicator golden cross entry',
    descriptionKey: 'Enter when K line crosses above D line in oversold zone, combined with J line direction.',
    parameters: [
      { name: 'K Period', default: '9', description: 'K line period' },
      { name: 'D Period', default: '3', description: 'D line smoothing' },
    ],
    entryConditions: ['K crosses above D below 20', 'J line turning up'],
    exitConditions: ['K crosses below D above 80', 'Stop loss at -4%'],
    source: 'built-in',
  },
  {
    id: 'volume-breakout',
    name: 'Volume Breakout',
    nameKey: 'Volume Breakout',
    type: 'volume',
    rating: 3.9,
    description: 'High volume breakout confirmation',
    descriptionKey: 'Identify breakout moves confirmed by significantly above-average volume, indicating strong conviction.',
    parameters: [
      { name: 'Volume Ratio', default: '2.0', description: 'Volume ratio threshold' },
      { name: 'Price Change %', default: '3', description: 'Minimum price change %' },
    ],
    entryConditions: ['Volume > 2x 20-day average', 'Price change > 3%'],
    exitConditions: ['Volume dries up below average', 'Price fails to hold breakout level'],
    source: 'built-in',
  },
  {
    id: 'low-volume-pullback',
    name: 'Low Volume Pullback',
    nameKey: 'Low Volume Pullback',
    type: 'volume',
    rating: 3.7,
    description: 'Buy pullbacks on declining volume',
    descriptionKey: 'In an uptrend, buy when price pulls back on low volume, suggesting temporary weakness not trend change.',
    parameters: [
      { name: 'Pullback %', default: '5', description: 'Pullback percentage from high' },
      { name: 'Volume Threshold', default: '0.7', description: 'Volume ratio below this indicates pullback' },
    ],
    entryConditions: ['Price in uptrend (above MA20)', 'Pullback of 3-7% on low volume (< 0.7x average)'],
    exitConditions: ['Price makes new high', 'Volume increases on bounce'],
    source: 'built-in',
  },
  {
    id: 'three-white-soldiers',
    name: 'Three White Soldiers',
    nameKey: 'Three White Soldiers',
    type: 'pattern',
    rating: 3.3,
    description: 'Classic bullish candlestick pattern',
    descriptionKey: 'Identify the Three White Soldiers pattern - three consecutive bullish candles with progressive closes.',
    parameters: [
      { name: 'Min Body Ratio', default: '0.6', description: 'Minimum body-to-wick ratio' },
    ],
    entryConditions: ['Three consecutive bullish candles', 'Each close higher than previous', 'Bodies make up >60% of range'],
    exitConditions: ['Bearish engulfing pattern', 'Stop below lowest candle low'],
    source: 'built-in',
  },
  {
    id: 'ma-death-cross',
    name: 'MA Death Cross Short',
    nameKey: 'MA Death Cross Short',
    type: 'reversal',
    rating: 3.4,
    description: 'Short on MA death cross',
    descriptionKey: 'Enter short position when short-term MA crosses below long-term MA, signaling downtrend.',
    parameters: [
      { name: 'Short Period', default: '5', description: 'Short-term MA period' },
      { name: 'Long Period', default: '20', description: 'Long-term MA period' },
    ],
    entryConditions: ['MA5 crosses below MA20', 'Volume confirms selling pressure'],
    exitConditions: ['MA5 crosses back above MA10', 'Take profit at +7%'],
    source: 'built-in',
  },
  {
    id: 'double-bottom',
    name: 'Double Bottom',
    nameKey: 'Double Bottom',
    type: 'pattern',
    rating: 3.8,
    description: 'W-shaped reversal pattern',
    descriptionKey: 'Detect double bottom reversal pattern with neckline breakout confirmation.',
    parameters: [
      { name: 'Min Distance', default: '10', description: 'Min distance between bottoms (bars)' },
      { name: 'Tolerance %', default: '2', description: 'Price tolerance for equal bottoms' },
    ],
    entryConditions: ['Two bottoms at similar price level', 'Neckline breakout with volume'],
    exitConditions: ['Price reaches 2x the pattern height', 'Stop below second bottom'],
    source: 'built-in',
  },
  {
    id: 'atr-volatility',
    name: 'ATR Volatility Squeeze',
    nameKey: 'ATR Volatility Squeeze',
    type: 'volatility',
    rating: 3.6,
    description: 'Trade ATR squeeze breakouts',
    descriptionKey: 'Identify low-volatility periods using ATR, then trade the breakout direction.',
    parameters: [
      { name: 'ATR Period', default: '14', description: 'ATR calculation period' },
      { name: 'Squeeze Threshold', default: '0.5', description: 'ATR ratio threshold for squeeze' },
    ],
    entryConditions: ['ATR below squeeze threshold', 'Price breaks out of recent range'],
    exitConditions: ['ATR expands above threshold', 'Trailing stop based on ATR'],
    source: 'built-in',
  },
  {
    id: 'rsi-overbought-oversold',
    name: 'RSI Mean Reversion',
    nameKey: 'RSI Mean Reversion',
    type: 'reversal',
    rating: 3.5,
    description: 'Trade RSI extreme reversions',
    descriptionKey: 'Buy when RSI is oversold and selling when overbought, expecting mean reversion.',
    parameters: [
      { name: 'RSI Period', default: '14', description: 'RSI calculation period' },
      { name: 'Oversold Level', default: '25', description: 'Oversold threshold' },
      { name: 'Overbought Level', default: '75', description: 'Overbought threshold' },
    ],
    entryConditions: ['RSI crosses above oversold level (buy)', 'RSI crosses below overbought level (sell)'],
    exitConditions: ['RSI reaches 50 (midline)', 'Tight stop at extreme level'],
    source: 'built-in',
  },
  {
    id: 'macd-divergence',
    name: 'MACD Divergence',
    nameKey: 'MACD Divergence',
    type: 'reversal',
    rating: 3.9,
    description: 'MACD divergence reversal signals',
    descriptionKey: 'Detect divergence between price and MACD to identify potential trend reversals.',
    parameters: [
      { name: 'Fast Period', default: '12', description: 'Fast EMA period' },
      { name: 'Slow Period', default: '26', description: 'Slow EMA period' },
    ],
    entryConditions: ['Price makes new high but MACD doesn\'t (bearish div)', 'Price makes new low but MACD doesn\'t (bullish div)'],
    exitConditions: ['MACD confirms new direction', 'Stop beyond divergence extreme'],
    source: 'built-in',
  },
  {
    id: 'volume-profile',
    name: 'Volume Profile Support',
    nameKey: 'Volume Profile Support',
    type: 'volume',
    rating: 3.7,
    description: 'Trade at high volume nodes',
    descriptionKey: 'Use volume profile to identify high-volume price nodes as support/resistance levels.',
    parameters: [
      { name: 'Lookback Period', default: '30', description: 'Days to analyze volume profile' },
      { name: 'Node Threshold', default: '1.5', description: 'Volume ratio for significant nodes' },
    ],
    entryConditions: ['Price pulls back to high volume node', 'Volume at node > 1.5x average'],
    exitConditions: ['Price moves to next volume node', 'Stop below node by 1 ATR'],
    source: 'built-in',
  },
  {
    id: 'channel-breakout',
    name: 'Channel Breakout',
    nameKey: 'Channel Breakout',
    type: 'trend',
    rating: 4.1,
    description: 'Breakout from price channels',
    descriptionKey: 'Identify price channels using linear regression and trade breakouts from the channel boundaries.',
    parameters: [
      { name: 'Channel Period', default: '20', description: 'Period for channel calculation' },
      { name: 'Channel Width', default: '2', description: 'Standard deviation width' },
    ],
    entryConditions: ['Price breaks above upper channel line', 'Close above channel required'],
    exitConditions: ['Price returns inside channel', 'Channel direction reverses'],
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
      exitConditions: [newStrategy.exitRule || 'No exit rule defined'],
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
            <SelectItem value="all" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">All Types</SelectItem>
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
                placeholder="e.g., My Custom Strategy"
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
                placeholder="e.g., MA5 crosses above MA20 and RSI < 70"
                value={newStrategy.entryRule}
                onChange={(e) => setNewStrategy({ ...newStrategy, entryRule: e.target.value })}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('strat.exitRule')}</Label>
              <Textarea
                placeholder="e.g., MA5 crosses below MA10 or stop loss at -5%"
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
