/**
 * 通知路由引擎
 * - 按通知类型路由到不同渠道
 * - 通知降噪：静默时段、冷却期、去重
 * - 优先级过滤
 */

import { createHash } from 'crypto';
import type { NotificationChannel } from './notification-channels';
import {
  WebhookChannel,
  EmailChannel,
  FeishuChannel,
  WeChatChannel,
  TelegramChannel,
  DingTalkChannel,
  PushPlusChannel,
} from './notification-channels';

// ============================================================
// 类型定义
// ============================================================

export type NotificationType = 'signal' | 'price' | 'position' | 'daily_report' | 'news';
export type NotificationPriority = 'high' | 'medium' | 'low';

export interface NotificationMessage {
  title: string;
  content: string;
  type: NotificationType;
  priority: NotificationPriority;
  symbol?: string;
  metadata?: Record<string, unknown>;
}

export interface RouteResult {
  sent: boolean;
  reason?: string;
  channelType: string;
  dedupHash?: string;
}

// ============================================================
// 路由映射：通知类型 → 渠道类型
// ============================================================

const TYPE_CHANNEL_MAP: Record<NotificationType, string> = {
  signal: 'webhook',      // 交易信号 → Webhook
  price: 'wechat',        // 价格提醒 → 企业微信
  position: 'feishu',     // 持仓更新 → 飞书
  daily_report: 'email',  // 日报 → 邮件
  news: 'telegram',       // 新闻 → Telegram
};

/** 优先级权重 */
const PRIORITY_WEIGHT: Record<NotificationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================
// 降噪引擎
// ============================================================

/** 冷却期缓存：key=type+symbol 的 md5, value=最后发送时间 */
const cooldownMap = new Map<string, number>();

/** 去重缓存：key=内容md5, value=时间戳 */
const dedupMap = new Map<string, number>();

/** 静默时段（22:00 - 08:00） */
function isInSilentHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 8;
}

/** 冷却期检查：同类型5分钟内不重复 */
function isCoolingDown(type: NotificationType, symbol?: string): boolean {
  const key = `${type}:${symbol || 'global'}`;
  const lastSent = cooldownMap.get(key);
  if (!lastSent) return false;
  const COOLDOWN_MS = 5 * 60 * 1000; // 5分钟
  return (Date.now() - lastSent) < COOLDOWN_MS;
}

/** 记录冷却 */
function markCooldown(type: NotificationType, symbol?: string): void {
  const key = `${type}:${symbol || 'global'}`;
  cooldownMap.set(key, Date.now());
}

/** 去重检查：md5 哈希对比 */
function isDuplicate(title: string, content: string, type: NotificationType): boolean {
  const hash = createHash('md5')
    .update(`${type}:${title}:${content}`)
    .digest('hex');
  const lastSent = dedupMap.get(hash);
  if (!lastSent) {
    dedupMap.set(hash, Date.now());
    return false;
  }
  // 同一内容1小时内不重复
  const DEDUP_MS = 60 * 60 * 1000;
  if ((Date.now() - lastSent) < DEDUP_MS) {
    return true;
  }
  dedupMap.set(hash, Date.now());
  return false;
}

/** 计算去重哈希 */
function getDedupHash(title: string, content: string, type: NotificationType): string {
  return createHash('md5')
    .update(`${type}:${title}:${content}`)
    .digest('hex');
}

// ============================================================
// 渠道实例注册
// ============================================================

const channelRegistry = new Map<string, NotificationChannel>();

function initChannels(): void {
  if (channelRegistry.size > 0) return;
  channelRegistry.set('webhook', new WebhookChannel());
  channelRegistry.set('email', new EmailChannel());
  channelRegistry.set('feishu', new FeishuChannel());
  channelRegistry.set('wechat', new WeChatChannel());
  channelRegistry.set('telegram', new TelegramChannel());
  channelRegistry.set('dingtalk', new DingTalkChannel());
  channelRegistry.set('pushplus', new PushPlusChannel());
}

/** 获取渠道实例 */
export function getChannel(type: string): NotificationChannel | undefined {
  initChannels();
  return channelRegistry.get(type);
}

/** 获取所有已注册渠道类型 */
export function getRegisteredChannelTypes(): string[] {
  initChannels();
  return Array.from(channelRegistry.keys());
}

// ============================================================
// 路由引擎核心
// ============================================================

/**
 * 路由并处理通知
 * @param message 通知消息
 * @param channelConfigs 渠道配置（从数据库或设置获取）
 * @returns 路由结果
 */
export async function routeAndDeliver(
  message: NotificationMessage,
  channelConfigs: Record<string, Record<string, string>> = {}
): Promise<RouteResult> {
  initChannels();

  const { type, priority, title, content, symbol } = message;

  // 1. 静默时段 + 低优先级过滤
  if (isInSilentHours() && priority === 'low') {
    return {
      sent: false,
      reason: '静默时段（22:00-08:00），低优先级通知被静默',
      channelType: TYPE_CHANNEL_MAP[type],
    };
  }

  // 2. 冷却期检查
  if (isCoolingDown(type, symbol)) {
    return {
      sent: false,
      reason: `同类型通知冷却中（5分钟内不重复发送），类型: ${type}`,
      channelType: TYPE_CHANNEL_MAP[type],
    };
  }

  // 3. 去重检查
  if (isDuplicate(title, content, type)) {
    const dedupHash = getDedupHash(title, content, type);
    return {
      sent: false,
      reason: '重复通知已去重',
      channelType: TYPE_CHANNEL_MAP[type],
      dedupHash,
    };
  }

  // 4. 确定目标渠道
  const targetChannelType = TYPE_CHANNEL_MAP[type];
  const channel = channelRegistry.get(targetChannelType);

  if (!channel) {
    return {
      sent: false,
      reason: `未找到渠道: ${targetChannelType}`,
      channelType: targetChannelType,
    };
  }

  // 5. 获取渠道配置
  const config = channelConfigs[targetChannelType] || {};

  // 6. 发送通知
  try {
    const result = await channel.send(title, content, {
      ...config,
      type,
      priority,
      symbol,
      metadata: message.metadata,
    });

    if (result.success) {
      // 发送成功，更新冷却期
      markCooldown(type, symbol);
    }

    return {
      sent: result.success,
      reason: result.error,
      channelType: targetChannelType,
      dedupHash: getDedupHash(title, content, type),
    };
  } catch (err) {
    return {
      sent: false,
      reason: `渠道发送异常: ${err instanceof Error ? err.message : String(err)}`,
      channelType: targetChannelType,
    };
  }
}

/**
 * 手动指定渠道发送（用于测试或自定义路由）
 */
export async function deliverToChannel(
  channelType: string,
  title: string,
  content: string,
  config: Record<string, string> = {},
  options: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  initChannels();
  const channel = channelRegistry.get(channelType);
  if (!channel) {
    return { success: false, error: `未找到渠道: ${channelType}` };
  }
  return channel.send(title, content, { ...config, ...options });
}

/** 清理过期的缓存条目（可定期调用） */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  const COOLDOWN_EXPIRY = 30 * 60 * 1000; // 30分钟
  const DEDUP_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

  for (const [key, ts] of cooldownMap.entries()) {
    if (now - ts > COOLDOWN_EXPIRY) cooldownMap.delete(key);
  }
  for (const [key, ts] of dedupMap.entries()) {
    if (now - ts > DEDUP_EXPIRY) dedupMap.delete(key);
  }
}

/** 获取通知类型对应的默认渠道映射 */
export function getTypeChannelMap(): Record<string, string> {
  return { ...TYPE_CHANNEL_MAP };
}

/** 获取优先级权重 */
export function getPriorityWeight(priority: NotificationPriority): number {
  return PRIORITY_WEIGHT[priority];
}
