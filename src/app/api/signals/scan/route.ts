import { NextRequest, NextResponse } from 'next/server';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKDJ,
  calculateVolumeRatio,
} from '@/lib/indicators';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';

interface CandleData {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
  t: number[];
}

interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
}

// Sector mapping for stocks
const STOCK_SECTORS: Record<string, Record<string, { name: string; sector: string }>> = {
  A: {
    'SH600519': { name: '贵州茅台', sector: '白酒' },
    'SH601318': { name: '中国平安', sector: '保险' },
    'SH600036': { name: '招商银行', sector: '银行' },
    'SZ000858': { name: '五粮液', sector: '白酒' },
    'SH601398': { name: '工商银行', sector: '银行' },
    'SZ300750': { name: '宁德时代', sector: '新能源' },
    'SH600276': { name: '恒瑞医药', sector: '医药' },
    'SH600030': { name: '中信证券', sector: '券商' },
    'SZ000333': { name: '美的集团', sector: '家电' },
    'SH600900': { name: '长江电力', sector: '电力' },
    'SH601899': { name: '紫金矿业', sector: '有色金属' },
    'SZ002475': { name: '立讯精密', sector: '电子' },
  },
  HK: {
    'HK00700': { name: '腾讯控股', sector: '科技' },
    'HK09988': { name: '阿里巴巴', sector: '电商' },
    'HK03690': { name: '美团', sector: '本地生活' },
    'HK00005': { name: '汇丰控股', sector: '银行' },
    'HK00941': { name: '中国移动', sector: '通信' },
    'HK01299': { name: '友邦保险', sector: '保险' },
    'HK01810': { name: '小米集团', sector: '消费电子' },
    'HK09618': { name: '京东集团', sector: '电商' },
    'HK09888': { name: '百度集团', sector: '科技' },
    'HK02015': { name: '理想汽车', sector: '汽车' },
  },
  US: {
    'AAPL': { name: '苹果', sector: '科技' },
    'NVDA': { name: '英伟达', sector: '半导体' },
    'TSLA': { name: '特斯拉', sector: '汽车' },
    'MSFT': { name: '微软', sector: '科技' },
    'AMZN': { name: '亚马逊', sector: '电商' },
    'META': { name: 'Meta', sector: '社交媒体' },
    'GOOGL': { name: '谷歌', sector: '科技' },
    'AMD': { name: 'AMD', sector: '半导体' },
    'JPM': { name: '摩根大通', sector: '银行' },
    'V': { name: 'Visa', sector: '金融' },
  },
};

function generateMockCandleData(currentPrice: number, days: number = 90): CandleData {
  const result: CandleData = { o: [], h: [], l: [], c: [], v: [], t: [] };
  let price = currentPrice * (0.85 + Math.random() * 0.1);
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;

  for (let i = 0; i < days; i++) {
    const timestamp = now - (days - i) * daySeconds;
    const drift = (currentPrice - price) / (days - i) * 0.3;
    const volatility = price * 0.02;
    const change = drift + (Math.random() - 0.5) * volatility;

    const open = Number(price.toFixed(2));
    const close = Number((price + change).toFixed(2));
    const high = Number((Math.max(open, close) + Math.random() * volatility * 0.5).toFixed(2));
    const low = Number((Math.min(open, close) - Math.random() * volatility * 0.5).toFixed(2));
    const volume = Math.floor(30000000 + Math.random() * 70000000);

    result.o.push(open);
    result.c.push(close);
    result.h.push(high);
    result.l.push(low);
    result.v.push(volume);
    result.t.push(timestamp);
    price = close;
  }
  return result;
}

// Convert A/HK stock symbol to Finnhub-compatible format
function toFinnhubSymbol(symbol: string): string {
  // A-shares: SH600519 → 600519.SS, SZ000858 → 000858.SZ
  if (symbol.startsWith('SH')) return symbol.slice(2) + '.SS';
  if (symbol.startsWith('SZ')) return symbol.slice(2) + '.SZ';
  // HK stocks: HK00700 → 0700.HK
  if (symbol.startsWith('HK')) return symbol.slice(2).replace(/^0*/, '') + '.HK';
  // US stocks: already correct
  return symbol;
}

async function fetchCandleData(symbol: string): Promise<{ candle: CandleData | null; usedRealData: boolean }> {
  const finnhubSymbol = toFinnhubSymbol(symbol);

  // Try Finnhub candle API first
  if (FINNHUB_API_KEY) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 120 * 86400; // 120 days to ensure 90 trading days

    const data = await finnhubFetch<{ s: string; c: number[]; o: number[]; h: number[]; l: number[]; v: number[]; t: number[] }>(
      'stock/candle',
      { symbol: finnhubSymbol, resolution: 'D', from: String(from), to: String(to) }
    );

    if (data && data.s === 'ok' && data.c && data.c.length >= 30) {
      return { candle: { o: data.o, h: data.h, l: data.l, c: data.c, v: data.v, t: data.t }, usedRealData: true };
    }

    // Try getting current price from quote for better mock data
    const quoteData = await finnhubFetch<{ c: number }>('quote', { symbol: finnhubSymbol });
    if (quoteData && quoteData.c && quoteData.c > 0) {
      return { candle: generateMockCandleData(quoteData.c, 90), usedRealData: false };
    }
  }

  return { candle: generateMockCandleData(150, 90), usedRealData: false };
}

async function fetchQuotePrice(symbol: string): Promise<number> {
  const finnhubSymbol = toFinnhubSymbol(symbol);
  const data = await finnhubFetch<{ c: number; dp: number }>('quote', { symbol: finnhubSymbol });
  return data?.c || 0;
}

function analyzeSignals(candleData: CandleData, symbol: string, stockInfo: { name: string; sector: string }) {
  const closes = candleData.c;
  const highs = candleData.h;
  const lows = candleData.l;
  const volumes = candleData.v;

  // Calculate all indicators from real candle data
  const rsi = calculateRSI(closes, 14);
  const macdResult = calculateMACD(closes);
  const bbResult = calculateBollingerBands(closes);
  const kdjResult = calculateKDJ(highs, lows, closes);
  const volumeRatio = calculateVolumeRatio(volumes);

  // Calculate MA
  const ma5 = closes.length >= 5 ? closes.slice(-5).reduce((s, v) => s + v, 0) / 5 : 0;
  const ma10 = closes.length >= 10 ? closes.slice(-10).reduce((s, v) => s + v, 0) / 10 : 0;
  const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((s, v) => s + v, 0) / 20 : 0;
  const ma60 = closes.length >= 60 ? closes.slice(-60).reduce((s, v) => s + v, 0) / 60 : 0;

  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes.length >= 2 ? closes[closes.length - 2] : currentPrice;
  const changePercent = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

  // Signal scoring
  let score = 0;
  let buyCount = 0;
  let sellCount = 0;

  // MA crossover
  let maCross: 'golden' | 'death' | 'none' = 'none';
  if (ma5 > 0 && ma20 > 0) {
    if (ma5 > ma20) { maCross = 'golden'; buyCount++; score += 10; }
    else { maCross = 'death'; sellCount++; score -= 10; }
  }

  // RSI
  let rsiSignal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
  if (rsi > 70) { rsiSignal = 'overbought'; sellCount++; score -= 20; }
  else if (rsi < 30) { rsiSignal = 'oversold'; buyCount++; score += 20; }
  else if (rsi < 40) { buyCount++; score += 5; }
  else if (rsi > 60) { sellCount++; score -= 5; }

  // MACD
  let macdCross: 'golden' | 'death' | 'none' = 'none';
  if (macdResult.prevMacd <= macdResult.prevSignal && macdResult.macd > macdResult.signal) {
    macdCross = 'golden'; buyCount++; score += 25;
  } else if (macdResult.prevMacd >= macdResult.prevSignal && macdResult.macd < macdResult.signal) {
    macdCross = 'death'; sellCount++; score -= 30;
  } else if (macdResult.histogram > 0) {
    buyCount++; score += 10;
  } else if (macdResult.histogram < 0) {
    sellCount++; score -= 10;
  }

  // Bollinger Bands
  let bollingerBreak: 'upper' | 'lower' | 'none' = 'none';
  if (bbResult.upper > 0) {
    if (currentPrice > bbResult.upper) { bollingerBreak = 'upper'; sellCount++; score -= 15; }
    else if (currentPrice < bbResult.lower) { bollingerBreak = 'lower'; buyCount++; score += 15; }
  }

  // KDJ
  let kdjCross: 'golden' | 'death' | 'none' = 'none';
  if (kdjResult.prevK <= kdjResult.prevD && kdjResult.k > kdjResult.d) {
    kdjCross = 'golden'; buyCount++; score += 15;
  } else if (kdjResult.prevK >= kdjResult.prevD && kdjResult.k < kdjResult.d) {
    kdjCross = 'death'; sellCount++; score -= 15;
  }
  if (kdjResult.j < 0) { buyCount++; score += 10; }
  else if (kdjResult.j > 100) { sellCount++; score -= 10; }

  // Volume
  if (volumeRatio > 2.0) score += 15;
  else if (volumeRatio > 1.5) score += 5;

  // Determine signal type
  let signalType: 'BUY' | 'SELL' | 'HOLD';
  if (score >= 30) signalType = 'BUY';
  else if (score <= -30) signalType = 'SELL';
  else signalType = 'HOLD';

  // Normalize score to 0-100
  const normalizedScore = Math.max(0, Math.min(100, 50 + score));

  // Strength
  let strength: 'strong' | 'medium' | 'weak';
  const dominant = signalType === 'BUY' ? buyCount : signalType === 'SELL' ? sellCount : 0;
  if (dominant >= 4) strength = 'strong';
  else if (dominant >= 2) strength = 'medium';
  else strength = 'weak';

  return {
    symbol,
    name: stockInfo.name,
    sector: stockInfo.sector,
    price: parseFloat(currentPrice.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    signalType,
    strength,
    score: Math.round(normalizedScore),
    indicators: {
      maCross,
      rsiSignal,
      macdCross,
      bollingerBreak,
      kdjCross,
    },
    technicalDetails: {
      rsi: parseFloat(rsi.toFixed(2)),
      macd: macdResult,
      bollinger: bbResult,
      kdj: kdjResult,
      ma: { ma5: parseFloat(ma5.toFixed(2)), ma10: parseFloat(ma10.toFixed(2)), ma20: parseFloat(ma20.toFixed(2)), ma60: parseFloat(ma60.toFixed(2)) },
      volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    },
    scannedAt: new Date().toISOString(),
  };
}

/**
 * POST /api/signals/scan
 * Batch scan: accepts { market: 'US'|'HK'|'A', symbols?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market = 'US', symbols: customSymbols } = body as {
      market?: 'A' | 'HK' | 'US';
      symbols?: string[];
    };

    const marketStocks = STOCK_SECTORS[market] || STOCK_SECTORS.US;
    const symbols = customSymbols || Object.keys(marketStocks);

    console.log(`[SignalScan] Starting batch scan for ${market} market, ${symbols.length} symbols`);

    // Fetch candle data for all stocks in parallel (max 3 concurrent to avoid rate limiting)
    const results: Array<{
      symbol: string;
      data: ReturnType<typeof analyzeSignals> | null;
      usedRealData: boolean;
    }> = [];

    // Process in batches of 3 to respect Finnhub rate limits
    for (let i = 0; i < symbols.length; i += 3) {
      const batch = symbols.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const { candle, usedRealData } = await fetchCandleData(symbol);
            if (!candle || candle.c.length < 30) {
              console.warn(`[SignalScan] Insufficient data for ${symbol}`);
              return { symbol, data: null, usedRealData: false };
            }
            const stockInfo = marketStocks[symbol] || { name: symbol, sector: market };
            const analysis = analyzeSignals(candle, symbol, stockInfo);
            return { symbol, data: analysis, usedRealData };
          } catch (err) {
            console.error(`[SignalScan] Error scanning ${symbol}:`, err);
            return { symbol, data: null, usedRealData: false };
          }
        })
      );
      results.push(...batchResults);
    }

    const signals = results.filter(r => r.data !== null).map(r => r.data);
    const realDataCount = results.filter(r => r.usedRealData).length;

    console.log(`[SignalScan] Completed: ${signals.length}/${symbols.length} signals, ${realDataCount} using real Finnhub data`);

    return NextResponse.json({
      success: true,
      data: {
        signals,
        summary: {
          total: symbols.length,
          scanned: signals.length,
          realDataCount,
          mockDataCount: signals.length - realDataCount,
          market,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error('Signal scan error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '运行信号扫描失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/signals/scan?symbol=AAPL
 * Single symbol scan
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: '股票代码查询参数不能为空' },
        { status: 400 }
      );
    }

    // Find stock info across all markets
    let stockInfo = { name: symbol, sector: '未知' };
    for (const marketStocks of Object.values(STOCK_SECTORS)) {
      if (marketStocks[symbol]) {
        stockInfo = marketStocks[symbol];
        break;
      }
    }

    const { candle, usedRealData } = await fetchCandleData(symbol);
    if (!candle || candle.c.length < 30) {
      return NextResponse.json(
        { success: false, data: null, error: '该股票数据不足以进行扫描' },
        { status: 400 }
      );
    }

    const result = analyzeSignals(candle, symbol, stockInfo);

    // Also return candle data for chart
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        candleData: {
          o: candle.o,
          h: candle.h,
          l: candle.l,
          c: candle.c,
          v: candle.v,
          t: candle.t,
        },
        usedRealData,
      },
      error: null,
    });
  } catch (error) {
    console.error('Signal scan error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '运行信号扫描失败' },
      { status: 500 }
    );
  }
}
