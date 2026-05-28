/**
 * Configuration for QuantFusion Data Service
 * API keys, market detection, and Finnhub fetch helper
 */

export const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd6mjgbhr01qi0ajmg2m0d6mjgbhr01qi0ajmg2mg';

export type MarketType = 'A' | 'HK' | 'US';

export function detectMarket(symbol: string): MarketType {
  const upper = symbol.toUpperCase();
  if (upper.startsWith('SH') || upper.startsWith('SZ')) return 'A';
  if (upper.startsWith('HK') || upper === 'HSI') return 'HK';
  return 'US';
}

export async function finnhubFetch<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  try {
    const urlParams = new URLSearchParams({ ...params, token: FINNHUB_API_KEY });
    const url = `https://finnhub.io/api/v1/${endpoint}?${urlParams.toString()}`;

    // Use AbortController with 8s timeout to prevent hanging/crashing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 0 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Finnhub API error: ${response.status} for ${endpoint}`);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.error(`Finnhub API error: ${data.error}`);
      return null;
    }

    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`Finnhub fetch timeout for ${endpoint}`);
    } else {
      console.error(`Finnhub fetch failed for ${endpoint}:`, err);
    }
    return null;
  }
}
