'use client';

import { useState } from 'react';
import { Sidebar, type NavItem } from '@/components/dashboard/sidebar';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { AIAnalysisView } from '@/components/dashboard/ai-analysis-view';
import { AgentChatView } from '@/components/dashboard/agent-chat-view';
import { SignalScannerView } from '@/components/dashboard/signal-scanner-view';
import { PositionsView } from '@/components/dashboard/positions-view';
import { ETFPortfolioView } from '@/components/dashboard/etf-portfolio-view';
import { WatchlistView } from '@/components/dashboard/watchlist-view';
import { StrategyCenterView } from '@/components/dashboard/strategy-center-view';
import { MarketNewsView } from '@/components/dashboard/news-view';
import { BacktestView } from '@/components/dashboard/backtest-view';
import { SettingsView } from '@/components/dashboard/settings-view';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/lib/i18n';

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
    case 'positions':
      return <PositionsView />;
    case 'etfPortfolio':
      return <ETFPortfolioView />;
    case 'watchlist':
      return <WatchlistView onNavigate={(v, extra) => onNavigate(v, extra)} />;
    case 'strategies':
      return <StrategyCenterView onNavigate={(v, extra) => onNavigate(v, extra)} />;
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
  aiAnalysis: 'sidebar.aiAnalysis',
  agentChat: 'sidebar.agentChat',
  scanner: 'sidebar.scanner',
  positions: 'sidebar.positions',
  etfPortfolio: 'sidebar.etfPortfolio',
  watchlist: 'sidebar.watchlist',
  strategies: 'sidebar.strategies',
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
