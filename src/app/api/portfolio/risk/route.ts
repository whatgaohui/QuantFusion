import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const FINNHUB_TIMEOUT = 8000;

interface PositionWithPrice {
  id: string;
  symbol: string;
  market: string;
  side: string;
  avgCost: number;
  quantity: number;
  currentPrice: number;
  openedAt: Date;
}

interface RiskMetrics {
  var95: number;
  sharpeRatio: number;
  maxDrawdown: number;
  portfolioValue: number;
  dailyReturn: number;
  mock?: boolean;
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

async function fetchFinnhubQuote(symbol: string): Promise<number> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return 0;
  try {
    const response = await fetchWithTimeout(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
      FINNHUB_TIMEOUT
    );
    if (!response.ok) return 0;
    const data = await response.json();
    if (data.c && data.c > 0) return data.c;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch historical daily returns for a symbol from Finnhub kline data.
 * Returns an array of daily return percentages.
 */
async function fetchHistoricalReturns(symbol: string, days: number = 252): Promise<number[]> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return [];
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 86400;
    const response = await fetchWithTimeout(
      `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      FINNHUB_TIMEOUT
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (data.s !== 'ok' || !data.c || data.c.length < 2) return [];

    const closes: number[] = data.c;
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
    }
    return returns;
  } catch {
    return [];
  }
}

/**
 * Calculate parametric VaR (95%) using mean - 1.645 * std approach.
 */
function calculateParametricVaR(returns: number[], portfolioValue: number): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  // 95% VaR: mean - 1.645 * std (one-tailed)
  const varReturn = mean - 1.645 * std;
  return Math.abs(varReturn * portfolioValue);
}

/**
 * Calculate historical VaR (95%) by taking the 5th percentile of returns.
 */
function calculateHistoricalVaR(returns: number[], portfolioValue: number): number {
  if (returns.length < 20) return calculateParametricVaR(returns, portfolioValue);
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.05);
  const varReturn = sorted[Math.max(0, index)];
  return Math.abs(varReturn * portfolioValue);
}

/**
 * Calculate Sharpe Ratio: (Portfolio Return - Risk Free Rate) / Portfolio Std Dev
 * Using 5% annual risk-free rate.
 */
function calculateSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0;
  const meanDaily = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanDaily, 2), 0) / (returns.length - 1);
  const stdDaily = Math.sqrt(variance);
  if (stdDaily === 0) return 0;

  const annualizedReturn = meanDaily * 252;
  const annualizedStd = stdDaily * Math.sqrt(252);
  const riskFreeRate = 0.05;

  return (annualizedReturn - riskFreeRate) / annualizedStd;
}

/**
 * Calculate Max Drawdown from equity curve values.
 */
function calculateMaxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;
  let maxPeak = equityCurve[0];
  let maxDrawdown = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > maxPeak) {
      maxPeak = equityCurve[i];
    }
    const drawdown = (maxPeak - equityCurve[i]) / maxPeak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * GET /api/portfolio/risk
 * Compute portfolio risk metrics: VaR (95%), Sharpe Ratio, Max Drawdown
 */
export async function GET() {
  try {
    await ensureDefaultUser();

    const positions = await db.position.findMany({
      where: { status: 'open', userId: DEFAULT_USER_ID },
      orderBy: { openedAt: 'desc' },
    });

    // If no positions, return defaults with mock flag
    if (positions.length === 0) {
      return NextResponse.json({
        var95: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        portfolioValue: 0,
        dailyReturn: 0,
        mock: true,
      } satisfies RiskMetrics);
    }

    // Fetch current prices from Finnhub for each position
    const positionsWithPrices: PositionWithPrice[] = [];
    let portfolioValue = 0;

    for (const pos of positions) {
      const currentPrice = await fetchFinnhubQuote(pos.symbol);
      const price = currentPrice > 0 ? currentPrice : pos.currentPrice || pos.avgCost;
      const value = price * pos.quantity;
      portfolioValue += value;

      positionsWithPrices.push({
        id: pos.id,
        symbol: pos.symbol,
        market: pos.market,
        side: pos.side,
        avgCost: pos.avgCost,
        quantity: pos.quantity,
        currentPrice: price,
        openedAt: pos.openedAt,
      });
    }

    // Calculate position weights
    const weights = positionsWithPrices.map((p) =>
      portfolioValue > 0 ? (p.currentPrice * p.quantity) / portfolioValue : 0
    );

    // Fetch historical returns for all symbols
    const allReturns: Map<string, number[]> = new Map();
    let hasAnyReturns = false;

    for (const pos of positionsWithPrices) {
      const returns = await fetchHistoricalReturns(pos.symbol, 252);
      allReturns.set(pos.symbol, returns);
      if (returns.length > 0) hasAnyReturns = true;
    }

    // If we couldn't get any historical data, use mock data based on position characteristics
    if (!hasAnyReturns) {
      // Generate synthetic returns based on position data for approximate risk metrics
      const syntheticReturns = generateSyntheticReturns(positionsWithPrices);
      const var95 = calculateParametricVaR(syntheticReturns, portfolioValue);
      const sharpeRatio = calculateSharpeRatio(syntheticReturns);

      // Build a simple equity curve for max drawdown
      const equityCurve = buildEquityCurve(syntheticReturns, portfolioValue);
      const maxDrawdown = calculateMaxDrawdown(equityCurve);

      const dailyReturn = syntheticReturns.length > 0
        ? syntheticReturns[syntheticReturns.length - 1]
        : 0;

      return NextResponse.json({
        var95: parseFloat(var95.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
        portfolioValue: parseFloat(portfolioValue.toFixed(2)),
        dailyReturn: parseFloat((dailyReturn * 100).toFixed(4)),
        mock: true,
      } satisfies RiskMetrics);
    }

    // Align returns by date (use minimum length)
    const minLength = Math.min(...Array.from(allReturns.values()).map((r) => r.length));
    if (minLength < 2) {
      // Not enough aligned data, fall back to weighted parametric approach
      const allReturnsArray = Array.from(allReturns.values()).flat();
      const var95 = calculateParametricVaR(allReturnsArray, portfolioValue);
      const sharpeRatio = calculateSharpeRatio(allReturnsArray);
      const equityCurve = buildEquityCurve(allReturnsArray, portfolioValue);
      const maxDrawdown = calculateMaxDrawdown(equityCurve);

      return NextResponse.json({
        var95: parseFloat(var95.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
        portfolioValue: parseFloat(portfolioValue.toFixed(2)),
        dailyReturn: 0,
        mock: true,
      } satisfies RiskMetrics);
    }

    // Calculate portfolio daily returns using weighted sum
    const portfolioReturns: number[] = [];
    for (let i = 0; i < minLength; i++) {
      let portfolioReturn = 0;
      for (let j = 0; j < positionsWithPrices.length; j++) {
        const symbolReturns = allReturns.get(positionsWithPrices[j].symbol);
        if (symbolReturns && i < symbolReturns.length) {
          portfolioReturn += weights[j] * symbolReturns[i];
        }
      }
      portfolioReturns.push(portfolioReturn);
    }

    // VaR (95%) using historical simulation
    const var95 = calculateHistoricalVaR(portfolioReturns, portfolioValue);

    // Sharpe Ratio
    const sharpeRatio = calculateSharpeRatio(portfolioReturns);

    // Max Drawdown from equity curve
    const equityCurve = buildEquityCurve(portfolioReturns, portfolioValue);
    const maxDrawdown = calculateMaxDrawdown(equityCurve);

    // Daily return (most recent)
    const dailyReturn = portfolioReturns.length > 0
      ? portfolioReturns[portfolioReturns.length - 1]
      : 0;

    return NextResponse.json({
      var95: parseFloat(var95.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
      portfolioValue: parseFloat(portfolioValue.toFixed(2)),
      dailyReturn: parseFloat((dailyReturn * 100).toFixed(4)),
      mock: false,
    } satisfies RiskMetrics);
  } catch (error) {
    console.error('[portfolio/risk] Error:', error);
    // Return reasonable defaults on error
    return NextResponse.json({
      var95: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      portfolioValue: 0,
      dailyReturn: 0,
      mock: true,
    } satisfies RiskMetrics);
  }
}

/**
 * Generate synthetic returns based on position characteristics.
 * Uses a seed derived from position symbols for consistency.
 */
function generateSyntheticReturns(positions: PositionWithPrice[]): number[] {
  const returns: number[] = [];
  // Simple seeded pseudo-random based on symbols
  let seed = 0;
  for (const pos of positions) {
    for (let i = 0; i < pos.symbol.length; i++) {
      seed += pos.symbol.charCodeAt(i);
    }
  }

  // Generate 60 days of synthetic returns
  for (let i = 0; i < 60; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const u = seed / 0x7fffffff;
    // Box-Muller for normal distribution, mean ~0.0005, std ~0.015
    const v = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const normal = Math.sqrt(-2 * Math.log(Math.max(u, 0.0001))) * Math.cos(2 * Math.PI * v);
    returns.push(0.0005 + 0.015 * normal);
  }

  return returns;
}

/**
 * Build an equity curve from returns starting with initial value.
 */
function buildEquityCurve(returns: number[], initialValue: number): number[] {
  const curve: number[] = [initialValue];
  for (const r of returns) {
    curve.push(curve[curve.length - 1] * (1 + r));
  }
  return curve;
}
