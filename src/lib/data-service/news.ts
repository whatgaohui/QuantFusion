/**
 * News API function for QuantFusion Data Service
 */

import type { ApiResponse, NewsItem } from './types';
import { getCached, setCache, CACHE_TTL } from './cache';
import { finnhubFetch } from './config';
import { generateAShareNews, generateHKNews, generateUSNews } from './mock-news';

/**
 * Get news for a market
 */
export async function getNews(market: string = 'general', count: number = 20): Promise<ApiResponse<NewsItem[]>> {
  try {
    const cacheKey = `news_${market}_${count}`;
    const cached = getCached<ApiResponse<NewsItem[]>>(cacheKey);
    if (cached) return cached;

    let result: ApiResponse<NewsItem[]>;

    const upperMarket = market.toUpperCase();

    if (upperMarket === 'A') {
      // A-share mock news
      result = { success: true, data: generateAShareNews(count), error: null };
    } else if (upperMarket === 'HK') {
      // HK mock news
      result = { success: true, data: generateHKNews(count), error: null };
    } else {
      // US/general - try Finnhub
      try {
        const data = await finnhubFetch<Array<Record<string, unknown>>>(
          'news',
          { category: market === 'general' ? 'general' : market }
        );

        if (data && Array.isArray(data) && data.length > 0) {
          const news: NewsItem[] = data.slice(0, count).map((item, idx) => {
            const datetime = item.datetime as number | undefined;
            const timestamp = datetime ? new Date(datetime * 1000).toISOString() : new Date().toISOString();
            const rawCategory = (item.category as string) || 'general';
            let category = 'general';
            if (rawCategory.includes('crypto')) category = 'crypto';
            else if (rawCategory.includes('forex') || rawCategory.includes('currency')) category = 'forex';
            else if (rawCategory.includes('merger')) category = 'merger';

            return {
              id: String(item.id || idx),
              category,
              headline: (item.headline as string) || '',
              image: (item.image as string) || '',
              source: (item.source as string) || '',
              summary: (item.summary as string) || '',
              url: (item.url as string) || '#',
              timestamp,
            };
          });

          result = { success: true, data: news, error: null };
        } else {
          result = { success: true, data: generateUSNews(count), error: null };
        }
      } catch {
        result = { success: true, data: generateUSNews(count), error: null };
      }
    }

    if (result.success && result.data) {
      setCache(cacheKey, result, CACHE_TTL.news);
    }

    return result;
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Failed to get news: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
