import { NextResponse } from 'next/server';
import { addAlert } from '../route';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

const POPULAR_STOCKS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD'];

const FINNHUB_TIMEOUT = 8000;

// --- Technical Indicator Functions (minimal set for scanning) ---

function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function sma(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  if (gains.length < period) return 50;
  let avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

function calculateMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { macd: number; signal: number; histogram: number; prevMacd: number; prevSignal: number } {
  if (closes.length < slow + signal) return { macd: 0, signal: 0, histogram: 0, prevMacd: 0, prevSignal: 0 };
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  const signalLine = ema(macdLine, signal);
  const lastIdx = closes.length - 1;
  const macd = macdLine[lastIdx];
  const signalVal = signalLine[lastIdx];
  const prevMacd = lastIdx > 0 ? macdLine[lastIdx - 1] : macd;
  const prevSignal = lastIdx > 0 ? signalLine[lastIdx - 1] : signalVal;
  return {
    macd: parseFloat(macd.toFixed(4)),
    signal: parseFloat(signalVal.toFixed(4)),
    histogram: parseFloat((macd - signalVal).toFixed(4)),
    prevMacd: parseFloat(prevMacd.toFixed(4)),
    prevSignal: parseFloat(prevSignal.toFixed(4)),
  };
}

function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  numStd: number = 2
): { upper: number; middle: number; lower: number; pricePosition: number } {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, pricePosition: 0.5 };
  const slice = closes.slice(-period);
  const middle = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + numStd * stdDev;
  const lower = middle - numStd * stdDev;
  const currentPrice = closes[closes.length - 1];
  const bandwidth = upper - lower;
  const pricePosition = bandwidth > 0 ? (currentPrice - lower) / bandwidth : 0.5;
  return {
    upper: parseFloat(upper.toFixed(4)),
    middle: parseFloat(middle.toFixed(4)),
    lower: parseFloat(lower.toFixed(4)),
    pricePosition: parseFloat(pricePosition.toFixed(4)),
  };
}

// --- Fetch kline data ---

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function fetchKlineData(symbol: string): Promise<{
  closes: number[];
} | null> {
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  if (!FINNHUB_API_KEY) return null;

  const now = Math.floor(Date.now() / 1000);
  const from = now - 365 * 86400;

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`;
    const response = await fetchWithTimeout(url, FINNHUB_TIMEOUT);

    if (response.ok) {
      const data = await response.json();
      if (data.s === 'ok' && data.c && data.c.length > 30) {
        return { closes: data.c as number[] };
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

// --- Scan a single stock ---

interface ScanResult {
  symbol: string;
  alertsGenerated: number;
  indicators?: {
    rsi: number;
    macdBullish: boolean;
    macdBearish: boolean;
    bollingerBreakout: boolean;
  };
}

async function scanStock(symbol: string): Promise<ScanResult> {
  const result: ScanResult = { symbol, alertsGenerated: 0 };

  try {
    // Try fetching from internal API first
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    let indicators: {
      rsi: number;
      rsiSignal: string;
      macd: { macd: number; signal: number; histogram: number };
      bollingerBands: { upper: number; middle: number; lower: number; pricePosition: number };
      price: number;
    } | null = null;

    try {
      const res = await fetchWithTimeout(
        `${baseUrl}/api/fusion/market/indicators?symbol=${symbol}`,
        FINNHUB_TIMEOUT
      );
      if (res.ok) {
        const data = await res.json();
        indicators = {
          rsi: data.rsi || 50,
          rsiSignal: data.rsiSignal || 'neutral',
          macd: data.macd || { macd: 0, signal: 0, histogram: 0 },
          bollingerBands: data.bollingerBands || { upper: 0, middle: 0, lower: 0, pricePosition: 0.5 },
          price: data.price || 0,
        };
      }
    } catch {
      // Try direct Finnhub kline fetch
    }

    // Fallback: fetch kline and calculate indicators directly
    if (!indicators) {
      const klineData = await fetchKlineData(symbol);
      if (klineData && klineData.closes.length > 30) {
        const rsi = calculateRSI(klineData.closes);
        const macdResult = calculateMACD(klineData.closes);
        const bb = calculateBollingerBands(klineData.closes);
        const price = klineData.closes[klineData.closes.length - 1];

        indicators = {
          rsi,
          rsiSignal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
          macd: { macd: macdResult.macd, signal: macdResult.signal, histogram: macdResult.histogram },
          bollingerBands: bb,
          price,
        };
      }
    }

    if (!indicators) {
      return result;
    }

    result.indicators = {
      rsi: indicators.rsi,
      macdBullish: indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal,
      macdBearish: indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal,
      bollingerBreakout: indicators.bollingerBands.pricePosition > 0.95 || indicators.bollingerBands.pricePosition < 0.05,
    };

    // RSI signals
    if (indicators.rsi < 30) {
      addAlert(symbol, `RSI oversold signal (RSI: ${indicators.rsi.toFixed(1)})`, 'signal', 'high');
      result.alertsGenerated++;
    } else if (indicators.rsi > 70) {
      addAlert(symbol, `RSI overbought warning (RSI: ${indicators.rsi.toFixed(1)})`, 'signal', 'medium');
      result.alertsGenerated++;
    }

    // MACD signals
    if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
      // Check if this is a crossover (previous histogram was negative)
      addAlert(symbol, 'MACD bullish signal', 'signal', 'medium');
      result.alertsGenerated++;
    } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
      addAlert(symbol, 'MACD bearish warning', 'signal', 'medium');
      result.alertsGenerated++;
    }

    // Bollinger Band breakout
    if (indicators.bollingerBands.pricePosition > 0.95) {
      addAlert(symbol, `Bollinger Band breakout (upper, pos: ${(indicators.bollingerBands.pricePosition * 100).toFixed(0)}%)`, 'signal', 'medium');
      result.alertsGenerated++;
    } else if (indicators.bollingerBands.pricePosition < 0.05) {
      addAlert(symbol, `Bollinger Band breakout (lower, pos: ${(indicators.bollingerBands.pricePosition * 100).toFixed(0)}%)`, 'signal', 'medium');
      result.alertsGenerated++;
    }
  } catch (error) {
    console.error(`[alerts/scan] Error scanning ${symbol}:`, error);
  }

  return result;
}

// --- POST /api/alerts/scan ---

export async function POST() {
  try {
    const results: ScanResult[] = [];
    let totalNewAlerts = 0;

    // Use serial try-catch (NOT Promise.all) to avoid memory issues
    for (const symbol of POPULAR_STOCKS) {
      try {
        const scanResult = await scanStock(symbol);
        results.push(scanResult);
        totalNewAlerts += scanResult.alertsGenerated;
      } catch {
        results.push({ symbol, alertsGenerated: 0 });
      }
    }

    return NextResponse.json({
      scanned: POPULAR_STOCKS.length,
      newAlerts: totalNewAlerts,
      results,
      scannedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[alerts/scan] Error:', error);
    return NextResponse.json(
      { error: 'Failed to scan signals' },
      { status: 500 }
    );
  }
}
