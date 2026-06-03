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
 * Calculate the next execution date based on period and weekDay
 */
function calculateNextDate(period: string, weekDay: number): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'weekly') {
    // Find the next occurrence of the specified weekday
    const currentDay = today.getDay(); // 0=Sun, 1=Mon, ...
    // Convert weekDay (1=Mon, 2=Tue, ..., 5=Fri) to JS getDay format (1=Mon, ..., 5=Fri)
    const targetDay = weekDay; // Already in 1-5 format which matches JS Mon-Fri
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
    return nextDate;
  } else if (period === 'biweekly') {
    // Next occurrence of the specified weekday, 2 weeks out if this week's has passed
    const currentDay = today.getDay();
    const targetDay = weekDay;
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 14;
    } else {
      daysUntilTarget += 7; // Skip to next biweekly
    }
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
    return nextDate;
  } else if (period === 'monthly') {
    // Same day of the week in the next month (e.g., first Tuesday of next month)
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const firstDayOfMonth = nextMonth.getDay();
    let targetDate = weekDay - firstDayOfMonth + 1;
    if (targetDate <= 0) targetDate += 7;
    // First occurrence of that weekday in next month
    nextMonth.setDate(targetDate);
    return nextMonth;
  }

  // Default: next week
  const fallback = new Date(today);
  fallback.setDate(fallback.getDate() + 7);
  return fallback;
}

/**
 * GET /api/dca/plans
 * 获取所有定投计划
 */
export async function GET() {
  try {
    const userId = await getDefaultUserId();

    const plans = await db.dCAPlan.findMany({
      where: { userId },
      include: {
        records: {
          orderBy: { planDate: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error('[dca/plans] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取定投计划失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dca/plans
 * 创建定投计划
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId();
    const body = await request.json();
    const { symbol, name, amountPerPeriod, period, weekDay } = body;

    // 参数校验
    if (!symbol || !name || !amountPerPeriod) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: symbol, name, amountPerPeriod' },
        { status: 400 }
      );
    }

    if (amountPerPeriod <= 0) {
      return NextResponse.json(
        { success: false, error: '定投金额必须大于0' },
        { status: 400 }
      );
    }

    const periodValue = period || 'weekly';
    const weekDayValue = weekDay || 2; // 默认周二

    // 验证 period
    const validPeriods = ['weekly', 'biweekly', 'monthly'];
    if (!validPeriods.includes(periodValue)) {
      return NextResponse.json(
        { success: false, error: `无效的定投周期，支持: ${validPeriods.join(', ')}` },
        { status: 400 }
      );
    }

    // 验证 weekDay
    if (weekDayValue < 1 || weekDayValue > 5) {
      return NextResponse.json(
        { success: false, error: 'weekDay 必须在 1-5 之间（1=周一，5=周五）' },
        { status: 400 }
      );
    }

    // 计算下次执行日期
    const nextDate = calculateNextDate(periodValue, weekDayValue);

    // 创建定投计划
    const plan = await db.dCAPlan.create({
      data: {
        userId,
        symbol,
        name,
        market: 'A',
        amountPerPeriod,
        period: periodValue,
        weekDay: weekDayValue,
        isActive: true,
        startDate: new Date(),
        nextDate,
      },
      include: {
        records: true,
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('[dca/plans] POST error:', error);
    return NextResponse.json(
      { success: false, error: '创建定投计划失败' },
      { status: 500 }
    );
  }
}
