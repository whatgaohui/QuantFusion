import { NextRequest, NextResponse } from 'next/server';
import { getMockQuote, getMockIndicators, getMockKline } from '@/lib/mock-api-data';
import {
  runMultiAgentAnalysis,
  createTask,
  updateTask,
  type AnalysisMode,
} from '@/lib/multi-agent-analysis';

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

    // Create task in store
    createTask(taskId);

    // Start analysis in background (don't await)
    (async () => {
      try {
        const result = await runMultiAgentAnalysis(
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

        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          currentStep: '分析完成',
          currentAgent: '系统',
          result,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '分析过程发生未知错误';
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
