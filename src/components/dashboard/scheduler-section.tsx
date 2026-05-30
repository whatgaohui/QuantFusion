'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  Pause,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Zap,
  Calendar,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

interface ScheduledJob {
  id: string;
  name: string;
  cronExpr: string;
  jobType: string;
  config: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
}

interface SchedulerInfo {
  status: string;
  lastCheckAt: string | null;
  totalJobsExecuted: number;
  totalErrors: number;
  currentlyRunning: string[];
}

interface CalendarInfo {
  date: string;
  market: string;
  marketName: string;
  isTradingDay: boolean;
  marketPhase: string;
  marketPhaseName: string;
  nextTradingDay: string | null;
  holidayName?: string;
}

const JOB_TYPE_MAP: Record<string, string> = {
  analysis: 'sched.typeAnalysis',
  market_scan: 'sched.typeMarketScan',
  news_fetch: 'sched.typeNewsFetch',
  notification: 'sched.typeNotification',
  data_sync: 'sched.typeDataSync',
};

/**
 * 调度器和交易日历区域 - 嵌入到设置页面的 Scheduler tab 中
 */
export function SchedulerSection() {
  const { t, language } = useLanguage();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // 新建任务表单
  const [newName, setNewName] = useState('');
  const [newCron, setNewCron] = useState('0 9 * * 1-5');
  const [newType, setNewType] = useState('market_scan');
  const [newConfig, setNewConfig] = useState('');

  // 交易日历数据
  const [calendarData, setCalendarData] = useState<CalendarInfo[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  // 加载调度任务
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/fusion/scheduler/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setScheduler(data.scheduler || null);
      }
    } catch {
      // 忽略
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载交易日历
  const fetchCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch('/api/fusion/market/trading-calendar?action=multi_market');
      if (res.ok) {
        const data = await res.json();
        setCalendarData(data.markets || []);
      }
    } catch {
      // 忽略
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchCalendar();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs, fetchCalendar]);

  // 创建任务
  const handleCreate = async () => {
    if (!newName || !newCron || !newType) {
      toast.error(language === 'zh' ? '请填写必填字段' : 'Please fill required fields');
      return;
    }
    try {
      const res = await fetch('/api/fusion/scheduler/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          cronExpr: newCron,
          jobType: newType,
          config: newConfig || null,
          isActive: true,
        }),
      });
      if (res.ok) {
        toast.success(language === 'zh' ? '任务创建成功' : 'Task created');
        setCreateOpen(false);
        setNewName('');
        setNewCron('0 9 * * 1-5');
        setNewType('market_scan');
        setNewConfig('');
        fetchJobs();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed');
      }
    } catch {
      toast.error(language === 'zh' ? '创建失败' : 'Create failed');
    }
  };

  // 切换启用状态
  const toggleJob = async (job: ScheduledJob) => {
    try {
      const res = await fetch(`/api/fusion/scheduler/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !job.isActive }),
      });
      if (res.ok) {
        toast.success(job.isActive ? t('sched.disable') + ' ✓' : t('sched.enable') + ' ✓');
        fetchJobs();
      }
    } catch {
      toast.error(language === 'zh' ? '操作失败' : 'Operation failed');
    }
  };

  // 手动触发
  const triggerJob = async (id: string) => {
    setTriggeringId(id);
    try {
      const res = await fetch(`/api/fusion/scheduler/jobs/${id}/trigger`, { method: 'POST' });
      if (res.ok) {
        toast.success(t('sched.triggered'));
        fetchJobs();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Trigger failed');
      }
    } catch {
      toast.error(language === 'zh' ? '触发失败' : 'Trigger failed');
    } finally {
      setTriggeringId(null);
    }
  };

  // 删除任务
  const deleteJob = async (id: string) => {
    try {
      const res = await fetch(`/api/fusion/scheduler/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(language === 'zh' ? '任务已删除' : 'Task deleted');
        setDeleteId(null);
        fetchJobs();
      }
    } catch {
      toast.error(language === 'zh' ? '删除失败' : 'Delete failed');
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return t('sched.neverRun');
    try {
      return new Date(dateStr).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* 调度器状态 */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-base font-semibold text-white">{t('sched.title')}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchJobs}
              className="text-zinc-400 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scheduler && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('sched.status')}</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${scheduler.status === 'running' ? 'bg-emerald-400 animate-pulse' : scheduler.status === 'paused' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  <span className={`text-sm font-medium ${scheduler.status === 'running' ? 'text-emerald-400' : scheduler.status === 'paused' ? 'text-yellow-400' : 'text-red-400'}`}>
                    {scheduler.status === 'running' ? t('sched.running') : scheduler.status === 'paused' ? t('sched.paused') : t('sched.stopped')}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('sched.totalExecuted')}</p>
                <p className="text-sm font-semibold text-white">{scheduler.totalJobsExecuted}</p>
              </div>
              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('sched.totalErrors')}</p>
                <p className={`text-sm font-semibold ${scheduler.totalErrors > 0 ? 'text-red-400' : 'text-white'}`}>{scheduler.totalErrors}</p>
              </div>
              <div className="p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('sched.lastCheck')}</p>
                <p className="text-xs text-zinc-300">{formatTime(scheduler.lastCheckAt)}</p>
              </div>
            </div>
          )}

          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {t('sched.createJob')}
          </Button>

          {/* 任务列表 */}
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-sm">{t('sched.noJobs')}</div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    job.isActive
                      ? 'bg-[#0a0a0f] border-[#1e1e2e]'
                      : 'bg-[#0a0a0f]/50 border-[#1e1e2e]/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">{job.name}</span>
                        <Badge className={`text-[9px] ${
                          job.jobType === 'analysis' ? 'bg-purple-600/15 text-purple-400 border-purple-600/20' :
                          job.jobType === 'market_scan' ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20' :
                          job.jobType === 'news_fetch' ? 'bg-cyan-600/15 text-cyan-400 border-cyan-600/20' :
                          job.jobType === 'notification' ? 'bg-amber-600/15 text-amber-400 border-amber-600/20' :
                          'bg-zinc-600/15 text-zinc-400 border-zinc-600/20'
                        }`}>
                          {t(JOB_TYPE_MAP[job.jobType] || job.jobType)}
                        </Badge>
                        {job.isActive && (
                          <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[9px]">
                            {t('sched.isActive')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                        <span className="font-mono">{job.cronExpr}</span>
                        <span>{t('sched.lastRun')}: <span className={job.lastStatus === 'success' ? 'text-emerald-400' : job.lastStatus === 'failed' ? 'text-red-400' : 'text-zinc-500'}>{formatTime(job.lastRunAt)}</span></span>
                        <span>{t('sched.nextRun')}: {formatTime(job.nextRunAt)}</span>
                      </div>
                      {job.lastError && (
                        <p className="text-[10px] text-red-400 mt-1 truncate">{job.lastError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => triggerJob(job.id)}
                        disabled={triggeringId === job.id}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-emerald-400"
                        title={t('sched.trigger')}
                      >
                        {triggeringId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      </Button>
                      <Switch
                        checked={job.isActive}
                        onCheckedChange={() => toggleJob(job)}
                        className="data-[state=checked]:bg-emerald-600 scale-75"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(job.id)}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                        title={t('sched.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 交易日历 */}
      <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-semibold text-white">{t('cal.title')}</CardTitle>
            <span className="text-xs text-zinc-500">
              {new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {calendarLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {calendarData.map((cal) => (
                <div key={cal.market} className="p-4 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">{cal.marketName}</span>
                    <Badge className={`text-[9px] ${
                      cal.isTradingDay
                        ? 'bg-emerald-600/15 text-emerald-400 border-emerald-600/20'
                        : 'bg-red-600/15 text-red-400 border-red-600/20'
                    }`}>
                      {cal.isTradingDay ? t('cal.tradingDay') : t('cal.notTradingDay')}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{t('cal.marketPhase')}</span>
                      <span className="text-zinc-300">{cal.marketPhaseName}</span>
                    </div>
                    {cal.nextTradingDay && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{t('cal.nextTradingDay')}</span>
                        <span className="text-zinc-300">{cal.nextTradingDay}</span>
                      </div>
                    )}
                    {cal.holidayName && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{t('cal.holidayName')}</span>
                        <span className="text-amber-400">{cal.holidayName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建任务对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] text-white">
          <DialogHeader>
            <DialogTitle>{t('sched.createJob')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('sched.jobName')} *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={language === 'zh' ? '如: 每日市场扫描' : 'e.g. Daily Market Scan'}
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('sched.cronExpr')} *</Label>
              <Input
                value={newCron}
                onChange={(e) => setNewCron(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white font-mono"
              />
              <p className="text-[10px] text-zinc-500">{t('sched.cronHint')}</p>
              <p className="text-[10px] text-zinc-500">{t('sched.cronShortcuts')}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('sched.jobType')} *</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="bg-[#0a0a0f] border-[#1e1e2e] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-[#1e1e2e]">
                  <SelectItem value="market_scan" className="text-zinc-300">{t('sched.typeMarketScan')}</SelectItem>
                  <SelectItem value="analysis" className="text-zinc-300">{t('sched.typeAnalysis')}</SelectItem>
                  <SelectItem value="news_fetch" className="text-zinc-300">{t('sched.typeNewsFetch')}</SelectItem>
                  <SelectItem value="notification" className="text-zinc-300">{t('sched.typeNotification')}</SelectItem>
                  <SelectItem value="data_sync" className="text-zinc-300">{t('sched.typeDataSync')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300 text-sm">{t('sched.jobConfig')}</Label>
              <Input
                value={newConfig}
                onChange={(e) => setNewConfig(e.target.value)}
                placeholder='{"market": "A"}'
                className="bg-[#0a0a0f] border-[#1e1e2e] text-white font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {t('sched.createJob')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              {t('sched.delete')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">{t('sched.deleteConfirm')}</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e]"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => deleteId && deleteJob(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('sched.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
