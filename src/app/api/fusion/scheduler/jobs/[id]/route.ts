import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getNextRunTime, isValidCron } from '@/lib/cron-parser';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/fusion/scheduler/jobs/[id]
 * 更新调度任务（启用/禁用/修改）
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // 检查任务是否存在
    const existing = await db.scheduledJob.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    // 如果修改了 cronExpr，需要验证并重新计算 nextRunAt
    const updateData: Record<string, unknown> = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.cronExpr !== undefined) {
      if (!isValidCron(body.cronExpr)) {
        return NextResponse.json(
          { error: '无效的 cron 表达式' },
          { status: 400 }
        );
      }
      updateData.cronExpr = body.cronExpr;
    }
    if (body.jobType !== undefined) updateData.jobType = body.jobType;
    if (body.config !== undefined) {
      updateData.config = typeof body.config === 'string' ? body.config : JSON.stringify(body.config);
    }
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
      // 重新启用时，重新计算 nextRunAt
      if (body.isActive) {
        const cronExpr = (updateData.cronExpr as string) || existing.cronExpr;
        updateData.nextRunAt = getNextRunTime(cronExpr) || new Date(Date.now() + 60 * 60 * 1000);
      }
    }

    // 如果 cronExpr 变了，更新 nextRunAt
    if (body.cronExpr !== undefined) {
      updateData.nextRunAt = getNextRunTime(body.cronExpr) || new Date(Date.now() + 60 * 60 * 1000);
    }

    const job = await db.scheduledJob.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error('[fusion/scheduler/jobs/[id]] PUT error:', error);
    return NextResponse.json(
      { error: '更新调度任务失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fusion/scheduler/jobs/[id]
 * 删除调度任务
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // 检查任务是否存在
    const existing = await db.scheduledJob.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    await db.scheduledJob.delete({ where: { id } });

    return NextResponse.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('[fusion/scheduler/jobs/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: '删除调度任务失败' },
      { status: 500 }
    );
  }
}
