import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

/**
 * GET /api/etf/search?q=SPY
 * Search for ETFs by name, symbol, or category.
 * First searches the ETFProfile database, then uses Finnhub API for additional results.
 * Returns array of { symbol, name, category, expenseRatio, trackingIndex }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    const query = q.trim().toLowerCase();
    const results: Array<{
      symbol: string;
      name: string;
      category: string | null;
      expenseRatio: number | null;
      trackingIndex: string | null;
    }> = [];

    // 1. Search the ETFProfile database
    const dbResults = await db.eTFProfile.findMany({
      where: {
        OR: [
          { symbol: { contains: query } },
          { name: { contains: query } },
          { category: { contains: query } },
          { trackingIndex: { contains: query } },
        ],
      },
      take: 20,
    });

    for (const etf of dbResults) {
      results.push({
        symbol: etf.symbol,
        name: etf.name,
        category: etf.category,
        expenseRatio: etf.expenseRatio,
        trackingIndex: etf.trackingIndex,
      });
    }

    // 2. Use Finnhub API for additional results (if key available)
    const finnhubApiKey = await getFinnhubApiKey();
    if (finnhubApiKey) {
      try {
        const finnhubResponse = await fetch(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${finnhubApiKey}`
        );

        if (finnhubResponse.ok) {
          const data = await finnhubResponse.json();
          const finnhubResults = (data.result || [])
            .filter((item: Record<string, string>) => {
              // Filter for ETFs only - Finnhub type field or symbol patterns
              const type = (item.type || '').toLowerCase();
              const desc = (item.description || '').toLowerCase();
              return (
                type.includes('etf') ||
                desc.includes('etf') ||
                desc.includes('trust') ||
                desc.includes('index')
              );
            })
            .map((item: Record<string, string>) => ({
              symbol: item.symbol,
              name: item.description || item.symbol,
              category: null,
              expenseRatio: null,
              trackingIndex: null,
            }));

          // Add Finnhub results that aren't already in our list (deduplicate by symbol)
          const existingSymbols = new Set(results.map((r) => r.symbol.toUpperCase()));
          for (const item of finnhubResults) {
            if (!existingSymbols.has(item.symbol.toUpperCase())) {
              results.push(item);
              existingSymbols.add(item.symbol.toUpperCase());
            }
          }
        }
      } catch (error) {
        console.error('Finnhub ETF search error:', error);
        // Continue with database results only
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('ETF search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search ETFs' },
      { status: 500 }
    );
  }
}
