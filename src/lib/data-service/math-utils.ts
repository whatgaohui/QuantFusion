/**
 * Shared math utilities for QuantFusion Data Service
 * Used by both data-service modules and indicators.ts
 */

export function sma(data: number[], period: number): number {
  if (data.length < period) return data.length > 0 ? data[data.length - 1] : 0;
  const slice = data.slice(-period);
  return parseFloat((slice.reduce((sum, val) => sum + val, 0) / period).toFixed(4));
}
