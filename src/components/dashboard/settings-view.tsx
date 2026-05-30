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
  Server,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

// ==================== Provider Definitions ====================
interface ProviderDefaults {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const PROVIDERS: Record<string, ProviderDefaults & { label: string; labelKey: string; isFree?: boolean }> = {
  zai: { label: 'ZAI', labelKey: 'settings.llmProviderZai', baseUrl: '', model: 'z-ai-general', temperature: 0.7, maxTokens: 4096, isFree: true },
  deepseek: { label: 'DeepSeek', labelKey: 'settings.llmProviderDeepseek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096 },
  openai: { label: 'OpenAI', labelKey: 'settings.llmProviderOpenai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 4096 },
  anthropic: { label: 'Anthropic', labelKey: 'settings.llmProviderAnthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-3.5-sonnet', temperature: 0.7, maxTokens: 4096 },
  qwen: { label: '通义千问', labelKey: 'settings.llmProviderQwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', temperature: 0.7, maxTokens: 4096 },
  glm: { label: '智谱AI', labelKey: 'settings.llmProviderGlm', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', temperature: 0.7, maxTokens: 4096 },
  custom: { label: '自定义', labelKey: 'settings.llmProviderCustom', baseUrl: '', model: '', temperature: 0.7, maxTokens: 4096 },
};

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'disconnected';

// ==================== Main Component ====================
export function SettingsView() {
  const { t, language, setLanguage } = useLanguage();
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // LLM Config state
  const [activeProvider, setActiveProvider] = useState('zai');
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfig>>(() => {
    const initial: Record<string, ProviderConfig> = {};
    for (const [key, defaults] of Object.entries(PROVIDERS)) {
      initial[key] = {
        apiKey: '',
        baseUrl: defaults.baseUrl,
        model: defaults.model,
        temperature: defaults.temperature,
        maxTokens: defaults.maxTokens,
        enabled: key === 'zai',
      };
    }
    return initial;
  });
  const [connStatus, setConnStatus] = useState<Record<string, ConnectionStatus>>({});
  const [connMessage, setConnMessage] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [configLoading, setConfigLoading] = useState(true);

  // Data Sources
  const [finnhubEnabled, setFinnhubEnabled] = useState(true);
  const [finnhubToken, setFinnhubToken] = useState('cv1**********************3k');
  const [clsEnabled, setClsEnabled] = useState(true);
  const [sinaEnabled, setSinaEnabled] = useState(true);

  // Trading Parameters
  const [positionSize, setPositionSize] = useState('10');
  const [stopLoss, setStopLoss] = useState('8');
  const [takeProfit, setTakeProfit] = useState('15');
  const [cycleDays, setCycleDays] = useState('7');
  const [maxPortfolioRisk, setMaxPortfolioRisk] = useState('25');
  const [maxSinglePosition, setMaxSinglePosition] = useState('15');

  // Notifications
  const [notifSignalAlerts, setNotifSignalAlerts] = useState(true);
  const [notifPriceAlerts, setNotifPriceAlerts] = useState(true);
  const [notifPositionUpdates, setNotifPositionUpdates] = useState(true);
  const [notifDailyReport, setNotifDailyReport] = useState(false);
  const [notifMarketNews, setNotifMarketNews] = useState(true);

  // Load LLM configs on mount
  useEffect(() => {
    async function loadConfigs() {
      try {
        const res = await fetch('/api/settings/llm');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setProviderConfigs(prev => {
              const updated = { ...prev };
              for (const [provider, config] of Object.entries(data.data as Record<string, Record<string, string>>)) {
                if (updated[provider]) {
                  updated[provider] = {
                    apiKey: config.apiKey || '',
                    baseUrl: config.baseUrl || updated[provider].baseUrl,
                    model: config.model || updated[provider].model,
                    temperature: parseFloat(config.temperature) || updated[provider].temperature,
                    maxTokens: parseInt(config.maxTokens) || updated[provider].maxTokens,
                    enabled: config.enabled === 'true',
                  };
                }
              }
              return updated;
            });
          }
        }
      } catch {
        // Use defaults on error
      } finally {
        setConfigLoading(false);
      }
    }
    loadConfigs();
  }, []);

  const updateProviderConfig = useCallback((provider: string, field: keyof ProviderConfig, value: string | number | boolean) => {
    setProviderConfigs(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  }, []);

  const handleSaveConfig = async (provider: string) => {
    setSaving(prev => ({ ...prev, [provider]: true }));
    try {
      const config = providerConfigs[provider];

      // When enabling this provider, disable all others
      if (config.enabled) {
        // Disable all other providers in the UI state
        setProviderConfigs(prev => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            if (key !== provider) {
              updated[key] = { ...updated[key], enabled: false };
            }
          }
          return updated;
        });

        // Disable all other providers in the backend
        for (const otherProvider of Object.keys(PROVIDERS)) {
          if (otherProvider !== provider) {
            await fetch('/api/settings/llm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ provider: otherProvider, enabled: false }),
            });
          }
        }
      }

      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          enabled: config.enabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('settings.llmConfigSaved'));
      } else {
        toast.error(data.error || t('settings.llmConfigSaveFailed'));
      }
    } catch {
      toast.error(t('settings.llmConfigSaveFailed'));
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleTestConnection = async (provider: string) => {
    setConnStatus(prev => ({ ...prev, [provider]: 'testing' }));
    setConnMessage(prev => ({ ...prev, [provider]: '' }));
    try {
      const config = providerConfigs[provider];
      const res = await fetch('/api/settings/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnStatus(prev => ({ ...prev, [provider]: 'connected' }));
        setConnMessage(prev => ({ ...prev, [provider]: data.message }));
        toast.success(t('settings.llmConnSuccess'));
      } else {
        setConnStatus(prev => ({ ...prev, [provider]: 'disconnected' }));
        setConnMessage(prev => ({ ...prev, [provider]: data.message }));
        toast.error(t('settings.llmConnFailed'));
      }
    } catch {
      setConnStatus(prev => ({ ...prev, [provider]: 'disconnected' }));
      setConnMessage(prev => ({ ...prev, [provider]: '网络错误' }));
      toast.error(t('settings.llmConnFailed'));
    }
  };

  const handleSave = async () => {
    setSaving(prev => ({ ...prev, _general: true }));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(prev => ({ ...prev, _general: false }));
    toast.success(language === 'zh' ? '设置已保存' : 'Settings saved successfully');
  };

  const currentConfig = providerConfigs[activeProvider];
  const currentStatus = connStatus[activeProvider] || 'idle';
  const currentMessage = connMessage[activeProvider] || '';
  const currentSaving = saving[activeProvider] || false;

  return (
    <div className="space-y-6 max-w-3xl">
      <Tabs defaultValue="llm" className="space-y-6">
        <TabsList className="bg-[#111118] border border-[#1e1e2e]">
          <TabsTrigger value="llm" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Cpu className="w-3.5 h-3.5 mr-1.5" />
            大模型
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Database className="w-3.5 h-3.5 mr-1.5" />
            数据
          </TabsTrigger>
          <TabsTrigger value="trading" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            交易
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Bell className="w-3.5 h-3.5 mr-1.5" />
            提醒
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
            <Server className="w-3.5 h-3.5 mr-1.5" />
            系统
          </TabsTrigger>
        </TabsList>

        {/* ============ LLM Configuration ============ */}
        <TabsContent value="llm" className="space-y-4">
          {configLoading ? (
            <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mr-2" />
                <span className="text-zinc-400 text-sm">{t('settings.llmLoading')}</span>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Provider Tab Bar */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                {Object.entries(PROVIDERS).map(([key, provider]) => (
                  <button
                    key={key}
                    onClick={() => setActiveProvider(key)}
                    className={`
                      flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                      ${activeProvider === key
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                        : 'bg-[#111118] text-zinc-400 border border-[#1e1e2e] hover:bg-[#1a1a2e] hover:text-zinc-300'
                      }
                    `}
                  >
                    {provider.isFree && (
                      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-[9px] px-1 py-0 mr-0.5">
                        {t('settings.llmFreeBadge')}
                      </Badge>
                    )}
                    {t(provider.labelKey)}
                  </button>
                ))}
              </div>

              {/* ZAI — Built-in Free Model */}
              {activeProvider === 'zai' && (
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-emerald-400" />
                      <CardTitle className="text-base font-semibold text-white">{t('settings.llmZaiTitle')}</CardTitle>
                      <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">✅ {t('settings.llmFreeBadge')}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Free model info */}
                    <div className="p-4 bg-emerald-600/5 border border-emerald-600/10 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-white font-medium">{t('settings.llmZaiDesc')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {t('settings.llmZaiModel')}</span>
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {t('settings.llmNoApiKey')}</span>
                      </div>
                    </div>

                    {/* Model info fields (read-only) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-zinc-300 text-sm">{t('settings.llmModelName')}</Label>
                        <Input
                          value={currentConfig.model}
                          readOnly
                          className="bg-[#0a0a0f] border-[#1e1e2e] text-zinc-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300 text-sm">{t('settings.llmTemperature')}</Label>
                        <div className="flex items-center gap-3">
                          <Slider
                            value={[currentConfig.temperature]}
                            min={0}
                            max={2}
                            step={0.1}
                            onValueChange={([v]) => updateProviderConfig('zai', 'temperature', v)}
                            className="flex-1"
                          />
                          <span className="text-xs text-zinc-400 w-8 text-right">{currentConfig.temperature.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-zinc-300 text-sm">{t('settings.llmMaxTokens')}</Label>
                        <Input
                          type="number"
                          value={currentConfig.maxTokens}
                          onChange={(e) => updateProviderConfig('zai', 'maxTokens', parseInt(e.target.value) || 4096)}
                          className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300 text-sm">{t('settings.llmConnStatus')}</Label>
                        <div className="flex items-center gap-2">
                          {currentStatus === 'connected' ? (
                            <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20">
                              <Wifi className="w-3 h-3 mr-1" /> {t('settings.llmConnected')}
                            </Badge>
                          ) : currentStatus === 'disconnected' ? (
                            <Badge className="bg-red-600/15 text-red-400 border-red-600/20">
                              <WifiOff className="w-3 h-3 mr-1" /> {t('settings.llmDisconnected')}
                            </Badge>
                          ) : (
                            <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20">
                              <WifiOff className="w-3 h-3 mr-1" /> {t('settings.llmDisconnected')}
                            </Badge>
                          )}
                          {currentMessage && (
                            <span className="text-[10px] text-zinc-500 truncate max-w-[150px]">{currentMessage}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleTestConnection('zai')}
                        disabled={currentStatus === 'testing'}
                        variant="outline"
                        className="border-emerald-600/30 bg-emerald-600/5 text-emerald-400 hover:bg-emerald-600/10 gap-2"
                      >
                        {currentStatus === 'testing' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wifi className="w-4 h-4" />
                        )}
                        {currentStatus === 'testing' ? t('settings.llmTesting') : t('settings.llmTestConn')}
                      </Button>
                      <Button
                        onClick={() => handleSaveConfig('zai')}
                        disabled={currentSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {currentSaving ? t('settings.saving') : t('settings.llmSaveConfig')}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-lg">
                      <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-xs text-zinc-400">{t('settings.apiKeySecure')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Other Provider Config Cards */}
              {activeProvider !== 'zai' && activeProvider !== 'custom' && (
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-emerald-400" />
                      <CardTitle className="text-base font-semibold text-white">
                        {t(PROVIDERS[activeProvider].labelKey)} {t('settings.llmConfig')}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* API Key */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmApiKey')}</Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showApiKey[activeProvider] ? 'text' : 'password'}
                            value={currentConfig.apiKey}
                            onChange={(e) => updateProviderConfig(activeProvider, 'apiKey', e.target.value)}
                            placeholder={t('settings.llmApiKeyPlaceholder')}
                            className="bg-[#0a0a0f] border-[#1e1e2e] text-white pr-10"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowApiKey(prev => ({ ...prev, [activeProvider]: !prev[activeProvider] }))}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-zinc-500 hover:text-white"
                          >
                            {showApiKey[activeProvider] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Base URL */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmBaseUrl')}</Label>
                      <Input
                        type="text"
                        value={currentConfig.baseUrl}
                        onChange={(e) => updateProviderConfig(activeProvider, 'baseUrl', e.target.value)}
                        placeholder={t('settings.llmBaseUrlPlaceholder')}
                        className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                      />
                    </div>

                    {/* Model Name */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmModelName')}</Label>
                      <Input
                        type="text"
                        value={currentConfig.model}
                        onChange={(e) => updateProviderConfig(activeProvider, 'model', e.target.value)}
                        placeholder={t('settings.llmModelPlaceholder')}
                        className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                      />
                    </div>

                    {/* Temperature */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmTemperature')}</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[currentConfig.temperature]}
                          min={0}
                          max={2}
                          step={0.1}
                          onValueChange={([v]) => updateProviderConfig(activeProvider, 'temperature', v)}
                          className="flex-1"
                        />
                        <span className="text-xs text-zinc-400 w-8 text-right">{currentConfig.temperature.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmMaxTokens')}</Label>
                      <Input
                        type="number"
                        value={currentConfig.maxTokens}
                        onChange={(e) => updateProviderConfig(activeProvider, 'maxTokens', parseInt(e.target.value) || 4096)}
                        className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                      />
                    </div>

                    {/* Connection Status */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmConnStatus')}</Label>
                      <div className="flex items-center gap-2">
                        {currentStatus === 'connected' ? (
                          <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20">
                            <Wifi className="w-3 h-3 mr-1" /> {t('settings.llmConnected')}
                          </Badge>
                        ) : currentStatus === 'disconnected' ? (
                          <Badge className="bg-red-600/15 text-red-400 border-red-600/20">
                            <WifiOff className="w-3 h-3 mr-1" /> {t('settings.llmDisconnected')}
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20">
                            <WifiOff className="w-3 h-3 mr-1" /> {t('settings.llmDisconnected')}
                          </Badge>
                        )}
                        {currentMessage && (
                          <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">{currentMessage}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleTestConnection(activeProvider)}
                        disabled={currentStatus === 'testing'}
                        variant="outline"
                        className="border-emerald-600/30 bg-emerald-600/5 text-emerald-400 hover:bg-emerald-600/10 gap-2"
                      >
                        {currentStatus === 'testing' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wifi className="w-4 h-4" />
                        )}
                        {currentStatus === 'testing' ? t('settings.llmTesting') : t('settings.llmTestConn')}
                      </Button>
                      <Button
                        onClick={() => handleSaveConfig(activeProvider)}
                        disabled={currentSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {currentSaving ? t('settings.saving') : t('settings.llmSaveConfig')}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-lg">
                      <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-xs text-zinc-400">{t('settings.apiKeySecure')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Provider Config Card */}
              {activeProvider === 'custom' && (
                <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-emerald-400" />
                      <CardTitle className="text-base font-semibold text-white">
                        {t('settings.llmProviderCustom')} {t('settings.llmConfig')}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* API Key */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmApiKey')}</Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showApiKey[activeProvider] ? 'text' : 'password'}
                            value={currentConfig.apiKey}
                            onChange={(e) => updateProviderConfig(activeProvider, 'apiKey', e.target.value)}
                            placeholder={t('settings.llmApiKeyPlaceholder')}
                            className="bg-[#0a0a0f] border-[#1e1e2e] text-white pr-10"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowApiKey(prev => ({ ...prev, [activeProvider]: !prev[activeProvider] }))}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-zinc-500 hover:text-white"
                          >
                            {showApiKey[activeProvider] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Base URL */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmBaseUrl')}</Label>
                      <Input
                        type="text"
                        value={currentConfig.baseUrl}
                        onChange={(e) => updateProviderConfig(activeProvider, 'baseUrl', e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                      />
                    </div>

                    {/* Model Name */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmModelName')}</Label>
                      <Input
                        type="text"
                        value={currentConfig.model}
                        onChange={(e) => updateProviderConfig(activeProvider, 'model', e.target.value)}
                        placeholder={t('settings.llmModelPlaceholder')}
                        className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                      />
                    </div>

                    {/* Temperature */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmTemperature')}</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[currentConfig.temperature]}
                          min={0}
                          max={2}
                          step={0.1}
                          onValueChange={([v]) => updateProviderConfig(activeProvider, 'temperature', v)}
                          className="flex-1"
                        />
                        <span className="text-xs text-zinc-400 w-8 text-right">{currentConfig.temperature.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmMaxTokens')}</Label>
                      <Input
                        type="number"
                        value={currentConfig.maxTokens}
                        onChange={(e) => updateProviderConfig(activeProvider, 'maxTokens', parseInt(e.target.value) || 4096)}
                        className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                      />
                    </div>

                    {/* Connection Status */}
                    <div className="space-y-2">
                      <Label className="text-zinc-300 text-sm">{t('settings.llmConnStatus')}</Label>
                      <div className="flex items-center gap-2">
                        {currentStatus === 'connected' ? (
                          <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20">
                            <Wifi className="w-3 h-3 mr-1" /> {t('settings.llmConnected')}
                          </Badge>
                        ) : currentStatus === 'disconnected' ? (
                          <Badge className="bg-red-600/15 text-red-400 border-red-600/20">
                            <WifiOff className="w-3 h-3 mr-1" /> {t('settings.llmDisconnected')}
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-600/15 text-zinc-400 border-zinc-600/20">
                            <WifiOff className="w-3 h-3 mr-1" /> {t('settings.llmDisconnected')}
                          </Badge>
                        )}
                        {currentMessage && (
                          <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">{currentMessage}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleTestConnection(activeProvider)}
                        disabled={currentStatus === 'testing'}
                        variant="outline"
                        className="border-emerald-600/30 bg-emerald-600/5 text-emerald-400 hover:bg-emerald-600/10 gap-2"
                      >
                        {currentStatus === 'testing' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wifi className="w-4 h-4" />
                        )}
                        {currentStatus === 'testing' ? t('settings.llmTesting') : t('settings.llmTestConn')}
                      </Button>
                      <Button
                        onClick={() => handleSaveConfig(activeProvider)}
                        disabled={currentSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {currentSaving ? t('settings.saving') : t('settings.llmSaveConfig')}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-lg">
                      <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-xs text-zinc-400">{t('settings.apiKeySecure')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ============ Data Sources ============ */}
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
                  <p className="text-xs text-zinc-500 mb-2">实时行情、新闻、财报</p>
                  <div className="flex items-center gap-2 max-w-xs">
                    <Input
                      type="password"
                      placeholder="API 令牌"
                      value={finnhubToken}
                      onChange={(e) => setFinnhubToken(e.target.value)}
                      className="bg-[#0a0a0f] border-[#1e1e2e] text-white text-xs h-8"
                    />
                  </div>
                </div>
                <Switch checked={finnhubEnabled} onCheckedChange={setFinnhubEnabled} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />

              {/* CLS */}
              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white font-medium">{t('settings.cls')}</span>
                    <Badge className="bg-red-600/15 text-red-400 border-red-600/20 text-[9px]">A-Share</Badge>
                  </div>
                  <p className="text-xs text-zinc-500">中国财经新闻和市场数据</p>
                </div>
                <Switch checked={clsEnabled} onCheckedChange={setClsEnabled} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />

              {/* Sina */}
              <div className="flex items-start justify-between py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white font-medium">{t('settings.sina')}</span>
                    <Badge className="bg-yellow-600/15 text-yellow-400 border-yellow-600/20 text-[9px]">A-Share</Badge>
                  </div>
                  <p className="text-xs text-zinc-500">A股实时行情和新闻</p>
                </div>
                <Switch checked={sinaEnabled} onCheckedChange={setSinaEnabled} className="data-[state=checked]:bg-emerald-600" />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving._general}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Save className="w-4 h-4" />
                {saving._general ? t('settings.saving') : t('settings.saveParams')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Trading Parameters ============ */}
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
                  <Input type="number" value={positionSize} onChange={(e) => setPositionSize(e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.pctOfCapital')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.defaultStopLoss')}</Label>
                  <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.maxLossAutoClose')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.defaultTakeProfit')}</Label>
                  <Input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.targetProfitAutoClose')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.defaultCycleDays')}</Label>
                  <Input type="number" value={cycleDays} onChange={(e) => setCycleDays(e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  <p className="text-[10px] text-zinc-500">{t('settings.maxHoldingPeriod')}</p>
                </div>
              </div>

              <Separator className="bg-[#1e1e2e]" />

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">{t('settings.riskLimits')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300 text-sm">{t('settings.maxPortfolioRisk')}</Label>
                    <Input type="number" value={maxPortfolioRisk} onChange={(e) => setMaxPortfolioRisk(e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300 text-sm">{t('settings.maxSinglePosition')}</Label>
                    <Input type="number" value={maxSinglePosition} onChange={(e) => setMaxSinglePosition(e.target.value)} className="bg-[#0a0a0f] border-[#1e1e2e] text-white" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving._general} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Save className="w-4 h-4" />
                  {saving._general ? t('settings.saving') : t('settings.saveParams')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setPositionSize('10'); setStopLoss('8'); setTakeProfit('15'); setCycleDays('7'); }}
                  className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
                >
                  {t('settings.resetDefaults')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Notifications ============ */}
        <TabsContent value="notifications" className="space-y-6">
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
                <Switch checked={notifSignalAlerts} onCheckedChange={setNotifSignalAlerts} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.priceAlerts')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.priceAlertsDesc')}</p>
                </div>
                <Switch checked={notifPriceAlerts} onCheckedChange={setNotifPriceAlerts} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.positionUpdates')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.positionUpdatesDesc')}</p>
                </div>
                <Switch checked={notifPositionUpdates} onCheckedChange={setNotifPositionUpdates} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.dailyReport')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.dailyReportDesc')}</p>
                </div>
                <Switch checked={notifDailyReport} onCheckedChange={setNotifDailyReport} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <Separator className="bg-[#1e1e2e]" />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-white">{t('settings.marketNews')}</p>
                  <p className="text-xs text-zinc-500">{t('settings.marketNewsDesc')}</p>
                </div>
                <Switch checked={notifMarketNews} onCheckedChange={setNotifMarketNews} className="data-[state=checked]:bg-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ System ============ */}
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
