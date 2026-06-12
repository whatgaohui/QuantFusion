'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  PieChart,
  Eye,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  Globe,
  Brain,
  Radar,
  Swords,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

export type NavItem = 'dashboard' | 'etfPortfolio' | 'etfDetail' | 'watchlist' | 'aiAnalysis' | 'signalScanner' | 'strategyCenter' | 'settings';

interface NavConfig {
  id: NavItem;
  labelKey: string;
  icon: React.ElementType;
  accent?: boolean;
}

const navItems: NavConfig[] = [
  { id: 'dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { id: 'etfPortfolio', labelKey: 'sidebar.etfPortfolio', icon: PieChart, accent: true },
  { id: 'watchlist', labelKey: 'sidebar.watchlist', icon: Eye },
  // --- separator ---
  { id: 'aiAnalysis', labelKey: 'sidebar.aiAnalysis', icon: Brain },
  { id: 'signalScanner', labelKey: 'sidebar.scanner', icon: Radar },
  { id: 'strategyCenter', labelKey: 'sidebar.strategies', icon: Swords },
  // --- separator ---
  // etfDetail is NOT in the sidebar — it's navigated to from portfolio/watchlist items
  { id: 'settings', labelKey: 'sidebar.settings', icon: Settings },
];

// Items that should have a separator rendered before them
const SEPARATOR_BEFORE = new Set<NavItem>(['aiAnalysis', 'settings']);

interface SidebarProps {
  activeItem: NavItem;
  onItemChange: (item: NavItem) => void;
}

export function Sidebar({ activeItem, onItemChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'h-screen sticky top-0 flex flex-col bg-[#0d0d14] border-r border-[#1e1e2e] transition-all duration-300 ease-in-out z-50',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 px-4 border-b border-[#1e1e2e]',
          collapsed ? 'justify-center' : 'gap-3'
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600/20 flex-shrink-0 animate-glow-pulse">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden logo-underline">
              <h1 className="text-lg font-bold gradient-text whitespace-nowrap">QuantFusion</h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            // Add separator before certain items
            if (SEPARATOR_BEFORE.has(item.id)) {
              return (
                <div key={item.id}>
                  <div className="py-1.5 px-2">
                    <div className="h-px bg-[#1e1e2e]" />
                  </div>
                  <SidebarButton
                    item={item}
                    collapsed={collapsed}
                    isActive={activeItem === item.id || (item.id === 'etfPortfolio' && activeItem === 'etfDetail')}
                    onItemChange={onItemChange}
                    t={t}
                  />
                </div>
              );
            }

            return (
              <SidebarButton
                key={item.id}
                item={item}
                collapsed={collapsed}
                isActive={activeItem === item.id || (item.id === 'etfPortfolio' && activeItem === 'etfDetail')}
                onItemChange={onItemChange}
                t={t}
              />
            );
          })}
        </nav>

        <Separator className="bg-[#1e1e2e]" />

        {/* Language Toggle */}
        <div className={cn(
          'py-2 px-2',
          collapsed ? 'flex justify-center' : ''
        )}>
          <button
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
            className={cn(
              'flex items-center gap-3 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e] transition-colors',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2 w-full'
            )}
          >
            <Globe className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium leading-5">
                {language === 'en' ? '中文' : 'English'}
              </span>
            )}
          </button>
        </div>

        {/* Collapse toggle */}
        <div className="p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'flex items-center gap-3 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e] transition-colors',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2 w-full'
            )}
          >
            {collapsed ? (
              <ChevronsRight className="w-5 h-5 flex-shrink-0" />
            ) : (
              <>
                <ChevronsLeft className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium leading-5">{t('sidebar.collapse')}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

// ─── Sidebar Button Sub-component ──────────────────────────────────────────

function SidebarButton({
  item,
  collapsed,
  isActive,
  onItemChange,
  t,
}: {
  item: NavConfig;
  collapsed: boolean;
  isActive: boolean;
  onItemChange: (item: NavItem) => void;
  t: (key: string) => string;
}) {
  const Icon = item.icon;
  const label = t(item.labelKey);

  const button = (
    <button
      onClick={() => onItemChange(item.id)}
      className={cn(
        'w-full flex items-center gap-3 rounded-lg transition-all duration-300 group relative',
        collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
        isActive
          ? item.accent
            ? 'bg-emerald-600/20 text-emerald-400 shadow-sm shadow-emerald-600/10'
            : 'bg-emerald-600/15 text-emerald-400 shadow-sm'
          : 'text-zinc-400 hover:bg-[#1a1a2e] hover:text-zinc-200'
      )}
    >
      {/* Active left border indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-emerald-400 rounded-r-full transition-all duration-300" />
      )}
      {/* Icon container — 20×20 icon inside 28×28 wrapper for accent items, 20×20 icon directly for others */}
      {item.accent ? (
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center rounded-md transition-colors w-7 h-7',
          isActive
            ? 'bg-emerald-600/25 shadow-sm shadow-emerald-500/20'
            : 'bg-emerald-600/10'
        )}>
          <Icon
            className={cn(
              'transition-colors w-4 h-4',
              isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
            )}
          />
        </div>
      ) : (
        <Icon
          className={cn(
            'transition-colors flex-shrink-0 w-5 h-5',
            isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
          )}
        />
      )}
      {!collapsed && (
        <span className={cn(
          'text-sm font-medium whitespace-nowrap leading-7',
          isActive ? 'text-emerald-400' : '',
          item.accent ? 'font-semibold' : ''
        )}>
          {label}
        </span>
      )}
      {isActive && !collapsed && (
        <div className={cn(
          'ml-auto rounded-full bg-emerald-400 animate-glow-pulse',
          item.accent ? 'w-2 h-2' : 'w-1.5 h-1.5'
        )} />
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-[#1a1a2e] text-zinc-200 border-[#2e2e3e]">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
