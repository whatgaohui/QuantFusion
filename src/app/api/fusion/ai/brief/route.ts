import { NextResponse } from 'next/server';
import { generateMarketBrief } from '@/lib/ai-service';

export async function GET() {
  try {
    // Use static market context for brief generation (avoid heavy API calls that crash the server)
    const marketData = {
      indices: [
        { name: '上证指数', price: 3268.50, change: 12.45, changePercent: 0.40, market: 'A' },
        { name: '深证成指', price: 10456.80, change: 53.21, changePercent: 0.52, market: 'A' },
        { name: '恒生指数', price: 19632.50, change: 154.32, changePercent: 0.82, market: 'HK' },
        { name: 'Apple Inc.', price: 310.85, change: 2.52, changePercent: 0.82, market: 'US' },
      ],
      news: [
        { headline: '央行降准释放流动性，A股市场情绪回暖' },
        { headline: '白酒板块集体走强，茅台创近期新高' },
        { headline: '新能源赛道持续活跃，宁德时代领涨' },
      ],
    };

    // Generate AI brief
    try {
      const result = await generateMarketBrief(marketData);

      if (!result.isOffline && result.brief) {
        return NextResponse.json({
          success: true,
          data: { brief: result.brief, source: 'ai' },
          error: null,
        });
      }
    } catch (aiError) {
      console.error('AI brief failed, falling back to mock:', aiError instanceof Error ? aiError.message : 'Unknown');
    }

    // Fallback to static brief
    return NextResponse.json({
      success: true,
      data: {
        brief: '📊 **今日市场简报**\n\nA股三大指数集体收涨，上证指数站上3200点关口。白酒板块领涨，新能源概念持续活跃。港股恒生指数小幅上涨，科技股表现分化。美股方面，三大指数高位震荡，市场关注美联储利率决议。\n\n💡 建议关注：消费复苏主线、AI算力概念、高股息防御板块。',
        source: 'mock',
      },
      error: null,
    });
  } catch (err) {
    console.error('AI brief API error:', err);
    return NextResponse.json({
      success: true,
      data: {
        brief: '📊 **今日市场简报**\n\n当前AI服务暂未连接，无法生成实时市场简报。请稍后重试。',
        source: 'mock',
      },
      error: null,
    });
  }
}
