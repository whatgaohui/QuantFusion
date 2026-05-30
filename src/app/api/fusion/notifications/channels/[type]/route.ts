import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * PUT /api/fusion/notifications/channels/[type]
 * 更新指定渠道的配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const body = await request.json();
    const { config, isEnabled } = body as {
      config?: Record<string, string>;
      isEnabled?: boolean;
    };

    // 验证渠道类型
    const validTypes = ['webhook', 'email', 'feishu', 'wechat', 'telegram', 'dingtalk', 'pushplus'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid channel type: ${type}` },
        { status: 400 }
      );
    }

    const configJson = JSON.stringify(config || {});

    // Upsert 渠道配置
    const result = await db.notifyChannelConfig.upsert({
      where: {
        userId_channelType: {
          userId: 'default',
          channelType: type,
        },
      },
      create: {
        userId: 'default',
        channelType: type,
        config: configJson,
        isEnabled: isEnabled ?? true,
      },
      update: {
        config: configJson,
        isEnabled: isEnabled ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      channel: {
        type: result.channelType,
        isEnabled: result.isEnabled,
        config: JSON.parse(result.config),
      },
    });
  } catch (error) {
    console.error('[fusion/notifications/channels/[type]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update channel configuration' },
      { status: 500 }
    );
  }
}
