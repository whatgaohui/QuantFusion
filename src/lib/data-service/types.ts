/**
 * Shared type definitions for QuantFusion Data Service
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface QuoteData {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number;
  timestamp: number;
  market: 'US' | 'A' | 'HK';
}

export interface KlineData {
  symbol: string;
  period: string;
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  v: number[];
  t: number[];
  s: string;
}

export interface NewsItem {
  id: string;
  category: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image: string;
  timestamp: string;
  relatedStocks?: string[];
  sentiment?: string;
}

export interface SectorData {
  name: string;
  change: number;
  changePercent: number;
  volume: number;
  leadingStock: string;
  leadingStockChange: number;
}

export interface IndicatorData {
  symbol: string;
  ma: Record<string, number>;
  macd: { macd: number; signal: number; histogram: number };
  rsi: Record<string, number>;
  bollinger: { upper: number; middle: number; lower: number; pricePosition: number };
  kdj: { k: number; d: number; j: number };
}
