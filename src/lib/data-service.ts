/**
 * Centralized Data Service for QuantFusion
 *
 * - Wraps Finnhub API calls with proper error handling and caching
 * - Provides US stock data via Finnhub
 * - Provides mock/fallback data for A-share (Chinese) and HK markets
 * - Implements in-memory cache with TTL
 */

import { calculateRSI, calculateMACD, calculateBollingerBands, calculateKDJ } from './indicators';

// ==================== Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface QuoteData {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  timestamp: number;
  market: 'US' | 'A' | 'HK';
}

export interface KlineData {
  symbol: string;
  period: string;
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];
  s: string;
}

export interface NewsItem {
  id: string;
  category: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image: string;
  timestamp: string;
  relatedStocks?: string[];
  sentiment?: string;
}

export interface SectorData {
  name: string;
  change: number;
  changePercent: number;
  volume: number;
  leadingStock: string;
  leadingStockChange: number;
}

export interface IndicatorData {
  symbol: string;
  ma: Record<string, number>;
  macd: { macd: number; signal: number; histogram: number };
  rsi: Record<string, number>;
  bollinger: { upper: number; middle: number; lower: number; pricePosition: number };
  kdj: { k: number; d: number; j: number };
}

// ==================== Cache ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL = {
  quote: 5 * 1000,         // 5s for quotes
  news: 5 * 60 * 1000,     // 5min for news
  kline: 60 * 60 * 1000,   // 1hr for kline
  sectors: 30 * 60 * 1000, // 30min for sectors
  search: 10 * 60 * 1000,  // 10min for search results
};

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    return entry.data as T;
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

// ==================== Config ====================

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd6mjgbhr01qi0ajmg2m0d6mjgbhr01qi0ajmg2mg';

// ==================== Symbol Detection ====================

type MarketType = 'A' | 'HK' | 'US';

function detectMarket(symbol: string): MarketType {
  const upper = symbol.toUpperCase();
  if (upper.startsWith('SH') || upper.startsWith('SZ')) return 'A';
  if (upper.startsWith('HK') || upper === 'HSI') return 'HK';
  return 'US';
}

// ==================== A-Share Mock Data ====================

interface AShareStockDef {
  name: string;
  basePrice: number;
  sector: string;
}

const A_SHARE_STOCKS: Record<string, AShareStockDef> = {
  'SH600519': { name: '贵州茅台', basePrice: 1688.50, sector: '白酒' },
  'SH601318': { name: '中国平安', basePrice: 48.35, sector: '保险' },
  'SZ000001': { name: '平安银行', basePrice: 12.68, sector: '银行' },
  'SH600036': { name: '招商银行', basePrice: 35.42, sector: '银行' },
  'SZ000858': { name: '五粮液', basePrice: 148.90, sector: '白酒' },
  'SH601398': { name: '工商银行', basePrice: 5.48, sector: '银行' },
  'SH600276': { name: '恒瑞医药', basePrice: 45.20, sector: '医药' },
  'SZ002714': { name: '牧原股份', basePrice: 38.65, sector: '农业' },
  'SH600030': { name: '中信证券', basePrice: 22.15, sector: '证券' },
  'SH601012': { name: '隆基绿能', basePrice: 18.90, sector: '新能源' },
  'SZ300750': { name: '宁德时代', basePrice: 178.50, sector: '新能源' },
  'SH600900': { name: '长江电力', basePrice: 28.75, sector: '电力' },
  'SZ000333': { name: '美的集团', basePrice: 62.30, sector: '家电' },
  'SH601888': { name: '中国中免', basePrice: 78.40, sector: '旅游' },
  'SH600809': { name: '山西汾酒', basePrice: 218.60, sector: '白酒' },
  'SZ002475': { name: '立讯精密', basePrice: 33.80, sector: '电子' },
  'SH601899': { name: '紫金矿业', basePrice: 15.20, sector: '矿业' },
  'SZ000568': { name: '泸州老窖', basePrice: 168.30, sector: '白酒' },
  // Indices
  'SH000001': { name: '上证指数', basePrice: 3268.50, sector: '指数' },
  'SZ399001': { name: '深证成指', basePrice: 10456.80, sector: '指数' },
  'SZ399006': { name: '创业板指', basePrice: 2089.30, sector: '指数' },
};

// ==================== HK Market Mock Data ====================

interface HKStockDef {
  name: string;
  basePrice: number;
  sector: string;
}

const HK_STOCKS: Record<string, HKStockDef> = {
  'HK00700': { name: '腾讯控股', basePrice: 378.40, sector: '互联网' },
  'HK09988': { name: '阿里巴巴', basePrice: 82.65, sector: '互联网' },
  'HK03690': { name: '美团', basePrice: 128.50, sector: '互联网' },
  'HK00005': { name: '汇丰控股', basePrice: 68.35, sector: '银行' },
  'HK00941': { name: '中国移动', basePrice: 72.80, sector: '通信' },
  'HK01299': { name: '友邦保险', basePrice: 58.90, sector: '保险' },
  'HK00001': { name: '长和', basePrice: 48.25, sector: '综合企业' },
  'HK02318': { name: '中国平安H', basePrice: 38.60, sector: '保险' },
  'HK01810': { name: '小米集团', basePrice: 18.95, sector: '科技' },
  'HK09618': { name: '京东集团', basePrice: 128.30, sector: '电商' },
  'HK09888': { name: '百度集团', basePrice: 88.50, sector: '科技' },
  'HK02015': { name: '理想汽车', basePrice: 98.40, sector: '汽车' },
  'HK09868': { name: '小鹏汽车', basePrice: 42.80, sector: '汽车' },
  'HK02018': { name: '瑞声科技', basePrice: 32.15, sector: '电子' },
  'HSI': { name: '恒生指数', basePrice: 19632.50, sector: '指数' },
};

// ==================== US Stock Names ====================

const US_STOCK_NAMES: Record<string, string> = {
  'AAPL': 'Apple Inc.',
  'GOOGL': 'Alphabet Inc.',
  'MSFT': 'Microsoft Corp.',
  'AMZN': 'Amazon.com Inc.',
  'NVDA': 'NVIDIA Corp.',
  'META': 'Meta Platforms',
  'TSLA': 'Tesla Inc.',
  'BRK.B': 'Berkshire Hathaway',
  'JPM': 'JPMorgan Chase',
  'V': 'Visa Inc.',
  'JNJ': 'Johnson & Johnson',
  'WMT': 'Walmart Inc.',
  'PG': 'Procter & Gamble',
  'MA': 'Mastercard Inc.',
  'HD': 'Home Depot Inc.',
  'UNH': 'UnitedHealth Group',
  'DIS': 'Walt Disney Co.',
  'NFLX': 'Netflix Inc.',
  'PYPL': 'PayPal Holdings',
  'INTC': 'Intel Corp.',
  'CSCO': 'Cisco Systems',
  'PFE': 'Pfizer Inc.',
  'BA': 'Boeing Co.',
  'GS': 'Goldman Sachs',
  'AMD': 'Advanced Micro Devices',
  'CRM': 'Salesforce Inc.',
  'ORCL': 'Oracle Corp.',
  'QCOM': 'Qualcomm Inc.',
  'COST': 'Costco Wholesale',
  'ADBE': 'Adobe Inc.',
};

// ==================== US Index Fallback Data ====================

const US_INDICES: Record<string, { name: string; basePrice: number }> = {
  '^GSPC': { name: 'S&P 500', basePrice: 5942.17 },
  '^IXIC': { name: 'NASDAQ', basePrice: 19687.54 },
  '^DJI': { name: 'DOW JONES', basePrice: 42342.18 },
};

// ==================== Helper: Random Price Movement ====================

function generateRandomPrice(basePrice: number): {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
} {
  const changePercent = (Math.random() - 0.48) * 6; // ±3% with slight upward bias
  const change = basePrice * (changePercent / 100);
  const currentPrice = basePrice + change;
  const prevClose = basePrice;
  const open = basePrice + (Math.random() - 0.5) * basePrice * 0.01;
  const high = Math.max(currentPrice, open) + Math.random() * basePrice * 0.008;
  const low = Math.min(currentPrice, open) - Math.random() * basePrice * 0.008;
  const volume = Math.floor(10000000 + Math.random() * 90000000);

  return {
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    open: parseFloat(open.toFixed(2)),
    prevClose: parseFloat(prevClose.toFixed(2)),
    volume,
  };
}

// ==================== Helper: Generate Kline Mock Data ====================

function generateMockKline(basePrice: number, count: number): {
  c: number[]; h: number[]; l: number[]; o: number[]; v: number[]; t: number[];
} {
  const c: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const o: number[] = [];
  const v: number[] = [];
  const t: number[] = [];

  let price = basePrice * (0.85 + Math.random() * 0.1);
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * daySeconds;
    const drift = (basePrice - price) / (count - i) * 0.3;
    const volatility = price * 0.02;
    const change = drift + (Math.random() - 0.5) * volatility;

    const openPrice = parseFloat(price.toFixed(2));
    const closePrice = parseFloat((price + change).toFixed(2));
    const highPrice = parseFloat((Math.max(openPrice, closePrice) + Math.random() * volatility * 0.5).toFixed(2));
    const lowPrice = parseFloat((Math.min(openPrice, closePrice) - Math.random() * volatility * 0.5).toFixed(2));
    const volume = Math.floor(20000000 + Math.random() * 80000000);

    o.push(openPrice);
    c.push(closePrice);
    h.push(highPrice);
    l.push(lowPrice);
    v.push(volume);
    t.push(timestamp);

    price = closePrice;
  }

  return { c, h, l, o, v, t };
}

// ==================== Helper: Finnhub API Call ====================

async function finnhubFetch<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
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

// ==================== SMA Helper ====================

function sma(data: number[], period: number): number {
  if (data.length < period) return data.length > 0 ? data[data.length - 1] : 0;
  const slice = data.slice(-period);
  return parseFloat((slice.reduce((sum, val) => sum + val, 0) / period).toFixed(4));
}

// ==================== Public API Functions ====================

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
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 7);
        const formatDate = (d: Date) => d.toISOString().split('T')[0];

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

// ==================== Mock News Generators ====================

function generateAShareNews(count: number): NewsItem[] {
  const templates = [
    { headline: '贵州茅台发布年度业绩报告，营收同比增长16.2%', relatedStocks: ['SH600519'], sentiment: 'bullish' },
    { headline: '中国平安回购计划持续推进，提振市场信心', relatedStocks: ['SH601318'], sentiment: 'bullish' },
    { headline: '招商银行净利润突破1500亿，不良贷款率下降', relatedStocks: ['SH600036'], sentiment: 'bullish' },
    { headline: '五粮液新品发布，高端白酒市场竞争加剧', relatedStocks: ['SZ000858'], sentiment: 'neutral' },
    { headline: '宁德时代全球动力电池市占率继续领先', relatedStocks: ['SZ300750'], sentiment: 'bullish' },
    { headline: 'A股三大指数集体收涨，成交额突破万亿', relatedStocks: ['SH000001', 'SZ399001'], sentiment: 'bullish' },
    { headline: '央行宣布降准0.5个百分点，释放流动性约1万亿', relatedStocks: ['SH601398', 'SZ000001'], sentiment: 'bullish' },
    { headline: '恒瑞医药创新药获批临床，研发管线稳步推进', relatedStocks: ['SH600276'], sentiment: 'bullish' },
    { headline: '隆基绿能光伏组件出货量创新高，海外订单增长', relatedStocks: ['SH601012'], sentiment: 'bullish' },
    { headline: '中信证券：看好A股中长期表现，建议关注消费板块', relatedStocks: ['SH600030'], sentiment: 'bullish' },
    { headline: '牧原股份生猪出栏量环比回升，猪周期拐点或至', relatedStocks: ['SZ002714'], sentiment: 'neutral' },
    { headline: '美的集团海外并购进展顺利，全球化布局加速', relatedStocks: ['SZ000333'], sentiment: 'bullish' },
    { headline: '创业板指冲高回落，科技股分化明显', relatedStocks: ['SZ399006'], sentiment: 'bearish' },
    { headline: '长江电力股息率超4%，防御性标的受追捧', relatedStocks: ['SH600900'], sentiment: 'neutral' },
    { headline: '山西汾酒三季度业绩超预期，清香型白酒市场扩容', relatedStocks: ['SH600809'], sentiment: 'bullish' },
    { headline: '紫金矿业金铜价格共振，业绩弹性凸显', relatedStocks: ['SH601899'], sentiment: 'bullish' },
    { headline: '中国中免免税销售恢复增长，海南离岛免税数据改善', relatedStocks: ['SH601888'], sentiment: 'bullish' },
    { headline: '立讯精密获大客户新订单，消费电子景气度回升', relatedStocks: ['SZ002475'], sentiment: 'bullish' },
    { headline: 'A股市场情绪指标：融资余额突破1.8万亿', relatedStocks: ['SH000001'], sentiment: 'neutral' },
    { headline: '泸州老窖国窖1573提价5%，高端白酒价格带上移', relatedStocks: ['SZ000568'], sentiment: 'bullish' },
  ];

  const sources = ['财联社', '东方财富', '同花顺', '证券时报', '上海证券报', '中国证券报', '第一财经', '华尔街见闻'];

  return templates.slice(0, count).map((item, idx) => {
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    return {
      id: `a-news-${idx}-${Date.now()}`,
      category: 'ashare',
      headline: item.headline,
      summary: item.headline,
      source: sources[Math.floor(Math.random() * sources.length)],
      url: '#',
      image: '',
      timestamp,
      relatedStocks: item.relatedStocks,
      sentiment: item.sentiment,
    };
  });
}

function generateHKNews(count: number): NewsItem[] {
  const templates = [
    { headline: '腾讯控股回购力度加大，单日回购超10亿港元', relatedStocks: ['HK00700'], sentiment: 'bullish' },
    { headline: '阿里巴巴核心电商业务恢复增长，云业务扭亏在望', relatedStocks: ['HK09988'], sentiment: 'bullish' },
    { headline: '美团即时配送订单量创新高，本地生活赛道持续扩展', relatedStocks: ['HK03690'], sentiment: 'bullish' },
    { headline: '恒生指数调整成分股，新增多家新经济企业', relatedStocks: ['HSI'], sentiment: 'neutral' },
    { headline: '汇丰控股宣布新一轮回购计划，股东回报力度加大', relatedStocks: ['HK00005'], sentiment: 'bullish' },
    { headline: '小米汽车交付量持续攀升，产能爬坡顺利', relatedStocks: ['HK01810'], sentiment: 'bullish' },
    { headline: '友邦保险新业务价值增长超预期，内地市场拓展加速', relatedStocks: ['HK01299'], sentiment: 'bullish' },
    { headline: '中国移动5G用户数突破8亿，ARPU值稳步提升', relatedStocks: ['HK00941'], sentiment: 'neutral' },
    { headline: '京东物流收入增速领跑行业，供应链服务生态完善', relatedStocks: ['HK09618'], sentiment: 'bullish' },
    { headline: '理想汽车月交付突破5万辆，新车型L6受市场热捧', relatedStocks: ['HK02015'], sentiment: 'bullish' },
    { headline: '港股通南向资金持续净流入，低估值蓝筹受青睐', relatedStocks: ['HSI'], sentiment: 'bullish' },
    { headline: '百度文心大模型商业化加速，AI搜索用户突破2亿', relatedStocks: ['HK09888'], sentiment: 'bullish' },
    { headline: '港股市场情绪改善，恒指站上20000点关口', relatedStocks: ['HSI'], sentiment: 'bullish' },
    { headline: '小鹏汽车新车型MONA订单破10万，性价比路线获认可', relatedStocks: ['HK09868'], sentiment: 'bullish' },
    { headline: '港股IPO市场回暖，多家新经济企业排队上市', relatedStocks: ['HSI'], sentiment: 'neutral' },
  ];

  const sources = ['香港经济日报', '信报', '明报', '南华早报', '财华社', '智通财经', '格隆汇', '富途资讯'];

  return templates.slice(0, count).map((item, idx) => {
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    return {
      id: `hk-news-${idx}-${Date.now()}`,
      category: 'hk',
      headline: item.headline,
      summary: item.headline,
      source: sources[Math.floor(Math.random() * sources.length)],
      url: '#',
      image: '',
      timestamp,
      relatedStocks: item.relatedStocks,
      sentiment: item.sentiment,
    };
  });
}

function generateUSNews(count: number): NewsItem[] {
  const templates = [
    { headline: 'Fed signals potential rate cuts as inflation shows signs of cooling', sentiment: 'bullish' },
    { headline: 'Tech stocks rally on strong earnings, NASDAQ hits new high', sentiment: 'bullish' },
    { headline: 'Apple announces new AI features across product lineup', sentiment: 'bullish' },
    { headline: 'Microsoft cloud revenue surpasses expectations, Azure growth accelerates', sentiment: 'bullish' },
    { headline: 'NVIDIA continues to dominate AI chip market, data center revenue surges', sentiment: 'bullish' },
    { headline: 'S&P 500 notches weekly gain amid positive economic data', sentiment: 'bullish' },
    { headline: 'Tesla deliveries exceed estimates, stock rises in premarket', sentiment: 'bullish' },
    { headline: 'Amazon Web Services launches new AI-powered services', sentiment: 'bullish' },
    { headline: 'Google DeepMind achieves breakthrough in protein structure prediction', sentiment: 'neutral' },
    { headline: 'US job market remains resilient, unemployment rate holds steady', sentiment: 'neutral' },
    { headline: 'Oil prices surge on OPEC+ production cut extension', sentiment: 'bearish' },
    { headline: 'Bank of America upgrades semiconductor sector outlook', sentiment: 'bullish' },
    { headline: 'Consumer confidence index rises to six-month high', sentiment: 'bullish' },
    { headline: 'Dow Jones retreats from record high on profit-taking', sentiment: 'neutral' },
    { headline: 'Meta Platforms invests heavily in metaverse infrastructure', sentiment: 'neutral' },
  ];

  const sources = ['Reuters', 'Bloomberg', 'CNBC', 'Wall Street Journal', 'MarketWatch', 'Yahoo Finance', 'Barrons', 'Financial Times'];

  return templates.slice(0, count).map((item, idx) => {
    const hoursAgo = Math.floor(Math.random() * 48);
    const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    return {
      id: `us-news-${idx}-${Date.now()}`,
      category: 'general',
      headline: item.headline,
      summary: item.headline,
      source: sources[Math.floor(Math.random() * sources.length)],
      url: '#',
      image: '',
      timestamp,
      sentiment: item.sentiment,
    };
  });
}

// ==================== Mock Sector Generators ====================

function generateAShareSectors(): SectorData[] {
  const sectors = [
    { name: '白酒', change: 1.85, leadingStock: '贵州茅台', leadingStockChange: 2.1 },
    { name: '银行', change: 0.52, leadingStock: '招商银行', leadingStockChange: 0.8 },
    { name: '保险', change: 1.23, leadingStock: '中国平安', leadingStockChange: 1.5 },
    { name: '医药', change: -0.68, leadingStock: '恒瑞医药', leadingStockChange: -0.3 },
    { name: '新能源', change: 2.15, leadingStock: '宁德时代', leadingStockChange: 2.8 },
    { name: '证券', change: 0.95, leadingStock: '中信证券', leadingStockChange: 1.2 },
    { name: '家电', change: 0.73, leadingStock: '美的集团', leadingStockChange: 0.9 },
    { name: '电子', change: -0.42, leadingStock: '立讯精密', leadingStockChange: -0.5 },
    { name: '矿业', change: 1.56, leadingStock: '紫金矿业', leadingStockChange: 1.8 },
    { name: '农业', change: -1.12, leadingStock: '牧原股份', leadingStockChange: -1.5 },
    { name: '电力', change: 0.38, leadingStock: '长江电力', leadingStockChange: 0.4 },
    { name: '旅游', change: 0.89, leadingStock: '中国中免', leadingStockChange: 1.1 },
  ];

  return sectors.map(s => ({
    name: s.name,
    change: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    changePercent: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    volume: Math.floor(5000000 + Math.random() * 50000000),
    leadingStock: s.leadingStock,
    leadingStockChange: parseFloat((s.leadingStockChange + (Math.random() - 0.5) * 0.3).toFixed(2)),
  }));
}

function generateHKSectors(): SectorData[] {
  const sectors = [
    { name: '互联网', change: 2.35, leadingStock: '腾讯控股', leadingStockChange: 2.8 },
    { name: '银行', change: 0.65, leadingStock: '汇丰控股', leadingStockChange: 0.9 },
    { name: '保险', change: 1.12, leadingStock: '友邦保险', leadingStockChange: 1.4 },
    { name: '科技', change: 1.89, leadingStock: '小米集团', leadingStockChange: 2.2 },
    { name: '电商', change: 1.56, leadingStock: '阿里巴巴', leadingStockChange: 1.8 },
    { name: '汽车', change: -0.78, leadingStock: '理想汽车', leadingStockChange: -0.5 },
    { name: '通信', change: 0.42, leadingStock: '中国移动', leadingStockChange: 0.6 },
    { name: '综合企业', change: 0.28, leadingStock: '长和', leadingStockChange: 0.3 },
    { name: '电子', change: -0.35, leadingStock: '瑞声科技', leadingStockChange: -0.2 },
  ];

  return sectors.map(s => ({
    name: s.name,
    change: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    changePercent: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    volume: Math.floor(3000000 + Math.random() * 30000000),
    leadingStock: s.leadingStock,
    leadingStockChange: parseFloat((s.leadingStockChange + (Math.random() - 0.5) * 0.3).toFixed(2)),
  }));
}

function generateUSSectors(): SectorData[] {
  const sectors = [
    { name: 'Technology', change: 1.85, leadingStock: 'NVDA', leadingStockChange: 2.4 },
    { name: 'Healthcare', change: 0.45, leadingStock: 'UNH', leadingStockChange: 0.6 },
    { name: 'Financials', change: 0.92, leadingStock: 'JPM', leadingStockChange: 1.1 },
    { name: 'Consumer Discretionary', change: 1.23, leadingStock: 'AMZN', leadingStockChange: 1.5 },
    { name: 'Energy', change: -0.56, leadingStock: 'XOM', leadingStockChange: -0.8 },
    { name: 'Industrials', change: 0.38, leadingStock: 'CAT', leadingStockChange: 0.5 },
    { name: 'Communication Services', change: 1.67, leadingStock: 'META', leadingStockChange: 2.0 },
    { name: 'Utilities', change: -0.23, leadingStock: 'NEE', leadingStockChange: -0.3 },
    { name: 'Real Estate', change: 0.15, leadingStock: 'PLD', leadingStockChange: 0.2 },
    { name: 'Materials', change: 0.72, leadingStock: 'LIN', leadingStockChange: 0.9 },
    { name: 'Consumer Staples', change: 0.31, leadingStock: 'PG', leadingStockChange: 0.4 },
  ];

  return sectors.map(s => ({
    name: s.name,
    change: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    changePercent: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    volume: Math.floor(10000000 + Math.random() * 80000000),
    leadingStock: s.leadingStock,
    leadingStockChange: parseFloat((s.leadingStockChange + (Math.random() - 0.5) * 0.3).toFixed(2)),
  }));
}
