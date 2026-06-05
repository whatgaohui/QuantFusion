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
      { error: 'Failed to fetch positions' },
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
    const { symbol, market, side, avgCost, quantity, stopLoss, takeProfit, assetType, targetWeight, notes } = body;

    if (!symbol || avgCost === undefined || quantity === undefined) {
      return NextResponse.json(
        { error: 'symbol, avgCost, and quantity are required' },
        { status: 400 }
      );
    }

    if (avgCost <= 0 || quantity <= 0) {
      return NextResponse.json(
        { error: 'avgCost and quantity must be positive' },
        { status: 400 }
      );
    }

    await ensureDefaultUser();

    const avgCostNum = parseFloat(avgCost);
    const quantityNum = parseInt(quantity, 10);

    // Validate assetType
    const validAssetTypes = ['stock', 'etf', 'bond', 'fund'];
    const resolvedAssetType = assetType && validAssetTypes.includes(assetType) ? assetType : 'stock';

    const position = await db.position.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: symbol.toUpperCase(),
        market: market || 'US',
        side: side || 'long',
        status: 'open',
        assetType: resolvedAssetType,
        avgCost: avgCostNum,
        quantity: quantityNum,
        currentPrice: avgCostNum,
        stopLoss: stopLoss !== undefined ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit !== undefined ? parseFloat(takeProfit) : null,
        targetWeight: targetWeight !== undefined && targetWeight > 0 ? parseFloat(targetWeight) : null,
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

    // Auto-upsert ETFProfile for Chinese fund codes so name displays in analysis
    if (/^\d{6}$/.test(symbol.toUpperCase())) {
      try {
        const { CN_ETF_DB } = await import('@/lib/cn-etf-db');
        const cnEtf = CN_ETF_DB.find(e => e.symbol === symbol.toUpperCase());
        if (cnEtf) {
          await db.eTFProfile.upsert({
            where: { symbol: cnEtf.symbol },
            update: {
              name: cnEtf.name,
              market: 'A',
              category: cnEtf.category,
              expenseRatio: cnEtf.expenseRatio,
              trackingIndex: cnEtf.trackingIndex,
              aum: cnEtf.aum,
              dividendYield: cnEtf.dividendYield,
              peRatio: cnEtf.peRatio,
              pbRatio: cnEtf.pbRatio,
              beta: cnEtf.beta,
              sharpe1y: cnEtf.sharpe1y,
              volatility1y: cnEtf.volatility1y,
              returns1y: cnEtf.returns1y,
              returns3y: cnEtf.returns3y,
              returns5y: cnEtf.returns5y,
              topHoldings: cnEtf.topHoldings,
              sectorWeights: cnEtf.sectorWeights,
              regionWeights: cnEtf.regionWeights,
            },
            create: {
              symbol: cnEtf.symbol,
              name: cnEtf.name,
              market: 'A',
              category: cnEtf.category,
              expenseRatio: cnEtf.expenseRatio,
              trackingIndex: cnEtf.trackingIndex,
              aum: cnEtf.aum,
              dividendYield: cnEtf.dividendYield,
              peRatio: cnEtf.peRatio,
              pbRatio: cnEtf.pbRatio,
              beta: cnEtf.beta,
              sharpe1y: cnEtf.sharpe1y,
              volatility1y: cnEtf.volatility1y,
              returns1y: cnEtf.returns1y,
              returns3y: cnEtf.returns3y,
              returns5y: cnEtf.returns5y,
              topHoldings: cnEtf.topHoldings,
              sectorWeights: cnEtf.sectorWeights,
              regionWeights: cnEtf.regionWeights,
            },
          });
        }
      } catch (e) {
        console.error('Auto-upsert ETFProfile error:', e);
        // Non-critical, don't fail the position creation
      }
    }

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
 * PATCH /api/portfolio/positions
 * Update a position (e.g., target weight, quantity, stop loss, take profit)
 * Body: { id, targetWeight?, quantity?, stopLoss?, takeProfit?, avgCost?, notes? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, targetWeight, quantity, stopLoss, takeProfit, avgCost, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Position id is required' },
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

    const updateData: Record<string, unknown> = {};
    if (targetWeight !== undefined) updateData.targetWeight = targetWeight;
    if (quantity !== undefined) updateData.quantity = parseInt(quantity, 10);
    if (stopLoss !== undefined) updateData.stopLoss = parseFloat(stopLoss);
    if (takeProfit !== undefined) updateData.takeProfit = parseFloat(takeProfit);
    if (avgCost !== undefined) updateData.avgCost = parseFloat(avgCost);
    if (notes !== undefined) updateData.notes = notes;

    const updated = await db.position.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update position error:', error);
    return NextResponse.json(
      { error: 'Failed to update position' },
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
        { error: 'id and closePrice are required' },
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

    if (position.status !== 'open') {
      return NextResponse.json(
        { error: 'Position is already closed' },
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
      { error: 'Failed to close position' },
      { status: 500 }
    );
  }
}
