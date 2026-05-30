import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById, strategyConfigToApiFormat } from '@/lib/strategy-config';
import { computeIndicators, executeStrategy } from '@/lib/strategy-engine';
import { detectMarketRegime } from '@/lib/market-regime';
import type { KlineData } from '@/lib/market-regime';
import { createChatCompletion } from '@/lib/ai-service';
import type { ChatMessage } from '@/lib/ai-service';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
import { db } from '@/lib/db';

const FINNHUB_TIMEOUT = 8000;

interface StrategyExecuteRequest {
  strategyId: string;
  symbol: string;
  parameters?: Record<string, string | number>;
  mode?: 'paper' | 'live';
  /** Custom strategy details (sent from client for custom strategies) */
  customStrategy?: {
    name: string;
    entryConditions: string[];
    exitConditions: string[];
    description?: string;
  };
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

/**
 * 获取K线数据用于策略计算
 */
async function fetchKlineData(symbol: string): Promise<KlineData | null> {
  const apiKey = await getFinnhubApiKey();
  if (!apiKey) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 180 * 86400; // 180天

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${apiKey}`;
    const res = await fetchWithTimeout(url, FINNHUB_TIMEOUT);

    if (res.ok) {
      const data = await res.json();
      if (data.s === 'ok' && data.c && data.c.length > 0) {
        return {
          closes: data.c as number[],
          highs: data.h as number[],
          lows: data.l as number[],
          volumes: data.v as number[],
        };
      }
    }
  } catch {
    // K线获取失败
  }
  return null;
}

/**
 * 生成模拟K线数据（当API不可用时）
 */
function generateMockKline(currentPrice: number, days: number = 90): KlineData {
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];

  let price = currentPrice * (0.85 + Math.random() * 0.1);

  for (let i = 0; i < days; i++) {
    const drift = (currentPrice - price) / (days - i) * 0.3;
    const volatility = price * 0.02;
    const change = drift + (Math.random() - 0.5) * volatility;

    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(30000000 + Math.random() * 70000000);

    closes.push(parseFloat(close.toFixed(2)));
    highs.push(parseFloat(high.toFixed(2)));
    lows.push(parseFloat(low.toFixed(2)));
    volumes.push(volume);

    price = close;
  }

  return { closes, highs, lows, volumes };
}

/**
 * 获取当前报价
 */
async function getCurrentPrice(symbol: string): Promise<number> {
  const apiKey = await getFinnhubApiKey();
  if (!apiKey) return 150;

  try {
    const quoteRes = await fetchWithTimeout(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
      FINNHUB_TIMEOUT
    );
    if (quoteRes.ok) {
      const quoteData = await quoteRes.json();
      if (quoteData.c && quoteData.c > 0) return quoteData.c;
    }
  } catch {
    // 报价获取失败
  }
  return 150;
}

export async function POST(request: NextRequest) {
  try {
    const body: StrategyExecuteRequest = await request.json();
    const { strategyId, symbol, mode = 'paper', customStrategy } = body;

    if (!strategyId || !symbol) {
      return NextResponse.json(
        { error: 'strategyId and symbol are required' },
        { status: 400 }
      );
    }

    const isCustom = strategyId.startsWith('custom-');

    // 1. 获取策略配置（仅内置策略）
    let strategyConfig = isCustom ? null : getStrategyById(strategyId);

    // If not a built-in strategy and not a custom- prefix, check the database
    let isDbCustom = false;
    let resolvedCustomStrategy = customStrategy;
    if (!strategyConfig && !isCustom) {
      const dbStrategy = await db.strategy.findUnique({ where: { id: strategyId } });
      if (dbStrategy && !dbStrategy.isBuiltin) {
        // This is a custom strategy from DB — treat it as custom
        isDbCustom = true;
        try {
          const config = JSON.parse(dbStrategy.config);
          resolvedCustomStrategy = {
            name: dbStrategy.name,
            entryConditions: config.entryCondition ? config.entryCondition.split('；') : [],
            exitConditions: config.exitCondition ? config.exitCondition.split('；') : [],
            description: dbStrategy.description || '',
          };
        } catch {
          resolvedCustomStrategy = {
            name: dbStrategy.name,
            entryConditions: [],
            exitConditions: [],
            description: dbStrategy.description || '',
          };
        }
      }
    }

    const shouldUseAiAnalysis = isCustom || isDbCustom;

    // 2. 获取K线数据
    let currentPrice = await getCurrentPrice(symbol.toUpperCase());
    let klineData = await fetchKlineData(symbol.toUpperCase());

    if (!klineData) {
      klineData = generateMockKline(currentPrice);
    }

    // 3. 计算技术指标
    const indicators = computeIndicators(
      klineData.closes,
      klineData.highs,
      klineData.lows,
      klineData.volumes
    );

    // 4. 检测市场状态
    const regimeResult = detectMarketRegime(klineData);

    // 5. 用AI分析（所有策略都使用AI增强，自定义策略使用AI作为核心分析）
    let aiReasoning = '';
    let aiProvider = 'engine'; // 默认为引擎结果
    let signalAction = 'HOLD';
    let signalConfidence = 50;
    let signalReasoning = '';
    let signalEntryPrice = currentPrice;
    let signalStopLoss = currentPrice * 0.95;
    let signalTakeProfit = currentPrice * 1.15;
    let signalRiskRewardRatio = 1.5;
    let signalKeyLevels = {
      support: Math.min(indicators.lower, indicators.ma20),
      resistance: Math.max(indicators.upper, indicators.ma20),
    };
    let signalMatchedConditions: string[] = [];

    if (shouldUseAiAnalysis) {
      // ========== 自定义策略：使用AI作为核心分析 ==========
      try {
        const entryRules = resolvedCustomStrategy?.entryConditions?.join('；') || '无明确入场规则';
        const exitRules = resolvedCustomStrategy?.exitConditions?.join('；') || '无明确出场规则';

        const systemPrompt = `你是一个专业的量化交易策略分析助手。你需要根据用户自定义的策略规则、当前技术指标数据和市场状态，给出交易建议。

请严格按照以下JSON格式返回分析结果（不要包含markdown代码块标记）：
{
  "action": "BUY" 或 "SELL" 或 "HOLD",
  "confidence": 0-100的整数,
  "reasoning": "详细的分析推理，2-4句话",
  "stopLossPct": 2-10之间的止损百分比,
  "takeProfitPct": 5-30之间的止盈百分比
}`;

        const userPrompt = `策略名称：${resolvedCustomStrategy?.name || strategyId}
入场规则：${entryRules}
出场规则：${exitRules}
策略描述：${resolvedCustomStrategy?.description || '自定义策略'}

股票：${symbol.toUpperCase()}
当前价格：$${currentPrice.toFixed(2)}
市场状态：${regimeResult.regime}（置信度${regimeResult.confidence}%，趋势强度${regimeResult.trendStrength.toFixed(1)}）

技术指标：
- RSI=${indicators.rsi.toFixed(1)}
- MACD=${indicators.macd.toFixed(4)}，信号线=${indicators.signal.toFixed(4)}，柱状图=${indicators.histogram.toFixed(4)}
- 量比=${indicators.volumeRatio.toFixed(2)}
- MA5=$${indicators.ma5.toFixed(2)}，MA10=$${indicators.ma10.toFixed(2)}，MA20=$${indicators.ma20.toFixed(2)}
- 布林带：上轨=$${indicators.upper.toFixed(2)}，中轨=$${indicators.middle.toFixed(2)}，下轨=$${indicators.lower.toFixed(2)}
- KDJ：K=${indicators.k.toFixed(1)}，D=${indicators.d.toFixed(1)}，J=${indicators.j.toFixed(1)}
- 价格变化：${indicators.priceChangePct > 0 ? '+' : ''}${indicators.priceChangePct.toFixed(2)}%
- 回踩幅度：${indicators.pullbackPct.toFixed(2)}%

请根据策略规则和技术指标，判断当前是否应该执行交易，给出建议。`;

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        const result = await createChatCompletion({ messages });

        if (result.content) {
          const aiContent = result.content.trim();
          // Remove markdown code block markers if present
          const jsonStr = aiContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
          try {
            const parsed = JSON.parse(jsonStr);
            signalAction = parsed.action || 'HOLD';
            signalConfidence = Math.max(10, Math.min(95, parseInt(parsed.confidence) || 50));
            signalReasoning = parsed.reasoning || 'AI分析完成';
            const stopLossPct = parsed.stopLossPct || 5;
            const takeProfitPct = parsed.takeProfitPct || 15;

            if (signalAction === 'BUY') {
              signalStopLoss = currentPrice * (1 - stopLossPct / 100);
              signalTakeProfit = currentPrice * (1 + takeProfitPct / 100);
            } else if (signalAction === 'SELL') {
              signalStopLoss = currentPrice * (1 + stopLossPct / 100);
              signalTakeProfit = currentPrice * (1 - takeProfitPct / 100);
            } else {
              signalStopLoss = currentPrice * (1 - stopLossPct / 100);
              signalTakeProfit = currentPrice * (1 + takeProfitPct / 100);
            }

            signalRiskRewardRatio = Math.abs(signalTakeProfit - currentPrice) / Math.abs(currentPrice - signalStopLoss) || 0;
            signalMatchedConditions = (resolvedCustomStrategy?.entryConditions || []).filter(() => signalAction === 'BUY');
          } catch {
            // JSON parse failed, use AI text as reasoning
            signalReasoning = aiContent;
            signalAction = 'HOLD';
            signalConfidence = 50;
          }
          aiProvider = result.provider;
        }
      } catch {
        // AI不可用，使用组合信号引擎作为fallback
        signalReasoning = 'AI服务暂不可用，使用综合指标分析。';
        // Simple heuristic for custom strategies when AI is unavailable
        const buySignals: string[] = [];
        const sellSignals: string[] = [];

        if (indicators.rsi < 30) buySignals.push('RSI超卖');
        if (indicators.rsi > 70) sellSignals.push('RSI超买');
        if (indicators.ma5 > indicators.ma20 && indicators.prevMacd <= indicators.prevSignal && indicators.macd > indicators.signal) buySignals.push('MA金叉');
        if (indicators.ma5 < indicators.ma20 && indicators.prevMacd >= indicators.prevSignal && indicators.macd < indicators.signal) sellSignals.push('MA死叉');
        if (indicators.volumeRatio > 1.5 && indicators.priceChangePct > 0) buySignals.push('放量上涨');
        if (indicators.volumeRatio > 1.5 && indicators.priceChangePct < 0) sellSignals.push('放量下跌');

        if (buySignals.length >= 2) {
          signalAction = 'BUY';
          signalConfidence = 55 + buySignals.length * 5;
          signalReasoning = `综合指标建议买入：${buySignals.join('，')}`;
          signalMatchedConditions = buySignals;
        } else if (sellSignals.length >= 2) {
          signalAction = 'SELL';
          signalConfidence = 55 + sellSignals.length * 5;
          signalReasoning = `综合指标建议卖出：${sellSignals.join('，')}`;
          signalMatchedConditions = sellSignals;
        } else {
          signalAction = 'HOLD';
          signalConfidence = 40;
          signalReasoning = `综合指标建议观望。买入信号：${buySignals.join('，') || '无'}；卖出信号：${sellSignals.join('，') || '无'}`;
        }
        aiProvider = 'engine-fallback';
      }
    } else if (strategyConfig) {
      // ========== 内置策略：使用信号引擎 + AI增强 ==========
      const signal = executeStrategy(strategyConfig, indicators);
      signalAction = signal.action;
      signalConfidence = signal.confidence;
      signalReasoning = signal.reasoning;
      signalEntryPrice = signal.entryPrice;
      signalStopLoss = signal.stopLoss;
      signalTakeProfit = signal.takeProfit;
      signalRiskRewardRatio = signal.riskRewardRatio;
      signalKeyLevels = signal.keyLevels;
      signalMatchedConditions = signal.matchedConditions;

      // Try to enhance with AI
      try {
        const systemPrompt = `你是一个量化交易策略分析助手。根据策略信号引擎的计算结果，给出更深入的市场分析建议。请用中文回答，简洁专业。`;

        const userPrompt = `策略：${strategyConfig.displayName}（${strategyConfig.name}）
股票：${symbol.toUpperCase()}
当前价格：$${currentPrice.toFixed(2)}
市场状态：${regimeResult.regime}（置信度${regimeResult.confidence}%）
信号引擎结果：${signal.action}（置信度${signal.confidence}%）
信号推理：${signal.reasoning}
技术指标：RSI=${indicators.rsi.toFixed(1)}, MACD=${indicators.macd.toFixed(4)}, 量比=${indicators.volumeRatio.toFixed(2)}
MA5=$${indicators.ma5.toFixed(2)}, MA20=$${indicators.ma20.toFixed(2)}
布林带：上轨=$${indicators.upper.toFixed(2)}, 下轨=$${indicators.lower.toFixed(2)}
KDJ：K=${indicators.k.toFixed(1)}, D=${indicators.d.toFixed(1)}, J=${indicators.j.toFixed(1)}

请简要分析当前市场状况，是否同意信号引擎的${signal.action}建议，给出补充意见（2-3句话）。`;

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        const result = await createChatCompletion({ messages });

        if (result.content) {
          aiReasoning = result.content.trim();
          aiProvider = `${result.provider}+engine`;
        }
      } catch {
        // LLM不可用，使用引擎结果
      }
    } else {
      // 未知内置策略ID（不匹配任何内置策略，也不是custom-开头）
      return NextResponse.json(
        { error: `Strategy not found: ${strategyId}` },
        { status: 404 }
      );
    }

    // 6. 组合最终结果
    const finalReasoning = aiReasoning && !shouldUseAiAnalysis
      ? `${signalReasoning}\n\nAI补充分析：${aiReasoning}`
      : signalReasoning;

    return NextResponse.json({
      strategyId,
      symbol: symbol.toUpperCase(),
      action: signalAction,
      confidence: signalConfidence,
      reasoning: finalReasoning,
      entryPrice: parseFloat(signalEntryPrice.toFixed(2)),
      stopLoss: parseFloat(signalStopLoss.toFixed(2)),
      takeProfit: parseFloat(signalTakeProfit.toFixed(2)),
      riskRewardRatio: parseFloat(signalRiskRewardRatio.toFixed(2)),
      keyLevels: {
        support: parseFloat(signalKeyLevels.support.toFixed(2)),
        resistance: parseFloat(signalKeyLevels.resistance.toFixed(2)),
      },
      matchedConditions: signalMatchedConditions,
      warnings: [
        'This is a paper trading recommendation',
        'Always verify signals with additional analysis',
      ],
      marketRegime: regimeResult,
      strategyInfo: strategyConfig ? strategyConfigToApiFormat(strategyConfig) : {
        id: strategyId,
        name: resolvedCustomStrategy?.name || strategyId,
        type: 'custom',
        description: resolvedCustomStrategy?.description || '',
      },
      parameters: body.parameters || {},
      mode,
      provider: aiProvider,
    });
  } catch (error) {
    console.error('[fusion/strategies/execute] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute strategy' },
      { status: 500 }
    );
  }
}
