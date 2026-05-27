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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function SettingsView() {
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
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* API Key Configuration */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">API Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">Finnhub API Key</Label>
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
              Your API key is used to fetch market data. Get a free key at{' '}
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
              Your API key is stored securely and never shared. All requests are made server-side.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trading Parameters */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">Trading Parameters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Default Position Size (%)</Label>
              <Input
                type="number"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">Percentage of total capital per trade</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Default Stop Loss (%)</Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">Maximum loss before auto-close</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Default Take Profit (%)</Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">Target profit for auto-close</p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">Default Cycle Days</Label>
              <Input
                type="number"
                value={cycleDays}
                onChange={(e) => setCycleDays(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
              <p className="text-[10px] text-zinc-500">Maximum holding period per position</p>
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
              {saving ? 'Saving...' : 'Save Parameters'}
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
              Reset Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">Notification Preferences</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-white">Signal Alerts</p>
              <p className="text-xs text-zinc-500">Get notified when new trading signals are detected</p>
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
              <p className="text-sm text-white">Price Alerts</p>
              <p className="text-xs text-zinc-500">Notifications when watchlist stocks hit target prices</p>
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
              <p className="text-sm text-white">Position Updates</p>
              <p className="text-xs text-zinc-500">Updates on position open, close, and cycle expiration</p>
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
              <p className="text-sm text-white">Daily Report</p>
              <p className="text-xs text-zinc-500">End-of-day summary of portfolio performance</p>
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
              <p className="text-sm text-white">Market News</p>
              <p className="text-xs text-zinc-500">Breaking market news and significant events</p>
            </div>
            <Switch
              checked={notifMarketNews}
              onCheckedChange={setNotifMarketNews}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">About</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-400">Version</span>
            <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
              v1.0.0
            </Badge>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-400">Framework</span>
            <span className="text-sm text-zinc-300">Next.js 16 + TypeScript</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-400">Market Data</span>
            <span className="text-sm text-zinc-300">Finnhub API</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-400">Signal Engine</span>
            <span className="text-sm text-zinc-300">RSI + MACD + Bollinger + KDJ</span>
          </div>
          <Separator className="bg-[#1e1e2e] my-2" />
          <p className="text-xs text-zinc-500 leading-relaxed">
            QuantFlow is a quantitative trading dashboard designed for signal scanning, portfolio management, and market analysis. 
            This tool is for informational purposes only and does not constitute financial advice. 
            Always do your own research before making investment decisions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
