import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

/**
 * Local Chinese A-Share ETF database for search fallback.
 * Finnhub doesn't support A-share ETFs, so we maintain a local database.
 */
const CN_ETF_DB: Array<{
  symbol: string;
  name: string;
  category: string;
  expenseRatio: number;
  trackingIndex: string;
}> = [
  // 宽基 (Broad Market)
  { symbol: '510050', name: '华夏上证50ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '上证50指数' },
  { symbol: '510300', name: '华泰柏瑞沪深300ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '沪深300指数' },
  { symbol: '510500', name: '华夏中证500ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '中证500指数' },
  { symbol: '159919', name: '嘉实沪深300ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '沪深300指数' },
  { symbol: '512100', name: '南方中证1000ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '中证1000指数' },
  { symbol: '588000', name: '华夏科创50ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '科创50指数' },
  { symbol: '159915', name: '易方达创业板ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '创业板指数' },
  { symbol: '510060', name: '华夏上证50ETF联接', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '上证50指数' },
  { symbol: '510330', name: '华夏沪深300ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '沪深300指数' },
  { symbol: '159901', name: '易方达深证100ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '深证100指数' },
  { symbol: '512980', name: '国泰中证传媒ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '中证传媒指数' },
  { symbol: '560010', name: '易方达中证红利ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '中证红利指数' },
  { symbol: '512690', name: '国泰中证白酒ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证白酒指数' },
  { symbol: '515000', name: '富国中证科技100ETF', category: 'broad_market', expenseRatio: 0.50, trackingIndex: '中证科技100指数' },

  // 跨境 (Cross-border / International)
  { symbol: '513500', name: '博时标普500ETF', category: 'international', expenseRatio: 0.60, trackingIndex: 'S&P 500' },
  { symbol: '513100', name: '国泰纳斯达克100ETF', category: 'international', expenseRatio: 0.80, trackingIndex: 'NASDAQ-100' },
  { symbol: '513300', name: '华夏沪深300ETF', category: 'international', expenseRatio: 0.50, trackingIndex: '沪深300指数' },
  { symbol: '513550', name: '博时标普500ETF联接A', category: 'international', expenseRatio: 0.60, trackingIndex: 'S&P 500' },
  { symbol: '513030', name: '华安德国DAX ETF', category: 'international', expenseRatio: 0.80, trackingIndex: 'DAX指数' },
  { symbol: '513060', name: '华夏恒生ETF', category: 'international', expenseRatio: 0.60, trackingIndex: '恒生指数' },
  { symbol: '513080', name: '易方达日兴资管日经225ETF', category: 'international', expenseRatio: 0.90, trackingIndex: '日经225' },
  { symbol: '513520', name: '博时纳斯达克100ETF', category: 'international', expenseRatio: 0.80, trackingIndex: 'NASDAQ-100' },
  { symbol: '513050', name: '易方达中证海外中国互联网50ETF', category: 'international', expenseRatio: 0.70, trackingIndex: '中证海外中国互联网50指数' },
  { symbol: '164906', name: '交银中证海外中国互联网指数', category: 'international', expenseRatio: 0.80, trackingIndex: '中证海外中国互联网指数' },
  { symbol: '513000', name: '博时标普500ETF联接', category: 'international', expenseRatio: 0.60, trackingIndex: 'S&P 500' },
  { symbol: '513660', name: '华安恒生科技ETF', category: 'international', expenseRatio: 0.70, trackingIndex: '恒生科技指数' },
  { symbol: '513690', name: '华夏恒生互联网科技业ETF', category: 'international', expenseRatio: 0.70, trackingIndex: '恒生互联网科技业指数' },
  { symbol: '159920', name: '华夏恒生ETF', category: 'international', expenseRatio: 0.60, trackingIndex: '恒生指数' },

  // 行业 (Sector)
  { symbol: '512480', name: '国联安半导体ETF', category: 'sector', expenseRatio: 0.95, trackingIndex: '中证全指半导体' },
  { symbol: '512660', name: '国泰军工ETF', category: 'sector', expenseRatio: 0.60, trackingIndex: '中证军工指数' },
  { symbol: '512170', name: '华宝医疗ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证医疗指数' },
  { symbol: '512800', name: '南方银行ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证银行指数' },
  { symbol: '515030', name: '华夏新能源车ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证新能源车指数' },
  { symbol: '515790', name: '华泰柏瑞光伏ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证光伏产业指数' },
  { symbol: '159869', name: '华夏游戏ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证动漫游戏指数' },
  { symbol: '512200', name: '南方房地产ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证房地产指数' },
  { symbol: '515050', name: '华夏5GETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证5G通信主题指数' },
  { symbol: '512010', name: '国泰医药ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证医药卫生指数' },
  { symbol: '512760', name: '国泰CES半导体芯片ETF', category: 'sector', expenseRatio: 0.95, trackingIndex: 'CES半导体芯片指数' },
  { symbol: '515880', name: '国泰通信ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证全指通信设备指数' },
  { symbol: '512690', name: '国泰中证白酒ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证白酒指数' },
  { symbol: '512980', name: '国泰中证传媒ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证传媒指数' },
  { symbol: '516160', name: '华夏新能源ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证新能源指数' },
  { symbol: '512400', name: '华宝有色金属ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证有色金属指数' },
  { symbol: '159995', name: '华夏国证半导体芯片ETF', category: 'sector', expenseRatio: 0.95, trackingIndex: '国证半导体芯片指数' },
  { symbol: '512070', name: '易方达非银ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证800非银行金融指数' },
  { symbol: '512950', name: '广发中证基建工程ETF', category: 'sector', expenseRatio: 0.50, trackingIndex: '中证基建工程指数' },

  // 债券 (Bond)
  { symbol: '511010', name: '国泰上证5年期国债ETF', category: 'bond', expenseRatio: 0.30, trackingIndex: '上证5年期国债指数' },
  { symbol: '511260', name: '国泰上证10年期国债ETF', category: 'bond', expenseRatio: 0.30, trackingIndex: '上证10年期国债指数' },
  { symbol: '511220', name: '博时中债0-3年国开行ETF', category: 'bond', expenseRatio: 0.20, trackingIndex: '中债0-3年国开行债券指数' },
  { symbol: '511360', name: '平安中债0-5年广东省地方债ETF', category: 'bond', expenseRatio: 0.25, trackingIndex: '中债0-5年广东省地方债指数' },

  // 商品 (Commodity)
  { symbol: '518880', name: '华安黄金ETF', category: 'commodity', expenseRatio: 0.50, trackingIndex: '黄金现货' },
  { symbol: '518800', name: '国泰黄金ETF', category: 'commodity', expenseRatio: 0.50, trackingIndex: '黄金现货' },
  { symbol: '159985', name: '博时黄金ETF', category: 'commodity', expenseRatio: 0.50, trackingIndex: '黄金现货' },
  { symbol: '516150', name: '华夏白银ETF', category: 'commodity', expenseRatio: 0.50, trackingIndex: '上海银价' },
];

/**
 * Check if a query string looks like a Chinese ETF code pattern.
 * Chinese A-share ETF symbols are 6-digit numbers like 510xxx, 512xxx, 513xxx,
 * 159xxx, 511xxx, 515xxx, 518xxx, 588xxx, 516xxx.
 */
function isChineseEtfPattern(query: string): boolean {
  return /^\d{4,6}$/.test(query);
}

/**
 * GET /api/etf/search?q=SPY
 * Search for ETFs by name, symbol, or category.
 * For Chinese ETFs, uses local CN_ETF_DB; for US ETFs, uses ETFProfile DB + Finnhub.
 * Returns array of { symbol, name, category, expenseRatio, trackingIndex }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    const query = q.trim().toLowerCase();
    const results: Array<{
      symbol: string;
      name: string;
      category: string | null;
      expenseRatio: number | null;
      trackingIndex: string | null;
    }> = [];
    const existingSymbols = new Set<string>();

    // 1. Search local CN_ETF_DB for Chinese ETFs (always, for any query)
    for (const etf of CN_ETF_DB) {
      const symbolMatch = etf.symbol.toLowerCase().includes(query);
      const nameMatch = etf.name.toLowerCase().includes(query);
      const categoryMatch = etf.category.toLowerCase().includes(query);
      const trackingIndexMatch = etf.trackingIndex.toLowerCase().includes(query);

      if (symbolMatch || nameMatch || categoryMatch || trackingIndexMatch) {
        results.push({
          symbol: etf.symbol,
          name: etf.name,
          category: etf.category,
          expenseRatio: etf.expenseRatio,
          trackingIndex: etf.trackingIndex,
        });
        existingSymbols.add(etf.symbol.toUpperCase());
      }
    }

    // 2. Search the ETFProfile database
    const dbResults = await db.eTFProfile.findMany({
      where: {
        OR: [
          { symbol: { contains: query } },
          { name: { contains: query } },
          { category: { contains: query } },
          { trackingIndex: { contains: query } },
        ],
      },
      take: 20,
    });

    for (const etf of dbResults) {
      if (!existingSymbols.has(etf.symbol.toUpperCase())) {
        results.push({
          symbol: etf.symbol,
          name: etf.name,
          category: etf.category,
          expenseRatio: etf.expenseRatio,
          trackingIndex: etf.trackingIndex,
        });
        existingSymbols.add(etf.symbol.toUpperCase());
      }
    }

    // 3. Use Finnhub API for additional results (if key available and query is NOT a Chinese ETF pattern)
    // Finnhub doesn't support Chinese ETFs, so skip for 6-digit queries
    if (!isChineseEtfPattern(query)) {
      const finnhubApiKey = await getFinnhubApiKey();
      if (finnhubApiKey) {
        try {
          const finnhubResponse = await fetch(
            `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${finnhubApiKey}`
          );

          if (finnhubResponse.ok) {
            const data = await finnhubResponse.json();
            const finnhubResults = (data.result || [])
              .filter((item: Record<string, string>) => {
                // Filter for ETFs only - Finnhub type field or symbol patterns
                const type = (item.type || '').toLowerCase();
                const desc = (item.description || '').toLowerCase();
                return (
                  type.includes('etf') ||
                  desc.includes('etf') ||
                  desc.includes('trust') ||
                  desc.includes('index')
                );
              })
              .map((item: Record<string, string>) => ({
                symbol: item.symbol,
                name: item.description || item.symbol,
                category: null,
                expenseRatio: null,
                trackingIndex: null,
              }));

            // Add Finnhub results that aren't already in our list (deduplicate by symbol)
            for (const item of finnhubResults) {
              if (!existingSymbols.has(item.symbol.toUpperCase())) {
                results.push(item);
                existingSymbols.add(item.symbol.toUpperCase());
              }
            }
          }
        } catch (error) {
          console.error('Finnhub ETF search error:', error);
          // Continue with database results only
        }
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('ETF search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search ETFs' },
      { status: 500 }
    );
  }
}
