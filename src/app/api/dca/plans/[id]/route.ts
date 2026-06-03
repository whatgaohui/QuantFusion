import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Calculate the next execution date based on period and weekDay
 */
function calculateNextDate(period: string, weekDay: number): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'weekly') {
    const currentDay = today.getDay();
    const targetDay = weekDay;
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
    return nextDate;
  } else if (period === 'biweekly') {
    const currentDay = today.getDay();
    const targetDay = weekDay;
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 14;
    } else {
      daysUntilTarget += 7;
    }
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
    return nextDate;
  } else if (period === 'monthly') {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const firstDayOfMonth = nextMonth.getDay();
    let targetDate = weekDay - firstDayOfMonth + 1;
    if (targetDate <= 0) targetDate += 7;
    nextMonth.setDate(targetDate);
    return nextMonth;
  }

  const fallback = new Date(today);
  fallback.setDate(fallback.getDate() + 7);
  return fallback;
}

/**
 * PUT /api/dca/plans/[id]
 * 更新定投计划
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // 检查计划是否存在
    const existing = await db.dCAPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '定投计划不存在' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.amountPerPeriod !== undefined) {
      if (body.amountPerPeriod <= 0) {
        return NextResponse.json(
          { success: false, error: '定投金额必须大于0' },
          { status: 400 }
        );
      }
      updateData.amountPerPeriod = body.amountPerPeriod;
    }

    if (body.period !== undefined) {
      const validPeriods = ['weekly', 'biweekly', 'monthly'];
      if (!validPeriods.includes(body.period)) {
        return NextResponse.json(
          { success: false, error: `无效的定投周期，支持: ${validPeriods.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.period = body.period;
    }

    if (body.weekDay !== undefined) {
      if (body.weekDay < 1 || body.weekDay > 5) {
        return NextResponse.json(
          { success: false, error: 'weekDay 必须在 1-5 之间（1=周一，5=周五）' },
          { status: 400 }
        );
      }
      updateData.weekDay = body.weekDay;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    // 如果修改了周期或星期，重新计算下次执行日期
    if (body.period !== undefined || body.weekDay !== undefined) {
      const period = (updateData.period as string) || existing.period;
      const weekDay = (updateData.weekDay as number) ?? existing.weekDay;
      updateData.nextDate = calculateNextDate(period, weekDay);
    }

    // 如果重新激活，也重新计算下次执行日期
    if (body.isActive === true && !updateData.nextDate) {
      updateData.nextDate = calculateNextDate(
        (updateData.period as string) || existing.period,
        (updateData.weekDay as number) ?? existing.weekDay
      );
    }

    const plan = await db.dCAPlan.update({
      where: { id },
      data: updateData,
      include: {
        records: {
          orderBy: { planDate: 'desc' },
          take: 10,
        },
      },
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('[dca/plans/[id]] PUT error:', error);
    return NextResponse.json(
      { success: false, error: '更新定投计划失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dca/plans/[id]
 * 删除定投计划
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // 检查计划是否存在
    const existing = await db.dCAPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '定投计划不存在' },
        { status: 404 }
      );
    }

    await db.dCAPlan.delete({ where: { id } });

    return NextResponse.json({ success: true, message: '定投计划已删除' });
  } catch (error) {
    console.error('[dca/plans/[id]] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '删除定投计划失败' },
      { status: 500 }
    );
  }
}
