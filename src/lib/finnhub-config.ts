/**
 * Finnhub API Key Configuration Helper
 * Reads the API key from the database (SystemConfig) with in-memory caching,
 * falling back to the FINNHUB_API_KEY environment variable.
 */

import { db } from '@/lib/db';

// In-memory cache with TTL
let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get the Finnhub API key from the database (with caching) or env var.
 * The database value takes precedence over the environment variable.
 */
export async function getFinnhubApiKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey !== null && now < cacheExpiry) return cachedKey;

  try {
    const row = await db.systemConfig.findUnique({ where: { key: 'finnhub_api_key' } });
    cachedKey = row?.value || process.env.FINNHUB_API_KEY || '';
    cacheExpiry = now + CACHE_TTL;
    return cachedKey;
  } catch {
    return process.env.FINNHUB_API_KEY || '';
  }
}

/**
 * Invalidate the in-memory cache.
 * Call this after saving a new API key so the next read picks it up immediately.
 */
export function invalidateFinnhubCache(): void {
  cachedKey = null;
  cacheExpiry = 0;
}
