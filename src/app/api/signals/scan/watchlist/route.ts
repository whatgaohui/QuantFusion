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
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';

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
  market?: string;
}

// ---------------------------------------------------------------------------
// In-memory cache for watchlist scan results (30-minute TTL)
// ---------------------------------------------------------------------------

interface WatchlistScanCacheEntry {
  data: { results: ScanResult[]; meta: Record<string, unknown> };
  timestamp: number;
}

const watchlistScanCache = new Map<string, WatchlistScanCacheEntry>();
const WATCHLIST_SCAN_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  description: string,
  market?: string
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
    market,
  };
}

/** Scan a single stock */
async function scanOneStock(
  symbol: string,
  description: string,
  market?: string
): Promise<ScanResult | null> {
  try {
    const candleData = await fetchCandleData(symbol);
    if (!candleData || !candleData.c || candleData.c.length < 30) return null;
    return analyzeSignals(candleData, symbol, description, market);
  } catch {
    return null;
  }
}

/** Process watchlist items in parallel batches with delay. */
async function scanInBatches(
  items: { symbol: string; name: string | null; market: string }[],
  batchSize: number = 5,
  delayMs: number = 1100
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => scanOneStock(item.symbol, item.name || item.symbol, item.market))
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
    // Delay between batches to respect Finnhub rate limit (~60 calls/min)
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// GET  /api/signals/scan/watchlist
// Returns watchlist stock count and cached scan status.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    await ensureDefaultUser();

    const watchlistItems = await db.watchlistItem.findMany({
      where: { userId: DEFAULT_USER_ID },
    });

    // Check scan cache
    const cacheKey = `watchlist_scan_${DEFAULT_USER_ID}`;
    const cachedScan = watchlistScanCache.get(cacheKey);
    const hasCachedResults = !!cachedScan && Date.now() - cachedScan.timestamp < WATCHLIST_SCAN_CACHE_TTL;

    return NextResponse.json({
      watchlistCount: watchlistItems.length,
      hasCachedResults,
      cachedResultCount: cachedScan ? cachedScan.data.results.length : 0,
      cachedAt: cachedScan ? new Date(cachedScan.timestamp).toISOString() : null,
    });
  } catch (error) {
    console.error('[signals/scan/watchlist GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get watchlist scan metadata' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/signals/scan/watchlist
// Body: { signalFilter?: string, forceRefresh?: boolean }
// Scans all stocks in the user's watchlist, returns results sorted by score.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    await ensureDefaultUser();

    const body = await request.json().catch(() => ({}));
    const signalFilter = (body.signalFilter as string) || ''; // 'BUY', 'SELL', or '' (all)
    const forceRefresh = (body.forceRefresh as boolean) || false;

    // Check scan cache first (30-minute TTL)
    const cacheKey = `watchlist_scan_${DEFAULT_USER_ID}`;
    if (!forceRefresh) {
      const cachedScan = watchlistScanCache.get(cacheKey);
      if (cachedScan && Date.now() - cachedScan.timestamp < WATCHLIST_SCAN_CACHE_TTL) {
        let results = cachedScan.data.results;
        if (signalFilter) {
          results = results.filter((r) => r.signalType === signalFilter);
        }
        return NextResponse.json({
          ...cachedScan.data.meta,
          results,
          fromCache: true,
        });
      }
    }

    // 1. Fetch watchlist from DB
    const watchlistItems = await db.watchlistItem.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { sortOrder: 'asc' },
    });

    if (watchlistItems.length === 0) {
      return NextResponse.json({
        total: 0,
        scanned: 0,
        skipped: 0,
        scannedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startTime,
        fromCache: false,
        results: [],
      });
    }

    // 2. Scan in batches of 5 with 1.1s delay
    const results = await scanInBatches(
      watchlistItems.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        market: item.market,
      })),
      5,
      1100
    );

    // 3. Sort by score descending (strongest BUY signals first)
    results.sort((a, b) => b.score - a.score);

    const elapsed = Date.now() - startTime;

    const meta = {
      total: watchlistItems.length,
      scanned: results.length,
      skipped: watchlistItems.length - results.length,
      scannedAt: new Date().toISOString(),
      elapsedMs: elapsed,
    };

    // Cache the full results (before signal filter)
    watchlistScanCache.set(cacheKey, {
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
      results: filteredResults,
      fromCache: false,
    });
  } catch (error) {
    console.error('[signals/scan/watchlist POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run watchlist scan' },
      { status: 500 }
    );
  }
}
