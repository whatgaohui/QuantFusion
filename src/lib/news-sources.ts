/**
 * 多源新闻聚合适配器
 * 支持 Finnhub、财联社、新浪财经、华尔街见闻
 * 统一接口: fetchNews(category, limit) → NewsItem[]
 * 自动优先级+回退机制
 */

import { getFinnhubApiKey } from '@/lib/finnhub-config';

// ============================================================
// 类型定义
// ============================================================

export interface NewsItem {
  id: string;
  headline: string;
  source: string;          // 原始来源（如 Reuters、财联社）
  sourceName: string;      // 数据源标识（finnhub / cls / sina / wallstreetcn）
  url: string;
  image: string;
  summary: string;
  category: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  relatedStocks: string[];
  timestamp: string;
}

export type NewsCategory = 'general' | 'forex' | 'crypto' | 'merger' | 'a_share' | 'all';

// ============================================================
// 工具函数
// ============================================================

const REQUEST_TIMEOUT = 8000;

/** 带超时的 fetch */
async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** 生成唯一 ID */
function genId(prefix: string, i: number): string {
  return `${prefix}-${Date.now()}-${i}`;
}

// ============================================================
// Finnhub 适配器（美股新闻）
// ============================================================

const FINNHUB_MOCK: NewsItem[] = [
  {
    id: 'finnhub-mock-1',
    headline: 'S&P 500 Hits New All-Time High as Tech Sector Leads Rally',
    source: 'Reuters',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'The benchmark index climbed to a record close as strong earnings from major technology companies boosted investor sentiment across the board.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['AAPL', 'NVDA', 'MSFT'],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'finnhub-mock-2',
    headline: 'NVIDIA Surges on AI Chip Demand Forecast, Beats Quarterly Estimates',
    source: 'Bloomberg',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'The chipmaker raised its revenue guidance for the current quarter, citing unprecedented demand for its AI training and inference processors.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['NVDA', 'AMD'],
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'finnhub-mock-3',
    headline: 'Federal Reserve Signals Potential Rate Cuts in Coming Months',
    source: 'CNBC',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'Fed officials indicated that inflation data has been moving in the right direction, opening the door for possible interest rate reductions.',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'finnhub-mock-4',
    headline: 'Bitcoin ETFs See Record Inflows on First Day of Trading',
    source: 'CoinDesk',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'Newly approved spot Bitcoin ETFs attracted over $4.6 billion in trading volume on their debut, marking the most successful ETF launch in history.',
    category: 'crypto',
    sentiment: 'bullish',
    relatedStocks: ['COIN'],
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'finnhub-mock-5',
    headline: 'Dollar Weakens Against Major Currencies After Fed Comments',
    source: 'Financial Times',
    sourceName: 'finnhub',
    url: '#',
    image: '',
    summary: 'The greenback fell sharply against the euro and yen as traders priced in a higher probability of rate cuts in the first half of the year.',
    category: 'forex',
    sentiment: 'neutral',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 21600000).toISOString(),
  },
];

class FinnhubSource {
  readonly name = 'finnhub';
  readonly label = 'Finnhub';

  /**
   * 获取单只股票的公司新闻（Finnhub company-news API）
   * 当有 API Key 时使用真实数据，否则返回空
   */
  async fetchCompanyNews(symbol: string, limit: number = 15): Promise<NewsItem[]> {
    const FINNHUB_API_KEY = await getFinnhubApiKey();
    if (!FINNHUB_API_KEY) {
      return [];
    }

    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = now.toISOString().split('T')[0];

    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${FINNHUB_API_KEY}`;
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

      if (!response.ok) {
        console.warn(`[news-sources/finnhub] company-news ${symbol} 返回错误:`, response.status);
        return [];
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return [];

      return data.slice(0, limit).map((item: Record<string, unknown>, i: number) => {
        const datetime = item.datetime as number | undefined;
        const timestamp = datetime ? new Date(datetime * 1000).toISOString() : new Date().toISOString();
        const rawCategory = (item.category as string) || 'general';

        let mappedCategory = 'general';
        if (rawCategory.includes('crypto') || rawCategory.includes('bitcoin') || rawCategory.includes('ethereum')) {
          mappedCategory = 'crypto';
        } else if (rawCategory.includes('forex') || rawCategory.includes('currency')) {
          mappedCategory = 'forex';
        } else if (rawCategory.includes('merger') || rawCategory.includes('acquisition')) {
          mappedCategory = 'merger';
        }

        return {
          id: String(item.id || genId(`finnhub-co-${symbol}`, i)),
          headline: (item.headline as string) || '',
          source: (item.source as string) || 'Finnhub',
          sourceName: 'finnhub',
          url: (item.url as string) || '#',
          image: (item.image as string) || '',
          summary: (item.summary as string) || '',
          category: mappedCategory,
          sentiment: 'neutral' as const,
          relatedStocks: [symbol.toUpperCase(), ...((item.related as string)?.split(',') || [])].filter(Boolean),
          timestamp,
        };
      });
    } catch (err) {
      console.warn(`[news-sources/finnhub] company-news ${symbol} 请求失败:`, err);
      return [];
    }
  }

  async fetchNews(category: NewsCategory, limit: number = 20): Promise<NewsItem[]> {
    const FINNHUB_API_KEY = await getFinnhubApiKey();
    if (!FINNHUB_API_KEY) {
      console.log('[news-sources/finnhub] 无 API Key，使用模拟数据');
      return FINNHUB_MOCK.slice(0, limit);
    }

    try {
      const cat = category === 'all' || category === 'a_share' ? 'general' : category;
      const url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(cat)}&token=${FINNHUB_API_KEY}`;
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

      if (!response.ok) {
        console.warn('[news-sources/finnhub] API 返回错误:', response.status);
        return FINNHUB_MOCK.slice(0, limit);
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        return FINNHUB_MOCK.slice(0, limit);
      }

      return data.slice(0, limit).map((item: Record<string, unknown>, i: number) => {
        const datetime = item.datetime as number | undefined;
        const timestamp = datetime ? new Date(datetime * 1000).toISOString() : new Date().toISOString();
        const rawCategory = (item.category as string) || 'general';

        let mappedCategory = 'general';
        if (rawCategory.includes('crypto') || rawCategory.includes('bitcoin') || rawCategory.includes('ethereum')) {
          mappedCategory = 'crypto';
        } else if (rawCategory.includes('forex') || rawCategory.includes('currency')) {
          mappedCategory = 'forex';
        } else if (rawCategory.includes('merger') || rawCategory.includes('acquisition')) {
          mappedCategory = 'merger';
        }

        return {
          id: String(item.id || genId('finnhub', i)),
          headline: (item.headline as string) || '',
          source: (item.source as string) || 'Finnhub',
          sourceName: 'finnhub',
          url: (item.url as string) || '#',
          image: (item.image as string) || '',
          summary: (item.summary as string) || '',
          category: mappedCategory,
          sentiment: 'neutral' as const,
          relatedStocks: (item.related as string)?.split(',') || [],
          timestamp,
        };
      });
    } catch (err) {
      console.warn('[news-sources/finnhub] 请求失败:', err);
      return FINNHUB_MOCK.slice(0, limit);
    }
  }
}

// ============================================================
// 财联社（CLS）适配器
// ============================================================

const CLS_MOCK: NewsItem[] = [
  {
    id: 'cls-mock-1',
    headline: '国务院常务会议：加大宏观政策调控力度，着力扩大内需',
    source: '财联社',
    sourceName: 'cls',
    url: '#',
    image: '',
    summary: '会议指出，要精准有力实施宏观政策，加强各类政策协调配合，形成共促高质量发展的合力。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'cls-mock-2',
    headline: '北向资金今日净流入超80亿元，加仓新能源与半导体板块',
    source: '财联社',
    sourceName: 'cls',
    url: '#',
    image: '',
    summary: '今日北向资金全天净买入83.5亿元，其中沪股通净买入45.2亿元，深股通净买入38.3亿元，新能源与半导体板块获重点加仓。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: ['600519', '300750'],
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'cls-mock-3',
    headline: '央行：将继续实施稳健的货币政策，保持流动性合理充裕',
    source: '财联社',
    sourceName: 'cls',
    url: '#',
    image: '',
    summary: '中国人民银行表示，将继续综合运用多种货币政策工具，保持银行体系流动性合理充裕，引导金融机构加大实体经济支持力度。',
    category: 'a_share',
    sentiment: 'neutral',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: 'cls-mock-4',
    headline: '沪深两市成交额突破1.2万亿，创近三个月新高',
    source: '财联社',
    sourceName: 'cls',
    url: '#',
    image: '',
    summary: '今日A股三大指数集体走强，沪深两市成交额达到1.25万亿元，较前一交易日放量明显，市场情绪显著回暖。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'cls-mock-5',
    headline: '新能源汽车6月销量再创新高，比亚迪单月交付超25万辆',
    source: '财联社',
    sourceName: 'cls',
    url: '#',
    image: '',
    summary: '乘联会数据显示，6月新能源车厂商批发销量达到96万辆，同比增长33%，环比增长8%，渗透率继续攀升至46%。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: ['002594', '300750'],
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
];

class ClsSource {
  readonly name = 'cls';
  readonly label = '财联社';

  async fetchNews(_category: NewsCategory, limit: number = 20): Promise<NewsItem[]> {
    // 财联社公开API尝试
    try {
      const url = 'https://www.cls.cn/api/telegraph?rn=20';
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

      if (response.ok) {
        const data = await response.json();
        if (data?.data?.list && Array.isArray(data.data.list) && data.data.list.length > 0) {
          return data.data.list.slice(0, limit).map((item: Record<string, unknown>, i: number) => ({
            id: genId('cls', i),
            headline: (item.title || item.content || '') as string,
            source: '财联社',
            sourceName: 'cls',
            url: (item.url as string) || `https://www.cls.cn/telegraph/${item.id || ''}`,
            image: '',
            summary: (item.brief || item.content || '') as string,
            category: 'a_share',
            sentiment: 'neutral' as const,
            relatedStocks: (item.stock_list || []) as string[],
            timestamp: item.ctime ? new Date((item.ctime as number) * 1000).toISOString() : new Date().toISOString(),
          }));
        }
      }
    } catch (err) {
      console.warn('[news-sources/cls] API 请求失败，使用模拟数据:', err);
    }

    return CLS_MOCK.slice(0, limit);
  }
}

// ============================================================
// 新浪财经适配器
// ============================================================

const SINA_MOCK: NewsItem[] = [
  {
    id: 'sina-mock-1',
    headline: 'A股三大指数集体收涨：沪指涨0.82%重返3300点 两市超3500股飘红',
    source: '新浪财经',
    sourceName: 'sina',
    url: '#',
    image: '',
    summary: 'A股三大指数今日集体收涨，沪指涨0.82%报3318.66点，深成指涨1.18%，创业板指涨1.56%。两市成交额连续第五个交易日突破万亿。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: [],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'sina-mock-2',
    headline: '茅台股价再创年内新高 机构看好白酒板块估值修复',
    source: '新浪财经',
    sourceName: 'sina',
    url: '#',
    image: '',
    summary: '贵州茅台今日上涨2.5%报1868元，创年内新高。多家机构发布研报看好白酒板块，认为当前估值处于历史低位区间。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: ['600519'],
    timestamp: new Date(Date.now() - 2400000).toISOString(),
  },
  {
    id: 'sina-mock-3',
    headline: '证监会：进一步优化IPO审核流程，支持科技创新企业上市',
    source: '新浪财经',
    sourceName: 'sina',
    url: '#',
    image: '',
    summary: '证监会发布新版IPO审核指引，重点支持硬科技、专精特新企业融资，优化审核时限和信息披露要求。',
    category: 'a_share',
    sentiment: 'neutral',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: 'sina-mock-4',
    headline: '半导体板块午后拉升 中芯国际涨超5%领涨',
    source: '新浪财经',
    sourceName: 'sina',
    url: '#',
    image: '',
    summary: '受政策利好及海外半导体需求回暖影响，A股半导体板块午后集体拉升，中芯国际涨5.2%，北方华创涨3.8%。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: ['688981', '002371'],
    timestamp: new Date(Date.now() - 9000000).toISOString(),
  },
  {
    id: 'sina-mock-5',
    headline: '国常会：促进家居消费政策落地 家电板块应声上涨',
    source: '新浪财经',
    sourceName: 'sina',
    url: '#',
    image: '',
    summary: '国务院常务会议审议通过促进家居消费若干措施，鼓励智能家居和绿色家电消费。美的集团、海尔智家涨超3%。',
    category: 'a_share',
    sentiment: 'bullish',
    relatedStocks: ['000333', '600690'],
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
];

class SinaSource {
  readonly name = 'sina';
  readonly label = '新浪财经';

  async fetchNews(_category: NewsCategory, limit: number = 20): Promise<NewsItem[]> {
    // 新浪财经公开API尝试
    try {
      const url = 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&num=20&versionNumber=1.2.4';
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

      if (response.ok) {
        const data = await response.json();
        if (data?.result?.data && Array.isArray(data.result.data) && data.result.data.length > 0) {
          return data.result.data.slice(0, limit).map((item: Record<string, unknown>, i: number) => ({
            id: genId('sina', i),
            headline: (item.title || '') as string,
            source: '新浪财经',
            sourceName: 'sina',
            url: (item.url as string) || '#',
            image: (item.img || '') as string,
            summary: (item.intro || item.title || '') as string,
            category: 'a_share',
            sentiment: 'neutral' as const,
            relatedStocks: [],
            timestamp: (() => {
              if (!item.ctime) return new Date().toISOString();
              try {
                const d = new Date(item.ctime as string);
                return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
              } catch {
                return new Date().toISOString();
              }
            })(),
          }));
        }
      }
    } catch (err) {
      console.warn('[news-sources/sina] API 请求失败，使用模拟数据:', err);
    }

    return SINA_MOCK.slice(0, limit);
  }
}

// ============================================================
// 华尔街见闻适配器
// ============================================================

const WALLSTREETCN_MOCK: NewsItem[] = [
  {
    id: 'wscn-mock-1',
    headline: '美联储7月纪要：多数官员支持进一步加息，但步伐可能放缓',
    source: '华尔街见闻',
    sourceName: 'wallstreetcn',
    url: '#',
    image: '',
    summary: '美联储7月议息会议纪要显示，多数官员认为需要进一步收紧货币政策以将通胀降至2%目标，但未来加息步伐可能取决于数据表现。',
    category: 'general',
    sentiment: 'bearish',
    relatedStocks: [],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'wscn-mock-2',
    headline: 'OpenAI估值超800亿美元，全球AI竞赛白热化',
    source: '华尔街见闻',
    sourceName: 'wallstreetcn',
    url: '#',
    image: '',
    summary: '据知情人士透露，OpenAI最新一轮融资估值超过800亿美元。微软、谷歌等科技巨头持续加码AI投资，全球AI军备竞赛进入新阶段。',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['MSFT', 'GOOGL'],
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'wscn-mock-3',
    headline: '欧洲央行维持利率不变，拉加德暗示下半年可能降息',
    source: '华尔街见闻',
    sourceName: 'wallstreetcn',
    url: '#',
    image: '',
    summary: '欧洲央行宣布维持三大关键利率不变，行长拉加德在新闻发布会上暗示，若通胀持续回落，下半年可能开启降息周期。',
    category: 'forex',
    sentiment: 'neutral',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'wscn-mock-4',
    headline: '日本央行意外调整YCC政策 日元大幅走强',
    source: '华尔街见闻',
    sourceName: 'wallstreetcn',
    url: '#',
    image: '',
    summary: '日本央行宣布将10年期国债收益率目标区间上限从0.5%上调至1.0%，市场解读为货币政策正常化的信号，日元兑美元快速升值。',
    category: 'forex',
    sentiment: 'neutral',
    relatedStocks: [],
    timestamp: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: 'wscn-mock-5',
    headline: '全球芯片行业触底信号明确 AI需求驱动新一轮增长周期',
    source: '华尔街见闻',
    sourceName: 'wallstreetcn',
    url: '#',
    image: '',
    summary: '多家芯片巨头财报显示库存去化接近尾声，AI大模型训练和推理需求拉动高端芯片订单大幅增长，行业拐点已至。',
    category: 'general',
    sentiment: 'bullish',
    relatedStocks: ['NVDA', 'TSM', 'AMD'],
    timestamp: new Date(Date.now() - 18000000).toISOString(),
  },
];

class WallStreetCnSource {
  readonly name = 'wallstreetcn';
  readonly label = '华尔街见闻';

  async fetchNews(_category: NewsCategory, limit: number = 20): Promise<NewsItem[]> {
    // 华尔街见闻公开API尝试
    try {
      const url = 'https://api-one-wscn.awtmt.com/apiv1/content/live/list?channel=global-channel&cursor=0&limit=20';
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

      if (response.ok) {
        const data = await response.json();
        if (data?.data?.items && Array.isArray(data.data.items) && data.data.items.length > 0) {
          return data.data.items.slice(0, limit).map((item: Record<string, unknown>, i: number) => ({
            id: genId('wallstreetcn', i),
            headline: (item.title || '') as string,
            source: '华尔街见闻',
            sourceName: 'wallstreetcn',
            url: (item.uri as string) || '#',
            image: (item.image_url as string) || '',
            summary: (item.content_text || item.title || '') as string,
            category: 'general',
            sentiment: 'neutral' as const,
            relatedStocks: [],
            timestamp: item.display_time ? new Date((item.display_time as number) * 1000).toISOString() : new Date().toISOString(),
          }));
        }
      }
    } catch (err) {
      console.warn('[news-sources/wallstreetcn] API 请求失败，使用模拟数据:', err);
    }

    return WALLSTREETCN_MOCK.slice(0, limit);
  }
}

// ============================================================
// 聚合引擎
// ============================================================

/** 所有新闻源实例 */
const NEWS_SOURCES = [FinnhubSource, ClsSource, SinaSource, WallStreetCnSource] as const;

/** 按名称获取源实例 */
function getSourceByName(name: string): FinnhubSource | ClsSource | SinaSource | WallStreetCnSource | null {
  switch (name) {
    case 'finnhub': return new FinnhubSource();
    case 'cls': return new ClsSource();
    case 'sina': return new SinaSource();
    case 'wallstreetcn': return new WallStreetCnSource();
    default: return null;
  }
}

/** 计算两个字符串的标题相似度（简单词重叠法） */
function titleSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => s.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean);
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.min(tokensA.size, tokensB.size);
}

/** 去重：按标题相似度过滤 */
function deduplicateNews(news: NewsItem[], threshold: number = 0.6): NewsItem[] {
  const result: NewsItem[] = [];
  for (const item of news) {
    const isDuplicate = result.some(
      (existing) => titleSimilarity(existing.headline, item.headline) >= threshold
    );
    if (!isDuplicate) {
      result.push(item);
    }
  }
  return result;
}

/** 按时间降序排列 */
function sortByTime(news: NewsItem[]): NewsItem[] {
  return [...news].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * 聚合多源新闻
 * @param sources 指定源：'all' 或逗号分隔的源名称
 * @param category 新闻分类
 * @param limit 最大数量
 */
export async function aggregateNews(
  sources: string = 'all',
  category: NewsCategory = 'all',
  limit: number = 30
): Promise<NewsItem[]> {
  const sourceNames = sources === 'all'
    ? ['finnhub', 'cls', 'sina', 'wallstreetcn']
    : sources.split(',').map(s => s.trim()).filter(Boolean);

  // 并行获取各源新闻
  const fetchPromises = sourceNames.map(async (name) => {
    const source = getSourceByName(name);
    if (!source) {
      console.warn(`[news-sources] 未知新闻源: ${name}`);
      return [];
    }
    try {
      return await source.fetchNews(category, Math.ceil(limit / sourceNames.length) + 5);
    } catch (err) {
      console.warn(`[news-sources] ${name} 获取失败:`, err);
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);

  // 汇总所有成功结果
  let allNews: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allNews = allNews.concat(result.value);
    }
  }

  // 去重 → 排序 → 限制数量
  allNews = deduplicateNews(allNews);
  allNews = sortByTime(allNews);
  return allNews.slice(0, limit);
}

/**
 * 获取指定股票代码的公司新闻
 * 利用 Finnhub 的 company-news API 获取特定股票的相关新闻
 * @param symbols 股票代码列表
 * @param limitPerSymbol 每只股票获取的最大新闻数
 */
export async function fetchCompanyNews(
  symbols: string[],
  limitPerSymbol: number = 15
): Promise<NewsItem[]> {
  const finnhub = new FinnhubSource();

  const promises = symbols.map(sym => finnhub.fetchCompanyNews(sym, limitPerSymbol));
  const results = await Promise.allSettled(promises);

  let allNews: NewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allNews = allNews.concat(result.value);
    }
  }

  allNews = deduplicateNews(allNews);
  allNews = sortByTime(allNews);
  return allNews;
}

/** 导出源信息供前端使用 */
export const NEWS_SOURCE_LIST = [
  { name: 'all', label: 'All Sources', labelZh: '全部来源' },
  { name: 'finnhub', label: 'Finnhub', labelZh: 'Finnhub' },
  { name: 'cls', label: 'CLS (财联社)', labelZh: '财联社' },
  { name: 'sina', label: 'Sina Finance', labelZh: '新浪财经' },
  { name: 'wallstreetcn', label: 'Wall Street CN', labelZh: '华尔街见闻' },
] as const;
