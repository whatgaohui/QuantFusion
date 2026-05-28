'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Radar,
  Briefcase,
  Eye,
  Newspaper,
  FlaskConical,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  Globe,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useLanguage, type Language } from '@/lib/i18n';

export type NavItem = 'dashboard' | 'scanner' | 'positions' | 'watchlist' | 'news' | 'backtest' | 'settings';

interface NavConfig {
  id: NavItem;
  labelKey: string;
  icon: React.ElementType;
}

const navItems: NavConfig[] = [
  { id: 'dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { id: 'scanner', labelKey: 'sidebar.scanner', icon: Radar },
  { id: 'positions', labelKey: 'sidebar.positions', icon: Briefcase },
  { id: 'watchlist', labelKey: 'sidebar.watchlist', icon: Eye },
  { id: 'news', labelKey: 'sidebar.news', icon: Newspaper },
  { id: 'backtest', labelKey: 'sidebar.backtest', icon: FlaskConical },
  { id: 'settings', labelKey: 'sidebar.settings', icon: Settings },
];

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
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600/20 flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold gradient-text whitespace-nowrap">QuantFlow</h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            const label = t(item.labelKey);

            const button = (
              <button
                onClick={() => onItemChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg transition-all duration-200 group',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-emerald-600/15 text-emerald-400 shadow-sm'
                    : 'text-zinc-400 hover:bg-[#1a1a2e] hover:text-zinc-200'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  )}
                />
                {!collapsed && (
                  <span className={cn(
                    'text-sm font-medium whitespace-nowrap',
                    isActive ? 'text-emerald-400' : ''
                  )}>
                    {label}
                  </span>
                )}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
                )}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#1a1a2e] text-zinc-200 border-[#2e2e3e]">
                    {label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <div key={item.id}>
                {button}
              </div>
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
              'flex items-center gap-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e] transition-colors',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2 w-full'
            )}
          >
            <Globe className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <span className="text-xs font-medium">
                {language === 'en' ? '中文' : 'English'}
              </span>
            )}
          </button>
        </div>

        {/* Collapse toggle */}
        <div className="p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a2e] transition-colors"
          >
            {collapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronsLeft className="w-4 h-4" />
                <span className="text-xs font-medium">{t('sidebar.collapse')}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
