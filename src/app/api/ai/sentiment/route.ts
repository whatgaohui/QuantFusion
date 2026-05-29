import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  datetime: number;
  url: string;
}

async function analyzeSentiment(symbol: string, name?: string) {
  // Fetch company news from Finnhub
  let newsItems: NewsItem[] = [];
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 86400;

  if (FINNHUB_API_KEY) {
    try {
      const newsRes = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${new Date(weekAgo * 1000).toISOString().split('T')[0]}&to=${new Date(now * 1000).toISOString().split('T')[0]}&token=${FINNHUB_API_KEY}`
      );
      if (newsRes.ok) {
        const data = await newsRes.json();
        if (Array.isArray(data)) {
          newsItems = data.slice(0, 10);
        }
      }
    } catch {
      // Continue without news
    }
  }

  // Fetch current quote
  let quoteInfo = '';
  if (FINNHUB_API_KEY) {
    try {
      const quoteRes = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
      );
      if (quoteRes.ok) {
        const quote = await quoteRes.json();
        if (quote.c) {
          quoteInfo = `当前价格: $${quote.c}, 涨跌: ${quote.d >= 0 ? '+' : ''}${quote.d} (${quote.dp >= 0 ? '+' : ''}${quote.dp}%), 最高: $${quote.h}, 最低: $${quote.l}`;
        }
      }
    } catch {
      // Continue without quote
    }
  }

  // Prepare news summary
  const newsSummary = newsItems.length > 0
    ? newsItems.map((n, i) => `${i + 1}. "${n.headline}" - ${n.summary || '无摘要'} (${n.source})`).join('\n')
    : '该股票暂无近期新闻。';

  // Use LLM for sentiment analysis
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `你是一位专业的金融分析师，擅长股票市场情绪分析。分析给定的股票数据并提供：
1. 整体情绪评分，范围从 -100（极度看空）到 +100（极度看多）
2. 情绪标签：STRONG_BUY、BUY、NEUTRAL、SELL 或 STRONG_SELL
3. 影响情绪的关键因素（字符串数组）
4. 风险等级：LOW、MEDIUM、HIGH
5. 短期展望（1-7天）
6. 简要分析摘要

请始终以有效的JSON格式回复，包含以下字段：score、label、factors、riskLevel、shortTermOutlook、summary`
      },
      {
        role: 'user',
        content: `请分析 ${name || symbol}（${symbol}）的市场情绪。

${quoteInfo ? `市场数据：${quoteInfo}\n` : ''}近期新闻：
${newsSummary}

请以JSON格式提供你的情绪分析。`
      }
    ],
    thinking: { type: 'disabled' }
  });

  const aiResponse = completion.choices[0]?.message?.content || '';

  // Try to parse the AI response as JSON
  let sentimentResult;
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      sentimentResult = JSON.parse(jsonMatch[0]);
    } else {
      sentimentResult = {
        score: 0,
        label: 'NEUTRAL',
        factors: ['无法解析AI分析结果'],
        riskLevel: 'MEDIUM',
        shortTermOutlook: '不确定',
        summary: aiResponse,
      };
    }
  } catch {
    sentimentResult = {
      score: 0,
      label: 'NEUTRAL',
      factors: ['无法解析AI分析结果'],
      riskLevel: 'MEDIUM',
      shortTermOutlook: '不确定',
      summary: aiResponse,
    };
  }

  return {
    symbol: symbol.toUpperCase(),
    name: name || symbol.toUpperCase(),
    ...sentimentResult,
    newsCount: newsItems.length,
    analyzedAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, name } = body as { symbol: string; name?: string };

    if (!symbol) {
      return NextResponse.json({ error: '股票代码不能为空' }, { status: 400 });
    }

    const result = await analyzeSentiment(symbol, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI sentiment analysis error:', error);
    return NextResponse.json(
      { error: '情绪分析失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const name = searchParams.get('name') || undefined;

    if (!symbol) {
      return NextResponse.json({ error: '股票代码不能为空' }, { status: 400 });
    }

    const result = await analyzeSentiment(symbol, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI sentiment GET error:', error);
    return NextResponse.json(
      { error: '情绪分析失败' },
      { status: 500 }
    );
  }
}
