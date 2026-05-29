import { NextRequest, NextResponse } from 'next/server';
import { getTask, parseAnalysisResult } from '@/lib/multi-agent-analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const task = getTask(taskId);

    if (!task) {
      return NextResponse.json(
        { success: false, data: null, error: '任务不存在' },
        { status: 404 }
      );
    }

    // If still running, return progress
    if (task.status === 'running') {
      return NextResponse.json({
        success: true,
        data: {
          task_id: taskId,
          status: 'running',
          progress: task.progress,
          current_step: task.currentStep,
          current_agent: task.currentAgent,
        },
        error: null,
      });
    }

    // If failed, return error
    if (task.status === 'failed') {
      return NextResponse.json({
        success: true,
        data: {
          task_id: taskId,
          status: 'failed',
          progress: task.progress,
          current_step: task.currentStep,
          error: task.error || '分析失败',
        },
        error: null,
      });
    }

    // Completed - parse and return full result
    if (task.result) {
      const parsed = parseAnalysisResult(task.result);
      return NextResponse.json({
        success: true,
        data: {
          task_id: taskId,
          status: 'completed',
          progress: 100,
          current_step: '分析完成',
          ...parsed,
        },
        error: null,
      });
    }

    // Fallback (shouldn't happen)
    return NextResponse.json({
      success: true,
      data: {
        task_id: taskId,
        status: 'completed',
        progress: 100,
        current_step: '分析完成',
        technical_summary: '',
        fundamental_summary: '',
        sentiment_summary: '',
        final_decision: '',
        recommendation: 'HOLD',
        score: 50,
        confidence: 'low',
        source: 'ai',
      },
      error: null,
    });
  } catch (error) {
    console.error('Analysis poll API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '查询分析状态失败' },
      { status: 500 }
    );
  }
}
