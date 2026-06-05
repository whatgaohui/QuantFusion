'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Brain,
  MessageSquare,
  Radar,
  PieChart,
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
import { useLanguage } from '@/lib/i18n';

export type NavItem = 'dashboard' | 'etfPortfolio' | 'watchlist' | 'scanner' | 'aiAnalysis' | 'agentChat' | 'news' | 'backtest' | 'settings';

interface NavConfig {
  id: NavItem;
  labelKey: string;
  icon: React.ElementType;
  accent?: boolean;
  group?: string; // 'portfolio' | 'analysis' | 'tools' | undefined (top-level)
}

const groupLabelKeys: Record<string, string> = {
  portfolio: 'sidebar.groupPortfolio',
  analysis: 'sidebar.groupAnalysis',
  tools: 'sidebar.groupTools',
};

const navItems: NavConfig[] = [
  // Top-level
  { id: 'dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  // Portfolio Group
  { id: 'etfPortfolio', labelKey: 'sidebar.etfPortfolio', icon: PieChart, accent: true, group: 'portfolio' },
  { id: 'watchlist', labelKey: 'sidebar.watchlist', icon: Eye, group: 'portfolio' },
  // Analysis Group
  { id: 'scanner', labelKey: 'sidebar.scanner', icon: Radar, group: 'analysis' },
  { id: 'aiAnalysis', labelKey: 'sidebar.aiAnalysis', icon: Brain, accent: true, group: 'analysis' },
  { id: 'agentChat', labelKey: 'sidebar.agentChat', icon: MessageSquare, group: 'analysis' },
  // Tools Group
  { id: 'news', labelKey: 'sidebar.news', icon: Newspaper, group: 'tools' },
  { id: 'backtest', labelKey: 'sidebar.backtest', icon: FlaskConical, group: 'tools' },
  // Settings (bottom, no group)
  { id: 'settings', labelKey: 'sidebar.settings', icon: Settings },
];

interface SidebarProps {
  activeItem: NavItem;
  onItemChange: (item: NavItem) => void;
}

export function Sidebar({ activeItem, onItemChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  // Build grouped structure for rendering
  type GroupEntry = { type: 'header'; groupKey: string } | { type: 'separator' } | { type: 'item'; config: NavConfig };
  const layoutEntries: GroupEntry[] = [];

  let lastGroup: string | undefined = undefined;
  for (const item of navItems) {
    if (item.id === 'settings') {
      // Settings gets a separator before it but no group header
      layoutEntries.push({ type: 'separator' });
      layoutEntries.push({ type: 'item', config: item });
      continue;
    }

    if (item.group && item.group !== lastGroup) {
      // Add separator between groups
      if (lastGroup !== undefined) {
        layoutEntries.push({ type: 'separator' });
      }
      layoutEntries.push({ type: 'header', groupKey: item.group });
      lastGroup = item.group;
    } else if (!item.group && lastGroup !== undefined) {
      // Transition from grouped to ungrouped
      layoutEntries.push({ type: 'separator' });
      lastGroup = undefined;
    }

    layoutEntries.push({ type: 'item', config: item });
  }

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
              <h1 className="text-lg font-bold gradient-text whitespace-nowrap">QuantFusion</h1>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          {layoutEntries.map((entry, idx) => {
            if (entry.type === 'separator') {
              return (
                <div key={`sep-${idx}`} className="py-1.5 px-2">
                  <div className="h-px bg-[#1e1e2e]" />
                </div>
              );
            }

            if (entry.type === 'header') {
              if (collapsed) return null;
              const label = t(groupLabelKeys[entry.groupKey] || entry.groupKey);
              return (
                <div key={`hdr-${entry.groupKey}`} className="px-3 pt-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500/70">
                    {label}
                  </span>
                </div>
              );
            }

            // Nav item
            const item = entry.config;
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            const label = t(item.labelKey);

            const button = (
              <button
                onClick={() => onItemChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg transition-all duration-200 group',
                  collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                  item.accent && !collapsed ? 'py-2.5' : '',
                  isActive
                    ? item.accent
                      ? 'bg-emerald-600/20 text-emerald-400 shadow-sm shadow-emerald-600/10'
                      : 'bg-emerald-600/15 text-emerald-400 shadow-sm'
                    : 'text-zinc-400 hover:bg-[#1a1a2e] hover:text-zinc-200'
                )}
              >
                <div className={cn(
                  'flex-shrink-0 flex items-center justify-center rounded-md transition-colors',
                  item.accent && isActive
                    ? 'w-7 h-7 bg-emerald-600/25 shadow-sm shadow-emerald-500/20'
                    : item.accent
                    ? 'w-7 h-7 bg-emerald-600/10'
                    : ''
                )}>
                  <Icon
                    className={cn(
                      'transition-colors',
                      item.accent ? 'w-5 h-5' : 'w-5 h-5',
                      isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                    )}
                  />
                </div>
                {!collapsed && (
                  <span className={cn(
                    'text-sm font-medium whitespace-nowrap',
                    isActive ? 'text-emerald-400' : '',
                    item.accent ? 'font-semibold' : ''
                  )}>
                    {label}
                  </span>
                )}
                {isActive && !collapsed && (
                  <div className={cn(
                    'ml-auto rounded-full bg-emerald-400 animate-pulse-glow',
                    item.accent ? 'w-2 h-2' : 'w-1.5 h-1.5'
                  )} />
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
