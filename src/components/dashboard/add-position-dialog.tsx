'use client';

import { useState, useMemo } from 'react';
import {
  PlusCircle,
  DollarSign,
  Target,
  ShieldAlert,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';

interface AddPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol?: string;
  price?: number;
  onPositionAdded?: () => void;
}

export function AddPositionDialog({
  open,
  onOpenChange,
  symbol: initialSymbol,
  price: initialPrice,
  onPositionAdded,
}: AddPositionDialogProps) {
  const { t } = useLanguage();
  const [symbol, setSymbol] = useState(initialSymbol || '');
  const [market, setMarket] = useState('US');
  const [side, setSide] = useState('long');
  const [entryPrice, setEntryPrice] = useState(initialPrice?.toString() || '');
  const [quantity, setQuantity] = useState('100');
  const [stopLossPct, setStopLossPct] = useState('8');
  const [takeProfitPct, setTakeProfitPct] = useState('15');
  const [cycleDays, setCycleDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when dialog opens with new props
  const resetForm = () => {
    setSymbol(initialSymbol || '');
    setMarket('US');
    setSide('long');
    setEntryPrice(initialPrice?.toString() || '');
    setQuantity('100');
    setStopLossPct('8');
    setTakeProfitPct('15');
    setCycleDays('7');
    setNotes('');
    setSubmitting(false);
  };

  // When dialog opens, update fields from props
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSymbol(initialSymbol || '');
      if (initialPrice) setEntryPrice(initialPrice.toString());
    }
    onOpenChange(newOpen);
  };

  // Computed values
  const entryPriceNum = parseFloat(entryPrice) || 0;
  const quantityNum = parseInt(quantity) || 0;
  const stopLossPctNum = parseFloat(stopLossPct) || 0;
  const takeProfitPctNum = parseFloat(takeProfitPct) || 0;

  const totalInvestment = useMemo(() => entryPriceNum * quantityNum, [entryPriceNum, quantityNum]);

  const stopLossPrice = useMemo(() => {
    if (side === 'long') {
      return entryPriceNum * (1 - stopLossPctNum / 100);
    }
    return entryPriceNum * (1 + stopLossPctNum / 100);
  }, [entryPriceNum, stopLossPctNum, side]);

  const takeProfitPrice = useMemo(() => {
    if (side === 'long') {
      return entryPriceNum * (1 + takeProfitPctNum / 100);
    }
    return entryPriceNum * (1 - takeProfitPctNum / 100);
  }, [entryPriceNum, takeProfitPctNum, side]);

  const riskRewardRatio = useMemo(() => {
    const riskDistance = Math.abs(entryPriceNum - stopLossPrice);
    const rewardDistance = Math.abs(takeProfitPrice - entryPriceNum);
    if (riskDistance === 0) return 0;
    return rewardDistance / riskDistance;
  }, [entryPriceNum, stopLossPrice, takeProfitPrice]);

  const handleSubmit = async () => {
    if (!symbol.trim() || entryPriceNum <= 0 || quantityNum <= 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/portfolio/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          market,
          side,
          avgCost: entryPriceNum,
          quantity: quantityNum,
          stopLoss: stopLossPrice,
          takeProfit: takeProfitPrice,
          notes: notes || undefined,
        }),
      });

      if (res.ok) {
        toast.success(t('pos.positionCreated'), {
          description: `${symbol.toUpperCase()} — ${quantityNum} shares @ $${entryPriceNum.toFixed(2)}`,
        });
        onOpenChange(false);
        resetForm();
        onPositionAdded?.();
      } else {
        const data = await res.json();
        toast.error(t('pos.positionFailed'), {
          description: data.error || 'Unknown error',
        });
      }
    } catch {
      toast.error(t('pos.positionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = symbol.trim() && entryPriceNum > 0 && quantityNum > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111118] border-[#1e1e2e] max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
            {t('pos.addPosition')}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {t('pos.addPosition')} — {symbol || '...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Symbol + Market row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">{t('watch.symbol')}</Label>
              <Input
                placeholder="e.g., AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">{t('pos.market')}</Label>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  <SelectItem value="US" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">US</SelectItem>
                  <SelectItem value="HK" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">HK</SelectItem>
                  <SelectItem value="A" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">A-Share</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Side selector */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-xs">{t('pos.side')}</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setSide('long')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  side === 'long'
                    ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/30'
                    : 'bg-[#0a0a0f] text-zinc-500 border-[#1e1e2e] hover:border-[#2e2e3e]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {t('common.buy')}
              </button>
              <button
                onClick={() => setSide('short')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  side === 'short'
                    ? 'bg-red-600/15 text-red-400 border-red-600/30'
                    : 'bg-[#0a0a0f] text-zinc-500 border-[#1e1e2e] hover:border-[#2e2e3e]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {t('common.sell')}
              </button>
            </div>
          </div>

          {/* Entry Price + Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">{t('pos.entryPrice')}</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">{t('pos.quantity')}</Label>
              <Input
                type="number"
                step="1"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm"
              />
            </div>
          </div>

          {/* Stop Loss % + Take Profit % */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">{t('pos.stopLossPct')}</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="8"
                value={stopLossPct}
                onChange={(e) => setStopLossPct(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">{t('pos.takeProfitPct')}</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="15"
                value={takeProfitPct}
                onChange={(e) => setTakeProfitPct(e.target.value)}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm"
              />
            </div>
          </div>

          {/* Cycle Days */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-xs">{t('pos.cycleDays')}</Label>
            <Input
              type="number"
              step="1"
              placeholder="7"
              value={cycleDays}
              onChange={(e) => setCycleDays(e.target.value)}
              className="bg-[#0a0a0f] border-[#1e1e2e] text-white h-9 text-sm max-w-[120px]"
            />
          </div>

          {/* Computed Values Card */}
          {entryPriceNum > 0 && quantityNum > 0 && (
            <>
              <Separator className="bg-[#1e1e2e]" />
              <div className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{t('pos.totalInvestment')}</span>
                  <span className="text-sm font-medium text-white">${totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{t('pos.stopLossPrice')}</span>
                  <span className="text-sm font-medium text-red-400">${stopLossPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{t('pos.takeProfitPrice')}</span>
                  <span className="text-sm font-medium text-emerald-400">${takeProfitPrice.toFixed(2)}</span>
                </div>
                <Separator className="bg-[#1e1e2e]" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{t('pos.riskRewardRatio')}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[10px] px-1.5 py-0 ${
                      riskRewardRatio >= 2 ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                      riskRewardRatio >= 1 ? 'bg-yellow-600/15 text-yellow-400 border-yellow-600/20' :
                      'bg-red-600/15 text-red-400 border-red-600/20'
                    }`}>
                      {riskRewardRatio.toFixed(2)}:1
                    </Badge>
                    {riskRewardRatio >= 2 && (
                      <Target className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-xs">{t('pos.notes')}</Label>
            <Textarea
              placeholder={t('pos.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-[#0a0a0f] border-[#1e1e2e] text-white text-sm min-h-[60px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300"
          >
            {t('pos.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[120px]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('pos.creating')}
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                {t('pos.createPosition')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
