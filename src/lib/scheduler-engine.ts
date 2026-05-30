/**
 * 调度核心引擎 - Scheduler Engine
 * 
 * 使用 setInterval 实现简单的调度检查器（每分钟检查一次）。
 * 执行流程：检查到期任务 → 标记运行中 → 执行 → 记录结果 → 更新 nextRunAt。
 * 单例模式，防止重复实例。
 * 支持优雅关闭处理。
 */

import { db } from './db';
import { executeJob } from './job-executor';
import { getNextRunTime } from './cron-parser';

/** 调度器状态 */
export type SchedulerStatus = 'stopped' | 'running' | 'paused';

/** 调度器事件类型 */
export type SchedulerEvent = 'started' | 'stopped' | 'job_started' | 'job_completed' | 'job_failed' | 'error';

export interface SchedulerState {
  status: SchedulerStatus;
  checkIntervalMs: number;
  lastCheckAt: Date | null;
  totalJobsExecuted: number;
  totalErrors: number;
  currentlyRunning: Set<string>; // 正在运行的任务ID集合
}

type EventListener = (event: SchedulerEvent, data?: Record<string, unknown>) => void;

// ============================================================
// 单例调度引擎
// ============================================================

class SchedulerEngine {
  private static instance: SchedulerEngine | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private state: SchedulerState;
  private listeners: EventListener[] = [];
  private isShuttingDown = false;

  private constructor() {
    this.state = {
      status: 'stopped',
      checkIntervalMs: 60 * 1000, // 默认每分钟检查一次
      lastCheckAt: null,
      totalJobsExecuted: 0,
      totalErrors: 0,
      currentlyRunning: new Set(),
    };
  }

  /**
   * 获取调度器单例
   */
  static getInstance(): SchedulerEngine {
    if (!SchedulerEngine.instance) {
      SchedulerEngine.instance = new SchedulerEngine();
    }
    return SchedulerEngine.instance;
  }

  /**
   * 启动调度器
   */
  start(checkIntervalMs?: number): void {
    if (this.state.status === 'running') {
      console.log('[SchedulerEngine] 调度器已在运行中');
      return;
    }

    if (checkIntervalMs && checkIntervalMs > 0) {
      this.state.checkIntervalMs = checkIntervalMs;
    }

    this.state.status = 'running';
    this.isShuttingDown = false;

    console.log(`[SchedulerEngine] 调度器启动，检查间隔: ${this.state.checkIntervalMs / 1000}秒`);

    // 立即执行一次检查
    this.checkAndExecute();

    // 设置定时检查
    this.intervalHandle = setInterval(() => {
      this.checkAndExecute();
    }, this.state.checkIntervalMs);

    this.emit('started');
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.state.status === 'stopped') {
      return;
    }

    this.isShuttingDown = true;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.state.status = 'stopped';
    console.log('[SchedulerEngine] 调度器已停止');
    this.emit('stopped');
  }

  /**
   * 暂停调度器（不清理，仅暂停检查）
   */
  pause(): void {
    if (this.state.status !== 'running') return;
    
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    
    this.state.status = 'paused';
    console.log('[SchedulerEngine] 调度器已暂停');
  }

  /**
   * 恢复调度器
   */
  resume(): void {
    if (this.state.status !== 'paused') return;
    this.start();
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    console.log('[SchedulerEngine] 开始优雅关闭...');
    this.isShuttingDown = true;

    // 停止接受新任务
    this.stop();

    // 等待正在运行的任务完成（最多等30秒）
    const maxWait = 30_000;
    const start = Date.now();
    while (this.state.currentlyRunning.size > 0 && Date.now() - start < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[SchedulerEngine] 等待 ${this.state.currentlyRunning.size} 个任务完成...`);
    }

    if (this.state.currentlyRunning.size > 0) {
      console.warn(`[SchedulerEngine] 强制关闭，${this.state.currentlyRunning.size} 个任务未完成`);
    }

    console.log('[SchedulerEngine] 优雅关闭完成');
  }

  /**
   * 获取调度器状态
   */
  getState(): Readonly<SchedulerState> {
    return { ...this.state, currentlyRunning: new Set(this.state.currentlyRunning) };
  }

  /**
   * 添加事件监听器
   */
  on(listener: EventListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  off(listener: EventListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // ============================================================
  // 核心执行逻辑
  // ============================================================

  /**
   * 检查到期任务并执行
   */
  private async checkAndExecute(): Promise<void> {
    if (this.isShuttingDown) return;

    this.state.lastCheckAt = new Date();

    try {
      // 查询所有活跃且到期的任务
      const dueJobs = await db.scheduledJob.findMany({
        where: {
          isActive: true,
          nextRunAt: {
            lte: new Date(),
          },
          // 排除正在运行的任务
          lastStatus: { not: 'running' },
        },
        orderBy: { nextRunAt: 'asc' },
        take: 10, // 每次最多执行10个任务
      });

      if (dueJobs.length === 0) return;

      console.log(`[SchedulerEngine] 发现 ${dueJobs.length} 个到期任务`);

      // 串行执行任务（避免并发问题）
      for (const job of dueJobs) {
        if (this.isShuttingDown) break;
        await this.executeSingleJob(job);
      }
    } catch (error) {
      console.error('[SchedulerEngine] 检查任务时出错:', error);
      this.state.totalErrors++;
      this.emit('error', { error: String(error) });
    }
  }

  /**
   * 执行单个任务
   */
  private async executeSingleJob(job: {
    id: string;
    name: string;
    jobType: string;
    cronExpr: string;
    config: string | null;
  }): Promise<void> {
    // 标记为运行中
    this.state.currentlyRunning.add(job.id);

    try {
      // 更新数据库状态为运行中
      await db.scheduledJob.update({
        where: { id: job.id },
        data: { lastStatus: 'running' },
      });

      this.emit('job_started', { jobId: job.id, jobName: job.name, jobType: job.jobType });
      console.log(`[SchedulerEngine] 开始执行任务: ${job.name} (${job.jobType})`);

      // 执行任务
      const result = await executeJob(job.jobType as 'analysis' | 'market_scan' | 'news_fetch' | 'notification' | 'data_sync', job.config);

      // 计算下次执行时间
      const nextRunAt = getNextRunTime(job.cronExpr);

      // 更新任务结果
      await db.scheduledJob.update({
        where: { id: job.id },
        data: {
          lastRunAt: new Date(),
          lastStatus: result.success ? 'success' : 'failed',
          lastError: result.success ? null : result.message,
          nextRunAt: nextRunAt,
        },
      });

      this.state.totalJobsExecuted++;
      this.emit(result.success ? 'job_completed' : 'job_failed', {
        jobId: job.id,
        jobName: job.name,
        result,
      });

      console.log(`[SchedulerEngine] 任务完成: ${job.name} - ${result.success ? '成功' : '失败'} (${result.durationMs}ms)`);
    } catch (error) {
      // 任务执行异常
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      await db.scheduledJob.update({
        where: { id: job.id },
        data: {
          lastStatus: 'failed',
          lastError: errorMsg,
          lastRunAt: new Date(),
        },
      }).catch(() => {
        // 数据库更新失败也不影响流程
      });

      this.state.totalErrors++;
      this.emit('job_failed', { jobId: job.id, jobName: job.name, error: errorMsg });
      console.error(`[SchedulerEngine] 任务执行异常: ${job.name} - ${errorMsg}`);
    } finally {
      this.state.currentlyRunning.delete(job.id);
    }
  }

  /**
   * 手动触发一次任务执行（不修改调度计划）
   */
  async triggerJob(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      const job = await db.scheduledJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return { success: false, message: '任务不存在' };
      }

      if (this.state.currentlyRunning.has(jobId)) {
        return { success: false, message: '任务正在运行中' };
      }

      this.state.currentlyRunning.add(jobId);

      try {
        const result = await executeJob(job.jobType as 'analysis' | 'market_scan' | 'news_fetch' | 'notification' | 'data_sync', job.config);

        // 仅更新 lastRunAt 和 lastStatus，不修改 nextRunAt
        await db.scheduledJob.update({
          where: { id: jobId },
          data: {
            lastRunAt: new Date(),
            lastStatus: result.success ? 'success' : 'failed',
            lastError: result.success ? null : result.message,
          },
        });

        return { success: result.success, message: result.message };
      } finally {
        this.state.currentlyRunning.delete(jobId);
      }
    } catch (error) {
      this.state.currentlyRunning.delete(jobId);
      return { success: false, message: `触发失败: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  // ============================================================
  // 事件系统
  // ============================================================

  private emit(event: SchedulerEvent, data?: Record<string, unknown>): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error('[SchedulerEngine] 事件监听器异常:', error);
      }
    }
  }
}

// ============================================================
// 导出单例获取函数
// ============================================================

let engineInstance: SchedulerEngine | null = null;

/**
 * 获取调度器引擎实例（单例）
 */
export function getSchedulerEngine(): SchedulerEngine {
  if (!engineInstance) {
    engineInstance = SchedulerEngine.getInstance();
  }
  return engineInstance;
}

/**
 * 启动调度器（安全，重复调用不会创建多个实例）
 */
export function startScheduler(checkIntervalMs?: number): void {
  const engine = getSchedulerEngine();
  engine.start(checkIntervalMs);
}

/**
 * 停止调度器
 */
export function stopScheduler(): void {
  const engine = getSchedulerEngine();
  engine.stop();
}

/**
 * 获取调度器状态
 */
export function getSchedulerState(): Readonly<SchedulerState> {
  return getSchedulerEngine().getState();
}

/**
 * 手动触发任务
 */
export async function triggerScheduledJob(jobId: string): Promise<{ success: boolean; message: string }> {
  return getSchedulerEngine().triggerJob(jobId);
}

// ============================================================
// 默认任务初始化
// ============================================================

/** 默认调度任务配置 */
const DEFAULT_JOBS = [
  {
    name: '每日市场扫描',
    cronExpr: '0 9 * * 1-5',
    jobType: 'market_scan',
    config: JSON.stringify({ market: 'A' }),
    isActive: true,
  },
  {
    name: '每日新闻获取',
    cronExpr: '0 8 * * 1-5',
    jobType: 'news_fetch',
    config: JSON.stringify({ category: 'general' }),
    isActive: true,
  },
  {
    name: '每日投资日报',
    cronExpr: '30 15 * * 1-5',
    jobType: 'notification',
    config: JSON.stringify({ channel: 'system' }),
    isActive: false, // 默认关闭，需要用户手动开启
  },
  {
    name: '数据同步',
    cronExpr: '@daily',
    jobType: 'data_sync',
    config: null,
    isActive: false,
  },
];

/**
 * 初始化默认调度任务
 * 仅在数据库中没有任何调度任务时插入
 */
export async function initializeDefaultJobs(): Promise<void> {
  try {
    const existingCount = await db.scheduledJob.count();

    if (existingCount === 0) {
      console.log('[SchedulerEngine] 初始化默认调度任务...');

      for (const job of DEFAULT_JOBS) {
        const nextRunAt = getNextRunTime(job.cronExpr);
        await db.scheduledJob.create({
          data: {
            name: job.name,
            cronExpr: job.cronExpr,
            jobType: job.jobType,
            config: job.config,
            isActive: job.isActive,
            nextRunAt: nextRunAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      console.log('[SchedulerEngine] 默认调度任务初始化完成');
    }
  } catch (error) {
    console.error('[SchedulerEngine] 初始化默认任务失败:', error);
  }
}

/**
 * 懒加载启动调度器（通过API路由调用）
 * 确保调度器只启动一次
 */
let schedulerStarted = false;

export async function lazyStartScheduler(): Promise<void> {
  if (schedulerStarted) return;
  schedulerStarted = true;

  try {
    // 初始化默认任务
    await initializeDefaultJobs();

    // 启动调度器
    startScheduler(60 * 1000); // 每分钟检查一次
    console.log('[SchedulerEngine] 调度器已通过懒加载启动');
  } catch (error) {
    console.error('[SchedulerEngine] 懒加载启动失败:', error);
    schedulerStarted = false;
  }
}
