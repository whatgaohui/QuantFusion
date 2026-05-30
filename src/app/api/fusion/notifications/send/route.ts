import { NextRequest, NextResponse } from 'next/server';
import { routeAndDeliver, cleanupExpiredCache } from '@/lib/notification-router';
import type { NotificationType, NotificationPriority } from '@/lib/notification-router';
import { db } from '@/lib/db';

interface NotificationRequest {
  channel?: string;
  title: string;
  message: string;
  symbol?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/fusion/notifications/send
 * 发送通知（真正实现路由+降噪+渠道发送）
 */
export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();
    const {
      channel: overrideChannel,
      title,
      message,
      symbol,
      type = 'alert' as NotificationType,
      priority = 'medium' as NotificationPriority,
      metadata,
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    // 定期清理缓存
    cleanupExpiredCache();

    // 从数据库获取渠道配置
    let channelConfigs: Record<string, Record<string, string>> = {};
    try {
      // 使用默认用户（demo 场景）
      const configs = await db.notifyChannelConfig.findMany({
        where: { isEnabled: true },
      });
      for (const cfg of configs) {
        try {
          channelConfigs[cfg.channelType] = JSON.parse(cfg.config);
        } catch {
          channelConfigs[cfg.channelType] = {};
        }
      }
    } catch {
      // 数据库不可用时使用空配置
      channelConfigs = {};
    }

    // 如果指定了特定渠道，使用直接发送模式
    if (overrideChannel && overrideChannel !== 'auto') {
      const { deliverToChannel } = await import('@/lib/notification-router');
      const config = channelConfigs[overrideChannel] || {};
      const result = await deliverToChannel(overrideChannel, title, message, config, {
        type,
        priority,
        symbol,
        metadata,
      });

      // 记录通知日志
      try {
        await db.notificationLog.create({
          data: {
            userId: 'default',
            channel: overrideChannel,
            title,
            content: message,
            status: result.success ? 'sent' : 'failed',
            errorMessage: result.error,
            relatedType: type,
            sentAt: result.success ? new Date() : undefined,
          },
        });
      } catch {
        // 日志记录失败不影响返回
      }

      return NextResponse.json({
        success: result.success,
        id: `notif_${Date.now()}`,
        channel: overrideChannel,
        title,
        message,
        type,
        priority,
        symbol,
        timestamp: new Date().toISOString(),
        delivered: result.success,
        error: result.error,
      });
    }

    // 自动路由模式
    const effectiveType = type === 'alert' ? 'signal' : type;
    const result = await routeAndDeliver(
      {
        title,
        content: message,
        type: effectiveType,
        priority,
        symbol,
        metadata,
      },
      channelConfigs
    );

    // 记录通知日志
    try {
      await db.notificationLog.create({
        data: {
          userId: 'default',
          channel: result.channelType,
          title,
          content: message,
          status: result.sent ? 'sent' : 'failed',
          errorMessage: result.reason,
          relatedType: effectiveType,
          sentAt: result.sent ? new Date() : undefined,
        },
      });
    } catch {
      // 日志记录失败不影响返回
    }

    return NextResponse.json({
      success: result.sent,
      id: `notif_${Date.now()}`,
      channel: result.channelType,
      title,
      message,
      type: effectiveType,
      priority,
      symbol,
      timestamp: new Date().toISOString(),
      delivered: result.sent,
      reason: result.reason,
      dedupHash: result.dedupHash,
    });
  } catch (error) {
    console.error('[fusion/notifications/send] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
