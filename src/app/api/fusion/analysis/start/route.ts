import { NextRequest, NextResponse } from 'next/server';
import { getMockQuote, getMockIndicators, getMockKline } from '@/lib/mock-api-data';
import {
  runMultiAgentAnalysis,
  createTask,
  updateTask,
  type AnalysisMode,
} from '@/lib/multi-agent-analysis';

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

    // Gather market data for analysis
    let marketData: Record<string, unknown> = {};
    let resolvedName = stockName || symbol;

    try {
      const quoteResult = getMockQuote(symbol);
      if (quoteResult?.success && quoteResult.data) {
        marketData = { ...quoteResult.data };
        if (quoteResult.data.name) resolvedName = quoteResult.data.name;
      }
    } catch {
      // Quote fetch failed, continue without
    }

    try {
      const indicatorResult = getMockIndicators(symbol);
      if (indicatorResult?.success && indicatorResult.data) {
        marketData = { ...marketData, indicators: indicatorResult.data };
      }
    } catch {
      // Indicators fetch failed, continue without
    }

    try {
      const klineResult = getMockKline(symbol, 30);
      if (klineResult?.success && klineResult.data) {
        marketData = { ...marketData, kline: klineResult.data };
      }
    } catch {
      // Kline fetch failed, continue without
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
