/**
 * Lightweight mock data for API routes - NO external imports
 * Used to prevent memory crashes in the sandbox environment
 */

// A-Share stocks
const A_SHARE: Record<string, {name:string;price:number}> = {
  'SH600519':{name:'贵州茅台',price:1688.50},'SH601318':{name:'中国平安',price:48.35},
  'SZ000001':{name:'平安银行',price:12.68},'SH600036':{name:'招商银行',price:35.42},
  'SZ000858':{name:'五粮液',price:148.90},'SH601398':{name:'工商银行',price:5.48},
  'SH600276':{name:'恒瑞医药',price:45.20},'SZ002714':{name:'牧原股份',price:38.65},
  'SH600030':{name:'中信证券',price:22.15},'SZ300750':{name:'宁德时代',price:178.50},
  'SH600900':{name:'长江电力',price:28.75},'SZ000333':{name:'美的集团',price:62.30},
  'SH601888':{name:'中国中免',price:78.40},'SH600809':{name:'山西汾酒',price:218.60},
  'SZ002475':{name:'立讯精密',price:33.80},'SH601899':{name:'紫金矿业',price:15.20},
  'SH000001':{name:'上证指数',price:3268.50},'SZ399001':{name:'深证成指',price:10456.80},
  'SZ399006':{name:'创业板指',price:2089.30},
};

const HK_SHARE: Record<string, {name:string;price:number}> = {
  'HK00700':{name:'腾讯控股',price:378.40},'HK09988':{name:'阿里巴巴',price:82.65},
  'HK03690':{name:'美团',price:128.50},'HK00005':{name:'汇丰控股',price:68.35},
  'HK01299':{name:'友邦保险',price:58.90},'HK01810':{name:'小米集团',price:18.95},
  'HK09618':{name:'京东集团',price:128.30},'HSI':{name:'恒生指数',price:19632.50},
};

const US_NAMES: Record<string,string> = {
  'AAPL':'Apple Inc.','GOOGL':'Alphabet Inc.','MSFT':'Microsoft Corp.',
  'AMZN':'Amazon.com','NVDA':'NVIDIA Corp.','META':'Meta Platforms',
  'TSLA':'Tesla Inc.','JPM':'JPMorgan Chase','AMD':'AMD','NFLX':'Netflix',
  'V':'Visa Inc.','JNJ':'Johnson & Johnson','WMT':'Walmart Inc.',
  'INTC':'Intel Corp.','CSCO':'Cisco Systems','PFE':'Pfizer Inc.',
  'BA':'Boeing Co.','GS':'Goldman Sachs','PYPL':'PayPal Holdings',
  'DIS':'Walt Disney Co.','BRK.B':'Berkshire Hathaway','MA':'Mastercard Inc.',
  'HD':'Home Depot Inc.','UNH':'UnitedHealth Group','PG':'Procter & Gamble',
  'CRM':'Salesforce Inc.','ORCL':'Oracle Corp.','QCOM':'Qualcomm Inc.',
  'COST':'Costco Wholesale','ADBE':'Adobe Inc.',
};

const US_INDICES: Record<string, {name:string;price:number}> = {
  '^GSPC':{name:'S&P 500',price:5942.17},'^IXIC':{name:'NASDAQ',price:19687.54},'^DJI':{name:'DOW JONES',price:42342.18},
};

function randomPrice(base: number) {
  const cp = (Math.random() - 0.48) * 6;
  const ch = base * (cp / 100);
  const cur = base + ch;
  const open = base + (Math.random() - 0.5) * base * 0.01;
  return {
    currentPrice: +cur.toFixed(2), change: +ch.toFixed(2), changePercent: +cp.toFixed(2),
    high: +(Math.max(cur, open) + Math.random() * base * 0.008).toFixed(2),
    low: +(Math.min(cur, open) - Math.random() * base * 0.008).toFixed(2),
    open: +open.toFixed(2), prevClose: base, volume: Math.floor(1e7 + Math.random() * 9e7),
  };
}

function detectMarket(s: string): 'A' | 'HK' | 'US' {
  const u = s.toUpperCase();
  if (u.startsWith('SH') || u.startsWith('SZ')) return 'A';
  if (u.startsWith('HK') || u === 'HSI') return 'HK';
  return 'US';
}

// Cache for quote data (5s TTL)
const quoteCache = new Map<string, { data: any; expires: number }>();

export function getMockQuote(symbol: string) {
  const S = symbol.toUpperCase();
  const cached = quoteCache.get(S);
  if (cached && cached.expires > Date.now()) return cached.data;

  const m = detectMarket(S);
  let result: any;

  if (m === 'A' && A_SHARE[S]) {
    result = { success: true, data: { symbol: S, name: A_SHARE[S].name, ...randomPrice(A_SHARE[S].price), timestamp: Math.floor(Date.now()/1000), market: 'A' }, error: null };
  } else if (m === 'HK' && HK_SHARE[S]) {
    result = { success: true, data: { symbol: S, name: HK_SHARE[S].name, ...randomPrice(HK_SHARE[S].price), timestamp: Math.floor(Date.now()/1000), market: 'HK' }, error: null };
  } else if (US_INDICES[S]) {
    result = { success: true, data: { symbol: S, name: US_INDICES[S].name, ...randomPrice(US_INDICES[S].price), timestamp: Math.floor(Date.now()/1000), market: 'US' }, error: null };
  } else {
    result = { success: true, data: { symbol: S, name: US_NAMES[S] || S, ...randomPrice(50 + Math.random() * 200), timestamp: Math.floor(Date.now()/1000), market: 'US' }, error: null };
  }

  quoteCache.set(S, { data: result, expires: Date.now() + 5000 });
  return result;
}

export function getMockQuotes(symbols: string[]) {
  const quotes = symbols.map(s => getMockQuote(s)).filter((r: any) => r.success).map((r: any) => r.data);
  return quotes.length > 0 ? { success: true, data: quotes, error: null } : { success: false, data: null, error: 'No quotes' };
}

export function getMockKline(symbol: string, count = 60) {
  const S = symbol.toUpperCase();
  const m = detectMarket(S);
  const bp = m === 'A' && A_SHARE[S] ? A_SHARE[S].price : m === 'HK' && HK_SHARE[S] ? HK_SHARE[S].price : US_INDICES[S] ? US_INDICES[S].price : 150;
  let price = bp * 0.9;
  const c: number[] = [], h: number[] = [], l: number[] = [], o: number[] = [], v: number[] = [], t: number[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < count; i++) {
    t.push(now - (count - i) * 86400);
    const vol = price * 0.02;
    const drift = (bp - price) / (count - i) * 0.3;
    const ch = drift + (Math.random() - 0.5) * vol;
    o.push(+price.toFixed(2)); c.push(+(price + ch).toFixed(2));
    h.push(+(Math.max(price, price + ch) + Math.random() * vol * 0.5).toFixed(2));
    l.push(+(Math.min(price, price + ch) - Math.random() * vol * 0.5).toFixed(2));
    v.push(Math.floor(2e7 + Math.random() * 8e7));
    price = price + ch;
  }
  return { success: true, data: { symbol: S, period: 'daily', c, h, l, o, v, t }, error: null };
}

export function getMockNews(market: string, count = 10) {
  const newsA = [
    { h: 'A股三大指数集体高开 半导体板块领涨', s: '受外围市场提振，半导体表现活跃', src: '财经网', sent: 'bullish' },
    { h: '央行开展1500亿元逆回购操作', s: '维护月末流动性合理充裕', src: '证券时报', sent: 'neutral' },
    { h: '白酒板块午后走强 茅台创新高', s: '消费复苏预期推动白酒上涨', src: '东方财富', sent: 'bullish' },
    { h: '创业板指回调 科技股分化', s: '成交量萎缩，资金观望', src: '新浪财经', sent: 'bearish' },
    { h: '新能源赛道重获资金青睐', s: '宁德时代带动锂电池走强', src: '第一财经', sent: 'bullish' },
  ];
  const newsHK = [
    { h: '恒生指数高开 港股通资金流入', s: '南向资金持续净买入', src: '港股资讯', sent: 'bullish' },
    { h: '腾讯回购力度加大', s: '公司宣布新一轮股份回购', src: '港交所', sent: 'bullish' },
    { h: '港府推出消费券计划', s: '刺激本地消费市场', src: '香港经济日报', sent: 'neutral' },
  ];
  const newsUS = [
    { h: 'Fed signals potential rate cuts', s: 'Inflation data softens', src: 'Reuters', sent: 'bullish' },
    { h: 'NVIDIA hits new all-time high', s: 'Data center revenue surges', src: 'Bloomberg', sent: 'bullish' },
    { h: 'Tech earnings beat expectations', s: 'Q4 results strong', src: 'CNBC', sent: 'bullish' },
  ];
  const src = market === 'HK' ? newsHK : market === 'US' ? newsUS : newsA;
  const items = src.slice(0, Math.min(count, 5)).map((t, i) => ({
    id: `${market}-${Date.now()}-${i}`, headline: t.h, summary: t.s, source: t.src,
    sentiment: t.sent, relatedStocks: [], publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
  return { success: true, data: items, error: null };
}

export function getMockSectors(market: string) {
  const names = market === 'A' ? ['白酒','新能源','银行','医药','证券','保险','电子','矿业','家电','电力','农业','旅游']
    : market === 'HK' ? ['互联网','银行','保险','科技','电商','汽车']
    : ['Technology','Healthcare','Finance','Consumer','Energy','Industrials'];
  const sectors = names.map(n => ({
    name: n, changePercent: +((Math.random()-0.48)*6).toFixed(2),
    volume: Math.floor(5e7+Math.random()*1e8), topStocks: [],
  }));
  return { success: true, data: sectors, error: null };
}

export function getMockIndicators(symbol: string) {
  return { success: true, data: {
    symbol: symbol.toUpperCase(),
    ma: { ma5: 150, ma10: 148, ma20: 146, ma60: 142 },
    rsi: { rsi6: 55, rsi12: 52, rsi14: 50 },
    macd: { dif: 0.5, dea: 0.3, macd: 0.2 },
    bollinger: { upper: 158, middle: 150, lower: 142 },
    kdj: { k: 55, d: 48, j: 62 },
  }, error: null };
}

export function getMockStrategies() {
  return { success: true, data: [
    {id:'ma_cross',name:'均线交叉策略',type:'trend',description:'5日/20日均线交叉',rating:4.2,parameters:['fast','slow']},
    {id:'macd_signal',name:'MACD信号策略',type:'trend',description:'MACD金叉死叉',rating:3.8,parameters:['fast','slow','signal']},
    {id:'rsi_divergence',name:'RSI背离策略',type:'reversal',description:'RSI与价格背离',rating:3.5,parameters:['period']},
    {id:'bollinger_breakout',name:'布林带突破策略',type:'volatility',description:'价格突破布林带',rating:4.0,parameters:['period','std']},
    {id:'kdj_golden_cross',name:'KDJ金叉策略',type:'momentum',description:'KDJ金叉买入',rating:3.6,parameters:['k','d']},
    {id:'turtle_trading',name:'海龟交易策略',type:'trend',description:'经典趋势跟踪',rating:4.3,parameters:['entry','exit','atr']},
    {id:'mean_reversion',name:'均值回归策略',type:'reversal',description:'价格偏离后回归',rating:3.7,parameters:['lookback']},
    {id:'scalping',name:'日内短线策略',type:'scalping',description:'超短线高频',rating:3.2,parameters:['target','stop']},
    {id:'swing_trading',name:'波段交易策略',type:'swing',description:'中线波段操作',rating:4.0,parameters:['period']},
    {id:'dividend_capture',name:'分红捕捉策略',type:'income',description:'分红除权日交易',rating:3.3,parameters:['days']},
    {id:'vwap_strategy',name:'VWAP执行策略',type:'execution',description:'算法交易执行',rating:3.6,parameters:['rate']},
    {id:'dual_thrust',name:'Dual Thrust策略',type:'breakout',description:'经典日内突破',rating:4.1,parameters:['range','k1','k2']},
    {id:'pairs_trading',name:'配对交易策略',type:'statistical',description:'统计套利',rating:3.8,parameters:['window']},
    {id:'volume_breakout',name:'放量突破策略',type:'volume',description:'成交量配合突破',rating:3.9,parameters:['ratio','change']},
    {id:'momentum_rotation',name:'动量轮动策略',type:'momentum',description:'板块轮动',rating:3.4,parameters:['period']},
  ], error: null };
}

export function getMockBacktest(strategy: string, symbol: string) {
  const tr = +((Math.random()-0.3)*80).toFixed(2);
  return { success: true, data: {
    strategy, symbol, totalReturn: tr, annualizedReturn: +(tr*0.7).toFixed(2),
    sharpeRatio: +(0.3+Math.random()*2.2).toFixed(2), maxDrawdown: +(-5-Math.random()*30).toFixed(2),
    winRate: +(40+Math.random()*25).toFixed(2), totalTrades: Math.floor(20+Math.random()*80),
    profitFactor: +(0.8+Math.random()*1.5).toFixed(2), avgHoldingDays: +(2+Math.random()*15).toFixed(1),
    trades: Array.from({length:10},(_,i)=>({id:i+1,entryPrice:+(100+Math.random()*200).toFixed(2),exitPrice:+(100+Math.random()*200).toFixed(2),quantity:Math.floor(10+Math.random()*90),pnl:+((Math.random()-0.4)*2000).toFixed(2)})),
  }, error: null };
}

export function getMockChatResponse(message: string) {
  return { success: true, data: { response: '你好！我是QuantFusion AI助手，我可以帮你分析股票、解读市场趋势、提供交易洞察。请问有什么可以帮你的？', source: 'mock' }, error: null };
}

export function getMockAnalysis(symbol: string, mode: string) {
  const sc = 40 + Math.floor(Math.random() * 40);
  const rec = sc >= 65 ? 'BUY' : sc >= 45 ? 'HOLD' : 'SELL';
  return { success: true, data: {
    symbol, mode, source: 'mock',
    technical: '短期趋势偏多，MACD金叉形成', fundamental: '行业龙头，估值合理',
    sentiment: '市场情绪中性偏多', risk: '关注宏观经济不确定性',
    recommendation: rec, score: sc, confidence: 'medium',
    summary: `综合评分${sc}分，建议${rec === 'BUY' ? '买入' : rec === 'SELL' ? '卖出' : '持有'}`,
  }, error: null };
}

export function getMockBrief() {
  return { success: true, data: {
    brief: '📊 今日市场简报\n\n🇨🇳 A股：集体收涨，半导体领涨\n🇭🇰 港股：小幅上涨，南向资金流入\n🇺🇸 美股：三大指数创新高\n\n💡 观点：短期市场偏多',
    source: 'mock',
  }, error: null };
}
