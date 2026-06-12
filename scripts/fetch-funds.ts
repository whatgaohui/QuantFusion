/**
 * 基金数据采集脚本
 * 从东方财富(EastMoney)采集全部国内基金数据到本地数据库
 * 
 * 使用方法: bun run scripts/fetch-funds.ts
 * 
 * 数据源:
 * - 全部基金列表: http://fund.eastmoney.com/js/fundcode_search.js
 * - ETF实时行情: http://push2.eastmoney.com/api/qt/stock/get
 * - 场内基金分类: 根据代码规则自动识别
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── 基金代码规则 ──────────────────────────────────────────────
// 场内ETF (Exchange Traded Fund):
//   SH: 510xxx, 511xxx, 512xxx, 513xxx, 514xxx, 515xxx, 516xxx, 517xxx, 518xxx, 519xxx(部分)
//   SZ: 159xxx
// LOF (Listed Open-ended Fund):
//   SH: 501xxx, 502xxx
//   SZ: 161xxx, 162xxx, 163xxx, 164xxx, 165xxx, 166xxx, 167xxx, 168xxx
// 场外基金:
//   000xxx, 001xxx, 002xxx, 003xxx, 004xxx, 005xxx, 006xxx, 007xxx, 008xxx, 009xxx
//   01xxxx, 02xxxx, etc.

interface FundCodeEntry {
  code: string;       // 基金代码
  pinyin: string;     // 拼音缩写
  name: string;       // 基金名称
  fundType: string;   // 基金类型(原始)
  pinyinFull: string; // 完整拼音
}

/**
 * 解析东方财富基金代码数据
 * 格式: var r = [["000001","HXCZHH","华夏成长混合","混合型-偏股","HXCZHH"],...]
 */
function parseFundCodeData(jsContent: string): FundCodeEntry[] {
  // Extract the array part
  const match = jsContent.match(/var\s+r\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!match) {
    throw new Error('Failed to parse fund code data: invalid format');
  }

  try {
    const arr = JSON.parse(match[1]);
    if (!Array.isArray(arr)) {
      throw new Error('Parsed data is not an array');
    }

    return arr.map((item: string[]) => ({
      code: item[0] || '',
      pinyin: item[1] || '',
      name: item[2] || '',
      fundType: item[3] || '',
      pinyinFull: item[4] || '',
    })).filter((item: FundCodeEntry) => item.code && item.name);
  } catch (e) {
    throw new Error(`Failed to parse fund code JSON: ${e}`);
  }
}

/**
 * 根据基金代码判断是否为场内ETF
 */
function isEtfCode(code: string): boolean {
  // 上海ETF: 510xxx, 511xxx, 512xxx, 513xxx, 514xxx, 515xxx, 516xxx, 517xxx, 518xxx
  if (/^51[0-8]\d{3}$/.test(code)) return true;
  // 深圳ETF: 159xxx
  if (/^159\d{3}$/.test(code)) return true;
  return false;
}

/**
 * 根据基金代码判断是否为场内LOF
 */
function isLofCode(code: string): boolean {
  // 上海LOF: 501xxx, 502xxx
  if (/^50[12]\d{3}$/.test(code)) return true;
  // 深圳LOF: 161xxx, 162xxx, 163xxx, 164xxx, 165xxx, 166xxx, 167xxx, 168xxx
  if (/^16[1-8]\d{3}$/.test(code)) return true;
  return false;
}

/**
 * 根据基金代码判断交易所
 */
function getExchange(code: string): 'SH' | 'SZ' | null {
  // 上海: 50xxxx, 51xxxx, 52xxxx
  if (/^5[012]\d{4}$/.test(code)) return 'SH';
  // 深圳: 15xxxx, 16xxxx
  if (/^1[56]\d{4}$/.test(code)) return 'SZ';
  return null;
}

/**
 * 规范化基金类型
 * 东方财富原始类型 -> 统一类型
 */
function normalizeFundType(rawType: string, code: string): string {
  if (!rawType) return '其他';

  // 根据原始类型映射
  const typeMap: Record<string, string> = {
    'ETF-场内': 'ETF-场内',
    '混合型-偏股': '混合型',
    '混合型-偏债': '混合型',
    '混合型-灵活': '混合型',
    '混合型-平衡': '混合型',
    '股票型': '股票型',
    '股票指数': '指数型',
    '联接基金': '指数型',
    '债券型-长债': '债券型',
    '债券型-中短债': '债券型',
    '债券型-混合债': '债券型',
    '债券型-可转债': '债券型',
    '债券指数': '债券型',
    'QDII-股票': 'QDII',
    'QDII-指数': 'QDII',
    'QDII-债券': 'QDII',
    'QDII-混合': 'QDII',
    'QDII-另类投资': 'QDII',
    'QDII-商品': 'QDII',
    '货币型': '货币型',
    '货币型-普通': '货币型',
    'FOF-股票': 'FOF',
    'FOF-混合': 'FOF',
    'FOF-债券': 'FOF',
    'FOF-目标风险': 'FOF',
    'FOF-目标日期': 'FOF',
    '另类投资': '另类投资',
    'REITs': 'REITs',
    '定开': '定开',
  };

  return typeMap[rawType] || rawType;
}

/**
 * 从东方财富获取全部基金代码数据
 */
async function fetchFundCodes(): Promise<FundCodeEntry[]> {
  const url = 'http://fund.eastmoney.com/js/fundcode_search.js';
  console.log(`📡 Fetching fund codes from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'http://fund.eastmoney.com/',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch fund codes: HTTP ${response.status}`);
  }

  const text = await response.text();
  const funds = parseFundCodeData(text);
  console.log(`✅ Parsed ${funds.length} fund codes`);

  return funds;
}

/**
 * 获取ETF/LOF实时行情数据
 */
async function fetchRealtimeQuotes(codes: string[]): Promise<Map<string, { nav: number; name: string }>> {
  const quoteMap = new Map<string, { nav: number; name: string }>();

  // Batch requests - process in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize);
    const secids = chunk.map(code => {
      const exchange = getExchange(code);
      if (exchange === 'SH') return `1.${code}`;
      if (exchange === 'SZ') return `0.${code}`;
      return null;
    }).filter(Boolean);

    if (secids.length === 0) continue;

    try {
      const url = `http://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids.join(',')}&fields=f2,f12,f14&ut=fa5fd1943c7b386f172d6893dbbd1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'http://quote.eastmoney.com/',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data?.diff) {
          for (const item of data.data.diff) {
            const code = String(item.f12 || '');
            const nav = parseFloat(item.f2) || 0;
            const name = String(item.f14 || '');
            if (code && nav > 0) {
              quoteMap.set(code, { nav, name });
            }
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️  Failed to fetch quotes batch ${i / chunkSize + 1}:`, e);
    }

    // Small delay to avoid rate limiting
    if (i + chunkSize < codes.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return quoteMap;
}

/**
 * 主函数: 采集并存储基金数据
 */
async function main() {
  console.log('🚀 Starting fund data collection...\n');

  // Step 1: Fetch all fund codes
  const allFunds = await fetchFundCodes();

  // Step 2: Classify and prepare data
  console.log('📊 Classifying funds...');

  const fundData = allFunds.map(fund => {
    const isEtf = isEtfCode(fund.code);
    const isLof = isLofCode(fund.code);
    const isOnMarket = isEtf || isLof;
    const exchange = getExchange(fund.code);
    const fundType = normalizeFundType(fund.fundType, fund.code);

    return {
      code: fund.code,
      name: fund.name,
      pinyin: fund.pinyin || fund.pinyinFull || null,
      fundType: isEtf ? 'ETF-场内' : isLof ? 'LOF' : fundType,
      market: 'A' as const,
      isOnMarket,
      isEtf,
      exchange,
    };
  });

  // Stats
  const etfCount = fundData.filter(f => f.isEtf).length;
  const lofCount = fundData.filter(f => f.fundType === 'LOF').length;
  const onMarketCount = fundData.filter(f => f.isOnMarket).length;
  const offMarketCount = fundData.filter(f => !f.isOnMarket).length;

  console.log(`📈 Classification results:`);
  console.log(`   - ETF (场内): ${etfCount}`);
  console.log(`   - LOF (场内): ${lofCount}`);
  console.log(`   - 场内基金合计: ${onMarketCount}`);
  console.log(`   - 场外基金: ${offMarketCount}`);
  console.log(`   - 总计: ${fundData.length}`);

  // Step 3: Fetch real-time quotes for on-market funds
  console.log('\n📡 Fetching real-time quotes for on-market funds...');
  const onMarketCodes = fundData.filter(f => f.isOnMarket).map(f => f.code);
  const quotes = await fetchRealtimeQuotes(onMarketCodes);
  console.log(`✅ Got quotes for ${quotes.size} on-market funds`);

  // Step 4: Upsert into database in batches
  console.log('\n💾 Storing funds in database...');
  const batchSize = 500;
  let stored = 0;

  for (let i = 0; i < fundData.length; i += batchSize) {
    const batch = fundData.slice(i, i + batchSize);

    for (const fund of batch) {
      const quote = quotes.get(fund.code);
      try {
        await prisma.fund.upsert({
          where: { code: fund.code },
          update: {
            name: fund.name,
            pinyin: fund.pinyin,
            fundType: fund.fundType,
            isOnMarket: fund.isOnMarket,
            isEtf: fund.isEtf,
            exchange: fund.exchange,
            ...(quote?.nav ? { nav: quote.nav } : {}),
          },
          create: {
            code: fund.code,
            name: fund.name,
            pinyin: fund.pinyin,
            fundType: fund.fundType,
            market: fund.market,
            isOnMarket: fund.isOnMarket,
            isEtf: fund.isEtf,
            exchange: fund.exchange,
            nav: quote?.nav || null,
          },
        });
        stored++;
      } catch (e) {
        console.warn(`⚠️  Failed to upsert fund ${fund.code}:`, e);
      }
    }

    // Progress
    const progress = Math.min(i + batchSize, fundData.length);
    process.stdout.write(`\r   Progress: ${progress}/${fundData.length} (${((progress / fundData.length) * 100).toFixed(1)}%)`);
  }

  console.log(`\n✅ Successfully stored ${stored} funds in database`);

  // Step 5: Verify
  const dbCount = await prisma.fund.count();
  const dbEtfCount = await prisma.fund.count({ where: { isEtf: true } });
  const dbOnMarketCount = await prisma.fund.count({ where: { isOnMarket: true } });

  console.log(`\n📋 Database verification:`);
  console.log(`   - Total funds in DB: ${dbCount}`);
  console.log(`   - ETFs in DB: ${dbEtfCount}`);
  console.log(`   - On-market funds in DB: ${dbOnMarketCount}`);

  // Verify specific funds that user mentioned
  const testCodes = ['513500', '513300', '510300', '510050', '159915', '512880'];
  console.log(`\n🔍 Verifying user-requested fund codes:`);
  for (const code of testCodes) {
    const fund = await prisma.fund.findUnique({ where: { code } });
    if (fund) {
      console.log(`   ✅ ${code}: ${fund.name} (${fund.fundType}, ${fund.isOnMarket ? '场内' : '场外'}, ${fund.exchange || '-'})`);
    } else {
      console.log(`   ❌ ${code}: NOT FOUND`);
    }
  }

  console.log('\n🎉 Fund data collection complete!');
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
