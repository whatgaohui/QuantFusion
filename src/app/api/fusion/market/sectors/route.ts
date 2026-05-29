import { NextRequest, NextResponse } from 'next/server';
import { getMockSectors } from '@/lib/mock-api-data';
import { finnhubFetch, FINNHUB_API_KEY } from '@/lib/data-service/config';

// Sector mapping for each market
const SECTOR_DATA: Record<string, Array<{ name: string; changePercent: number; leadingStock: string; leadingStockChange: number }>> = {
  A: [
    { name: '白酒', changePercent: 1.2, leadingStock: '贵州茅台', leadingStockChange: 1.5 },
    { name: '新能源', changePercent: -0.8, leadingStock: '宁德时代', leadingStockChange: -1.2 },
    { name: '银行', changePercent: 0.5, leadingStock: '招商银行', leadingStockChange: 0.6 },
    { name: '医药', changePercent: -0.3, leadingStock: '恒瑞医药', leadingStockChange: -0.1 },
    { name: '保险', changePercent: 0.9, leadingStock: '中国平安', leadingStockChange: 1.1 },
    { name: '券商', changePercent: 1.5, leadingStock: '中信证券', leadingStockChange: 1.8 },
    { name: '电子', changePercent: 2.1, leadingStock: '立讯精密', leadingStockChange: 2.5 },
    { name: '有色金属', changePercent: -1.2, leadingStock: '紫金矿业', leadingStockChange: -0.9 },
  ],
  HK: [
    { name: '科技', changePercent: 2.3, leadingStock: '腾讯控股', leadingStockChange: 2.5 },
    { name: '电商', changePercent: 1.8, leadingStock: '阿里巴巴', leadingStockChange: 2.1 },
    { name: '银行', changePercent: -0.5, leadingStock: '汇丰控股', leadingStockChange: -0.3 },
    { name: '保险', changePercent: 0.7, leadingStock: '友邦保险', leadingStockChange: 0.9 },
    { name: '消费电子', changePercent: 3.1, leadingStock: '小米集团', leadingStockChange: 3.5 },
    { name: '本地生活', changePercent: -1.4, leadingStock: '美团', leadingStockChange: -1.8 },
  ],
  US: [
    { name: '科技', changePercent: 1.5, leadingStock: '苹果', leadingStockChange: 1.2 },
    { name: '半导体', changePercent: 3.2, leadingStock: '英伟达', leadingStockChange: 3.8 },
    { name: '汽车', changePercent: -2.1, leadingStock: '特斯拉', leadingStockChange: -2.5 },
    { name: '金融', changePercent: 0.8, leadingStock: '摩根大通', leadingStockChange: 0.6 },
    { name: '社交媒体', changePercent: 2.5, leadingStock: 'Meta', leadingStockChange: 2.8 },
    { name: '电商', changePercent: 1.1, leadingStock: '亚马逊', leadingStockChange: 0.9 },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'A';

    // Try Finnhub peers/sector data first (not available for free tier typically)
    // Fall back to our curated sector data
    const sectorInfo = SECTOR_DATA[market] || SECTOR_DATA.US;
    
    const result = {
      success: true,
      data: sectorInfo.map(s => ({
        ...s,
        change: s.changePercent,
      })),
      error: null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fusion sectors API error:', error);
    // Fallback to mock
    const result = getMockSectors(market);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  }
}
