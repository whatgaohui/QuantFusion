# Task 6-7: Connect Signal Scanner, Strategy Center, Backtest Views to Real APIs

**Task ID**: 6-7
**Agent**: Frontend Integration Agent
**Date**: 2025-05-28
**Status**: ✅ Complete

## Summary

Connected Signal Scanner, Strategy Center, and Backtest views to real API endpoints with graceful fallback to realistic mock/demo data when APIs are unavailable. All three views now show loading states, error handling, and maintain their existing UI design while adding new functionality.

## Files Modified

### 1. `src/components/dashboard/signal-scanner-view.tsx` — Complete rewrite

**Before**: Single-stock scanner with search, using old `/api/market/quote` and `/api/signals/scan` endpoints. Displayed mock signals from hardcoded popular stocks.

**After**: Multi-market signal scanner with sector-based scanning pipeline:

- **Scan Pipeline**: Click "Scan Market" → fetch sectors from `/api/fusion/market/sectors?market=X` → batch-fetch quotes from `/api/fusion/market/quote?symbols=...` → fetch indicators for each stock from `/api/fusion/market/indicators?symbol=XXX` → generate signals
- **Signal Generation**: Analyzes 5 technical indicator dimensions:
  - MA crossover (MA5 vs MA20) → golden cross / death cross
  - RSI overbought (>70) / oversold (<30)
  - MACD golden cross / death cross
  - Bollinger band breakout (upper/lower)
  - KDJ golden cross / death cross
- **Signal Strength**: strong (4+ agreeing indicators), medium (2-3), weak (0-1)
- **Signal Score**: 0-100 calculated from dominant indicator count ratio
- **Market-specific stock lists**: A-share (12 stocks), HK (10 stocks), US (10 stocks)
- **Hot Sectors display**: Shows sector badges with change percentages after scan
- **Scan Results Grid**: Cards with signal type badge, strength badge, indicator tags, score bar
- **Detail Panel**: Selected signal shows price chart (recharts), signal indicator breakdown badges, technical indicators panel (RSI, MACD, Bollinger, KDJ)
- **Loading States**: Phase-based progress (Scanning sectors → Analyzing stocks → Generating signals)
- **Offline indicator**: Shows warning badge when APIs fail
- **All text uses t() for i18n**

### 2. `src/components/dashboard/strategy-center-view.tsx` — Enhanced with API + navigation

**Before**: 15 hardcoded strategies with search/filter. No API integration.

**After**: Strategy center with AI service integration:

- **API Fetch**: On mount, tries `GET /api/fusion/strategies` first
- **Fallback**: If API returns 502/error, uses existing 15 hardcoded strategies as fallback
- **Source Indicator**: Badge at top shows "AI Service" (Wifi icon, purple) or "Local Presets" (WifiOff icon, zinc)
- **Per-strategy Source Badge**: Each card shows "AI Generated" (Brain icon), "Built-in" (Database icon), or "Custom" (Plus icon)
- **Backtest Navigation**: Clicking "Backtest" on any strategy calls `onBacktest(strategyId)` callback, which switches view to backtest with the selected strategy pre-filled
- **Custom Strategy Creation**: New strategies are saved to local state with `source: 'custom'`
- **Props**: Added `onBacktest?: (strategyId: string) => void` prop
- **Combined strategy list**: AI + built-in + custom strategies displayed together

### 3. `src/components/dashboard/backtest-view.tsx` — Enhanced with API + realistic mock

**Before**: 7 strategies in selector, simple mock equity curve generator, basic trade list.

**After**: Full-featured backtest with API call and realistic fallback:

- **API Call**: `POST /api/fusion/backtest/run` with full config on "Run Backtest"
- **Realistic Mock Fallback**: If API fails (502/timeout), generates detailed mock results:
  - Total return: -20% to +80% (random)
  - Sharpe ratio: 0.3-2.5
  - Max drawdown: -5% to -35%
  - Win rate: 40-65%
  - Profit factor: 0.5-3.0
  - Annual return: calculated from total return and date range
  - Equity curve: 50-100+ data points with trend + noise, respecting date range
  - Trade list: 10-30 trades with entry/exit dates, prices, quantities, P&L
- **15 Strategies**: Full list matching StrategyCenterView's built-in strategies
- **Symbol Input**: Added symbol field to config form
- **8 Metric Cards**: Total Return, Return %, Win Rate, Max Drawdown, Sharpe Ratio, Total Trades, Profit Factor, Annual Return
- **Enhanced Trade Table**: 8 columns (Symbol, Side, Entry Date, Exit Date, Entry Price, Exit Price, Quantity, P&L)
- **Offline Mode Indicator**: Yellow badge "Offline Mode — Simulated Results" shown when using mock data
- **Props**: Added `initialStrategy?: string` prop for navigation from Strategy Center
- **Scrollable trade list**: max-h-96 with custom scrollbar

### 4. `src/app/page.tsx` — Updated for backtest navigation

- Added `backtestStrategy` state and `handleBacktest` callback
- `ViewRenderer` now receives `onBacktest` and `backtestStrategy` props
- Clicking "Backtest" in Strategy Center navigates to Backtest view with strategy pre-selected

### 5. `src/lib/i18n.ts` — Added 40+ new translation keys

**English + Chinese** keys added:
- Scanner: `scanMarket`, `scanResults`, `hotSectors`, `signalsFound`, `noSignals`, `scanError`, `signalStrength`, `strong`/`medium`/`weak`, `maCross`, `rsiSignal`, `macdCross`, `bollingerBreak`, `kdjCross`, `goldenCross`, `deathCross`, `overboughtSignal`, `oversoldSignal`, `breakoutUp`, `breakoutDown`, `scanningSectors`, `analyzingStocks`, `generatingSignals`
- Strategy: `aiService`, `localPresets`, `sourceLabel`, `aiGenerated`, `builtInLabel`, `customCreated`, `backtestThis`, `goToBacktest`
- Backtest: `symbol`, `offlineMode`, `realtimeMode`, `entryDate`, `exitDate`, `entryPrice`, `exitPrice`, `quantity`, `avgHoldingDays`, `profitFactor`, `annualReturn`

## Design Decisions

- Signal scanner uses a 3-phase pipeline (sectors → quotes → indicators) for realistic scanning feel
- Indicator analysis produces discrete signal types (golden/death cross, overbought/oversold) plus a composite score and strength rating
- Strategy source is clearly but subtly indicated with colored badges (AI=purple, Built-in=zinc, Custom=cyan)
- Backtest mock generator produces realistic metrics (Sharpe 0.3-2.5, not 0-5; win rate 40-65%, not 30-90%)
- Equity curve has trend + noise pattern, not pure random walk
- All three views gracefully handle API failures and always show useful data
- Strategy→Backtest navigation is seamless via props and state in page.tsx
- Backtest initial strategy is set via useEffect when prop changes, allowing re-navigation

## Lint Status
✅ `bun run lint` passes with no errors
