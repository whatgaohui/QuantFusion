# Task 6: Frontend Critical/Major Fixes

## Agent: Main
## Date: 2025-05-28
## Status: ✅ Complete

## Summary

Fixed 3 critical/major issues in the QuantFusion Strategy Center, News view, and Positions view components.

## Changes Made

### 1. Strategy Center card grid overflow (CRITICAL)
- **File**: `src/components/dashboard/strategy-center-view.tsx`
- Added scrollable container wrapper (`max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar`) around strategy card grid
- Cards already had `truncate` for titles and responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`)

### 2. News title truncation (MAJOR)
- **File**: `src/components/dashboard/news-view.tsx`
- Added `overflow-hidden` to headline `<h4>` and summary `<p>` alongside existing `line-clamp-2` for proper CSS line-clamping

### 3. Positions view zero risk metrics (CRITICAL)
- **Files**: `src/components/dashboard/positions-view.tsx`, `src/lib/i18n.ts`
- Modified `calculateRiskMetrics()` to detect zero metrics and return mockRiskMetrics instead
- Added `isDemoRisk` state tracking
- Added yellow "Demo" badges on risk metric cards when using fallback values
- Added hint text "Insufficient data — showing demo values"
- Added i18n keys: `pos.demo` (Demo/演示), `pos.demoRiskHint`

## Lint: ✅ All modified files pass ESLint
