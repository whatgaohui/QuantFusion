/**
 * 分析准确率API
 * GET /api/fusion/analysis/accuracy?symbol=AAPL
 * 获取某股票分析准确率统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccuracyStats, backfillReturns } from '@/lib/agent-memory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // 尝试回填最新的收益率数据
    // 使用当前报价来回填（如果有的话）
    const quoteParam = searchParams.get('currentPrice');
    if (quoteParam) {
      const currentPrice = parseFloat(quoteParam);
      if (!isNaN(currentPrice) && currentPrice > 0) {
        await backfillReturns(symbol, currentPrice);
      }
    }

    const stats = await getAccuracyStats(symbol);

    if (!stats) {
      return NextResponse.json({
        symbol: symbol.toUpperCase(),
        totalAnalyses: 0,
        correctCount: 0,
        accuracyRate: 0,
        buyAccuracy: 0,
        holdAccuracy: 0,
        sellAccuracy: 0,
        avgScoreCorrect: 0,
        avgScoreIncorrect: 0,
        recentTrend: 'stable',
        message: '暂无已验证的分析记录',
      });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[fusion/analysis/accuracy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get accuracy stats' },
      { status: 500 }
    );
  }
}
