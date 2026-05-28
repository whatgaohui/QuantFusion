/**
 * Mock data definitions for QuantFusion Data Service
 * A-share stocks, HK stocks, US stock names, US indices, and price/kline generators
 */

// ==================== A-Share Mock Data ====================

export interface AShareStockDef {
  name: string;
  basePrice: number;
  sector: string;
}

export const A_SHARE_STOCKS: Record<string, AShareStockDef> = {
  'SH600519': { name: '贵州茅台', basePrice: 1688.50, sector: '白酒' },
  'SH601318': { name: '中国平安', basePrice: 48.35, sector: '保险' },
  'SZ000001': { name: '平安银行', basePrice: 12.68, sector: '银行' },
  'SH600036': { name: '招商银行', basePrice: 35.42, sector: '银行' },
  'SZ000858': { name: '五粮液', basePrice: 148.90, sector: '白酒' },
  'SH601398': { name: '工商银行', basePrice: 5.48, sector: '银行' },
  'SH600276': { name: '恒瑞医药', basePrice: 45.20, sector: '医药' },
  'SZ002714': { name: '牧原股份', basePrice: 38.65, sector: '农业' },
  'SH600030': { name: '中信证券', basePrice: 22.15, sector: '证券' },
  'SH601012': { name: '隆基绿能', basePrice: 18.90, sector: '新能源' },
  'SZ300750': { name: '宁德时代', basePrice: 178.50, sector: '新能源' },
  'SH600900': { name: '长江电力', basePrice: 28.75, sector: '电力' },
  'SZ000333': { name: '美的集团', basePrice: 62.30, sector: '家电' },
  'SH601888': { name: '中国中免', basePrice: 78.40, sector: '旅游' },
  'SH600809': { name: '山西汾酒', basePrice: 218.60, sector: '白酒' },
  'SZ002475': { name: '立讯精密', basePrice: 33.80, sector: '电子' },
  'SH601899': { name: '紫金矿业', basePrice: 15.20, sector: '矿业' },
  'SZ000568': { name: '泸州老窖', basePrice: 168.30, sector: '白酒' },
  // Indices
  'SH000001': { name: '上证指数', basePrice: 3268.50, sector: '指数' },
  'SZ399001': { name: '深证成指', basePrice: 10456.80, sector: '指数' },
  'SZ399006': { name: '创业板指', basePrice: 2089.30, sector: '指数' },
};

// ==================== HK Market Mock Data ====================

export interface HKStockDef {
  name: string;
  basePrice: number;
  sector: string;
}

export const HK_STOCKS: Record<string, HKStockDef> = {
  'HK00700': { name: '腾讯控股', basePrice: 378.40, sector: '互联网' },
  'HK09988': { name: '阿里巴巴', basePrice: 82.65, sector: '互联网' },
  'HK03690': { name: '美团', basePrice: 128.50, sector: '互联网' },
  'HK00005': { name: '汇丰控股', basePrice: 68.35, sector: '银行' },
  'HK00941': { name: '中国移动', basePrice: 72.80, sector: '通信' },
  'HK01299': { name: '友邦保险', basePrice: 58.90, sector: '保险' },
  'HK00001': { name: '长和', basePrice: 48.25, sector: '综合企业' },
  'HK02318': { name: '中国平安H', basePrice: 38.60, sector: '保险' },
  'HK01810': { name: '小米集团', basePrice: 18.95, sector: '科技' },
  'HK09618': { name: '京东集团', basePrice: 128.30, sector: '电商' },
  'HK09888': { name: '百度集团', basePrice: 88.50, sector: '科技' },
  'HK02015': { name: '理想汽车', basePrice: 98.40, sector: '汽车' },
  'HK09868': { name: '小鹏汽车', basePrice: 42.80, sector: '汽车' },
  'HK02018': { name: '瑞声科技', basePrice: 32.15, sector: '电子' },
  'HSI': { name: '恒生指数', basePrice: 19632.50, sector: '指数' },
};

// ==================== US Stock Names ====================

export const US_STOCK_NAMES: Record<string, string> = {
  'AAPL': 'Apple Inc.',
  'GOOGL': 'Alphabet Inc.',
  'MSFT': 'Microsoft Corp.',
  'AMZN': 'Amazon.com Inc.',
  'NVDA': 'NVIDIA Corp.',
  'META': 'Meta Platforms',
  'TSLA': 'Tesla Inc.',
  'BRK.B': 'Berkshire Hathaway',
  'JPM': 'JPMorgan Chase',
  'V': 'Visa Inc.',
  'JNJ': 'Johnson & Johnson',
  'WMT': 'Walmart Inc.',
  'PG': 'Procter & Gamble',
  'MA': 'Mastercard Inc.',
  'HD': 'Home Depot Inc.',
  'UNH': 'UnitedHealth Group',
  'DIS': 'Walt Disney Co.',
  'NFLX': 'Netflix Inc.',
  'PYPL': 'PayPal Holdings',
  'INTC': 'Intel Corp.',
  'CSCO': 'Cisco Systems',
  'PFE': 'Pfizer Inc.',
  'BA': 'Boeing Co.',
  'GS': 'Goldman Sachs',
  'AMD': 'Advanced Micro Devices',
  'CRM': 'Salesforce Inc.',
  'ORCL': 'Oracle Corp.',
  'QCOM': 'Qualcomm Inc.',
  'COST': 'Costco Wholesale',
  'ADBE': 'Adobe Inc.',
};

// ==================== US Index Fallback Data ====================

export const US_INDICES: Record<string, { name: string; basePrice: number }> = {
  '^GSPC': { name: 'S&P 500', basePrice: 5942.17 },
  '^IXIC': { name: 'NASDAQ', basePrice: 19687.54 },
  '^DJI': { name: 'DOW JONES', basePrice: 42342.18 },
};

// ==================== Helper: Random Price Movement ====================

export function generateRandomPrice(basePrice: number): {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
} {
  const changePercent = (Math.random() - 0.48) * 6; // ±3% with slight upward bias
  const change = basePrice * (changePercent / 100);
  const currentPrice = basePrice + change;
  const prevClose = basePrice;
  const open = basePrice + (Math.random() - 0.5) * basePrice * 0.01;
  const high = Math.max(currentPrice, open) + Math.random() * basePrice * 0.008;
  const low = Math.min(currentPrice, open) - Math.random() * basePrice * 0.008;
  const volume = Math.floor(10000000 + Math.random() * 90000000);

  return {
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    open: parseFloat(open.toFixed(2)),
    prevClose: parseFloat(prevClose.toFixed(2)),
    volume,
  };
}

// ==================== Helper: Generate Kline Mock Data ====================

export function generateMockKline(basePrice: number, count: number): {
  c: number[]; h: number[]; l: number[]; o: number[]; v: number[]; t: number[];
} {
  const c: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const o: number[] = [];
  const v: number[] = [];
  const t: number[] = [];

  let price = basePrice * (0.85 + Math.random() * 0.1);
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * daySeconds;
    const drift = (basePrice - price) / (count - i) * 0.3;
    const volatility = price * 0.02;
    const change = drift + (Math.random() - 0.5) * volatility;

    const openPrice = parseFloat(price.toFixed(2));
    const closePrice = parseFloat((price + change).toFixed(2));
    const highPrice = parseFloat((Math.max(openPrice, closePrice) + Math.random() * volatility * 0.5).toFixed(2));
    const lowPrice = parseFloat((Math.min(openPrice, closePrice) - Math.random() * volatility * 0.5).toFixed(2));
    const volume = Math.floor(20000000 + Math.random() * 80000000);

    o.push(openPrice);
    c.push(closePrice);
    h.push(highPrice);
    l.push(lowPrice);
    v.push(volume);
    t.push(timestamp);

    price = closePrice;
  }

  return { c, h, l, o, v, t };
}
