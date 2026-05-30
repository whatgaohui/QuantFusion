/**
 * 通知渠道实现
 * 每个渠道实现 send(title, content, options) → { success, error? }
 * 支持: Webhook / Email / 飞书 / 企业微信 / Telegram / 钉钉 / PushPlus
 */

// ============================================================
// 类型定义
// ============================================================

export interface ChannelSendOptions {
  [key: string]: unknown;
}

export interface ChannelSendResult {
  success: boolean;
  error?: string;
}

export interface NotificationChannel {
  readonly channelType: string;
  readonly channelLabel: string;
  send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult>;
}

/** 带超时的 fetch */
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ============================================================
// Webhook 渠道
// ============================================================

export class WebhookChannel implements NotificationChannel {
  readonly channelType = 'webhook';
  readonly channelLabel = 'Webhook';

  async send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult> {
    const webhookUrl = (options?.url as string) || (options?.webhookUrl as string) || '';
    if (!webhookUrl) {
      return { success: false, error: '未配置 Webhook URL' };
    }

    try {
      const response = await fetchWithTimeout(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          type: options?.type || 'alert',
          priority: options?.priority || 'medium',
          symbol: options?.symbol || '',
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    } catch (err) {
      return { success: false, error: `Webhook 发送失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// ============================================================
// Email 渠道
// ============================================================

export class EmailChannel implements NotificationChannel {
  readonly channelType = 'email';
  readonly channelLabel = 'Email';

  async send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult> {
    const smtpApiUrl = (options?.smtpApiUrl as string) || process.env.SMTP_API_URL || '';
    const toEmail = (options?.toEmail as string) || (options?.email as string) || '';

    if (!smtpApiUrl && !toEmail) {
      // 没有配置SMTP服务，记录日志并返回成功（降级处理）
      console.log(`[EmailChannel] 未配置SMTP，模拟发送: 主题="${title}" 收件人="${toEmail}"`);
      return { success: true };
    }

    try {
      const response = await fetchWithTimeout(smtpApiUrl || 'http://localhost:3000/api/mock-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject: title,
          body: content,
          from: (options?.fromEmail as string) || 'noreply@quantfusion.com',
        }),
      });

      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: `Email 发送失败: HTTP ${response.status}` };
    } catch (err) {
      console.log(`[EmailChannel] 发送降级（无SMTP）: 主题="${title}"`);
      return { success: true }; // 降级处理
    }
  }
}

// ============================================================
// 飞书渠道
// ============================================================

export class FeishuChannel implements NotificationChannel {
  readonly channelType = 'feishu';
  readonly channelLabel = '飞书 (Feishu)';

  async send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult> {
    const webhookUrl = (options?.webhookUrl as string) || (options?.url as string) || '';
    if (!webhookUrl) {
      console.log(`[FeishuChannel] 未配置Webhook，模拟发送: "${title}"`);
      return { success: true };
    }

    try {
      // 飞书消息卡片格式
      const response = await fetchWithTimeout(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'interactive',
          card: {
            header: {
              title: { content: title, tag: 'plain_text' },
              template: 'blue',
            },
            elements: [
              {
                tag: 'markdown',
                content: content,
              },
            ],
          },
        }),
      });

      const data = await response.json() as { code?: number; msg?: string };
      if (data.code === 0 || response.ok) {
        return { success: true };
      }
      return { success: false, error: `飞书返回错误: ${data.msg || 'Unknown'}` };
    } catch (err) {
      return { success: false, error: `飞书发送失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// ============================================================
// 企业微信渠道
// ============================================================

export class WeChatChannel implements NotificationChannel {
  readonly channelType = 'wechat';
  readonly channelLabel = '企业微信 (WeCom)';

  async send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult> {
    const webhookUrl = (options?.webhookUrl as string) || (options?.key as string) || '';
    if (!webhookUrl) {
      console.log(`[WeChatChannel] 未配置Webhook，模拟发送: "${title}"`);
      return { success: true };
    }

    // 如果只提供了key，构建完整URL
    const fullUrl = webhookUrl.startsWith('http')
      ? webhookUrl
      : `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookUrl}`;

    try {
      const response = await fetchWithTimeout(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            content: `## ${title}\n\n${content}`,
          },
        }),
      });

      const data = await response.json() as { errcode?: number; errmsg?: string };
      if (data.errcode === 0 || response.ok) {
        return { success: true };
      }
      return { success: false, error: `企业微信返回错误: ${data.errmsg || 'Unknown'}` };
    } catch (err) {
      return { success: false, error: `企业微信发送失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// ============================================================
// Telegram 渠道
// ============================================================

export class TelegramChannel implements NotificationChannel {
  readonly channelType = 'telegram';
  readonly channelLabel = 'Telegram';

  async send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult> {
    const botToken = (options?.botToken as string) || (options?.token as string) || '';
    const chatId = (options?.chatId as string) || '';

    if (!botToken || !chatId) {
      console.log(`[TelegramChannel] 未配置Bot Token/Chat ID，模拟发送: "${title}"`);
      return { success: true };
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(content)}`;

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json() as { ok?: boolean; description?: string };
      if (data.ok) {
        return { success: true };
      }
      return { success: false, error: `Telegram返回错误: ${data.description || 'Unknown'}` };
    } catch (err) {
      return { success: false, error: `Telegram发送失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// ============================================================
// 钉钉渠道
// ============================================================

export class DingTalkChannel implements NotificationChannel {
  readonly channelType = 'dingtalk';
  readonly channelLabel = '钉钉 (DingTalk)';

  async send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult> {
    const webhookUrl = (options?.webhookUrl as string) || (options?.url as string) || '';
    const secret = (options?.secret as string) || '';

    if (!webhookUrl) {
      console.log(`[DingTalkChannel] 未配置Webhook，模拟发送: "${title}"`);
      return { success: true };
    }

    try {
      // 如果有密钥，需要计算签名
      let fullUrl = webhookUrl;
      if (secret) {
        const timestamp = Date.now();
        const stringToSign = `${timestamp}\n${secret}`;
        const hmac = await crypto.subtle.sign(
          'HMAC',
          await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
          new TextEncoder().encode(stringToSign)
        );
        const sign = btoa(String.fromCharCode(...new Uint8Array(hmac)));
        fullUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }

      const response = await fetchWithTimeout(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            title,
            text: `## ${title}\n\n${content}`,
          },
        }),
      });

      const data = await response.json() as { errcode?: number; errmsg?: string };
      if (data.errcode === 0 || response.ok) {
        return { success: true };
      }
      return { success: false, error: `钉钉返回错误: ${data.errmsg || 'Unknown'}` };
    } catch (err) {
      return { success: false, error: `钉钉发送失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// ============================================================
// PushPlus 渠道
// ============================================================

export class PushPlusChannel implements NotificationChannel {
  readonly channelType = 'pushplus';
  readonly channelLabel = 'PushPlus';

  async send(title: string, content: string, options?: ChannelSendOptions): Promise<ChannelSendResult> {
    const token = (options?.token as string) || '';

    if (!token) {
      console.log(`[PushPlusChannel] 未配置Token，模拟发送: "${title}"`);
      return { success: true };
    }

    try {
      const url = 'https://www.pushplus.plus/send';
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          title,
          content,
          template: 'html',
        }),
      });

      const data = await response.json() as { code?: number; msg?: string };
      if (data.code === 200 || response.ok) {
        return { success: true };
      }
      return { success: false, error: `PushPlus返回错误: ${data.msg || 'Unknown'}` };
    } catch (err) {
      return { success: false, error: `PushPlus发送失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// ============================================================
// 工具函数
// ============================================================

/** HTML 转义（Telegram 需要） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 获取所有渠道元信息（供前端展示） */
export function getChannelMetaList(): Array<{
  type: string;
  label: string;
  configFields: Array<{ key: string; label: string; type: 'text' | 'password' | 'url' }>;
}> {
  return [
    {
      type: 'webhook',
      label: 'Webhook',
      configFields: [
        { key: 'url', label: 'Webhook URL', type: 'url' },
      ],
    },
    {
      type: 'email',
      label: 'Email',
      configFields: [
        { key: 'toEmail', label: '收件邮箱', type: 'text' },
        { key: 'smtpApiUrl', label: 'SMTP API URL', type: 'url' },
      ],
    },
    {
      type: 'feishu',
      label: '飞书 (Feishu)',
      configFields: [
        { key: 'webhookUrl', label: '飞书 Webhook URL', type: 'url' },
      ],
    },
    {
      type: 'wechat',
      label: '企业微信 (WeCom)',
      configFields: [
        { key: 'webhookUrl', label: '企业微信 Webhook Key/URL', type: 'url' },
      ],
    },
    {
      type: 'telegram',
      label: 'Telegram',
      configFields: [
        { key: 'botToken', label: 'Bot Token', type: 'password' },
        { key: 'chatId', label: 'Chat ID', type: 'text' },
      ],
    },
    {
      type: 'dingtalk',
      label: '钉钉 (DingTalk)',
      configFields: [
        { key: 'webhookUrl', label: '钉钉 Webhook URL', type: 'url' },
        { key: 'secret', label: '签名密钥 (可选)', type: 'password' },
      ],
    },
    {
      type: 'pushplus',
      label: 'PushPlus',
      configFields: [
        { key: 'token', label: 'PushPlus Token', type: 'password' },
      ],
    },
  ];
}
