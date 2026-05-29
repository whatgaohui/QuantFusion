import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';

/**
 * GET /api/portfolio/positions
 * Get all open positions
 */
export async function GET() {
  try {
    const positions = await db.position.findMany({
      where: { status: 'open', userId: DEFAULT_USER_ID },
      orderBy: { openedAt: 'desc' },
      include: { lots: true },
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error('Get positions error:', error);
    return NextResponse.json(
      { error: '获取持仓失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolio/positions
 * Create a new position (buy stock)
 * Body: { symbol, market, side, avgCost, quantity, stopLoss?, takeProfit?, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, market, side, avgCost, quantity, stopLoss, takeProfit, notes } = body;

    if (!symbol || avgCost === undefined || quantity === undefined) {
      return NextResponse.json(
        { error: 'symbol、avgCost和quantity为必填项' },
        { status: 400 }
      );
    }

    if (avgCost <= 0 || quantity <= 0) {
      return NextResponse.json(
        { error: 'avgCost和quantity必须为正数' },
        { status: 400 }
      );
    }

    await ensureDefaultUser();

    const avgCostNum = parseFloat(avgCost);
    const quantityNum = parseInt(quantity, 10);

    const position = await db.position.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: symbol.toUpperCase(),
        market: market || 'US',
        side: side || 'long',
        status: 'open',
        avgCost: avgCostNum,
        quantity: quantityNum,
        currentPrice: avgCostNum,
        stopLoss: stopLoss !== undefined ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit !== undefined ? parseFloat(takeProfit) : null,
        openedAt: new Date(),
        notes: notes || null,
      },
    });

    // Log the trade
    await db.tradeLog.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: position.symbol,
        market: position.market,
        side: 'buy',
        price: avgCostNum,
        quantity: quantityNum,
        totalAmount: avgCostNum * quantityNum,
        commission: 0,
        tradeTime: new Date(),
        source: 'manual',
        notes: 'NEW_POSITION',
      },
    });

    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error('Create position error:', error);
    return NextResponse.json(
      { error: '创建持仓失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolio/positions
 * Close a position (sell stock)
 * Body: { id, closePrice }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, closePrice } = body;

    if (!id || closePrice === undefined) {
      return NextResponse.json(
        { error: 'id和closePrice为必填项' },
        { status: 400 }
      );
    }

    const position = await db.position.findUnique({ where: { id } });

    if (!position) {
      return NextResponse.json(
        { error: '未找到该持仓' },
        { status: 404 }
      );
    }

    if (position.status !== 'open') {
      return NextResponse.json(
        { error: '该持仓已平仓' },
        { status: 400 }
      );
    }

    const closePriceNum = parseFloat(closePrice);
    const realizedPnl = (closePriceNum - position.avgCost) * position.quantity;

    const updatedPosition = await db.position.update({
      where: { id },
      data: {
        status: 'closed',
        currentPrice: closePriceNum,
        realizedPnl,
        closedAt: new Date(),
      },
    });

    // Log the trade
    await db.tradeLog.create({
      data: {
        userId: position.userId,
        symbol: position.symbol,
        market: position.market,
        side: 'sell',
        price: closePriceNum,
        quantity: position.quantity,
        totalAmount: closePriceNum * position.quantity,
        commission: 0,
        tradeTime: new Date(),
        source: 'manual',
        notes: 'CLOSE_POSITION',
      },
    });

    return NextResponse.json(updatedPosition);
  } catch (error) {
    console.error('Close position error:', error);
    return NextResponse.json(
      { error: '平仓失败' },
      { status: 500 }
    );
  }
}
