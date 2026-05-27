import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/alerts
 * Get all alerts
 */
export async function GET() {
  try {
    const alerts = await db.alert.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Create a new alert
 * Body: { symbol, targetPrice, condition, expiresAt }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, targetPrice, condition, expiresAt } = body;

    if (!symbol || targetPrice === undefined || !condition || !expiresAt) {
      return NextResponse.json(
        { error: 'symbol, targetPrice, condition, and expiresAt are required' },
        { status: 400 }
      );
    }

    if (!['ABOVE', 'BELOW'].includes(condition)) {
      return NextResponse.json(
        { error: 'Condition must be ABOVE or BELOW' },
        { status: 400 }
      );
    }

    const alert = await db.alert.create({
      data: {
        symbol: symbol.toUpperCase(),
        targetPrice: parseFloat(targetPrice),
        condition,
        status: 'ACTIVE',
        expiresAt: new Date(expiresAt),
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/alerts
 * Update alert status
 * Body: { id, status }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'id and status are required' },
        { status: 400 }
      );
    }

    if (!['ACTIVE', 'TRIGGERED', 'EXPIRED'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be ACTIVE, TRIGGERED, or EXPIRED' },
        { status: 400 }
      );
    }

    const existing = await db.alert.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    const alert = await db.alert.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts
 * Delete an alert
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const existing = await db.alert.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    await db.alert.delete({ where: { id } });

    return NextResponse.json({ message: 'Alert deleted', id });
  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}
