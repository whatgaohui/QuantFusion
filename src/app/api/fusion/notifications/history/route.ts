import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/fusion/notifications/history
 * 获取通知历史记录
 * 参数:
 *   - limit: 返回数量 (默认 50)
 *   - channel: 按渠道筛选 (可选)
 *   - status: 按状态筛选 (可选)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const channel = searchParams.get('channel');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { userId: 'default' };
    if (channel) where.channel = channel;
    if (status) where.status = status;

    let logs;
    try {
      logs = await db.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch {
      // 数据库不可用时返回空数组
      logs = [];
    }

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        channel: log.channel,
        title: log.title,
        content: log.content,
        status: log.status,
        errorMessage: log.errorMessage,
        relatedType: log.relatedType,
        relatedId: log.relatedId,
        createdAt: log.createdAt,
        sentAt: log.sentAt,
      })),
      total: logs.length,
    });
  } catch (error) {
    console.error('[fusion/notifications/history] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get notification history' },
      { status: 500 }
    );
  }
}
