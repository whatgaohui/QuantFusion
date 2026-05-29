'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLanguage } from '@/lib/i18n';
import { Sidebar, type NavItem } from '@/components/dashboard/sidebar';
import dynamic from 'next/dynamic';

const viewTitleKeys: Record<NavItem, string> = {
  dashboard: 'sidebar.dashboard',
  aiAnalysis: 'sidebar.aiAnalysis',
  agentChat: 'sidebar.agentChat',
  scanner: 'sidebar.scanner',
  positions: 'sidebar.positions',
  watchlist: 'sidebar.watchlist',
  strategies: 'sidebar.strategies',
  news: 'sidebar.news',
  backtest: 'sidebar.backtest',
  settings: 'sidebar.settings',
};

// Use next/dynamic with ssr: false to reduce server compilation load
const DashboardView = dynamic(() => import('@/components/dashboard/dashboard-view').then(m => ({ default: m.DashboardView })), { ssr: false });
const AIAnalysisView = dynamic(() => import('@/components/dashboard/ai-analysis-view').then(m => ({ default: m.AIAnalysisView })), { ssr: false });
const AgentChatView = dynamic(() => import('@/components/dashboard/agent-chat-view').then(m => ({ default: m.AgentChatView })), { ssr: false });
const SignalScannerView = dynamic(() => import('@/components/dashboard/signal-scanner-view').then(m => ({ default: m.SignalScannerView })), { ssr: false });
const PositionsView = dynamic(() => import('@/components/dashboard/positions-view').then(m => ({ default: m.PositionsView })), { ssr: false });
const WatchlistView = dynamic(() => import('@/components/dashboard/watchlist-view').then(m => ({ default: m.WatchlistView })), { ssr: false });
const StrategyCenterView = dynamic(() => import('@/components/dashboard/strategy-center-view').then(m => ({ default: m.StrategyCenterView })), { ssr: false });
const MarketNewsView = dynamic(() => import('@/components/dashboard/news-view').then(m => ({ default: m.MarketNewsView })), { ssr: false });
const BacktestView = dynamic(() => import('@/components/dashboard/backtest-view').then(m => ({ default: m.BacktestView })), { ssr: false });
const SettingsView = dynamic(() => import('@/components/dashboard/settings-view').then(m => ({ default: m.SettingsView })), { ssr: false });

function ViewFallback() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse h-32 rounded-xl bg-[#111118]" />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activeView, setActiveView] = useState<NavItem>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [backtestStrategy, setBacktestStrategy] = useState('');
  const { t, language } = useLanguage();

  const handleBacktest = (strategyId: string) => {
    setBacktestStrategy(strategyId);
    setActiveView('backtest');
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardView />;
      case 'aiAnalysis': return <AIAnalysisView />;
      case 'agentChat': return <AgentChatView />;
      case 'scanner': return <SignalScannerView />;
      case 'positions': return <PositionsView />;
      case 'watchlist': return <WatchlistView />;
      case 'strategies': return <StrategyCenterView onBacktest={handleBacktest} />;
      case 'news': return <MarketNewsView />;
      case 'backtest': return <BacktestView initialStrategy={backtestStrategy} />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView />;
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
        <div className={`flex-1 min-h-0 ${activeView === 'agentChat' ? 'overflow-hidden p-2 md:p-3' : 'overflow-y-auto custom-scrollbar p-4 md:p-6'}`}>
          {renderView()}
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
