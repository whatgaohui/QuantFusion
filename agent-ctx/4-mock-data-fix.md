# Task 4: Mock Data Fallback Fix

## Agent: Mock-Data-Fix
## Status: ✅ Complete

## Changes Made

### positions-view.tsx
- Removed mockActivePositions, mockClosedPositions, mockSummary, mockRiskMetrics
- Added zeroRiskMetrics constant
- calculateRiskMetrics returns zeroRiskMetrics for empty input, removed isZero mock substitution
- All fetchData fallback paths use empty state instead of mock
- Added prominent demo mode banner when isDemoRisk=true
- Summary/risk render fallbacks use `?? 0` instead of `|| mockSummary.*`

### watchlist-view.tsx
- Removed mockWatchlist, mockAlerts
- All fetchData fallback paths use empty arrays
- handleAddToWatchlist catch uses zero prices instead of random fake prices

### news-view.tsx
- Removed mockNews (~75 lines)
- All fetchNews fallback paths use empty array
- Filter uses `news || []` instead of `news || mockNews`

### backtest-view.tsx
- Kept generateMockBacktestResult (inherently simulation)
- Replaced small offline badge with prominent warning card
- Uses i18n keys for warning text

### i18n.ts
- Added: pos.demoBanner, pos.demoBannerDesc, back.simulatedWarning, back.simulatedWarningDesc
- Updated: pos.demoRiskHint

## Key Principle
Empty/failed API responses show honest empty states or error banners, never silently substituted mock data.
