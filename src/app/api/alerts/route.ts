import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID, ensureDefaultUser } from '@/lib/auth-utils';

/**
 * GET /api/alerts
 * Get all alerts
 */
export async function GET() {
  try {
    await ensureDefaultUser();

    const alerts = await db.alert.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json(
      { error: '获取提醒失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Create a new alert
 * Body: { symbol, alertType, targetValue, notifyChannels? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, alertType, targetValue, notifyChannels } = body;

    if (!symbol || alertType === undefined || targetValue === undefined) {
      return NextResponse.json(
        { error: 'symbol、alertType和targetValue为必填项' },
        { status: 400 }
      );
    }

    const validAlertTypes = ['price_above', 'price_below', 'volume', 'rsi', 'macd', 'custom'];
    if (!validAlertTypes.includes(alertType)) {
      return NextResponse.json(
        { error: `alertType必须是以下之一: ${validAlertTypes.join(', ')}` },
        { status: 400 }
      );
    }

    await ensureDefaultUser();

    const alert = await db.alert.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: symbol.toUpperCase(),
        alertType,
        targetValue: parseFloat(targetValue),
        isActive: true,
        isTriggered: false,
        notifyChannels: notifyChannels || null,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json(
      { error: '创建提醒失败' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/alerts
 * Update alert (activate/deactivate/trigger)
 * Body: { id, isActive?, isTriggered?, currentValue? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isActive, isTriggered, currentValue } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id为必填项' },
        { status: 400 }
      );
    }

    const existing = await db.alert.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: '未找到该提醒' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (isTriggered !== undefined) {
      data.isTriggered = Boolean(isTriggered);
      if (isTriggered) data.triggeredAt = new Date();
    }
    if (currentValue !== undefined) data.currentValue = parseFloat(currentValue);

    const alert = await db.alert.update({
      where: { id },
      data,
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: '更新提醒失败' },
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
        { error: 'id为必填项' },
        { status: 400 }
      );
    }

    const existing = await db.alert.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: '未找到该提醒' },
        { status: 404 }
      );
    }

    await db.alert.delete({ where: { id } });

    return NextResponse.json({ message: '提醒已删除', id });
  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json(
      { error: '删除提醒失败' },
      { status: 500 }
    );
  }
}
