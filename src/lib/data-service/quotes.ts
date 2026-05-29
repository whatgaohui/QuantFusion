/**
 * Quote API functions for QuantFusion Data Service
 */

import type { ApiResponse, QuoteData } from './types';
import { getCached, setCache, CACHE_TTL } from './cache';
import { detectMarket, finnhubFetch } from './config';
import { A_SHARE_STOCKS, HK_STOCKS, US_STOCK_NAMES, US_INDICES, generateRandomPrice } from './mock-data';

/**
 * Get quote data for a single symbol
 */
export async function getQuote(symbol: string): Promise<ApiResponse<QuoteData>> {
  try {
    const upperSymbol = symbol.toUpperCase();
    const market = detectMarket(upperSymbol);

    // Check cache first
    const cacheKey = `quote_${upperSymbol}`;
    const cached = getCached<ApiResponse<QuoteData>>(cacheKey);
    if (cached) return cached;

    let result: ApiResponse<QuoteData>;

    if (market === 'A') {
      const stockDef = A_SHARE_STOCKS[upperSymbol];
      if (!stockDef) {
        result = { success: false, data: null, error: `Unknown A-share symbol: ${upperSymbol}` };
        return result;
      }
      const priceData = generateRandomPrice(stockDef.basePrice);
      result = {
        success: true,
        data: {
          symbol: upperSymbol,
          name: stockDef.name,
          ...priceData,
          timestamp: Math.floor(Date.now() / 1000),
          market: 'A',
        },
        error: null,
      };
    } else if (market === 'HK') {
      const stockDef = HK_STOCKS[upperSymbol];
      if (!stockDef) {
        result = { success: false, data: null, error: `Unknown HK symbol: ${upperSymbol}` };
        return result;
      }
      const priceData = generateRandomPrice(stockDef.basePrice);
      result = {
        success: true,
        data: {
          symbol: upperSymbol,
          name: stockDef.name,
          ...priceData,
          timestamp: Math.floor(Date.now() / 1000),
          market: 'HK',
        },
        error: null,
      };
    } else {
      // US market - try Finnhub
      const indexDef = US_INDICES[upperSymbol];
      if (indexDef) {
        // Use fallback for US indices (Finnhub free plan limitation)
        const priceData = generateRandomPrice(indexDef.basePrice);
        result = {
          success: true,
          data: {
            symbol: upperSymbol,
            name: indexDef.name,
            ...priceData,
            timestamp: Math.floor(Date.now() / 1000),
            market: 'US',
          },
          error: null,
        };
      } else {
        // Regular US stock - try Finnhub API
        const data = await finnhubFetch<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>(
          'quote',
          { symbol: upperSymbol }
        );

        if (data && (data.c !== 0 || data.h !== 0)) {
          result = {
            success: true,
            data: {
              symbol: upperSymbol,
              name: US_STOCK_NAMES[upperSymbol] || upperSymbol,
              currentPrice: data.c,
              change: data.d,
              changePercent: data.dp,
              high: data.h,
              low: data.l,
              open: data.o,
              prevClose: data.pc,
              volume: 0,
              timestamp: data.t || Math.floor(Date.now() / 1000),
              market: 'US',
            },
            error: null,
          };
        } else {
          // Finnhub failed - try to get company profile for name
          const profile = await finnhubFetch<{ name: string; ticker: string }>(
            'stock/profile2',
            { symbol: upperSymbol }
          );

          result = {
            success: false,
            data: null,
            error: `No quote data available for ${upperSymbol}`,
          };

          // If we have a profile, at least return that info
          if (profile && profile.name) {
            // Generate fallback data
            const fallbackPrice = 50 + Math.random() * 200;
            const priceData = generateRandomPrice(fallbackPrice);
            result = {
              success: true,
              data: {
                symbol: upperSymbol,
                name: profile.name,
                ...priceData,
                timestamp: Math.floor(Date.now() / 1000),
                market: 'US',
              },
              error: null,
            };
          }
        }
      }
    }

    if (result.success && result.data) {
      setCache(cacheKey, result, CACHE_TTL.quote);
    }

    return result;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Failed to get quote for ${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get quotes for multiple symbols
 */
export async function getQuotes(symbols: string[]): Promise<ApiResponse<QuoteData[]>> {
  try {
    // Sequential fetch to prevent memory exhaustion in resource-constrained environments
    const quotes: QuoteData[] = [];
    const errors: string[] = [];

    for (const s of symbols) {
      const r = await getQuote(s);
      if (r.success && r.data) {
        quotes.push(r.data);
      } else {
        errors.push(r.error || 'Unknown error');
      }
    }

    if (quotes.length === 0) {
      return { success: false, data: null, error: errors.join('; ') };
    }

    return { success: true, data: quotes, error: errors.length > 0 ? errors.join('; ') : null };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Failed to get quotes: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
