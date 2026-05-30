import { NextRequest, NextResponse } from 'next/server';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateKDJ,
} from '@/lib/indicators';
import {
  runMultiAgentAnalysis,
  createTask,
  updateTask,
  type AnalysisMode,
} from '@/lib/multi-agent-analysis';

function toFinnhubSymbol(symbol: string): string {
  if (symbol.startsWith('SH')) return symbol.slice(2) + '.SS';
  if (symbol.startsWith('SZ')) return symbol.slice(2) + '.SZ';
  if (symbol.startsWith('HK')) return symbol.slice(2).replace(/^0*/, '') + '.HK';
  return symbol;
}

const STOCK_NAMES: Record<string, string> = {
  'AAPL': '苹果', 'NVDA': '英伟达', 'TSLA': '特斯拉', 'MSFT': '微软',
  'AMZN': '亚马逊', 'META': 'Meta', 'GOOGL': '谷歌', 'AMD': 'AMD',
  'JPM': '摩根大通', 'V': 'Visa',
  'SH600519': '贵州茅台', 'SH601318': '中国平安', 'SH600036': '招商银行',
  'SZ000858': '五粮液', 'SH601398': '工商银行', 'SZ300750': '宁德时代',
  'SH600276': '恒瑞医药', 'SH600030': '中信证券', 'SZ000333': '美的集团',
  'SH600900': '长江电力', 'SH601899': '紫金矿业', 'SZ002475': '立讯精密',
  'HK00700': '腾讯控股', 'HK09988': '阿里巴巴', 'HK03690': '美团',
  'HK00005': '汇丰控股', 'HK00941': '中国移动', 'HK01299': '友邦保险',
  'HK01810': '小米集团', 'HK09618': '京东集团', 'HK09888': '百度集团', 'HK02015': '理想汽车',
};

// Global timeout for the entire analysis pipeline (ms)
const ANALYSIS_GLOBAL_TIMEOUT: Record<AnalysisMode, number> = {
  quick: 60000,      // 1 min
  standard: 120000,   // 2 min
  full: 180000,       // 3 min
  debate: 300000,     // 5 min
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, stockName, mode = 'standard' } = body;

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: '股票代码不能为空' },
        { status: 400 }
      );
    }

    const taskId = crypto.randomUUID();
    const analysisMode = (['quick', 'standard', 'full', 'debate'].includes(mode)
      ? mode
      : 'standard') as AnalysisMode;

    // Gather market data for analysis from real Finnhub API
    let marketData: Record<string, unknown> = {};
    let resolvedName = stockName || STOCK_NAMES[symbol] || symbol;
    let hasQuote = false;
    let hasIndicators = false;
    let hasKline = false;

    // Only attempt Finnhub calls if an API key is available
    if (FINNHUB_API_KEY) {
      // 1. Fetch real quote from Finnhub
      try {
        const finnhubSymbol = toFinnhubSymbol(symbol);
        const quoteData = await finnhubFetch<{
          c: number; h: number; l: number; o: number; pc: number; dp: number; d: number;
        }>('quote', { symbol: finnhubSymbol });

        if (quoteData && quoteData.c && quoteData.c !== 0) {
          marketData = {
            ...marketData,
            symbol,
            name: STOCK_NAMES[symbol] || symbol,
            currentPrice: quoteData.c,
            change: quoteData.d || 0,
            changePercent: quoteData.dp || 0,
            high: quoteData.h || 0,
            low: quoteData.l || 0,
            open: quoteData.o || 0,
            prevClose: quoteData.pc || 0,
            market: symbol.startsWith('SH') || symbol.startsWith('SZ') ? 'A' : symbol.startsWith('HK') ? 'HK' : 'US',
          };
          if (STOCK_NAMES[symbol]) resolvedName = STOCK_NAMES[symbol];
          hasQuote = true;
        }
      } catch {
        // Quote fetch failed, continue without
      }

      // 2. Fetch real candle data and compute indicators from Finnhub
      try {
        const finnhubSymbol = toFinnhubSymbol(symbol);
        const to = Math.floor(Date.now() / 1000);
        const from = to - 120 * 86400;

        const candleData = await finnhubFetch<{
          s: string; c: number[]; o: number[]; h: number[]; l: number[]; v: number[]; t: number[];
        }>('stock/candle', { symbol: finnhubSymbol, resolution: 'D', from: String(from), to: String(to) });

        if (candleData && candleData.s === 'ok' && candleData.c && candleData.c.length >= 30) {
          const closes = candleData.c;
          const highs = candleData.h;
          const lows = candleData.l;

          // Calculate real indicators from candle data
          const rsi14 = calculateRSI(closes, 14);
          const macdResult = calculateMACD(closes);
          const bbResult = calculateBollingerBands(closes);
          const kdjResult = calculateKDJ(highs, lows, closes);

          const ma5 = closes.length >= 5 ? closes.slice(-5).reduce((s, v) => s + v, 0) / 5 : 0;
          const ma10 = closes.length >= 10 ? closes.slice(-10).reduce((s, v) => s + v, 0) / 10 : 0;
          const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((s, v) => s + v, 0) / 20 : 0;
          const ma60 = closes.length >= 60 ? closes.slice(-60).reduce((s, v) => s + v, 0) / 60 : 0;

          marketData = {
            ...marketData,
            indicators: {
              ma: {
                ma5: parseFloat(ma5.toFixed(2)),
                ma10: parseFloat(ma10.toFixed(2)),
                ma20: parseFloat(ma20.toFixed(2)),
                ma60: parseFloat(ma60.toFixed(2)),
              },
              rsi: {
                rsi6: parseFloat(calculateRSI(closes, 6).toFixed(2)),
                rsi12: parseFloat(calculateRSI(closes, 12).toFixed(2)),
                rsi14: parseFloat(rsi14.toFixed(2)),
              },
              macd: {
                macd: macdResult.macd,
                signal: macdResult.signal,
                histogram: macdResult.histogram,
              },
              bollinger: {
                upper: bbResult.upper,
                middle: bbResult.middle,
                lower: bbResult.lower,
                pricePosition: bbResult.pricePosition,
              },
              kdj: {
                k: kdjResult.k,
                d: kdjResult.d,
                j: kdjResult.j,
              },
            },
          };
          hasIndicators = true;

          // 3. Build kline data from the same candle response
          const klineBars = candleData.t.map((t, i) => ({
            time: t * 1000,
            open: candleData.o[i],
            high: candleData.h[i],
            low: candleData.l[i],
            close: candleData.c[i],
            volume: candleData.v[i],
          })).slice(-30);

          marketData = {
            ...marketData,
            kline: klineBars,
          };
          hasKline = true;
        }
      } catch {
        // Candle/indicator fetch failed, continue without
      }
    }

    // Determine data source quality
    let dataSource: 'real' | 'limited' | 'none';
    if (hasQuote && hasIndicators && hasKline) {
      dataSource = 'real';
    } else if (hasQuote || hasIndicators || hasKline) {
      dataSource = 'limited';
    } else {
      dataSource = 'none';
    }
    marketData = { ...marketData, dataSource };

    if (dataSource === 'none') {
      marketData = {
        ...marketData,
        note: '无法获取实时市场数据，分析结果可能缺乏准确性。请告知用户当前无真实市场数据可用。',
      };
    }

    console.log(`[Analysis] Starting ${analysisMode} analysis for ${symbol} (${resolvedName}), task: ${taskId}`);

    // Create task in store
    createTask(taskId);

    // Global timeout for the entire analysis
    const globalTimeout = ANALYSIS_GLOBAL_TIMEOUT[analysisMode];

    // Start analysis in background (don't await)
    (async () => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      try {
        // Race between analysis and global timeout
        const analysisPromise = runMultiAgentAnalysis(
          symbol,
          resolvedName,
          marketData,
          analysisMode,
          (step, progress, agentName) => {
            updateTask(taskId, {
              progress,
              currentStep: step,
              currentAgent: agentName,
            });
          }
        );

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`分析超时（${globalTimeout / 1000}秒），请尝试快速分析模式`));
          }, globalTimeout);
        });

        const result = await Promise.race([analysisPromise, timeoutPromise]);

        if (timeoutHandle) clearTimeout(timeoutHandle);

        console.log(`[Analysis] Completed ${analysisMode} analysis for ${symbol}, task: ${taskId}, LLM calls: ${result.llmCalls}`);

        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          currentStep: '分析完成',
          currentAgent: '系统',
          result,
        });
      } catch (err) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const errMsg = err instanceof Error ? err.message : '分析过程发生未知错误';
        console.error(`[Analysis] Failed ${analysisMode} analysis for ${symbol}, task: ${taskId}:`, errMsg);
        updateTask(taskId, {
          status: 'failed',
          currentStep: '分析失败',
          currentAgent: '系统',
          error: errMsg,
        });
      }
    })();

    return NextResponse.json({
      success: true,
      data: {
        task_id: taskId,
        status: 'running',
        mode: analysisMode,
        symbol,
        stockName: resolvedName,
      },
      error: null,
    });
  } catch (error) {
    console.error('Analysis start API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '启动分析失败' },
      { status: 500 }
    );
  }
}
