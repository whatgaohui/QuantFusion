import { NextRequest, NextResponse } from 'next/server';
import { aggregateNews, fetchCompanyNews, NEWS_SOURCE_LIST } from '@/lib/news-sources';
import { findRelatedSymbols, getCompanyNames } from '@/lib/stock-names';
import { getFinnhubApiKey } from '@/lib/finnhub-config';
import type { NewsItem, NewsCategory } from '@/lib/news-sources';

/**
 * 聚合新闻 API
 * GET /api/fusion/market/news
 * 参数:
 *   - category: general | forex | crypto | merger | a_share | all (默认 all)
 *   - sources: all | finnhub | cls | sina | wallstreetcn | 逗号分隔多个 (默认 all)
 *   - symbol: 股票代码（按代码筛选，可选）
 *   - symbols: 逗号分隔的股票代码列表（获取多只股票相关新闻，可选）
 *   - limit: 最大返回数量 (默认 30)
 */

const REQUEST_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** 按标题去重 */
function deduplicateByHeadline(news: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return news.filter((item) => {
    const key = item.headline.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 按时间降序排列 */
function sortByTimestamp(news: NewsItem[]): NewsItem[] {
  return [...news].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * 使用公司名匹配从聚合新闻中筛选与自选股相关的新闻
 * 比纯符号匹配更强大，能匹配到 "Apple" → AAPL, "特斯拉" → TSLA 等
 */
function filterByWatchlistRelevance(
  news: NewsItem[],
  symbols: string[],
  maxPerSymbol: number = 5
): NewsItem[] {
  const upperSymbols = symbols.map(s => s.toUpperCase());
  const matched: NewsItem[] = [];

  for (const article of news) {
    // 合并标题和摘要进行全文匹配
    const fullText = `${article.headline} ${article.summary}`;

    // 1. 检查 relatedStocks 字段
    const relatedByField = (article.relatedStocks || []).some(
      s => upperSymbols.includes(s.toUpperCase())
    );

    if (relatedByField) {
      // 补充匹配到的自选股到 relatedStocks
      const existingStocks = new Set((article.relatedStocks || []).map(s => s.toUpperCase()));
      const fieldMatched = upperSymbols.filter(s => existingStocks.has(s));
      matched.push({
        ...article,
        relatedStocks: [...new Set([...(article.relatedStocks || []), ...fieldMatched])],
      });
      continue;
    }

    // 2. 使用公司名匹配（核心增强）
    const relatedSymbols = findRelatedSymbols(fullText, symbols);

    if (relatedSymbols.length > 0) {
      matched.push({
        ...article,
        relatedStocks: [...new Set([...(article.relatedStocks || []), ...relatedSymbols])],
      });
    }
  }

  // 限制每只股票最多匹配的文章数，避免某只热门股占满全部结果
  const symbolCounts: Record<string, number> = {};
  const balanced: NewsItem[] = [];

  for (const article of matched) {
    const primarySymbol = (article.relatedStocks || [])[0];
    if (primarySymbol) {
      symbolCounts[primarySymbol] = (symbolCounts[primarySymbol] || 0) + 1;
      if (symbolCounts[primarySymbol] > maxPerSymbol) continue;
    }
    balanced.push(article);
  }

  return balanced;
}

/** 从 Finnhub 获取单只股票的扩展公司新闻（30天范围），用于自选股新闻不足时的补充 */
async function fetchExtendedCompanyNews(symbol: string): Promise<NewsItem[]> {
  const finnhubApiKey = await getFinnhubApiKey();
  if (!finnhubApiKey) {
    return [];
  }

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 3600 * 1000); // 扩展到30天
  const fromStr = from.toISOString().split('T')[0];
  const toStr = now.toISOString().split('T')[0];

  try {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromStr}&to=${toStr}&token=${finnhubApiKey}`;
    const response = await fetchWithTimeout(url, REQUEST_TIMEOUT);

    if (!response.ok) {
      console.warn(`[fusion/news] Finnhub extended company-news ${symbol} 返回错误:`, response.status);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.slice(0, 20).map((item: Record<string, unknown>, i: number) => {
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
        id: String(item.id || `finnhub-ext-${symbol}-${i}-${Date.now()}`),
        headline: (item.headline as string) || '',
        source: (item.source as string) || 'Finnhub',
        sourceName: 'finnhub' as const,
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
    console.warn(`[fusion/news] Finnhub extended company-news ${symbol} 请求失败:`, err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get('category') || searchParams.get('market') || 'all') as NewsCategory;
    const sources = searchParams.get('sources') || 'all';
    const symbol = searchParams.get('symbol');
    const symbolsParam = searchParams.get('symbols');
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);

    // 如果提供了 symbols 参数，获取多只股票的公司新闻
    if (symbolsParam) {
      const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

      if (symbols.length > 0) {
        // 1. 使用 news-sources.ts 中的 fetchCompanyNews（内部使用 getFinnhubApiKey() 从数据库读取 Key）
        const companyNews = await fetchCompanyNews(symbols, 15);

        // 2. 同时获取聚合新闻
        const aggregatedNews = await aggregateNews(sources, category, limit * 2);

        // 3. 使用增强的公司名匹配从聚合新闻中筛选相关文章
        const relatedAggregated = filterByWatchlistRelevance(
          aggregatedNews,
          symbols,
          5  // 每只股票最多5篇
        );

        // 4. 合并自选股公司新闻 + 相关聚合新闻
        let watchlistNews: NewsItem[] = [...companyNews, ...relatedAggregated];

        // 5. 如果自选股相关新闻较少，使用扩展的30天公司新闻补充
        if (watchlistNews.length < 5) {
          const finnhubApiKey = await getFinnhubApiKey();
          if (finnhubApiKey) {
            const extraPromises = symbols.map(sym => fetchExtendedCompanyNews(sym));
            const extraResults = await Promise.allSettled(extraPromises);
            for (const result of extraResults) {
              if (result.status === 'fulfilled') {
                watchlistNews = watchlistNews.concat(result.value);
              }
            }
          }
        }

        // 6. 如果仍然没有足够结果，从聚合新闻中按公司名关键词做第二轮宽松匹配
        if (watchlistNews.length < 3) {
          const looseMatched = aggregatedNews.filter(article => {
            const fullText = `${article.headline} ${article.summary}`.toUpperCase();
            return symbols.some(sym => {
              // 宽松匹配：检查代码或任何公司名包含
              if (fullText.includes(sym)) return true;
              const names = getCompanyNames(sym);
              return names.some(name => name.length >= 2 && fullText.includes(name.toUpperCase()));
            });
          }).map(article => ({
            ...article,
            relatedStocks: [
              ...(article.relatedStocks || []),
              ...findRelatedSymbols(`${article.headline} ${article.summary}`, symbols),
            ],
          }));

          watchlistNews = watchlistNews.concat(looseMatched);
        }

        // 7. 去重 → 排序 → 限制数量
        watchlistNews = deduplicateByHeadline(watchlistNews);
        watchlistNews = sortByTimestamp(watchlistNews);

        return NextResponse.json(watchlistNews.slice(0, limit));
      }
    }

    // 聚合多源新闻（原有逻辑）
    let news = await aggregateNews(sources, category, limit);

    // 如果指定了 symbol，按关联股票过滤（使用增强匹配）
    if (symbol) {
      news = filterByWatchlistRelevance(news, [symbol], limit);
    }

    return NextResponse.json(news);
  } catch (error) {
    console.error('[fusion/news] 聚合新闻错误:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate news', sources: NEWS_SOURCE_LIST.map(s => s.name) },
      { status: 500 }
    );
  }
}
