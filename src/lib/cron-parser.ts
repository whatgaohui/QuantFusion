/**
 * 简化版 Cron 解析器
 * 
 * 支持5位标准格式: 分 时 日 月 周
 * 支持快捷方式: @daily, @hourly, @weekly, @trading_day
 * 支持交易日判断（调用交易日历）
 */

import { isTradingDay } from './trading-calendar';

export interface CronField {
  type: 'wildcard' | 'value' | 'range' | 'step' | 'list';
  values: number[];
  raw: string;
}

export interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
  raw: string;
  shortcut?: string;
}

// ============================================================
// 解析单个 cron 字段
// ============================================================

function parseCronField(field: string, min: number, max: number): CronField {
  // 通配符 *
  if (field === '*') {
    const values: number[] = [];
    for (let i = min; i <= max; i++) values.push(i);
    return { type: 'wildcard', values, raw: field };
  }

  // 步进 */N
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) {
      throw new Error(`Invalid step value: ${field}`);
    }
    const values: number[] = [];
    for (let i = min; i <= max; i += step) values.push(i);
    return { type: 'step', values, raw: field };
  }

  // 范围 N-M
  if (field.includes('-') && !field.includes('/')) {
    const [startStr, endStr] = field.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end)) {
      throw new Error(`Invalid range: ${field}`);
    }
    const values: number[] = [];
    for (let i = start; i <= end; i++) values.push(i);
    return { type: 'range', values, raw: field };
  }

  // 范围步进 N-M/S
  if (field.includes('-') && field.includes('/')) {
    const [rangePart, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    const [startStr, endStr] = rangePart.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end) || isNaN(step) || step <= 0) {
      throw new Error(`Invalid range-step: ${field}`);
    }
    const values: number[] = [];
    for (let i = start; i <= end; i += step) values.push(i);
    return { type: 'step', values, raw: field };
  }

  // 列表 N,M,K
  if (field.includes(',')) {
    const values = field.split(',').map(v => parseInt(v, 10));
    if (values.some(isNaN)) {
      throw new Error(`Invalid list: ${field}`);
    }
    return { type: 'list', values, raw: field };
  }

  // 单个值
  const value = parseInt(field, 10);
  if (isNaN(value)) {
    throw new Error(`Invalid value: ${field}`);
  }
  return { type: 'value', values: [value], raw: field };
}

// ============================================================
// 解析完整 cron 表达式
// ============================================================

/**
 * 解析 cron 表达式
 * 
 * 标准格式: 分 时 日 月 周
 * 快捷方式: @daily, @hourly, @weekly, @monthly, @trading_day
 */
export function parseCron(expr: string): ParsedCron {
  const trimmed = expr.trim();

  // 快捷方式处理
  switch (trimmed) {
    case '@hourly':
      return parseCron('0 * * * *');
    case '@daily':
      return parseCron('0 0 * * *');
    case '@weekly':
      return parseCron('0 0 * * 1');
    case '@monthly':
      return parseCron('0 0 1 * *');
    case '@yearly':
    case '@annually':
      return parseCron('0 0 1 1 *');
    case '@trading_day':
      // 交易日每天开盘前30分钟执行 (09:00)
      return {
        ...parseCron('0 9 * * 1-5'),
        raw: trimmed,
        shortcut: '@trading_day',
      };
    default:
      break;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: "${trimmed}". Expected 5 fields (minute hour day month weekday).`);
  }

  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6), // 0=周日, 1=周一, ..., 6=周六
    raw: trimmed,
  };
}

// ============================================================
// 计算下次执行时间
// ============================================================

/**
 * 判断给定日期是否匹配 cron 表达式
 */
function matchesCron(date: Date, parsed: ParsedCron): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  // 特殊处理 @trading_day 快捷方式
  if (parsed.shortcut === '@trading_day') {
    // 仅在A股交易日执行
    if (!isTradingDay(date, 'A')) {
      return false;
    }
  }

  if (!parsed.minute.values.includes(minute)) return false;
  if (!parsed.hour.values.includes(hour)) return false;
  if (!parsed.month.values.includes(month)) return false;

  // 日和周的关系：标准 cron 中，两者同时满足或其中一个为 *
  const dayMatch = parsed.dayOfMonth.type === 'wildcard' || parsed.dayOfMonth.values.includes(dayOfMonth);
  const dowMatch = parsed.dayOfWeek.type === 'wildcard' || parsed.dayOfWeek.values.includes(dayOfWeek);

  // 如果两者都不是通配符，则满足其中一个即可（标准cron行为）
  if (parsed.dayOfMonth.type !== 'wildcard' && parsed.dayOfWeek.type !== 'wildcard') {
    return dayMatch || dowMatch;
  }

  return dayMatch && dowMatch;
}

/**
 * 计算下次执行时间
 * 
 * @param expr - cron 表达式
 * @param after - 从哪个时间点开始搜索，默认当前时间
 * @returns 下次执行时间，如果一年内找不到则返回 null
 */
export function getNextRunTime(expr: string, after?: Date): Date | null {
  const parsed = parseCron(expr);
  const start = after ? new Date(after) : new Date();

  // 从下一分钟开始搜索
  const candidate = new Date(start);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // 最多搜索一年
  const maxTime = new Date(start);
  maxTime.setFullYear(maxTime.getFullYear() + 1);

  while (candidate <= maxTime) {
    if (matchesCron(candidate, parsed)) {
      return new Date(candidate);
    }
    // 优化：跳过不可能匹配的时间
    const minute = candidate.getMinutes();
    if (!parsed.minute.values.includes(minute)) {
      // 找到下一个匹配的分钟
      const nextMinute = parsed.minute.values.find(m => m > minute);
      if (nextMinute !== undefined) {
        candidate.setMinutes(nextMinute);
      } else {
        candidate.setMinutes(parsed.minute.values[0]);
        candidate.setHours(candidate.getHours() + 1);
      }
    } else if (!parsed.hour.values.includes(candidate.getHours())) {
      // 找到下一个匹配的小时
      const currentHour = candidate.getHours();
      const nextHour = parsed.hour.values.find(h => h > currentHour);
      if (nextHour !== undefined) {
        candidate.setHours(nextHour);
      } else {
        candidate.setHours(parsed.hour.values[0]);
        candidate.setDate(candidate.getDate() + 1);
      }
      candidate.setMinutes(parsed.minute.values[0]);
    } else {
      // 分钟和小时都匹配，但日/月/周不匹配，前进到下一天的0点
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(parsed.hour.values[0]);
      candidate.setMinutes(parsed.minute.values[0]);
    }
  }

  return null;
}

/**
 * 获取 cron 表达式的人类可读描述
 */
export function describeCron(expr: string): string {
  const trimmed = expr.trim();

  // 快捷方式
  switch (trimmed) {
    case '@hourly': return '每小时执行';
    case '@daily': return '每天执行';
    case '@weekly': return '每周一执行';
    case '@monthly': return '每月1日执行';
    case '@yearly':
    case '@annually': return '每年1月1日执行';
    case '@trading_day': return '交易日09:00执行';
    default:
      break;
  }

  try {
    const parsed = parseCron(expr);
    const parts: string[] = [];

    // 分钟
    if (parsed.minute.type !== 'wildcard') {
      parts.push(`第${parsed.minute.values.join('/')}分钟`);
    }

    // 小时
    if (parsed.hour.type !== 'wildcard') {
      parts.push(`${parsed.hour.values.map(h => `${String(h).padStart(2, '0')}:00`).join('/')}`);
    } else if (parsed.minute.type !== 'wildcard') {
      parts.push('每小时');
    }

    // 星期
    if (parsed.dayOfWeek.type !== 'wildcard') {
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      parts.push(parsed.dayOfWeek.values.map(d => dayNames[d]).join('/'));
    }

    // 月
    if (parsed.month.type !== 'wildcard') {
      parts.push(`${parsed.month.values.join('/')}月`);
    }

    // 日
    if (parsed.dayOfMonth.type !== 'wildcard') {
      parts.push(`每月${parsed.dayOfMonth.values.join('/')}日`);
    }

    return parts.length > 0 ? parts.join(' ') : '每分钟执行';
  } catch {
    return expr;
  }
}

/**
 * 验证 cron 表达式是否有效
 */
export function isValidCron(expr: string): boolean {
  try {
    parseCron(expr);
    return true;
  } catch {
    return false;
  }
}
