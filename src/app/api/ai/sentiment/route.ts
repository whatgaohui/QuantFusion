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
          quoteInfo = `Current Price: $${quote.c}, Change: ${quote.d >= 0 ? '+' : ''}${quote.d} (${quote.dp >= 0 ? '+' : ''}${quote.dp}%), High: $${quote.h}, Low: $${quote.l}`;
        }
      }
    } catch {
      // Continue without quote
    }
  }

  // Prepare news summary
  const newsSummary = newsItems.length > 0
    ? newsItems.map((n, i) => `${i + 1}. "${n.headline}" - ${n.summary || 'No summary'} (${n.source})`).join('\n')
    : 'No recent news available for this symbol.';

  // Use LLM for sentiment analysis
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `You are an expert financial analyst specializing in stock market sentiment analysis. Analyze the given stock data and provide:
1. Overall sentiment score from -100 (extremely bearish) to +100 (extremely bullish)
2. Sentiment label: STRONG_BUY, BUY, NEUTRAL, SELL, or STRONG_SELL
3. Key factors influencing the sentiment (as an array of strings)
4. Risk level: LOW, MEDIUM, HIGH
5. Short-term outlook (1-7 days)
6. A brief analysis summary

Always respond in valid JSON format with these fields: score, label, factors, riskLevel, shortTermOutlook, summary`
      },
      {
        role: 'user',
        content: `Analyze market sentiment for ${name || symbol} (${symbol}).

${quoteInfo ? `Market Data: ${quoteInfo}\n` : ''}Recent News:
${newsSummary}

Provide your sentiment analysis in JSON format.`
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
        factors: ['Unable to parse AI analysis'],
        riskLevel: 'MEDIUM',
        shortTermOutlook: 'Uncertain',
        summary: aiResponse,
      };
    }
  } catch {
    sentimentResult = {
      score: 0,
      label: 'NEUTRAL',
      factors: ['Unable to parse AI analysis'],
      riskLevel: 'MEDIUM',
      shortTermOutlook: 'Uncertain',
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
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const result = await analyzeSentiment(symbol, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI sentiment analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
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
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const result = await analyzeSentiment(symbol, name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI sentiment GET error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}
