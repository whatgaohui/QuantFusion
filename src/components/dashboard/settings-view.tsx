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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

export function SettingsView() {
  const { t, language, setLanguage } = useLanguage();
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // API Key
  const [apiKey, setApiKey] = useState('cv1**********************3k');
  
  // Trading Parameters
  const [positionSize, setPositionSize] = useState('10');
  const [stopLoss, setStopLoss] = useState('8');
  const [takeProfit, setTakeProfit] = useState('15');
  const [cycleDays, setCycleDays] = useState('7');
  
  // Notifications
  const [notifSignalAlerts, setNotifSignalAlerts] = useState(true);
  const [notifPriceAlerts, setNotifPriceAlerts] = useState(true);
  const [notifPositionUpdates, setNotifPositionUpdates] = useState(true);
  const [notifDailyReport, setNotifDailyReport] = useState(false);
  const [notifMarketNews, setNotifMarketNews] = useState(true);

  const handleSave = async () => {
    setSaving(true);
    // Simulate saving
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    toast.success(language === 'zh' ? '设置已保存' : 'Settings saved successfully');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* API Key Configuration */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">{t('settings.apiConfig')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">{t('settings.finnhubApiKey')}</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
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
            <p className="text-[10px] text-zinc-500">
              {t('settings.apiKeyHint')}{' '}
              <a
                href="https://finnhub.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
              >
                finnhub.io <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-emerald-600/5 border border-emerald-600/10 rounded-lg">
            <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-zinc-400">
              {t('settings.apiKeySecure')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trading Parameters */}
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
              <Input
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">{t('settings.pctOfCapital')}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('settings.defaultStopLoss')}</Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">{t('settings.maxLossAutoClose')}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('settings.defaultTakeProfit')}</Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">{t('settings.targetProfitAutoClose')}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('settings.defaultCycleDays')}</Label>
              <Input
                type="number"
                value={cycleDays}
                onChange={(e) => setCycleDays(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">{t('settings.maxHoldingPeriod')}</p>
            </div>
          </div>

          <Separator className="bg-[#1e1e2e]" />

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? t('settings.saving') : t('settings.saveParams')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPositionSize('10');
                setStopLoss('8');
                setTakeProfit('15');
                setCycleDays('7');
              }}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
            >
              {t('settings.resetDefaults')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
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
            <Switch
              checked={notifSignalAlerts}
              onCheckedChange={setNotifSignalAlerts}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
          <Separator className="bg-[#1e1e2e]" />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-white">{t('settings.priceAlerts')}</p>
              <p className="text-xs text-zinc-500">{t('settings.priceAlertsDesc')}</p>
            </div>
            <Switch
              checked={notifPriceAlerts}
              onCheckedChange={setNotifPriceAlerts}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
          <Separator className="bg-[#1e1e2e]" />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-white">{t('settings.positionUpdates')}</p>
              <p className="text-xs text-zinc-500">{t('settings.positionUpdatesDesc')}</p>
            </div>
            <Switch
              checked={notifPositionUpdates}
              onCheckedChange={setNotifPositionUpdates}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
          <Separator className="bg-[#1e1e2e]" />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-white">{t('settings.dailyReport')}</p>
              <p className="text-xs text-zinc-500">{t('settings.dailyReportDesc')}</p>
            </div>
            <Switch
              checked={notifDailyReport}
              onCheckedChange={setNotifDailyReport}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
          <Separator className="bg-[#1e1e2e]" />

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-white">{t('settings.marketNews')}</p>
              <p className="text-xs text-zinc-500">{t('settings.marketNewsDesc')}</p>
            </div>
            <Switch
              checked={notifMarketNews}
              onCheckedChange={setNotifMarketNews}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">{t('settings.language')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
              🇺🇸 {t('settings.english')}
            </Button>
            <Button
              variant={language === 'zh' ? 'default' : 'outline'}
              onClick={() => setLanguage('zh' as Language)}
              className={language === 'zh' 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2' 
                : 'border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-2'
              }
            >
              🇨🇳 {t('settings.chinese')}
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
            <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
              v1.0.0
            </Badge>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-400">{t('settings.framework')}</span>
            <span className="text-sm text-zinc-300">Next.js 16 + TypeScript</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-400">{t('settings.marketData')}</span>
            <span className="text-sm text-zinc-300">Finnhub API</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-400">{t('settings.signalEngine')}</span>
            <span className="text-sm text-zinc-300">RSI + MACD + Bollinger + KDJ</span>
          </div>
          <Separator className="bg-[#1e1e2e] my-2" />
          <p className="text-xs text-zinc-500 leading-relaxed">
            {t('settings.aboutDesc')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
