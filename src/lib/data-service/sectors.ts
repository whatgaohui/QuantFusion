/**
 * Sectors API function for QuantFusion Data Service
 */

import type { ApiResponse, SectorData } from './types';
import { getCached, setCache, CACHE_TTL } from './cache';
import { generateAShareSectors, generateHKSectors, generateUSSectors } from './mock-sectors';

/**
 * Get sector data for a market
 */
export async function getSectors(market: string = 'A'): Promise<ApiResponse<SectorData[]>> {
  try {
    const cacheKey = `sectors_${market}`;
    const cached = getCached<ApiResponse<SectorData[]>>(cacheKey);
    if (cached) return cached;

    const upperMarket = market.toUpperCase();
    let sectors: SectorData[];

    if (upperMarket === 'A') {
      sectors = generateAShareSectors();
    } else if (upperMarket === 'HK') {
      sectors = generateHKSectors();
    } else {
      sectors = generateUSSectors();
    }

    const result: ApiResponse<SectorData[]> = { success: true, data: sectors, error: null };
    setCache(cacheKey, result, CACHE_TTL.sectors);

    return result;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Failed to get sectors: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
