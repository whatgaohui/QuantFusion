'use client';

import { useState } from 'react';
import {
  Settings,
  Key,
  Shield,
  Bell,
  Info,
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  Globe,
  Cpu,
  Database,
  Rss,
  Sun,
  Moon,
  Clock,
  Server,
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

export function SettingsView() {
  const { t, language, setLanguage } = useLanguage();
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // LLM Config
  const [llmProvider, setLlmProvider] = useState('deepseek');
  const [llmModel, setLlmModel] = useState('deepseek-chat');
  const [llmApiKey, setLlmApiKey] = useState('sk-****************************3k');
  const [llmTemperature, setLlmTemperature] = useState('0.7');
  const [llmMaxTokens, setLlmMaxTokens] = useState('4096');

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

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    toast.success(language === 'zh' ? '设置已保存' : 'Settings saved successfully');
  };

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

        {/* LLM Configuration */}
        <TabsContent value="llm" className="space-y-6">
          <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-base font-semibold text-white">{t('settings.llmConfig')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.llmProvider')}</Label>
                  <Select value={llmProvider} onValueChange={setLlmProvider}>
                    <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                      <SelectItem value="deepseek" className="text-zinc-300">DeepSeek</SelectItem>
                      <SelectItem value="openai" className="text-zinc-300">OpenAI</SelectItem>
                      <SelectItem value="anthropic" className="text-zinc-300">Anthropic</SelectItem>
                      <SelectItem value="qwen" className="text-zinc-300">Qwen (通义千问)</SelectItem>
                      <SelectItem value="glm" className="text-zinc-300">GLM (智谱)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.llmModel')}</Label>
                  <Select value={llmModel} onValueChange={setLlmModel}>
                    <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                      <SelectItem value="deepseek-chat" className="text-zinc-300">deepseek-chat</SelectItem>
                      <SelectItem value="deepseek-reasoner" className="text-zinc-300">deepseek-reasoner</SelectItem>
                      <SelectItem value="gpt-4o" className="text-zinc-300">gpt-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini" className="text-zinc-300">gpt-4o-mini</SelectItem>
                      <SelectItem value="claude-3.5-sonnet" className="text-zinc-300">claude-3.5-sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm">{t('settings.llmApiKey')}</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={llmApiKey}
                      onChange={(e) => setLlmApiKey(e.target.value)}
                      className="bg-[#0a0a0f] border-[#1e1e2e] text-white pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-zinc-500 hover:text-white"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.llmTemperature')}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={llmTemperature}
                    onChange={(e) => setLlmTemperature(e.target.value)}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300 text-sm">{t('settings.llmMaxTokens')}</Label>
                  <Input
                    type="number"
                    value={llmMaxTokens}
                    onChange={(e) => setLlmMaxTokens(e.target.value)}
                    className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-lg">
                <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-zinc-400">{t('settings.apiKeySecure')}</p>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? t('settings.saving') : t('settings.saveParams')}
              </Button>
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
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? t('settings.saving') : t('settings.saveParams')}
              </Button>
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
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? t('settings.saving') : t('settings.saveParams')}
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

        {/* Notifications */}
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
