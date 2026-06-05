import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
import { CN_ETF_DB } from '@/lib/cn-etf-db';

/**
 * Check if a query string looks like a Chinese ETF/fund code pattern.
 * Chinese A-share fund symbols are 6-digit numbers like 510xxx, 512xxx, 513xxx,
 * 159xxx, 511xxx, 515xxx, 518xxx, 588xxx, 516xxx.
 */
function isChineseFundPattern(query: string): boolean {
  return /^\d{4,6}$/.test(query);
}

/**
 * Map Fund fundType to category string for the search result format.
 * The fundType field in the Fund table contains values like "ETF", "LOF", "QDII", etc.
 * We map these to category strings consistent with the ETFProfile category conventions.
 */
function mapFundTypeToCategory(fundType: string | null, isEtf: boolean): string | null {
  if (!fundType) return isEtf ? 'broad_market' : null;

  const ft = fundType.toUpperCase();

  // Direct mapping for known types
  if (ft === 'ETF') return 'broad_market';
  if (ft === 'QDII') return 'international';
  if (ft === 'LOF') return 'broad_market';
  if (ft === 'BOND' || ft === '债券型') return 'bond';
  if (ft === 'COMMODITY' || ft === '商品型') return 'commodity';

  // Try Chinese fund type names
  if (ft.includes('跨境') || ft.includes('QDII')) return 'international';
  if (ft.includes('债券') || ft.includes('债')) return 'bond';
  if (ft.includes('商品')) return 'commodity';
  if (ft.includes('行业') || ft.includes('主题') || ft.includes('SECTOR')) return 'sector';

  // Default: if it's an ETF, classify as broad_market
  if (isEtf) return 'broad_market';

  return null;
}

/**
 * GET /api/etf/search?q=SPY
 * Search for ETFs and funds by code, name, or pinyin.
 * For Chinese funds, uses the Fund database table; for US ETFs, uses ETFProfile DB + Finnhub.
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

    const query = q.trim();
    const queryLower = query.toLowerCase();
    const results: Array<{
      symbol: string;
      name: string;
      category: string | null;
      expenseRatio: number | null;
      trackingIndex: string | null;
    }> = [];
    const existingSymbols = new Set<string>();

    // 1. Search the Fund database table for Chinese funds/ETFs
    // Support: exact code match, prefix code match, name contains, pinyin prefix
    const fundResults = await db.fund.findMany({
      where: {
        OR: [
          { code: { startsWith: query } },           // prefix code match: "513" → 513xxx
          { name: { contains: query } },              // name contains: "标普" → funds with 标普 in name
          { pinyin: { startsWith: queryLower } },     // pinyin prefix: "bp500" → 标普500ETF
        ],
      },
      orderBy: [
        { isOnMarket: 'desc' },   // On-market funds first
        { isEtf: 'desc' },        // ETFs first
      ],
      take: 20,
    });

    for (const fund of fundResults) {
      const category = mapFundTypeToCategory(fund.fundType, fund.isEtf);
      results.push({
        symbol: fund.code,
        name: fund.name,
        category,
        expenseRatio: null,
        trackingIndex: null,
      });
      existingSymbols.add(fund.code);
    }

    // 2. Search the ETFProfile database (for US/international ETFs already cached)
    const dbResults = await db.eTFProfile.findMany({
      where: {
        OR: [
          { symbol: { contains: queryLower } },
          { name: { contains: query } },
          { category: { contains: queryLower } },
          { trackingIndex: { contains: query } },
        ],
      },
      take: 20,
    });

    for (const etf of dbResults) {
      if (!existingSymbols.has(etf.symbol.toUpperCase())) {
        results.push({
          symbol: etf.symbol,
          name: etf.name,
          category: etf.category,
          expenseRatio: etf.expenseRatio,
          trackingIndex: etf.trackingIndex,
        });
        existingSymbols.add(etf.symbol.toUpperCase());
      }
    }

    // 2.5. Fallback: search the hardcoded CN_ETF_DB for Chinese fund patterns
    if (isChineseFundPattern(query)) {
      const cnEtfDbResults = CN_ETF_DB.filter(etf => 
        etf.symbol.startsWith(query) || 
        etf.name.includes(query) ||
        etf.trackingIndex.includes(query)
      );
      for (const etf of cnEtfDbResults) {
        if (!existingSymbols.has(etf.symbol)) {
          results.push({
            symbol: etf.symbol,
            name: etf.name,
            category: etf.category,
            expenseRatio: etf.expenseRatio,
            trackingIndex: etf.trackingIndex,
          });
          existingSymbols.add(etf.symbol);
        }
      }
    }

    // 3. Use Finnhub API for additional results (if key available and query is NOT a Chinese fund pattern)
    // Finnhub doesn't support Chinese funds, so skip for 6-digit queries
    if (!isChineseFundPattern(query)) {
      const finnhubApiKey = await getFinnhubApiKey();
      if (finnhubApiKey) {
        try {
          const finnhubResponse = await fetch(
            `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubApiKey}`
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
    }

    // Limit total results to 20
    return NextResponse.json(results.slice(0, 20));
  } catch (error) {
    console.error('ETF search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search ETFs' },
      { status: 500 }
    );
  }
}
