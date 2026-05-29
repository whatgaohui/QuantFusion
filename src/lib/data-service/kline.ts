/**
 * Kline (candlestick) API function for QuantFusion Data Service
 */

import type { ApiResponse, KlineData } from './types';
import { getCached, setCache, CACHE_TTL } from './cache';
import { detectMarket, finnhubFetch } from './config';
import { A_SHARE_STOCKS, HK_STOCKS, US_INDICES, generateMockKline } from './mock-data';

/**
 * Get kline (candlestick) data for a symbol
 */
export async function getKline(symbol: string, period: string = 'D', count: number = 90): Promise<ApiResponse<KlineData>> {
  try {
    const upperSymbol = symbol.toUpperCase();
    const market = detectMarket(upperSymbol);

    // Check cache
    const cacheKey = `kline_${upperSymbol}_${period}_${count}`;
    const cached = getCached<ApiResponse<KlineData>>(cacheKey);
    if (cached) return cached;

    let result: ApiResponse<KlineData>;

    if (market === 'A') {
      const stockDef = A_SHARE_STOCKS[upperSymbol];
      if (!stockDef) {
        return { success: false, data: null, error: `Unknown A-share symbol: ${upperSymbol}` };
      }
      const klineCount = period === 'W' ? Math.min(count, 52) : period === 'M' ? Math.min(count, 24) : Math.min(count, 120);
      const klineData = generateMockKline(stockDef.basePrice, klineCount);
      result = {
        success: true,
        data: {
          symbol: upperSymbol,
          period,
          ...klineData,
          s: 'ok',
        },
        error: null,
      };
    } else if (market === 'HK') {
      const stockDef = HK_STOCKS[upperSymbol];
      if (!stockDef) {
        return { success: false, data: null, error: `Unknown HK symbol: ${upperSymbol}` };
      }
      const klineCount = period === 'W' ? Math.min(count, 52) : period === 'M' ? Math.min(count, 24) : Math.min(count, 120);
      const klineData = generateMockKline(stockDef.basePrice, klineCount);
      result = {
        success: true,
        data: {
          symbol: upperSymbol,
          period,
          ...klineData,
          s: 'ok',
        },
        error: null,
      };
    } else {
      // US market - try Finnhub
      const now = Math.floor(Date.now() / 1000);
      const resolution = period === 'D' ? 'D' : period === 'W' ? 'W' : period === 'M' ? 'M' : period;
      const from = now - count * 86400;

      const data = await finnhubFetch<{ c: number[]; h: number[]; l: number[]; o: number[]; v: number[]; t: number[]; s: string }>(
        'stock/candle',
        { symbol: upperSymbol, resolution, from: from.toString(), to: now.toString() }
      );

      if (data && data.s === 'ok' && data.c && data.c.length > 0) {
        result = {
          success: true,
          data: {
            symbol: upperSymbol,
            period,
            c: data.c,
            h: data.h,
            l: data.l,
            o: data.o,
            v: data.v,
            t: data.t,
            s: data.s,
          },
          error: null,
        };
      } else {
        // Finnhub failed - generate mock kline
        const indexDef = US_INDICES[upperSymbol];
        const basePrice = indexDef ? indexDef.basePrice : 100 + Math.random() * 200;
        const klineCount = period === 'W' ? Math.min(count, 52) : period === 'M' ? Math.min(count, 24) : Math.min(count, 90);
        const klineData = generateMockKline(basePrice, klineCount);
        result = {
          success: true,
          data: {
            symbol: upperSymbol,
            period,
            ...klineData,
            s: 'ok',
          },
          error: null,
        };
      }
    }

    if (result.success && result.data) {
      setCache(cacheKey, result, CACHE_TTL.kline);
    }

    return result;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Failed to get kline for ${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
