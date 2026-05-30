'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Zap,
  Activity,
  BarChart3,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';

// A股特色数据类型定义
type AShareTab = 'dragonTiger' | 'northbound' | 'margin' | 'limitStocks' | 'stockChanges' | 'chipDist';

interface DragonTigerEntry {
  symbol: string;
  name: string;
  date: string;
  closePrice: number;
  changePercent: number;
  reason: string;
  turnover: number;
  buyAmount: number;
  sellAmount: number;
  netAmount: number;
  departments: { name: string; buyAmount: number; sellAmount: number }[];
  isSimulated?: boolean;
}

interface NorthboundSummary {
  date: string;
  hkToShNet: number;
  hkToSzNet: number;
  totalNet: number;
  hkToShBuy: number;
  hkToShSell: number;
  hkToSzBuy: number;
  hkToSzSell: number;
  totalBuy: number;
  totalSell: number;
  isSimulated?: boolean;
}

interface NorthboundStock {
  symbol: string;
  name: string;
  netBuy: number;
  buyAmount: number;
  sellAmount: number;
  changePercent: number;
  isSimulated?: boolean;
}

interface MarginEntry {
  symbol: string;
  name: string;
  rzBuyAmount: number;
  rqBuyVolume: number;
  rzBalance: number;
  rqBalance: number;
  rzRqBalance: number;
  rzBalanceChange: number;
  rqBalanceChange: number;
  changePercent: number;
  isSimulated?: boolean;
}

interface LimitStock {
  symbol: string;
  name: string;
  closePrice: number;
  changePercent: number;
  turnoverRate: number;
  volume: number;
  amount: number;
  limitTime: string;
  openTimes: number;
  continuousDays: number;
  reason: string;
  isSimulated?: boolean;
}

interface StockChange {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  amount: number;
  turnoverRate: number;
  amplitude: number;
  volumeRatio: number;
  changeType: string;
  changeTime: string;
  description: string;
  isSimulated?: boolean;
}

interface ChipData {
  symbol: string;
  name: string;
  currentPrice: number;
  avgCost: number;
  profitRatio: number;
  chips: { price: number; ratio: number; type: 'profit' | 'loss' }[];
  supportPrice: number;
  resistancePrice: number;
  concentration: number;
  isSimulated?: boolean;
}

const TABS: { key: AShareTab; icon: React.ReactNode }[] = [
  { key: 'dragonTiger', icon: <Eye className="w-3.5 h-3.5" /> },
  { key: 'northbound', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'margin', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: 'limitStocks', icon: <Zap className="w-3.5 h-3.5" /> },
  { key: 'stockChanges', icon: <Activity className="w-3.5 h-3.5" /> },
  { key: 'chipDist', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
];

function SimulatedBadge({ isSimulated }: { isSimulated?: boolean }) {
  const { t } = useLanguage();
  if (isSimulated) {
    return (
      <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[10px] px-1.5 py-0">
        {t('scanner.simulatedData')}
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px] px-1.5 py-0">
      {t('scanner.realData')}
    </Badge>
  );
}

export function AShareFeatureTab() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AShareTab>('dragonTiger');
  const [loading, setLoading] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);

  // 龙虎榜
  const [dragonTigerData, setDragonTigerData] = useState<DragonTigerEntry[]>([]);
  // 北向资金
  const [northboundSummary, setNorthboundSummary] = useState<NorthboundSummary | null>(null);
  const [northboundStocks, setNorthboundStocks] = useState<NorthboundStock[]>([]);
  // 融资融券
  const [marginData, setMarginData] = useState<MarginEntry[]>([]);
  // 涨跌停
  const [limitType, setLimitType] = useState<'limit_up' | 'limit_down'>('limit_up');
  const [limitStocks, setLimitStocks] = useState<LimitStock[]>([]);
  // 异动监控
  const [stockChanges, setStockChanges] = useState<StockChange[]>([]);
  // 筹码分布
  const [chipSymbol, setChipSymbol] = useState('600519');
  const [chipData, setChipData] = useState<ChipData | null>(null);

  // 龙虎榜数据获取
  const fetchDragonTiger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fusion/market/dragon-tiger');
      if (res.ok) {
        const json = await res.json();
        setDragonTigerData(json.data || []);
        setIsSimulated(json.isSimulated || false);
      }
    } catch {
      setDragonTigerData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 北向资金数据获取
  const fetchNorthbound = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fusion/market/northbound');
      if (res.ok) {
        const json = await res.json();
        setNorthboundSummary(json.data?.summary || null);
        setNorthboundStocks(json.data?.topStocks || []);
        setIsSimulated(json.isSimulated || false);
      }
    } catch {
      setNorthboundSummary(null);
      setNorthboundStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 融资融券数据获取
  const fetchMargin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fusion/market/margin-trading');
      if (res.ok) {
        const json = await res.json();
        setMarginData(json.data || []);
        setIsSimulated(json.isSimulated || false);
      }
    } catch {
      setMarginData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 涨跌停数据获取
  const fetchLimitStocks = useCallback(async (type: 'limit_up' | 'limit_down') => {
    setLoading(true);
    setLimitType(type);
    try {
      const res = await fetch(`/api/fusion/market/limit-stocks?type=${type}`);
      if (res.ok) {
        const json = await res.json();
        setLimitStocks(json.data || []);
        setIsSimulated(json.isSimulated || false);
      }
    } catch {
      setLimitStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 异动监控数据获取
  const fetchStockChanges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fusion/market/stock-changes');
      if (res.ok) {
        const json = await res.json();
        setStockChanges(json.data || []);
        setIsSimulated(json.isSimulated || false);
      }
    } catch {
      setStockChanges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 筹码分布数据获取
  const fetchChipDist = useCallback(async (symbol: string) => {
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/fusion/market/chip-distribution?symbol=${symbol}`);
      if (res.ok) {
        const json = await res.json();
        setChipData(json.data || null);
        setIsSimulated(json.isSimulated || false);
      }
    } catch {
      setChipData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tab切换时自动获取数据
  useEffect(() => {
    switch (activeTab) {
      case 'dragonTiger': fetchDragonTiger(); break;
      case 'northbound': fetchNorthbound(); break;
      case 'margin': fetchMargin(); break;
      case 'limitStocks': fetchLimitStocks(limitType); break;
      case 'stockChanges': fetchStockChanges(); break;
      case 'chipDist': fetchChipDist(chipSymbol); break;
    }
  }, [activeTab, fetchDragonTiger, fetchNorthbound, fetchMargin, fetchLimitStocks, fetchStockChanges, fetchChipDist, limitType, chipSymbol]);

  const handleRefresh = () => {
    switch (activeTab) {
      case 'dragonTiger': fetchDragonTiger(); break;
      case 'northbound': fetchNorthbound(); break;
      case 'margin': fetchMargin(); break;
      case 'limitStocks': fetchLimitStocks(limitType); break;
      case 'stockChanges': fetchStockChanges(); break;
      case 'chipDist': fetchChipDist(chipSymbol); break;
    }
  };

  // 异动类型颜色映射
  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'surge': return <Badge className="bg-red-600/15 text-red-400 border-red-600/20 text-[10px]">{t('scanner.surge')}</Badge>;
      case 'plunge': return <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">{t('scanner.plunge')}</Badge>;
      case 'volume': return <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[10px]">{t('scanner.volume')}</Badge>;
      case 'turnover': return <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[10px]">{t('scanner.turnover')}</Badge>;
      case 'amplitude': return <Badge className="bg-cyan-600/15 text-cyan-400 border-cyan-600/20 text-[10px]">{t('scanner.amplitude')}</Badge>;
      default: return <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px]">{type}</Badge>;
    }
  };

  return (
    <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-semibold text-white">{t('scanner.aShareFeature')}</CardTitle>
            <SimulatedBadge isSimulated={isSimulated} />
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="h-6 px-2 text-zinc-400 hover:text-white">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
        </div>
        {/* Tab导航 */}
        <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar mt-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e]'
              }`}
            >
              {tab.icon}
              {t(`scanner.${tab.key === 'dragonTiger' ? 'dragonTiger' : tab.key === 'chipDist' ? 'chipDistribution' : tab.key === 'margin' ? 'marginTrading' : tab.key === 'limitStocks' ? 'limitStocks' : tab.key === 'stockChanges' ? 'stockChanges' : 'northbound'}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full bg-[#0a0a0f] rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* 龙虎榜 */}
            {activeTab === 'dragonTiger' && (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {dragonTigerData.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">{t('scanner.noData')}</p>
                ) : (
                  dragonTigerData.map((item, i) => (
                    <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{item.name}</span>
                          <span className="text-[10px] text-zinc-500">{item.symbol}</span>
                        </div>
                        <span className={`text-xs font-bold ${item.changePercent >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                        <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px] px-1.5 py-0">{item.reason}</Badge>
                        <span className="text-zinc-500">{t('scanner.netBuy')}: </span>
                        <span className={item.netAmount >= 0 ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'}>
                          {item.netAmount >= 0 ? '+' : ''}{(item.netAmount / 10000).toFixed(2)}亿
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 北向资金 */}
            {activeTab === 'northbound' && (
              <div className="space-y-4">
                {northboundSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                      <p className="text-[10px] text-zinc-500">{t('scanner.netBuy')}（{t('scanner.shConnect')}）</p>
                      <p className={`text-sm font-bold mt-1 ${northboundSummary.hkToShNet >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {northboundSummary.hkToShNet >= 0 ? '+' : ''}{northboundSummary.hkToShNet.toFixed(2)}亿
                      </p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                      <p className="text-[10px] text-zinc-500">{t('scanner.netBuy')}（{t('scanner.szConnect')}）</p>
                      <p className={`text-sm font-bold mt-1 ${northboundSummary.hkToSzNet >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {northboundSummary.hkToSzNet >= 0 ? '+' : ''}{northboundSummary.hkToSzNet.toFixed(2)}亿
                      </p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                      <p className="text-[10px] text-zinc-500">{t('scanner.netBuy')}（{t('scanner.northbound')}）</p>
                      <p className={`text-sm font-bold mt-1 ${northboundSummary.totalNet >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {northboundSummary.totalNet >= 0 ? '+' : ''}{northboundSummary.totalNet.toFixed(2)}亿
                      </p>
                    </div>
                  </div>
                )}
                <Separator className="bg-[#1e1e2e]" />
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {northboundStocks.map((stock, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#0a0a0f] rounded-lg p-2.5 border border-[#1e1e2e]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{stock.name}</span>
                        <span className="text-[10px] text-zinc-500">{stock.symbol}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] ${stock.netBuy >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {stock.netBuy >= 0 ? '+' : ''}{stock.netBuy.toFixed(2)}亿
                        </span>
                        <span className={`text-[10px] ${stock.changePercent >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 融资融券 */}
            {activeTab === 'margin' && (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {marginData.map((item, i) => (
                  <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{item.name}</span>
                        <span className="text-[10px] text-zinc-500">{item.symbol}</span>
                      </div>
                      <span className={`text-xs ${item.changePercent >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                      <div>
                        <span className="text-zinc-500">{t('scanner.rzBalance')}</span>
                        <p className="text-zinc-300 font-medium">{(item.rzBalance / 10000).toFixed(2)}亿</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('scanner.rqBalance')}</span>
                        <p className="text-zinc-300 font-medium">{(item.rqBalance / 10000).toFixed(2)}亿</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">{t('scanner.rzRqBalance')}</span>
                        <p className="text-zinc-300 font-medium">{(item.rzRqBalance / 10000).toFixed(2)}亿</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 涨跌停 */}
            {activeTab === 'limitStocks' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-md p-0.5 w-fit">
                  <button
                    onClick={() => fetchLimitStocks('limit_up')}
                    className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                      limitType === 'limit_up' ? 'bg-red-600/20 text-red-400' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t('scanner.limitUp')}
                  </button>
                  <button
                    onClick={() => fetchLimitStocks('limit_down')}
                    className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                      limitType === 'limit_down' ? 'bg-emerald-600/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t('scanner.limitDown')}
                  </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {limitStocks.map((item, i) => (
                    <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{item.name}</span>
                          <span className="text-[10px] text-zinc-500">{item.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.continuousDays > 1 && (
                            <Badge className="bg-red-600/15 text-red-400 border-red-600/20 text-[10px] px-1.5 py-0">
                              {item.continuousDays}{t('scanner.continuousDays').replace(/\d+/g, '')}
                            </Badge>
                          )}
                          <span className={`text-xs font-bold ${limitType === 'limit_up' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {item.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                        <span>{t('scanner.limitTime')}: {item.limitTime || '--'}</span>
                        <span>{t('scanner.openTimes')}: {item.openTimes}</span>
                        <span>{t('scanner.turnoverRate')}: {item.turnoverRate.toFixed(2)}%</span>
                        <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20 text-[10px] px-1.5 py-0">{item.reason}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 异动监控 */}
            {activeTab === 'stockChanges' && (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {stockChanges.map((item, i) => (
                  <div key={i} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{item.name}</span>
                        <span className="text-[10px] text-zinc-500">{item.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getChangeTypeBadge(item.changeType)}
                        <span className={`text-xs font-bold ${item.changePercent >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">{item.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                      <span>{t('scanner.changeTime')}: {item.changeTime}</span>
                      <span>{t('scanner.turnoverRate')}: {item.turnoverRate.toFixed(2)}%</span>
                      <span>{t('scanner.volumeRatio')}: {item.volumeRatio.toFixed(2)}x</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 筹码分布 */}
            {activeTab === 'chipDist' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chipSymbol}
                    onChange={(e) => setChipSymbol(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchChipDist(chipSymbol); }}
                    placeholder={t('scanner.enterSymbol')}
                    className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-md px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 w-32 focus:border-emerald-600/50 focus:outline-none"
                  />
                  <Button
                    size="sm"
                    onClick={() => fetchChipDist(chipSymbol)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                  >
                    {t('scanner.chipDistribution')}
                  </Button>
                </div>

                {chipData && (
                  <>
                    {/* 关键指标 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-[#0a0a0f] rounded-lg p-2.5 border border-[#1e1e2e]">
                        <p className="text-[10px] text-zinc-500">{t('scanner.avgCost')}</p>
                        <p className="text-xs font-bold text-yellow-400 mt-0.5">¥{chipData.avgCost.toFixed(2)}</p>
                      </div>
                      <div className="bg-[#0a0a0f] rounded-lg p-2.5 border border-[#1e1e2e]">
                        <p className="text-[10px] text-zinc-500">{t('scanner.profitRatio')}</p>
                        <p className={`text-xs font-bold mt-0.5 ${chipData.profitRatio >= 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {chipData.profitRatio.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-[#0a0a0f] rounded-lg p-2.5 border border-[#1e1e2e]">
                        <p className="text-[10px] text-zinc-500">{t('scanner.supportPrice')}</p>
                        <p className="text-xs font-bold text-emerald-400 mt-0.5">¥{chipData.supportPrice.toFixed(2)}</p>
                      </div>
                      <div className="bg-[#0a0a0f] rounded-lg p-2.5 border border-[#1e1e2e]">
                        <p className="text-[10px] text-zinc-500">{t('scanner.resistancePrice')}</p>
                        <p className="text-xs font-bold text-red-400 mt-0.5">¥{chipData.resistancePrice.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* 筹码分布图 */}
                    {chipData.chips.length > 0 && (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chipData.chips}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                            <XAxis
                              dataKey="price"
                              stroke="#71717a"
                              tick={{ fontSize: 8 }}
                              tickLine={false}
                              axisLine={{ stroke: '#1e1e2e' }}
                              tickFormatter={(v: number) => v.toFixed(0)}
                            />
                            <YAxis
                              stroke="#71717a"
                              tick={{ fontSize: 8 }}
                              tickLine={false}
                              axisLine={{ stroke: '#1e1e2e' }}
                              tickFormatter={(v: number) => `${v}%`}
                            />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#1a1a2e',
                                border: '1px solid #2e2e3e',
                                borderRadius: '8px',
                                fontSize: '10px',
                              }}
                              itemStyle={{ color: '#e4e4e7' }}
                              formatter={(value: number, _name: string, props: { payload: { type: string } }) => [
                                `${value.toFixed(2)}%`,
                                props.payload.type === 'profit' ? t('scanner.profit') : t('scanner.loss'),
                              ]}
                            />
                            <RechartsBar dataKey="ratio" radius={[2, 2, 0, 0]}>
                              {chipData.chips.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.type === 'profit' ? '#ef4444' : '#10b981'}
                                  fillOpacity={0.7}
                                />
                              ))}
                            </RechartsBar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* 集中度 */}
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span>{t('scanner.concentration')}:</span>
                      <span className="text-yellow-400 font-medium">{chipData.concentration.toFixed(2)}%</span>
                      <Separator className="bg-[#1e1e2e] h-3 mx-1" orientation="vertical" />
                      <span>{t('scanner.chipPrice')}:</span>
                      <span className="text-white">¥{chipData.currentPrice.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
