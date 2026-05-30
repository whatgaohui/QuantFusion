import { NextResponse } from 'next/server';
import { getChannelMetaList } from '@/lib/notification-channels';
import { db } from '@/lib/db';

/**
 * GET /api/fusion/notifications/channels
 * 获取所有渠道配置信息
 */
export async function GET() {
  try {
    const channelMeta = getChannelMetaList();

    // 从数据库获取已保存的配置
    let savedConfigs: Record<string, { config: Record<string, string>; isEnabled: boolean }> = {};
    try {
      const configs = await db.notifyChannelConfig.findMany();
      for (const cfg of configs) {
        try {
          savedConfigs[cfg.channelType] = {
            config: JSON.parse(cfg.config),
            isEnabled: cfg.isEnabled,
          };
        } catch {
          savedConfigs[cfg.channelType] = { config: {}, isEnabled: cfg.isEnabled };
        }
      }
    } catch {
      // 数据库不可用时使用空配置
    }

    // 合并元信息和已保存配置
    const channels = channelMeta.map((meta) => ({
      ...meta,
      isEnabled: savedConfigs[meta.type]?.isEnabled ?? false,
      savedConfig: savedConfigs[meta.type]?.config || {},
    }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('[fusion/notifications/channels] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get channel configurations' },
      { status: 500 }
    );
  }
}
