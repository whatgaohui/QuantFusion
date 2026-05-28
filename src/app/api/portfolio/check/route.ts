import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

/**
 * GET /api/portfolio/check
 * Check all open positions for take-profit and stop-loss conditions
 */
export async function GET() {
  try {
    await ensureDefaultUser();

    const positions = await db.position.findMany({
      where: { status: 'open', userId: DEFAULT_USER_ID },
    });

    if (positions.length === 0) {
      return NextResponse.json({ checked: [], autoClosed: [] });
    }

    const results: Array<{
      id: string;
      symbol: string;
      currentPrice: number;
      profitPct: number;
      holdingDays: number;
      status: 'OK' | 'TAKE_PROFIT' | 'STOP_LOSS';
      reason?: string;
    }> = [];

    const autoClosed: Array<{
      id: string;
      symbol: string;
      closePrice: number;
      reason: string;
      profitPct: number;
    }> = [];

    const now = new Date();

    for (const position of positions) {
      try {
        // Fetch current price from Finnhub
        const quoteResponse = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(position.symbol)}&token=${FINNHUB_API_KEY}`
        );

        if (!quoteResponse.ok) {
          results.push({
            id: position.id,
            symbol: position.symbol,
            currentPrice: 0,
            profitPct: 0,
            holdingDays: 0,
            status: 'OK',
            reason: 'Failed to fetch price',
          });
          continue;
        }

        const quoteData = await quoteResponse.json();
        const currentPrice = quoteData.c || 0;

        if (currentPrice === 0) {
          results.push({
            id: position.id,
            symbol: position.symbol,
            currentPrice: 0,
            profitPct: 0,
            holdingDays: 0,
            status: 'OK',
            reason: 'No price data available',
          });
          continue;
        }

        const profitPct = ((currentPrice - position.avgCost) / position.avgCost) * 100;
        const holdingMs = now.getTime() - new Date(position.openedAt).getTime();
        const holdingDays = Math.floor(holdingMs / (1000 * 60 * 60 * 24));

        let status: 'OK' | 'TAKE_PROFIT' | 'STOP_LOSS' = 'OK';
        let reason: string | undefined;

        // Check take-profit (takeProfit is an absolute price value)
        if (position.takeProfit !== null && currentPrice >= position.takeProfit) {
          status = 'TAKE_PROFIT';
          reason = `Price ${currentPrice.toFixed(2)} >= take-profit ${position.takeProfit.toFixed(2)}`;
        }
        // Check stop-loss (stopLoss is an absolute price value)
        else if (position.stopLoss !== null && currentPrice <= position.stopLoss) {
          status = 'STOP_LOSS';
          reason = `Price ${currentPrice.toFixed(2)} <= stop-loss ${position.stopLoss.toFixed(2)}`;
        }

        results.push({
          id: position.id,
          symbol: position.symbol,
          currentPrice,
          profitPct: parseFloat(profitPct.toFixed(2)),
          holdingDays,
          status,
          reason,
        });

        // Auto-close positions that meet conditions
        if (status !== 'OK') {
          const realizedPnl = (currentPrice - position.avgCost) * position.quantity;

          await db.position.update({
            where: { id: position.id },
            data: {
              status: 'closed',
              currentPrice,
              realizedPnl,
              closedAt: now,
            },
          });

          // Log the trade
          await db.tradeLog.create({
            data: {
              userId: position.userId,
              symbol: position.symbol,
              market: position.market,
              side: 'sell',
              price: currentPrice,
              quantity: position.quantity,
              totalAmount: currentPrice * position.quantity,
              commission: 0,
              tradeTime: now,
              source: 'strategy',
              notes: status,
            },
          });

          autoClosed.push({
            id: position.id,
            symbol: position.symbol,
            closePrice: currentPrice,
            reason: status,
            profitPct: parseFloat(profitPct.toFixed(2)),
          });
        }
      } catch (err) {
        console.error(`Error checking position ${position.symbol}:`, err);
        results.push({
          id: position.id,
          symbol: position.symbol,
          currentPrice: 0,
          profitPct: 0,
          holdingDays: 0,
          status: 'OK',
          reason: 'Error checking position',
        });
      }
    }

    return NextResponse.json({ checked: results, autoClosed });
  } catch (error) {
    console.error('Portfolio check error:', error);
    return NextResponse.json(
      { error: 'Failed to check positions' },
      { status: 500 }
    );
  }
}
