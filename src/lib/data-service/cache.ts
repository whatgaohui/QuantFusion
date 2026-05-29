/**
 * Cache utilities for QuantFusion Data Service
 * In-memory cache with TTL support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export const CACHE_TTL = {
  quote: 5 * 1000,         // 5s for quotes
  news: 5 * 60 * 1000,     // 5min for news
  kline: 60 * 60 * 1000,   // 1hr for kline
  sectors: 30 * 60 * 1000, // 30min for sectors
  search: 10 * 60 * 1000,  // 10min for search results
};

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    return entry.data as T;
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}
