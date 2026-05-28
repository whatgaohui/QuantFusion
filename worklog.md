---
Task ID: 1
Agent: Main Orchestrator
Task: Build QuantFlow trading dashboard from scratch

Work Log:
- Analyzed both OpenStock and quant projects in detail
- Set up Finnhub API key in .env
- Created Prisma schema with WatchlistItem, Position, Alert, TradeLog, SignalResult models
- Pushed schema to SQLite database
- Built 13 API routes: market/quote, market/search, market/news, market/profile, market/candle, market/symbols, portfolio/positions, portfolio/check, portfolio/summary, watchlist, alerts, signals/scan, trades
- Created technical indicator library (RSI, MACD, Bollinger Bands, KDJ, Volume Ratio)
- Built complete frontend dashboard with 7 views: Dashboard, Signal Scanner, Positions, Watchlist, News, Backtest, Settings
- Dark theme with emerald/teal accents, collapsible sidebar, responsive design
- Fixed Finnhub candle API (free tier doesn't support candles, now generates realistic mock data based on real-time quotes)
- Enhanced signal scanner with GET endpoint that auto-fetches data and runs analysis
- Updated watchlist to use real Finnhub search API for adding stocks
- Updated dashboard to fetch all 3 market indices (S&P 500, NASDAQ, DOW) simultaneously

Stage Summary:
- Full-stack quant trading dashboard operational with real Finnhub market data
- Signal scanner with RSI/MACD/Bollinger/KDJ/Volume scoring engine
- 7-day cycle position management with auto-check
- All 7 dashboard views functional with loading/error states
- Lint clean, page loading with 200 status codes

---
Task ID: 2
Agent: Main Orchestrator
Task: Add Chinese/English language switching to the QuantFlow dashboard

Work Log:
- Created i18n internationalization system at `/src/lib/i18n.ts` using Zustand store
- Defined complete translation dictionaries for both English (en) and Chinese (zh) with 130+ translation keys
- Added language toggle button in sidebar (with Globe icon, shows "中文"/"English")
- Added dedicated Language card in Settings page with two language option buttons
- Updated all 7 dashboard components to use `t()` translation function:
  - page.tsx (header title, footer, date formatting)
  - sidebar.tsx (nav items, collapse button, language toggle)
  - dashboard-view.tsx (metric cards, market indices, allocation, trades, quick actions)
  - signal-scanner-view.tsx (search, price chart, indicators, AI sentiment, popular stocks)
  - positions-view.tsx (summary cards, active/closed positions, close confirmation dialog)
  - watchlist-view.tsx (search, alerts, create alert dialog)
  - news-view.tsx (category filter, news grid, empty states)
  - backtest-view.tsx (config form, results metrics, equity curve)
  - settings-view.tsx (API config, trading params, notifications, language selector, about)
- Date formatting adapts to language (en-US vs zh-CN locale)
- Toast messages also translated
- Lint clean with 0 errors

Stage Summary:
- Complete Chinese/English language switching implemented across the entire dashboard
- Two language switching points: sidebar bottom button + Settings page Language card
- All UI text (navigation, labels, buttons, placeholders, descriptions, error messages) fully translated
- Language state managed via Zustand, persists during session

---
Task ID: 4
Agent: Architecture Designer
Task: Design fusion architecture for 4 stock analysis projects

Work Log:

# 🏗️ 四合一股票分析平台融合架构设计文档

> **项目代号**: QuantFusion  
> **版本**: v1.0  
> **日期**: 2026-03-04  
> **目标**: 将 daily_stock_analysis、TradingAgents-CN、go-stock、OpenStock 四个开源项目融合为一个统一的高性能 Web 应用

---

## 1. 融合总览

### 1.1 为什么要融合

当前四个项目各自独立发展，存在严重的**能力碎片化**问题：

| 能力维度 | daily_stock_analysis | TradingAgents-CN | go-stock | OpenStock |
|---------|---------------------|-------------------|----------|-----------|
| 数据源数量 | 11 | 3 | 10+ | 1 (Finnhub) |
| AI Agent 架构 | 5 Agent 多模式 | 11+ Agent LangGraph | React+PlanExecute | 简单 AI 调用 |
| 通知通道 | 13 | 2 | 1 (DingTalk) | 0 |
| 前端技术栈 | React+Vite | Vue3+ElementPlus | Vue3+NaiveUI | Next.js+shadcn |
| 实时行情 | 一般 | SSE+WebSocket | ⭐ Go原生高性能 | Widget嵌入 |
| 认证系统 | 无 | 无 | 无 | ⭐ Better Auth |
| 情感分析 | 无 | 无 | ⭐ 自研NLP | Adanos第三方 |
| 策略系统 | ⭐ 15策略YAML | 无 | Skill系统 | 无 |
| 辩论机制 | 无 | ⭐ Bull/Bear辩论 | 无 | 无 |
| 反思记忆 | 无 | ⭐ ChromaDB向量 | 无 | 无 |
| 桌面支持 | Electron | 无 | ⭐ Wails | 无 |
| 现代Web架构 | 一般 | 一般 | 一般 | ⭐ Next.js App Router |

**核心矛盾**：
- **Python 项目**（P1、P2）AI 能力强但性能差，不适合处理高频实时数据
- **Go 项目**（P3）数据性能强但 AI 生态弱，无法直接调用 LangChain/LangGraph
- **Next.js 项目**（P4）架构优雅但功能单薄，缺少核心业务逻辑
- **前端技术栈分裂**：React vs Vue，Vite vs Next.js，ElementPlus vs NaiveUI vs shadcn

**融合价值**：一个平台同时拥有 Go 的高性能数据引擎 + Python 的顶级 AI 能力 + Next.js 的现代 Web 体验 = **1+1+1+1 > 4**

### 1.2 融合策略概述

采用 **"微服务内核 + 统一前端"** 策略：

```
┌─────────────────────────────────────────────────────────┐
│                    融合策略三原则                          │
├─────────────────────────────────────────────────────────┤
│ 1. 语言优势保留：Go做数据、Python做AI、TS做Web            │
│ 2. 最优实现优先：每个功能模块取四项目中最佳实现              │
│ 3. 渐进式融合：分三期交付，每期可独立运行                   │
└─────────────────────────────────────────────────────────┘
```

**关键决策**：
- ✅ 统一为 Web 应用（不含桌面端），去掉 Electron/Wails
- ✅ 前端统一 Next.js 15 + React 19 + shadcn/ui（与现有 quant 项目一致）
- ✅ 后端拆为 3 个微服务：Go 数据服务 + Python AI 服务 + Next.js BFF 层
- ✅ 数据库统一 SQLite（WAL 模式），零外部依赖
- ✅ 通信协议：gRPC（服务间内部）+ REST/WebSocket/SSE（对外）

---

## 2. 架构全景图

### 2.1 顶层架构

```
                          ┌──────────────────┐
                          │    用户浏览器      │
                          └────────┬─────────┘
                                   │ HTTPS
                                   ▼
                        ┌─────────────────────┐
                        │   反向代理 (TLS)     │
                        │   路由分发           │
                        └─────┬───────┬───────┘
                              │       │
                 ┌────────────┘       └────────────┐
                 │                                  │
                 ▼                                  ▼
    ┌─────────────────────┐            ┌──────────────────────┐
    │  Next.js 主服务       │            │  WebSocket Gateway    │
    │  (BFF + 前端SSR)     │            │  代理到Go数据服务      │
    │  Port: 3000          │            └──────────┬───────────┘
    └────────┬────────────┘                       │
             │                                     │
     ┌───────┴────────┐                   ┌───────┴────────┐
     │                │                   │                │
     ▼                ▼                   ▼                ▼
┌─────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ SQLite  │  │ Python AI    │  │ Go Data      │  │ Redis        │
│ (主库)   │  │ Service      │  │ Service      │  │ (可选缓存)    │
│         │  │ Port: 8000   │  │ Port: 8080   │  │ Port: 6379   │
└─────────┘  └──────┬───────┘  └──────┬───────┘  └──────────────┘
                    │                  │
                    │  ┌───────────────┘
                    │  │
                    ▼  ▼
              ┌───────────┐
              │  gRPC     │
              │  内部通信   │
              └───────────┘
```

### 2.2 服务依赖关系图

```
                    ┌────────────────┐
                    │   用户请求      │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  页面渲染   │ │  API调用   │ │  实时推送   │
     │  (SSR/SSG) │ │  (REST)    │ │  (WS/SSE)  │
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │              │              │
           ▼              ▼              ▼
     ┌─────────────────────────────────────────┐
     │          Next.js BFF Layer              │
     │  - 页面路由 (App Router)                 │
     │  - API Gateway (REST → 各服务)           │
     │  - 认证鉴权 (Better Auth)                │
     │  - 会话管理                              │
     └──┬──────────┬──────────┬────────────────┘
        │          │          │
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────────┐
   │ SQLite │ │Go Data │ │Python AI   │
   │ 读写   │ │Service │ │Service     │
   └────────┘ └───┬────┘ └─────┬──────┘
                  │            │
           ┌──────┴──────┐    │
           ▼             ▼    ▼
    ┌────────────┐ ┌──────────────┐ ┌──────────────┐
    │ 行情数据源   │ │ SQLite(只读) │ │ LLM Providers│
    │ Sina/Tencent│ │  + Redis缓存 │ │ (OpenAI等)   │
    │  /Finnhub  │ └──────────────┘ └──────────────┘
    └────────────┘
```

### 2.3 数据流向全景

```
 [外部数据源]                    [内部处理]                   [用户触达]
 ──────────────                ─────────────               ─────────────
 
 Sina/Tencent ──┐
 EastMoney ────┤
 Tushare ──────┤
 AkShare ──────┤──→ Go Data Service ──→ SQLite ──→ Next.js BFF ──→ 用户
 Finnhub ──────┤     (实时采集+清洗)      (持久化)    (聚合渲染)      (浏览)
 Baostock ─────┤         │                                              │
 yfinance ─────┤         │                                              │
 Xueqiu ───────┘         ▼                                              ▼
                  WebSocket推送 ──────────────────────────────→ 实时行情更新
                  
 [用户分析请求] ──→ Next.js BFF ──→ Python AI Service ──→ LLM ──→ 分析报告
                                    (Agent编排+策略)       │
                                           │              ▼
                                           ▼         ChromaDB向量库
                                    gRPC→Go Data ──→ 获取行情数据
                                           │
                                           ▼
                                    通知服务 ──→ WeChat/Feishu/Telegram/...
```

---

## 3. 各项目优势提取

### 3.1 从 daily_stock_analysis 提取

| 提取模块 | 原始实现 | 融合方案 | 优先级 |
|---------|---------|---------|-------|
| **15策略YAML系统** | `skills/` 目录下15个YAML文件 | 完整移植为 `strategies/` 模块，支持热加载 | P0 |
| **13通知通道** | `notifier/` 目录，统一接口 | 完整移植为 `notifications/` 微服务模块 | P0 |
| **11数据源 fallback** | 多级fallback链 | 移植fallback逻辑到Go数据服务层 | P0 |
| **FIFO持仓追踪** | SQLite FIFO lot tracking | 移植到统一数据模型 | P1 |
| **4种分析模式** | quick/standard/full/specialist | 融入Agent编排器作为分析模式参数 | P1 |
| **Portfolio Agent** | 5个专用Agent | 融入Python AI服务的Agent架构 | P1 |
| **Bot集成** | DingTalk/Feishu/Discord/Telegram | 融入通知系统 | P2 |
| **Vision图片识别** | 截图提取股票代码 | 保留为可选功能 | P2 |
| **200+配置参数** | YAML配置文件 | 精简为统一配置体系 | P1 |

### 3.2 从 TradingAgents-CN 提取

| 提取模块 | 原始实现 | 融合方案 | 优先级 |
|---------|---------|---------|-------|
| **LangGraph Agent架构** | 11+ Agent，图式编排 | 作为Python AI服务的核心编排引擎 | P0 |
| **Bull/Bear辩论机制** | 多空辩论→风险管理辩论→决策 | 直接纳入Agent工作流 | P0 |
| **ChromaDB反思记忆** | 向量化历史分析+反思学习 | 完整移植为AI记忆子系统 | P1 |
| **双模型配置** | quick_thinking + deep_thinking | 纳入LLM统一调度层 | P0 |
| **Paper Trading模拟** | 模拟盘交易 | 移植到交易模块 | P2 |
| **多维度选股** | 技术面+基本面+资金面+情绪面 | 纳入信号扫描模块 | P1 |
| **报告导出** | Markdown/Word/PDF | 纳入导出服务 | P2 |
| **Token用量追踪** | 记录每次LLM调用token | 纳入LLM统一调度层 | P1 |
| **15+定时任务** | APScheduler | 逻辑移植到Go调度服务 | P1 |
| **12+ LLM Provider** | OpenAI/Google/Anthropic等 | 纳入LLM统一调度层 | P0 |

### 3.3 从 go-stock 提取

| 提取模块 | 原始实现 | 融合方案 | 优先级 |
|---------|---------|---------|-------|
| **高性能行情采集** | Go goroutine并发+连接池 | Go数据服务的核心引擎 | P0 |
| **A股数据源生态** | Sina/Tencent/EastMoney/TongDaXin等 | 完整移植为Go数据源驱动 | P0 |
| **自研NLP情感分析** | 中文金融词典+权重打分 | 独立为情感分析微模块 | P0 |
| **iWencai自然语言选股** | 问财接口封装 | 移植为高级选股功能 | P1 |
| **MCP Server** | Model Context Protocol | 保留为AI Agent工具层 | P2 |
| **70+金融工具** | Agent可调用的工具集 | 纳入AI Agent工具注册表 | P1 |
| **TradingView轻量图表** | Lightweight Charts集成 | 前端图表组件 | P0 |
| **Cron任务管理** | Go cron调度器 | 纳入统一调度系统 | P1 |
| **Skill系统** | 可扩展技能定义 | 与策略YAML融合 | P2 |

### 3.4 从 OpenStock 提取

| 提取模块 | 原始实现 | 融合方案 | 优先级 |
|---------|---------|---------|-------|
| **Next.js App Router** | 现代SSR/SSG路由 | 直接作为前端主框架 | P0 |
| **Better Auth** | Email/Password认证 | 完整移植为认证层 | P0 |
| **shadcn/ui组件库** | 统一设计系统 | 直接使用 | P0 |
| **TradingView Widget** | 嵌入式图表/热力图/技术分析 | 保留为行情展示组件 | P0 |
| **Cmd+K搜索面板** | 全局搜索 | 移植为全局搜索组件 | P1 |
| **Inngest后台任务** | 邮件/提醒/清理 | 逻辑移植，实现改用BullMQ | P2 |
| **Price Alert** | ABOVE/BELOW价格提醒 | 纳入通知+调度系统 | P1 |
| **Docker部署** | Dockerfile+Compose | 扩展为多服务Docker Compose | P0 |
| **Dark Theme** | 暗色主题 | 默认主题方案 | P0 |

---

## 4. 微服务架构设计

### 4.1 服务职责矩阵

```
┌─────────────────────────────────────────────────────────────────────┐
│                        QuantFusion 微服务架构                        │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│              │ Next.js 主服务 │ Go 数据服务  │ Python AI 服务        │
│              │ (BFF + SSR)  │ (Data Engine)│ (Intelligence Engine) │
├──────────────┼──────────────┼──────────────┼───────────────────────┤
│ 语言         │ TypeScript   │ Go 1.26      │ Python 3.12           │
│ 框架         │ Next.js 15   │ Gin/Fiber    │ FastAPI               │
│ 端口         │ 3000         │ 8080         │ 8000                  │
│ 主数据库     │ SQLite (RW)  │ SQLite (RW)  │ SQLite (RO)           │
│ 缓存         │ -            │ Redis(可选)   │ -                     │
│ 通信         │ REST/gRPC    │ gRPC/WS/SSE  │ gRPC/REST             │
│ 进程管理     │ Node.js      │ 原生二进制    │ Uvicorn               │
│ 部署         │ Docker       │ Docker       │ Docker                │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
```

### 4.2 Next.js 主服务 (BFF + Frontend)

**职责边界**：
- 用户认证与授权 (Better Auth)
- 页面路由与 SSR/SSG 渲染
- API Gateway：REST 请求路由到 Go/Python 服务
- WebSocket/SSE 代理：将 Go 服务的实时数据推送到前端
- 静态资源服务
- 配置管理入口

**核心模块**：

```
nextjs-service/
├── src/
│   ├── app/                    # App Router 页面
│   │   ├── (auth)/             # 认证路由组
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/        # 主面板路由组
│   │   │   ├── page.tsx        # 仪表盘首页
│   │   │   ├── analysis/       # AI分析
│   │   │   ├── portfolio/      # 持仓管理
│   │   │   ├── scanner/        # 选股器
│   │   │   ├── strategies/     # 策略中心
│   │   │   ├── alerts/         # 提醒管理
│   │   │   ├── backtest/       # 回测
│   │   │   ├── news/           # 资讯
│   │   │   ├── scheduler/      # 调度管理
│   │   │   └── settings/       # 系统设置
│   │   └── api/                # API 路由
│   │       ├── auth[...nextauth]/
│   │       ├── market/         # → Go Data Service
│   │       ├── analysis/       # → Python AI Service
│   │       ├── portfolio/      # → SQLite 直连
│   │       ├── strategies/     # → Python AI Service
│   │       ├── notifications/  # → 通知调度
│   │       └── scheduler/      # → Go Data Service
│   ├── lib/
│   │   ├── auth.ts             # Better Auth 配置
│   │   ├── grpc-client.ts      # gRPC 客户端 (连接Go/Python)
│   │   ├── db.ts               # Prisma/Drizzle SQLite 客户端
│   │   ├── service-proxy.ts    # 服务代理工具
│   │   └── config.ts           # 运行时配置
│   ├── components/             # UI 组件
│   └── hooks/                  # React Hooks
├── prisma/
│   └── schema.prisma           # 数据库 Schema
├── next.config.ts
├── Dockerfile
└── package.json
```

**API Gateway 路由规则**：

```typescript
// src/lib/service-proxy.ts — 服务路由映射
const SERVICE_ROUTES = {
  // 行情数据 → Go Data Service
  '/api/market/*':     { service: 'go-data',   protocol: 'grpc'  },
  '/api/ws/realtime':  { service: 'go-data',   protocol: 'ws'    },
  
  // AI 分析 → Python AI Service
  '/api/analysis/*':   { service: 'python-ai',  protocol: 'grpc'  },
  '/api/agent/*':      { service: 'python-ai',  protocol: 'grpc'  },
  '/api/sse/analysis': { service: 'python-ai',  protocol: 'sse'   },
  
  // 持仓/交易 → SQLite 直连 (Next.js内处理)
  '/api/portfolio/*':  { service: 'local',      protocol: 'sqlite'},
  '/api/trades/*':     { service: 'local',      protocol: 'sqlite'},
  '/api/auth/*':       { service: 'local',      protocol: 'local' },
  
  // 通知 → Python AI Service (通知模块在此服务)
  '/api/notify/*':     { service: 'python-ai',  protocol: 'grpc'  },
};
```

### 4.3 Go 数据服务 (Data Engine)

**职责边界**：
- 实时行情采集与推送（WebSocket/SSE）
- 历史K线数据获取与缓存
- 多数据源管理与 fallback
- 定时任务调度（Cron）
- NLP 情感分析（自研金融词典）
- iWencai 自然语言选股代理
- 技术指标计算（高性能版）
- 数据清洗与标准化

**核心模块**：

```
go-data-service/
├── cmd/
│   └── server/
│       └── main.go             # 入口
├── internal/
│   ├── server/                 # gRPC + HTTP + WS 服务器
│   │   ├── grpc.go
│   │   ├── http.go
│   │   └── websocket.go
│   ├── datasource/             # 数据源驱动
│   │   ├── registry.go         # 数据源注册表
│   │   ├── fallback.go         # 多级 Fallback 引擎
│   │   ├── sina/               # 新浪财经
│   │   ├── tencent/            # 腾讯财经
│   │   ├── eastmoney/          # 东方财富
│   │   ├── tushare/            # Tushare
│   │   ├── tongdaxin/          # 通达信
│   │   ├── xueqiu/             # 雪球
│   │   ├── cls/                # 财联社
│   │   ├── wallstreetcn/       # 华尔街见闻
│   │   ├── iwencai/            # 问财选股
│   │   ├── finnhub/            # Finnhub (美股)
│   │   ├── yfinance/           # Yahoo Finance
│   │   ├── longbridge/         # 长桥 (港股)
│   │   └── akshare/            # AKShare (Python桥接)
│   ├── scheduler/              # Cron 调度器
│   │   ├── scheduler.go
│   │   └── jobs/               # 定时任务定义
│   ├── sentiment/              # NLP 情感分析
│   │   ├── analyzer.go
│   │   ├── dict.go             # 金融词典
│   │   └── weights.go          # 权重配置
│   ├── indicator/              # 技术指标计算
│   │   ├── ma.go
│   │   ├── macd.go
│   │   ├── rsi.go
│   │   ├── bollinger.go
│   │   └── kdj.go
│   ├── cache/                  # Redis 缓存层 (可选)
│   │   └── cache.go
│   ├── model/                  # 数据模型
│   └── repo/                   # 数据库操作 (GORM)
├── proto/                      # gRPC protobuf 定义
│   ├── market.proto
│   ├── scheduler.proto
│   └── sentiment.proto
├── Dockerfile
└── go.mod
```

**数据源 Fallback 链设计**（从 P1 提取，Go 重写）：

```go
// 数据源优先级配置 — 按市场分组
var DataSourcePriority = map[string][]string{
    "A_stock_quote":    {"sina", "tencent", "eastmoney", "tongdaxin"},
    "A_stock_kline":    {"tencent", "sina", "tushare", "eastmoney"},
    "A_stock_sector":   {"eastmoney", "tencent", "sina"},
    "A_stock_news":     {"cls", "eastmoney", "wallstreetcn"},
    "HK_stock_quote":   {"tencent", "longbridge", "sina"},
    "HK_stock_kline":   {"tencent", "longbridge", "yfinance"},
    "US_stock_quote":   {"finnhub", "yfinance", "sina"},
    "US_stock_kline":   {"yfinance", "finnhub", "tushare"},
    "sentiment_cn":     {"iwencai", "xueqiu", "eastmoney"},
    "sentiment_en":     {"finnhub", "reuters"},
}

// Fallback 执行逻辑
func (r *Registry) FetchWithFallback(ctx context.Context, category string, params Params) (Data, error) {
    sources, ok := DataSourcePriority[category]
    if !ok {
        return nil, fmt.Errorf("unknown category: %s", category)
    }
    var lastErr error
    for _, sourceName := range sources {
        source := r.Get(sourceName)
        data, err := source.Fetch(ctx, params)
        if err == nil {
            return data, nil
        }
        lastErr = err
        log.Warn().Str("source", sourceName).Err(err).Msg("fallback to next source")
    }
    return nil, fmt.Errorf("all sources failed, last error: %w", lastErr)
}
```

### 4.4 Python AI 服务 (Intelligence Engine)

**职责边界**：
- Multi-Agent 分析编排（LangGraph）
- LLM 统一调度（12+ Provider）
- 策略执行引擎（YAML-based）
- 辩论式分析（Bull/Bear/Risk/Decision）
- 向量记忆与反思学习（ChromaDB）
- 通知分发（13通道）
- 报告生成与导出
- Paper Trading 模拟
- Backtesting 回测引擎

**核心模块**：

```
python-ai-service/
├── app/
│   ├── main.py                 # FastAPI 入口
│   ├── grpc_server.py          # gRPC 服务端
│   ├── config/                 # 配置管理
│   │   └── settings.py
│   ├── llm/                    # LLM 统一调度层
│   │   ├── router.py           # 模型路由 (quick/deep)
│   │   ├── providers/          # 12+ Provider
│   │   │   ├── openai.py
│   │   │   ├── deepseek.py
│   │   │   ├── anthropic.py
│   │   │   ├── google.py
│   │   │   ├── qwen.py
│   │   │   ├── glm.py
│   │   │   ├── ollama.py
│   │   │   ├── volcengine.py
│   │   │   ├── openrouter.py
│   │   │   ├── finnhub_llm.py
│   │   │   ├── alphavantage.py
│   │   │   └── base.py
│   │   ├── token_tracker.py    # Token 用量追踪
│   │   └── fallback.py         # Provider Fallback
│   ├── agents/                 # Agent 系统 (LangGraph)
│   │   ├── graph.py            # 主工作流图
│   │   ├── nodes/              # Agent 节点
│   │   │   ├── coordinator.py  # 协调器
│   │   │   ├── technical.py    # 技术分析Agent
│   │   │   ├── fundamental.py  # 基本面Agent
│   │   │   ├── sentiment.py    # 情感Agent
│   │   │   ├── bull.py         # 看多研究员
│   │   │   ├── bear.py         # 看空研究员
│   │   │   ├── risk.py         # 风险管理Agent
│   │   │   ├── portfolio.py    # 投资组合Agent
│   │   │   ├── decision.py     # 决策Agent
│   │   │   └── intel.py        # 情报Agent
│   │   ├── tools/              # Agent 工具集
│   │   │   ├── market_data.py  # 行情查询 (→Go gRPC)
│   │   │   ├── kline.py        # K线获取
│   │   │   ├── sector.py       # 板块排行
│   │   │   ├── news_search.py  # 新闻搜索
│   │   │   ├── sentiment.py    # 情感分析
│   │   │   ├── screening.py    # 选股
│   │   │   ├── iwencai.py      # 问财选股
│   │   │   └── mcp_bridge.py   # MCP 协议桥接
│   │   └── state.py            # 共享状态定义
│   ├── strategies/             # 策略引擎
│   │   ├── engine.py           # 策略执行器
│   │   ├── loader.py           # YAML 热加载
│   │   └── presets/            # 15 内置策略
│   │       ├── ma_crossover.yaml
│   │       ├── rsi_divergence.yaml
│   │       ├── macd_signal.yaml
│   │       └── ...
│   ├── memory/                 # 向量记忆系统
│   │   ├── chroma_store.py     # ChromaDB 存储
│   │   ├── reflector.py        # 反思学习
│   │   └── embeddings.py       # 嵌入生成
│   ├── notifications/          # 通知系统
│   │   ├── dispatcher.py       # 统一分发器
│   │   ├── channels/           # 13 通知通道
│   │   │   ├── wechat.py
│   │   │   ├── feishu.py
│   │   │   ├── telegram.py
│   │   │   ├── email.py
│   │   │   ├── discord.py
│   │   │   ├── slack.py
│   │   │   ├── pushover.py
│   │   │   ├── ntfy.py
│   │   │   ├── gotify.py
│   │   │   ├── pushplus.py
│   │   │   ├── serverchan.py
│   │   │   ├── webhook.py
│   │   │   └── astrbot.py
│   │   └── templates/          # 通知模板
│   ├── backtest/               # 回测引擎
│   │   ├── engine.py
│   │   └── report.py
│   ├── export/                 # 报告导出
│   │   ├── markdown.py
│   │   ├── word.py
│   │   └── pdf.py
│   └── repo/                   # 数据库操作 (SQLAlchemy)
├── proto/                      # gRPC protobuf 定义
│   ├── agent.proto
│   ├── strategy.proto
│   └── notification.proto
├── Dockerfile
└── pyproject.toml
```

### 4.5 服务间通信设计

#### 4.5.1 gRPC Protobuf 定义

```protobuf
// proto/common.proto
syntax = "proto3";
package quantfusion;

// ===== Go Data Service 接口 =====

service MarketDataService {
  // 实时行情
  rpc GetQuote(QuoteRequest) returns (QuoteResponse);
  rpc StreamQuotes(StreamRequest) returns (stream QuoteUpdate);
  
  // K线数据
  rpc GetKline(KlineRequest) returns (KlineResponse);
  
  // 板块排行
  rpc GetSectorRanking(SectorRequest) returns (SectorResponse);
  
  // 新闻资讯
  rpc GetNews(NewsRequest) returns (NewsResponse);
  
  // 选股
  rpc ScreenStocks(ScreenRequest) returns (ScreenResponse);
  
  // 情感分析
  rpc AnalyzeSentiment(SentimentRequest) returns (SentimentResponse);
  
  // 问财选股
  rpc IwencaiQuery(IwencaiRequest) returns (IwencaiResponse);
}

// ===== Python AI Service 接口 =====

service AIService {
  // 启动分析
  rpc StartAnalysis(AnalysisRequest) returns (AnalysisResponse);
  rpc StreamAnalysis(AnalysisRequest) returns (stream AnalysisChunk);
  
  // Agent 管理
  rpc ListAgents(Empty) returns (AgentList);
  rpc GetAgentStatus(AgentId) returns (AgentStatus);
  
  // 策略管理
  rpc ListStrategies(Empty) returns (StrategyList);
  rpc RunStrategy(StrategyRequest) returns (StrategyResponse);
  
  // 通知
  rpc SendNotification(NotificationRequest) returns (NotificationResponse);
  
  // 回测
  rpc RunBacktest(BacktestRequest) returns (BacktestResponse);
}
```

#### 4.5.2 通信协议选择

```
┌──────────────────┬──────────────┬─────────────────────────────────┐
│ 通信场景          │ 协议          │ 原因                            │
├──────────────────┼──────────────┼─────────────────────────────────┤
│ Next.js → Go     │ gRPC         │ 高性能、强类型、流式支持          │
│ Next.js → Python │ gRPC         │ 统一协议、流式分析推送            │
│ Go ↔ Python      │ gRPC         │ 双向调用、Agent需获取行情数据     │
│ Go → 浏览器       │ WebSocket    │ 实时行情推送                     │
│ Python → 浏览器   │ SSE          │ AI分析流式输出                   │
│ 浏览器 → Next.js  │ REST         │ 标准HTTP请求                    │
└──────────────────┴──────────────┴─────────────────────────────────┘
```

#### 4.5.3 端口分配

| 服务 | 端口 | 协议 | 用途 |
|------|------|------|------|
| 反向代理 | 80/443 | HTTPS | 反向代理入口 |
| Next.js | 3000 | HTTP | BFF + 前端 |
| Go Data (HTTP) | 8080 | HTTP | REST API + WS |
| Go Data (gRPC) | 8081 | gRPC | 内部服务通信 |
| Python AI (HTTP) | 8000 | HTTP | REST API + SSE |
| Python AI (gRPC) | 8001 | gRPC | 内部服务通信 |
| Redis | 6379 | Redis | 可选缓存 |

---

## 5. 数据层设计

### 5.1 SQLite Schema 设计

统一数据库，融合四个项目的数据模型：

```sql
-- ==========================================
-- QuantFusion 统一数据库 Schema (SQLite)
-- ==========================================

-- 用户与认证 (来自 OpenStock Better Auth)
CREATE TABLE user (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    name            TEXT,
    email_verified  INTEGER DEFAULT 0,
    image           TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE session (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES user(id),
    token           TEXT UNIQUE NOT NULL,
    expires_at      INTEGER NOT NULL,
    created_at      INTEGER NOT NULL
);

CREATE TABLE account (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES user(id),
    provider        TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    access_token    TEXT,
    refresh_token   TEXT,
    UNIQUE(provider, provider_account_id)
);

-- 自选股 (融合 P1+P3+P4)
CREATE TABLE watchlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES user(id),
    symbol      TEXT NOT NULL,
    market      TEXT NOT NULL,        -- 'A', 'HK', 'US'
    name        TEXT,
    group_name  TEXT DEFAULT 'default',
    sort_order  INTEGER DEFAULT 0,
    created_at  INTEGER NOT NULL,
    UNIQUE(user_id, symbol)
);

-- 持仓管理 (来自 P1 FIFO tracking)
CREATE TABLE position (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES user(id),
    symbol          TEXT NOT NULL,
    market          TEXT NOT NULL,
    side            TEXT NOT NULL DEFAULT 'long',
    status          TEXT NOT NULL DEFAULT 'open',
    avg_cost        REAL NOT NULL,
    quantity        REAL NOT NULL,
    current_price   REAL,
    unrealized_pnl  REAL,
    realized_pnl    REAL DEFAULT 0,
    stop_loss       REAL,
    take_profit     REAL,
    opened_at       INTEGER NOT NULL,
    closed_at       INTEGER,
    notes           TEXT
);

-- FIFO Lot (来自 P1)
CREATE TABLE position_lot (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id     INTEGER NOT NULL REFERENCES position(id),
    quantity        REAL NOT NULL,
    cost_price      REAL NOT NULL,
    open_date       INTEGER NOT NULL,
    close_date      INTEGER,
    close_price     REAL,
    realized_pnl    REAL
);

-- 交易记录 (融合 P1+P3+P4)
CREATE TABLE trade_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES user(id),
    symbol          TEXT NOT NULL,
    market          TEXT NOT NULL,
    side            TEXT NOT NULL,
    quantity        REAL NOT NULL,
    price           REAL NOT NULL,
    total_amount    REAL NOT NULL,
    commission      REAL DEFAULT 0,
    trade_time      INTEGER NOT NULL,
    source          TEXT DEFAULT 'manual',
    strategy_id     TEXT,
    notes           TEXT
);

-- 提醒规则 (融合 P1+P4)
CREATE TABLE alert (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES user(id),
    symbol          TEXT NOT NULL,
    alert_type      TEXT NOT NULL,
    target_value    REAL,
    current_value   REAL,
    is_active       INTEGER DEFAULT 1,
    is_triggered    INTEGER DEFAULT 0,
    triggered_at    INTEGER,
    notify_channels TEXT,
    created_at      INTEGER NOT NULL
);

-- AI 分析报告 (融合 P1+P2)
CREATE TABLE analysis_report (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT REFERENCES user(id),
    symbol          TEXT NOT NULL,
    market          TEXT NOT NULL,
    analysis_mode   TEXT NOT NULL,
    agents_used     TEXT,
    summary         TEXT,
    detail          TEXT,
    score           REAL,
    recommendation  TEXT,
    token_usage     TEXT,
    llm_model       TEXT,
    duration_ms     INTEGER,
    created_at      INTEGER NOT NULL
);

-- 策略配置 (来自 P1 YAML策略)
CREATE TABLE strategy (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    type            TEXT NOT NULL,
    config          TEXT NOT NULL,
    is_builtin      INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    created_by      TEXT REFERENCES user(id),
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- 回测记录 (来自 P1)
CREATE TABLE backtest_result (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES user(id),
    strategy_id     TEXT NOT NULL REFERENCES strategy(id),
    symbol          TEXT NOT NULL,
    start_date      INTEGER NOT NULL,
    end_date        INTEGER NOT NULL,
    initial_capital REAL NOT NULL,
    final_capital   REAL NOT NULL,
    total_return    REAL,
    max_drawdown    REAL,
    sharpe_ratio    REAL,
    win_rate        REAL,
    total_trades    INTEGER,
    equity_curve    TEXT,
    trade_details   TEXT,
    created_at      INTEGER NOT NULL
);

-- 定时任务 (融合 P1+P2+P3)
CREATE TABLE scheduled_job (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    cron_expr       TEXT NOT NULL,
    job_type        TEXT NOT NULL,
    config          TEXT,
    is_active       INTEGER DEFAULT 1,
    last_run_at     INTEGER,
    next_run_at     INTEGER,
    last_status     TEXT,
    last_error      TEXT,
    created_at      INTEGER NOT NULL
);

-- 通知记录 (来自 P1)
CREATE TABLE notification_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT REFERENCES user(id),
    channel         TEXT NOT NULL,
    title           TEXT,
    content         TEXT NOT NULL,
    status          TEXT DEFAULT 'pending',
    error_message   TEXT,
    related_type    TEXT,
    related_id      TEXT,
    created_at      INTEGER NOT NULL,
    sent_at         INTEGER
);

-- LLM 调用记录 (来自 P2 Token追踪)
CREATE TABLE llm_call_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    call_type       TEXT,
    prompt_tokens   INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    cost_usd        REAL DEFAULT 0,
    latency_ms      INTEGER,
    status          TEXT,
    error_message   TEXT,
    agent_name      TEXT,
    session_id      TEXT,
    created_at      INTEGER NOT NULL
);

-- 通知渠道配置 (来自 P1)
CREATE TABLE notify_channel_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES user(id),
    channel_type    TEXT NOT NULL,
    config          TEXT NOT NULL,
    is_enabled      INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL,
    UNIQUE(user_id, channel_type)
);

-- 系统配置 (融合 P1 200+参数)
CREATE TABLE system_config (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    category        TEXT NOT NULL,
    description     TEXT,
    updated_at      INTEGER NOT NULL
);

-- 数据源健康状态 (来自 P1 fallback)
CREATE TABLE datasource_health (
    source_name     TEXT PRIMARY KEY,
    market          TEXT NOT NULL,
    data_type       TEXT NOT NULL,
    is_healthy      INTEGER DEFAULT 1,
    latency_ms      INTEGER,
    error_count     INTEGER DEFAULT 0,
    last_check_at   INTEGER,
    last_error      TEXT
);

-- 基金监控 (来自 P3)
CREATE TABLE fund_monitor (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES user(id),
    fund_code       TEXT NOT NULL,
    fund_name       TEXT,
    cost_nav        REAL,
    current_nav     REAL,
    shares          REAL,
    is_active       INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX idx_watchlist_user ON watchlist(user_id);
CREATE INDEX idx_position_user_status ON position(user_id, status);
CREATE INDEX idx_trade_log_user_time ON trade_log(user_id, trade_time);
CREATE INDEX idx_alert_user_active ON alert(user_id, is_active);
CREATE INDEX idx_analysis_report_symbol ON analysis_report(symbol, created_at DESC);
CREATE INDEX idx_analysis_report_user ON analysis_report(user_id, created_at DESC);
CREATE INDEX idx_notification_log_user ON notification_log(user_id, created_at DESC);
CREATE INDEX idx_llm_call_log_time ON llm_call_log(created_at DESC);
CREATE INDEX idx_scheduled_job_active ON scheduled_job(is_active);
```

### 5.2 数据流设计

```
[写入流]
用户操作 → Next.js BFF → SQLite (持仓/自选/提醒/配置)
         → Next.js BFF → Go gRPC → SQLite (行情缓存/健康状态)
         → Next.js BFF → Python gRPC → SQLite (分析报告/通知日志/LLM记录)

[读取流]
页面加载 → Next.js BFF → SQLite (用户数据/持仓/自选)
         → Next.js BFF → Go gRPC → 缓存/数据源 (实时行情)
         → Next.js BFF → Python gRPC (历史分析报告)

[实时推送流]
Go Data Service → WebSocket → 反向代理 → 浏览器 (行情更新)
Python AI Service → SSE → Next.js → 反向代理 → 浏览器 (分析进度)
```

### 5.3 缓存策略

```
┌─────────────────┬──────────────┬──────────────┬───────────────────────┐
│ 数据类型         │ 缓存位置      │ TTL          │ 更新策略               │
├─────────────────┼──────────────┼──────────────┼───────────────────────┤
│ 实时行情         │ Go内存       │ 3秒          │ WebSocket推送刷新      │
│ 日K线           │ Go内存/Redis │ 收盘前5min   │ 定时刷新+手动刷新       │
│ 周K/月K线       │ Go内存/Redis │ 1小时        │ 定时刷新               │
│ 板块排行         │ Go内存/Redis │ 5分钟        │ 定时刷新               │
│ 新闻资讯         │ Go内存/Redis │ 10分钟       │ 定时刷新               │
│ 情感分析结果      │ Go内存/Redis │ 30分钟       │ 按需更新               │
│ AI分析报告       │ SQLite       │ 永久         │ 写入即持久             │
│ 用户持仓/自选     │ SQLite       │ 永久         │ 实时写入               │
│ LLM Provider状态 │ Python内存   │ 5分钟        │ 健康检查更新            │
│ 数据源健康状态    │ SQLite       │ 1分钟        │ 心跳检查更新            │
└─────────────────┴──────────────┴──────────────┴───────────────────────┘
```

### 5.4 SQLite 并发策略

```
关键设计：
1. WAL 模式 — 允许并发读写，读不阻塞写
2. 连接池 — Go (GORM) / Python (SQLAlchemy) 各自维护独立连接池
3. 写入冲突解决 — 通过 Next.js BFF 统一写入入口，避免跨服务写冲突
4. 分区设计：
   - Next.js 服务：写入 user/session/account/watchlist/position/trade_log/alert
   - Go 服务：写入 datasource_health + 行情缓存
   - Python 服务：写入 analysis_report/notification_log/llm_call_log/backtest_result
   → 三服务写不同表，无冲突
```

---

## 6. AI 分析引擎设计

### 6.1 融合 Agent 架构

将 P1 的 5 Agent 系统 + P2 的 LangGraph 11 Agent + P3 的 React/PlanExecute 模式融合为统一架构：

```
                    ┌─────────────────────────────┐
                    │     Analysis Orchestrator     │
                    │     (LangGraph 主控制器)       │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
     │  Mode Router    │ │  Tool Router │ │  Memory      │
     │  (模式选择器)    │ │  (工具路由)   │ │  (记忆管理)   │
     └───────┬────────┘ └──────┬───────┘ └──────┬───────┘
             │                 │                 │
     ┌───────┴───────┐        │         ┌───────┴───────┐
     │               │        │         │               │
     ▼               ▼        │         ▼               ▼
 [快速模式]     [标准模式]     │    [ChromaDB]    [反思引擎]
 1 Agent         3 Agents     │     向量存储       历史对比
                 │            │
     ┌───────────┤            │
     │           │            │
     ▼           ▼            │
 [深度模式]  [辩论模式]        │
 5 Agents   Bull/Bear辩论     │
            +Risk辩论          │
            +Decision          │
                               │
              ┌────────────────┘
              │
    ┌─────────┴─────────────────────────────────┐
    │              Agent 工具注册表                │
    ├──────────────────┬────────────────────────┤
    │  数据工具 (→Go)   │   分析工具 (本地)       │
    │  - get_quote      │   - calc_indicator     │
    │  - get_kline      │   - pattern_detect     │
    │  - get_sector     │   - sentiment_analysis │
    │  - get_news       │   - strategy_run       │
    │  - screen_stocks  │   - risk_assess        │
    │  - iwencai_query  │   - portfolio_optimize │
    │  - sentiment      │   - backtest_run       │
    └──────────────────┴────────────────────────┘
```

### 6.2 四种分析模式详细设计

#### 快速模式 (Quick Mode)
```
输入: symbol
流程: Coordinator → Technical Agent → Decision → 输出
耗时: ~15秒
Token: ~2000
适用: 快速查看技术面概况
```

#### 标准模式 (Standard Mode)
```
输入: symbol
流程: Coordinator → Technical + Fundamental + Sentiment (并行) → Risk → Decision → 输出
耗时: ~45秒
Token: ~8000
适用: 日常分析
```

#### 深度模式 (Full Mode)
```
输入: symbol
流程: Coordinator → Technical + Fundamental + Sentiment + Intel (并行) → Portfolio → Risk → Decision → 输出
耗时: ~90秒
Token: ~15000
适用: 重要决策前
```

#### 辩论模式 (Debate Mode) — 来自 P2 的核心创新
```
输入: symbol
流程: 
  1. Coordinator → 技术面预分析
  2. Bull Researcher → 构建看多论点 (3个以上)
  3. Bear Researcher → 构建看空论点 (3个以上)
  4. Risk Manager → 评估双方论点的风险
  5. Bull/Bear 第二轮辩论 → 反驳对方观点
  6. Risk Manager → 综合风险评估
  7. Decision Agent → 基于辩论结果做出最终决策
耗时: ~3分钟
Token: ~30000
适用: 关键持仓决策
```

### 6.3 LangGraph 工作流定义

```python
# app/agents/graph.py — 主工作流

from langgraph.graph import StateGraph, END

def build_analysis_graph() -> StateGraph:
    graph = StateGraph(AnalysisState)
    
    # 添加节点
    graph.add_node("coordinator", coordinator_node)
    graph.add_node("technical", technical_node)
    graph.add_node("fundamental", fundamental_node)
    graph.add_node("sentiment", sentiment_node)
    graph.add_node("intel", intel_node)
    graph.add_node("portfolio", portfolio_node)
    graph.add_node("bull_researcher", bull_researcher_node)
    graph.add_node("bear_researcher", bear_researcher_node)
    graph.add_node("risk", risk_node)
    graph.add_node("debate_round2", debate_round2_node)
    graph.add_node("decision", decision_node)
    
    # 设置入口
    graph.set_entry_point("coordinator")
    
    # 条件边：根据分析模式路由
    graph.add_conditional_edges(
        "coordinator",
        route_by_mode,
        {
            "quick": "technical",
            "standard": "technical",
            "full": "technical",
            "debate": "technical",
        }
    )
    
    # 快速模式路径
    graph.add_edge("technical", "decision")
    
    # 标准/深度模式路径
    graph.add_conditional_edges(
        "technical",
        should_continue_after_technical,
        {
            "parallel_group": "fundamental",
            "decision": "decision",
        }
    )
    
    # 辩论模式路径
    graph.add_edge("technical", "bull_researcher")
    graph.add_edge("technical", "bear_researcher")
    graph.add_edge("bull_researcher", "risk")
    graph.add_edge("bear_researcher", "risk")
    graph.add_edge("risk", "debate_round2")
    graph.add_edge("debate_round2", "decision")
    
    # 通用结束
    graph.add_edge("decision", END)
    
    return graph.compile()
```

### 6.4 LLM 统一调度层

```python
# app/llm/router.py — LLM 路由器

class LLMRouter:
    """Unified LLM dispatch: Dual model + Provider Fallback + Token tracking"""
    
    def __init__(self, config: LLMConfig):
        self.quick_model = config.quick_thinking   # e.g., deepseek-chat
        self.deep_model = config.deep_thinking     # e.g., gpt-4o / claude-3.5
        self.providers = self._init_providers(config)
        self.token_tracker = TokenTracker()
    
    async def call(
        self,
        prompt: str,
        mode: Literal["quick", "deep"] = "quick",
        agent_name: str = None,
        session_id: str = None,
        **kwargs
    ) -> LLMResponse:
        """Unified call entry point"""
        model = self.quick_model if mode == "quick" else self.deep_model
        provider_chain = self._get_provider_chain(model)
        
        last_error = None
        for provider in provider_chain:
            try:
                start = time.monotonic()
                response = await provider.complete(prompt, model=model, **kwargs)
                latency = int((time.monotonic() - start) * 1000)
                
                self.token_tracker.record(
                    provider=provider.name,
                    model=model,
                    call_type=mode,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    latency_ms=latency,
                    agent_name=agent_name,
                    session_id=session_id,
                )
                return response
            except Exception as e:
                last_error = e
                log.warning(f"Provider {provider.name} failed: {e}, trying next...")
        
        raise LLMError(f"All providers failed: {last_error}")

# Provider Fallback 链配置
PROVIDER_CHAINS = {
    "gpt-4o":       ["openai", "openrouter"],
    "claude-3.5":   ["anthropic", "openrouter"],
    "deepseek-chat": ["deepseek", "openrouter", "ollama"],
    "qwen-max":     ["qwen", "dashscope"],
    "glm-4":        ["zhipuai", "openrouter"],
    "gemini-pro":   ["google", "openrouter"],
    "local-llama":  ["ollama"],
}
```

---

## 7. 数据源层设计

### 7.1 统一数据源架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Go 数据源管理层                            │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │ A股数据源组  │    │ 港股数据源组 │    │ 美股数据源组 │    │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤    │
│  │ Sina ★      │    │ Tencent ★   │    │ Finnhub ★   │    │
│  │ Tencent ★   │    │ Longbridge  │    │ YFinance ★  │    │
│  │ EastMoney   │    │ Sina        │    │ Sina        │    │
│  │ TongDaXin   │    │ YFinance    │    │ Tushare     │    │
│  │ Tushare     │    └─────────────┘    └─────────────┘    │
│  │ AkShare(桥接)│                                         │
│  │ Baostock    │    ┌─────────────────────────────┐       │
│  │ Xueqiu      │    │      通用数据源组            │       │
│  │ CLS(财联社)  │    ├─────────────────────────────┤       │
│  │ WallstreetCN│    │ iWencai (自然语言选股) ★     │       │
│  │ iWencai ★   │    │ Reuters (国际新闻)           │       │
│  └─────────────┘    │ Finnhub (国际新闻)           │       │
│                     └─────────────────────────────┘       │
│  ★ = 主要数据源（优先使用）                                   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 统一数据接口

```go
// internal/datasource/registry.go

type DataSource interface {
    Name() string
    Markets() []string
    Capabilities() []Capability
    
    GetQuote(ctx context.Context, symbol string) (*Quote, error)
    GetQuotes(ctx context.Context, symbols []string) (map[string]*Quote, error)
    GetKline(ctx context.Context, symbol string, period Period, count int) ([]*KlineBar, error)
    GetSectorRanking(ctx context.Context, market string) ([]*SectorInfo, error)
    GetNews(ctx context.Context, market string, count int) ([]*NewsItem, error)
    HealthCheck(ctx context.Context) error
}

type Capability string

const (
    CapQuote     Capability = "quote"
    CapKline     Capability = "kline"
    CapSector    Capability = "sector"
    CapNews      Capability = "news"
    CapScreen    Capability = "screen"
    CapSentiment Capability = "sentiment"
)
```

### 7.3 多级 Fallback 策略

```
Fallback 执行流程：

用户请求 GetQuote("SH600519")
        │
        ▼
  ┌─────────────────┐
  │ 解析市场=A_stock  │
  │ 查找优先级链      │
  └────────┬────────┘
           │
           ▼
  Priority: [Sina, Tencent, EastMoney, TongDaXin]
           │
     ┌─────┴──────┐
     ▼            │
  Try Sina ──────┤ 成功 → 返回数据 + 更新健康状态
     │失败        │
     ▼            │
  Try Tencent ───┤ 成功 → 返回 + 标记Sina降级
     │失败        │
     ▼            │
  Try EastMoney ─┤ 成功 → 返回 + 标记前两个降级
     │失败        │
     ▼            │
  Try TongDaXin ─┘ 成功 → 返回
     │全部失败
     ▼
  返回缓存数据(如有) + 告警通知
```

### 7.4 数据源健康监控

```go
// 健康检查：每30秒一次
func (m *HealthMonitor) RunCheck(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    for {
        select {
        case <-ticker.C:
            for _, ds := range m.allSources {
                start := time.Now()
                err := ds.HealthCheck(ctx)
                latency := time.Since(start)
                
                status := &DataSourceHealth{
                    SourceName:  ds.Name(),
                    IsHealthy:   err == nil,
                    LatencyMs:   latency.Milliseconds(),
                    LastCheckAt: time.Now().Unix(),
                }
                if err != nil {
                    status.ErrorCount++
                    status.LastError = err.Error()
                    // 连续3次失败 → 自动降级
                    if status.ErrorCount >= 3 {
                        m.downgrade(ds.Name())
                    }
                } else {
                    status.ErrorCount = 0
                    // 恢复 → 自动升级
                    m.tryUpgrade(ds.Name())
                }
                m.saveStatus(status)
            }
        case <-ctx.Done():
            return
        }
    }
}
```

---

## 8. 前端架构设计

### 8.1 页面规划

```
┌─────────────────────────────────────────────────────────────┐
│                    QuantFusion 前端页面地图                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  / (Landing) ──→ 登录/注册                                   │
│     │                                                       │
│     ▼ (登录后)                                               │
│  /dashboard ─────────── 仪表盘首页 ★                         │
│     │   ├── 市场概览 (3大指数)                                │
│     │   ├── 持仓摘要                                         │
│     │   ├── 今日信号                                         │
│     │   ├── 资讯快报                                         │
│     │   └── 自选股实时行情 (WebSocket)                        │
│     │                                                       │
│     ├── /analysis ─────── AI分析中心 ★                        │
│     │   ├── 股票搜索 + 分析模式选择                            │
│     │   ├── 实时分析进度 (SSE流)                              │
│     │   ├── 分析报告展示                                      │
│     │   ├── 辩论模式可视化                                    │
│     │   └── 历史分析记录                                      │
│     │                                                       │
│     ├── /market ───────── 行情中心                            │
│     │   ├── 实时行情 (WebSocket)                              │
│     │   ├── K线图 (TradingView Lightweight)                  │
│     │   ├── 板块热力图 (TradingView Widget)                  │
│     │   ├── 技术分析 (TradingView Widget)                    │
│     │   └── 市场新闻                                         │
│     │                                                       │
│     ├── /scanner ───────── 选股器 ★                          │
│     │   ├── 技术面筛选 (RSI/MACD/布林带/量比)                 │
│     │   ├── 基本面筛选                                       │
│     │   ├── iWencai自然语言选股                              │
│     │   ├── 情感面筛选                                       │
│     │   └── 综合评分排行                                     │
│     │                                                       │
│     ├── /portfolio ────── 持仓管理                            │
│     │   ├── 活跃持仓 (FIFO Lot明细)                          │
│     │   ├── 交易记录                                         │
│     │   ├── 盈亏统计                                         │
│     │   ├── 资产配置图                                       │
│     │   └── Paper Trading (模拟盘)                           │
│     │                                                       │
│     ├── /strategies ───── 策略中心                            │
│     │   ├── 15内置策略列表                                    │
│     │   ├── 策略回测                                         │
│     │   ├── 回测报告 (收益曲线/最大回撤/夏普比)               │
│     │   └── 自定义策略编辑                                   │
│     │                                                       │
│     ├── /alerts ────────── 提醒管理                           │
│     │   ├── 价格提醒 (ABOVE/BELOW)                           │
│     │   ├── 信号提醒                                         │
│     │   ├── 通知渠道配置 (13通道)                             │
│     │   └── 提醒历史                                         │
│     │                                                       │
│     ├── /news ──────────── 资讯中心                           │
│     │   ├── 新闻列表 (多源聚合)                               │
│     │   ├── 情感分析可视化                                    │
│     │   └── 个股相关新闻                                     │
│     │                                                       │
│     ├── /scheduler ─────── 调度管理                           │
│     │   ├── 定时任务列表                                     │
│     │   ├── 任务执行日志                                     │
│     │   └── Cron表达式编辑                                   │
│     │                                                       │
│     └── /settings ──────── 系统设置                           │
│         ├── LLM配置 (12+ Provider)                          │
│         ├── 数据源配置                                       │
│         ├── 通知渠道配置                                     │
│         ├── 交易参数                                         │
│         ├── 外观 (暗色/亮色)                                  │
│         ├── 语言 (中文/English)                              │
│         └── 关于                                            │
│                                                             │
│  ★ = 核心页面 (P0优先实现)                                    │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 组件设计

```
src/components/
├── ui/                        # shadcn/ui 基础组件 (40+)
├── layout/
│   ├── app-sidebar.tsx        # 侧边栏导航
│   ├── header.tsx             # 顶部栏 (搜索+通知+用户)
│   ├── command-palette.tsx    # Cmd+K 全局搜索
│   └── theme-toggle.tsx       # 主题切换
├── market/
│   ├── stock-quote-card.tsx   # 实时行情卡片
│   ├── kline-chart.tsx        # TradingView K线图
│   ├── heatmap-widget.tsx     # 热力图Widget
│   ├── sector-ranking.tsx     # 板块排行
│   └── quote-table.tsx        # 行情表格 (实时更新)
├── analysis/
│   ├── analysis-panel.tsx     # 分析主面板
│   ├── mode-selector.tsx      # 模式选择器
│   ├── analysis-progress.tsx  # 进度条 (SSE)
│   ├── debate-view.tsx        # 辩论可视化
│   ├── agent-status.tsx       # Agent状态指示
│   └── report-card.tsx        # 报告卡片
├── portfolio/
│   ├── position-table.tsx     # 持仓表格
│   ├── lot-detail.tsx         # FIFO Lot明细
│   ├── pnl-chart.tsx          # 盈亏图表
│   ├── allocation-pie.tsx     # 配置饼图
│   └── trade-form.tsx         # 交易表单
├── scanner/
│   ├── filter-panel.tsx       # 筛选面板
│   ├── iwencai-input.tsx      # 问财输入框
│   └── scan-results.tsx       # 扫描结果
├── strategy/
│   ├── strategy-card.tsx      # 策略卡片
│   ├── backtest-config.tsx    # 回测配置
│   ├── equity-curve.tsx       # 收益曲线
│   └── strategy-editor.tsx    # 策略编辑器
├── notification/
│   ├── channel-config.tsx     # 通道配置
│   └── alert-rule.tsx         # 提醒规则
└── common/
    ├── loading-skeleton.tsx   # 加载骨架屏
    ├── error-boundary.tsx     # 错误边界
    ├── empty-state.tsx        # 空状态
    └── market-badge.tsx       # 市场标签 (A股/港股/美股)
```

### 8.3 状态管理

```
采用 Zustand + TanStack Query 分层管理：

┌─────────────────────────────────────────────┐
│  Zustand (全局客户端状态)                      │
│  ├── useAuthStore    — 认证状态               │
│  ├── useThemeStore   — 主题/语言              │
│  └── useLayoutStore  — 侧边栏折叠等布局状态    │
├─────────────────────────────────────────────┤
│  TanStack Query (服务端状态缓存)               │
│  ├── useQuery — 行情/持仓/分析报告等           │
│  └── useMutation — 交易/配置修改等             │
├─────────────────────────────────────────────┤
│  WebSocket/SSE (实时数据流)                    │
│  ├── useRealtimeQuotes — WebSocket 行情流     │
│  └── useAnalysisStream — SSE 分析进度流       │
└─────────────────────────────────────────────┘
```

### 8.4 WebSocket 实时数据架构

```typescript
// hooks/use-realtime-quotes.ts

class RealtimeQuoteService {
  private ws: WebSocket | null = null;
  private subscribers = new Map<string, Set<Callback>>();
  
  connect() {
    this.ws = new WebSocket(`wss://${window.location.host}/ws/realtime`);
    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data) as QuoteUpdate;
      this.subscribers.get(update.symbol)?.forEach(cb => cb(update));
    };
    this.ws.onclose = () => {
      setTimeout(() => this.connect(), this.getBackoff());
    };
  }
  
  subscribe(symbols: string[], callback: Callback): Unsubscribe {
    this.ws?.send(JSON.stringify({ action: 'subscribe', symbols }));
    symbols.forEach(s => {
      if (!this.subscribers.has(s)) this.subscribers.set(s, new Set());
      this.subscribers.get(s)!.add(callback);
    });
    return () => { /* cleanup */ };
  }
}

function useRealtimeQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  useEffect(() => {
    const unsub = realtimeService.subscribe(symbols, (update) => {
      setQuotes(prev => ({ ...prev, [update.symbol]: update }));
    });
    return unsub;
  }, [symbols]);
  return quotes;
}
```

---

## 9. 通知系统设计

### 9.1 统一通知架构

```
┌──────────────────────────────────────────────────────────┐
│                    通知系统架构                             │
│                                                          │
│  [触发源]                                                 │
│  ├── 价格提醒 (Alert规则匹配)                              │
│  ├── AI分析完成 (分析报告生成)                              │
│  ├── 策略信号 (策略触发买卖信号)                            │
│  ├── 定时报告 (每日/每周市场总结)                           │
│  └── 系统事件 (数据源异常/服务状态)                         │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────────┐                                        │
│  │ NotifyRouter │ — 根据用户配置路由到指定通道               │
│  └──────┬───────┘                                        │
│         │                                                │
│    ┌────┴────┐                                           │
│    ▼         ▼                                           │
│  [即时通道]  [批量通道]                                     │
│  WeChat    Email (每日汇总)                               │
│  Feishu                                                 │
│  Telegram                                               │
│  Discord                                                │
│  Slack                                                  │
│  Pushover                                               │
│  ntfy                                                   │
│  Gotify                                                 │
│  PushPlus                                               │
│  Server酱                                               │
│  Webhook                                                │
│  AstrBot                                                │
│  DingTalk                                               │
└──────────────────────────────────────────────────────────┘
```

### 9.2 通知优先级与合并策略

```
┌──────────────┬──────────────┬────────────────────────────────┐
│ 优先级        │ 合并窗口      │ 示例                            │
├──────────────┼──────────────┼────────────────────────────────┤
│ P0 紧急      │ 立即发送      │ 止损触发、大幅波动 >5%           │
│ P1 重要      │ 5分钟合并     │ 买卖信号、AI分析完成             │
│ P2 一般      │ 30分钟合并    │ 定时分析报告、板块异动           │
│ P3 低        │ 每日汇总      │ 日报、周报、系统状态             │
└──────────────┴──────────────┴────────────────────────────────┘

合并逻辑：同一优先级、同一通道的通知，在合并窗口内聚合为一条消息，
避免通知轰炸。
```

---

## 10. 调度系统设计

### 10.1 调度架构

```
┌──────────────────────────────────────────────────────────────┐
│                     调度系统 (Go 实现)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Cron Scheduler (robfig/cron)              │   │
│  │                                                       │   │
│  │  [行情数据类]                  [AI分析类]              │   │
│  │  */3s  实时行情刷新             09:30 开盘分析         │   │
│  │  */5m  板块排行刷新             15:00 收盘分析         │   │
│  │  */10m 新闻数据同步             20:00 晚间总结         │   │
│  │  09:15 竞价数据同步             */30m 热门股分析        │   │
│  │  15:05 收盘数据同步                                    │   │
│  │  17:00 数据源健康检查           [通知类]               │   │
│  │  */1m  数据源心跳              08:30 每日市场速递       │   │
│  │                                18:00 收盘报告推送       │   │
│  │  [策略监控类]                   */5m  提醒规则检查       │   │
│  │  */1m  策略信号扫描                                   │   │
│  │  */30s 止损止盈检查             [维护类]               │   │
│  │                                00:00 日数据清理         │   │
│  │                                03:00 向量库维护         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  跨服务调用:                                                  │
│  - 调度器 (Go) → gRPC → Python AI Service (分析/通知)        │
│  - 调度器 (Go) → 本地执行 (数据采集/健康检查)                  │
│  - 调度器 (Go) → gRPC → Next.js (触发缓存刷新)               │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 任务定义与持久化

```go
// internal/scheduler/jobs.go

type JobDefinition struct {
    ID          string
    Name        string
    CronExpr    string
    JobType     string
    Handler     JobHandler
    Config      json.RawMessage
    IsDurable   bool
    Timeout     time.Duration
    RetryCount  int
}

func (s *Scheduler) dispatchToAI(ctx context.Context, job *JobDefinition) error {
    switch job.JobType {
    case "analysis":
        _, err := s.aiClient.StartAnalysis(ctx, &pb.AnalysisRequest{
            Symbols:     parseSymbols(job.Config),
            Mode:        parseMode(job.Config),
            TriggeredBy: "scheduler",
        })
        return err
    case "notification":
        _, err := s.aiClient.SendNotification(ctx, &pb.NotificationRequest{...})
        return err
    }
    return nil
}
```

---

## 11. 部署架构

### 11.1 Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  reverse-proxy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Proxyfile:/etc/caddy/Caddyfile
      - proxy_data:/data
      - proxy_config:/config
    depends_on:
      - nextjs
      - go-data
      - python-ai
    restart: unless-stopped

  nextjs:
    build:
      context: ./nextjs-service
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=file:/data/quantfusion.db
      - GO_DATA_GRPC=go-data:8081
      - PYTHON_AI_GRPC=python-ai:8001
      - BETTER_AUTH_SECRET=${AUTH_SECRET}
      - BETTER_AUTH_URL=${PUBLIC_URL}
    volumes:
      - db_data:/data
    depends_on:
      - go-data
      - python-ai
    restart: unless-stopped

  go-data:
    build:
      context: ./go-data-service
      dockerfile: Dockerfile
    environment:
      - DB_PATH=/data/quantfusion.db
      - GRPC_PORT=8081
      - HTTP_PORT=8080
      - REDIS_URL=redis:6379
    volumes:
      - db_data:/data:ro
    ports:
      - "8080:8080"
    restart: unless-stopped

  python-ai:
    build:
      context: ./python-ai-service
      dockerfile: Dockerfile
    environment:
      - DB_PATH=/data/quantfusion.db
      - GRPC_PORT=8001
      - HTTP_PORT=8000
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - db_data:/data:ro
      - chroma_data:/chroma
    ports:
      - "8000:8000"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    profiles:
      - cache

volumes:
  db_data:
  chroma_data:
  redis_data:
  proxy_data:
  proxy_config:
```

### 11.2 资源需求估算

```
┌──────────────┬───────────┬───────────┬───────────┬────────────────┐
│ 服务          │ CPU       │ 内存       │ 磁盘       │ 备注            │
├──────────────┼───────────┼───────────┼───────────┼────────────────┤
│ 反向代理      │ 0.1 核    │ 32MB      │ 10MB      │ 极轻量          │
│ Next.js      │ 0.5 核    │ 256MB     │ 100MB     │ SSR渲染         │
│ Go Data      │ 1.0 核    │ 256MB     │ 50MB      │ 高并发行情       │
│ Python AI    │ 2.0 核    │ 1GB       │ 500MB     │ LangGraph+Chroma│
│ Redis (可选) │ 0.2 核    │ 64MB      │ 50MB      │ 缓存            │
├──────────────┼───────────┼───────────┼───────────┼────────────────┤
│ 合计 (最低)   │ 3.8 核    │ 1.6GB     │ 710MB     │ 不含Redis       │
│ 合计 (推荐)   │ 4.0+ 核   │ 2GB+      │ 2GB+      │ 含Redis+数据    │
└──────────────┴───────────┴───────────┴───────────┴────────────────┘
```

---

## 12. 融合路线图

### Phase 1: 核心骨架 (4周)

```
Week 1-2: 项目初始化
├── 初始化 monorepo 结构
├── 搭建 Next.js 15 + shadcn/ui 前端
├── 实现 Better Auth 认证
├── 创建 SQLite Schema + Prisma
├── 搭建 Go Data Service 骨架 (gRPC server)
├── 搭建 Python AI Service 骨架 (FastAPI + gRPC)
└── Docker Compose 基础配置

Week 3-4: 数据通路打通
├── Go: 实现 Sina + Tencent 数据源 (A股行情)
├── Go: 实现 WebSocket 实时推送
├── Go: 实现 Fallback 引擎
├── Next.js: 仪表盘首页 + 行情页面
├── Next.js: WebSocket 客户端连接
├── Next.js ↔ Go gRPC 通信验证
└── 基础部署验证 (Docker Compose up)
```

**Phase 1 交付物**: 可以看到实时A股行情的 Web 应用

### Phase 2: AI核心 (4周)

```
Week 5-6: LLM统一调度
├── Python: 实现 LLM Router (12+ Provider)
├── Python: 实现 quick/deep 双模型配置
├── Python: 实现 Provider Fallback
├── Python: 实现 Token 追踪
├── Python ↔ Go gRPC (AI Agent获取行情数据)
└── Next.js: 设置页面 (LLM配置)

Week 7-8: Agent系统
├── Python: 实现 LangGraph 主工作流
├── Python: 实现快速/标准/深度 3种模式
├── Python: 实现 Agent 工具集 (→Go获取数据)
├── Python: 实现 SSE 流式分析输出
├── Next.js: AI分析页面 (模式选择+进度+报告)
├── Next.js: SSE 客户端
└── Go: 接入更多数据源 (EastMoney, Finnhub, YFinance)
```

**Phase 2 交付物**: 可以用 AI 分析股票的完整应用

### Phase 3: 功能完善 (4周)

```
Week 9-10: 高级AI + 策略
├── Python: 实现辩论模式 (Bull/Bear/Risk/Decision)
├── Python: 实现 ChromaDB 向量记忆
├── Python: 实现 15 策略YAML引擎
├── Python: 实现回测引擎
├── Go: 实现 NLP 情感分析
├── Go: 实现 iWencai 选股
└── Next.js: 辩论可视化 + 策略中心 + 回测页面

Week 11-12: 通知+调度+完善
├── Python: 实现 13 通知通道
├── Go: 实现 Cron 调度系统
├── Go: 接入剩余数据源 (全部11+)
├── Next.js: 通知配置 + 提醒管理 + 调度管理
├── Next.js: 选股器 + iWencai
├── Next.js: 持仓管理 + FIFO Lot
├── Next.js: Paper Trading
├── 端到端测试
└── 生产部署文档
```

**Phase 3 交付物**: 功能完整的融合平台

### Phase 4: 优化打磨 (持续)

```
├── 性能优化 (Go内存缓存、前端代码分割、SSR优化)
├── 多语言完善 (i18n 全覆盖)
├── 移动端适配 (响应式优化)
├── 向量记忆反思学习 (自动优化分析质量)
├── MCP Server 支持
├── 报告导出 (Word/PDF)
├── 社区策略市场
└── Plugin 系统 (第三方扩展)
```

---

## 13. 风险与挑战

### 13.1 技术风险

| 风险 | 等级 | 影响 | 缓解方案 |
|------|------|------|---------|
| **SQLite 并发写入瓶颈** | 🔴 高 | 多服务同时写入导致锁等待 | 严格分区写入（每服务写不同表）+ WAL模式 + 写操作通过BFF统一入口 |
| **gRPC 跨语言兼容性** | 🟡 中 | Python/Go/TypeScript protobuf 生成差异 | 统一proto定义仓库 + CI自动生成 + 版本锁定 |
| **LangGraph 复杂度** | 🟡 中 | 辩论模式调试困难，状态管理复杂 | 分步实现（先快速模式→标准→辩论），充分单元测试 |
| **WebSocket 连接管理** | 🟡 中 | 大量连接导致Go服务内存增长 | 连接池 + 心跳检测 + 自动断开空闲连接 + 限制每用户连接数 |
| **多数据源 API 变更** | 🔴 高 | 外部数据源接口变更导致功能失效 | Fallback机制 + 健康监控 + 社区快速响应 + 抽象层隔离 |
| **ChromaDB 向量库膨胀** | 🟢 低 | 存储空间持续增长 | 定期清理 + 相似度去重 + 限制单股票记忆条数 |

### 13.2 架构挑战

| 挑战 | 描述 | 应对策略 |
|------|------|---------|
| **三语言栈运维复杂度** | Go/Python/TypeScript 三套运行时，依赖管理复杂 | Docker统一封装 + 单仓monorepo + CI/CD自动化 |
| **数据一致性** | 三服务共享SQLite，可能读到中间状态 | WAL读不阻塞写 + 关键操作串行化 + 乐观锁 |
| **调试链路长** | 前端→BFF→gRPC→Go/Python，问题定位困难 | 统一日志TraceID + OpenTelemetry + 健康检查端点 |
| **冷启动慢** | Python AI服务首次启动需加载模型/ChromaDB | 预热脚本 + 健康检查 + 保持常驻 |
| **配置爆炸** | 200+配置参数散布三服务 | 统一配置中心 + 环境变量 + 设置页面管理 |

### 13.3 业务挑战

| 挑战 | 描述 | 应对策略 |
|------|------|---------|
| **数据合规** | A股实时数据获取可能触及交易所数据版权 | 仅使用公开免费数据源 + 用户自行配置Token + 免责声明 |
| **LLM成本** | 深度/辩论模式Token消耗大 | 默认快速模式 + 成本预估提示 + 本地模型(Ollama)兜底 |
| **分析质量** | AI分析结果不构成投资建议 | 明确免责声明 + 风险提示 + 历史准确率追踪 |
| **用户上手成本** | 功能丰富导致配置复杂 | 精心设计默认配置 + 引导式设置向导 + 开箱即用体验 |

---

## 附录A: 关键技术选型对比

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 决策点        │ 选项A         │ 选项B         │ 最终选择      │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ 前端框架      │ Next.js      │ Nuxt.js      │ Next.js ✅   │
│              │ (P4已有)     │ (需重写)      │ 与现有项目一致 │
│ UI库         │ shadcn/ui    │ Ant Design   │ shadcn/ui ✅ │
│              │ (P4已有)     │ (重量级)      │ 轻量+可定制   │
│ 数据库       │ SQLite       │ PostgreSQL   │ SQLite ✅    │
│              │ (零依赖)     │ (需独立部署)  │ 轻量级优先    │
│ 服务间通信    │ gRPC         │ REST         │ gRPC ✅      │
│              │ (高性能流式)  │ (简单)       │ 流式+性能    │
│ AI编排       │ LangGraph    │ CrewAI       │ LangGraph ✅ │
│              │ (P2已验证)   │ (较新)       │ 成熟+灵活    │
│ 向量库       │ ChromaDB     │ Pinecone     │ ChromaDB ✅  │
│              │ (本地运行)   │ (云服务)      │ 无外部依赖   │
│ 缓存(可选)    │ Redis        │ 内存缓存     │ Redis ✅     │
│              │ (可选)       │ (简单)       │ 生产级可选   │
│ 实时推送      │ WebSocket+SSE│ 纯WebSocket  │ WS+SSE ✅    │
│              │ (各取所长)   │ (统一)       │ 行情WS/分析SSE│
└──────────────┴──────────────┴──────────────┴──────────────┘
```

## 附录B: Symbol 统一编码规范

```
格式: {MARKET}{CODE}

A股:
  上海: SH600519, SH000001 (上证指数)
  深圳: SZ000001, SZ399001 (深证成指)
  创业板: SZ300750
  科创板: SH688981

港股:
  HK00700 (腾讯)
  HK09988 (阿里)
  HK03690 (美团)

美股:
  US.AAPL (苹果)
  US.TSLA (特斯拉)
  US.GOOG (谷歌)

指数:
  IDX.SH000001 (上证)
  IDX.SZ399001 (深证)
  IDX.SZ399006 (创业板)
  IDX.HSCEI (恒生国企)
  IDX.SPX (S&P 500)
  IDX.IXIC (纳斯达克)
```

## 附录C: 环境变量清单

```bash
# ===== 公共 =====
PUBLIC_URL=http://localhost
AUTH_SECRET=your-secret-key

# ===== 数据源 =====
TUSHARE_TOKEN=                    # Tushare Pro
FINNHUB_API_KEY=                  # Finnhub
LONGBRIDGE_APP_KEY=               # 长桥
LONGBRIDGE_APP_SECRET=
LONGBRIDGE_ACCESS_TOKEN=

# ===== LLM Providers =====
OPENAI_API_KEY=                   # OpenAI
DEEPSEEK_API_KEY=                 # DeepSeek
ANTHROPIC_API_KEY=                # Claude
GOOGLE_API_KEY=                   # Gemini
QWEN_API_KEY=                     # 通义千问
ZHIPU_API_KEY=                    # 智谱GLM
VOLCENGINE_API_KEY=               # 火山引擎
OPENROUTER_API_KEY=               # OpenRouter
OLLAMA_BASE_URL=http://localhost:11434

# ===== 通知渠道 =====
WECHAT_CORP_ID=                   # 企业微信
WECHAT_AGENT_ID=
WECHAT_SECRET=
FEISHU_WEBHOOK_URL=               # 飞书
TELEGRAM_BOT_TOKEN=               # Telegram
TELEGRAM_CHAT_ID=
SMTP_HOST=                        # 邮件
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
DISCORD_WEBHOOK_URL=              # Discord
SLACK_WEBHOOK_URL=                # Slack
PUSHOVER_TOKEN=                   # Pushover
PUSHOVER_USER_KEY=
NTFY_URL=                         # ntfy
GOTIFY_URL=                       # Gotify
GOTIFY_TOKEN=
PUSHPLUS_TOKEN=                   # PushPlus
SERVERCHAN_KEY=                   # Server酱

# ===== 可选 =====
REDIS_URL=redis://redis:6379
LOG_LEVEL=info
```

---

> **文档结束**  
> 本文档描述了 QuantFusion 平台的完整融合架构设计。  
> 下一步：按 Phase 1 路线图启动项目初始化。
