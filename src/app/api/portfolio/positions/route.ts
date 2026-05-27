import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/portfolio/positions
 * Get all ACTIVE positions
 */
export async function GET() {
  try {
    const positions = await db.position.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error('Get positions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/positions
 * Create a new position (buy stock)
 * Body: { symbol, name, buyPrice, quantity, cycleDays?, stopLossPct?, takeProfitPct? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, name, buyPrice, quantity, cycleDays, stopLossPct, takeProfitPct } = body;

    if (!symbol || buyPrice === undefined || quantity === undefined) {
      return NextResponse.json(
        { error: 'symbol, buyPrice, and quantity are required' },
        { status: 400 }
      );
    }

    if (buyPrice <= 0 || quantity <= 0) {
      return NextResponse.json(
        { error: 'buyPrice and quantity must be positive' },
        { status: 400 }
      );
    }

    const position = await db.position.create({
      data: {
        symbol: symbol.toUpperCase(),
        name: name || symbol.toUpperCase(),
        buyPrice: parseFloat(buyPrice),
        quantity: parseInt(quantity, 10),
        buyDate: new Date(),
        cycleDays: cycleDays ? parseInt(cycleDays, 10) : 7,
        stopLossPct: stopLossPct !== undefined ? parseFloat(stopLossPct) : 0.08,
        takeProfitPct: takeProfitPct !== undefined ? parseFloat(takeProfitPct) : 0.15,
        status: 'ACTIVE',
      },
    });

    // Log the trade
    await db.tradeLog.create({
      data: {
        symbol: position.symbol,
        name: position.name,
        action: 'BUY',
        price: position.buyPrice,
        quantity: position.quantity,
        reason: 'NEW_POSITION',
      },
    });

    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error('Create position error:', error);
    return NextResponse.json(
      { error: 'Failed to create position' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio/positions
 * Close a position (sell stock)
 * Body: { id, sellPrice, sellReason }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, sellPrice, sellReason } = body;

    if (!id || sellPrice === undefined) {
      return NextResponse.json(
        { error: 'id and sellPrice are required' },
        { status: 400 }
      );
    }

    const position = await db.position.findUnique({ where: { id } });

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    if (position.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Position is already closed' },
        { status: 400 }
      );
    }

    const sellPriceNum = parseFloat(sellPrice);
    const profitPct = ((sellPriceNum - position.buyPrice) / position.buyPrice) * 100;

    const updatedPosition = await db.position.update({
      where: { id },
      data: {
        status: 'CLOSED',
        sellPrice: sellPriceNum,
        sellDate: new Date(),
        sellReason: sellReason || 'MANUAL',
      },
    });

    // Log the trade
    await db.tradeLog.create({
      data: {
        symbol: position.symbol,
        name: position.name,
        action: 'SELL',
        price: sellPriceNum,
        quantity: position.quantity,
        reason: sellReason || 'MANUAL',
        profitPct: parseFloat(profitPct.toFixed(2)),
      },
    });

    return NextResponse.json(updatedPosition);
  } catch (error) {
    console.error('Close position error:', error);
    return NextResponse.json(
      { error: 'Failed to close position' },
      { status: 500 }
    );
  }
}
