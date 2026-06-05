import { NextRequest, NextResponse } from 'next/server';
import { saveAnalysis, getHistoryContext, backfillReturns } from '@/lib/agent-memory';
import { createChatCompletion } from '@/lib/ai-service';
import type { ChatMessage } from '@/lib/ai-service';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;
const AI_CALL_TIMEOUT = 30000; // 30s timeout for z-ai SDK call
const HISTORY_CONTEXT_TIMEOUT = 5000; // 5s timeout for history context fetch
const BACKFILL_TIMEOUT = 5000; // 5s timeout for backfill returns

type AnalysisMode = 'quick' | 'standard' | 'full' | 'debate';

interface AnalysisRequest {
  symbol: string;
  mode?: AnalysisMode;
}

/**
 * Wrap a promise with a timeout. Returns default value on timeout or error.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  defaultValue: T,
  label?: string
): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[fusion/analysis/start] Timeout after ${ms}ms for: ${label || 'unnamed'}`);
      resolve(defaultValue);
    }, ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.warn(`[fusion/analysis/start] Error in ${label || 'unnamed'}:`, err?.message || err);
        resolve(defaultValue);
      });
  });
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function getMarketData(symbol: string) {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  let quote: Record<string, unknown> = {};
  let companyProfile: Record<string, unknown> = {};

  if (FINNHUB_API_KEY) {
    try {
      const [quoteRes, profileRes] = await Promise.allSettled([
        fetchWithTimeout(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
          FINNHUB_TIMEOUT
        ),
        fetchWithTimeout(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
          FINNHUB_TIMEOUT
        ),
      ]);

      if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
        quote = await quoteRes.value.json();
      }
      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        companyProfile = await profileRes.value.json();
      }
    } catch {
      // Use empty data
    }
  }

  return { quote, companyProfile };
}

/**
 * 构建包含历史记忆上下文的系统提示
 */
function buildSystemPrompt(mode: AnalysisMode, historyContext?: string): string {
  const basePrompt = `你是一位专业的量化股票分析师，提供全面、数据驱动的股票分析。请使用中文进行分析和输出。

你的分析必须结构化，包含以下内容：
1. 明确的投资建议（BUY买入、HOLD持有、SELL卖出）
2. 综合评分（0-100）
3. 技术面分析摘要
4. 基本面分析摘要
5. 市场情绪分析摘要
6. 风险评估，包含风险等级（LOW低、MEDIUM中、HIGH高）和风险评分（0-100）`;

  // 注入历史记忆上下文
  const memoryPrompt = historyContext
    ? `\n\n## 历史分析记忆（重要 - 做出建议前请先回顾）\n${historyContext}\n\n在给出建议时，请注意：
- 回顾该股票过去的预测准确率，从过去的错误中学习
- 如果过去的买入建议经常出错，请更加保守
- 如果过去的卖出建议经常出错，请更多考虑上行潜力
- 参考过去被证明正确或错误的关键信号\n`
    : '';

  const modePrompts: Record<AnalysisMode, string> = {
    quick: `${basePrompt}${memoryPrompt}

这是快速分析模式。主要聚焦技术指标，提供简洁的摘要。
请以以下JSON格式返回分析结果：
{
  "symbol": "股票代码",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "技术面分析摘要，中文",
  "fundamentalSummary": "基本面分析摘要，中文",
  "sentimentSummary": "情绪面分析摘要，中文",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "report": "Markdown格式的中文分析报告"
}`,

    standard: `${basePrompt}${memoryPrompt}

这是标准分析模式。请提供涵盖技术面、基本面和情绪面的全面分析。
请以以下JSON格式返回分析结果：
{
  "symbol": "股票代码",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "技术面分析摘要，中文",
  "fundamentalSummary": "基本面分析摘要，中文",
  "sentimentSummary": "情绪面分析摘要，中文",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "report": "Markdown格式的中文分析报告，包含多个章节"
}`,

    full: `${basePrompt}${memoryPrompt}

这是完整分析模式。请提供包含所有方面的全面分析，附详细推理过程。
请以以下JSON格式返回分析结果：
{
  "symbol": "股票代码",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "技术面分析摘要，中文",
  "fundamentalSummary": "基本面分析摘要，中文",
  "sentimentSummary": "情绪面分析摘要，中文",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "report": "详细的Markdown格式中文分析报告，包含所有章节"
}`,

    debate: `${basePrompt}${memoryPrompt}

这是辩论分析模式。除标准分析外，请提供看多和看空双方的强力论据。
请以以下JSON格式返回分析结果：
{
  "symbol": "股票代码",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "技术面分析摘要，中文",
  "fundamentalSummary": "基本面分析摘要，中文",
  "sentimentSummary": "情绪面分析摘要，中文",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "bullCase": "看多论据，中文",
  "bearCase": "看空论据，中文",
  "report": "详细的Markdown格式中文分析报告，包含辩论分析"
}`,
  };

  return modePrompts[mode] || modePrompts.standard;
}

function generateMockAnalysis(symbol: string, mode: AnalysisMode) {
  const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = (hash % 100) / 100;
  const score = Math.floor(55 + seed * 35);
  const recommendation = score >= 70 ? 'BUY' : score >= 50 ? 'HOLD' : 'SELL';

  const result: Record<string, unknown> = {
    symbol,
    recommendation,
    score,
    technicalSummary: `${symbol}目前呈现${recommendation === 'BUY' ? '看多' : recommendation === 'SELL' ? '看空' : '中性'}技术信号。关键均线暗示${recommendation === 'BUY' ? '上升趋势' : recommendation === 'SELL' ? '下降趋势' : '横盘整理'}。RSI和MACD指标支持当前判断。支撑位和阻力位需要密切关注。`,
    fundamentalSummary: `${symbol}的基本面呈现${score >= 65 ? '有利' : '参差'}的图景。营收增长和盈利能力指标${score >= 70 ? '强劲' : '中等'}。估值指标表明该股票${score >= 70 ? '估值合理至略微低估' : '估值合理至略微高估'}。需持续跟踪核心基本面驱动因素。`,
    sentimentSummary: `${symbol}的市场情绪目前${score >= 65 ? '偏正面' : score >= 45 ? '中性' : '偏谨慎'}。分析师共识倾向于${recommendation === 'BUY' ? '看多' : recommendation === 'SELL' ? '看空' : '中性'}。近期新闻流${score >= 60 ? '较为积极' : '喜忧参半'}。散户投资者情绪指标反映${score >= 65 ? '乐观' : '谨慎'}态度。`,
    riskLevel: score >= 70 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH',
    riskScore: Math.floor(100 - score + (Math.random() * 10 - 5)),
    report: `# ${symbol} 分析报告\n\n## 概要\n${symbol}给出**${recommendation === 'BUY' ? '买入' : recommendation === 'SELL' ? '卖出' : '持有'}**建议，综合评分 ${score}/100。\n\n## 技术分析\n- **趋势**：${recommendation === 'BUY' ? '看多' : recommendation === 'SELL' ? '看空' : '中性'}\n- **动能**：${score >= 65 ? '正面' : '混合'}\n- **关键位置**：关注支撑位和阻力位\n\n## 基本面分析\n- **成长性**：${score >= 70 ? '强劲' : '中等'}\n- **估值**：${score >= 65 ? '有吸引力' : '合理'}\n\n## 结论\n基于当前分析，${symbol}评级为**${recommendation === 'BUY' ? '买入' : recommendation === 'SELL' ? '卖出' : '持有'}**，评分 ${score}/100。`,
    provider: 'z-ai',
    tokens: Math.floor(1500 + seed * 1500),
    cost: parseFloat((0.01 + seed * 0.03).toFixed(3)),
  };

  if (mode === 'debate') {
    result.bullCase = `${symbol}有几个积极催化剂：强劲的技术动量、有利的基本面趋势和正面的市场情绪。若关键阻力位突破，增长前景看好，存在上行空间。`;
    result.bearCase = `${symbol}面临的风险包括：潜在的市场逆风、当前价位的估值担忧以及宏观不确定性。需密切关注关键支撑位，跌破可能预示进一步下行。`;
  }

  return result;
}

/**
 * 构建历史记忆上下文字符串(注入user prompt)
 */
function buildHistoryContextPrompt(context: {
  hasHistory: boolean;
  recentAnalyses: {
    date: string;
    recommendation: string;
    score: number;
    entryPrice: number;
    actualReturn: number | null;
    wasCorrect: boolean | null;
  }[];
  accuracyStats: {
    accuracyRate: number;
    totalAnalyses: number;
    buyAccuracy: number;
    sellAccuracy: number;
    recentTrend: string;
  } | null;
  reflectionInsights: string[];
}): string {
  if (!context.hasHistory) return '';

  const parts: string[] = [];

  // 准确率概览
  if (context.accuracyStats) {
    const stats = context.accuracyStats;
    parts.push(`### 该股票的历史预测准确率：`);
    parts.push(`- 已验证的分析总数：${stats.totalAnalyses}`);
    parts.push(`- 整体准确率：${stats.accuracyRate}%`);
    parts.push(`- 买入建议准确率：${stats.buyAccuracy}%`);
    parts.push(`- 卖出建议准确率：${stats.sellAccuracy}%`);
    parts.push(`- 近期趋势：${stats.recentTrend}`);
    parts.push('');
  }

  // 近期分析记录
  if (context.recentAnalyses.length > 0) {
    parts.push(`### 近期分析历史：`);
    for (const analysis of context.recentAnalyses) {
      const result = analysis.wasCorrect === null
        ? '待验证'
        : analysis.wasCorrect
          ? `正确（实际收益：${analysis.actualReturn}%）`
          : `错误（实际收益：${analysis.actualReturn}%）`;
      parts.push(`- ${analysis.date}：${analysis.recommendation}（评分：${analysis.score}，入场价：$${analysis.entryPrice.toFixed(2)}）→ ${result}`);
    }
    parts.push('');
  }

  // 反思洞察
  if (context.reflectionInsights.length > 0) {
    parts.push(`### 从历史表现中获得的关键洞察：`);
    for (const insight of context.reflectionInsights) {
      parts.push(`- ${insight}`);
    }
  }

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { symbol, mode = 'standard' } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const symbolUpper = symbol.toUpperCase();

    // Fetch market data first (needed for both AI and mock paths)
    // Use withTimeout to prevent hanging on Finnhub API
    const marketData = await withTimeout(
      getMarketData(symbolUpper),
      FINNHUB_TIMEOUT + 2000, // slightly more than Finnhub timeout
      { quote: {}, companyProfile: {} },
      'getMarketData'
    );

    const currentPrice = (marketData.quote as Record<string, unknown>)?.c as number | undefined;

    // Fire-and-forget backfill — must NOT block the response
    if (currentPrice && currentPrice > 0) {
      withTimeout(
        backfillReturns(symbolUpper, currentPrice),
        BACKFILL_TIMEOUT,
        undefined,
        'backfillReturns'
      ).catch(() => {}); // swallow completely
    }

    // Fetch history context with timeout — must NOT block the response if it hangs
    const defaultHistoryContext = {
      hasHistory: false,
      recentAnalyses: [],
      accuracyStats: null,
      reflectionInsights: [],
    };
    const historyContext = await withTimeout(
      getHistoryContext(symbolUpper),
      HISTORY_CONTEXT_TIMEOUT,
      defaultHistoryContext,
      'getHistoryContext'
    );
    const historyPrompt = buildHistoryContextPrompt(historyContext);

    // Try to use AI service (routes through user's configured provider) for analysis
    try {
      const systemPrompt = buildSystemPrompt(mode, historyPrompt);
      const userPrompt = `请分析股票 ${symbolUpper}。

当前市场数据：
${JSON.stringify(marketData.quote, null, 2)}

公司概况：
${JSON.stringify(marketData.companyProfile, null, 2)}

${historyPrompt ? `历史分析上下文（从过去的分析中学习）：\n${historyPrompt}\n` : ''}请以${mode === 'quick' ? '快速' : mode === 'standard' ? '标准' : mode === 'full' ? '完整' : '辩论'}模式对 ${symbolUpper} 进行全面分析，仅返回有效的JSON。`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Use the unified AI service with timeout
      const aiResult = await withTimeout(
        createChatCompletion({ messages }),
        AI_CALL_TIMEOUT,
        null,
        'createChatCompletion'
      );

      if (aiResult && aiResult.content) {
        let content = aiResult.content;

        // Try to parse JSON from the response
        try {
          // Handle markdown code blocks
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            content = jsonMatch[1].trim();
          }

          const parsed = JSON.parse(content);

          // Fire-and-forget save — must NOT block the response
          const entryPrice = currentPrice || (marketData.quote as Record<string, unknown>)?.c as number || 0;
          saveAnalysis({
            symbol: symbolUpper,
            market: 'US',
            recommendation: parsed.recommendation || 'HOLD',
            score: parsed.score || 50,
            entryPrice,
            analysisMode: mode,
            summary: parsed.technicalSummary || parsed.report?.slice(0, 200) || '',
            keySignals: [
              `Recommendation: ${parsed.recommendation}`,
              `Score: ${parsed.score}`,
              `Risk: ${parsed.riskLevel}`,
            ],
          }).catch(() => {});

          return NextResponse.json({
            ...parsed,
            symbol: symbolUpper,
            provider: aiResult.provider,
            tokens: aiResult.tokens,
            cost: aiResult.cost,
            // 附加历史记忆信息供前端显示
            memoryContext: {
              hasHistory: historyContext.hasHistory,
              accuracyRate: historyContext.accuracyStats?.accuracyRate || null,
              recentTrend: historyContext.accuracyStats?.recentTrend || null,
            },
          });
        } catch {
          // If JSON parsing fails, wrap the text response
          const entryPrice = currentPrice || 0;

          // Fire-and-forget save
          saveAnalysis({
            symbol: symbolUpper,
            market: 'US',
            recommendation: 'HOLD',
            score: 50,
            entryPrice,
            analysisMode: mode,
            summary: content.slice(0, 200),
          }).catch(() => {});

          return NextResponse.json({
            symbol: symbolUpper,
            recommendation: 'HOLD',
            score: 50,
            technicalSummary: content.slice(0, 500),
            fundamentalSummary: '详见完整报告。',
            sentimentSummary: '详见完整报告。',
            riskLevel: 'MEDIUM',
            riskScore: 50,
            report: content,
            provider: aiResult.provider,
            tokens: aiResult.tokens,
            cost: aiResult.cost,
            memoryContext: {
              hasHistory: historyContext.hasHistory,
              accuracyRate: historyContext.accuracyStats?.accuracyRate || null,
              recentTrend: historyContext.accuracyStats?.recentTrend || null,
            },
          });
        }
      }
    } catch (aiError) {
      console.error('[fusion/analysis/start] AI SDK error, falling back to mock:', aiError);
    }

    // Fallback to mock analysis
    const mockResult = generateMockAnalysis(symbolUpper, mode);

    // Fire-and-forget save — must NOT block the response
    const entryPrice = currentPrice || 0;
    saveAnalysis({
      symbol: symbolUpper,
      market: 'US',
      recommendation: mockResult.recommendation as string,
      score: mockResult.score as number,
      entryPrice,
      analysisMode: mode,
      summary: (mockResult.technicalSummary as string)?.slice(0, 200) || '',
      keySignals: [
        `Recommendation: ${mockResult.recommendation}`,
        `Score: ${mockResult.score}`,
        `Risk: ${mockResult.riskLevel}`,
      ],
    }).catch(() => {});

    return NextResponse.json({
      ...mockResult,
      memoryContext: {
        hasHistory: historyContext.hasHistory,
        accuracyRate: historyContext.accuracyStats?.accuracyRate || null,
        recentTrend: historyContext.accuracyStats?.recentTrend || null,
      },
    });
  } catch (error) {
    console.error('[fusion/analysis/start] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    );
  }
}
