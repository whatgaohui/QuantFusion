import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/watchlist
 * Get all watchlist items
 */
export async function GET() {
  try {
    const items = await db.watchlistItem.findMany({
      orderBy: { addedAt: 'desc' },
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
 * Body: { symbol, name }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, name } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await db.watchlistItem.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Symbol already in watchlist' },
        { status: 409 }
      );
    }

    const item = await db.watchlistItem.create({
      data: {
        symbol: symbol.toUpperCase(),
        name: name || symbol.toUpperCase(),
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
 * Body: { symbol }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const existing = await db.watchlistItem.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Symbol not found in watchlist' },
        { status: 404 }
      );
    }

    await db.watchlistItem.delete({
      where: { symbol: symbol.toUpperCase() },
    });

    return NextResponse.json({ message: 'Removed from watchlist', symbol: symbol.toUpperCase() });
  } catch (error) {
    console.error('Delete watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to remove from watchlist' },
      { status: 500 }
    );
  }
}
