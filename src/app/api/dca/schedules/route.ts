import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get default user ID
async function getDefaultUserId(): Promise<string> {
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({ data: { email: 'default@quantfusion.ai', name: 'Default User' } });
  }
  return user.id;
}

/**
 * GET /api/dca/schedules
 * 获取定投执行记录
 * Query params: planId?, status?, limit?
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getDefaultUserId();
    const { searchParams } = new URL(request.url);

    const planId = searchParams.get('planId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 构建 where 条件
    const where: Record<string, unknown> = { userId };

    if (planId) {
      where.planId = planId;
    }

    if (status) {
      where.status = status;
    }

    const schedules = await db.dCASchedule.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            symbol: true,
            period: true,
            amountPerPeriod: true,
          },
        },
      },
      orderBy: { planDate: 'desc' },
      take: Math.min(limit, 200), // 最多200条
    });

    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    console.error('[dca/schedules] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取定投记录失败' },
      { status: 500 }
    );
  }
}
