/**
 * Symbol search API function for QuantFusion Data Service
 */

import type { ApiResponse } from './types';
import { getCached, setCache, CACHE_TTL } from './cache';
import { finnhubFetch } from './config';
import { A_SHARE_STOCKS, HK_STOCKS } from './mock-data';

/**
 * Search for stock symbols
 */
export async function searchSymbol(query: string): Promise<ApiResponse<Array<{ symbol: string; name: string; type: string; market: string }>>> {
  try {
    if (!query || query.trim().length === 0) {
      return { success: false, data: null, error: 'Search query is required' };
    }

    const cacheKey = `search_${query.toLowerCase()}`;
    const cached = getCached<ApiResponse<Array<{ symbol: string; name: string; type: string; market: string }>>>(cacheKey);
    if (cached) return cached;

    const results: Array<{ symbol: string; name: string; type: string; market: string }> = [];
    const q = query.toUpperCase();

    // Search A-share stocks
    for (const [sym, def] of Object.entries(A_SHARE_STOCKS)) {
      if (sym.includes(q) || def.name.includes(query)) {
        results.push({ symbol: sym, name: def.name, type: def.sector === '指数' ? 'index' : 'stock', market: 'A' });
      }
    }

    // Search HK stocks
    for (const [sym, def] of Object.entries(HK_STOCKS)) {
      if (sym.includes(q) || def.name.includes(query)) {
        results.push({ symbol: sym, name: def.name, type: def.sector === '指数' ? 'index' : 'stock', market: 'HK' });
      }
    }

    // Search US stocks via Finnhub
    try {
      const data = await finnhubFetch<{ result: Array<{ symbol: string; description: string; type: string }> }>(
        'search',
        { q: query }
      );

      if (data && data.result) {
        for (const item of data.result) {
          if (item.symbol && item.symbol.trim() !== '') {
            results.push({
              symbol: item.symbol,
              name: item.description || item.symbol,
              type: item.type || 'stock',
              market: 'US',
            });
          }
        }
      }
    } catch {
      // Finnhub search failed, just use local results
    }

    const result: ApiResponse<Array<{ symbol: string; name: string; type: string; market: string }>> = {
      success: true,
      data: results.slice(0, 30),
      error: null,
    };

    setCache(cacheKey, result, CACHE_TTL.search);

    return result;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Failed to search: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
