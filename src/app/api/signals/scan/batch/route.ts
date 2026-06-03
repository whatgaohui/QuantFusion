import { NextRequest, NextResponse } from 'next/server';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKDJ,
  calculateVolumeRatio,
} from '@/lib/indicators';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CandleData {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  t: number[];
  s?: string;
}

interface SymbolInfo {
  symbol: string;
  description: string;
  displaySymbol: string;
  type: string;
}

interface ScanResult {
  symbol: string;
  description: string;
  score: number;
  signalType: 'BUY' | 'HOLD' | 'SELL';
  price: number;
  rsi: number;
  macdSignal: string;
  bollingerSignal: string;
  kdjSignal: string;
  volumeRatio: number;
}

// ---------------------------------------------------------------------------
// In-memory cache for symbols list (24-hour TTL)
// ---------------------------------------------------------------------------

interface SymbolsCacheEntry {
  data: SymbolInfo[];
  timestamp: number;
}

const symbolsCache = new Map<string, SymbolsCacheEntry>();
const SYMBOLS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for scan results (4-hour TTL)
interface ScanCacheEntry {
  data: { results: ScanResult[]; meta: Record<string, unknown> };
  timestamp: number;
}

const scanCache = new Map<string, ScanCacheEntry>();
const SCAN_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch all stock symbols for an exchange from Finnhub, using our 24h cache. */
async function fetchSymbols(exchange: string, mic?: string): Promise<SymbolInfo[]> {
  const cacheKey = `batch_symbols_${exchange}_${mic || 'all'}`;
  const cached = symbolsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SYMBOLS_CACHE_TTL) {
    return cached.data;
  }

  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return [];

  try {
    let url = `https://finnhub.io/api/v1/stock/symbol?exchange=${encodeURIComponent(exchange)}&token=${FINNHUB_API_KEY}`;
    if (mic) {
      url += `&mic=${encodeURIComponent(mic)}`;
    }
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const symbols: SymbolInfo[] = (Array.isArray(data) ? data : []).map(
      (item: Record<string, string>) => ({
        symbol: item.symbol,
        description: item.description,
        displaySymbol: item.displaySymbol,
        type: item.type,
      })
    );

    symbolsCache.set(cacheKey, { data: symbols, timestamp: Date.now() });
    return symbols;
  } catch {
    return [];
  }
}

/** Fetch daily candle data for a single symbol from Finnhub. */
async function fetchCandleData(symbol: string): Promise<CandleData | null> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return null;

  const to = Math.floor(Date.now() / 1000);
  const from = to - 120 * 86400; // ~120 days for sufficient indicator history

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const data = await response.json();
    if (data.s === 'ok' && data.c && data.c.length >= 30) {
      return { o: data.o, h: data.h, l: data.l, c: data.c, v: data.v, t: data.t, s: data.s };
    }
    return null;
  } catch {
    return null;
  }
}

/** Analyze candle data and produce a signal result. */
function analyzeSignals(
  candleData: CandleData,
  symbol: string,
  description: string
): ScanResult {
  const closes = candleData.c;
  const highs = candleData.h;
  const lows = candleData.l;
  const volumes = candleData.v;

  let score = 0;

  // RSI
  const rsi = calculateRSI(closes, 14);
  let rsiSignal = 'NEUTRAL';
  if (rsi < 30) { score += 20; rsiSignal = 'OVERSOLD'; }
  else if (rsi > 70) { score -= 20; rsiSignal = 'OVERBOUGHT'; }
  else if (rsi < 40) { score += 5; rsiSignal = 'LEANING_OVERSOLD'; }
  else if (rsi > 60) { score -= 5; rsiSignal = 'LEANING_OVERBOUGHT'; }

  // MACD
  const macdResult = calculateMACD(closes);
  let macdSignal = 'NEUTRAL';
  if (macdResult.prevMacd <= macdResult.prevSignal && macdResult.macd > macdResult.signal) {
    score += 25; macdSignal = 'GOLDEN_CROSS';
  } else if (macdResult.prevMacd >= macdResult.prevSignal && macdResult.macd < macdResult.signal) {
    score -= 30; macdSignal = 'DEATH_CROSS';
  } else if (macdResult.macd > macdResult.signal && macdResult.histogram > 0) {
    score += 10; macdSignal = 'BULLISH';
  } else if (macdResult.macd < macdResult.signal && macdResult.histogram < 0) {
    score -= 10; macdSignal = 'BEARISH';
  }

  // Bollinger Bands
  const bbResult = calculateBollingerBands(closes);
  let bollingerSignal = 'NEUTRAL';
  if (bbResult.pricePosition <= 0.2) { score += 15; bollingerSignal = 'NEAR_LOWER'; }
  else if (bbResult.pricePosition >= 0.8) { score -= 15; bollingerSignal = 'NEAR_UPPER'; }
  else if (bbResult.pricePosition < 0.4) { score += 5; bollingerSignal = 'LOWER_HALF'; }
  else if (bbResult.pricePosition > 0.6) { score -= 5; bollingerSignal = 'UPPER_HALF'; }

  // KDJ
  const kdjResult = calculateKDJ(highs, lows, closes);
  let kdjSignal = 'NEUTRAL';
  if (kdjResult.prevK <= kdjResult.prevD && kdjResult.k > kdjResult.d) {
    score += 15; kdjSignal = 'GOLDEN_CROSS';
  } else if (kdjResult.prevK >= kdjResult.prevD && kdjResult.k < kdjResult.d) {
    score -= 15; kdjSignal = 'DEATH_CROSS';
  }
  if (kdjResult.j < 0) { score += 10; kdjSignal = kdjSignal === 'NEUTRAL' ? 'J_OVERSOLD' : kdjSignal; }
  else if (kdjResult.j > 100) { score -= 10; kdjSignal = kdjSignal === 'NEUTRAL' ? 'J_OVERBOUGHT' : kdjSignal; }

  // Volume
  const volumeRatio = calculateVolumeRatio(volumes);
  if (volumeRatio > 2.0) score += 15;
  else if (volumeRatio > 1.5) score += 5;
  else if (volumeRatio < 0.5) score -= 5;

  // Signal type
  let signalType: 'BUY' | 'HOLD' | 'SELL';
  if (score >= 50) signalType = 'BUY';
  else if (score <= -40) signalType = 'SELL';
  else signalType = 'HOLD';

  const currentPrice = closes[closes.length - 1];

  return {
    symbol: symbol.toUpperCase(),
    description,
    score,
    signalType,
    price: currentPrice,
    rsi: parseFloat(rsi.toFixed(2)),
    macdSignal,
    bollingerSignal,
    kdjSignal,
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
  };
}

/** Scan a single stock */
async function scanOneStock(symbol: string, description: string): Promise<ScanResult | null> {
  try {
    const candleData = await fetchCandleData(symbol);
    if (!candleData || !candleData.c || candleData.c.length < 30) return null;
    return analyzeSignals(candleData, symbol, description);
  } catch {
    return null;
  }
}

/** Process an array of symbols in parallel batches with delay. */
async function scanInBatches(
  symbols: SymbolInfo[],
  batchSize: number = 10,
  delayMs: number = 1100
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((s) => scanOneStock(s.symbol, s.description))
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
    // Delay between batches to respect Finnhub rate limit (~60 calls/min)
    if (i + batchSize < symbols.length) {
      await sleep(delayMs);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// GET  /api/signals/scan/batch?exchange=US
// Returns metadata (stock count) without running the scan.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange') || 'US';
    const mic = searchParams.get('mic') || '';

    const allSymbols = await fetchSymbols(exchange, mic || undefined);
    const commonStocks = allSymbols.filter((s) => s.type === 'Common Stock');

    // Check scan cache
    const scanCacheKey = `scan_${exchange}_${mic || 'all'}`;
    const cachedScan = scanCache.get(scanCacheKey);

    return NextResponse.json({
      exchange,
      mic: mic || 'all',
      totalSymbols: allSymbols.length,
      commonStocks: commonStocks.length,
      hasCachedResults: !!cachedScan && Date.now() - cachedScan.timestamp < SCAN_CACHE_TTL,
      cachedResultCount: cachedScan ? cachedScan.data.results.length : 0,
      cachedAt: cachedScan ? new Date(cachedScan.timestamp).toISOString() : null,
    });
  } catch (error) {
    console.error('[signals/scan/batch GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get scan metadata' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/signals/scan/batch
// Body: { exchange?, type?, mic?, limit?, signalFilter? }
// Scans common stocks in the exchange, returns results sorted by score.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const exchange = (body.exchange as string) || 'US';
    const typeFilter = (body.type as string) || 'Common Stock';
    const mic = (body.mic as string) || '';
    const limit = Math.min(Math.max((body.limit as number) || 300, 50), 2000);
    const signalFilter = (body.signalFilter as string) || ''; // 'BUY', 'SELL', or '' (all)
    const forceRefresh = (body.forceRefresh as boolean) || false;
    const mode = (body.mode as string) || ''; // 'watchlist' to scan only watchlist stocks

    // If mode is 'watchlist', scan only the user's watchlist stocks
    if (mode === 'watchlist') {
      const watchlistItems = await db.watchlistItem.findMany({
        orderBy: { sortOrder: 'asc' },
      });

      if (watchlistItems.length === 0) {
        return NextResponse.json(
          { error: 'No stocks in watchlist. Add stocks to your watchlist first.' },
          { status: 400 }
        );
      }

      const watchlistSymbols: SymbolInfo[] = watchlistItems.map((item) => ({
        symbol: item.symbol,
        description: item.name || item.symbol,
        displaySymbol: item.symbol,
        type: 'Common Stock',
      }));

      // Check scan cache for watchlist mode
      const watchlistCacheKey = 'scan_watchlist';
      if (!forceRefresh) {
        const cachedScan = scanCache.get(watchlistCacheKey);
        if (cachedScan && Date.now() - cachedScan.timestamp < SCAN_CACHE_TTL) {
          let results = cachedScan.data.results;
          if (signalFilter) {
            results = results.filter((r) => r.signalType === signalFilter);
          }
          return NextResponse.json({
            ...cachedScan.data.meta,
            results: results.slice(0, limit),
            fromCache: true,
            cachedAt: new Date(cachedScan.timestamp).toISOString(),
          });
        }
      }

      // Scan watchlist stocks
      const results = await scanInBatches(watchlistSymbols, 10, 1100);
      results.sort((a, b) => b.score - a.score);

      const elapsed = Date.now() - startTime;
      const meta = {
        total: watchlistSymbols.length,
        scanLimit: limit,
        scanned: results.length,
        skipped: watchlistSymbols.length - results.length,
        scannedAt: new Date().toISOString(),
        exchange: 'Watchlist',
        type: 'Watchlist',
        mic: 'all',
        elapsedMs: elapsed,
      };

      scanCache.set(watchlistCacheKey, {
        data: { results, meta },
        timestamp: Date.now(),
      });

      let filteredResults = results;
      if (signalFilter) {
        filteredResults = filteredResults.filter((r) => r.signalType === signalFilter);
      }

      return NextResponse.json({
        ...meta,
        results: filteredResults.slice(0, limit),
        fromCache: false,
      });
    }

    // Default: full market scan (legacy behavior)

    // Check scan cache first (4-hour TTL)
    const scanCacheKey = `scan_${exchange}_${mic || 'all'}`;
    if (!forceRefresh) {
      const cachedScan = scanCache.get(scanCacheKey);
      if (cachedScan && Date.now() - cachedScan.timestamp < SCAN_CACHE_TTL) {
        let results = cachedScan.data.results;
        if (signalFilter) {
          results = results.filter((r) => r.signalType === signalFilter);
        }
        return NextResponse.json({
          ...cachedScan.data.meta,
          results: results.slice(0, limit),
          fromCache: true,
          cachedAt: new Date(cachedScan.timestamp).toISOString(),
        });
      }
    }

    // 1. Fetch symbol list
    const allSymbols = await fetchSymbols(exchange, mic || undefined);
    if (allSymbols.length === 0) {
      return NextResponse.json(
        { error: 'No symbols found. Check your Finnhub API key or exchange code.' },
        { status: 400 }
      );
    }

    // 2. Filter by type
    let filtered = allSymbols.filter((s) => s.type === typeFilter);
    if (filtered.length === 0) {
      return NextResponse.json(
        { error: `No stocks of type "${typeFilter}" found for exchange "${exchange}".` },
        { status: 400 }
      );
    }

    // 3. Apply limit (take a random sample to avoid always scanning same stocks)
    const scanList = filtered.length > limit
      ? shuffleArray(filtered).slice(0, limit)
      : filtered;

    // 4. Scan in batches
    const results = await scanInBatches(scanList, 10, 1100);

    // 5. Sort by score descending (strongest BUY signals first)
    results.sort((a, b) => b.score - a.score);

    const elapsed = Date.now() - startTime;

    const meta = {
      total: filtered.length,
      scanLimit: limit,
      scanned: results.length,
      skipped: scanList.length - results.length,
      scannedAt: new Date().toISOString(),
      exchange,
      type: typeFilter,
      mic: mic || 'all',
      elapsedMs: elapsed,
    };

    // Cache the full results (before signal filter and limit)
    scanCache.set(scanCacheKey, {
      data: { results, meta },
      timestamp: Date.now(),
    });

    // Apply signal filter for response
    let filteredResults = results;
    if (signalFilter) {
      filteredResults = filteredResults.filter((r) => r.signalType === signalFilter);
    }

    return NextResponse.json({
      ...meta,
      results: filteredResults.slice(0, limit),
      fromCache: false,
    });
  } catch (error) {
    console.error('[signals/scan/batch POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run batch scan' },
      { status: 500 }
    );
  }
}

/** Fisher-Yates shuffle for random sampling */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
