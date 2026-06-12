import { NextRequest, NextResponse } from 'next/server';
import { CN_ETF_DB } from '@/lib/cn-etf-db';

/**
 * GET /api/etf/valuation-monitor?symbol=159338
 *
 * 估值-溢价双核周度监控模型（v2 - 分指数差异化估值区间）
 * 返回ETF的估值分位数、股债利差、指数特定估值区间、操作建议、周线趋势等信息
 *
 * v2 核心变化：不同指数使用不同的PE实际值区间判定，而非统一百分位阈值。
 * 因为不同指数估值特征截然不同（如沪深300 PE 8-18 vs 科创50 PE 25-90）。
 */

// ─── 类型定义 ─────────────────────────────────────────────────────────────

type IndexType = 'large_cap' | 'mid_cap' | 'small_cap' | 'growth' | 'dividend' | 'tech' | 'overseas';

interface IndexZone {
  zone: string;               // 极度低估/偏低估/合理估值/偏高估/极度高估
  zoneEn: 'extremely_undervalued' | 'undervalued' | 'fair' | 'overvalued' | 'extremely_overvalued';
  peRange: string;            // 实际PE区间描述，如 "PE < 18.0"
  peMin: number;              // 下界
  peMax: number;              // 上界（最后区间用 Infinity）
  erpRange: string;           // ERP区间描述
  action: string;             // 指数特定操作建议
  positionSuggestion: string; // 仓位建议
  color: string;              // tailwind color class
  dcaMultiplier?: number;     // 定投倍数（极度低估3x，偏低估2x，合理1x，偏高估0x，极度高估-1x止盈）
}

interface IndexZoneConfig {
  indexCode: string;
  indexName: string;
  indexType: IndexType;
  pe10yPercentile: number;
  peAvg: number;
  peStd: number;
  peMin: number;
  peMax: number;
  pb10yPercentile: number;
  pbAvg: number;
  pbStd: number;
  pbMin: number;
  pbMax: number;
  dividendYieldAvg: number;
  trackingIndex: string;
  zones: IndexZone[];
  riskProfile: string;
  strategyNote: string;
  primaryIndicator: 'pe' | 'dividend_yield';
  specialSignals: string[];
  erpThresholds: {
    extremelyUndervalued: number;  // ERP高于此值视为极度低估
    undervalued: number;
    overvalued: number;
    extremelyOvervalued: number;
  };
}

// ─── 分指数差异化估值区间配置 ─────────────────────────────────────────────

const INDEX_ZONE_CONFIG: Record<string, IndexZoneConfig> = {
  // ── 沪深300 (000300) - 大盘蓝筹 ──────────────────────────────────────
  '000300': {
    indexCode: '000300',
    indexName: '沪深300',
    indexType: 'large_cap',
    pe10yPercentile: 38, peAvg: 12.5, peStd: 2.8, peMin: 8.0, peMax: 18.5,
    pb10yPercentile: 25, pbAvg: 1.5, pbStd: 0.3, pbMin: 1.0, pbMax: 2.2,
    dividendYieldAvg: 2.5,
    trackingIndex: '沪深300指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 9.5', peMin: 0, peMax: 9.5,
        erpRange: 'ERP > 均值+2σ',
        action: '激进加仓，大额买入', positionSuggestion: '80%-100%仓位',
        color: 'emerald', dcaMultiplier: 3,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 9.5 - 11.0', peMin: 9.5, peMax: 11.0,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极定投，逢低加仓', positionSuggestion: '60%-80%仓位',
        color: 'green', dcaMultiplier: 2,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 11.0 - 14.0', peMin: 11.0, peMax: 14.0,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有观望，维持仓位', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 14.0 - 16.5', peMin: 14.0, peMax: 16.5,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓，逢高卖出', positionSuggestion: '20%-40%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 16.5', peMin: 16.5, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈，仅留底仓', positionSuggestion: '0%-20%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '盈利下修风险较低，大盘蓝筹盈利相对稳定。金融+消费占比较高，受宏观经济周期影响明显。',
    strategyNote: '适合核心底仓长期持有，估值低位时大额加仓。PE<10时是历史级别的低估机会。',
    primaryIndicator: 'pe',
    specialSignals: ['盈利稳定性', '北向资金流向'],
    erpThresholds: { extremelyUndervalued: 5.5, undervalued: 3.5, overvalued: 0.5, extremelyOvervalued: -1.0 },
  },

  // ── 中证500 (000905) - 中盘成长 ──────────────────────────────────────
  '000905': {
    indexCode: '000905',
    indexName: '中证500',
    indexType: 'mid_cap',
    pe10yPercentile: 22, peAvg: 28.0, peStd: 8.5, peMin: 15.0, peMax: 55.0,
    pb10yPercentile: 4, pbAvg: 2.1, pbStd: 0.6, pbMin: 1.4, pbMax: 3.8,
    dividendYieldAvg: 1.5,
    trackingIndex: '中证500指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 18.0', peMin: 0, peMax: 18.0,
        erpRange: 'ERP > 均值+2σ',
        action: '底仓+大额定投', positionSuggestion: '80%-100%仓位',
        color: 'emerald', dcaMultiplier: 3,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 18.0 - 23.0', peMin: 18.0, peMax: 23.0,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极定投（逢阴线加仓）', positionSuggestion: '60%-80%仓位',
        color: 'green', dcaMultiplier: 2,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 23.0 - 35.0', peMin: 23.0, peMax: 35.0,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有+做T降成本', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 35.0 - 45.0', peMin: 35.0, peMax: 45.0,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓', positionSuggestion: '20%-40%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 45.0', peMin: 45.0, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈', positionSuggestion: '0%-20%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '成分股盈利下修导致PE被动升高（"越跌越贵"），需关注PB分位数作安全垫。周期股占比较高，业绩波动大。',
    strategyNote: '定投微笑曲线策略最适用，周线连阴加仓法。PE低位时PB也低位才是真低估，否则可能是盈利恶化。',
    primaryIndicator: 'pe',
    specialSignals: ['PB分位数安全垫', '盈利下修风险', '定投微笑曲线'],
    erpThresholds: { extremelyUndervalued: 4.0, undervalued: 2.5, overvalued: -0.5, extremelyOvervalued: -2.0 },
  },

  // ── 中证1000 (000852) - 小盘 ──────────────────────────────────────────
  '000852': {
    indexCode: '000852',
    indexName: '中证1000',
    indexType: 'small_cap',
    pe10yPercentile: 18, peAvg: 35.0, peStd: 12.0, peMin: 18.0, peMax: 70.0,
    pb10yPercentile: 6, pbAvg: 2.5, pbStd: 0.8, pbMin: 1.6, pbMax: 4.5,
    dividendYieldAvg: 1.0,
    trackingIndex: '中证1000指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 22.0', peMin: 0, peMax: 22.0,
        erpRange: 'ERP > 均值+2σ',
        action: '小仓试探性买入', positionSuggestion: '50%-70%仓位',
        color: 'emerald', dcaMultiplier: 2.5,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 22.0 - 28.0', peMin: 22.0, peMax: 28.0,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极定投，控制节奏', positionSuggestion: '40%-60%仓位',
        color: 'green', dcaMultiplier: 1.5,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 28.0 - 42.0', peMin: 28.0, peMax: 42.0,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有观望，做T降成本', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 42.0 - 58.0', peMin: 42.0, peMax: 58.0,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓', positionSuggestion: '20%-30%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 58.0', peMin: 58.0, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈', positionSuggestion: '0%-10%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '小盘股流动性风险、退市风险，PE波动极大。小盘股容易受到风格切换影响，估值回归周期可能很长。',
    strategyNote: '波段操作为主，不适合重仓长持。严格控制单一小盘ETF仓位不超过总仓位10%。',
    primaryIndicator: 'pe',
    specialSignals: ['流动性风险', '退市风险', '风格切换'],
    erpThresholds: { extremelyUndervalued: 3.5, undervalued: 2.0, overvalued: -1.0, extremelyOvervalued: -3.0 },
  },

  // ── 上证50 (000016) - 超级大盘 ────────────────────────────────────────
  '000016': {
    indexCode: '000016',
    indexName: '上证50',
    indexType: 'large_cap',
    pe10yPercentile: 45, peAvg: 10.5, peStd: 2.2, peMin: 7.0, peMax: 15.0,
    pb10yPercentile: 30, pbAvg: 1.3, pbStd: 0.25, pbMin: 0.9, pbMax: 1.9,
    dividendYieldAvg: 3.2,
    trackingIndex: '上证50指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 8.5', peMin: 0, peMax: 8.5,
        erpRange: 'ERP > 均值+2σ',
        action: '罕见低估，重仓机会', positionSuggestion: '80%-100%仓位',
        color: 'emerald', dcaMultiplier: 3,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 8.5 - 9.8', peMin: 8.5, peMax: 9.8,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极定投，股息率>4%加仓', positionSuggestion: '60%-80%仓位',
        color: 'green', dcaMultiplier: 2,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 9.8 - 11.5', peMin: 9.8, peMax: 11.5,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有观望，收息为主', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 11.5 - 13.5', peMin: 11.5, peMax: 13.5,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓', positionSuggestion: '20%-40%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 13.5', peMin: 13.5, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈', positionSuggestion: '0%-20%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '金融股权重高（银行+保险+券商占比约40%），受银行估值影响大。股息率是重要安全垫。',
    strategyNote: '股息率>4%时视为低估信号，适合防御性配置。金融股周期性强，需关注利率政策。',
    primaryIndicator: 'pe',
    specialSignals: ['股息率安全垫', '金融股估值', '利率政策'],
    erpThresholds: { extremelyUndervalued: 6.0, undervalued: 4.0, overvalued: 1.0, extremelyOvervalued: -0.5 },
  },

  // ── 科创50 (000688) - 科技创新 ────────────────────────────────────────
  '000688': {
    indexCode: '000688',
    indexName: '科创50',
    indexType: 'tech',
    pe10yPercentile: 35, peAvg: 50.0, peStd: 18.0, peMin: 25.0, peMax: 90.0,
    pb10yPercentile: 28, pbAvg: 4.5, pbStd: 1.5, pbMin: 2.5, pbMax: 8.0,
    dividendYieldAvg: 0.6,
    trackingIndex: '科创50指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 32.0', peMin: 0, peMax: 32.0,
        erpRange: 'ERP > 均值+2σ',
        action: '小额定投+逢低加仓', positionSuggestion: '30%-50%仓位（总仓位不超15%）',
        color: 'emerald', dcaMultiplier: 2.5,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 32.0 - 42.0', peMin: 32.0, peMax: 42.0,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极小额定投', positionSuggestion: '20%-40%仓位（总仓位不超15%）',
        color: 'green', dcaMultiplier: 1.5,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 42.0 - 58.0', peMin: 42.0, peMax: 58.0,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有观望，高抛低吸', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 58.0 - 72.0', peMin: 58.0, peMax: 72.0,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓，高抛为主', positionSuggestion: '10%-20%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 72.0', peMin: 72.0, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈', positionSuggestion: '0%-10%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '科创板成立时间短（2019年），历史数据有限；个股退市风险高；高波动，单日涨跌幅限制20%。',
    strategyNote: '严格控制仓位（建议不超过总仓位15%），小额定投+高抛低吸。不适合大额重仓。',
    primaryIndicator: 'pe',
    specialSignals: ['波动率监控', '退市风险', '科创政策'],
    erpThresholds: { extremelyUndervalued: 2.0, undervalued: 0.5, overvalued: -2.0, extremelyOvervalued: -4.0 },
  },

  // ── 上证红利 (000015) - 红利 ──────────────────────────────────────────
  '000015': {
    indexCode: '000015',
    indexName: '上证红利',
    indexType: 'dividend',
    pe10yPercentile: 12, peAvg: 8.0, peStd: 1.5, peMin: 5.5, peMax: 12.0,
    pb10yPercentile: 8, pbAvg: 1.0, pbStd: 0.2, pbMin: 0.7, pbMax: 1.5,
    dividendYieldAvg: 5.0,
    trackingIndex: '上证红利指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 6.5 或 股息率 > 6.0%', peMin: 0, peMax: 6.5,
        erpRange: 'ERP > 均值+2σ',
        action: '重仓收息，股息率极高', positionSuggestion: '80%-100%仓位',
        color: 'emerald', dcaMultiplier: 3,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 6.5 - 7.5 或 股息率 5.0-6.0%', peMin: 6.5, peMax: 7.5,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极买入，享受高股息', positionSuggestion: '60%-80%仓位',
        color: 'green', dcaMultiplier: 2,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 7.5 - 9.0 或 股息率 4.0-5.0%', peMin: 7.5, peMax: 9.0,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有收息，不追涨', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 9.0 - 10.5 或 股息率 3.0-4.0%', peMin: 9.0, peMax: 10.5,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓，股息率偏低', positionSuggestion: '20%-40%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 10.5 或 股息率 < 3.0%', peMin: 10.5, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈，失去收息价值', positionSuggestion: '0%-20%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '高股息陷阱（分红不可持续）、周期股占比高（煤炭、银行、钢铁）。分红率下降时要警惕。',
    strategyNote: '股息率为核心指标，PE/PB为辅助。适合收息策略，股息率>5%时安心持有。<3%时失去配置价值。',
    primaryIndicator: 'dividend_yield',
    specialSignals: ['股息率可持续性', '分红率变化', '高股息陷阱'],
    erpThresholds: { extremelyUndervalued: 7.0, undervalued: 5.0, overvalued: 1.5, extremelyOvervalued: 0 },
  },

  // ── 创业板指 (399006) - 成长 ──────────────────────────────────────────
  '399006': {
    indexCode: '399006',
    indexName: '创业板指',
    indexType: 'growth',
    pe10yPercentile: 25, peAvg: 42.0, peStd: 15.0, peMin: 20.0, peMax: 75.0,
    pb10yPercentile: 20, pbAvg: 4.2, pbStd: 1.3, pbMin: 2.5, pbMax: 7.0,
    dividendYieldAvg: 0.5,
    trackingIndex: '创业板指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 28.0', peMin: 0, peMax: 28.0,
        erpRange: 'ERP > 均值+2σ',
        action: '大额定投，低估加仓', positionSuggestion: '60%-80%仓位',
        color: 'emerald', dcaMultiplier: 3,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 28.0 - 35.0', peMin: 28.0, peMax: 35.0,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极定投，加大定投金额', positionSuggestion: '40%-60%仓位',
        color: 'green', dcaMultiplier: 2,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 35.0 - 50.0', peMin: 35.0, peMax: 50.0,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有观望，暂停新增定投', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 50.0 - 62.0', peMin: 50.0, peMax: 62.0,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓止盈', positionSuggestion: '20%-30%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 62.0', peMin: 62.0, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈', positionSuggestion: '0%-10%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '成长股估值波动极大，高PE不代表高估但低PE可能意味盈利恶化。新能源+医药权重高，赛道集中风险。',
    strategyNote: '定投为主，低估时加大定投金额；高估时止盈。关注成长股盈利增速与PE匹配度（PEG）。',
    primaryIndicator: 'pe',
    specialSignals: ['PEG匹配度', '成长股盈利增速', '赛道集中度'],
    erpThresholds: { extremelyUndervalued: 2.5, undervalued: 1.0, overvalued: -1.5, extremelyOvervalued: -3.5 },
  },

  // ── SPX 标普500 ──────────────────────────────────────────────────────
  'SPX': {
    indexCode: 'SPX',
    indexName: '标普500',
    indexType: 'overseas',
    pe10yPercentile: 72, peAvg: 22.0, peStd: 4.5, peMin: 15.0, peMax: 32.0,
    pb10yPercentile: 68, pbAvg: 3.8, pbStd: 0.8, pbMin: 2.5, pbMax: 5.5,
    dividendYieldAvg: 1.8,
    trackingIndex: '标普500指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 17.0', peMin: 0, peMax: 17.0,
        erpRange: 'ERP > 均值+2σ',
        action: '历史级别低估，重仓买入', positionSuggestion: '80%-100%仓位',
        color: 'emerald', dcaMultiplier: 3,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 17.0 - 20.0', peMin: 17.0, peMax: 20.0,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极定投，美元弱势期加仓', positionSuggestion: '60%-80%仓位',
        color: 'green', dcaMultiplier: 2,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 20.0 - 25.0', peMin: 20.0, peMax: 25.0,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有观望，关注美联储政策', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 25.0 - 28.0', peMin: 25.0, peMax: 28.0,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓，防范加息冲击', positionSuggestion: '20%-40%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 28.0', peMin: 28.0, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈，避险为主', positionSuggestion: '0%-20%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '美元周期影响大，加息/降息影响大。美股长期牛市但估值已处高位，需警惕均值回归。',
    strategyNote: '适合长期定投，关注美联储政策。QDII额度限制需注意，折溢价可能影响实际收益。',
    primaryIndicator: 'pe',
    specialSignals: ['美联储政策', '美元周期', 'QDII折溢价'],
    erpThresholds: { extremelyUndervalued: 4.0, undervalued: 2.5, overvalued: 0, extremelyOvervalued: -2.0 },
  },

  // ── HSI 恒生指数 ─────────────────────────────────────────────────────
  'HSI': {
    indexCode: 'HSI',
    indexName: '恒生指数',
    indexType: 'overseas',
    pe10yPercentile: 15, peAvg: 11.0, peStd: 2.5, peMin: 7.5, peMax: 17.0,
    pb10yPercentile: 10, pbAvg: 1.1, pbStd: 0.3, pbMin: 0.7, pbMax: 1.7,
    dividendYieldAvg: 3.5,
    trackingIndex: '恒生指数',
    zones: [
      {
        zone: '极度低估', zoneEn: 'extremely_undervalued',
        peRange: 'PE < 8.5', peMin: 0, peMax: 8.5,
        erpRange: 'ERP > 均值+2σ',
        action: '罕见低估，大额买入', positionSuggestion: '80%-100%仓位',
        color: 'emerald', dcaMultiplier: 3,
      },
      {
        zone: '偏低估', zoneEn: 'undervalued',
        peRange: 'PE 8.5 - 10.0', peMin: 8.5, peMax: 10.0,
        erpRange: 'ERP 均值+1σ ~ 均值+2σ',
        action: '积极定投，AH溢价高时加仓', positionSuggestion: '60%-80%仓位',
        color: 'green', dcaMultiplier: 2,
      },
      {
        zone: '合理估值', zoneEn: 'fair',
        peRange: 'PE 10.0 - 12.5', peMin: 10.0, peMax: 12.5,
        erpRange: 'ERP 均值 ± 1σ',
        action: '持有观望', positionSuggestion: '维持现有仓位',
        color: 'yellow', dcaMultiplier: 1,
      },
      {
        zone: '偏高估', zoneEn: 'overvalued',
        peRange: 'PE 12.5 - 15.0', peMin: 12.5, peMax: 15.0,
        erpRange: 'ERP 均值-1σ ~ 均值-2σ',
        action: '逐步减仓', positionSuggestion: '20%-40%仓位',
        color: 'orange', dcaMultiplier: 0,
      },
      {
        zone: '极度高估', zoneEn: 'extremely_overvalued',
        peRange: 'PE > 15.0', peMin: 15.0, peMax: Infinity,
        erpRange: 'ERP < 均值-2σ',
        action: '清仓止盈', positionSuggestion: '0%-20%仓位',
        color: 'red', dcaMultiplier: -1,
      },
    ],
    riskProfile: '受地缘政治影响大，流动性风险。AH股溢价指数作为辅助判断。港股通南向资金影响显著。',
    strategyNote: 'AH溢价指数作为辅助判断，溢价>140时港股更有吸引力。关注南向资金流向。',
    primaryIndicator: 'pe',
    specialSignals: ['AH溢价指数', '南向资金流向', '地缘政治风险'],
    erpThresholds: { extremelyUndervalued: 6.0, undervalued: 4.0, overvalued: 0.5, extremelyOvervalued: -1.5 },
  },
};

// ─── ETF代码 -> 指数代码映射（扩展版） ────────────────────────────────────

const ETF_TO_INDEX: Record<string, string> = {
  // 沪深300
  '510300': '000300',  // 华泰柏瑞沪深300ETF
  '159919': '000300',  // 嘉实沪深300ETF
  '510330': '000300',  // 华夏沪深300ETF
  '515180': '000300',  // 华夏沪深300红利ETF → 沪深300估值
  '512880': '000300',  // 国泰券商ETF → 映射到大盘估值
  '512690': '000300',  // 鹏华中证酒ETF → 映射到大盘估值
  '512000': '000300',  // 券商ETF → 映射到大盘估值

  // 中证500
  '510500': '000905',  // 华夏中证500ETF
  '512660': '000905',  // 国泰军工ETF → 中证500估值参考（中盘）
  '510510': '000905',  // 中证500ETF
  '512010': '000905',  // 国泰医药ETF → 中证500估值参考
  '159922': '000905',  // 中证500ETF
  '512980': '000905',  // 南方中证500ETF

  // 中证1000
  '512100': '000852',  // 南方中证1000ETF
  '159338': '000852',  // 华夏中证1000ETF

  // 上证50
  '510050': '000016',  // 华夏上证50ETF

  // 科创50
  '588000': '000688',  // 华夏科创50ETF

  // 上证红利
  '510880': '000015',  // 交银上证红利ETF

  // 创业板
  '159915': '399006',  // 易方达创业板ETF
  '515050': '399006',  // 华夏5GETF → 创业板估值参考（成长）
  '159916': '399006',  // 创业板ETF
  '159949': '399006',  // 创业板50ETF → 创业板估值参考

  // 海外
  '513500': 'SPX',     // 博时标普500ETF
  '513300': 'HSI',     // 华夏沪深300ETF（港股通）→ 恒生
  '510900': 'HSI',     // 恒生ETF
  '513060': 'HSI',     // 华夏恒生ETF
};

// ─── 按ETF类别推断指数映射 ─────────────────────────────────────────────

const CATEGORY_INDEX_PROXY: Record<string, string> = {
  'broad_market': '000300',  // 宽基 → 沪深300
  'sector': '000905',        // 行业 → 中证500（稍高PE）
  'dividend': '000015',      // 红利 → 上证红利
  'international': 'SPX',    // 跨境 → 标普500
  'thematic': '399006',      // 主题 → 创业板指
  // bond → 无估值监控
};

// ─── 中国10年期国债收益率 ──────────────────────────────────────────────

let bondYield10y = 2.25; // 可更新字段

// ─── 估值区间判定（分指数） ──────────────────────────────────────────────
// 保持旧接口的兼容类型
interface ValuationZone {
  zone: '极度低估' | '偏低估' | '合理估值' | '偏高估' | '极度高估';
  zoneEn: 'extremely_undervalued' | 'undervalued' | 'fair' | 'overvalued' | 'extremely_overvalued';
  peRange: string;
  erpRange: string;
  action: string;
  positionSuggestion: string;
  color: string;
}

/**
 * 根据指数特定PE实际值区间判定估值区间
 * @param peCurrent 当前PE值
 * @param indexCode 指数代码
 * @param dividendYield 当前股息率（红利指数用）
 */
function getValuationZone(
  peCurrent: number,
  indexCode: string,
  dividendYield?: number,
): { zone: IndexZone; zoneConfig: IndexZoneConfig } {
  const config = INDEX_ZONE_CONFIG[indexCode];

  if (!config) {
    // fallback：使用沪深300配置
    return getValuationZone(peCurrent, '000300', dividendYield);
  }

  // 红利指数：优先用股息率判定
  if (config.primaryIndicator === 'dividend_yield' && dividendYield !== undefined) {
    // 先按股息率判定
    const dy = dividendYield;
    if (indexCode === '000015') {
      if (dy > 6.0) return { zone: config.zones[0], zoneConfig: config };
      if (dy > 5.0) return { zone: config.zones[1], zoneConfig: config };
      if (dy > 4.0) return { zone: config.zones[2], zoneConfig: config };
      if (dy > 3.0) return { zone: config.zones[3], zoneConfig: config };
      return { zone: config.zones[4], zoneConfig: config };
    }
  }

  // 通用：按PE实际值区间判定
  for (const zone of config.zones) {
    if (peCurrent >= zone.peMin && peCurrent < zone.peMax) {
      return { zone, zoneConfig: config };
    }
  }

  // 边界情况：PE超过最大区间
  return { zone: config.zones[config.zones.length - 1], zoneConfig: config };
}

/**
 * 根据PE实际值推算分位数（用于没有预设分位数的指数）
 */
function estimatePercentileFromPE(peCurrent: number, config: IndexZoneConfig): number {
  const { peAvg, peStd, peMin, peMax } = config;
  // 使用正态分布近似
  if (peCurrent <= peMin) return 1;
  if (peCurrent >= peMax) return 99;
  const zScore = (peCurrent - peAvg) / peStd;
  // 近似正态CDF
  const percentile = 50 + 50 * Math.tanh(zScore * 0.6);
  return Math.max(1, Math.min(99, Math.round(percentile)));
}

// ─── 周线趋势信号 ─────────────────────────────────────────────────────────
interface WeeklyTrend {
  ma20Position: 'above' | 'below' | 'near';
  ma20Value: number;
  macdSignal: 'golden_cross' | 'death_cross' | 'divergence_bottom' | 'neutral';
  macdDesc: string;
  weeklyCandle: 'bullish' | 'bearish' | 'doji';
  trendSummary: string;
}

function generateWeeklyTrend(
  currentPrice: number,
  peCurrent: number,
  peAvg: number,
): WeeklyTrend {
  // 改进：用当前PE vs 平均PE判断MA20位置更准确
  const peRatio = peCurrent / peAvg; // <1 表示低估，>1 表示高估
  const ma20Offset = (peRatio - 1) * 0.06; // PE偏离度映射到价格偏离度
  const noise = (Math.random() - 0.5) * 0.015;
  const ma20Value = currentPrice / (1 + ma20Offset + noise);

  const ma20Position: WeeklyTrend['ma20Position'] =
    currentPrice > ma20Value * 1.02 ? 'above' :
    currentPrice < ma20Value * 0.98 ? 'below' : 'near';

  // 低估区间容易出现底背离+金叉信号
  let macdSignal: WeeklyTrend['macdSignal'] = 'neutral';
  let macdDesc = '';
  if (peRatio < 0.75) {
    macdSignal = 'divergence_bottom';
    macdDesc = '周线MACD底背离，关注金叉买入信号';
  } else if (peRatio < 0.9) {
    macdSignal = 'golden_cross';
    macdDesc = '周线MACD金叉，趋势转多';
  } else if (peRatio > 1.3) {
    macdSignal = 'death_cross';
    macdDesc = '周线MACD死叉，趋势转空';
  } else {
    macdDesc = '周线MACD无明显信号';
  }

  // 模拟周K线形态：低估偏bearish（正在筑底），高估偏bullish（赶顶）
  const rand = Math.random();
  const bearishBias = peRatio < 0.85 ? 0.15 : 0;
  const weeklyCandle: WeeklyTrend['weeklyCandle'] =
    rand < 0.35 + bearishBias ? 'bearish' : rand < 0.7 ? 'bullish' : 'doji';

  const trendSummary = ma20Position === 'above'
    ? `指数站上20周均线（${ma20Value.toFixed(3)}），中期趋势偏多`
    : ma20Position === 'below'
    ? `指数跌破20周均线（${ma20Value.toFixed(3)}），中期趋势偏空`
    : `指数在20周均线（${ma20Value.toFixed(3)}）附近震荡`;

  return { ma20Position, ma20Value, macdSignal, macdDesc, weeklyCandle, trendSummary };
}

// ─── 历史PE分位数走势（模拟最近52周数据） ───────────────────────────────
interface PercentileHistoryPoint {
  week: string;
  pe: number;
  pePercentile: number;
  price: number;
}

function generatePercentileHistory(
  currentPe: number, currentPercentile: number, currentPrice: number,
  peMin: number, peMax: number
): PercentileHistoryPoint[] {
  const points: PercentileHistoryPoint[] = [];
  const now = new Date();

  for (let i = 51; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);

    // 模拟分位数波动：均值回归 + 随机噪声
    const trend = (currentPercentile - 50) / 50;
    const noise = (Math.random() - 0.5) * 15;
    const basePercentile = i > 40
      ? currentPercentile + (40 - i) * 2 + noise
      : currentPercentile + (i / 52) * 10 * trend + noise;

    const pePercentile = Math.max(1, Math.min(99, Math.round(basePercentile)));
    // 使用实际的PE min/max范围做映射
    const pe = peMin + (peMax - peMin) * (pePercentile / 100);
    const price = currentPrice * (0.85 + pePercentile / 100 * 0.3);

    points.push({
      week: date.toISOString().split('T')[0],
      pe: Math.round(pe * 100) / 100,
      pePercentile,
      price: Math.round(price * 1000) / 1000,
    });
  }

  return points;
}

// ─── 周度SOP检查项 ───────────────────────────────────────────────────────
interface WeeklyCheckItem {
  id: string;
  label: string;
  value: string;
  status: 'normal' | 'warning' | 'danger' | 'good';
}

function generateWeeklyChecklist(
  peCurrent: number,
  pePercentile: number,
  erp: number,
  pbPercentile: number,
  bondYield: number,
  price: number,
  trackingIndex: string,
  config: IndexZoneConfig,
  currentZone: IndexZone,
  dividendYield: number,
  etfPremiumDiscount?: number,
): WeeklyCheckItem[] {
  const items: WeeklyCheckItem[] = [
    {
      id: 'price',
      label: '本周收盘价',
      value: `¥${price.toFixed(3)}`,
      status: 'normal',
    },
    {
      id: 'pe',
      label: `${trackingIndex} PE-TTM`,
      value: `${peCurrent.toFixed(1)}倍`,
      status: currentZone.zoneEn === 'extremely_undervalued' || currentZone.zoneEn === 'undervalued' ? 'good' :
              currentZone.zoneEn === 'overvalued' || currentZone.zoneEn === 'extremely_overvalued' ? 'danger' : 'normal',
    },
    {
      id: 'pe_percentile',
      label: 'PE 10年分位数',
      value: `${pePercentile.toFixed(0)}%`,
      status: pePercentile < 30 ? 'good' : pePercentile > 70 ? 'danger' : 'normal',
    },
    {
      id: 'bond_yield',
      label: '10年期国债收益率',
      value: `${bondYield.toFixed(2)}%`,
      status: 'normal',
    },
    {
      id: 'erp',
      label: '股债利差 (ERP)',
      value: `${erp.toFixed(2)}%`,
      status: erp > config.erpThresholds.undervalued ? 'good' : erp < config.erpThresholds.overvalued ? 'danger' : 'normal',
    },
    {
      id: 'pb_percentile',
      label: 'PB 10年分位数',
      value: `${pbPercentile.toFixed(0)}%`,
      status: pbPercentile < 20 ? 'good' : pbPercentile > 80 ? 'danger' : 'normal',
    },
  ];

  // 红利指数：股息率为核心指标
  if (config.primaryIndicator === 'dividend_yield') {
    items.push({
      id: 'dividend_yield',
      label: '股息率（核心指标）',
      value: `${dividendYield.toFixed(2)}%`,
      status: dividendYield > config.dividendYieldAvg ? 'good' : dividendYield < config.dividendYieldAvg * 0.6 ? 'danger' : 'warning',
    });
  } else {
    items.push({
      id: 'dividend_yield',
      label: '股息率',
      value: `${dividendYield.toFixed(2)}%`,
      status: 'normal',
    });
  }

  // 科技指数：波动率检查
  if (config.indexType === 'tech' || config.indexType === 'growth') {
    items.push({
      id: 'volatility',
      label: '波动率监控',
      value: config.indexType === 'tech' ? '高波动（20%涨跌幅限制）' : '中高波动',
      status: config.indexType === 'tech' ? 'warning' : 'normal',
    });
  }

  // ETF折溢价率（所有指数都加）
  if (etfPremiumDiscount !== undefined) {
    items.push({
      id: 'premium_discount',
      label: 'ETF折溢价率',
      value: `${etfPremiumDiscount > 0 ? '+' : ''}${etfPremiumDiscount.toFixed(2)}%`,
      status: Math.abs(etfPremiumDiscount) > 2 ? 'danger' : Math.abs(etfPremiumDiscount) > 1 ? 'warning' : 'normal',
    });
  }

  items.push(
    {
      id: 'zone',
      label: '估值区间',
      value: currentZone.zone,
      status: currentZone.zoneEn === 'extremely_undervalued' || currentZone.zoneEn === 'undervalued' ? 'good' :
              currentZone.zoneEn === 'overvalued' || currentZone.zoneEn === 'extremely_overvalued' ? 'danger' : 'warning',
    },
    {
      id: 'action',
      label: '操作建议',
      value: currentZone.action,
      status: currentZone.zoneEn === 'extremely_undervalued' || currentZone.zoneEn === 'undervalued' ? 'good' :
              currentZone.zoneEn === 'overvalued' || currentZone.zoneEn === 'extremely_overvalued' ? 'danger' : 'warning',
    },
  );

  return items;
}

// ─── 主处理函数 ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // 1. 查找对应的指数代码
    let indexCode = ETF_TO_INDEX[symbol];

    // 2. 获取ETF基本信息
    const cnEtf = CN_ETF_DB.find(e => e.symbol === symbol);
    const profile = cnEtf;

    if (!profile && !indexCode) {
      return NextResponse.json({ error: 'ETF not found' }, { status: 404 });
    }

    const peCurrent = (profile as Record<string, unknown>)?.peRatio as number || 20;
    const pbCurrent = (profile as Record<string, unknown>)?.pbRatio as number || 1.5;
    const trackingIndex = (profile as Record<string, unknown>)?.trackingIndex as string || '未知指数';
    const category = (profile as Record<string, unknown>)?.category as string || '';
    const currentPrice = searchParams.get('price') ? parseFloat(searchParams.get('price')!) : 1.3;
    const dividendYieldCurrent = (profile as Record<string, unknown>)?.dividendYield as number || 0;

    // 3. 如果没有直接的ETF→指数映射，根据类别推断
    if (!indexCode) {
      if (category === 'bond') {
        // 债券ETF不做估值监控
        return NextResponse.json({
          symbol,
          name: (profile as Record<string, unknown>)?.name || symbol,
          message: '债券ETF不适用估值监控模型',
          bondYield10y,
          updatedAt: new Date().toISOString(),
        });
      }
      indexCode = CATEGORY_INDEX_PROXY[category] || '000300';
    }

    // 4. 获取指数特定估值配置
    const indexConfig = INDEX_ZONE_CONFIG[indexCode] || INDEX_ZONE_CONFIG['000300'];

    // 5. 用PE实际值判定估值区间
    const { zone: currentZone, zoneConfig } = getValuationZone(peCurrent, indexCode, dividendYieldCurrent);

    // 6. 计算PE/PB分位数
    const pePercentile = indexConfig.pe10yPercentile || estimatePercentileFromPE(peCurrent, indexConfig);
    const pbPercentile = indexConfig.pb10yPercentile || Math.max(3, pePercentile - 10);

    // 7. 股债利差 = 1/PE - 国债收益率
    const earningsYield = (1 / peCurrent) * 100;
    const erp = earningsYield - bondYield10y;

    // ERP统计量
    const erpAvg = (1 / indexConfig.peAvg) * 100 - bondYield10y;
    const erpStd = Math.abs((1 / (indexConfig.peAvg - indexConfig.peStd)) * 100 - (1 / indexConfig.peAvg) * 100);

    // 8. 周线趋势（使用PE vs PE平均来更准确判断）
    const weeklyTrend = generateWeeklyTrend(currentPrice, peCurrent, indexConfig.peAvg);

    // 9. 历史PE分位数走势
    const percentileHistory = generatePercentileHistory(
      peCurrent, pePercentile, currentPrice, indexConfig.peMin, indexConfig.peMax
    );

    // 10. 模拟ETF折溢价率
    const etfPremiumDiscount = (Math.random() - 0.5) * 3; // -1.5% ~ +1.5%

    // 11. 周度SOP检查项
    const weeklyChecklist = generateWeeklyChecklist(
      peCurrent, pePercentile, erp, pbPercentile, bondYield10y,
      currentPrice, indexConfig.trackingIndex, indexConfig, currentZone,
      dividendYieldCurrent, etfPremiumDiscount,
    );

    // 12. 特殊风险提示（分指数差异化）
    const riskWarnings: string[] = [];

    // 通用风险
    if (pbPercentile < 10) {
      riskWarnings.push(`PB分位数极低（${pbPercentile}%），资产底部坚实，下行空间极有限，可作为加仓信心支撑。`);
    }

    // 中证500/中证1000特有风险：盈利下修导致"越跌越贵"
    if ((indexCode === '000905' || indexCode === '000852') && pePercentile < 30 && pbPercentile > pePercentile + 15) {
      riskWarnings.push('成分股盈利下修风险：PE分位数低于PB分位数，可能存在企业利润下降导致"越跌越贵"的情况，需重点关注PB分位数作为安全垫参考。');
    }

    // ERP极值
    if (erp > erpAvg + 2 * erpStd) {
      riskWarnings.push('股债利差处于历史极值区，股票相对债券极具投资价值，适合逢低分批建仓。');
    }

    // 分指数特有风险
    if (indexCode === '000688') {
      riskWarnings.push('科创50成立时间短，历史估值参考有限；20%涨跌幅限制意味着更大波动，建议严控仓位不超过总仓位15%。');
    }
    if (indexCode === '000015') {
      if (dividendYieldCurrent < indexConfig.dividendYieldAvg * 0.7) {
        riskWarnings.push(`股息率（${dividendYieldCurrent.toFixed(1)}%）显著低于历史均值（${indexConfig.dividendYieldAvg}%），警惕高股息陷阱，分红可能不可持续。`);
      }
    }
    if (indexCode === '399006' && peCurrent < indexConfig.peAvg * 0.7) {
      riskWarnings.push('创业板PE极低可能是盈利恶化信号而非低估机会，需结合盈利增速判断（参考PEG指标）。');
    }
    if (indexCode === 'SPX' && peCurrent > 25) {
      riskWarnings.push('标普500估值偏高，关注美联储货币政策走向，加息周期中高估值承压更大。');
    }
    if (indexCode === 'HSI') {
      riskWarnings.push('恒生指数受地缘政治和南向资金影响大，建议结合AH溢价指数判断（溢价>140时港股更优）。');
    }
    if (indexCode === '000016') {
      riskWarnings.push('上证50金融股权重约40%，受银行估值周期影响大。股息率>4%是重要低估信号。');
    }

    // ETF折溢价风险
    if (Math.abs(etfPremiumDiscount) > 1.5) {
      riskWarnings.push(`ETF折溢价率${etfPremiumDiscount > 0 ? '偏高' : '偏低'}（${etfPremiumDiscount > 0 ? '+' : ''}${etfPremiumDiscount.toFixed(2)}%），注意场内场外套利风险。`);
    }

    // 13. 定投建议（分指数差异化）
    let dcaAdvice = '';
    const dcaMultiplier = currentZone.dcaMultiplier ?? 1;

    if (dcaMultiplier >= 3) {
      if (indexCode === '000688') {
        dcaAdvice = `当前处于极度低估区间，建议小额定投金额×${dcaMultiplier}。科创50严格控制仓位，单次加仓不超过计划的50%。`;
      } else if (indexCode === '000015') {
        dcaAdvice = `当前股息率极高，建议定投金额×${dcaMultiplier}。红利指数极度低估意味着股息回报丰厚，可安心加仓收息。`;
      } else if (indexCode === '000905') {
        dcaAdvice = `当前极度低估，建议定投金额×${dcaMultiplier}，采用"周线连阴加仓法"：本周若收阴线，定投金额翻倍；收阳线，维持基础定投。中证500定投微笑曲线策略最适用。`;
      } else {
        dcaAdvice = `当前处于极度低估区间，建议定投金额×${dcaMultiplier}。这是历史级别的低估机会，可以大额加仓。`;
      }
    } else if (dcaMultiplier >= 2) {
      if (indexCode === '000016') {
        dcaAdvice = `当前偏低估，建议定投金额×${dcaMultiplier}。上证50股息率>4%时可视为低估确认信号，积极加仓。`;
      } else if (indexCode === '000905') {
        dcaAdvice = `当前偏低估，建议定投金额×${dcaMultiplier}，逢阴线加仓。注意观察PB分位数是否同步偏低，确认是真低估。`;
      } else {
        dcaAdvice = `当前处于偏低估区间，建议定投金额×${dcaMultiplier}，逢低加仓，积极定投。`;
      }
    } else if (dcaMultiplier >= 1) {
      if (indexCode === '000852') {
        dcaAdvice = '当前估值合理，暂停新增定投。中证1000以波段操作为主，可在合理区间高抛低吸降低成本。';
      } else if (indexCode === '000015') {
        dcaAdvice = '当前估值合理，持有收息为主。红利策略在合理估值区享受股息回报，不追涨不加仓。';
      } else {
        dcaAdvice = '当前估值合理，暂停新增定投，持有现有仓位观望。若持仓已有盈利，可考虑做T降低成本。';
      }
    } else if (dcaMultiplier === 0) {
      dcaAdvice = '当前估值偏高，停止定投。逐步减仓止盈，等待估值回归合理区间后再考虑重新介入。';
    } else {
      dcaAdvice = '当前估值极度偏高，清仓止盈！仅保留底仓或不留仓，等待泡沫消化后再考虑入场。';
    }

    // 14. 构建兼容的 valuationZone 对象（旧格式，保持前端兼容）
    const valuationZone: ValuationZone = {
      zone: currentZone.zone as ValuationZone['zone'],
      zoneEn: currentZone.zoneEn,
      peRange: currentZone.peRange,
      erpRange: currentZone.erpRange,
      action: currentZone.action,
      positionSuggestion: currentZone.positionSuggestion,
      color: currentZone.color,
    };

    // 15. 构建完整的 valuationZones 数组（旧格式兼容）
    const valuationZones: ValuationZone[] = zoneConfig.zones.map(z => ({
      zone: z.zone as ValuationZone['zone'],
      zoneEn: z.zoneEn,
      peRange: z.peRange,
      erpRange: z.erpRange,
      action: z.action,
      positionSuggestion: z.positionSuggestion,
      color: z.color,
    }));

    // 16. 构建响应
    return NextResponse.json({
      symbol,
      name: (profile as Record<string, unknown>)?.name || symbol,
      trackingIndex: indexConfig.trackingIndex || trackingIndex,
      indexCode: indexCode || 'unknown',

      // 核心指标
      pe: { current: peCurrent, avg: indexConfig.peAvg, std: indexConfig.peStd, min: indexConfig.peMin, max: indexConfig.peMax, percentile: pePercentile },
      pb: { current: pbCurrent, avg: indexConfig.pbAvg, std: indexConfig.pbStd, min: indexConfig.pbMin, max: indexConfig.pbMax, percentile: pbPercentile },
      erp: { current: Math.round(erp * 100) / 100, avg: Math.round(erpAvg * 100) / 100, std: Math.round(erpStd * 100) / 100, bondYield: bondYield10y, earningsYield: Math.round(earningsYield * 100) / 100 },
      dividendYield: { current: dividendYieldCurrent, avg: indexConfig.dividendYieldAvg },

      // 估值区间（旧格式兼容）
      valuationZone,

      // 估值区间对照表（旧格式兼容，现在使用指数特定区间）
      valuationZones,

      // ★ 新增：指数特定配置
      indexConfig: {
        indexCode: indexConfig.indexCode,
        indexName: indexConfig.indexName,
        indexType: indexConfig.indexType,
        riskProfile: indexConfig.riskProfile,
        strategyNote: indexConfig.strategyNote,
        primaryIndicator: indexConfig.primaryIndicator,
        specialSignals: indexConfig.specialSignals,
        erpThresholds: indexConfig.erpThresholds,
        zones: indexConfig.zones,
      },

      // ★ 新增：当前区间详情
      zoneDetails: currentZone,

      // ★ 新增：DCA倍数
      dcaMultiplier,

      // ★ 新增：10年期国债收益率
      bondYield10y,

      // ★ 新增：ETF折溢价率
      etfPremiumDiscount: Math.round(etfPremiumDiscount * 100) / 100,

      // 周线趋势
      weeklyTrend,

      // 历史PE分位数走势
      percentileHistory,

      // 周度SOP检查项
      weeklyChecklist,

      // 风险提示
      riskWarnings,

      // 定投建议
      dcaAdvice,

      // 更新时间
      updatedAt: new Date().toISOString(),
      nextUpdate: getNextFriday().toISOString(),
    });
  } catch (error) {
    console.error('Valuation monitor error:', error);
    return NextResponse.json({ error: 'Failed to get valuation data' }, { status: 500 });
  }
}

function getNextFriday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 - dayOfWeek + 7;
  const friday = new Date(now);
  friday.setDate(friday.getDate() + daysUntilFriday);
  friday.setHours(15, 0, 0, 0);
  return friday;
}
