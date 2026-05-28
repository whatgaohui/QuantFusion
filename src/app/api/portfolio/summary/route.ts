import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

/**
 * GET /api/portfolio/summary
 * Get portfolio summary: totalValue, totalProfit, totalProfitPct, activePositions, todayPnl
 */
export async function GET() {
  try {
    await ensureDefaultUser();

    const positions = await db.position.findMany({
      where: { status: 'open', userId: DEFAULT_USER_ID },
    });

    if (positions.length === 0) {
      return NextResponse.json({
        totalValue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalProfitPct: 0,
        activePositions: 0,
        todayPnl: 0,
        positions: [],
      });
    }

    let totalCost = 0;
    let totalValue = 0;
    let todayPnl = 0;

    const positionSummaries = [];

    for (const position of positions) {
      const cost = position.avgCost * position.quantity;
      totalCost += cost;

      try {
        // Fetch current price
        const quoteResponse = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(position.symbol)}&token=${FINNHUB_API_KEY}`
        );

        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          const currentPrice = quoteData.c || 0;
          const prevClose = quoteData.pc || currentPrice;
          const currentValue = currentPrice * position.quantity;
          const profit = currentValue - cost;
          const profitPct = cost > 0 ? (profit / cost) * 100 : 0;
          const dayChange = currentPrice - prevClose;
          const dayPnl = dayChange * position.quantity;

          totalValue += currentValue;
          todayPnl += dayPnl;

          // Update currentPrice and unrealizedPnl in DB
          await db.position.update({
            where: { id: position.id },
            data: {
              currentPrice,
              unrealizedPnl: profit,
            },
          });

          positionSummaries.push({
            id: position.id,
            symbol: position.symbol,
            market: position.market,
            side: position.side,
            avgCost: position.avgCost,
            currentPrice,
            quantity: position.quantity,
            cost,
            currentValue,
            profit: parseFloat(profit.toFixed(2)),
            profitPct: parseFloat(profitPct.toFixed(2)),
            dayPnl: parseFloat(dayPnl.toFixed(2)),
          });
        } else {
          // Fallback if API fails
          totalValue += cost;
          positionSummaries.push({
            id: position.id,
            symbol: position.symbol,
            market: position.market,
            side: position.side,
            avgCost: position.avgCost,
            currentPrice: position.avgCost,
            quantity: position.quantity,
            cost,
            currentValue: cost,
            profit: 0,
            profitPct: 0,
            dayPnl: 0,
          });
        }
      } catch {
        // Fallback on error
        totalValue += cost;
        positionSummaries.push({
          id: position.id,
          symbol: position.symbol,
          market: position.market,
          side: position.side,
          avgCost: position.avgCost,
          currentPrice: position.avgCost,
          quantity: position.quantity,
          cost,
          currentValue: cost,
          profit: 0,
          profitPct: 0,
          dayPnl: 0,
        });
      }
    }

    const totalProfit = totalValue - totalCost;
    const totalProfitPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return NextResponse.json({
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalProfitPct: parseFloat(totalProfitPct.toFixed(2)),
      activePositions: positions.length,
      todayPnl: parseFloat(todayPnl.toFixed(2)),
      positions: positionSummaries,
    });
  } catch (error) {
    console.error('Portfolio summary error:', error);
    return NextResponse.json(
      { error: 'Failed to get portfolio summary' },
      { status: 500 }
    );
  }
}
