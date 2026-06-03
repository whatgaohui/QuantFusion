import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Get default user ID
async function getDefaultUserId(): Promise<string> {
  let user = await db.user.findFirst();
  if (!user) {
    user = await db.user.create({ data: { email: 'default@quantfusion.ai', name: 'Default User' } });
  }
  return user.id;
}

/**
 * Fetch current ETF price from the internal quote API
 */
async function fetchCurrentPrice(symbol: string): Promise<number> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(
      `${baseUrl}/api/fusion/market/quote?symbol=${encodeURIComponent(symbol)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error(`Quote API returned ${response.status}`);
    }

    const data = await response.json();
    const price = data.currentPrice;

    if (!price || price <= 0) {
      throw new Error('Invalid price from quote API');
    }

    return price;
  } catch (error) {
    console.error('[dca/plans/[id]/execute] fetchCurrentPrice error:', error);
    throw new Error('获取ETF实时价格失败');
  }
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
 * POST /api/dca/plans/[id]/execute
 * 执行定投计划
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const userId = await getDefaultUserId();

    // 获取定投计划
    const plan = await db.dCAPlan.findUnique({
      where: { id },
      include: {
        records: {
          where: { status: 'planned' },
          orderBy: { planDate: 'asc' },
          take: 1,
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: '定投计划不存在' },
        { status: 404 }
      );
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { success: false, error: '定投计划已暂停，无法执行' },
        { status: 400 }
      );
    }

    // 获取当前ETF价格
    const currentPrice = await fetchCurrentPrice(plan.symbol);

    // 计算买入份额（保留2位小数）
    const amount = plan.amountPerPeriod;
    const shares = Math.round((amount / currentPrice) * 100) / 100;

    if (shares <= 0) {
      return NextResponse.json(
        { success: false, error: '计算的买入份额为0，请检查定投金额和当前价格' },
        { status: 400 }
      );
    }

    // 使用事务确保数据一致性
    const result = await db.$transaction(async (tx) => {
      // 创建定投执行记录
      const schedule = await tx.dCASchedule.create({
        data: {
          planId: plan.id,
          userId,
          symbol: plan.symbol,
          planDate: new Date(),
          amount,
          status: 'executed',
          executedAt: new Date(),
          execPrice: currentPrice,
          execShares: shares,
          notes: `定投执行: ${plan.name}，买入 ${shares} 份，单价 ${currentPrice}`,
        },
      });

      // 更新定投计划的累计数据
      const newTotalInvested = plan.totalInvested + amount;
      const newTotalShares = plan.totalShares + shares;
      const newAvgCost = newTotalShares > 0 ? newTotalInvested / newTotalShares : 0;
      const nextDate = calculateNextDate(plan.period, plan.weekDay);

      const updatedPlan = await tx.dCAPlan.update({
        where: { id: plan.id },
        data: {
          totalInvested: newTotalInvested,
          totalShares: newTotalShares,
          avgCost: Math.round(newAvgCost * 1000) / 1000,
          nextDate,
        },
      });

      // 创建交易日志
      await tx.tradeLog.create({
        data: {
          userId,
          symbol: plan.symbol,
          market: plan.market,
          side: 'buy',
          quantity: Math.round(shares * 100), // 以"份"为单位，转为整数
          price: currentPrice,
          totalAmount: amount,
          commission: 0,
          tradeTime: new Date(),
          source: 'dca',
          strategyId: plan.id,
          notes: `定投自动买入: ${plan.name}`,
        },
      });

      return { schedule, plan: updatedPlan };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '执行定投计划失败';
    console.error('[dca/plans/[id]/execute] POST error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
