'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Key,
  Shield,
  Bell,
  Info,
  Eye,
  EyeOff,
  Save,
  Globe,
  Cpu,
  Database,
  Clock,
  Server,
  CheckCircle2,
  Send,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

/** 数据源状态面板组件 */
function DataSourceStatusPanel() {
  const { t, language } = useLanguage();
  const [sources, setSources] = useState<Array<{
    name: string; displayName: string; market: string; enabled: boolean;
    health: { status: string; latencyMs: number; lastSuccessAt: string | null; consecutiveFailures: number };
  }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fusion/market/data-sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data.dataSources || []);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return t('scanner.healthy');
      case 'degraded': return t('scanner.degraded');
      case 'down': return t('scanner.down');
      default: return t('scanner.unknown');
    }
  };

  const getSourceDisplayName = (name: string) => {
    const nameMap: Record<string, string> = {
      finnhub: t('scanner.finnhub'),
      eastmoney: t('scanner.eastMoney'),
      sina: t('scanner.sina'),
      tencent: t('scanner.tencent'),
      iwencai: t('scanner.iwencai'),
    };
    return nameMap[name] || name;
  };

  if (loading && sources.length === 0) {
    return (
      <div className="py-4 text-center">
        <Loader2 className="w-4 h-4 text-zinc-400 animate-spin mx-auto" />
        <p className="text-xs text-zinc-500 mt-2">{language === 'zh' ? '加载数据源状态...' : 'Loading source status...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-zinc-400">{t('scanner.dataSourceStatus')}</h4>
        <Button variant="ghost" size="sm" onClick={fetchStatus} className="h-5 px-1.5 text-zinc-500 hover:text-white">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map((source) => (
          <div key={source.name} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(source.health.status)}`} />
                <span className="text-xs font-medium text-white">{getSourceDisplayName(source.name)}</span>
              </div>
              <span className="text-[10px] text-zinc-500">{source.market}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">{getStatusText(source.health.status)}</span>
              {source.health.latencyMs > 0 && (
                <span className="text-zinc-500">{source.health.latencyMs}ms</span>
              )}
            </div>
            {source.health.lastSuccessAt && (
              <p className="text-[10px] text-zinc-600 mt-1">
                {t('scanner.lastSuccess')}: {new Date(source.health.lastSuccessAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US')}
              </p>
            )}
            {!source.enabled && (
              <p className="text-[10px] text-zinc-600 mt-1">{language === 'zh' ? '已禁用' : 'Disabled'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Storage keys
// ============================================================

const SETTINGS_KEY = 'quantfusion-settings';
const LLM_PROVIDERS_KEY = 'quantfusion-llm-providers';

// ============================================================
// Provider-to-Model mapping & base URLs
// ============================================================

const PROVIDER_MODELS: Record<string, string[]> = {
  'z-ai': ['default'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini', 'o4-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3.7-sonnet', 'claude-3.5-haiku'],
  qwen: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-plus-latest', 'qwen3-235b-a22b', 'qwen3-32b'],
  glm: ['glm-4-flash', 'glm-4', 'glm-4-plus', 'glm-4-long', 'glm-4-air'],
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  'z-ai': '',  // Built-in SDK, no base URL needed
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
};

function getBaseUrl(provider: string): string {
  return PROVIDER_BASE_URLS[provider] || '';
}

// ============================================================
// Per-Provider Configuration
// ============================================================

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: string;
  maxTokens: string;
}

const CUSTOM_PROVIDER_KEY = '__custom__';

const LLM_PROVIDERS = [
  { key: 'z-ai', label: 'Z.ai', isFree: true },
  { key: 'deepseek', label: 'DeepSeek' },
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'qwen', label: 'Qwen' },
  { key: 'glm', label: 'GLM' },
  { key: CUSTOM_PROVIDER_KEY, label: 'Custom' },
] as const;

function getDefaultProviderConfig(providerKey: string): ProviderConfig {
  const models = PROVIDER_MODELS[providerKey] || [];
  return {
    apiKey: providerKey === 'z-ai' ? 'built-in' : '',
    baseUrl: PROVIDER_BASE_URLS[providerKey] || '',
    model: models[0] || '',
    temperature: '0.7',
    maxTokens: '4096',
  };
}

interface AllProviderConfigs {
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  customProviderName: string;
}

function getDefaultAllProviderConfigs(): AllProviderConfigs {
  const providers: Record<string, ProviderConfig> = {};
  for (const p of LLM_PROVIDERS) {
    if (p.key !== CUSTOM_PROVIDER_KEY) {
      providers[p.key] = getDefaultProviderConfig(p.key);
    }
  }
  providers[CUSTOM_PROVIDER_KEY] = {
    apiKey: '',
    baseUrl: '',
    model: '',
    temperature: '0.7',
    maxTokens: '4096',
  };
  return {
    activeProvider: 'z-ai',
    providers,
    customProviderName: '',
  };
}

function loadProviderConfigs(): AllProviderConfigs {
  if (typeof window === 'undefined') return getDefaultAllProviderConfigs();
  try {
    const saved = localStorage.getItem(LLM_PROVIDERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const defaults = getDefaultAllProviderConfigs();
      return {
        activeProvider: parsed.activeProvider || defaults.activeProvider,
        providers: { ...defaults.providers, ...parsed.providers },
        customProviderName: parsed.customProviderName || '',
      };
    }
  } catch {
    // Ignore parse errors
  }
  return getDefaultAllProviderConfigs();
}

function saveProviderConfigs(configs: AllProviderConfigs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LLM_PROVIDERS_KEY, JSON.stringify(configs));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================
// Legacy AppSettings (non-LLM fields)
// ============================================================

interface AppSettings {
  llmProvider: string;
  llmModel: string;
  llmApiKey: string;
  llmTemperature: string;
  llmMaxTokens: string;
  finnhubEnabled: boolean;
  finnhubToken: string;
  clsEnabled: boolean;
  sinaEnabled: boolean;
  positionSize: string;
  stopLoss: string;
  takeProfit: string;
  cycleDays: string;
  maxPortfolioRisk: string;
  maxSinglePosition: string;
  notifSignalAlerts: boolean;
  notifPriceAlerts: boolean;
  notifPositionUpdates: boolean;
  notifDailyReport: boolean;
  notifMarketNews: boolean;
}

const defaultSettings: AppSettings = {
  llmProvider: 'deepseek',
  llmModel: 'deepseek-chat',
  llmApiKey: '',
  llmTemperature: '0.7',
  llmMaxTokens: '4096',
  finnhubEnabled: true,
  finnhubToken: '',
  clsEnabled: true,
  sinaEnabled: true,
  positionSize: '10',
  stopLoss: '8',
  takeProfit: '15',
  cycleDays: '7',
  maxPortfolioRisk: '25',
  maxSinglePosition: '15',
  notifSignalAlerts: true,
  notifPriceAlerts: true,
  notifPositionUpdates: true,
  notifDailyReport: false,
  notifMarketNews: true,
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return defaultSettings;
}

function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================
// 渠道配置类型
// ============================================================

interface ChannelConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
}

interface ChannelInfo {
  type: string;
  label: string;
  configFields: ChannelConfigField[];
  isEnabled: boolean;
  savedConfig: Record<string, string>;
}

export function SettingsView() {
  const { t, language, setLanguage } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingLlm, setTestingLlm] = useState<string | null>(null);
  const [llmTestResults, setLlmTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [testingFinnhub, setTestingFinnhub] = useState(false);
  const [finnhubTestResult, setFinnhubTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Load settings from localStorage on mount using lazy initializer (fast initial paint)
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    return loadSettings();
  });

  // Per-provider LLM configs
  const [providerConfigs, setProviderConfigs] = useState<AllProviderConfigs>(() => {
    if (typeof window === 'undefined') return getDefaultAllProviderConfigs();
    return loadProviderConfigs();
  });

  // On mount, load LLM settings from server and merge into provider configs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/llm');
        if (res.ok) {
          const data = await res.json();
          const serverProvider = data.provider || 'deepseek';
          const serverBaseUrl = data.baseUrl || PROVIDER_BASE_URLS[serverProvider] || '';
          setProviderConfigs(prev => ({
            ...prev,
            activeProvider: serverProvider,
            providers: {
              ...prev.providers,
              [serverProvider]: {
                ...(prev.providers[serverProvider] || getDefaultProviderConfig(serverProvider)),
                apiKey: data.apiKey || prev.providers[serverProvider]?.apiKey || '',
                baseUrl: serverBaseUrl || prev.providers[serverProvider]?.baseUrl || PROVIDER_BASE_URLS[serverProvider] || '',
                model: data.model || prev.providers[serverProvider]?.model || '',
                temperature: data.temperature != null ? String(data.temperature) : prev.providers[serverProvider]?.temperature || '0.7',
                maxTokens: data.maxTokens != null ? String(data.maxTokens) : prev.providers[serverProvider]?.maxTokens || '4096',
              },
            },
          }));
          // Also update legacy settings for backward compat
          setSettings(prev => ({
            ...prev,
            llmProvider: serverProvider,
            llmModel: data.model || prev.llmModel,
            llmApiKey: data.apiKey || prev.llmApiKey,
            llmTemperature: data.temperature != null ? String(data.temperature) : prev.llmTemperature,
            llmMaxTokens: data.maxTokens != null ? String(data.maxTokens) : prev.llmMaxTokens,
          }));
        }
      } catch {
        // Fallback to localStorage values already loaded
      }
    })();
  }, []);

  // On mount, load data source settings from server
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/data-sources');
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({
            ...prev,
            finnhubToken: data.finnhubApiKey || prev.finnhubToken,
            finnhubEnabled: data.finnhubEnabled !== undefined ? data.finnhubEnabled : prev.finnhubEnabled,
            sinaEnabled: data.sinaEnabled !== undefined ? data.sinaEnabled : prev.sinaEnabled,
            clsEnabled: data.clsEnabled !== undefined ? data.clsEnabled : prev.clsEnabled,
          }));
        }
      } catch {
        // fallback to localStorage
      }
    })();
  }, []);

  // 渠道配置状态
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [channelConfigEdits, setChannelConfigEdits] = useState<Record<string, Record<string, string>>>({});
  const [channelSaving, setChannelSaving] = useState<string | null>(null);

  // Destructure for convenience
  const finnhubEnabled = settings.finnhubEnabled;
  const finnhubToken = settings.finnhubToken;
  const clsEnabled = settings.clsEnabled;
  const sinaEnabled = settings.sinaEnabled;
  const positionSize = settings.positionSize;
  const stopLoss = settings.stopLoss;
  const takeProfit = settings.takeProfit;
  const cycleDays = settings.cycleDays;
  const maxPortfolioRisk = settings.maxPortfolioRisk;
  const maxSinglePosition = settings.maxSinglePosition;
  const notifSignalAlerts = settings.notifSignalAlerts;
  const notifPriceAlerts = settings.notifPriceAlerts;
  const notifPositionUpdates = settings.notifPositionUpdates;
  const notifDailyReport = settings.notifDailyReport;
  const notifMarketNews = settings.notifMarketNews;

  // ============================================================
  // Per-Provider Config helpers
  // ============================================================

  const getActiveConfig = useCallback((): ProviderConfig => {
    return providerConfigs.providers[providerConfigs.activeProvider] || getDefaultProviderConfig(providerConfigs.activeProvider);
  }, [providerConfigs]);

  const updateProviderConfig = useCallback((providerKey: string, field: keyof ProviderConfig, value: string) => {
    setProviderConfigs(prev => {
      const existing = prev.providers[providerKey] || getDefaultProviderConfig(providerKey);
      return {
        ...prev,
        providers: {
          ...prev.providers,
          [providerKey]: { ...existing, [field]: value },
        },
      };
    });
    setSaved(false);
  }, []);

  const setActiveProvider = useCallback((providerKey: string) => {
    setProviderConfigs(prev => ({
      ...prev,
      activeProvider: providerKey,
    }));
    setSettings(prev => ({
      ...prev,
      llmProvider: providerKey,
    }));
    setSaved(false);
  }, []);

  // ============================================================
  // Settings update (non-LLM)
  // ============================================================

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  /** Save active provider config to server + all configs to localStorage */
  const handleSaveLlm = async () => {
    setSaving(true);
    try {
      const activeConfig = getActiveConfig();
      const activeProvider = providerConfigs.activeProvider;
      const isBuiltIn = activeProvider === 'z-ai';
      // Save to server DB (active provider only)
      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          apiKey: isBuiltIn ? '' : activeConfig.apiKey,
          baseUrl: isBuiltIn ? '' : (activeConfig.baseUrl || getBaseUrl(activeProvider)),
          model: activeConfig.model,
          temperature: parseFloat(activeConfig.temperature),
          maxTokens: parseInt(activeConfig.maxTokens, 10),
          enabled: true,
        }),
      });
      if (res.ok) {
        toast.success(language === 'zh' ? '设置已保存' : 'Settings saved successfully');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error(language === 'zh' ? '保存失败' : 'Failed to save settings');
      }
      // Save all provider configs to localStorage
      saveProviderConfigs(providerConfigs);
      // Also update legacy settings
      setSettings(prev => ({
        ...prev,
        llmProvider: activeProvider,
        llmModel: activeConfig.model,
        llmApiKey: activeConfig.apiKey,
        llmTemperature: activeConfig.temperature,
        llmMaxTokens: activeConfig.maxTokens,
      }));
      saveSettings(settings);
    } catch {
      toast.error(language === 'zh' ? '网络错误' : 'Network error');
      saveProviderConfigs(providerConfigs);
      saveSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  /** Test LLM connection for a specific provider */
  const handleTestLlm = async (providerKey: string) => {
    const config = providerConfigs.providers[providerKey] || getDefaultProviderConfig(providerKey);
    setTestingLlm(providerKey);
    setLlmTestResults(prev => {
      const next = { ...prev };
      delete next[providerKey];
      return next;
    });
    try {
      const res = await fetch('/api/settings/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerKey === CUSTOM_PROVIDER_KEY ? 'openai' : providerKey,
          apiKey: providerKey === 'z-ai' ? '' : config.apiKey,
          baseUrl: config.baseUrl || getBaseUrl(providerKey),
          model: config.model,
        }),
      });
      const data = await res.json();
      setLlmTestResults(prev => ({
        ...prev,
        [providerKey]: { success: data.success, error: data.error },
      }));
      if (data.success) {
        toast.success(language === 'zh' ? '连接测试成功！' : 'Connection test passed!');
      } else {
        toast.error(language === 'zh' ? `连接测试失败: ${data.error}` : `Connection test failed: ${data.error}`);
      }
    } catch {
      setLlmTestResults(prev => ({
        ...prev,
        [providerKey]: { success: false, error: 'Network error' },
      }));
      toast.error(language === 'zh' ? '网络错误' : 'Network error');
    } finally {
      setTestingLlm(null);
    }
  };

  /** Save non-LLM settings */
  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      saveSettings(settings);
      toast.success(language === 'zh' ? '设置已保存' : 'Settings saved successfully');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error(language === 'zh' ? '保存失败' : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  /** Save data source settings to server */
  const handleSaveDataSources = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finnhubApiKey: settings.finnhubToken,
          finnhubEnabled: settings.finnhubEnabled,
          sinaEnabled: settings.sinaEnabled,
          clsEnabled: settings.clsEnabled,
        }),
      });
      if (res.ok) {
        saveSettings(settings); // also save to localStorage as backup
        toast.success(language === 'zh' ? '设置已保存' : 'Settings saved successfully');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error(language === 'zh' ? '保存失败' : 'Failed to save settings');
      }
    } catch {
      toast.error(language === 'zh' ? '网络错误' : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  /** Test Finnhub connectivity */
  const handleTestFinnhub = async () => {
    if (!settings.finnhubToken) {
      toast.error(language === 'zh' ? '请先输入 Finnhub API Token' : 'Please enter Finnhub API Token first');
      return;
    }
    setTestingFinnhub(true);
    setFinnhubTestResult(null);
    try {
      const res = await fetch('/api/settings/data-sources/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.finnhubToken }),
      });
      const data = await res.json();
      setFinnhubTestResult(data);
      if (data.success) {
        toast.success(language === 'zh' ? 'Finnhub 连接测试成功！' : 'Finnhub connection test passed!');
      } else {
        toast.error(language === 'zh' ? `连接测试失败: ${data.error}` : `Connection test failed: ${data.error}`);
      }
    } catch {
      setFinnhubTestResult({ success: false, error: 'Network error' });
      toast.error(language === 'zh' ? '网络错误' : 'Network error');
    } finally {
      setTestingFinnhub(false);
    }
  };

  // ============================================================
  // 渠道配置相关
  // ============================================================

  const fetchChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch('/api/fusion/notifications/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        const edits: Record<string, Record<string, string>> = {};
        for (const ch of data.channels || []) {
          edits[ch.type] = { ...ch.savedConfig };
        }
        setChannelConfigEdits(edits);
      }
    } catch {
      // 使用默认空列表
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  /** 保存渠道配置 */
  const saveChannelConfig = async (channelType: string) => {
    setChannelSaving(channelType);
    try {
      const config = channelConfigEdits[channelType] || {};
      const channel = channels.find(c => c.type === channelType);
      const res = await fetch(`/api/fusion/notifications/channels/${channelType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          isEnabled: channel?.isEnabled ?? true,
        }),
      });
      if (res.ok) {
        toast.success(
          language === 'zh'
            ? `${channel?.label || channelType} 配置已保存`
            : `${channel?.label || channelType} configuration saved`
        );
        fetchChannels();
      } else {
        toast.error(language === 'zh' ? '保存失败' : 'Failed to save');
      }
    } catch {
      toast.error(language === 'zh' ? '网络错误' : 'Network error');
    } finally {
      setChannelSaving(null);
    }
  };

  /** 切换渠道启用状态 */
  const toggleChannelEnabled = async (channelType: string, isEnabled: boolean) => {
    try {
      const config = channelConfigEdits[channelType] || {};
      const res = await fetch(`/api/fusion/notifications/channels/${channelType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, isEnabled }),
      });
      if (res.ok) {
        setChannels(prev =>
          prev.map(ch => ch.type === channelType ? { ...ch, isEnabled } : ch)
        );
      }
    } catch {
      // Ignore
    }
  };

  /** 测试渠道连通性 */
  const testChannel = async (channelType: string) => {
    setTestingChannel(channelType);
    try {
      const res = await fetch(`/api/fusion/notifications/test/${channelType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: channelConfigEdits[channelType] || {} }),
      });
      const data = await res.json();
      setTestResults(prev => ({
        ...prev,
        [channelType]: { success: data.success, error: data.error },
      }));
      if (data.success) {
        toast.success(
          language === 'zh'
            ? `${data.channelLabel} 连通测试成功！`
            : `${data.channelLabel} connectivity test passed!`
        );
      } else {
        toast.error(
          language === 'zh'
            ? `${data.channelLabel} 连通测试失败: ${data.error}`
            : `${data.channelLabel} test failed: ${data.error}`
        );
      }
    } catch {
      setTestResults(prev => ({
        ...prev,
        [channelType]: { success: false, error: 'Network error' },
      }));
      toast.error(language === 'zh' ? '网络错误' : 'Network error');
    } finally {
      setTestingChannel(null);
    }
  };

  /** 更新渠道配置编辑 */
  const updateChannelConfigEdit = (channelType: string, key: string, value: string) => {
    setChannelConfigEdits(prev => ({
      ...prev,
      [channelType]: {
        ...(prev[channelType] || {}),
        [key]: value,
      },
    }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Tabs defaultValue="llm" className="space-y-6">
        <TabsList className="bg-[#111118] border border-[#1e1e2e]">
          <TabsTrigger value="llm" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Cpu className="w-3.5 h-3.5 mr-1.5" />
            LLM
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Database className="w-3.5 h-3.5 mr-1.5" />
            Data
          </TabsTrigger>
          <TabsTrigger value="trading" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Trading
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Bell className="w-3.5 h-3.5 mr-1.5" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Server className="w-3.5 h-3.5 mr-1.5" />
            System
          </TabsTrigger>
        </TabsList>

        {/* LLM Configuration — Per-Provider Tabs */}
        <TabsContent value="llm" className="space-y-6">
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('settings.llmConfig')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Inner per-provider tabs */}
              <Tabs
                value={providerConfigs.activeProvider}
                onValueChange={(v) => setActiveProvider(v)}
                className="space-y-4"
              >
                <TabsList className="bg-[#0a0a0f] border border-[#1e1e2e] w-full flex flex-wrap h-auto gap-1 p-1">
                  {LLM_PROVIDERS.map((p) => (
                    <TabsTrigger
                      key={p.key}
                      value={p.key}
                      className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400 text-xs px-2.5 py-1.5 flex items-center gap-1.5"
                    >
                      {p.key === providerConfigs.activeProvider && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      )}
                      {p.key === CUSTOM_PROVIDER_KEY
                        ? (language === 'zh' ? '自定义' : 'Custom')
                        : p.label}
                      {'isFree' in p && p.isFree && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[8px] px-1 py-0 leading-tight">
                          {language === 'zh' ? '免费' : 'Free'}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>

    {LLM_PROVIDERS.map((p) => {
                  const config = providerConfigs.providers[p.key] || getDefaultProviderConfig(p.key);
                  const models = PROVIDER_MODELS[p.key] || [];
                  const isCustom = p.key === CUSTOM_PROVIDER_KEY;
                  const isBuiltIn = p.key === 'z-ai';
                  const testResult = llmTestResults[p.key];
                  const isTesting = testingLlm === p.key;
                  const showKey = showApiKeys[p.key] || false;
                  // Check if current model is a custom model (not in the preset list)
                  const isCustomModel = config.model && models.length > 0 && !models.includes(config.model);

                  return (
                    <TabsContent key={p.key} value={p.key} className="space-y-4">
                      {/* Provider name badge + active indicator */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
                          {isCustom
                            ? (language === 'zh' ? '自定义提供商' : 'Custom Provider')
                            : isBuiltIn
                              ? 'Z.ai'
                              : p.label}
                        </Badge>
                        {isBuiltIn && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                            {language === 'zh' ? '免费内置' : 'Free Built-in'}
                          </Badge>
                        )}
                        {p.key === providerConfigs.activeProvider && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                            {language === 'zh' ? '当前使用' : 'Active'}
                          </Badge>
                        )}
                      </div>

                      {/* z-ai info banner */}
                      {isBuiltIn && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-lg">
                          <Cpu className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <p className="text-xs text-zinc-400">
                            {language === 'zh'
                              ? 'Z.ai 是内置的免费 AI 服务，无需配置 API Key 即可使用。所有 AI 分析功能默认使用此服务。'
                              : 'Z.ai is a built-in free AI service. No API key needed. All AI analysis features use this by default.'}
                          </p>
                        </div>
                      )}

                      {/* Custom provider name input */}
                      {isCustom && (
                        <div className="space-y-2">
                          <Label className="text-zinc-300 text-sm">
                            {language === 'zh' ? '提供商名称' : 'Provider Name'}
                          </Label>
                          <Input
                            type="text"
                            placeholder={language === 'zh' ? '例如: My Provider' : 'e.g. My Provider'}
                            value={providerConfigs.customProviderName}
                            onChange={(e) =>
                              setProviderConfigs(prev => ({
                                ...prev,
                                customProviderName: e.target.value,
                              }))
                            }
                            className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                          />
                        </div>
                      )}

                      {/* API Key — hidden for z-ai */}
                      {!isBuiltIn && (
                        <div className="space-y-2">
                          <Label className="text-zinc-300 text-sm">{t('settings.llmApiKey')}</Label>
                          <div className="relative">
                            <Input
                              type={showKey ? 'text' : 'password'}
                              value={config.apiKey}
                              onChange={(e) => updateProviderConfig(p.key, 'apiKey', e.target.value)}
                              className="bg-[#0a0a0f] border-[#1e1e2e] text-white pr-10"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setShowApiKeys(prev => ({ ...prev, [p.key]: !prev[p.key] }))
                              }
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-zinc-500 hover:text-white"
                            >
                              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Base URL — hidden for z-ai */}
                      {!isBuiltIn && (
                        <div className="space-y-2">
                          <Label className="text-zinc-300 text-sm">Base URL</Label>
                          <Input
                            type="text"
                            placeholder={PROVIDER_BASE_URLS[p.key] || 'https://api.example.com/v1'}
                            value={config.baseUrl}
                            onChange={(e) => updateProviderConfig(p.key, 'baseUrl', e.target.value)}
                            className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                          />
                          {!isCustom && PROVIDER_BASE_URLS[p.key] && (
                            <p className="text-[10px] text-zinc-500">
                              {language === 'zh' ? '默认: ' : 'Default: '}{PROVIDER_BASE_URLS[p.key]}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Model selector — combo: suggestions + custom input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-zinc-300 text-sm">{t('settings.llmModel')}</Label>
                          {models.length > 0 && (
                            <span className="text-[10px] text-zinc-500">
                              {language === 'zh' ? '可从列表选择或自行输入' : 'Select from list or type custom'}
                            </span>
                          )}
                        </div>
                        {models.length > 0 ? (
                          <div className="space-y-2">
                            <Select
                              value={isCustomModel ? '__custom__' : config.model}
                              onValueChange={(v) => {
                                if (v === '__custom__') {
                                  // Switch to custom mode — clear model to let user type
                                  updateProviderConfig(p.key, 'model', '');
                                } else {
                                  updateProviderConfig(p.key, 'model', v);
                                }
                              }}
                            >
                              <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                                <SelectValue placeholder={isCustomModel ? config.model : undefined} />
                              </SelectTrigger>
                              <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                                {models.map((m) => (
                                  <SelectItem key={m} value={m} className="text-zinc-300">{m}</SelectItem>
                                ))}
                                <SelectItem value="__custom__" className="text-emerald-400">
                                  ✏️ {language === 'zh' ? '自定义模型...' : 'Custom model...'}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {/* Show custom input when user selected custom or already has custom model */}
                            {(isCustomModel || config.model === '' || (models.length > 0 && !models.includes(config.model))) && (
                              <Input
                                type="text"
                                placeholder={language === 'zh' ? '输入自定义模型名称' : 'Enter custom model name'}
                                value={config.model}
                                onChange={(e) => updateProviderConfig(p.key, 'model', e.target.value)}
                                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                              />
                            )}
                          </div>
                        ) : (
                          <Input
                            type="text"
                            placeholder={language === 'zh' ? '输入模型名称' : 'Enter model name'}
                            value={config.model}
                            onChange={(e) => updateProviderConfig(p.key, 'model', e.target.value)}
                            className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                          />
                        )}
                      </div>

                      {/* Temperature & Max Tokens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-zinc-300 text-sm">{t('settings.llmTemperature')}</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={config.temperature}
                            onChange={(e) => updateProviderConfig(p.key, 'temperature', e.target.value)}
                            className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zinc-300 text-sm">{t('settings.llmMaxTokens')}</Label>
                          <Input
                            type="number"
                            value={config.maxTokens}
                            onChange={(e) => updateProviderConfig(p.key, 'maxTokens', e.target.value)}
                            className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                          />
                        </div>
                      </div>

                      {/* Security note */}
                      {!isBuiltIn && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-lg">
                          <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <p className="text-xs text-zinc-400">{t('settings.apiKeySecure')}</p>
                        </div>
                      )}

                      {/* Test result */}
                      {testResult && (
                        <div className={`flex items-center gap-2 p-3 rounded-lg ${
                          testResult.success
                            ? 'bg-emerald-600/5 border border-emerald-600/10'
                            : 'bg-red-600/5 border border-red-600/10'
                        }`}>
                          {testResult.success
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          }
                          <p className={`text-xs ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                            {testResult.success
                              ? (language === 'zh' ? '连接测试成功' : 'Connection test passed')
                              : (language === 'zh' ? `连接失败: ${testResult.error}` : `Failed: ${testResult.error}`)
                            }
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleSaveLlm}
                          disabled={saving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                          {saved ? (language === 'zh' ? '已保存' : 'Saved') : saving ? t('settings.saving') : t('settings.saveParams')}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleTestLlm(p.key)}
                          disabled={isTesting || (!isBuiltIn && !config.apiKey)}
                          className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white gap-2"
                        >
                          {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {isTesting ? (language === 'zh' ? '测试中...' : 'Testing...') : (language === 'zh' ? '测试连接' : 'Test Connection')}
                        </Button>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Sources */}
        <TabsContent value="data" className="space-y-6">
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('settings.dataSources')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Finnhub */}
              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white font-medium">{t('settings.finnhub')}</span>
                    <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[9px]">US/HK</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mb-2">Real-time quotes, news, financials</p>
                  <div className="flex items-center gap-2 max-w-xs">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKeys['finnhub'] ? 'text' : 'password'}
                        placeholder="API Token"
                        value={finnhubToken}
                        onChange={(e) => updateSetting('finnhubToken', e.target.value)}
                        className="bg-[#0a0a0f] border-[#1e1e2e] text-white text-xs h-8 pr-8"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApiKeys(prev => ({ ...prev, finnhub: !prev.finnhub }))}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-zinc-500 hover:text-white"
                      >
                        {showApiKeys['finnhub'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                  {/* Finnhub test result */}
                  {finnhubTestResult && (
                    <div className={`flex items-center gap-2 p-2 mt-2 rounded-lg max-w-xs ${
                      finnhubTestResult.success
                        ? 'bg-emerald-600/5 border border-emerald-600/10'
                        : 'bg-red-600/5 border border-red-600/10'
                    }`}>
                      {finnhubTestResult.success
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      }
                      <p className={`text-[11px] ${finnhubTestResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {finnhubTestResult.success
                          ? (language === 'zh' ? '连接测试成功' : 'Connection test passed')
                          : (language === 'zh' ? `连接失败: ${finnhubTestResult.error}` : `Failed: ${finnhubTestResult.error}`)
                        }
                      </p>
                    </div>
                  )}
                </div>
                <Switch checked={finnhubEnabled} onCheckedChange={(v) => updateSetting('finnhubEnabled', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />

              {/* CLS */}
              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white font-medium">{t('settings.cls')}</span>
                    <Badge className="bg-red-600/15 text-red-400 border-red-600/20 text-[9px]">A-Share</Badge>
                  </div>
                  <p className="text-xs text-zinc-500">Chinese financial news and market data</p>
                </div>
                <Switch checked={clsEnabled} onCheckedChange={(v) => updateSetting('clsEnabled', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />

              {/* Sina */}
              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white font-medium">{t('settings.sina')}</span>
                    <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[9px]">A-Share</Badge>
                  </div>
                  <p className="text-xs text-zinc-500">A-share real-time quotes and news</p>
                </div>
                <Switch checked={sinaEnabled} onCheckedChange={(v) => updateSetting('sinaEnabled', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>

              <Separator className="bg-[#1e1e2e]" />

              {/* 数据源状态面板 */}
              <DataSourceStatusPanel />

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveDataSources}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? (language === 'zh' ? '已保存' : 'Saved') : saving ? t('settings.saving') : t('settings.saveParams')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestFinnhub}
                  disabled={testingFinnhub || !finnhubToken}
                  className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white gap-2"
                >
                  {testingFinnhub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testingFinnhub ? (language === 'zh' ? '测试中...' : 'Testing...') : (language === 'zh' ? '测试 Finnhub' : 'Test Finnhub')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trading Parameters */}
        <TabsContent value="trading" className="space-y-6">
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('settings.tradingParams')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.defaultPositionSize')}</Label>
                  <Input type="number" value={positionSize} onChange={(e) => updateSetting('positionSize', e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.pctOfCapital')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.defaultStopLoss')}</Label>
                  <Input type="number" value={stopLoss} onChange={(e) => updateSetting('stopLoss', e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.maxLossAutoClose')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.defaultTakeProfit')}</Label>
                  <Input type="number" value={takeProfit} onChange={(e) => updateSetting('takeProfit', e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.targetProfitAutoClose')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.defaultCycleDays')}</Label>
                  <Input type="number" value={cycleDays} onChange={(e) => updateSetting('cycleDays', e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.maxHoldingPeriod')}</p>
                </div>
              </div>

              <Separator className="bg-[#1e1e2e]" />

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">{t('settings.riskLimits')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300 text-sm">{t('settings.maxPortfolioRisk')}</Label>
                    <Input type="number" value={maxPortfolioRisk} onChange={(e) => updateSetting('maxPortfolioRisk', e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300 text-sm">{t('settings.maxSinglePosition')}</Label>
                    <Input type="number" value={maxSinglePosition} onChange={(e) => updateSetting('maxSinglePosition', e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveGeneral} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? (language === 'zh' ? '已保存' : 'Saved') : saving ? t('settings.saving') : t('settings.saveParams')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setSettings(defaultSettings); setSaved(false); }}
                  className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
                >
                  {t('settings.resetDefaults')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          {/* 通知偏好 */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('settings.notifPrefs')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.signalAlerts')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.signalAlertsDesc')}</p>
                </div>
                <Switch checked={notifSignalAlerts} onCheckedChange={(v) => updateSetting('notifSignalAlerts', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.priceAlerts')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.priceAlertsDesc')}</p>
                </div>
                <Switch checked={notifPriceAlerts} onCheckedChange={(v) => updateSetting('notifPriceAlerts', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.positionUpdates')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.positionUpdatesDesc')}</p>
                </div>
                <Switch checked={notifPositionUpdates} onCheckedChange={(v) => updateSetting('notifPositionUpdates', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.dailyReport')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.dailyReportDesc')}</p>
                </div>
                <Switch checked={notifDailyReport} onCheckedChange={(v) => updateSetting('notifDailyReport', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.marketNews')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.marketNewsDesc')}</p>
                </div>
                <Switch checked={notifMarketNews} onCheckedChange={(v) => updateSetting('notifMarketNews', v)} className="data-[state=checked]:bg-emerald-600" />
              </div>

              {/* 路由映射说明 */}
              <div className="mt-4 p-3 bg-zinc-800/30 border border-[#1e1e2e] rounded-lg">
                <p className="text-xs text-zinc-400 font-medium mb-2">
                  {language === 'zh' ? '通知路由映射' : 'Notification Routing Map'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-blue-600/15 text-blue-400 border-blue-600/20 text-[9px] px-1 py-0">Signal</Badge>
                    <span className="text-zinc-500">→</span>
                    <span className="text-zinc-300">Webhook</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-green-600/15 text-green-400 border-green-600/20 text-[9px] px-1 py-0">Price</Badge>
                    <span className="text-zinc-500">→</span>
                    <span className="text-zinc-300">{language === 'zh' ? '企业微信' : 'WeCom'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-cyan-600/15 text-cyan-400 border-cyan-600/20 text-[9px] px-1 py-0">Position</Badge>
                    <span className="text-zinc-500">→</span>
                    <span className="text-zinc-300">{language === 'zh' ? '飞书' : 'Feishu'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-orange-600/15 text-orange-400 border-orange-600/20 text-[9px] px-1 py-0">Daily</Badge>
                    <span className="text-zinc-500">→</span>
                    <span className="text-zinc-300">Email</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-purple-600/15 text-purple-400 border-purple-600/20 text-[9px] px-1 py-0">News</Badge>
                    <span className="text-zinc-500">→</span>
                    <span className="text-zinc-300">Telegram</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                  {language === 'zh'
                    ? '静默时段(22:00-08:00)低优先级不发送 | 同类型5分钟冷却 | 内容去重'
                    : 'Silent hours (22:00-08:00) for low priority | 5min cooldown per type | Content dedup'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 渠道配置 */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-base font-semibold text-white">
                    {t('settings.channelConfigs')}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchChannels}
                  className="text-zinc-400 hover:text-white text-xs"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {language === 'zh' ? '刷新' : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {channelsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-lg bg-[#0a0a0f] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                  {channels.map((channel) => (
                    <div
                      key={channel.type}
                      className="p-4 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg space-y-3"
                    >
                      {/* 渠道头部 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">{channel.label}</span>
                          {channel.isEnabled && (
                            <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[9px]">
                              {language === 'zh' ? '已启用' : 'Active'}
                            </Badge>
                          )}
                          {testResults[channel.type] && (
                            <Badge className={`text-[9px] ${
                              testResults[channel.type].success
                                ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                                : 'bg-red-600/15 text-red-400 border-red-600/20'
                            } border`}>
                              {testResults[channel.type].success
                                ? (language === 'zh' ? '连通' : 'Connected')
                                : (language === 'zh' ? '失败' : 'Failed')}
                            </Badge>
                          )}
                        </div>
                        <Switch
                          checked={channel.isEnabled}
                          onCheckedChange={(v) => toggleChannelEnabled(channel.type, v)}
                          className="data-[state=checked]:bg-emerald-600"
                        />
                      </div>

                      {/* 配置字段 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {channel.configFields.map((field) => (
                          <div key={field.key} className="space-y-1">
                            <Label className="text-zinc-400 text-xs">{field.label}</Label>
                            <Input
                              type={field.type === 'password' ? 'password' : 'text'}
                              placeholder={field.label}
                              value={channelConfigEdits[channel.type]?.[field.key] || ''}
                              onChange={(e) => updateChannelConfigEdit(channel.type, field.key, e.target.value)}
                              className="bg-[#111118] border-[#1e1e2e] text-white text-xs h-8"
                            />
                          </div>
                        ))}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testChannel(channel.type)}
                          disabled={testingChannel === channel.type}
                          className="border-[#1e1e2e] bg-[#111118] text-zinc-300 hover:bg-[#1a1a2e] hover:text-white text-xs h-7 gap-1"
                        >
                          {testingChannel === channel.type ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          {language === 'zh' ? '测试连通' : 'Test'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveChannelConfig(channel.type)}
                          disabled={channelSaving === channel.type}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 gap-1"
                        >
                          {channelSaving === channel.type ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          {language === 'zh' ? '保存配置' : 'Save'}
                        </Button>
                      </div>

                      {/* 测试结果详情 */}
                      {testResults[channel.type] && !testResults[channel.type].success && testResults[channel.type].error && (
                        <div className="flex items-start gap-1.5 p-2 bg-red-600/5 border border-red-600/10 rounded text-[10px] text-red-400">
                          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          {testResults[channel.type].error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="space-y-6">
          {/* Language */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('settings.language')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-zinc-500">{t('settings.languageDesc')}</p>
              <div className="flex items-center gap-3">
                <Button
                  variant={language === 'en' ? 'default' : 'outline'}
                  onClick={() => setLanguage('en')}
                  className={language === 'en' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2' 
                    : 'border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-2'
                  }
                >
                  {t('settings.english')}
                </Button>
                <Button
                  variant={language === 'zh' ? 'default' : 'outline'}
                  onClick={() => setLanguage('zh' as Language)}
                  className={language === 'zh' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2' 
                    : 'border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-2'
                  }
                >
                  {t('settings.chinese')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('settings.about')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-zinc-400">{t('settings.version')}</span>
                <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">v2.0.0</Badge>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-zinc-400">{t('settings.framework')}</span>
                <span className="text-sm text-zinc-300">Next.js 16 + TypeScript</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-zinc-400">{t('settings.marketData')}</span>
                <span className="text-sm text-zinc-300">Finnhub + CLS + Sina</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-zinc-400">{t('settings.signalEngine')}</span>
                <span className="text-sm text-zinc-300">RSI + MACD + Bollinger + KDJ</span>
              </div>
              <Separator className="bg-[#1e1e2e] my-2" />
              <p className="text-xs text-zinc-500 leading-relaxed">{t('settings.aboutDesc')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
