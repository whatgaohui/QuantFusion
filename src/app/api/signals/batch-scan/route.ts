import { NextRequest, NextResponse } from 'next/server';
import { ALL_STOCKS, getStocksByMarket, type StockInfo } from '@/lib/stock-universe';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKDJ,
  calculateVolumeRatio,
} from '@/lib/indicators';

// ── Types ─────────────────────────────────────────────────────

interface OHLCV {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

interface StockScanResult {
  symbol: string;
  name: string;
  market: string;
  price: number;
  score: number;
  signalType: 'BUY' | 'HOLD' | 'SELL';
  rsi: number;
  macdSignal: string;
  bollingerSignal: string;
  kdjSignal: string;
  volumeRatio: number;
  source: string;
}

interface BatchScanResponse {
  totalStocks: number;
  scannedStocks: number;
  skippedStocks: number;
  results: StockScanResult[];
  summary: {
    buy: number;
    hold: number;
    sell: number;
  };
  scannedAt: string;
}

// ── Simple semaphore for concurrency control ──────────────────

class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private max: number) {}

  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryRun = () => {
        if (this.running < this.max) {
          this.running++;
          resolve(() => {
            this.running--;
            if (this.queue.length > 0) {
              const next = this.queue.shift()!;
              next();
            }
          });
        } else {
          this.queue.push(tryRun);
        }
      };
      tryRun();
    });
  }
}

// ── Data fetching helpers ─────────────────────────────────────

/**
 * Fetch 1-year daily candles from Finnhub.
 * Returns null when the API key is missing, the request fails,
 * or the response does not contain enough data.
 */
async function fetchFinnhubCandles(symbol: string): Promise<OHLCV | null> {
  const apiKey = await getFinnhubApiKey();
  if (!apiKey) return null;

  const to = Math.floor(Date.now() / 1000);
  const from = to - 365 * 86400;

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.s !== 'ok' || !data.c || data.c.length < 30) return null;

    return {
      opens: data.o,
      highs: data.h,
      lows: data.l,
      closes: data.c,
      volumes: data.v,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch 1-year daily candles from Yahoo Finance as a fallback.
 * Returns null when the request fails or data is insufficient.
 */
async function fetchYahooCandles(symbol: string): Promise<OHLCV | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!response.ok) return null;

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const quote = result.indicators?.quote?.[0];
    if (!quote) return null;

    const closes: number[] = (quote.close ?? []).filter((v: number | null): v is number => v !== null);
    if (closes.length < 30) return null;

    const opens: number[] = (quote.open ?? []).filter((v: number | null): v is number => v !== null);
    const highs: number[] = (quote.high ?? []).filter((v: number | null): v is number => v !== null);
    const lows: number[] = (quote.low ?? []).filter((v: number | null): v is number => v !== null);
    const volumes: number[] = (quote.volume ?? []).filter((v: number | null): v is number => v !== null);

    // Align arrays to the minimum valid length
    const minLen = Math.min(opens.length, highs.length, lows.length, closes.length, volumes.length);
    if (minLen < 30) return null;

    return {
      opens: opens.slice(0, minLen),
      highs: highs.slice(0, minLen),
      lows: lows.slice(0, minLen),
      closes: closes.slice(0, minLen),
      volumes: volumes.slice(0, minLen),
    };
  } catch {
    return null;
  }
}

/**
 * Try Finnhub first, then Yahoo Finance. Return null if both fail.
 */
async function fetchCandles(symbol: string): Promise<{ data: OHLCV; source: string } | null> {
  const finnhub = await fetchFinnhubCandles(symbol);
  if (finnhub) return { data: finnhub, source: 'finnhub' };

  const yahoo = await fetchYahooCandles(symbol);
  if (yahoo) return { data: yahoo, source: 'yahoo' };

  return null;
}

// ── Signal analysis ───────────────────────────────────────────

/**
 * Compute a composite signal score and individual indicator signals.
 * Score starts at 50; adjustments per the specification:
 *  - RSI < 30: +20, < 40: +10, > 70: -20, > 60: -5
 *  - MACD golden cross: +25, death cross: -30, bullish: +10, bearish: -10
 *  - Bollinger near lower (position <= 0.2): +15, near upper (>= 0.8): -15
 *  - KDJ golden cross: +15, death cross: -15
 *  - Volume ratio > 2.0: +15, > 1.5: +5, < 0.5: -5
 *  - score >= 55 → BUY, score <= 45 → SELL, else HOLD
 */
function analyzeSignals(ohlcv: OHLCV): {
  score: number;
  signalType: 'BUY' | 'HOLD' | 'SELL';
  rsi: number;
  macdSignal: string;
  bollingerSignal: string;
  kdjSignal: string;
  volumeRatio: number;
} {
  const { closes, highs, lows, volumes } = ohlcv;
  let score = 50;

  // ── RSI ───────────────────────────────────────
  const rsi = calculateRSI(closes, 14);
  if (rsi < 30) score += 20;
  else if (rsi < 40) score += 10;
  if (rsi > 70) score -= 20;
  else if (rsi > 60) score -= 5;

  // ── MACD ──────────────────────────────────────
  const macdResult = calculateMACD(closes);
  let macdSignal = 'NEUTRAL';
  const isGoldenCross = macdResult.prevMacd <= macdResult.prevSignal && macdResult.macd > macdResult.signal;
  const isDeathCross = macdResult.prevMacd >= macdResult.prevSignal && macdResult.macd < macdResult.signal;
  const isBullish = macdResult.macd > macdResult.signal && macdResult.histogram > 0;
  const isBearish = macdResult.macd < macdResult.signal && macdResult.histogram < 0;

  if (isGoldenCross) { score += 25; macdSignal = 'GOLDEN_CROSS'; }
  else if (isDeathCross) { score -= 30; macdSignal = 'DEATH_CROSS'; }
  else if (isBullish) { score += 10; macdSignal = 'BULLISH'; }
  else if (isBearish) { score -= 10; macdSignal = 'BEARISH'; }

  // ── Bollinger Bands ───────────────────────────
  const bb = calculateBollingerBands(closes);
  let bollingerSignal = 'NEUTRAL';
  if (bb.pricePosition <= 0.2) { score += 15; bollingerSignal = 'NEAR_LOWER'; }
  else if (bb.pricePosition >= 0.8) { score -= 15; bollingerSignal = 'NEAR_UPPER'; }

  // ── KDJ ───────────────────────────────────────
  const kdj = calculateKDJ(highs, lows, closes);
  let kdjSignal = 'NEUTRAL';
  if (kdj.prevK <= kdj.prevD && kdj.k > kdj.d) { score += 15; kdjSignal = 'GOLDEN_CROSS'; }
  else if (kdj.prevK >= kdj.prevD && kdj.k < kdj.d) { score -= 15; kdjSignal = 'DEATH_CROSS'; }

  // ── Volume Ratio ──────────────────────────────
  const volRatio = calculateVolumeRatio(volumes);
  if (volRatio > 2.0) score += 15;
  else if (volRatio > 1.5) score += 5;
  if (volRatio < 0.5) score -= 5;

  // ── Final signal ──────────────────────────────
  const signalType: 'BUY' | 'HOLD' | 'SELL' = score >= 55 ? 'BUY' : score <= 45 ? 'SELL' : 'HOLD';

  return {
    score,
    signalType,
    rsi: parseFloat(rsi.toFixed(2)),
    macdSignal,
    bollingerSignal,
    kdjSignal,
    volumeRatio: parseFloat(volRatio.toFixed(2)),
  };
}

// ── Scan a single stock ───────────────────────────────────────

async function scanSingleStock(stock: StockInfo): Promise<StockScanResult | null> {
  try {
    const result = await fetchCandles(stock.symbol);
    if (!result) return null;

    const signals = analyzeSignals(result.data);
    const price = result.data.closes[result.data.closes.length - 1];

    return {
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      price: parseFloat(price.toFixed(2)),
      ...signals,
      source: result.source,
    };
  } catch {
    // Individual stock failure should not crash the batch
    return null;
  }
}

// ── POST /api/signals/batch-scan ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { market, symbols, maxConcurrency: rawConcurrency } = body as {
      market?: 'US' | 'HK' | 'A';
      symbols?: string[];
      maxConcurrency?: number;
    };

    const maxConcurrency = Math.max(1, Math.min(10, rawConcurrency ?? 3));

    // ── Determine which stocks to scan ──────────
    let stocksToScan: StockInfo[];

    if (symbols && symbols.length > 0) {
      // Scan only the specified symbols
      const symbolSet = new Set(symbols.map((s) => s.toUpperCase()));
      stocksToScan = ALL_STOCKS.filter((s) => symbolSet.has(s.symbol.toUpperCase()));
      // Also include unknown symbols (user may pass symbols not in our universe)
      for (const sym of symbols) {
        if (!stocksToScan.find((s) => s.symbol.toUpperCase() === sym.toUpperCase())) {
          stocksToScan.push({ symbol: sym, name: sym, market: 'US' });
        }
      }
    } else if (market) {
      stocksToScan = getStocksByMarket(market);
    } else {
      stocksToScan = ALL_STOCKS;
    }

    const totalStocks = stocksToScan.length;

    // ── Scan with concurrency control ───────────
    const semaphore = new Semaphore(maxConcurrency);
    const results: StockScanResult[] = [];

    // Process in batches: acquire semaphore → scan → release
    const tasks = stocksToScan.map(async (stock) => {
      const release = await semaphore.acquire();
      try {
        const scanResult = await scanSingleStock(stock);
        if (scanResult) {
          results.push(scanResult);
        }
      } finally {
        release();
      }
    });

    await Promise.all(tasks);

    // ── Build summary ───────────────────────────
    const buyCount = results.filter((r) => r.signalType === 'BUY').length;
    const sellCount = results.filter((r) => r.signalType === 'SELL').length;
    const holdCount = results.filter((r) => r.signalType === 'HOLD').length;

    // Sort results: BUY first (by score desc), then HOLD, then SELL (by score asc)
    const order: Record<string, number> = { BUY: 0, HOLD: 1, SELL: 2 };
    results.sort((a, b) => {
      const typeDiff = order[a.signalType] - order[b.signalType];
      if (typeDiff !== 0) return typeDiff;
      if (a.signalType === 'SELL') return a.score - b.score; // worst sell first
      return b.score - a.score; // best buy/hold first
    });

    const scannedStocks = results.length;
    const skippedStocks = totalStocks - scannedStocks;

    const response: BatchScanResponse = {
      totalStocks,
      scannedStocks,
      skippedStocks,
      results,
      summary: {
        buy: buyCount,
        hold: holdCount,
        sell: sellCount,
      },
      scannedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[batch-scan] POST error:', error);
    return NextResponse.json(
      { error: 'Batch scan failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ── GET /api/signals/batch-scan ───────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') as 'US' | 'HK' | 'A' | null;

    let stocks: StockInfo[];
    if (market && ['US', 'HK', 'A'].includes(market)) {
      stocks = getStocksByMarket(market);
    } else {
      stocks = ALL_STOCKS;
    }

    return NextResponse.json({
      total: stocks.length,
      stocks: stocks.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        market: s.market,
      })),
    });
  } catch (error) {
    console.error('[batch-scan] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve stock universe', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
