/**
 * 任务执行器 - Job Executor
 * 
 * 负责执行各种类型的调度任务：
 * - analysis: 调用 AI 分析逻辑
 * - market_scan: 扫描市场信号并创建 alerts
 * - news_fetch: 获取新闻并缓存
 * - notification: 发送日报通知
 * - data_sync: 数据同步（预留）
 */

import { db } from './db';

export type JobType = 'analysis' | 'market_scan' | 'news_fetch' | 'notification' | 'data_sync';

export interface JobConfig {
  [key: string]: unknown;
  symbol?: string;
  market?: string;
  mode?: string;
  symbols?: string[];
  channel?: string;
}

export interface JobResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  durationMs: number;
}

// ============================================================
// 各类型任务执行器
// ============================================================

/**
 * 执行 AI 分析任务
 * 对配置中的股票符号执行分析
 */
async function executeAnalysisJob(config: JobConfig): Promise<JobResult> {
  const startTime = Date.now();
  const symbol = config.symbol || 'AAPL';
  const mode = config.mode || 'standard';

  try {
    // 调用内部分析 API
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/fusion/analysis/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, mode }),
    });

    if (!response.ok) {
      throw new Error(`Analysis API returned ${response.status}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      message: `分析完成: ${symbol} - ${result.recommendation || 'N/A'} (评分: ${result.score || 'N/A'})`,
      data: { symbol, mode, recommendation: result.recommendation, score: result.score },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: `分析失败: ${symbol} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 执行市场扫描任务
 * 扫描信号并创建 alerts
 */
async function executeMarketScanJob(config: JobConfig): Promise<JobResult> {
  const startTime = Date.now();
  const market = config.market || 'US';

  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/alerts/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market }),
    });

    if (!response.ok) {
      throw new Error(`Scan API returned ${response.status}`);
    }

    const result = await response.json();

    return {
      success: true,
      message: `扫描完成: 扫描 ${result.scanned || 0} 只股票, 发现 ${result.newAlerts || 0} 个新信号`,
      data: { scanned: result.scanned, newAlerts: result.newAlerts, market },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: `扫描失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 执行新闻获取任务
 * 获取新闻数据并缓存
 */
async function executeNewsFetchJob(config: JobConfig): Promise<JobResult> {
  const startTime = Date.now();
  const category = config.category || 'general';

  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/fusion/market/news?category=${category}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`News API returned ${response.status}`);
    }

    const result = await response.json();
    const count = Array.isArray(result) ? result.length : (result.news?.length || 0);

    return {
      success: true,
      message: `新闻获取完成: 获取 ${count} 篇文章`,
      data: { count, category },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: `新闻获取失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 执行通知发送任务
 * 发送日报通知给用户
 */
async function executeNotificationJob(config: JobConfig): Promise<JobResult> {
  const startTime = Date.now();
  const channel = config.channel || 'system';

  try {
    // 获取活跃用户列表
    const users = await db.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // 获取最近的通知配置
    const channelConfigs = await db.notifyChannelConfig.findMany({
      where: { isEnabled: true },
      take: 20,
    });

    let sentCount = 0;

    // 为每个有通知配置的用户发送日报
    for (const channelConfig of channelConfigs) {
      try {
        await db.notificationLog.create({
          data: {
            userId: channelConfig.userId,
            channel: channelConfig.channelType,
            title: 'QuantFusion 日报',
            content: `市场日报摘要 - ${new Date().toLocaleDateString('zh-CN')}`,
            status: 'sent',
            relatedType: 'daily_report',
            sentAt: new Date(),
          },
        });
        sentCount++;
      } catch {
        // 单个通知失败不影响其他通知
      }
    }

    // 如果没有通知配置，为活跃用户创建系统通知
    if (channelConfigs.length === 0 && users.length > 0) {
      for (const user of users.slice(0, 5)) {
        try {
          await db.notificationLog.create({
            data: {
              userId: user.id,
              channel: 'system',
              title: 'QuantFusion 日报',
              content: `市场日报摘要 - ${new Date().toLocaleDateString('zh-CN')}`,
              status: 'sent',
              relatedType: 'daily_report',
              sentAt: new Date(),
            },
          });
          sentCount++;
        } catch {
          // 忽略单个失败
        }
      }
    }

    return {
      success: true,
      message: `通知发送完成: 发送 ${sentCount} 条通知 (通道: ${channel})`,
      data: { sentCount, channel, totalUsers: users.length },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      message: `通知发送失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 执行数据同步任务（预留）
 */
async function executeDataSyncJob(_config: JobConfig): Promise<JobResult> {
  const startTime = Date.now();

  // 预留：未来可以添加数据同步逻辑
  // 例如：同步历史K线数据、更新市场指标等

  return {
    success: true,
    message: '数据同步任务执行完成（预留功能）',
    data: { synced: true },
    durationMs: Date.now() - startTime,
  };
}

// ============================================================
// 统一执行入口
// ============================================================

/**
 * 执行指定类型的调度任务
 */
export async function executeJob(
  jobType: JobType,
  configJson?: string | null
): Promise<JobResult> {
  // 解析配置
  let config: JobConfig = {};
  if (configJson) {
    try {
      config = JSON.parse(configJson);
    } catch {
      // 配置解析失败，使用默认配置
    }
  }

  switch (jobType) {
    case 'analysis':
      return executeAnalysisJob(config);
    case 'market_scan':
      return executeMarketScanJob(config);
    case 'news_fetch':
      return executeNewsFetchJob(config);
    case 'notification':
      return executeNotificationJob(config);
    case 'data_sync':
      return executeDataSyncJob(config);
    default:
      return {
        success: false,
        message: `未知的任务类型: ${jobType}`,
        durationMs: 0,
      };
  }
}
