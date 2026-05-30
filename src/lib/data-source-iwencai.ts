/**
 * 同花顺问财选股数据源
 * 自然语言选股查询
 * 公开API尝试 + 模拟回退
 */

const IWENCAI_TIMEOUT = 10000;

interface IwencaiStock {
  symbol: string;       // 股票代码
  name: string;         // 股票名称
  price: number;        // 当前价格
  changePercent: number; // 涨跌幅
  marketCap?: number;   // 市值
  pe?: number;          // 市盈率
  industry?: string;    // 所属行业
  reason?: string;      // 入选原因
}

interface IwencaiResult {
  query: string;              // 原始查询
  parsedConditions: string[]; // 解析后的条件
  stocks: IwencaiStock[];     // 筛选结果
  total: number;              // 总数
  source: 'live' | 'mock';   // 数据来源
  timestamp: string;
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
 * 尝试调用问财公开API（可能因限制而失败）
 */
export async function fetchIwencaiStocks(query: string): Promise<IwencaiResult | null> {
  // 问财公开接口尝试
  const url = `https://www.iwencai.com/customized/chart/get-robot-data?question=${encodeURIComponent(query)}&perpage=20&page=1&secondary_intent=stock&log_info={\"input_type\":\"typewrite\"}`;

  try {
    const response = await fetchWithTimeout(url, IWENCAI_TIMEOUT);
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.answer && data.data.answer.length > 0) {
        const answer = data.data.answer[0];
        if (answer.txt && answer.txt[0] && answer.txt[0].content) {
          const content = answer.txt[0].content;
          if (content.components && content.components.length > 0) {
            const comp = content.components[0];
            if (comp.data && comp.data.datas) {
              const stocks: IwencaiStock[] = comp.data.datas.map((item: Record<string, string>) => ({
                symbol: item['股票代码'] || item['code'] || '',
                name: item['股票简称'] || item['name'] || '',
                price: parseFloat(item['最新价'] || item['price'] || '0'),
                changePercent: parseFloat(item['涨跌幅'] || item['change_pct'] || '0'),
                marketCap: parseFloat(item['总市值'] || item['market_cap'] || '0'),
                pe: parseFloat(item['市盈率'] || item['pe'] || '0'),
                industry: item['所属行业'] || item['industry'] || '',
                reason: '',
              })).filter((s: IwencaiStock) => s.symbol && s.name);

              return {
                query,
                parsedConditions: parseConditions(query),
                stocks,
                total: stocks.length,
                source: 'live',
                timestamp: new Date().toISOString(),
              };
            }
          }
        }
      }
    }
  } catch {
    console.log('[iwencai] 问财API请求失败，使用模拟数据');
  }

  return null;
}

/**
 * 解析查询条件
 */
function parseConditions(query: string): string[] {
  const conditions: string[] = [];

  // 常见关键词解析
  const patterns: [RegExp, string][] = [
    [/连板/, '连续涨停'],
    [/涨停/, '当日涨停'],
    [/跌停/, '当日跌停'],
    [/次新/, '次新股'],
    [/破净/, '市净率<1'],
    [/低估值/, 'PE<15, PB<1.5'],
    [/高送转/, '高送转预期'],
    [/放量/, '成交量放大'],
    [/缩量/, '成交量缩小'],
    [/MACD金叉/, 'MACD金叉'],
    [/RSI超卖/, 'RSI<30'],
    [/RSI超买/, 'RSI>70'],
    [/均线多头/, 'MA5>MA10>MA20'],
    [/均线空头/, 'MA5<MA10<MA20'],
    [/量比/, '量比>2'],
    [/换手率/, '换手率筛选'],
    [/市盈率/, 'PE筛选'],
    [/市值/, '市值筛选'],
    [/涨幅/, '涨幅筛选'],
    [/跌幅/, '跌幅筛选'],
  ];

  for (const [regex, condition] of patterns) {
    if (regex.test(query)) {
      conditions.push(condition);
    }
  }

  if (conditions.length === 0) {
    conditions.push(`自定义查询: ${query}`);
  }

  return conditions;
}

/**
 * 生成模拟问财选股结果
 */
export function generateIwencaiMockResult(query: string): IwencaiResult {
  const conditions = parseConditions(query);
  const hash = query.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // 模拟A股股票池
  const stockPool = [
    { symbol: '600519', name: '贵州茅台', basePrice: 1800, industry: '白酒' },
    { symbol: '000858', name: '五粮液', basePrice: 160, industry: '白酒' },
    { symbol: '300750', name: '宁德时代', basePrice: 200, industry: '新能源' },
    { symbol: '601318', name: '中国平安', basePrice: 50, industry: '保险' },
    { symbol: '600036', name: '招商银行', basePrice: 35, industry: '银行' },
    { symbol: '000001', name: '平安银行', basePrice: 12, industry: '银行' },
    { symbol: '002475', name: '立讯精密', basePrice: 35, industry: '电子' },
    { symbol: '601012', name: '隆基绿能', basePrice: 25, industry: '光伏' },
    { symbol: '000333', name: '美的集团', basePrice: 60, industry: '家电' },
    { symbol: '002714', name: '牧原股份', basePrice: 40, industry: '农业' },
    { symbol: '600900', name: '长江电力', basePrice: 28, industry: '电力' },
    { symbol: '603259', name: '药明康德', basePrice: 55, industry: '医药' },
    { symbol: '300059', name: '东方财富', basePrice: 18, industry: '券商' },
    { symbol: '002415', name: '海康威视', basePrice: 35, industry: '安防' },
    { symbol: '000725', name: '京东方A', basePrice: 5, industry: '面板' },
    { symbol: '688981', name: '中芯国际', basePrice: 50, industry: '芯片' },
    { symbol: '601899', name: '紫金矿业', basePrice: 15, industry: '矿业' },
    { symbol: '002594', name: '比亚迪', basePrice: 260, industry: '新能源车' },
    { symbol: '600276', name: '恒瑞医药', basePrice: 45, industry: '医药' },
    { symbol: '000568', name: '泸州老窖', basePrice: 230, industry: '白酒' },
  ];

  // 根据查询哈希选取不同的股票子集
  const count = 5 + (hash % 10);
  const shuffled = [...stockPool].sort(() => {
    const a = (hash * 31 + 17) % 100;
    const b = (hash * 37 + 23) % 100;
    return a - b;
  });
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  const stocks: IwencaiStock[] = selected.map(stock => {
    const seed = ((hash + stock.basePrice) % 100) / 100;
    const changePct = (seed - 0.5) * 10; // -5% ~ +5%
    return {
      symbol: stock.symbol,
      name: stock.name,
      price: parseFloat((stock.basePrice * (1 + changePct / 100)).toFixed(2)),
      changePercent: parseFloat(changePct.toFixed(2)),
      marketCap: parseFloat((stock.basePrice * 100000 * (5 + seed * 50)).toFixed(0)),
      pe: parseFloat((5 + seed * 50).toFixed(1)),
      industry: stock.industry,
      reason: conditions[0] || '符合筛选条件',
    };
  });

  return {
    query,
    parsedConditions: conditions,
    stocks,
    total: stocks.length,
    source: 'mock',
    timestamp: new Date().toISOString(),
  };
}

/**
 * 智能选股（问财+模拟回退）
 */
export async function smartStockScreen(query: string): Promise<IwencaiResult> {
  // 先尝试问财API
  const liveResult = await fetchIwencaiStocks(query);
  if (liveResult && liveResult.stocks.length > 0) {
    return liveResult;
  }

  // 回退到模拟数据
  return generateIwencaiMockResult(query);
}
