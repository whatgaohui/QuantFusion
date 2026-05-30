import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getNextRunTime, isValidCron } from '@/lib/cron-parser';
import { lazyStartScheduler, getSchedulerState } from '@/lib/scheduler-engine';

/**
 * GET /api/fusion/scheduler/jobs
 * 获取所有调度任务
 */
export async function GET() {
  try {
    // 懒加载启动调度器
    await lazyStartScheduler();

    const jobs = await db.scheduledJob.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 附加调度器状态信息
    const schedulerState = getSchedulerState();

    return NextResponse.json({
      jobs,
      scheduler: {
        status: schedulerState.status,
        lastCheckAt: schedulerState.lastCheckAt,
        totalJobsExecuted: schedulerState.totalJobsExecuted,
        totalErrors: schedulerState.totalErrors,
        currentlyRunning: Array.from(schedulerState.currentlyRunning),
      },
    });
  } catch (error) {
    console.error('[fusion/scheduler/jobs] GET error:', error);
    return NextResponse.json(
      { error: '获取调度任务失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fusion/scheduler/jobs
 * 创建调度任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, cronExpr, jobType, config, isActive } = body;

    // 参数校验
    if (!name || !cronExpr || !jobType) {
      return NextResponse.json(
        { error: '缺少必填字段: name, cronExpr, jobType' },
        { status: 400 }
      );
    }

    // 验证 cron 表达式
    if (!isValidCron(cronExpr)) {
      return NextResponse.json(
        { error: '无效的 cron 表达式' },
        { status: 400 }
      );
    }

    // 验证 jobType
    const validJobTypes = ['analysis', 'market_scan', 'news_fetch', 'notification', 'data_sync', 'custom'];
    if (!validJobTypes.includes(jobType)) {
      return NextResponse.json(
        { error: `无效的任务类型，支持: ${validJobTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 计算下次执行时间
    const nextRunAt = getNextRunTime(cronExpr);

    // 创建任务
    const job = await db.scheduledJob.create({
      data: {
        name,
        cronExpr,
        jobType,
        config: config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null,
        isActive: isActive !== undefined ? isActive : true,
        nextRunAt: nextRunAt || new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error('[fusion/scheduler/jobs] POST error:', error);
    return NextResponse.json(
      { error: '创建调度任务失败' },
      { status: 500 }
    );
  }
}
