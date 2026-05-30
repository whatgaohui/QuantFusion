import { NextResponse } from 'next/server';
import { triggerScheduledJob, lazyStartScheduler } from '@/lib/scheduler-engine';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/fusion/scheduler/jobs/[id]/trigger
 * 手动触发一次任务执行
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    // 确保调度器已启动
    await lazyStartScheduler();

    const { id } = await context.params;
    const result = await triggerScheduledJob(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error('[fusion/scheduler/jobs/[id]/trigger] POST error:', error);
    return NextResponse.json(
      { error: '手动触发任务失败' },
      { status: 500 }
    );
  }
}
