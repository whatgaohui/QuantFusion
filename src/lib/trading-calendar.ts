/**
 * 交易日历库 - Trading Calendar
 * 
 * 支持 A股、港股、美股三大市场的交易日判断、市场阶段获取等功能。
 * 内置 2024-2026 年主要节假日数据。
 */

export type Market = 'A' | 'HK' | 'US';

export type MarketPhase =
  | 'pre_market'    // 盘前
  | 'open'          // 交易中
  | 'lunch_break'   // 午休（仅A股）
  | 'closing_auction' // 收盘集合竞价
  | 'after_hours'   // 盘后
  | 'closed';       // 休市

export interface TradingDayInfo {
  date: Date;
  isTradingDay: boolean;
  marketPhase: MarketPhase;
  nextTradingDay: Date | null;
  holidayName?: string;
}

// ============================================================
// 节假日数据 (格式: 'MM-DD'，每年特定日期)
// ============================================================

/** A股节假日 - 固定日期 */
const A_SHARE_FIXED_HOLIDAYS = [
  '01-01', // 元旦
  '05-01', // 劳动节
  '10-01', // 国庆节
  '10-02', // 国庆节
  '10-03', // 国庆节
];

/** A股节假日 - 按年份特殊安排 (春节、清明、端午、中秋等农历节日) */
const A_SHARE_SPECIAL_HOLIDAYS: Record<number, string[]> = {
  2024: [
    '02-09', '02-10', '02-11', '02-12', '02-13', '02-14', '02-15', '02-16', '02-17', // 春节
    '04-04', '04-05', '04-06', // 清明节
    '06-08', '06-09', '06-10', // 端午节
    '09-15', '09-16', '09-17', // 中秋节
    '10-04', '10-05', '10-06', '10-07', // 国庆调休
  ],
  2025: [
    '01-28', '01-29', '01-30', '01-31', '02-01', '02-02', '02-03', '02-04', // 春节
    '04-04', '04-05', '04-06', // 清明节
    '05-02', '05-03', '05-04', '05-05', // 劳动节调休
    '05-31', '06-01', '06-02', // 端午节
    '10-06', '10-07', '10-08', // 国庆调休
  ],
  2026: [
    '02-16', '02-17', '02-18', '02-19', '02-20', '02-21', '02-22', // 春节
    '04-05', '04-06', // 清明节
    '06-19', '06-20', '06-21', // 端午节
    '09-25', '09-26', '09-27', // 中秋节
    '10-02', '10-03', '10-05', '10-06', '10-07', // 国庆调休
  ],
};

/** A股周末补班日（这些日期虽然是周末但需要上班，即交易日） */
const A_SHARE_WEEKEND_WORKDAYS: Record<number, string[]> = {
  2024: [
    '02-04', // 春节前补班
    '02-18', // 春节后补班
    '04-07', // 清明后补班
    '04-28', // 劳动节前补班
    '05-11', // 劳动节后补班
    '09-14', // 中秋前补班
    '09-29', // 国庆前补班
    '10-12', // 国庆后补班
  ],
  2025: [
    '01-26', // 春节前补班
    '02-08', // 春节后补班
    '04-27', // 劳动节前补班
    '09-28', // 国庆前补班
    '10-11', // 国庆后补班
  ],
  2026: [
    '02-14', // 春节前补班
    '02-28', // 春节后补班
    '09-27', // 国庆前补班
    '10-10', // 国庆后补班
  ],
};

/** 港股节假日 */
const HK_HOLIDAYS: Record<number, string[]> = {
  2024: [
    '01-01', // 元旦
    '02-10', '02-12', '02-13', // 春节
    '03-29', '03-30', // 复活节
    '04-04', // 清明节
    '05-01', // 劳动节
    '05-15', // 佛诞
    '06-10', // 端午节
    '07-01', // 回归日
    '09-18', // 中秋节翌日
    '10-01', // 国庆节
    '10-11', // 重阳节
    '12-25', '12-26', // 圣诞节
  ],
  2025: [
    '01-01', // 元旦
    '01-29', '01-30', '01-31', // 春节
    '04-04', // 清明节
    '04-18', '04-19', // 复活节
    '05-01', // 劳动节
    '05-05', // 佛诞
    '06-02', // 端午节
    '07-01', // 回归日
    '10-01', // 国庆节
    '10-29', // 重阳节
    '12-25', '12-26', // 圣诞节
  ],
  2026: [
    '01-01', // 元旦
    '02-17', '02-18', '02-19', // 春节
    '04-03', '04-06', // 复活节/清明
    '05-01', // 劳动节
    '05-25', // 佛诞
    '06-19', // 端午节
    '07-01', // 回归日
    '10-01', // 国庆节
    '10-18', // 重阳节
    '12-25', '12-26', // 圣诞节
  ],
};

/** 美股节假日 */
const US_HOLIDAYS: Record<number, string[]> = {
  2024: [
    '01-01', // New Year's Day
    '01-15', // MLK Day (1月第3个周一)
    '02-19', // Presidents' Day (2月第3个周一)
    '03-29', // Good Friday
    '05-27', // Memorial Day (5月最后1个周一)
    '06-19', // Juneteenth
    '07-04', // Independence Day
    '09-02', // Labor Day (9月第1个周一)
    '11-28', // Thanksgiving (11月第4个周四)
    '12-25', // Christmas
  ],
  2025: [
    '01-01', // New Year's Day
    '01-20', // MLK Day
    '02-17', // Presidents' Day
    '04-18', // Good Friday
    '05-26', // Memorial Day
    '06-19', // Juneteenth
    '07-04', // Independence Day
    '09-01', // Labor Day
    '11-27', // Thanksgiving
    '12-25', // Christmas
  ],
  2026: [
    '01-01', // New Year's Day
    '01-19', // MLK Day
    '02-16', // Presidents' Day
    '04-03', // Good Friday
    '05-25', // Memorial Day
    '06-19', // Juneteenth
    '07-03', // Independence Day (observed)
    '09-07', // Labor Day
    '11-26', // Thanksgiving
    '12-25', // Christmas
  ],
};

/** 节假日名称映射（用于返回给前端展示） */
const HOLIDAY_NAMES_A: Record<string, string> = {
  '01-01': '元旦',
  '02-09': '春节', '02-10': '春节', '02-11': '春节', '02-12': '春节', '02-13': '春节',
  '02-14': '春节', '02-15': '春节', '02-16': '春节', '02-17': '春节',
  '01-28': '春节', '01-29': '春节', '01-30': '春节', '01-31': '春节', '02-01': '春节',
  '02-02': '春节', '02-03': '春节', '02-04': '春节',
  '02-16': '春节', '02-17': '春节', '02-18': '春节', '02-19': '春节', '02-20': '春节',
  '02-21': '春节', '02-22': '春节',
  '04-04': '清明节', '04-05': '清明节', '04-06': '清明节',
  '05-01': '劳动节', '05-02': '劳动节', '05-03': '劳动节', '05-04': '劳动节', '05-05': '劳动节',
  '06-08': '端午节', '06-09': '端午节', '06-10': '端午节',
  '06-19': '端午节', '06-20': '端午节', '06-21': '端午节',
  '09-15': '中秋节', '09-16': '中秋节', '09-17': '中秋节',
  '09-25': '中秋节', '09-26': '中秋节', '09-27': '中秋节',
  '10-01': '国庆节', '10-02': '国庆节', '10-03': '国庆节',
  '10-04': '国庆节', '10-05': '国庆节', '10-06': '国庆节', '10-07': '国庆节',
  '10-08': '国庆节',
};

const HOLIDAY_NAMES_US: Record<string, string> = {
  '01-01': "New Year's Day",
  '01-15': 'MLK Day', '01-19': 'MLK Day', '01-20': 'MLK Day',
  '02-16': "Presidents' Day", '02-17': "Presidents' Day", '02-19': "Presidents' Day",
  '03-29': 'Good Friday', '04-03': 'Good Friday', '04-18': 'Good Friday',
  '05-25': 'Memorial Day', '05-26': 'Memorial Day', '05-27': 'Memorial Day',
  '06-19': 'Juneteenth',
  '07-03': 'Independence Day (observed)', '07-04': 'Independence Day',
  '09-01': 'Labor Day', '09-02': 'Labor Day', '09-07': 'Labor Day',
  '11-26': 'Thanksgiving', '11-27': 'Thanksgiving', '11-28': 'Thanksgiving',
  '12-25': 'Christmas',
};

const HOLIDAY_NAMES_HK: Record<string, string> = {
  '01-01': '元旦',
  '01-29': '春节', '01-30': '春节', '01-31': '春节',
  '02-10': '春节', '02-12': '春节', '02-13': '春节',
  '02-17': '春节', '02-18': '春节', '02-19': '春节',
  '03-29': '复活节', '03-30': '复活节', '04-18': '复活节', '04-19': '复活节',
  '04-03': '复活节/清明', '04-04': '清明节', '04-06': '复活节',
  '05-01': '劳动节',
  '05-05': '佛诞', '05-15': '佛诞', '05-25': '佛诞',
  '06-02': '端午节', '06-10': '端午节', '06-19': '端午节',
  '07-01': '回归日',
  '09-18': '中秋节', '10-29': '重阳节', '10-11': '重阳节', '10-18': '重阳节',
  '10-01': '国庆节',
  '12-25': '圣诞节', '12-26': '圣诞节',
};

// ============================================================
// 核心工具函数
// ============================================================

/** 格式化日期为 'MM-DD' */
function toMMDD(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

/** 格式化日期为 'YYYY-MM-DD' */
function toYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 判断是否周末 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** 获取指定市场的节假日列表 */
function getHolidays(year: number, market: Market): string[] {
  switch (market) {
    case 'A': {
      const fixed = A_SHARE_FIXED_HOLIDAYS;
      const special = A_SHARE_SPECIAL_HOLIDAYS[year] || [];
      return [...fixed, ...special];
    }
    case 'HK':
      return HK_HOLIDAYS[year] || [];
    case 'US':
      return US_HOLIDAYS[year] || [];
    default:
      return [];
  }
}

/** 获取A股周末补班日列表 */
function getWeekendWorkdays(year: number): string[] {
  return A_SHARE_WEEKEND_WORKDAYS[year] || [];
}

/** 获取节假日名称 */
function getHolidayName(date: Date, market: Market): string | undefined {
  const mmdd = toMMDD(date);
  switch (market) {
    case 'A':
      return HOLIDAY_NAMES_A[mmdd];
    case 'HK':
      return HOLIDAY_NAMES_HK[mmdd];
    case 'US':
      return HOLIDAY_NAMES_US[mmdd];
    default:
      return undefined;
  }
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 判断指定日期是否为交易日
 * 排除周末 + 节假日，A股还考虑周末补班日
 */
export function isTradingDay(date: Date, market: Market): boolean {
  const year = date.getFullYear();
  const mmdd = toMMDD(date);
  const holidays = getHolidays(year, market);

  // 检查是否为节假日
  if (holidays.includes(mmdd)) {
    return false;
  }

  // 检查周末
  if (isWeekend(date)) {
    // A股周末补班日仍需交易
    if (market === 'A') {
      const workdays = getWeekendWorkdays(year);
      return workdays.includes(mmdd);
    }
    return false;
  }

  return true;
}

/**
 * 获取指定日期的市场阶段
 * 基于北京时间 (UTC+8) 判断A股/港股，基于纽约时间 (UTC-5/UTC-4) 判断美股
 */
export function getMarketPhase(date: Date, market: Market): MarketPhase {
  // 非交易日直接返回休市
  if (!isTradingDay(date, market)) {
    return 'closed';
  }

  // 使用本地时间的小时数进行判断
  // 注意：服务端运行时使用 UTC，这里做简化处理
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeNum = hour * 100 + minute; // 如 930 表示 09:30

  switch (market) {
    case 'A': {
      // A股: 09:15-09:25 集合竞价, 09:30-11:30 上午, 11:30-13:00 午休, 13:00-14:57 下午, 14:57-15:00 收盘竞价
      if (timeNum < 915) return 'pre_market';
      if (timeNum < 930) return 'pre_market'; // 集合竞价阶段归入盘前
      if (timeNum < 1130) return 'open';
      if (timeNum < 1300) return 'lunch_break';
      if (timeNum < 1457) return 'open';
      if (timeNum < 1500) return 'closing_auction';
      return 'after_hours';
    }
    case 'HK': {
      // 港股: 09:00-09:30 盘前, 09:30-12:00 上午, 12:00-13:00 午休, 13:00-16:00 下午, 16:00-16:10 收盘竞价
      if (timeNum < 900) return 'pre_market';
      if (timeNum < 930) return 'pre_market';
      if (timeNum < 1200) return 'open';
      if (timeNum < 1300) return 'lunch_break';
      if (timeNum < 1600) return 'open';
      if (timeNum < 1610) return 'closing_auction';
      return 'after_hours';
    }
    case 'US': {
      // 美股: 04:00-09:30 盘前, 09:30-16:00 交易, 16:00-20:00 盘后
      // 这里使用美东时间简化判断
      if (timeNum < 400) return 'closed';
      if (timeNum < 930) return 'pre_market';
      if (timeNum < 1600) return 'open';
      if (timeNum < 2000) return 'after_hours';
      return 'closed';
    }
    default:
      return 'closed';
  }
}

/**
 * 获取下一个交易日
 * 从给定日期的下一天开始查找
 */
export function getNextTradingDay(date: Date, market: Market): Date | null {
  // 从下一天开始搜索，最多搜索30天
  const start = new Date(date);
  start.setDate(start.getDate() + 1);

  for (let i = 0; i < 30; i++) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + i);
    if (isTradingDay(candidate, market)) {
      return candidate;
    }
  }

  return null;
}

/**
 * 获取日期范围内的交易日列表
 */
export function getTradingDays(start: Date, end: Date, market: Market): Date[] {
  const days: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    if (isTradingDay(current, market)) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * 获取完整的交易日信息
 */
export function getTradingDayInfo(date: Date, market: Market): TradingDayInfo {
  const isTD = isTradingDay(date, market);
  const phase = getMarketPhase(date, market);
  const nextTD = getNextTradingDay(date, market);
  const holidayName = !isTD ? getHolidayName(date, market) : undefined;

  return {
    date: new Date(date),
    isTradingDay: isTD,
    marketPhase: phase,
    nextTradingDay: nextTD,
    holidayName,
  };
}

/**
 * 获取指定年份的节假日列表
 */
export function getHolidaysForYear(year: number, market: Market): Array<{ date: string; name?: string }> {
  const holidays = getHolidays(year, market);
  const nameMap = market === 'A' ? HOLIDAY_NAMES_A : market === 'HK' ? HOLIDAY_NAMES_HK : HOLIDAY_NAMES_US;

  return holidays.map(mmdd => ({
    date: `${year}-${mmdd}`,
    name: nameMap[mmdd],
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 获取市场名称（中文）
 */
export function getMarketName(market: Market): string {
  switch (market) {
    case 'A': return 'A股';
    case 'HK': return '港股';
    case 'US': return '美股';
    default: return market;
  }
}

/**
 * 获取市场阶段名称（中文）
 */
export function getPhaseName(phase: MarketPhase): string {
  switch (phase) {
    case 'pre_market': return '盘前';
    case 'open': return '交易中';
    case 'lunch_break': return '午休';
    case 'closing_auction': return '收盘竞价';
    case 'after_hours': return '盘后';
    case 'closed': return '休市';
    default: return phase;
  }
}

/** 导出格式化工具供外部使用 */
export { toYYYYMMDD, toMMDD };
