import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

/**
 * GET /api/etf/profile/[symbol]
 * Get detailed ETF profile.
 * First checks the ETFProfile database, then falls back to Finnhub API.
 * If not found in DB but found via Finnhub, creates a basic profile in DB.
 * Returns full ETF profile data including topHoldings, sectorWeights, regionWeights.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    // 1. Check ETFProfile database first
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

    // 2. Not found in DB — try to create from Finnhub data
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
    // Finnhub doesn't have ETF-specific data like expense ratio or tracking index,
    // so we store what we can and leave ETF-specific fields null
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
        category: null, // Would need a dedicated ETF data source
        expenseRatio: null,
        trackingIndex: null,
        aum: marketCap ? marketCap / 1e6 : null, // Convert to millions
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
