import { NextRequest, NextResponse } from 'next/server';
import { routeStrategies, getRegimeDescription } from '@/lib/strategy-router';
import { detectMarketRegime } from '@/lib/market-regime';
import type { MarketRegime, UserPreference } from '@/lib/strategy-config';
import { strategyConfigToApiFormat } from '@/lib/strategy-config';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;

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
 * 获取K线数据用于市场状态检测
 */
async function fetchKlineForRegime(symbol: string) {
  const apiKey = await getFinnhubApiKey();
  if (!apiKey) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 180 * 86400;

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
    // 获取失败
  }
  return null;
}

/** 生成模拟K线 */
function generateMockKline(currentPrice: number, days: number = 90) {
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
 * GET /api/fusion/strategies/recommend
 * 基于市场状态推荐策略
 * 查询参数：symbol（必填），riskTolerance（可选：conservative/moderate/aggressive）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const riskTolerance = (searchParams.get('riskTolerance') || 'moderate') as UserPreference['riskTolerance'];

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // 1. 获取K线数据
    let currentPrice = 150;
    const apiKey = await getFinnhubApiKey();
    if (apiKey) {
      try {
        const quoteRes = await fetchWithTimeout(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
          FINNHUB_TIMEOUT
        );
        if (quoteRes.ok) {
          const quoteData = await quoteRes.json();
          if (quoteData.c && quoteData.c > 0) currentPrice = quoteData.c;
        }
      } catch {
        // 使用默认价格
      }
    }

    let klineData = await fetchKlineForRegime(symbol.toUpperCase());
    if (!klineData) {
      klineData = generateMockKline(currentPrice);
    }

    // 2. 检测市场状态
    const regimeResult = detectMarketRegime(klineData);

    // 3. 路由推荐策略
    const preference: UserPreference = { riskTolerance };
    const recommendations = routeStrategies(regimeResult.regime, preference);

    // 4. 返回结果
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      marketRegime: {
        ...regimeResult,
        description: getRegimeDescription(regimeResult.regime),
      },
      recommendations: recommendations.map((r) => ({
        strategy: strategyConfigToApiFormat(r.strategy),
        matchScore: r.matchScore,
        reason: r.reason,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[fusion/strategies/recommend] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get strategy recommendations' },
      { status: 500 }
    );
  }
}
