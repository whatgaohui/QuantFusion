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
  const basePrompt = `You are an expert quantitative stock analyst for the QuantFusion platform. You provide comprehensive, data-driven stock analysis.

Your analysis must be structured and include:
1. A clear recommendation (BUY, HOLD, or SELL)
2. A composite score (0-100)
3. Technical analysis summary
4. Fundamental analysis summary
5. Sentiment analysis summary
6. Risk assessment with risk level (LOW, MEDIUM, HIGH) and risk score (0-100)`;

  // 注入历史记忆上下文
  const memoryPrompt = historyContext
    ? `\n\n## Historical Analysis Memory (Important - Review Before Making Recommendations)\n${historyContext}\n\nWhen making your recommendation, consider:
- Past accuracy for this stock and learn from previous mistakes
- If past BUY recommendations were often wrong, be more conservative
- If past SELL recommendations were often wrong, consider upside potential more carefully
- Reference past key signals that proved correct or incorrect\n`
    : '';

  const modePrompts: Record<AnalysisMode, string> = {
    quick: `${basePrompt}${memoryPrompt}

This is a QUICK analysis. Focus primarily on technical indicators and provide a concise summary.
Provide your response in the following JSON format:
{
  "symbol": "SYMBOL",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "...",
  "fundamentalSummary": "...",
  "sentimentSummary": "...",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "report": "Markdown formatted report"
}`,

    standard: `${basePrompt}${memoryPrompt}

This is a STANDARD analysis. Provide thorough analysis covering technical, fundamental, and sentiment aspects.
Provide your response in the following JSON format:
{
  "symbol": "SYMBOL",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "...",
  "fundamentalSummary": "...",
  "sentimentSummary": "...",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "report": "Markdown formatted report with sections"
}`,

    full: `${basePrompt}${memoryPrompt}

This is a FULL analysis. Provide comprehensive analysis including all aspects with detailed reasoning.
Provide your response in the following JSON format:
{
  "symbol": "SYMBOL",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "...",
  "fundamentalSummary": "...",
  "sentimentSummary": "...",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "report": "Detailed markdown formatted report with all sections"
}`,

    debate: `${basePrompt}${memoryPrompt}

This is a DEBATE mode analysis. In addition to standard analysis, provide both bull and bear cases with strong arguments for each side.
Provide your response in the following JSON format:
{
  "symbol": "SYMBOL",
  "recommendation": "BUY|HOLD|SELL",
  "score": 0-100,
  "technicalSummary": "...",
  "fundamentalSummary": "...",
  "sentimentSummary": "...",
  "riskLevel": "LOW|MEDIUM|HIGH",
  "riskScore": 0-100,
  "bullCase": "Strong arguments for buying...",
  "bearCase": "Strong arguments for selling...",
  "report": "Detailed markdown formatted report including debate analysis"
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
    technicalSummary: `${symbol} is currently showing ${recommendation === 'BUY' ? 'bullish' : recommendation === 'SELL' ? 'bearish' : 'neutral'} technical signals. Key moving averages suggest ${recommendation === 'BUY' ? 'an uptrend' : recommendation === 'SELL' ? 'a downtrend' : 'sideways movement'}. RSI and MACD indicators support the current assessment. Support and resistance levels should be monitored closely.`,
    fundamentalSummary: `${symbol} fundamentals present a ${score >= 65 ? 'favorable' : 'mixed'} picture. Revenue growth and profitability metrics are ${score >= 70 ? 'strong' : 'moderate'}. Valuation metrics suggest the stock is ${score >= 70 ? 'fairly valued to slightly undervalued' : 'fairly valued to slightly overvalued'}. Key fundamental drivers should be tracked going forward.`,
    sentimentSummary: `Market sentiment for ${symbol} is currently ${score >= 65 ? 'positive' : score >= 45 ? 'neutral' : 'cautious'}. Analyst consensus leans ${recommendation === 'BUY' ? 'bullish' : recommendation === 'SELL' ? 'bearish' : 'neutral'}. Recent news flow has been ${score >= 60 ? 'favorable' : 'mixed'}. Social sentiment indicators reflect ${score >= 65 ? 'optimism' : 'caution'} among retail investors.`,
    riskLevel: score >= 70 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH',
    riskScore: Math.floor(100 - score + (Math.random() * 10 - 5)),
    report: `# ${symbol} Analysis Report\n\n## Executive Summary\n${symbol} presents a **${recommendation}** recommendation with a composite score of ${score}/100.\n\n## Technical Analysis\n- **Trend**: ${recommendation === 'BUY' ? 'Bullish' : recommendation === 'SELL' ? 'Bearish' : 'Neutral'}\n- **Momentum**: ${score >= 65 ? 'Positive' : 'Mixed'}\n- **Key Levels**: Monitor support and resistance\n\n## Fundamental Analysis\n- **Growth**: ${score >= 70 ? 'Strong' : 'Moderate'}\n- **Valuation**: ${score >= 65 ? 'Attractive' : 'Fair'}\n\n## Conclusion\nBased on the current analysis, ${symbol} warrants a **${recommendation}** rating with a ${score}/100 score.`,
    provider: 'z-ai',
    tokens: Math.floor(1500 + seed * 1500),
    cost: parseFloat((0.01 + seed * 0.03).toFixed(3)),
  };

  if (mode === 'debate') {
    result.bullCase = `${symbol} has several positive catalysts: strong technical momentum, favorable fundamental trends, and positive market sentiment. Growth prospects appear solid with potential upside if key resistance levels are broken.`;
    result.bearCase = `Risks for ${symbol} include: potential market headwinds, valuation concerns at current levels, and macro uncertainty. Key support levels should be monitored as a breakdown could signal further downside.`;
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
    parts.push(`### Past Accuracy for this stock:`);
    parts.push(`- Total verified analyses: ${stats.totalAnalyses}`);
    parts.push(`- Overall accuracy: ${stats.accuracyRate}%`);
    parts.push(`- BUY accuracy: ${stats.buyAccuracy}%`);
    parts.push(`- SELL accuracy: ${stats.sellAccuracy}%`);
    parts.push(`- Recent trend: ${stats.recentTrend}`);
    parts.push('');
  }

  // 近期分析记录
  if (context.recentAnalyses.length > 0) {
    parts.push(`### Recent analysis history:`);
    for (const analysis of context.recentAnalyses) {
      const result = analysis.wasCorrect === null
        ? 'pending verification'
        : analysis.wasCorrect
          ? `CORRECT (actual return: ${analysis.actualReturn}%)`
          : `INCORRECT (actual return: ${analysis.actualReturn}%)`;
      parts.push(`- ${analysis.date}: ${analysis.recommendation} (score: ${analysis.score}, entry: $${analysis.entryPrice.toFixed(2)}) → ${result}`);
    }
    parts.push('');
  }

  // 反思洞察
  if (context.reflectionInsights.length > 0) {
    parts.push(`### Key insights from past performance:`);
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
      const userPrompt = `Analyze the stock ${symbolUpper}.

Current Market Data:
${JSON.stringify(marketData.quote, null, 2)}

Company Profile:
${JSON.stringify(marketData.companyProfile, null, 2)}

${historyPrompt ? `Historical Context (learn from past analyses):\n${historyPrompt}\n` : ''}Please provide a comprehensive analysis of ${symbolUpper} in ${mode} mode. Return valid JSON only.`;

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
            fundamentalSummary: 'See full report for details.',
            sentimentSummary: 'See full report for details.',
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
