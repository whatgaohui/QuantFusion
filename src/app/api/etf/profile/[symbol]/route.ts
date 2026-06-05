import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
import { CN_ETF_DB } from '@/lib/cn-etf-db';

/**
 * Check if a symbol looks like a Chinese A-share ETF code (6-digit number).
 */
function isChineseEtfSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(symbol);
}

/**
 * GET /api/etf/profile/[symbol]
 * Get detailed ETF profile.
 * For Chinese ETFs (6-digit codes), looks up local CN_ETF_DB first.
 * Then checks the ETFProfile database, then falls back to Finnhub API.
 * If found in CN_ETF_DB but not in DB, upserts to database.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    // 0. If this looks like a Chinese ETF symbol, search local CN_ETF_DB first
    if (isChineseEtfSymbol(upperSymbol)) {
      const cnEtf = CN_ETF_DB.find((e) => e.symbol === upperSymbol);
      if (cnEtf) {
        // Upsert to the database so it's available for future queries
        const upserted = await db.eTFProfile.upsert({
          where: { symbol: upperSymbol },
          update: {
            name: cnEtf.name,
            market: 'A',
            category: cnEtf.category,
            expenseRatio: cnEtf.expenseRatio,
            trackingIndex: cnEtf.trackingIndex,
            aum: cnEtf.aum,
            dividendYield: cnEtf.dividendYield,
            peRatio: cnEtf.peRatio,
            pbRatio: cnEtf.pbRatio,
            beta: cnEtf.beta,
            sharpe1y: cnEtf.sharpe1y,
            volatility1y: cnEtf.volatility1y,
            returns1y: cnEtf.returns1y,
            returns3y: cnEtf.returns3y,
            returns5y: cnEtf.returns5y,
            topHoldings: cnEtf.topHoldings,
            sectorWeights: cnEtf.sectorWeights,
            regionWeights: cnEtf.regionWeights,
          },
          create: {
            symbol: upperSymbol,
            name: cnEtf.name,
            market: 'A',
            category: cnEtf.category,
            expenseRatio: cnEtf.expenseRatio,
            trackingIndex: cnEtf.trackingIndex,
            aum: cnEtf.aum,
            dividendYield: cnEtf.dividendYield,
            peRatio: cnEtf.peRatio,
            pbRatio: cnEtf.pbRatio,
            beta: cnEtf.beta,
            sharpe1y: cnEtf.sharpe1y,
            volatility1y: cnEtf.volatility1y,
            returns1y: cnEtf.returns1y,
            returns3y: cnEtf.returns3y,
            returns5y: cnEtf.returns5y,
            topHoldings: cnEtf.topHoldings,
            sectorWeights: cnEtf.sectorWeights,
            regionWeights: cnEtf.regionWeights,
          },
        });

        const profile = {
          ...upserted,
          topHoldings: upserted.topHoldings ? JSON.parse(upserted.topHoldings) : null,
          sectorWeights: upserted.sectorWeights ? JSON.parse(upserted.sectorWeights) : null,
          regionWeights: upserted.regionWeights ? JSON.parse(upserted.regionWeights) : null,
        };
        return NextResponse.json(profile);
      }

      // Chinese ETF pattern but not found in our local DB
      // Still try the ETFProfile database in case it was added there before
    }

    // 1. Check ETFProfile database
    const existing = await db.eTFProfile.findUnique({
      where: { symbol: upperSymbol },
    });

    if (existing) {
      // Parse JSON fields for the response
      const profile = {
        ...existing,
        topHoldings: existing.topHoldings ? JSON.parse(existing.topHoldings) : null,
        sectorWeights: existing.sectorWeights ? JSON.parse(existing.sectorWeights) : null,
        regionWeights: existing.regionWeights ? JSON.parse(existing.regionWeights) : null,
      };
      return NextResponse.json(profile);
    }

    // 2. For Chinese ETF symbols not found anywhere, return 404
    // (Finnhub doesn't support A-share ETFs)
    if (isChineseEtfSymbol(upperSymbol)) {
      return NextResponse.json(
        { error: `A-share ETF ${upperSymbol} not found in local database` },
        { status: 404 }
      );
    }

    // 3. Not found in DB — try to create from Finnhub data (US/HK ETFs)
    const finnhubApiKey = await getFinnhubApiKey();
    if (!finnhubApiKey) {
      return NextResponse.json(
        { error: 'ETF profile not found in database and Finnhub API key is not configured' },
        { status: 404 }
      );
    }

    // Fetch company profile from Finnhub
    const profileResponse = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(upperSymbol)}&token=${finnhubApiKey}`
    );

    if (!profileResponse.ok) {
      return NextResponse.json(
        { error: `Finnhub API error: ${profileResponse.status}` },
        { status: profileResponse.status }
      );
    }

    const profileData = await profileResponse.json();

    if (!profileData || !profileData.name) {
      return NextResponse.json(
        { error: `No profile data found for ETF symbol: ${upperSymbol}` },
        { status: 404 }
      );
    }

    // Fetch quote for basic price info
    let marketCap: number | null = null;
    try {
      const quoteResponse = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(upperSymbol)}&token=${finnhubApiKey}`
      );
      if (quoteResponse.ok) {
        const quoteData = await quoteResponse.json();
        if (quoteData && profileData.shareOutstanding) {
          marketCap = (quoteData.c || 0) * profileData.shareOutstanding * 1000;
        }
      }
    } catch {
      // Quote fetch failure is non-critical
    }

    // Build a basic ETFProfile from Finnhub data
    const newProfile = await db.eTFProfile.create({
      data: {
        symbol: upperSymbol,
        name: profileData.name || upperSymbol,
        market: profileData.exchange
          ? profileData.exchange.includes('HK')
            ? 'HK'
            : profileData.exchange.includes('SS') || profileData.exchange.includes('SZ')
              ? 'A'
              : 'US'
          : 'US',
        category: null,
        expenseRatio: null,
        trackingIndex: null,
        aum: marketCap ? marketCap / 1e6 : null,
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

    const result = {
      ...newProfile,
      topHoldings: null,
      sectorWeights: null,
      regionWeights: null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('ETF profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ETF profile' },
      { status: 500 }
    );
  }
}
