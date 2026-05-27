import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

/**
 * GET /api/portfolio/check
 * Check all ACTIVE positions for take-profit, stop-loss, and expiry conditions
 */
export async function GET() {
  try {
    const positions = await db.position.findMany({
      where: { status: 'ACTIVE' },
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
      status: 'OK' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'EXPIRED';
      reason?: string;
    }> = [];

    const autoClosed: Array<{
      id: string;
      symbol: string;
      sellPrice: number;
      sellReason: string;
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

        const profitPct = ((currentPrice - position.buyPrice) / position.buyPrice) * 100;
        const holdingMs = now.getTime() - new Date(position.buyDate).getTime();
        const holdingDays = Math.floor(holdingMs / (1000 * 60 * 60 * 24));

        let status: 'OK' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'EXPIRED' = 'OK';
        let reason: string | undefined;

        // Check take-profit
        if (profitPct >= position.takeProfitPct * 100) {
          status = 'TAKE_PROFIT';
          reason = `Profit ${profitPct.toFixed(2)}% >= take-profit ${position.takeProfitPct * 100}%`;
        }
        // Check stop-loss
        else if (profitPct <= -(position.stopLossPct * 100)) {
          status = 'STOP_LOSS';
          reason = `Loss ${profitPct.toFixed(2)}% <= stop-loss ${position.stopLossPct * 100}%`;
        }
        // Check expiry
        else if (position.cycleDays > 0 && holdingDays >= position.cycleDays) {
          status = 'EXPIRED';
          reason = `Holding ${holdingDays} days >= cycle ${position.cycleDays} days`;
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
          await db.position.update({
            where: { id: position.id },
            data: {
              status: 'CLOSED',
              sellPrice: currentPrice,
              sellDate: now,
              sellReason: status,
            },
          });

          // Log the trade
          await db.tradeLog.create({
            data: {
              symbol: position.symbol,
              name: position.name,
              action: 'SELL',
              price: currentPrice,
              quantity: position.quantity,
              reason: status,
              profitPct: parseFloat(profitPct.toFixed(2)),
            },
          });

          autoClosed.push({
            id: position.id,
            symbol: position.symbol,
            sellPrice: currentPrice,
            sellReason: status,
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
