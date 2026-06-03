/**
 * QuantFusion Stock Universe
 *
 * Comprehensive stock universe for signal scanning, covering US, HK, and A-share markets.
 * Symbols use Finnhub-compatible format:
 *   - US: plain ticker (e.g. 'AAPL')
 *   - HK: number with .HK suffix (e.g. '0700.HK')
 *   - A-share: number with .SS (Shanghai) or .SZ (Shenzhen) suffix (e.g. '600519.SS')
 *
 * Each entry includes a `displaySymbol` for UI display (short form without exchange suffix).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StockMarket = 'US' | 'HK' | 'A';

export interface StockInfo {
  /** Finnhub-compatible symbol (with exchange suffix for HK / A-share) */
  symbol: string;
  /** Human-readable company name (Chinese for HK / A-share, English for US) */
  name: string;
  /** Market the stock belongs to */
  market: StockMarket;
  /** Short display symbol without exchange suffix (e.g. '0700', '600519', 'AAPL') */
  displaySymbol: string;
}

// ---------------------------------------------------------------------------
// US Stocks
// ---------------------------------------------------------------------------

export const US_STOCKS: StockInfo[] = [
  { symbol: 'AAPL',   name: 'Apple',                  market: 'US', displaySymbol: 'AAPL' },
  { symbol: 'MSFT',   name: 'Microsoft',              market: 'US', displaySymbol: 'MSFT' },
  { symbol: 'GOOGL',  name: 'Alphabet',               market: 'US', displaySymbol: 'GOOGL' },
  { symbol: 'GOOG',   name: 'Alphabet',               market: 'US', displaySymbol: 'GOOG' },
  { symbol: 'AMZN',   name: 'Amazon',                 market: 'US', displaySymbol: 'AMZN' },
  { symbol: 'NVDA',   name: 'NVIDIA',                 market: 'US', displaySymbol: 'NVDA' },
  { symbol: 'META',   name: 'Meta Platforms',         market: 'US', displaySymbol: 'META' },
  { symbol: 'TSLA',   name: 'Tesla',                  market: 'US', displaySymbol: 'TSLA' },
  { symbol: 'BRK',    name: 'Berkshire Hathaway',     market: 'US', displaySymbol: 'BRK' },
  { symbol: 'BRK_B',  name: 'Berkshire Hathaway B',   market: 'US', displaySymbol: 'BRK_B' },
  { symbol: 'JPM',    name: 'JPMorgan Chase',         market: 'US', displaySymbol: 'JPM' },
  { symbol: 'V',      name: 'Visa',                   market: 'US', displaySymbol: 'V' },
  { symbol: 'JNJ',    name: 'Johnson & Johnson',      market: 'US', displaySymbol: 'JNJ' },
  { symbol: 'WMT',    name: 'Walmart',                market: 'US', displaySymbol: 'WMT' },
  { symbol: 'MA',     name: 'Mastercard',             market: 'US', displaySymbol: 'MA' },
  { symbol: 'PG',     name: 'Procter & Gamble',       market: 'US', displaySymbol: 'PG' },
  { symbol: 'UNH',    name: 'UnitedHealth Group',     market: 'US', displaySymbol: 'UNH' },
  { symbol: 'HD',     name: 'Home Depot',             market: 'US', displaySymbol: 'HD' },
  { symbol: 'DIS',    name: 'Walt Disney',            market: 'US', displaySymbol: 'DIS' },
  { symbol: 'BAC',    name: 'Bank of America',        market: 'US', displaySymbol: 'BAC' },
  { symbol: 'XOM',    name: 'ExxonMobil',             market: 'US', displaySymbol: 'XOM' },
  { symbol: 'PFE',    name: 'Pfizer',                 market: 'US', displaySymbol: 'PFE' },
  { symbol: 'KO',     name: 'Coca-Cola',              market: 'US', displaySymbol: 'KO' },
  { symbol: 'PEP',    name: 'PepsiCo',                market: 'US', displaySymbol: 'PEP' },
  { symbol: 'CSCO',   name: 'Cisco Systems',          market: 'US', displaySymbol: 'CSCO' },
  { symbol: 'ADBE',   name: 'Adobe',                  market: 'US', displaySymbol: 'ADBE' },
  { symbol: 'CRM',    name: 'Salesforce',             market: 'US', displaySymbol: 'CRM' },
  { symbol: 'NFLX',   name: 'Netflix',                market: 'US', displaySymbol: 'NFLX' },
  { symbol: 'INTC',   name: 'Intel',                  market: 'US', displaySymbol: 'INTC' },
  { symbol: 'AMD',    name: 'AMD',                    market: 'US', displaySymbol: 'AMD' },
  { symbol: 'PYPL',   name: 'PayPal',                 market: 'US', displaySymbol: 'PYPL' },
  { symbol: 'BA',     name: 'Boeing',                 market: 'US', displaySymbol: 'BA' },
  { symbol: 'GS',     name: 'Goldman Sachs',          market: 'US', displaySymbol: 'GS' },
  { symbol: 'MS',     name: 'Morgan Stanley',         market: 'US', displaySymbol: 'MS' },
  { symbol: 'C',      name: 'Citigroup',              market: 'US', displaySymbol: 'C' },
  { symbol: 'UBER',   name: 'Uber',                   market: 'US', displaySymbol: 'UBER' },
  { symbol: 'COIN',   name: 'Coinbase',               market: 'US', displaySymbol: 'COIN' },
  { symbol: 'SQ',     name: 'Block',                  market: 'US', displaySymbol: 'SQ' },
  { symbol: 'SNOW',   name: 'Snowflake',              market: 'US', displaySymbol: 'SNOW' },
  { symbol: 'PLTR',   name: 'Palantir',               market: 'US', displaySymbol: 'PLTR' },
  { symbol: 'RIVN',   name: 'Rivian',                 market: 'US', displaySymbol: 'RIVN' },
  { symbol: 'NIO',    name: 'NIO',                    market: 'US', displaySymbol: 'NIO' },
  { symbol: 'LI',     name: 'Li Auto',                market: 'US', displaySymbol: 'LI' },
  { symbol: 'XPEV',   name: 'XPeng',                  market: 'US', displaySymbol: 'XPEV' },
  { symbol: 'BABA',   name: 'Alibaba',                market: 'US', displaySymbol: 'BABA' },
  { symbol: 'JD',     name: 'JD.com',                 market: 'US', displaySymbol: 'JD' },
  { symbol: 'PDD',    name: 'Pinduoduo',              market: 'US', displaySymbol: 'PDD' },
  { symbol: 'TME',    name: 'Tencent Music',          market: 'US', displaySymbol: 'TME' },
  { symbol: 'BIDU',   name: 'Baidu',                  market: 'US', displaySymbol: 'BIDU' },
  { symbol: 'NTES',   name: 'NetEase',                market: 'US', displaySymbol: 'NTES' },
  { symbol: 'TSM',    name: 'TSMC',                   market: 'US', displaySymbol: 'TSM' },
  { symbol: 'ASML',   name: 'ASML',                   market: 'US', displaySymbol: 'ASML' },
  { symbol: 'ARM',    name: 'ARM Holdings',           market: 'US', displaySymbol: 'ARM' },
  { symbol: 'SMCI',   name: 'Super Micro Computer',   market: 'US', displaySymbol: 'SMCI' },
  { symbol: 'MSTR',   name: 'MicroStrategy',          market: 'US', displaySymbol: 'MSTR' },
  { symbol: 'DECK',   name: 'Deckers Outdoor',        market: 'US', displaySymbol: 'DECK' },
  { symbol: 'MCD',    name: "McDonald's",             market: 'US', displaySymbol: 'MCD' },
  { symbol: 'NKE',    name: 'Nike',                   market: 'US', displaySymbol: 'NKE' },
  { symbol: 'ABNB',   name: 'Airbnb',                 market: 'US', displaySymbol: 'ABNB' },
  { symbol: 'RBLX',   name: 'Roblox',                 market: 'US', displaySymbol: 'RBLX' },
  { symbol: 'CRWD',   name: 'CrowdStrike',            market: 'US', displaySymbol: 'CRWD' },
  { symbol: 'PANW',   name: 'Palo Alto Networks',     market: 'US', displaySymbol: 'PANW' },
  { symbol: 'ZS',     name: 'Zscaler',                market: 'US', displaySymbol: 'ZS' },
  { symbol: 'DASH',   name: 'DoorDash',               market: 'US', displaySymbol: 'DASH' },
  { symbol: 'ROKU',   name: 'Roku',                   market: 'US', displaySymbol: 'ROKU' },
  { symbol: 'SPOT',   name: 'Spotify',                market: 'US', displaySymbol: 'SPOT' },
  { symbol: 'SHOP',   name: 'Shopify',                market: 'US', displaySymbol: 'SHOP' },
  { symbol: 'SE',     name: 'Sea Limited',            market: 'US', displaySymbol: 'SE' },
  { symbol: 'GRAB',   name: 'Grab',                   market: 'US', displaySymbol: 'GRAB' },
  { symbol: 'SONY',   name: 'Sony Group',             market: 'US', displaySymbol: 'SONY' },
  { symbol: 'TM',     name: 'Toyota Motor',           market: 'US', displaySymbol: 'TM' },
  { symbol: 'HMC',    name: 'Honda Motor',            market: 'US', displaySymbol: 'HMC' },
  { symbol: 'SHEL',   name: 'Shell',                  market: 'US', displaySymbol: 'SHEL' },
  { symbol: 'BP',     name: 'BP',                     market: 'US', displaySymbol: 'BP' },
  { symbol: 'TOT',    name: 'TotalEnergies',          market: 'US', displaySymbol: 'TOT' },
];

// ---------------------------------------------------------------------------
// Hong Kong Stocks
// ---------------------------------------------------------------------------

export const HK_STOCKS: StockInfo[] = [
  { symbol: '0700.HK', name: '腾讯',       market: 'HK', displaySymbol: '0700' },
  { symbol: '9988.HK', name: '阿里巴巴',   market: 'HK', displaySymbol: '9988' },
  { symbol: '9618.HK', name: '京东',       market: 'HK', displaySymbol: '9618' },
  { symbol: '3690.HK', name: '美团',       market: 'HK', displaySymbol: '3690' },
  { symbol: '1024.HK', name: '快手',       market: 'HK', displaySymbol: '1024' },
  { symbol: '9999.HK', name: '网易',       market: 'HK', displaySymbol: '9999' },
  { symbol: '9868.HK', name: '小鹏汽车',   market: 'HK', displaySymbol: '9868' },
  { symbol: '9866.HK', name: '蔚来',       market: 'HK', displaySymbol: '9866' },
  { symbol: '2015.HK', name: '理想汽车',   market: 'HK', displaySymbol: '2015' },
  { symbol: '1810.HK', name: '小米',       market: 'HK', displaySymbol: '1810' },
  { symbol: '0267.HK', name: '中信股份',   market: 'HK', displaySymbol: '0267' },
  { symbol: '0883.HK', name: '中海油',     market: 'HK', displaySymbol: '0883' },
  { symbol: '0941.HK', name: '中国移动',   market: 'HK', displaySymbol: '0941' },
  { symbol: '0728.HK', name: '中国电信',   market: 'HK', displaySymbol: '0728' },
  { symbol: '0762.HK', name: '中国联通',   market: 'HK', displaySymbol: '0762' },
  { symbol: '2318.HK', name: '中国平安',   market: 'HK', displaySymbol: '2318' },
  { symbol: '2628.HK', name: '中国人寿',   market: 'HK', displaySymbol: '2628' },
  { symbol: '1288.HK', name: '农业银行',   market: 'HK', displaySymbol: '1288' },
  { symbol: '3988.HK', name: '中国银行',   market: 'HK', displaySymbol: '3988' },
  { symbol: '1398.HK', name: '工商银行',   market: 'HK', displaySymbol: '1398' },
  { symbol: '0939.HK', name: '建设银行',   market: 'HK', displaySymbol: '0939' },
  { symbol: '0005.HK', name: '汇丰',       market: 'HK', displaySymbol: '0005' },
  { symbol: '1299.HK', name: '友邦保险',   market: 'HK', displaySymbol: '1299' },
  { symbol: '0016.HK', name: '新鸿基',     market: 'HK', displaySymbol: '0016' },
  { symbol: '0001.HK', name: '长和',       market: 'HK', displaySymbol: '0001' },
  { symbol: '0002.HK', name: '中电控股',   market: 'HK', displaySymbol: '0002' },
  { symbol: '0003.HK', name: '香港中华煤气', market: 'HK', displaySymbol: '0003' },
  { symbol: '0011.HK', name: '恒生银行',   market: 'HK', displaySymbol: '0011' },
  { symbol: '0012.HK', name: '恒基兆业',   market: 'HK', displaySymbol: '0012' },
  { symbol: '0017.HK', name: '新世界发展', market: 'HK', displaySymbol: '0017' },
  { symbol: '0066.HK', name: '港铁',       market: 'HK', displaySymbol: '0066' },
  { symbol: '0175.HK', name: '吉利汽车',   market: 'HK', displaySymbol: '0175' },
  { symbol: '1211.HK', name: '比亚迪',     market: 'HK', displaySymbol: '1211' },
  { symbol: '0388.HK', name: '港交所',     market: 'HK', displaySymbol: '0388' },
  { symbol: '2020.HK', name: '安踏',       market: 'HK', displaySymbol: '2020' },
  { symbol: '1876.HK', name: '百威亚太',   market: 'HK', displaySymbol: '1876' },
  { symbol: '9626.HK', name: '哔哩哔哩',   market: 'HK', displaySymbol: '9626' },
  { symbol: '9901.HK', name: '新东方',     market: 'HK', displaySymbol: '9901' },
  { symbol: '9888.HK', name: '百度',       market: 'HK', displaySymbol: '9888' },
  { symbol: '6690.HK', name: '海尔智家',   market: 'HK', displaySymbol: '6690' },
  { symbol: '0241.HK', name: '阿里健康',   market: 'HK', displaySymbol: '0241' },
  { symbol: '6060.HK', name: '众安在线',   market: 'HK', displaySymbol: '6060' },
];

// ---------------------------------------------------------------------------
// A-Share Stocks
// ---------------------------------------------------------------------------

export const A_SHARE_STOCKS: StockInfo[] = [
  // 白酒 & 消费
  { symbol: '600519.SS', name: '贵州茅台', market: 'A', displaySymbol: '600519' },
  { symbol: '000858.SZ', name: '五粮液',   market: 'A', displaySymbol: '000858' },
  { symbol: '600809.SS', name: '山西汾酒', market: 'A', displaySymbol: '600809' },
  { symbol: '000568.SZ', name: '泸州老窖', market: 'A', displaySymbol: '000568' },
  { symbol: '600887.SS', name: '伊利股份', market: 'A', displaySymbol: '600887' },

  // 银行 & 金融
  { symbol: '600036.SS', name: '招商银行', market: 'A', displaySymbol: '600036' },
  { symbol: '601398.SS', name: '工商银行', market: 'A', displaySymbol: '601398' },
  { symbol: '601288.SS', name: '农业银行', market: 'A', displaySymbol: '601288' },
  { symbol: '601939.SS', name: '建设银行', market: 'A', displaySymbol: '601939' },
  { symbol: '601328.SS', name: '交通银行', market: 'A', displaySymbol: '601328' },
  { symbol: '601166.SS', name: '兴业银行', market: 'A', displaySymbol: '601166' },
  { symbol: '600000.SS', name: '浦发银行', market: 'A', displaySymbol: '600000' },
  { symbol: '000001.SZ', name: '平安银行', market: 'A', displaySymbol: '000001' },
  { symbol: '600030.SS', name: '中信证券', market: 'A', displaySymbol: '600030' },
  { symbol: '601688.SS', name: '华泰证券', market: 'A', displaySymbol: '601688' },

  // 保险
  { symbol: '601318.SS', name: '中国平安', market: 'A', displaySymbol: '601318' },

  // 家电
  { symbol: '000333.SZ', name: '美的集团', market: 'A', displaySymbol: '000333' },
  { symbol: '600690.SS', name: '海尔智家', market: 'A', displaySymbol: '600690' },
  { symbol: '000651.SZ', name: '格力电器', market: 'A', displaySymbol: '000651' },

  // 新能源汽车 & 电池
  { symbol: '002594.SZ', name: '比亚迪',   market: 'A', displaySymbol: '002594' },
  { symbol: '300750.SZ', name: '宁德时代', market: 'A', displaySymbol: '300750' },
  { symbol: '300014.SZ', name: '亿纬锂能', market: 'A', displaySymbol: '300014' },
  { symbol: '002460.SZ', name: '赣锋锂业', market: 'A', displaySymbol: '002460' },

  // 半导体 & 芯片
  { symbol: '688981.SS', name: '中芯国际', market: 'A', displaySymbol: '688981' },
  { symbol: '002371.SZ', name: '北方华创', market: 'A', displaySymbol: '002371' },
  { symbol: '688012.SS', name: '中微公司', market: 'A', displaySymbol: '688012' },
  { symbol: '002049.SZ', name: '紫光国微', market: 'A', displaySymbol: '002049' },
  { symbol: '688036.SS', name: '传音控股', market: 'A', displaySymbol: '688036' },
  { symbol: '688005.SS', name: '容百科技', market: 'A', displaySymbol: '688005' },
  { symbol: '688006.SS', name: '杭可科技', market: 'A', displaySymbol: '688006' },

  // 光伏 & 新能源
  { symbol: '600900.SS', name: '长江电力', market: 'A', displaySymbol: '600900' },
  { symbol: '601012.SS', name: '隆基绿能', market: 'A', displaySymbol: '601012' },
  { symbol: '688599.SS', name: '天合光能', market: 'A', displaySymbol: '688599' },

  // 互联网 & 软件
  { symbol: '300059.SZ', name: '东方财富', market: 'A', displaySymbol: '300059' },
  { symbol: '688111.SS', name: '金山办公', market: 'A', displaySymbol: '688111' },
  { symbol: '002230.SZ', name: '科大讯飞', market: 'A', displaySymbol: '002230' },
  { symbol: '600570.SS', name: '恒生电子', market: 'A', displaySymbol: '600570' },

  // 电子 & 制造
  { symbol: '002475.SZ', name: '立讯精密', market: 'A', displaySymbol: '002475' },
  { symbol: '002415.SZ', name: '海康威视', market: 'A', displaySymbol: '002415' },
  { symbol: '300124.SZ', name: '汇川技术', market: 'A', displaySymbol: '300124' },
  { symbol: '300308.SZ', name: '中际旭创', market: 'A', displaySymbol: '300308' },

  // 医药
  { symbol: '600276.SS', name: '恒瑞医药', market: 'A', displaySymbol: '600276' },
  { symbol: '300015.SZ', name: '爱尔眼科', market: 'A', displaySymbol: '300015' },
  { symbol: '300760.SZ', name: '迈瑞医疗', market: 'A', displaySymbol: '300760' },

  // 旅游 & 免税
  { symbol: '601888.SS', name: '中国中免', market: 'A', displaySymbol: '601888' },

  // 能源 & 化工
  { symbol: '600028.SS', name: '中国石化', market: 'A', displaySymbol: '600028' },
  { symbol: '601857.SS', name: '中国石油', market: 'A', displaySymbol: '601857' },

  // 畜牧
  { symbol: '002714.SZ', name: '牧原股份', market: 'A', displaySymbol: '002714' },

  // 汽车零部件
  { symbol: '601799.SS', name: '星宇股份', market: 'A', displaySymbol: '601799' },
];

// ---------------------------------------------------------------------------
// Combined universe
// ---------------------------------------------------------------------------

export const ALL_STOCKS: StockInfo[] = [
  ...US_STOCKS,
  ...HK_STOCKS,
  ...A_SHARE_STOCKS,
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Pre-built index for O(1) symbol lookup */
const _symbolIndex = new Map<string, StockInfo>();
for (const stock of ALL_STOCKS) {
  _symbolIndex.set(stock.symbol, stock);
  // Also index by displaySymbol for convenience (HK / A-share short codes)
  if (stock.displaySymbol !== stock.symbol) {
    _symbolIndex.set(stock.displaySymbol, stock);
  }
}

/**
 * Get all stocks belonging to a specific market.
 *
 * @param market - 'US' | 'HK' | 'A'
 * @returns Array of StockInfo for that market
 */
export function getStocksByMarket(market: StockMarket): StockInfo[] {
  return ALL_STOCKS.filter((s) => s.market === market);
}

/**
 * Look up a stock by its symbol.
 *
 * Accepts either the full symbol (e.g. '0700.HK', '600519.SS', 'AAPL')
 * or the displaySymbol short form (e.g. '0700', '600519').
 *
 * @param symbol - Symbol to look up
 * @returns StockInfo if found, undefined otherwise
 */
export function getStockInfo(symbol: string): StockInfo | undefined {
  return _symbolIndex.get(symbol) ?? _symbolIndex.get(symbol.toUpperCase());
}

// ---------------------------------------------------------------------------
// Convenience re-exports
// ---------------------------------------------------------------------------

/** Total number of stocks in the universe */
export const STOCK_COUNT = ALL_STOCKS.length;

/** Markets covered by this universe */
export const MARKETS: StockMarket[] = ['US', 'HK', 'A'];

/** Market labels for display */
export const MARKET_LABELS: Record<StockMarket, string> = {
  US: '美股',
  HK: '港股',
  A: 'A股',
};
