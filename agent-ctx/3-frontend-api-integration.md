# Task 3: Connect Frontend Views to Real API Endpoints

**Task ID**: 3
**Date**: 2025-05-28
**Status**: ✅ Complete

## Summary

Updated 4 frontend view components to fetch data from real API endpoints instead of using hardcoded mock data. Each component now shows loading states with Skeleton components and handles errors gracefully with fallback to mock data.

## Files Modified

### 1. `src/components/dashboard/dashboard-view.tsx`
- **Market Indices**: Changed from individual `/api/market/quote` calls to batch `/api/fusion/market/quote?symbols=SH000001,SZ399001,HSI,AAPL,GOOGL,MSFT`
- **A-Share & HK Indices**: Now uses SH000001 (SSE Composite), SZ399001 (SZSE Component), HSI (Hang Seng) from fusion API
- **US Proxy**: Uses AAPL, GOOGL, MSFT as US market proxy (free Finnhub doesn't support index quotes well)
- **Alerts**: Changed from hardcoded `defaultAlerts` to fetching from `/api/alerts` API with proper type mapping
- **Market Badges**: Uses i18n keys for market labels (`dash.marketA`, `dash.marketHK`, `dash.marketUS`)
- **Error Banner**: Added yellow error banner with retry button when API fails
- **Refreshing State**: Added `refreshing` state for background refresh (every 30s), distinct from initial `loading`
- **Alert Details**: Shows alert type info (price_above/price_below with target values) instead of generic messages

### 2. `src/components/dashboard/watchlist-view.tsx`
- **Real-time Quotes**: After fetching watchlist items from `/api/watchlist`, batch-fetches quotes from `/api/fusion/market/quote?symbols=...`
- **Price Loading**: Shows skeleton placeholders when quote data hasn't loaded yet (price=0)
- **Refresh Button**: Added "Refresh Prices" button that calls fusion batch quote API
- **Quote Status**: Shows "Refreshing prices..." indicator and error messages for quote failures
- **Market Badges**: Displays market badges (A/HK/US) on each watchlist card
- **Alert API Integration**: Creates alerts via `/api/alerts` POST, maps `alertType` to `direction` (price_above→above, price_below→below)
- **Alert Toggle/Delete**: Now calls PATCH/DELETE on `/api/alerts` API instead of local-only operations
- **Auto-refresh**: Periodic quote refresh every 30 seconds (was 5s, changed to 30s to reduce API calls)

### 3. `src/components/dashboard/positions-view.tsx`
- **Real-time Prices**: Fetches current prices from `/api/fusion/market/quote?symbols=...` for all active positions
- **P&L Calculation**: Recalculates P&L and P&L% from real current prices after quote fetch
- **Risk Metrics**: Now calculates VaR (95%), Sharpe Ratio, and Max Drawdown from actual position data:
  - VaR: Parametric 1-day 95% using portfolio std deviation
  - Sharpe: Annualized, assuming 5% risk-free rate
  - Max Drawdown: Based on cumulative P&L curve
- **DB Position Mapping**: Maps Prisma Position model fields to UI interface (avgCost→buyPrice, status mapping, lot tracking)
- **Market Badges**: Shows market badges (A/HK/US) on position rows
- **Error Banner**: Yellow warning banner for price fetch failures
- **Refreshing State**: Background refresh with spinning icon
- **Close Position**: Passes currentPrice as closePrice when closing via API

### 4. `src/components/dashboard/news-view.tsx`
- **Fusion API**: Switched from `/api/market/news` to `/api/fusion/market/news` which supports A/HK/US markets
- **Market Switcher**: Added A-Share/HK/US market toggle buttons with flag emojis (🇨🇳/🇭🇰/🇺🇸)
- **Sentiment Tags**: Properly displays bullish/bearish/neutral sentiment from API response
- **Related Stocks**: Shows related stocks with analyze buttons from API response
- **Category Labels**: Added `ashare` and `hk` category handling with proper colors
- **Error Handling**: Error banner with retry button when API fails
- **Refreshing State**: Spinning refresh icon during data fetch

### 5. `src/lib/i18n.ts`
- Added 28 new translation keys (14 English + 14 Chinese):
  - News market labels: `news.marketA`, `news.marketHK`, `news.marketUS`, `news.ashare`, `news.hk`, `news.refreshing`, `news.loadMore`
  - Dashboard extra: `dash.fetchError`, `dash.refreshing`, `dash.marketA`, `dash.marketHK`, `dash.marketUS`
  - Watchlist extra: `watch.refreshing`, `watch.quotesError`, `watch.refreshQuotes`
  - Positions extra: `pos.fetchingPrices`, `pos.pricesError`, `pos.calculatedFromData`, `pos.confidence95`, `pos.annualized`, `pos.portfolioLevel`

## Key Design Decisions

1. **Graceful Fallback**: All components fall back to mock data when APIs fail, keeping the UI usable
2. **Loading vs Refreshing**: Distinct states - `loading` for initial load (shows skeletons), `refreshing` for background refresh (spinning icon)
3. **Error Banners**: Yellow warning banners instead of blocking errors - user can still interact with the UI
4. **Batch Quotes**: Uses batch `/api/fusion/market/quote?symbols=...` to reduce API calls
5. **Risk Metrics Calculation**: VaR, Sharpe, Max Drawdown computed from real position data on the client
6. **Market Switcher**: News view has visual market toggle (A/HK/US) using the fusion API's market parameter
7. **Alert Type Mapping**: Fusion API alert types (price_above/price_below) mapped to UI direction (above/below)

## Lint Status
✅ `bun run lint` passes with no errors

## Dev Server
✅ Running on port 3000, all API endpoints responding correctly
