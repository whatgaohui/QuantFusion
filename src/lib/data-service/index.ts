/**
 * QuantFusion Data Service - Barrel Export
 *
 * Re-exports all public types and functions for backward compatibility.
 * Existing imports like `import { getQuote } from '@/lib/data-service'` continue to work.
 */

// Types
export type { ApiResponse, QuoteData, KlineData, NewsItem, SectorData, IndicatorData } from './types';

// Public API functions
export { getQuote, getQuotes } from './quotes';
export { getKline } from './kline';
export { getNews } from './news';
export { getSectors } from './sectors';
export { getIndicators } from './indicators-api';
export { searchSymbol } from './search';

// Shared utilities (for use by indicators.ts and other modules)
export { sma } from './math-utils';
