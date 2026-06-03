import { NextResponse } from 'next/server';
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
 * Generate upcoming dates for a DCA plan
 */
function generateUpcomingDates(
  period: string,
  weekDay: number,
  count: number
): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'weekly') {
    // Find the next `count` occurrences of the specified weekday
    const currentDay = today.getDay();
    const targetDay = weekDay;
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }

    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + daysUntilTarget + i * 7);
      dates.push(date);
    }
  } else if (period === 'biweekly') {
    // Next `count` biweekly occurrences
    const currentDay = today.getDay();
    const targetDay = weekDay;
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 14;
    } else {
      daysUntilTarget += 7;
    }

    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + daysUntilTarget + i * 14);
      dates.push(date);
    }
  } else if (period === 'monthly') {
    // Next `count` monthly occurrences (e.g., first Tuesday of each month)
    for (let i = 0; i < count; i++) {
      const targetMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1 + i,
        1
      );
      const firstDayOfMonth = targetMonth.getDay();
      let targetDate = weekDay - firstDayOfMonth + 1;
      if (targetDate <= 0) targetDate += 7;
      targetMonth.setDate(targetDate);

      // Skip if the date is in the past or today
      if (targetMonth > today) {
        dates.push(targetMonth);
      } else {
        // This shouldn't happen since we start from next month, but handle it
        // Generate an extra one
        const extraMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1 + count,
          1
        );
        const extraFirstDay = extraMonth.getDay();
        let extraTargetDate = weekDay - extraFirstDay + 1;
        if (extraTargetDate <= 0) extraTargetDate += 7;
        extraMonth.setDate(extraTargetDate);
        dates.push(extraMonth);
      }
    }
  }

  return dates;
}

/**
 * POST /api/dca/generate-schedules
 * 为所有活跃的定投计划生成未来的定投执行计划
 */
export async function POST() {
  try {
    const userId = await getDefaultUserId();

    // 获取所有活跃的定投计划
    const activePlans = await db.dCAPlan.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    let generated = 0;

    for (const plan of activePlans) {
      // 生成未来4个周期的日期
      const upcomingDates = generateUpcomingDates(
        plan.period,
        plan.weekDay,
        4
      );

      for (const date of upcomingDates) {
        // 检查该日期是否已有定投计划记录
        // 使用日期范围查询（同一天内）
        const dayStart = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );
        const dayEnd = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate() + 1
        );

        const existing = await db.dCASchedule.findFirst({
          where: {
            planId: plan.id,
            planDate: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        });

        // 如果该日期已有记录，跳过
        if (existing) {
          continue;
        }

        // 创建定投计划记录
        await db.dCASchedule.create({
          data: {
            planId: plan.id,
            userId,
            symbol: plan.symbol,
            planDate: date,
            amount: plan.amountPerPeriod,
            status: 'planned',
            notes: `自动生成: ${plan.name} 定投计划`,
          },
        });

        generated++;
      }

      // 更新计划的 nextDate 为第一个未执行的 planned 记录
      const nextSchedule = await db.dCASchedule.findFirst({
        where: {
          planId: plan.id,
          status: 'planned',
          planDate: { gte: new Date() },
        },
        orderBy: { planDate: 'asc' },
      });

      if (nextSchedule) {
        await db.dCAPlan.update({
          where: { id: plan.id },
          data: { nextDate: nextSchedule.planDate },
        });
      }
    }

    return NextResponse.json({ success: true, data: { generated } });
  } catch (error) {
    console.error('[dca/generate-schedules] POST error:', error);
    return NextResponse.json(
      { success: false, error: '生成定投计划失败' },
      { status: 500 }
    );
  }
}
