/**
 * Mock sector generators for QuantFusion Data Service
 */

import type { SectorData } from './types';

export function generateAShareSectors(): SectorData[] {
  const sectors = [
    { name: '白酒', change: 1.85, leadingStock: '贵州茅台', leadingStockChange: 2.1 },
    { name: '银行', change: 0.52, leadingStock: '招商银行', leadingStockChange: 0.8 },
    { name: '保险', change: 1.23, leadingStock: '中国平安', leadingStockChange: 1.5 },
    { name: '医药', change: -0.68, leadingStock: '恒瑞医药', leadingStockChange: -0.3 },
    { name: '新能源', change: 2.15, leadingStock: '宁德时代', leadingStockChange: 2.8 },
    { name: '证券', change: 0.95, leadingStock: '中信证券', leadingStockChange: 1.2 },
    { name: '家电', change: 0.73, leadingStock: '美的集团', leadingStockChange: 0.9 },
    { name: '电子', change: -0.42, leadingStock: '立讯精密', leadingStockChange: -0.5 },
    { name: '矿业', change: 1.56, leadingStock: '紫金矿业', leadingStockChange: 1.8 },
    { name: '农业', change: -1.12, leadingStock: '牧原股份', leadingStockChange: -1.5 },
    { name: '电力', change: 0.38, leadingStock: '长江电力', leadingStockChange: 0.4 },
    { name: '旅游', change: 0.89, leadingStock: '中国中免', leadingStockChange: 1.1 },
  ];

  return sectors.map(s => ({
    name: s.name,
    change: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    changePercent: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    volume: Math.floor(5000000 + Math.random() * 50000000),
    leadingStock: s.leadingStock,
    leadingStockChange: parseFloat((s.leadingStockChange + (Math.random() - 0.5) * 0.3).toFixed(2)),
  }));
}

export function generateHKSectors(): SectorData[] {
  const sectors = [
    { name: '互联网', change: 2.35, leadingStock: '腾讯控股', leadingStockChange: 2.8 },
    { name: '银行', change: 0.65, leadingStock: '汇丰控股', leadingStockChange: 0.9 },
    { name: '保险', change: 1.12, leadingStock: '友邦保险', leadingStockChange: 1.4 },
    { name: '科技', change: 1.89, leadingStock: '小米集团', leadingStockChange: 2.2 },
    { name: '电商', change: 1.56, leadingStock: '阿里巴巴', leadingStockChange: 1.8 },
    { name: '汽车', change: -0.78, leadingStock: '理想汽车', leadingStockChange: -0.5 },
    { name: '通信', change: 0.42, leadingStock: '中国移动', leadingStockChange: 0.6 },
    { name: '综合企业', change: 0.28, leadingStock: '长和', leadingStockChange: 0.3 },
    { name: '电子', change: -0.35, leadingStock: '瑞声科技', leadingStockChange: -0.2 },
  ];

  return sectors.map(s => ({
    name: s.name,
    change: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    changePercent: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    volume: Math.floor(3000000 + Math.random() * 30000000),
    leadingStock: s.leadingStock,
    leadingStockChange: parseFloat((s.leadingStockChange + (Math.random() - 0.5) * 0.3).toFixed(2)),
  }));
}

export function generateUSSectors(): SectorData[] {
  const sectors = [
    { name: 'Technology', change: 1.85, leadingStock: 'NVDA', leadingStockChange: 2.4 },
    { name: 'Healthcare', change: 0.45, leadingStock: 'UNH', leadingStockChange: 0.6 },
    { name: 'Financials', change: 0.92, leadingStock: 'JPM', leadingStockChange: 1.1 },
    { name: 'Consumer Discretionary', change: 1.23, leadingStock: 'AMZN', leadingStockChange: 1.5 },
    { name: 'Energy', change: -0.56, leadingStock: 'XOM', leadingStockChange: -0.8 },
    { name: 'Industrials', change: 0.38, leadingStock: 'CAT', leadingStockChange: 0.5 },
    { name: 'Communication Services', change: 1.67, leadingStock: 'META', leadingStockChange: 2.0 },
    { name: 'Utilities', change: -0.23, leadingStock: 'NEE', leadingStockChange: -0.3 },
    { name: 'Real Estate', change: 0.15, leadingStock: 'PLD', leadingStockChange: 0.2 },
    { name: 'Materials', change: 0.72, leadingStock: 'LIN', leadingStockChange: 0.9 },
    { name: 'Consumer Staples', change: 0.31, leadingStock: 'PG', leadingStockChange: 0.4 },
  ];

  return sectors.map(s => ({
    name: s.name,
    change: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    changePercent: parseFloat((s.change + (Math.random() - 0.5) * 0.5).toFixed(2)),
    volume: Math.floor(10000000 + Math.random() * 80000000),
    leadingStock: s.leadingStock,
    leadingStockChange: parseFloat((s.leadingStockChange + (Math.random() - 0.5) * 0.3).toFixed(2)),
  }));
}
