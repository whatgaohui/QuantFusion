import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

interface ETFComparisonData {
  symbol: string;
  name: string;
  category: string | null;
  expenseRatio: number | null;
  trackingIndex: string | null;
  aum: number | null;
  dividendYield: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  beta: number | null;
  sharpe1y: number | null;
  volatility1y: number | null;
  returns1y: number | null;
  returns3y: number | null;
  returns5y: number | null;
  topHoldings: Array<{ symbol: string; name: string; weight: number }> | null;
  sectorWeights: Array<{ sector: string; weight: number }> | null;
  regionWeights: Array<{ region: string; weight: number }> | null;
}

/**
 * GET /api/etf/compare?symbols=SPY,QQQ,VTI
 * Compare multiple ETFs. Accepts query param `symbols` (comma-separated).
 * Fetches profiles for all requested symbols from DB or Finnhub.
 * Returns comparison data including expense ratios, returns, risk metrics.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json(
        { error: 'Query parameter "symbols" is required (comma-separated ETF symbols)' },
        { status: 400 }
      );
    }

    const symbols = symbolsParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0)
      .slice(0, 10); // Limit to 10 ETFs for comparison

    if (symbols.length === 0) {
      return NextResponse.json(
        { error: 'No valid symbols provided' },
        { status: 400 }
      );
    }

    // 1. Fetch profiles from database
    const dbProfiles = await db.eTFProfile.findMany({
      where: { symbol: { in: symbols } },
    });

    const profileMap = new Map(dbProfiles.map((p) => [p.symbol, p]));

    // 2. For symbols not found in DB, try Finnhub
    const missingSymbols = symbols.filter((s) => !profileMap.has(s));
    const finnhubApiKey = await getFinnhubApiKey();

    if (missingSymbols.length > 0 && finnhubApiKey) {
      const finnhubPromises = missingSymbols.map(async (symbol) => {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${finnhubApiKey}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.name) {
              // Create a basic profile in the DB
              const newProfile = await db.eTFProfile.create({
                data: {
                  symbol,
                  name: data.name,
                  market: data.exchange
                    ? data.exchange.includes('HK')
                      ? 'HK'
                      : data.exchange.includes('SS') || data.exchange.includes('SZ')
                        ? 'A'
                        : 'US'
                    : 'US',
                  category: null,
                  expenseRatio: null,
                  trackingIndex: null,
                  aum: data.marketCapitalization ? data.marketCapitalization / 1e6 : null,
                  dividendYield: null,
                  peRatio: null,
                  pbRatio: null,
                  beta: null,
                  sharpe1y: null,
                  volatility1y: null,
                  returns1y: null,
                  returns3y: null,
                  returns5y: null,
                  topHoldings: null,
                  sectorWeights: null,
                  regionWeights: null,
                },
              });
              profileMap.set(symbol, newProfile);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch Finnhub profile for ${symbol}:`, error);
        }
      });

      await Promise.all(finnhubPromises);
    }

    // 3. Build comparison data for all requested symbols
    const comparisons: ETFComparisonData[] = symbols.map((symbol) => {
      const profile = profileMap.get(symbol);

      if (!profile) {
        return {
          symbol,
          name: symbol,
          category: null,
          expenseRatio: null,
          trackingIndex: null,
          aum: null,
          dividendYield: null,
          peRatio: null,
          pbRatio: null,
          beta: null,
          sharpe1y: null,
          volatility1y: null,
          returns1y: null,
          returns3y: null,
          returns5y: null,
          topHoldings: null,
          sectorWeights: null,
          regionWeights: null,
        };
      }

      return {
        symbol: profile.symbol,
        name: profile.name,
        category: profile.category,
        expenseRatio: profile.expenseRatio,
        trackingIndex: profile.trackingIndex,
        aum: profile.aum,
        dividendYield: profile.dividendYield,
        peRatio: profile.peRatio,
        pbRatio: profile.pbRatio,
        beta: profile.beta,
        sharpe1y: profile.sharpe1y,
        volatility1y: profile.volatility1y,
        returns1y: profile.returns1y,
        returns3y: profile.returns3y,
        returns5y: profile.returns5y,
        topHoldings: profile.topHoldings ? JSON.parse(profile.topHoldings) : null,
        sectorWeights: profile.sectorWeights ? JSON.parse(profile.sectorWeights) : null,
        regionWeights: profile.regionWeights ? JSON.parse(profile.regionWeights) : null,
      };
    });

    // 4. Build summary metrics for easy comparison
    const metricComparison = {
      expenseRatio: comparisons.map((c) => ({ symbol: c.symbol, value: c.expenseRatio })),
      dividendYield: comparisons.map((c) => ({ symbol: c.symbol, value: c.dividendYield })),
      returns1y: comparisons.map((c) => ({ symbol: c.symbol, value: c.returns1y })),
      returns3y: comparisons.map((c) => ({ symbol: c.symbol, value: c.returns3y })),
      returns5y: comparisons.map((c) => ({ symbol: c.symbol, value: c.returns5y })),
      beta: comparisons.map((c) => ({ symbol: c.symbol, value: c.beta })),
      sharpe1y: comparisons.map((c) => ({ symbol: c.symbol, value: c.sharpe1y })),
      volatility1y: comparisons.map((c) => ({ symbol: c.symbol, value: c.volatility1y })),
      aum: comparisons.map((c) => ({ symbol: c.symbol, value: c.aum })),
    };

    return NextResponse.json({
      comparisons,
      metricComparison,
      symbolCount: comparisons.length,
      missingSymbols: symbols.filter((s) => !profileMap.has(s)),
    });
  } catch (error) {
    console.error('ETF compare API error:', error);
    return NextResponse.json(
      { error: 'Failed to compare ETFs' },
      { status: 500 }
    );
  }
}
