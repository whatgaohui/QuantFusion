/**
 * 数据源管理器
 * 统一管理所有数据源(Finnhub/新浪/腾讯/东方财富/问财)
 * 优先级配置、健康检查、自动回退
 */

import { db } from '@/lib/db';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

/** 数据源配置 */
export interface DataSourceConfig {
  name: string;           // 数据源名称
  displayName: string;    // 显示名称
  market: string;         // 适用市场 (A/HK/US/GLOBAL)
  priority: number;       // 优先级 (数字越小优先级越高)
  capabilities: string[]; // 能力列表 (kline/quote/search/screen/realtime)
  enabled: boolean;       // 是否启用
}

/** 数据源健康状态 */
export interface DataSourceHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  latencyMs: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

/** 预定义数据源配置 */
const DATA_SOURCES: DataSourceConfig[] = [
  {
    name: 'finnhub',
    displayName: 'Finnhub',
    market: 'GLOBAL',
    priority: 1,
    capabilities: ['kline', 'quote', 'search', 'realtime'],
    enabled: true,
  },
  {
    name: 'eastmoney',
    displayName: '东方财富',
    market: 'A',
    priority: 1,
    capabilities: ['kline', 'quote', 'realtime'],
    enabled: true,
  },
  {
    name: 'sina',
    displayName: '新浪财经',
    market: 'A',
    priority: 2,
    capabilities: ['quote', 'realtime'],
    enabled: true,
  },
  {
    name: 'tencent',
    displayName: '腾讯财经',
    market: 'HK',
    priority: 2,
    capabilities: ['quote', 'realtime'],
    enabled: true,
  },
  {
    name: 'iwencai',
    displayName: '问财',
    market: 'A',
    priority: 1,
    capabilities: ['screen'],
    enabled: true,
  },
];

/**
 * 获取所有数据源配置
 */
export function getDataSourceConfigs(): DataSourceConfig[] {
  return DATA_SOURCES;
}

/**
 * 按市场和能力筛选数据源
 */
export function getDataSourcesByCapability(
  market: string,
  capability: string
): DataSourceConfig[] {
  return DATA_SOURCES
    .filter(ds => ds.enabled && ds.capabilities.includes(capability))
    .filter(ds => ds.market === 'GLOBAL' || ds.market === market)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 获取数据源健康状态（从数据库读取）
 */
export async function getDataSourcesHealth(): Promise<DataSourceHealthStatus[]> {
  try {
    const healthRecords = await db.dataSourceHealth.findMany();
    
    const result: DataSourceHealthStatus[] = DATA_SOURCES.map(ds => {
      const record = healthRecords.find(r => r.sourceName === ds.name);
      return {
        name: ds.name,
        status: (record?.status as DataSourceHealthStatus['status']) || 'unknown',
        latencyMs: record?.latencyMs || 0,
        lastSuccessAt: record?.lastSuccessAt?.toISOString() || null,
        lastError: record?.lastError || null,
        consecutiveFailures: record?.consecutiveFailures || 0,
      };
    });

    return result;
  } catch {
    // 数据库查询失败，返回默认状态
    return DATA_SOURCES.map(ds => ({
      name: ds.name,
      status: 'unknown' as const,
      latencyMs: 0,
      lastSuccessAt: null,
      lastError: null,
      consecutiveFailures: 0,
    }));
  }
}

/**
 * 更新数据源健康状态
 */
export async function updateDataSourceHealth(
  sourceName: string,
  success: boolean,
  latencyMs: number,
  error?: string
): Promise<void> {
  try {
    const existing = await db.dataSourceHealth.findUnique({
      where: { sourceName },
    });

    if (existing) {
      const consecutiveFailures = success ? 0 : (existing.consecutiveFailures || 0) + 1;
      const status = success
        ? 'healthy'
        : consecutiveFailures >= 3 ? 'down' : 'degraded';

      await db.dataSourceHealth.update({
        where: { sourceName },
        data: {
          status,
          latencyMs,
          lastSuccessAt: success ? new Date() : existing.lastSuccessAt,
          lastError: success ? null : (error || existing.lastError),
          consecutiveFailures,
        },
      });
    } else {
      await db.dataSourceHealth.create({
        data: {
          sourceName,
          market: DATA_SOURCES.find(ds => ds.name === sourceName)?.market || 'GLOBAL',
          status: success ? 'healthy' : 'degraded',
          latencyMs,
          lastSuccessAt: success ? new Date() : null,
          lastError: success ? null : (error || null),
          consecutiveFailures: success ? 0 : 1,
        },
      });
    }
  } catch {
    // 数据库更新失败，不影响主流程
  }
}

/**
 * 检测股票代码所属市场
 * 支持多种常见格式：
 * - 000001.SS (上海，Yahoo Finance格式)
 * - 600519.SS (上海)
 * - 000001.SZ (深圳，Yahoo Finance格式)
 * - 399001.SZ (深圳指数)
 * - 000001 (纯6位代码)
 * - 00700 (5位港股代码)
 * - ^HSI (恒生指数)
 * - ^GSPC, ^DJI, ^IXIC (美股指数)
 * - AAPL, MSFT (标准美股代码)
 */
export function detectMarket(symbol: string): { market: string; pureCode: string } {
  // 上海/深圳后缀格式 (Yahoo Finance风格)
  const ssMatch = symbol.match(/^(\d{6})\.SS$/i);
  if (ssMatch) {
    return { market: 'A', pureCode: ssMatch[1] };
  }

  const szMatch = symbol.match(/^(\d{6})\.SZ$/i);
  if (szMatch) {
    return { market: 'A', pureCode: szMatch[1] };
  }

  // 纯6位数字代码 (A股)
  if (/^\d{6}$/.test(symbol)) {
    return { market: 'A', pureCode: symbol };
  }

  // 5位数字代码 (港股)
  if (/^\d{5}$/.test(symbol)) {
    return { market: 'HK', pureCode: symbol };
  }

  // 知名指数
  if (symbol === '^HSI') {
    return { market: 'HK', pureCode: '^HSI' };
  }

  if (['^GSPC', '^DJI', '^IXIC'].includes(symbol)) {
    return { market: 'US', pureCode: symbol };
  }

  // 标准美股代码 (字母组成)
  if (/^[A-Z]+$/.test(symbol)) {
    return { market: 'US', pureCode: symbol };
  }

  // 默认美股
  return { market: 'US', pureCode: symbol };
}

/**
 * 智能K线获取（多源回退：东方财富→Finnhub→模拟）
 */
export async function getSmartKline(
  symbol: string,
  period: string = 'D',
  market: string = 'US'
): Promise<{
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];
  s: string;
  source: string;
} | null> {
  // 使用detectMarket判断市场类型
  const detected = detectMarket(symbol);
  const effectiveMarket = market !== 'US' || detected.market !== 'US' ? detected.market : market;
  const isAShare = effectiveMarket === 'A';
  const isHK = effectiveMarket === 'HK';

  // A股/港股优先使用东方财富
  if (isAShare || isHK) {
    const { fetchEastMoneyKline, generateEastMoneyMockKline } = await import('./data-source-eastmoney');
    const startTime = Date.now();
    try {
      // 使用pureCode传给东方财富（它需要纯6位代码）
      const eastmoneySymbol = detected.pureCode;
      const result = await fetchEastMoneyKline(eastmoneySymbol, period, 'qfq', 200);
      if (result && result.c.length > 0) {
        await updateDataSourceHealth('eastmoney', true, Date.now() - startTime);
        return { ...result, source: 'eastmoney' };
      }
    } catch {
      await updateDataSourceHealth('eastmoney', false, Date.now() - startTime, 'K线数据获取失败');
    }

    // 东方财富失败，回退到模拟数据
    const mockResult = generateEastMoneyMockKline(detected.pureCode, 200);
    return { ...mockResult, source: 'eastmoney_mock' };
  }

  // 美股/其他市场使用Finnhub
  const FINNHUB_API_KEY = await getFinnhubApiKey();
  const startTime = Date.now();

  if (FINNHUB_API_KEY) {
    try {
      const RESOLUTION_MAP: Record<string, string> = {
        '1m': '1', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', 'D': 'D', 'W': 'W', 'M': 'M',
      };
      const resolution = RESOLUTION_MAP[period] || period;
      const now = Math.floor(Date.now() / 1000);
      const from = now - 365 * 86400;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.s === 'ok' && data.c && data.c.length > 0) {
          await updateDataSourceHealth('finnhub', true, Date.now() - startTime);
          return {
            c: data.c, h: data.h, l: data.l, o: data.o, v: data.v, t: data.t, s: data.s, source: 'finnhub',
          };
        }
      }
    } catch {
      await updateDataSourceHealth('finnhub', false, Date.now() - startTime, 'Finnhub K线获取失败');
    }
  }

  return null;
}
