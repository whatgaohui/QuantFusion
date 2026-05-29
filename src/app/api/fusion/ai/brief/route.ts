import { NextRequest, NextResponse } from 'next/server';
import { generateMarketBrief } from '@/lib/ai-service';
import { getMockQuote, getMockNews } from '@/lib/mock-api-data';

export async function GET(request: NextRequest) {
  try {
    // Gather market data for brief generation
    const indexSymbols = ['SH000001', 'SZ399001', 'HSI', 'AAPL', 'GOOGL', 'MSFT'];
    const indices: Array<{ name: string; price: number; change: number; changePercent: number; market: string }> = [];

    for (const sym of indexSymbols) {
      try {
        const q = getMockQuote(sym);
        if (q?.success && q.data) {
          indices.push({
            name: q.data.name || sym,
            price: q.data.currentPrice || 0,
            change: q.data.change || 0,
            changePercent: q.data.changePercent || 0,
            market: q.data.market || 'US',
          });
        }
      } catch {
        // Skip failed quotes
      }
    }

    let newsItems: Array<{ headline: string; sentiment?: string }> = [];
    try {
      const newsA = getMockNews('A', 3);
      if (newsA?.success && Array.isArray(newsA.data)) {
        newsItems = newsA.data.map((n: { headline: string; sentiment?: string }) => ({
          headline: n.headline,
          sentiment: n.sentiment,
        }));
      }
    } catch {
      // Skip failed news
    }

    // Try AI brief generation
    const { brief, isOffline } = await generateMarketBrief({
      indices,
      news: newsItems,
    });

    if (isOffline || !brief) {
      // Fallback to mock brief
      return NextResponse.json({
        success: true,
        data: {
          brief: generateFallbackBrief(indices),
          source: 'mock',
          is_offline: true,
        },
        error: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        brief,
        source: 'ai',
        is_offline: false,
      },
      error: null,
    });
  } catch (error) {
    console.error('AI brief API error:', error);
    return NextResponse.json({
      success: true,
      data: {
        brief: generateFallbackBrief([]),
        source: 'mock',
        is_offline: true,
      },
      error: null,
    });
  }
}

function generateFallbackBrief(
  indices: Array<{ name: string; price: number; change: number; changePercent: number; market: string }>
): string {
  const formatIndex = (idx: { name: string; changePercent: number }) => {
    const arrow = idx.changePercent >= 0 ? '↑' : '↓';
    return `${idx.name} ${arrow}${Math.abs(idx.changePercent).toFixed(2)}%`;
  };

  const aShare = indices.filter(i => i.market === 'A');
  const hk = indices.filter(i => i.market === 'HK');
  const us = indices.filter(i => i.market === 'US');

  const parts = ['📊 **今日市场简报**\n'];

  if (aShare.length > 0) {
    parts.push(`🇨🇳 **A股**: ${aShare.map(formatIndex).join('、')}`);
  } else {
    parts.push('🇨🇳 **A股**: 三大指数集体震荡，半导体板块表现活跃');
  }

  if (hk.length > 0) {
    parts.push(`🇭🇰 **港股**: ${hk.map(formatIndex).join('、')}`);
  } else {
    parts.push('🇭🇰 **港股**: 恒生指数小幅上涨，南向资金持续流入');
  }

  if (us.length > 0) {
    parts.push(`🇺🇸 **美股**: ${us.map(formatIndex).join('、')}`);
  } else {
    parts.push('🇺🇸 **美股**: 三大指数高位运行，科技股领涨');
  }

  parts.push('\n💡 **观点**: 短期市场偏多，建议均衡配置，关注结构性机会。');

  return parts.join('\n\n');
}
