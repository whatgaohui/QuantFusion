/**
 * Stock symbol-to-name mapping utility
 * Used for matching news articles to watchlist stocks by company name,
 * not just symbol. E.g., an article mentioning "Apple" should match AAPL.
 */

/** US Stock symbol → company name (common aliases) */
const US_STOCK_NAMES: Record<string, string[]> = {
  AAPL: ['Apple', 'Apple Inc'],
  MSFT: ['Microsoft', 'Microsoft Corp'],
  GOOGL: ['Google', 'Alphabet', 'Alphabet Inc'],
  GOOG: ['Google', 'Alphabet', 'Alphabet Inc'],
  AMZN: ['Amazon', 'Amazon.com'],
  NVDA: ['NVIDIA', 'Nvidia', 'Nvidia Corp'],
  META: ['Meta', 'Meta Platforms', 'Facebook'],
  TSLA: ['Tesla', 'Tesla Inc', 'Tesla Motors'],
  BRK: ['Berkshire Hathaway'],
  BRK_B: ['Berkshire Hathaway'],
  JPM: ['JPMorgan', 'JPMorgan Chase'],
  V: ['Visa', 'Visa Inc'],
  JNJ: ['Johnson & Johnson', 'J&J'],
  WMT: ['Walmart', 'Wal-Mart'],
  MA: ['Mastercard'],
  PG: ['Procter & Gamble', 'P&G'],
  UNH: ['UnitedHealth', 'UnitedHealth Group'],
  HD: ['Home Depot', 'The Home Depot'],
  DIS: ['Disney', 'Walt Disney'],
  BAC: ['Bank of America', 'BofA'],
  XOM: ['Exxon', 'ExxonMobil', 'Exxon Mobil'],
  PFE: ['Pfizer'],
  KO: ['Coca-Cola', 'Coke'],
  PEP: ['PepsiCo', 'Pepsi'],
  CSCO: ['Cisco', 'Cisco Systems'],
  ADBE: ['Adobe', 'Adobe Inc'],
  CRM: ['Salesforce', 'Salesforce.com'],
  NFLX: ['Netflix'],
  INTC: ['Intel', 'Intel Corp'],
  AMD: ['AMD', 'Advanced Micro Devices'],
  PYPL: ['PayPal', 'PayPal Holdings'],
  BA: ['Boeing', 'Boeing Co'],
  GS: ['Goldman Sachs'],
  MS: ['Morgan Stanley'],
  C: ['Citigroup', 'Citi'],
  UBER: ['Uber', 'Uber Technologies'],
  COIN: ['Coinbase', 'Coinbase Global'],
  SQ: ['Block', 'Square', 'Block Inc'],
  SNOW: ['Snowflake'],
  PLTR: ['Palantir', 'Palantir Technologies'],
  RIVN: ['Rivian', 'Rivian Automotive'],
  NIO: ['NIO', 'NIO Inc'],
  LI: ['Li Auto', 'Li Auto Inc'],
  XPEV: ['XPeng', 'XPeng Inc'],
  BABA: ['Alibaba', 'Alibaba Group'],
  JD: ['JD.com', 'JD', 'Jingdong'],
  PDD: ['Pinduoduo', 'PDD Holdings', 'Temu'],
  TME: ['Tencent Music'],
  BIDU: ['Baidu', 'Baidu Inc'],
  NTES: ['NetEase'],
  TSM: ['TSMC', 'Taiwan Semiconductor'],
  ASML: ['ASML', 'ASML Holding'],
  ARM: ['ARM', 'ARM Holdings'],
  SMCI: ['Super Micro', 'Supermicro', 'Super Micro Computer'],
  MSTR: ['MicroStrategy'],
  DECK: ['Deckers', 'Deckers Outdoor'],
  MCD: ['McDonald\'s', 'McDonalds'],
  NKE: ['Nike'],
  ABNB: ['Airbnb'],
  RBLX: ['Roblox'],
  CRWD: ['CrowdStrike'],
  PANW: ['Palo Alto Networks'],
  ZS: ['Zscaler'],
  DASH: ['DoorDash'],
  ROKU: ['Roku'],
  SPOT: ['Spotify'],
  SHOP: ['Shopify'],
  SE: ['Sea Ltd', 'Sea Limited'],
  GRAB: ['Grab', 'Grab Holdings'],
  SONY: ['Sony', 'Sony Group'],
  TM: ['Toyota', 'Toyota Motor'],
  HMC: ['Honda', 'Honda Motor'],
  SHEL: ['Shell', 'Shell plc'],
  BP: ['BP', 'BP plc'],
  TOT: ['TotalEnergies', 'Total'],
};

/** A股代码 → 公司名 (常见) */
const A_SHARE_NAMES: Record<string, string[]> = {
  '600519': ['贵州茅台', '茅台'],
  '000858': ['五粮液'],
  '600036': ['招商银行'],
  '601318': ['中国平安', '平安'],
  '000333': ['美的集团', '美的'],
  '600690': ['海尔智家', '海尔'],
  '002594': ['比亚迪', 'BYD'],
  '300750': ['宁德时代', '宁德'],
  '688981': ['中芯国际', 'SMIC'],
  '002371': ['北方华创'],
  '600900': ['长江电力'],
  '601012': ['隆基绿能', '隆基'],
  '300059': ['东方财富'],
  '002475': ['立讯精密'],
  '600276': ['恒瑞医药', '恒瑞'],
  '000651': ['格力电器', '格力'],
  '601888': ['中国中免', '中免'],
  '600809': ['山西汾酒', '汾酒'],
  '000568': ['泸州老窖'],
  '601398': ['工商银行', '工行'],
  '600028': ['中国石化', '石化'],
  '601857': ['中国石油', '中石油'],
  '600030': ['中信证券'],
  '601166': ['兴业银行'],
  '600000': ['浦发银行'],
  '601288': ['农业银行', '农行'],
  '601939': ['建设银行', '建行'],
  '601328': ['交通银行', '交行'],
  '002714': ['牧原股份', '牧原'],
  '300015': ['爱尔眼科'],
  '688111': ['金山办公'],
  '300760': ['迈瑞医疗', '迈瑞'],
  '002415': ['海康威视', '海康'],
  '600887': ['伊利股份', '伊利'],
  '000001': ['平安银行'],
  '002230': ['科大讯飞'],
  '300124': ['汇川技术'],
  '688012': ['中微公司'],
  '601688': ['华泰证券'],
  '002049': ['紫光国微'],
  '300308': ['中际旭创'],
  '688036': ['传音控股'],
  '600570': ['恒生电子'],
  '002460': ['赣锋锂业', '赣锋锂'],
  '300014': ['亿纬锂能'],
  '688599': ['天合光能'],
  '601799': ['星宇股份'],
  '688005': ['容百科技'],
  '688006': ['杭可科技'],
};

/** 港股代码 → 公司名 */
const HK_STOCK_NAMES: Record<string, string[]> = {
  '0700': ['腾讯', 'Tencent', '腾讯控股'],
  '9988': ['阿里巴巴', 'Alibaba', '阿里'],
  '9618': ['京东', 'JD.com', '京东集团'],
  '3690': ['美团', 'Meituan'],
  '1024': ['快手', 'Kuaishou'],
  '9999': ['网易', 'NetEase'],
  '9868': ['小鹏汽车', 'XPeng'],
  '9866': ['蔚来', 'NIO'],
  '2015': ['理想汽车', 'Li Auto'],
  '1810': ['小米', 'Xiaomi', '小米集团'],
  '0267': ['中信股份'],
  '0883': ['中海油', 'CNOOC'],
  '0941': ['中国移动', 'China Mobile'],
  '0728': ['中国电信', 'China Telecom'],
  '0762': ['中国联通', 'China Unicom'],
  '2318': ['中国平安', 'Ping An'],
  '2628': ['中国人寿', 'China Life'],
  '1288': ['农业银行'],
  '3988': ['中国银行'],
  '1398': ['工商银行'],
  '0939': ['建设银行'],
  '0005': ['汇丰', 'HSBC', '汇丰控股'],
  '1299': ['友邦保险', 'AIA'],
  '0016': ['新鸿基', 'Sun Hung Kai'],
  '0001': ['长和', 'CK Hutchison'],
  '0002': ['中电控股', 'CLP Holdings'],
  '0003': ['香港中华煤气'],
  '0011': ['恒生银行', 'Hang Seng Bank'],
  '0012': ['恒基兆业'],
  '0017': ['新世界发展'],
  '0066': ['港铁', 'MTR'],
  '0175': ['吉利汽车', 'Geely'],
  '1211': ['比亚迪', 'BYD'],
  '0388': ['港交所', 'HKEX'],
  '2020': ['安踏', 'ANTA'],
  '1876': ['百威亚太', 'Budweiser'],
  '9626': ['哔哩哔哩', 'Bilibili', 'B站'],
  '9901': ['新东方', 'New Oriental'],
  '9888': ['百度', 'Baidu'],
  '6690': ['海尔智家'],
  '0241': ['阿里健康'],
  '6060': ['众安在线'],
};

/** 合并所有映射 */
const ALL_STOCK_NAMES: Record<string, string[]> = {
  ...US_STOCK_NAMES,
  ...A_SHARE_NAMES,
  ...HK_STOCK_NAMES,
};

/**
 * 获取股票代码对应的公司名/别名列表
 */
export function getCompanyNames(symbol: string): string[] {
  return ALL_STOCK_NAMES[symbol.toUpperCase()] || [];
}

/**
 * 获取所有已知的股票代码
 */
export function getAllKnownSymbols(): string[] {
  return Object.keys(ALL_STOCK_NAMES);
}

/**
 * 检查文本中是否包含与指定股票代码相关的关键词
 * 同时匹配代码本身和公司名/别名
 */
export function isTextRelatedToSymbol(text: string, symbol: string): boolean {
  const upper = symbol.toUpperCase();
  const upperText = text.toUpperCase();

  // 直接匹配代码
  if (upperText.includes(upper)) return true;

  // 匹配公司名/别名（不区分大小写）
  const names = getCompanyNames(symbol);
  for (const name of names) {
    if (name.length >= 2 && upperText.includes(name.toUpperCase())) return true;
  }

  return false;
}

/**
 * 从文本中找出所有相关的股票代码
 * @param text 要搜索的文本
 * @param symbols 候选股票代码列表
 * @returns 匹配到的股票代码列表
 */
export function findRelatedSymbols(text: string, symbols: string[]): string[] {
  const upperText = text.toUpperCase();
  const related: string[] = [];

  for (const symbol of symbols) {
    const upper = symbol.toUpperCase();

    // 直接匹配代码
    if (upperText.includes(upper)) {
      related.push(symbol);
      continue;
    }

    // 匹配公司名/别名
    const names = getCompanyNames(symbol);
    for (const name of names) {
      if (name.length >= 2 && upperText.includes(name.toUpperCase())) {
        related.push(symbol);
        break;
      }
    }
  }

  return related;
}

/**
 * 获取股票代码的主要公司名（第一个别名）
 */
export function getPrimaryCompanyName(symbol: string): string | null {
  const names = getCompanyNames(symbol);
  return names.length > 0 ? names[0] : null;
}
