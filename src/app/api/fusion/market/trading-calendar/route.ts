import { NextRequest, NextResponse } from 'next/server';
import {
  isTradingDay,
  getMarketPhase,
  getNextTradingDay,
  getTradingDays,
  getHolidaysForYear,
  getTradingDayInfo,
  toYYYYMMDD,
  getMarketName,
  getPhaseName,
  type Market,
} from '@/lib/trading-calendar';

/**
 * GET /api/fusion/market/trading-calendar
 * 
 * 参数:
 *   date: 日期字符串 (YYYY-MM-DD)，默认今天
 *   market: 市场代码 (A/HK/US)，默认 A
 *   action: 操作类型
 *     - info (默认): 获取指定日期的交易日信息
 *     - range: 获取日期范围内的交易日列表 (需要 start & end 参数)
 *     - holidays: 获取指定年份的节假日列表
 *     - multi_market: 获取同一日期在多个市场的信息
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const dateStr = searchParams.get('date');
    const market = (searchParams.get('market') || 'A') as Market;
    const action = searchParams.get('action') || 'info';

    // 验证市场代码
    if (!['A', 'HK', 'US'].includes(market)) {
      return NextResponse.json(
        { error: '无效的市场代码，支持: A (A股), HK (港股), US (美股)' },
        { status: 400 }
      );
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();

    switch (action) {
      case 'info': {
        // 获取单个日期的完整交易日信息
        const info = getTradingDayInfo(targetDate, market);
        return NextResponse.json({
          date: toYYYYMMDD(info.date),
          market,
          marketName: getMarketName(market),
          isTradingDay: info.isTradingDay,
          marketPhase: info.marketPhase,
          marketPhaseName: getPhaseName(info.marketPhase),
          nextTradingDay: info.nextTradingDay ? toYYYYMMDD(info.nextTradingDay) : null,
          holidayName: info.holidayName,
        });
      }

      case 'range': {
        // 获取日期范围内的交易日列表
        const startStr = searchParams.get('start');
        const endStr = searchParams.get('end');

        if (!startStr || !endStr) {
          return NextResponse.json(
            { error: 'range 操作需要 start 和 end 参数 (YYYY-MM-DD)' },
            { status: 400 }
          );
        }

        const start = new Date(startStr);
        const end = new Date(endStr);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return NextResponse.json(
            { error: '无效的日期格式' },
            { status: 400 }
          );
        }

        const tradingDays = getTradingDays(start, end, market);
        return NextResponse.json({
          market,
          marketName: getMarketName(market),
          start: toYYYYMMDD(start),
          end: toYYYYMMDD(end),
          totalDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
          tradingDayCount: tradingDays.length,
          tradingDays: tradingDays.map(d => toYYYYMMDD(d)),
        });
      }

      case 'holidays': {
        // 获取指定年份的节假日列表
        const year = parseInt(searchParams.get('year') || String(targetDate.getFullYear()), 10);
        const holidays = getHolidaysForYear(year, market);
        return NextResponse.json({
          market,
          marketName: getMarketName(market),
          year,
          holidayCount: holidays.length,
          holidays,
        });
      }

      case 'multi_market': {
        // 获取同一日期在多个市场的信息
        const markets: Market[] = ['A', 'HK', 'US'];
        const results = markets.map(m => {
          const info = getTradingDayInfo(targetDate, m);
          return {
            market: m,
            marketName: getMarketName(m),
            isTradingDay: info.isTradingDay,
            marketPhase: info.marketPhase,
            marketPhaseName: getPhaseName(info.marketPhase),
            nextTradingDay: info.nextTradingDay ? toYYYYMMDD(info.nextTradingDay) : null,
            holidayName: info.holidayName,
          };
        });

        return NextResponse.json({
          date: toYYYYMMDD(targetDate),
          markets: results,
        });
      }

      default:
        return NextResponse.json(
          { error: `未知的操作类型: ${action}，支持: info, range, holidays, multi_market` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[fusion/market/trading-calendar] GET error:', error);
    return NextResponse.json(
      { error: '获取交易日历失败' },
      { status: 500 }
    );
  }
}
