/**
 * 东方财富K线数据源
 * 获取A股/港股K线数据（多周期+复权）
 * 公开API: push2his.eastmoney.com
 */

const EASTMONEY_TIMEOUT = 8000;
const EASTMONEY_RETRY_COUNT = 1;

/** K线周期映射 */
const KLINE_PERIOD_MAP: Record<string, string> = {
  '1m': '1',    // 1分钟
  '5m': '5',    // 5分钟
  '15m': '15',  // 15分钟
  '30m': '30',  // 30分钟
  '60m': '60',  // 60分钟
  'D': '101',   // 日线
  'W': '102',   // 周线
  'M': '103',   // 月线
};

/** 复权类型 */
const ADJUST_TYPE_MAP: Record<string, string> = {
  'none': '0',    // 不复权
  'qfq': '1',     // 前复权
  'hfq': '2',     // 后复权
};

interface EastMoneyKlineResult {
  c: number[];  // 收盘价
  h: number[];  // 最高价
  l: number[];  // 最低价
  o: number[];  // 开盘价
  v: number[];  // 成交量
  t: number[];  // 时间戳
  s: string;    // 状态
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * 将股票代码转换为东方财富格式
 * 例如: 600519 -> 1.600519 (上海), 000001 -> 0.000001 (深圳)
 *
 * 支持通过 originalSymbol 传入原始带后缀代码以正确判断市场：
 * - 000001.SS → 1.000001 (上证指数，上海)
 * - 399001.SZ → 0.399001 (深证成指，深圳)
 * - 000001.SZ → 0.000001 (平安银行，深圳)
 *
 * @param symbol       纯6位代码（如 000001、600519、399001）
 * @param originalSymbol 原始代码（如 000001.SS、399001.SZ），可选
 */
function convertSymbol(symbol: string, originalSymbol?: string): string {
  // 优先使用原始带后缀的代码来确定市场
  if (originalSymbol) {
    const ssMatch = originalSymbol.match(/^(\d{6})\.SS$/i);
    if (ssMatch) return `1.${ssMatch[1]}`;

    const szMatch = originalSymbol.match(/^(\d{6})\.SZ$/i);
    if (szMatch) return `0.${szMatch[1]}`;
  }

  // 如果已经是东方财富格式（如 "1.600519"），直接返回
  if (/^\d+\.\d+$/.test(symbol)) return symbol;

  // A股6位代码
  if (/^\d{6}$/.test(symbol)) {
    const code = symbol;
    // 399xxx 系列为深圳指数
    if (code.startsWith('399')) return `0.${code}`;
    // 6xx/9xx 为上海
    if (code.startsWith('6') || code.startsWith('9')) return `1.${code}`;
    // 0xx/3xx(非399) 为深圳
    return `0.${code}`;
  }

  // 港股代码
  if (/^\d{5}$/.test(symbol)) {
    return `116.${symbol}`; // 港股
  }

  return symbol;
}

/**
 * 从东方财富获取K线数据
 * @param symbol 股票代码 (如 600519, 000001, 00700)
 * @param period K线周期 (1m/5m/15m/30m/60m/D/W/M)
 * @param adjust 复权类型 (none/qfq/hfq)
 * @param count 请求数量
 */
export async function fetchEastMoneyKline(
  symbol: string,
  period: string = 'D',
  adjust: string = 'qfq',
  count: number = 200
): Promise<EastMoneyKlineResult | null> {
  const secId = convertSymbol(symbol);
  const klt = KLINE_PERIOD_MAP[period] || '101';
  const fqt = ADJUST_TYPE_MAP[adjust] || '1';

  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secId}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=${klt}&fqt=${fqt}&end=20500101&lmt=${count}`;

  try {
    const response = await fetchWithTimeout(url, EASTMONEY_TIMEOUT);

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.klines && data.data.klines.length > 0) {
        const klines: string[] = data.data.klines;

        const closes: number[] = [];
        const highs: number[] = [];
        const lows: number[] = [];
        const opens: number[] = [];
        const volumes: number[] = [];
        const timestamps: number[] = [];

        for (const line of klines) {
          const parts = line.split(',');
          if (parts.length >= 7) {
            const dateStr = parts[0]; // 格式: 2024-01-15
            const ts = Math.floor(new Date(dateStr).getTime() / 1000);
            opens.push(parseFloat(parts[1]));
            closes.push(parseFloat(parts[2]));
            highs.push(parseFloat(parts[3]));
            lows.push(parseFloat(parts[4]));
            volumes.push(parseFloat(parts[5]));
            timestamps.push(ts);
          }
        }

        return {
          c: closes,
          h: highs,
          l: lows,
          o: opens,
          v: volumes,
          t: timestamps,
          s: 'ok',
        };
      }
    }
  } catch (error) {
    const reason = error instanceof DOMException && error.name === 'AbortError'
      ? `请求超时(${EASTMONEY_TIMEOUT}ms)`
      : error instanceof Error
        ? error.message
        : String(error);
    console.log(`[eastmoney] K线数据获取失败: ${reason}，将使用回退数据`);
  }

  return null;
}

/**
 * 从东方财富备用接口获取实时行情报价
 * 使用 push2his 的分时接口作为备选方案
 */
async function fetchEastMoneyQuoteFallback(
  secId: string
): Promise<{
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  amount: number;
  source: string;
} | null> {
  // 备用接口：使用行情趋势接口获取最新数据
  const fallbackUrl = `https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=${secId}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=1`;

  try {
    const response = await fetchWithTimeout(fallbackUrl, EASTMONEY_TIMEOUT);
    if (!response.ok) {
      console.log(`[eastmoney] 备用行情接口返回HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.data || !data.data.trends || data.data.trends.length === 0) {
      console.log('[eastmoney] 备用行情接口返回数据为空');
      return null;
    }

    // 从分时数据中提取最新一条记录
    const trends: string[] = data.data.trends;
    const preClose = data.data.preClose as number | undefined;
    const lastTrend = trends[trends.length - 1];
    const parts = lastTrend.split(',');

    if (parts.length < 7 || !preClose) {
      console.log('[eastmoney] 备用行情接口数据格式异常');
      return null;
    }

    const currentPrice = parseFloat(parts[2]);
    const prevClose = preClose;
    const change = currentPrice - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    // 从分时数据中计算当日最高/最低
    let high = currentPrice;
    let low = currentPrice;
    for (const trend of trends) {
      const tParts = trend.split(',');
      if (tParts.length >= 4) {
        const tHigh = parseFloat(tParts[3]);
        const tLow = parseFloat(tParts[4]);
        if (tHigh > high) high = tHigh;
        if (tLow < low) low = tLow;
      }
    }

    const open = trends.length > 0 ? parseFloat(trends[0].split(',')[2]) : currentPrice;

    return {
      currentPrice,
      change,
      changePercent,
      high,
      low,
      open,
      prevClose,
      volume: parts[5] ? parseFloat(parts[5]) : 0,
      amount: parts[6] ? parseFloat(parts[6]) : 0,
      source: 'eastmoney_fallback',
    };
  } catch (error) {
    const reason = error instanceof DOMException && error.name === 'AbortError'
      ? `请求超时(${EASTMONEY_TIMEOUT}ms)`
      : error instanceof Error
        ? error.message
        : String(error);
    console.log(`[eastmoney] 备用行情接口获取失败: ${reason}`);
    return null;
  }
}

/**
 * 从东方财富获取实时行情报价
 * @param symbol       纯6位代码（如 000001、600519、399001）
 * @param originalSymbol 原始代码（如 000001.SS、399001.SZ），用于正确判断上海/深圳市场
 */
export async function fetchEastMoneyQuote(
  symbol: string,
  originalSymbol?: string
): Promise<{
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  amount: number;
  source: string;
} | null> {
  const secId = convertSymbol(symbol, originalSymbol);
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secId}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f170,f171`;

  // 最多尝试 1 + EASTMONEY_RETRY_COUNT 次
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= EASTMONEY_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[eastmoney] 行情数据第${attempt}次重试，secid=${secId}`);
      }

      const response = await fetchWithTimeout(url, EASTMONEY_TIMEOUT);

      if (!response.ok) {
        lastError = `HTTP ${response.status} ${response.statusText}`;
        console.log(`[eastmoney] 行情接口返回HTTP错误: ${lastError}，secid=${secId}`);
        continue; // retry on HTTP error
      }

      const data = await response.json();

      if (!data.data) {
        lastError = `接口返回数据为空(data=null)，secid=${secId}，可能是代码格式错误`;
        console.log(`[eastmoney] 行情数据获取失败: ${lastError}`);
        continue; // retry - maybe a transient issue
      }

      if (!data.data.f43) {
        lastError = `缺少f43字段(最新价)，secid=${secId}，返回字段: ${Object.keys(data.data).join(',')}`;
        console.log(`[eastmoney] 行情数据不完整: ${lastError}`);
        continue; // retry
      }

      // 东方财富返回的价格需要除以100（部分字段）
      // f43=最新价, f44=最高, f45=最低, f46=今开, f47=成交量, f48=成交额
      // f57=代码, f58=名称, f60=昨收, f170=涨跌额, f171=涨跌幅
      const d = data.data;
      const divisor = 100;

      const prevClose = d.f60 / divisor;
      const currentPrice = d.f43 / divisor;
      const change = currentPrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        currentPrice,
        change,
        changePercent,
        high: d.f44 / divisor,
        low: d.f45 / divisor,
        open: d.f46 / divisor,
        prevClose,
        volume: d.f47 || 0,
        amount: d.f48 || 0,
        source: 'eastmoney',
      };
    } catch (error) {
      const reason = error instanceof DOMException && error.name === 'AbortError'
        ? `请求超时(${EASTMONEY_TIMEOUT}ms)`
        : error instanceof Error
          ? error.message
          : String(error);
      lastError = reason;
      console.log(`[eastmoney] 行情数据获取失败(第${attempt + 1}次): ${reason}，secid=${secId}`);
    }
  }

  // 主接口全部重试失败，尝试备用接口
  console.log(`[eastmoney] 主行情接口全部失败(${lastError})，尝试备用接口，secid=${secId}`);
  const fallbackResult = await fetchEastMoneyQuoteFallback(secId);
  if (fallbackResult) {
    return fallbackResult;
  }

  console.log(`[eastmoney] 所有行情接口均失败，symbol=${symbol}, originalSymbol=${originalSymbol ?? 'N/A'}, secid=${secId}`);
  return null;
}

/**
 * 生成东方财富模拟K线数据
 */
export function generateEastMoneyMockKline(
  symbol: string,
  days: number = 200
): EastMoneyKlineResult {
  // 使用代码哈希生成确定性数据
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = (hash % 100) / 100;
  const basePrice = 20 + seed * 200;

  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const opens: number[] = [];
  const volumes: number[] = [];
  const timestamps: number[] = [];

  let price = basePrice * 0.85;
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < days; i++) {
    const ts = now - (days - i) * 86400;
    const drift = (basePrice - price) / (days - i) * 0.3;
    const volatility = price * 0.02;
    const change = drift + (Math.random() - 0.5) * volatility;

    const open = parseFloat(price.toFixed(2));
    const close = parseFloat((price + change).toFixed(2));
    const high = parseFloat((Math.max(open, close) + Math.random() * volatility * 0.5).toFixed(2));
    const low = parseFloat((Math.min(open, close) - Math.random() * volatility * 0.5).toFixed(2));
    const volume = Math.floor(30000000 + Math.random() * 70000000);

    opens.push(open);
    closes.push(close);
    highs.push(high);
    lows.push(low);
    volumes.push(volume);
    timestamps.push(ts);

    price = close;
  }

  return { c: closes, h: highs, l: lows, o: opens, v: volumes, t: timestamps, s: 'ok' };
}
