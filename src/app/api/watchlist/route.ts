import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';

/**
 * GET /api/watchlist
 * Get all watchlist items
 */
export async function GET() {
  try {
    await ensureDefaultUser();

    const items = await db.watchlistItem.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Get watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watchlist
 * Add item to watchlist
 * Body: { symbol, name?, market?, groupName?, sortOrder? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, name, market, groupName, sortOrder } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase();

    await ensureDefaultUser();

    // Check if already exists for this user
    const existing = await db.watchlistItem.findUnique({
      where: { userId_symbol: { userId: DEFAULT_USER_ID, symbol: upperSymbol } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Symbol already in watchlist' },
        { status: 409 }
      );
    }

    const item = await db.watchlistItem.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: upperSymbol,
        name: name || upperSymbol,
        market: market || 'US',
        groupName: groupName || null,
        sortOrder: sortOrder || 0,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Add watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to add to watchlist' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/watchlist
 * Remove item from watchlist
 * Body: { symbol } or { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, id } = body;

    if (!symbol && !id) {
      return NextResponse.json(
        { error: 'Symbol or id is required' },
        { status: 400 }
      );
    }

    if (id) {
      const existing = await db.watchlistItem.findUnique({ where: { id } });

      if (!existing) {
        return NextResponse.json(
          { error: 'Item not found in watchlist' },
          { status: 404 }
        );
      }

      await db.watchlistItem.delete({ where: { id } });
      return NextResponse.json({ message: 'Removed from watchlist', id });
    }

    // Delete by symbol for the default user
    const upperSymbol = symbol.toUpperCase();
    const existing = await db.watchlistItem.findUnique({
      where: { userId_symbol: { userId: DEFAULT_USER_ID, symbol: upperSymbol } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Symbol not found in watchlist' },
        { status: 404 }
      );
    }

    await db.watchlistItem.delete({
      where: { userId_symbol: { userId: DEFAULT_USER_ID, symbol: upperSymbol } },
    });

    return NextResponse.json({ message: 'Removed from watchlist', symbol: upperSymbol });
  } catch (error) {
    console.error('Delete watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to remove from watchlist' },
      { status: 500 }
    );
  }
}
