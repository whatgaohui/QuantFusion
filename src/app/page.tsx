'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar, type NavItem } from '@/components/dashboard/sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/lib/i18n';

// ─── Dynamic imports: only compile when the view is actually rendered ───
// This prevents Turbopack from compiling all 11 views + their heavy deps
// (recharts, etc.) on first page load, which was causing the server to hang.

// Loading fallback for dynamic imports
function ViewLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-zinc-400">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

const DashboardView = dynamic(
  () => import('@/components/dashboard/dashboard-view').then(m => ({ default: m.DashboardView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
const AIAnalysisView = dynamic(
  () => import('@/components/dashboard/ai-analysis-view').then(m => ({ default: m.AIAnalysisView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
const AgentChatView = dynamic(
  () => import('@/components/dashboard/agent-chat-view').then(m => ({ default: m.AgentChatView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
const SignalScannerView = dynamic(
  () => import('@/components/dashboard/signal-scanner-view').then(m => ({ default: m.SignalScannerView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
// PositionsView removed — functionality merged into ETF Portfolio
const ETFPortfolioView = dynamic(
  () => import('@/components/dashboard/etf-portfolio-view').then(m => ({ default: m.ETFPortfolioView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
const WatchlistView = dynamic(
  () => import('@/components/dashboard/watchlist-view').then(m => ({ default: m.WatchlistView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
// StrategyCenterView removed — functionality merged into Backtest
const MarketNewsView = dynamic(
  () => import('@/components/dashboard/news-view').then(m => ({ default: m.MarketNewsView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
const BacktestView = dynamic(
  () => import('@/components/dashboard/backtest-view').then(m => ({ default: m.BacktestView })),
  { ssr: false, loading: () => <ViewLoading /> }
);
const SettingsView = dynamic(
  () => import('@/components/dashboard/settings-view').then(m => ({ default: m.SettingsView })),
  { ssr: false, loading: () => <ViewLoading /> }
);

// ─── Types ───────────────────────────────────────────────────────────────────

interface BacktestNavState {
  strategy?: string;
  symbol?: string;
}

interface AIAnalysisNavState {
  symbol?: string;
}

function ViewRenderer({
  activeView,
  onNavigate,
  backtestNavState,
  aiAnalysisNavState,
}: {
  activeView: NavItem;
  onNavigate: (view: NavItem, extra?: BacktestNavState & AIAnalysisNavState) => void;
  backtestNavState: BacktestNavState;
  aiAnalysisNavState: AIAnalysisNavState;
}) {
  switch (activeView) {
    case 'dashboard':
      return <DashboardView onNavigate={(v) => onNavigate(v)} />;
    case 'aiAnalysis':
      return <AIAnalysisView initialSymbol={aiAnalysisNavState.symbol} />;
    case 'agentChat':
      return <AgentChatView />;
    case 'scanner':
      return <SignalScannerView />;

    case 'etfPortfolio':
      return <ETFPortfolioView />;
    case 'watchlist':
      return <WatchlistView onNavigate={(v, extra) => onNavigate(v, extra)} />;

    case 'news':
      return <MarketNewsView onNavigate={(v) => onNavigate(v)} />;
    case 'backtest':
      return <BacktestView
        initialStrategy={backtestNavState.strategy}
        initialSymbol={backtestNavState.symbol}
        onNavigate={(v) => onNavigate(v as NavItem)}
      />;
    case 'settings':
      return <SettingsView />;
    default:
      return <DashboardView onNavigate={(v) => onNavigate(v)} />;
  }
}

const viewTitleKeys: Record<NavItem, string> = {
  dashboard: 'sidebar.dashboard',
  etfPortfolio: 'sidebar.etfPortfolio',
  watchlist: 'sidebar.watchlist',
  scanner: 'sidebar.scanner',
  aiAnalysis: 'sidebar.aiAnalysis',
  agentChat: 'sidebar.agentChat',
  news: 'sidebar.news',
  backtest: 'sidebar.backtest',
  settings: 'sidebar.settings',
};

export default function HomePage() {
  const [activeView, setActiveView] = useState<NavItem>('dashboard');
  const [backtestNavState, setBacktestNavState] = useState<BacktestNavState>({});
  const [aiAnalysisNavState, setAIAnalysisNavState] = useState<AIAnalysisNavState>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, language } = useLanguage();

  const handleNavigate = (view: NavItem, extra?: BacktestNavState & AIAnalysisNavState) => {
    setActiveView(view);
    if (extra) {
      if (view === 'backtest') {
        setBacktestNavState({ strategy: extra.strategy, symbol: extra.symbol });
      }
      if (view === 'aiAnalysis') {
        setAIAnalysisNavState({ symbol: extra.symbol });
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a0a0f]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar activeItem={activeView} onItemChange={setActiveView} />
      </div>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-3 left-3 z-50 bg-[#111118] border border-[#1e1e2e] text-zinc-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0 bg-[#0d0d14] border-[#1e1e2e]">
            <Sidebar activeItem={activeView} onItemChange={(item) => { setActiveView(item); setMobileOpen(false); }} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-h-screen flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-[#1e1e2e] bg-[#0d0d14]/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3 pl-10 md:pl-0">
            <h2 className="text-lg font-semibold text-white">{t(viewTitleKeys[activeView])}</h2>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-600/15 border border-emerald-600/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">{t('header.live')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              {new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          <ViewRenderer activeView={activeView} onNavigate={handleNavigate} backtestNavState={backtestNavState} aiAnalysisNavState={aiAnalysisNavState} />
        </div>

        {/* Footer */}
        <footer className="border-t border-[#1e1e2e] bg-[#0d0d14]/80 backdrop-blur-sm px-4 md:px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{t('footer.brand')}</span>
            <span>{t('footer.dataBy')}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
