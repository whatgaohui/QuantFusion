/**
 * Technical Indicators API function for QuantFusion Data Service
 */

import type { ApiResponse, IndicatorData } from './types';
import { sma } from './math-utils';
import { getKline } from './kline';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateKDJ } from '@/lib/indicators';

/**
 * Get technical indicators for a symbol
 */
export async function getIndicators(symbol: string): Promise<ApiResponse<IndicatorData>> {
  try {
    const upperSymbol = symbol.toUpperCase();

    // Get kline data first to compute indicators
    const klineResult = await getKline(upperSymbol, 'D', 120);

    if (!klineResult.success || !klineResult.data) {
      return {
        success: false,
        data: null,
        error: klineResult.error || `Failed to get kline data for indicators`,
      };
    }

    const kline = klineResult.data;

    if (!kline.c || kline.c.length < 5) {
      return {
        success: false,
        data: null,
        error: 'Not enough data to calculate indicators',
      };
    }

    const closes = kline.c;
    const highs = kline.h;
    const lows = kline.l;

    // MA (5, 10, 20, 60)
    const ma: Record<string, number> = {};
    const maPeriods = [5, 10, 20, 60];
    for (const p of maPeriods) {
      if (closes.length >= p) {
        ma[`ma${p}`] = sma(closes, p);
      }
    }

    // MACD (12, 26, 9)
    const macdResult = calculateMACD(closes, 12, 26, 9);

    // RSI (6, 12, 14)
    const rsi: Record<string, number> = {};
    const rsiPeriods = [6, 12, 14];
    for (const p of rsiPeriods) {
      if (closes.length >= p + 1) {
        rsi[`rsi${p}`] = parseFloat(calculateRSI(closes, p).toFixed(2));
      }
    }

    // Bollinger Bands (20, 2)
    const bollinger = calculateBollingerBands(closes, 20, 2);

    // KDJ (9, 3, 3)
    const kdj = calculateKDJ(highs, lows, closes, 9, 3, 3);

    const result: ApiResponse<IndicatorData> = {
      success: true,
      data: {
        symbol: upperSymbol,
        ma,
        macd: {
          macd: macdResult.macd,
          signal: macdResult.signal,
          histogram: macdResult.histogram,
        },
        rsi,
        bollinger: {
          upper: bollinger.upper,
          middle: bollinger.middle,
          lower: bollinger.lower,
          pricePosition: bollinger.pricePosition,
        },
        kdj: {
          k: kdj.k,
          d: kdj.d,
          j: kdj.j,
        },
      },
      error: null,
    };

    return result;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Failed to get indicators for ${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
