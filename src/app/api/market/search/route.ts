import { NextRequest, NextResponse } from 'next/server';
import { getFinnhubApiKey } from '@/lib/finnhub-config';

// Comprehensive local stock database for fallback when Finnhub is unavailable
const LOCAL_STOCK_DB: Array<{ symbol: string; description: string; type: string }> = [
  // US Tech Giants
  { symbol: 'AAPL', description: 'Apple Inc.', type: 'Common Stock' },
  { symbol: 'MSFT', description: 'Microsoft Corporation', type: 'Common Stock' },
  { symbol: 'GOOGL', description: 'Alphabet Inc.', type: 'Common Stock' },
  { symbol: 'GOOG', description: 'Alphabet Inc. Class C', type: 'Common Stock' },
  { symbol: 'AMZN', description: 'Amazon.com Inc.', type: 'Common Stock' },
  { symbol: 'NVDA', description: 'NVIDIA Corporation', type: 'Common Stock' },
  { symbol: 'META', description: 'Meta Platforms Inc.', type: 'Common Stock' },
  { symbol: 'TSLA', description: 'Tesla Inc.', type: 'Common Stock' },
  { symbol: 'BRK.B', description: 'Berkshire Hathaway Inc. Class B', type: 'Common Stock' },
  { symbol: 'BRK.A', description: 'Berkshire Hathaway Inc. Class A', type: 'Common Stock' },
  { symbol: 'JPM', description: 'JPMorgan Chase & Co.', type: 'Common Stock' },
  { symbol: 'V', description: 'Visa Inc.', type: 'Common Stock' },
  { symbol: 'JNJ', description: 'Johnson & Johnson', type: 'Common Stock' },
  { symbol: 'WMT', description: 'Walmart Inc.', type: 'Common Stock' },
  { symbol: 'PG', description: 'Procter & Gamble Co.', type: 'Common Stock' },
  { symbol: 'MA', description: 'Mastercard Inc.', type: 'Common Stock' },
  { symbol: 'HD', description: 'The Home Depot Inc.', type: 'Common Stock' },
  { symbol: 'UNH', description: 'UnitedHealth Group Inc.', type: 'Common Stock' },
  { symbol: 'DIS', description: 'The Walt Disney Company', type: 'Common Stock' },
  { symbol: 'BAC', description: 'Bank of America Corp.', type: 'Common Stock' },
  { symbol: 'XOM', description: 'Exxon Mobil Corporation', type: 'Common Stock' },
  { symbol: 'PFE', description: 'Pfizer Inc.', type: 'Common Stock' },
  { symbol: 'KO', description: 'Coca-Cola Company', type: 'Common Stock' },
  { symbol: 'PEP', description: 'PepsiCo Inc.', type: 'Common Stock' },
  { symbol: 'CSCO', description: 'Cisco Systems Inc.', type: 'Common Stock' },
  { symbol: 'ADBE', description: 'Adobe Inc.', type: 'Common Stock' },
  { symbol: 'NFLX', description: 'Netflix Inc.', type: 'Common Stock' },
  { symbol: 'CRM', description: 'Salesforce Inc.', type: 'Common Stock' },
  { symbol: 'AMD', description: 'Advanced Micro Devices Inc.', type: 'Common Stock' },
  { symbol: 'INTC', description: 'Intel Corporation', type: 'Common Stock' },
  { symbol: 'QCOM', description: 'Qualcomm Inc.', type: 'Common Stock' },
  { symbol: 'PYPL', description: 'PayPal Holdings Inc.', type: 'Common Stock' },
  { symbol: 'SBUX', description: 'Starbucks Corporation', type: 'Common Stock' },
  { symbol: 'NKE', description: 'Nike Inc.', type: 'Common Stock' },
  { symbol: 'COST', description: 'Costco Wholesale Corp.', type: 'Common Stock' },
  { symbol: 'T', description: 'AT&T Inc.', type: 'Common Stock' },
  { symbol: 'VZ', description: 'Verizon Communications', type: 'Common Stock' },
  { symbol: 'MRK', description: 'Merck & Co. Inc.', type: 'Common Stock' },
  { symbol: 'ABT', description: 'Abbott Laboratories', type: 'Common Stock' },
  { symbol: 'ORCL', description: 'Oracle Corporation', type: 'Common Stock' },
  { symbol: 'IBM', description: 'International Business Machines', type: 'Common Stock' },
  { symbol: 'AVGO', description: 'Broadcom Inc.', type: 'Common Stock' },
  { symbol: 'TXN', description: 'Texas Instruments Inc.', type: 'Common Stock' },
  { symbol: 'LLY', description: 'Eli Lilly and Company', type: 'Common Stock' },
  { symbol: 'ABBV', description: 'AbbVie Inc.', type: 'Common Stock' },
  { symbol: 'CVX', description: 'Chevron Corporation', type: 'Common Stock' },
  { symbol: 'MO', description: 'Altria Group Inc.', type: 'Common Stock' },
  { symbol: 'TMO', description: 'Thermo Fisher Scientific', type: 'Common Stock' },
  { symbol: 'AXP', description: 'American Express Company', type: 'Common Stock' },
  { symbol: 'GS', description: 'Goldman Sachs Group', type: 'Common Stock' },
  { symbol: 'UBER', description: 'Uber Technologies Inc.', type: 'Common Stock' },
  { symbol: 'SQ', description: 'Block Inc.', type: 'Common Stock' },
  { symbol: 'SNAP', description: 'Snap Inc.', type: 'Common Stock' },
  { symbol: 'SHOP', description: 'Shopify Inc.', type: 'Common Stock' },
  { symbol: 'SPOT', description: 'Spotify Technology S.A.', type: 'Common Stock' },
  { symbol: 'ROKU', description: 'Roku Inc.', type: 'Common Stock' },
  { symbol: 'ZM', description: 'Zoom Video Communications', type: 'Common Stock' },
  { symbol: 'PLTR', description: 'Palantir Technologies Inc.', type: 'Common Stock' },
  { symbol: 'COIN', description: 'Coinbase Global Inc.', type: 'Common Stock' },
  { symbol: 'RIVN', description: 'Rivian Automotive Inc.', type: 'Common Stock' },
  { symbol: 'LCID', description: 'Lucid Group Inc.', type: 'Common Stock' },
  { symbol: 'SOFI', description: 'SoFi Technologies Inc.', type: 'Common Stock' },
  { symbol: 'AIR', description: 'Airbnb Inc.', type: 'Common Stock' },
  { symbol: 'ABNB', description: 'Airbnb Inc.', type: 'Common Stock' },
  { symbol: 'CRM', description: 'Salesforce Inc.', type: 'Common Stock' },
  { symbol: 'NOW', description: 'ServiceNow Inc.', type: 'Common Stock' },
  { symbol: 'SNOW', description: 'Snowflake Inc.', type: 'Common Stock' },
  { symbol: 'CRWD', description: 'CrowdStrike Holdings Inc.', type: 'Common Stock' },
  { symbol: 'PANW', description: 'Palo Alto Networks Inc.', type: 'Common Stock' },
  { symbol: 'MSTR', description: 'MicroStrategy Inc.', type: 'Common Stock' },
  // US ETFs & Index
  { symbol: 'SPY', description: 'SPDR S&P 500 ETF', type: 'ETF' },
  { symbol: 'QQQ', description: 'Invesco QQQ Trust', type: 'ETF' },
  { symbol: 'IWM', description: 'iShares Russell 2000 ETF', type: 'ETF' },
  { symbol: 'DIA', description: 'SPDR Dow Jones Industrial Average ETF', type: 'ETF' },
  { symbol: 'VTI', description: 'Vanguard Total Stock Market ETF', type: 'ETF' },
  { symbol: 'VOO', description: 'Vanguard S&P 500 ETF', type: 'ETF' },
  // A-Share Blue Chips (Shanghai/Shenzhen)
  { symbol: '600519.SS', description: '贵州茅台 Kweichow Moutai', type: 'Common Stock' },
  { symbol: '601318.SS', description: '中国平安 Ping An Insurance', type: 'Common Stock' },
  { symbol: '600036.SS', description: '招商银行 China Merchants Bank', type: 'Common Stock' },
  { symbol: '000858.SZ', description: '五粮液 Wuliangye Yibin', type: 'Common Stock' },
  { symbol: '600900.SS', description: '长江电力 China Yangtze Power', type: 'Common Stock' },
  { symbol: '601012.SS', description: '隆基绿能 LONGi Green Energy', type: 'Common Stock' },
  { symbol: '000333.SZ', description: '美的集团 Midea Group', type: 'Common Stock' },
  { symbol: '600276.SS', description: '恒瑞医药 Jiangsu Hengrui Medicine', type: 'Common Stock' },
  { symbol: '601888.SS', description: '中国中免 China Tourism Group', type: 'Common Stock' },
  { symbol: '600809.SS', description: '山西汾酒 Shanxi Fenjiu Liquor', type: 'Common Stock' },
  { symbol: '000001.SZ', description: '平安银行 Ping An Bank', type: 'Common Stock' },
  { symbol: '600000.SS', description: '浦发银行 Shanghai Pudong Dev Bank', type: 'Common Stock' },
  { symbol: '601166.SS', description: '兴业银行 Industrial Bank', type: 'Common Stock' },
  { symbol: '600030.SS', description: '中信证券 CITIC Securities', type: 'Common Stock' },
  { symbol: '000002.SZ', description: '万科A China Vanke', type: 'Common Stock' },
  { symbol: '002594.SZ', description: '比亚迪 BYD Company', type: 'Common Stock' },
  { symbol: '300750.SZ', description: '宁德时代 CATL', type: 'Common Stock' },
  { symbol: '601398.SS', description: '工商银行 ICBC', type: 'Common Stock' },
  { symbol: '601288.SS', description: '农业银行 ABC', type: 'Common Stock' },
  { symbol: '601939.SS', description: '建设银行 CCB', type: 'Common Stock' },
  { symbol: '601988.SS', description: '中国银行 Bank of China', type: 'Common Stock' },
  { symbol: '600028.SS', description: '中国石化 Sinopec', type: 'Common Stock' },
  { symbol: '601857.SS', description: '中国石油 PetroChina', type: 'Common Stock' },
  { symbol: '601668.SS', description: '中国建筑 China State Construction', type: 'Common Stock' },
  { symbol: '600585.SS', description: '海螺水泥 Anhui Conch Cement', type: 'Common Stock' },
  { symbol: '002475.SZ', description: '立讯精密 Luxshare Precision', type: 'Common Stock' },
  { symbol: '300059.SZ', description: '东方财富 East Money Info', type: 'Common Stock' },
  { symbol: '601899.SS', description: '紫金矿业 Zijin Mining', type: 'Common Stock' },
  { symbol: '600887.SS', description: '伊利股份 Inner Mongolia Yili', type: 'Common Stock' },
  { symbol: '000568.SZ', description: '泸州老窖 Luzhou Laojiao', type: 'Common Stock' },
  // HK Major Stocks
  { symbol: '0700.HK', description: '腾讯控股 Tencent Holdings', type: 'Common Stock' },
  { symbol: '9988.HK', description: '阿里巴巴 Alibaba Group', type: 'Common Stock' },
  { symbol: '9999.HK', description: '网易 NetEase', type: 'Common Stock' },
  { symbol: '3690.HK', description: '美团 Meituan', type: 'Common Stock' },
  { symbol: '9618.HK', description: '京东 JD.com', type: 'Common Stock' },
  { symbol: '9888.HK', description: '百度 Baidu Inc.', type: 'Common Stock' },
  { symbol: '1810.HK', description: '小米集团 Xiaomi Corp', type: 'Common Stock' },
  { symbol: '9868.HK', description: '小鹏汽车 XPeng Inc.', type: 'Common Stock' },
  { symbol: '9866.HK', description: '蔚来 NIO Inc.', type: 'Common Stock' },
  { symbol: '1211.HK', description: '比亚迪 BYD Company', type: 'Common Stock' },
  { symbol: '0005.HK', description: '汇丰控股 HSBC Holdings', type: 'Common Stock' },
  { symbol: '1299.HK', description: '友邦保险 AIA Group', type: 'Common Stock' },
  { symbol: '2318.HK', description: '中国平安 Ping An Insurance', type: 'Common Stock' },
  { symbol: '0388.HK', description: '香港交易所 HKEX', type: 'Common Stock' },
  { symbol: '0941.HK', description: '中国移动 China Mobile', type: 'Common Stock' },
  { symbol: '0883.HK', description: '中海油 CNOOC', type: 'Common Stock' },
  { symbol: '1398.HK', description: '工商银行 ICBC', type: 'Common Stock' },
  { symbol: '3988.HK', description: '中国银行 Bank of China', type: 'Common Stock' },
  { symbol: '2628.HK', description: '中国人寿 China Life Insurance', type: 'Common Stock' },
  { symbol: '0027.HK', description: '银河娱乐 Galaxy Entertainment', type: 'Common Stock' },
  { symbol: '1109.HK', description: '华润置地 China Resources Land', type: 'Common Stock' },
  { symbol: '0016.HK', description: '新鸿基地产 Sun Hung Kai Properties', type: 'Common Stock' },
  { symbol: '0001.HK', description: '长和 CK Hutchison', type: 'Common Stock' },
  { symbol: '2020.HK', description: '安踏体育 ANTA Sports', type: 'Common Stock' },
  { symbol: '2382.HK', description: '舜宇光学 Sunny Optical', type: 'Common Stock' },
  { symbol: '2269.HK', description: '药明生物 WuXi Biologics', type: 'Common Stock' },
  { symbol: '6862.HK', description: '海底捞 Haidilao', type: 'Common Stock' },
  { symbol: '9600.HK', description: '同程旅行 Tongcheng Travel', type: 'Common Stock' },
  { symbol: '6690.HK', description: '海尔智家 Haier Smart Home', type: 'Common Stock' },
  { symbol: '0241.HK', description: '阿里健康 Alibaba Health', type: 'Common Stock' },
];

/**
 * Fuzzy search the local stock database.
 * Matches if the query appears in symbol or description (case-insensitive).
 * Also matches Chinese characters in description.
 */
function searchLocalStocks(query: string): Array<{ symbol: string; description: string; type: string }> {
  const lowerQuery = query.toLowerCase();
  const trimmedQuery = lowerQuery.trim();

  if (!trimmedQuery) return [];

  // Score-based matching for better relevance
  const scored = LOCAL_STOCK_DB.map((stock) => {
    const lowerSymbol = stock.symbol.toLowerCase();
    const lowerDesc = stock.description.toLowerCase();

    let score = 0;

    // Exact symbol match (highest priority)
    if (lowerSymbol === trimmedQuery) score += 100;
    // Symbol starts with query
    else if (lowerSymbol.startsWith(trimmedQuery)) score += 80;
    // Symbol contains query
    else if (lowerSymbol.includes(trimmedQuery)) score += 50;
    // Description starts with query
    else if (lowerDesc.startsWith(trimmedQuery)) score += 40;
    // Description contains query
    else if (lowerDesc.includes(trimmedQuery)) score += 20;

    // Also check individual words in description
    const descWords = lowerDesc.split(/\s+/);
    for (const word of descWords) {
      if (word.startsWith(trimmedQuery)) score += 15;
      else if (word.includes(trimmedQuery)) score += 5;
    }

    return { stock, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return scored.map((item) => item.stock);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
      return NextResponse.json(
        { error: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    // If Finnhub API key is available, try it first
    const finnhubApiKey = await getFinnhubApiKey();
    if (finnhubApiKey) {
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${finnhubApiKey}`
        );

        if (response.ok) {
          const data = await response.json();

          const results = (data.result || [])
            .filter((item: Record<string, string>) => item.symbol && item.symbol.trim() !== '')
            .map((item: Record<string, string>) => ({
              symbol: item.symbol,
              description: item.description,
              type: item.type,
            }));

          // If Finnhub returns results, use them
          if (results.length > 0) {
            return NextResponse.json(results);
          }
        }
      } catch (error) {
        console.error('Finnhub search error, falling back to local:', error);
      }
    }

    // Fallback to local stock database
    const localResults = searchLocalStocks(q);
    return NextResponse.json(localResults);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search stocks' },
      { status: 500 }
    );
  }
}
