/**
 * Mock news generators for QuantFusion Data Service
 */

import type { NewsItem } from './types';

export function generateAShareNews(count: number): NewsItem[] {
  const templates = [
    { headline: '贵州茅台发布年度业绩报告，营收同比增长16.2%', relatedStocks: ['SH600519'], sentiment: 'bullish' },
    { headline: '中国平安回购计划持续推进，提振市场信心', relatedStocks: ['SH601318'], sentiment: 'bullish' },
    { headline: '招商银行净利润突破1500亿，不良贷款率下降', relatedStocks: ['SH600036'], sentiment: 'bullish' },
    { headline: '五粮液新品发布，高端白酒市场竞争加剧', relatedStocks: ['SZ000858'], sentiment: 'neutral' },
    { headline: '宁德时代全球动力电池市占率继续领先', relatedStocks: ['SZ300750'], sentiment: 'bullish' },
    { headline: 'A股三大指数集体收涨，成交额突破万亿', relatedStocks: ['SH000001', 'SZ399001'], sentiment: 'bullish' },
    { headline: '央行宣布降准0.5个百分点，释放流动性约1万亿', relatedStocks: ['SH601398', 'SZ000001'], sentiment: 'bullish' },
    { headline: '恒瑞医药创新药获批临床，研发管线稳步推进', relatedStocks: ['SH600276'], sentiment: 'bullish' },
    { headline: '隆基绿能光伏组件出货量创新高，海外订单增长', relatedStocks: ['SH601012'], sentiment: 'bullish' },
    { headline: '中信证券：看好A股中长期表现，建议关注消费板块', relatedStocks: ['SH600030'], sentiment: 'bullish' },
    { headline: '牧原股份生猪出栏量环比回升，猪周期拐点或至', relatedStocks: ['SZ002714'], sentiment: 'neutral' },
    { headline: '美的集团海外并购进展顺利，全球化布局加速', relatedStocks: ['SZ000333'], sentiment: 'bullish' },
    { headline: '创业板指冲高回落，科技股分化明显', relatedStocks: ['SZ399006'], sentiment: 'bearish' },
    { headline: '长江电力股息率超4%，防御性标的受追捧', relatedStocks: ['SH600900'], sentiment: 'neutral' },
    { headline: '山西汾酒三季度业绩超预期，清香型白酒市场扩容', relatedStocks: ['SH600809'], sentiment: 'bullish' },
    { headline: '紫金矿业金铜价格共振，业绩弹性凸显', relatedStocks: ['SH601899'], sentiment: 'bullish' },
    { headline: '中国中免免税销售恢复增长，海南离岛免税数据改善', relatedStocks: ['SH601888'], sentiment: 'bullish' },
    { headline: '立讯精密获大客户新订单，消费电子景气度回升', relatedStocks: ['SZ002475'], sentiment: 'bullish' },
    { headline: 'A股市场情绪指标：融资余额突破1.8万亿', relatedStocks: ['SH000001'], sentiment: 'neutral' },
    { headline: '泸州老窖国窖1573提价5%，高端白酒价格带上移', relatedStocks: ['SZ000568'], sentiment: 'bullish' },
  ];

  const sources = ['财联社', '东方财富', '同花顺', '证券时报', '上海证券报', '中国证券报', '第一财经', '华尔街见闻'];

  return templates.slice(0, count).map((item, idx) => {
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    return {
      id: `a-news-${idx}-${Date.now()}`,
      category: 'ashare',
      headline: item.headline,
      summary: item.headline,
      source: sources[Math.floor(Math.random() * sources.length)],
      url: '#',
      image: '',
      timestamp,
      relatedStocks: item.relatedStocks,
      sentiment: item.sentiment,
    };
  });
}

export function generateHKNews(count: number): NewsItem[] {
  const templates = [
    { headline: '腾讯控股回购力度加大，单日回购超10亿港元', relatedStocks: ['HK00700'], sentiment: 'bullish' },
    { headline: '阿里巴巴核心电商业务恢复增长，云业务扭亏在望', relatedStocks: ['HK09988'], sentiment: 'bullish' },
    { headline: '美团即时配送订单量创新高，本地生活赛道持续扩展', relatedStocks: ['HK03690'], sentiment: 'bullish' },
    { headline: '恒生指数调整成分股，新增多家新经济企业', relatedStocks: ['HSI'], sentiment: 'neutral' },
    { headline: '汇丰控股宣布新一轮回购计划，股东回报力度加大', relatedStocks: ['HK00005'], sentiment: 'bullish' },
    { headline: '小米汽车交付量持续攀升，产能爬坡顺利', relatedStocks: ['HK01810'], sentiment: 'bullish' },
    { headline: '友邦保险新业务价值增长超预期，内地市场拓展加速', relatedStocks: ['HK01299'], sentiment: 'bullish' },
    { headline: '中国移动5G用户数突破8亿，ARPU值稳步提升', relatedStocks: ['HK00941'], sentiment: 'neutral' },
    { headline: '京东物流收入增速领跑行业，供应链服务生态完善', relatedStocks: ['HK09618'], sentiment: 'bullish' },
    { headline: '理想汽车月交付突破5万辆，新车型L6受市场热捧', relatedStocks: ['HK02015'], sentiment: 'bullish' },
    { headline: '港股通南向资金持续净流入，低估值蓝筹受青睐', relatedStocks: ['HSI'], sentiment: 'bullish' },
    { headline: '百度文心大模型商业化加速，AI搜索用户突破2亿', relatedStocks: ['HK09888'], sentiment: 'bullish' },
    { headline: '港股市场情绪改善，恒指站上20000点关口', relatedStocks: ['HSI'], sentiment: 'bullish' },
    { headline: '小鹏汽车新车型MONA订单破10万，性价比路线获认可', relatedStocks: ['HK09868'], sentiment: 'bullish' },
    { headline: '港股IPO市场回暖，多家新经济企业排队上市', relatedStocks: ['HSI'], sentiment: 'neutral' },
  ];

  const sources = ['香港经济日报', '信报', '明报', '南华早报', '财华社', '智通财经', '格隆汇', '富途资讯'];

  return templates.slice(0, count).map((item, idx) => {
    const hoursAgo = Math.floor(Math.random() * 24);
    const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    return {
      id: `hk-news-${idx}-${Date.now()}`,
      category: 'hk',
      headline: item.headline,
      summary: item.headline,
      source: sources[Math.floor(Math.random() * sources.length)],
      url: '#',
      image: '',
      timestamp,
      relatedStocks: item.relatedStocks,
      sentiment: item.sentiment,
    };
  });
}

export function generateUSNews(count: number): NewsItem[] {
  const templates = [
    { headline: '美联储暗示降息，通胀数据显示降温迹象', sentiment: 'bullish' },
    { headline: '科技股财报强劲，纳斯达克指数再创新高', sentiment: 'bullish' },
    { headline: '苹果发布全线产品AI新功能', sentiment: 'bullish' },
    { headline: '微软云收入超预期，Azure增长加速', sentiment: 'bullish' },
    { headline: '英伟达继续主导AI芯片市场，数据中心收入激增', sentiment: 'bullish' },
    { headline: '标普500周线上涨，经济数据向好', sentiment: 'bullish' },
    { headline: '特斯拉交付量超预期，盘前股价上涨', sentiment: 'bullish' },
    { headline: '亚马逊云服务推出全新AI服务', sentiment: 'bullish' },
    { headline: '谷歌DeepMind蛋白质结构预测取得突破', sentiment: 'neutral' },
    { headline: '美国就业市场保持韧性，失业率稳定', sentiment: 'neutral' },
    { headline: 'OPEC+延长减产，油价飙升', sentiment: 'bearish' },
    { headline: '美银上调半导体板块展望', sentiment: 'bullish' },
    { headline: '消费者信心指数升至六个月高点', sentiment: 'bullish' },
    { headline: '道指从历史高点回落，获利了结', sentiment: 'neutral' },
    { headline: 'Meta加大元宇宙基础设施投资', sentiment: 'neutral' },
  ];

  const sources = ['路透社', '彭博社', 'CNBC', '华尔街日报', 'MarketWatch', '雅虎财经', '巴伦周刊', '金融时报'];

  return templates.slice(0, count).map((item, idx) => {
    const hoursAgo = Math.floor(Math.random() * 48);
    const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    return {
      id: `us-news-${idx}-${Date.now()}`,
      category: 'general',
      headline: item.headline,
      summary: item.headline,
      source: sources[Math.floor(Math.random() * sources.length)],
      url: '#',
      image: '',
      timestamp,
      sentiment: item.sentiment,
    };
  });
}
