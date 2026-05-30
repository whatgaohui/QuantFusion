/**
 * Agent记忆与反思系统
 * 保存分析结果到数据库，提取关键信号
 * 计算历史准确率，生成反思摘要
 */

import { db } from './db';

/** 记忆数据结构 */
export interface AnalysisMemory {
  symbol: string;
  market: string;
  recommendation: string;  // BUY / HOLD / SELL
  score: number;           // 0-100
  entryPrice: number;
  analysisMode: string;
  summary?: string;
  keySignals?: string[];   // 关键信号列表
}

/** 准确率统计结果 */
export interface AccuracyStats {
  symbol: string;
  totalAnalyses: number;
  correctCount: number;
  accuracyRate: number;     // 0-100
  buyAccuracy: number;
  holdAccuracy: number;
  sellAccuracy: number;
  avgScoreCorrect: number;
  avgScoreIncorrect: number;
  recentTrend: 'improving' | 'declining' | 'stable'; // 近期趋势
}

/** 反思摘要 */
export interface ReflectionSummary {
  symbol: string;
  overallAccuracy: number;
  totalRecords: number;
  insights: string[];      // 反思洞察
  recentComparisons: {
    date: string;
    recommendation: string;
    score: number;
    entryPrice: number;
    actualReturn: number | null;
    wasCorrect: boolean | null;
  }[];
  suggestions: string[];   // 给AI的改进建议
}

/** 历史上下文(注入AI prompt) */
export interface HistoryContext {
  hasHistory: boolean;
  recentAnalyses: {
    date: string;
    recommendation: string;
    score: number;
    entryPrice: number;
    actualReturn: number | null;
    wasCorrect: boolean | null;
  }[];
  accuracyStats: AccuracyStats | null;
  reflectionInsights: string[];
}

/**
 * 保存分析结果到记忆库
 * 同时提取关键信号，创建AgentMemory记录
 */
export async function saveAnalysis(memory: AnalysisMemory): Promise<void> {
  try {
    await db.agentMemory.create({
      data: {
        symbol: memory.symbol.toUpperCase(),
        market: memory.market || 'US',
        recommendation: memory.recommendation,
        score: memory.score,
        entryPrice: memory.entryPrice,
        analysisMode: memory.analysisMode || 'standard',
        summary: memory.summary || null,
        keySignals: memory.keySignals ? JSON.stringify(memory.keySignals) : null,
        analysisDate: new Date(),
      },
    });
  } catch (error) {
    console.error('[agent-memory] 保存分析记忆失败:', error);
  }
}

/**
 * 获取某股票最近的N次分析
 */
export async function getRecentAnalyses(
  symbol: string,
  limit: number = 10
): Promise<AnalysisMemory[]> {
  try {
    const records = await db.agentMemory.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { analysisDate: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      symbol: r.symbol,
      market: r.market,
      recommendation: r.recommendation,
      score: r.score,
      entryPrice: r.entryPrice,
      analysisMode: r.analysisMode,
      summary: r.summary || undefined,
      keySignals: r.keySignals ? JSON.parse(r.keySignals) : undefined,
    }));
  } catch (error) {
    console.error('[agent-memory] 获取最近分析失败:', error);
    return [];
  }
}

/**
 * 计算某股票历史分析准确率
 * 准确判断规则：
 * - BUY建议 + 实际收益>0 => 正确
 * - SELL建议 + 实际收益<0 => 正确
 * - HOLD建议 + |实际收益|<3% => 正确
 */
export async function getAccuracyStats(symbol: string): Promise<AccuracyStats | null> {
  try {
    const records = await db.agentMemory.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        wasCorrect: { not: null },
      },
      orderBy: { analysisDate: 'desc' },
    });

    if (records.length === 0) return null;

    const totalAnalyses = records.length;
    const correctCount = records.filter((r) => r.wasCorrect === true).length;
    const accuracyRate = (correctCount / totalAnalyses) * 100;

    // 按建议类型统计
    const buyRecords = records.filter((r) => r.recommendation === 'BUY');
    const holdRecords = records.filter((r) => r.recommendation === 'HOLD');
    const sellRecords = records.filter((r) => r.recommendation === 'SELL');

    const buyAccuracy = buyRecords.length > 0
      ? (buyRecords.filter((r) => r.wasCorrect === true).length / buyRecords.length) * 100
      : 0;
    const holdAccuracy = holdRecords.length > 0
      ? (holdRecords.filter((r) => r.wasCorrect === true).length / holdRecords.length) * 100
      : 0;
    const sellAccuracy = sellRecords.length > 0
      ? (sellRecords.filter((r) => r.wasCorrect === true).length / sellRecords.length) * 100
      : 0;

    // 平均评分对比
    const correctRecords = records.filter((r) => r.wasCorrect === true);
    const incorrectRecords = records.filter((r) => r.wasCorrect === false);

    const avgScoreCorrect = correctRecords.length > 0
      ? correctRecords.reduce((s, r) => s + r.score, 0) / correctRecords.length
      : 0;
    const avgScoreIncorrect = incorrectRecords.length > 0
      ? incorrectRecords.reduce((s, r) => s + r.score, 0) / incorrectRecords.length
      : 0;

    // 近期趋势：对比最近5条与之前5条
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (records.length >= 10) {
      const recent5 = records.slice(0, 5);
      const prev5 = records.slice(5, 10);
      const recentAcc = recent5.filter((r) => r.wasCorrect === true).length / 5;
      const prevAcc = prev5.filter((r) => r.wasCorrect === true).length / 5;
      if (recentAcc > prevAcc + 0.1) recentTrend = 'improving';
      else if (recentAcc < prevAcc - 0.1) recentTrend = 'declining';
    }

    return {
      symbol: symbol.toUpperCase(),
      totalAnalyses,
      correctCount,
      accuracyRate: parseFloat(accuracyRate.toFixed(1)),
      buyAccuracy: parseFloat(buyAccuracy.toFixed(1)),
      holdAccuracy: parseFloat(holdAccuracy.toFixed(1)),
      sellAccuracy: parseFloat(sellAccuracy.toFixed(1)),
      avgScoreCorrect: parseFloat(avgScoreCorrect.toFixed(1)),
      avgScoreIncorrect: parseFloat(avgScoreIncorrect.toFixed(1)),
      recentTrend,
    };
  } catch (error) {
    console.error('[agent-memory] 计算准确率失败:', error);
    return null;
  }
}

/**
 * 生成反思摘要
 * 对比历史建议和实际结果，提取洞察和改进建议
 */
export async function reflectOnHistory(symbol: string): Promise<ReflectionSummary> {
  const emptyResult: ReflectionSummary = {
    symbol: symbol.toUpperCase(),
    overallAccuracy: 0,
    totalRecords: 0,
    insights: [],
    recentComparisons: [],
    suggestions: [],
  };

  try {
    const records = await db.agentMemory.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { analysisDate: 'desc' },
      take: 30,
    });

    if (records.length === 0) return emptyResult;

    const verifiedRecords = records.filter((r) => r.wasCorrect !== null);
    const totalRecords = records.length;
    const overallAccuracy = verifiedRecords.length > 0
      ? (verifiedRecords.filter((r) => r.wasCorrect === true).length / verifiedRecords.length) * 100
      : 0;

    // 生成反思洞察
    const insights: string[] = [];

    if (verifiedRecords.length >= 3) {
      const buyRecords = verifiedRecords.filter((r) => r.recommendation === 'BUY');
      const sellRecords = verifiedRecords.filter((r) => r.recommendation === 'SELL');

      if (buyRecords.length > 0) {
        const buyAcc = buyRecords.filter((r) => r.wasCorrect === true).length / buyRecords.length * 100;
        insights.push(buyAcc >= 60
          ? `看多建议准确率${buyAcc.toFixed(0)}%，表现较好`
          : `看多建议准确率仅${buyAcc.toFixed(0)}%，需更谨慎判断买入时机`);
      }

      if (sellRecords.length > 0) {
        const sellAcc = sellRecords.filter((r) => r.wasCorrect === true).length / sellRecords.length * 100;
        insights.push(sellAcc >= 60
          ? `看空建议准确率${sellAcc.toFixed(0)}%，风险识别能力较强`
          : `看空建议准确率仅${sellAcc.toFixed(0)}%，可能低估了反弹动力`);
      }

      // 评分与准确率关系
      const highScoreRecords = verifiedRecords.filter((r) => r.score >= 70);
      if (highScoreRecords.length > 0) {
        const highScoreAcc = highScoreRecords.filter((r) => r.wasCorrect === true).length / highScoreRecords.length * 100;
        insights.push(highScoreAcc >= 65
          ? `高评分(≥70)分析准确率${highScoreAcc.toFixed(0)}%，评分有参考价值`
          : `高评分(≥70)分析准确率仅${highScoreAcc.toFixed(0)}%，评分体系需优化`);
      }
    }

    if (insights.length === 0) {
      insights.push(`暂无足够已验证数据，需等待更多分析结果回填`);
    }

    // 近期对比记录
    const recentComparisons = records.slice(0, 10).map((r) => ({
      date: r.analysisDate.toISOString().split('T')[0],
      recommendation: r.recommendation,
      score: r.score,
      entryPrice: r.entryPrice,
      actualReturn: r.actualReturn,
      wasCorrect: r.wasCorrect,
    }));

    // 改进建议
    const suggestions: string[] = [];
    if (verifiedRecords.length >= 5) {
      const buyOnly = verifiedRecords.filter((r) => r.recommendation === 'BUY');
      if (buyOnly.length > verifiedRecords.length * 0.7) {
        suggestions.push('过去建议偏多，注意控制看多倾向，增加风险考量');
      }
      const sellOnly = verifiedRecords.filter((r) => r.recommendation === 'SELL');
      if (sellOnly.length > verifiedRecords.length * 0.5) {
        suggestions.push('看空建议占比较高，注意是否过度悲观');
      }
    }
    suggestions.push('结合更多技术指标交叉验证，提高建议可靠性');

    return {
      symbol: symbol.toUpperCase(),
      overallAccuracy: parseFloat(overallAccuracy.toFixed(1)),
      totalRecords,
      insights,
      recentComparisons,
      suggestions,
    };
  } catch (error) {
    console.error('[agent-memory] 生成反思摘要失败:', error);
    return emptyResult;
  }
}

/**
 * 回填实际收益率
 * 对比分析时的价格和当前价格，更新actualReturn和wasCorrect
 */
export async function backfillReturns(symbol: string, currentPrice: number): Promise<number> {
  try {
    // 查找未回填的记录
    const unverified = await db.agentMemory.findMany({
      where: {
        symbol: symbol.toUpperCase(),
        actualReturn: null,
        entryPrice: { gt: 0 },
      },
      orderBy: { analysisDate: 'asc' },
    });

    let updated = 0;
    for (const record of unverified) {
      const returnPct = ((currentPrice - record.entryPrice) / record.entryPrice) * 100;
      let wasCorrect: boolean | null = null;

      // 至少经过1个交易日后才判断
      const daysSince = (Date.now() - record.analysisDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= 1) {
        if (record.recommendation === 'BUY') wasCorrect = returnPct > 0;
        else if (record.recommendation === 'SELL') wasCorrect = returnPct < 0;
        else wasCorrect = Math.abs(returnPct) < 3; // HOLD: 波动<3%视为正确
      }

      if (wasCorrect !== null) {
        await db.agentMemory.update({
          where: { id: record.id },
          data: {
            actualReturn: parseFloat(returnPct.toFixed(2)),
            wasCorrect,
          },
        });
        updated++;
      }
    }
    return updated;
  } catch (error) {
    console.error('[agent-memory] 回填收益率失败:', error);
    return 0;
  }
}

/**
 * 获取历史上下文（注入AI prompt）
 * 包含近期分析记录、准确率统计、反思洞察
 */
export async function getHistoryContext(symbol: string): Promise<HistoryContext> {
  try {
    const recentRecords = await db.agentMemory.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { analysisDate: 'desc' },
      take: 5,
    });

    const accuracyStats = await getAccuracyStats(symbol);
    const reflection = await reflectOnHistory(symbol);

    return {
      hasHistory: recentRecords.length > 0,
      recentAnalyses: recentRecords.map((r) => ({
        date: r.analysisDate.toISOString().split('T')[0],
        recommendation: r.recommendation,
        score: r.score,
        entryPrice: r.entryPrice,
        actualReturn: r.actualReturn,
        wasCorrect: r.wasCorrect,
      })),
      accuracyStats,
      reflectionInsights: reflection.insights,
    };
  } catch (error) {
    console.error('[agent-memory] 获取历史上下文失败:', error);
    return {
      hasHistory: false,
      recentAnalyses: [],
      accuracyStats: null,
      reflectionInsights: [],
    };
  }
}
