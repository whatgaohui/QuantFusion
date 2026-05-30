'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  History,
  Bot,
  User,
  Lightbulb,
  Loader2,
  Zap,
  Brain,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
// ScrollArea removed — using plain div with overflow-y-auto for reliable scroll-to-bottom
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n';

type ChatMode = 'quick' | 'deep';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  tokens?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const CHAT_SESSIONS_KEY = 'quantfusion-chat-sessions';
const MAX_MESSAGES_PER_SESSION = 50;
const MAX_SESSIONS = 10;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// localStorage helpers
function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Clean up sessions older than 7 days
    const now = Date.now();
    const valid = parsed.filter((s: ChatSession) => {
      const created = new Date(s.createdAt).getTime();
      const updated = new Date(s.updatedAt || s.createdAt).getTime();
      return (now - updated) < SESSION_TTL_MS || (now - created) < SESSION_TTL_MS;
    });

    // Limit to last 10 sessions, trim messages to last 50 per session
    const trimmed = valid.slice(0, MAX_SESSIONS).map((s: ChatSession) => ({
      ...s,
      messages: (s.messages || []).slice(-MAX_MESSAGES_PER_SESSION),
      updatedAt: s.updatedAt || s.createdAt,
    }));

    return trimmed;
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]): void {
  try {
    // Trim before saving
    const trimmed = sessions.slice(0, MAX_SESSIONS).map((s) => ({
      ...s,
      messages: (s.messages || []).slice(-MAX_MESSAGES_PER_SESSION),
      updatedAt: s.updatedAt || s.createdAt,
    }));
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage might be full or unavailable
  }
}

function createDefaultSession(): ChatSession {
  return {
    id: Date.now().toString(),
    title: 'New Analysis Session',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const suggestedPrompts = [
  { key: 'chat.quickPrompt1', icon: '📊' },
  { key: 'chat.quickPrompt2', icon: '📈' },
  { key: 'chat.quickPrompt3', icon: '💎' },
];

/** Check if a line is a markdown table separator (e.g., |---|---|) */
function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:]+\|$/.test(line.trim()) || /^\|[\s\-:]+\|/.test(line.trim());
}

function formatMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Detect consecutive table rows (lines starting with |)
    if (line.trim().startsWith('|')) {
      // Collect all consecutive table lines
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      // Filter out separator rows and parse cells
      const dataRows = tableLines.filter((l) => !isTableSeparator(l));
      const parsedRows = dataRows.map((l) =>
        l.split('|')
          .map((cell) => cell.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length) // remove empty first/last from split
      );

      if (parsedRows.length > 0) {
        const headerRow = parsedRows[0];
        const bodyRows = parsedRows.slice(1);
        const colCount = headerRow.length;

        elements.push(
          <div key={`table-${i}`} className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0a0a0f]">
                  {headerRow.map((cell, ci) => (
                    <th
                      key={ci}
                      className="text-left px-3 py-1.5 text-zinc-300 font-semibold border border-[#1e1e2e] whitespace-nowrap"
                    >
                      {formatInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className="even:bg-[#0a0a0f]/50">
                    {Array.from({ length: colCount }).map((_, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 text-zinc-300 border border-[#1e1e2e] whitespace-nowrap"
                      >
                        {formatInline(row[ci] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      // Don't increment i here — already advanced in the while loop above
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-semibold text-emerald-400 mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-white mt-2 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      elements.push(<li key={i} className="text-sm text-zinc-300 ml-4 leading-relaxed">{formatInline(line.slice(2))}</li>);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="text-sm text-zinc-300 font-semibold mt-1">{line.slice(2, -2)}</p>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-sm text-zinc-300 leading-relaxed">{formatInline(line)}</p>);
    }

    i++;
  }

  return elements;
}

function formatInline(text: string): React.ReactNode {
  // Simple bold formatting
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function AgentChatView() {
  const { t, language } = useLanguage();
  // Load sessions once and derive both state initialisers from it
  const [initialSessions] = useState(() => loadSessions());
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    initialSessions.length > 0 ? initialSessions : [createDefaultSession()]
  );
  const [activeSessionId, setActiveSessionId] = useState(() =>
    initialSessions.length > 0 ? initialSessions[0].id : Date.now().toString()
  );
  const [inputValue, setInputValue] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('quick');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Debounced save to localStorage
  const persistSessions = useCallback((sessionData: ChatSession[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveSessions(sessionData);
    }, 300);
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    persistSessions(sessions);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sessions, persistSessions]);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, scrollToBottom]);

  const handleSend = useCallback(async (message?: string) => {
    const msg = message || inputValue.trim();
    if (!msg || sending) return;

    setInputValue('');
    setSending(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };

    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [...s.messages, userMessage],
              title: s.messages.length === 0 ? msg.slice(0, 30) : s.title,
              updatedAt: new Date().toISOString(),
            }
          : s
      );
      // Save immediately on user message
      saveSessions(updated);
      return updated;
    });

    // Build chat history for context
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    const history = (currentSession?.messages || []).slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Call AI chat API
    try {
      const res = await fetch('/api/fusion/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          mode: chatMode,
          session_id: activeSessionId,
          history,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const isMock = data.provider === 'mock';
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || data.message || data.response || 'Analysis complete.',
          timestamp: new Date().toISOString(),
          provider: data.provider,
          tokens: data.tokens,
        };
        setSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages: [...s.messages, assistantMessage],
                  updatedAt: new Date().toISOString(),
                }
              : s
          );
          // Save immediately on assistant message
          saveSessions(updated);
          return updated;
        });
        if (isMock) {
          setError(language === 'zh'
            ? 'AI 服务暂不可用，当前为模拟回复。请在设置中配置 LLM 或检查 Z.ai 服务状态。'
            : 'AI service unavailable, showing simulated response. Please configure LLM in Settings or check Z.ai status.');
          setTimeout(() => setError(null), 8000);
        }
        setSending(false);
        return;
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `HTTP ${res.status}`;
        setError(language === 'zh' ? `请求失败: ${errMsg}` : `Request failed: ${errMsg}`);
      }
    } catch {
      setError(language === 'zh' ? '网络错误，请检查连接' : 'Network error, please check connection');
    }

    setSending(false);
    // Clear error after a few seconds
    setTimeout(() => setError(null), 8000);
  }, [inputValue, sending, chatMode, activeSessionId, sessions, t, language]);

  const handleNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: t('chat.sessionTitle'),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions((prev) => {
      const updated = [newSession, ...prev].slice(0, MAX_SESSIONS);
      saveSessions(updated);
      return updated;
    });
    setActiveSessionId(newSession.id);
  }, [t]);

  const handleClearHistory = useCallback(() => {
    setClearConfirmOpen(true);
  }, []);

  const confirmClearHistory = useCallback(() => {
    try {
      localStorage.removeItem(CHAT_SESSIONS_KEY);
    } catch {
      // ignore
    }
    const defaultSession = createDefaultSession();
    defaultSession.title = t('chat.sessionTitle');
    setSessions([defaultSession]);
    setActiveSessionId(defaultSession.id);
    setClearConfirmOpen(false);
  }, [t]);

  const handleSuggestedPrompt = (key: string) => {
    const prompt = t(key);
    handleSend(prompt);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-medium text-white">{t('chat.sessionTitle')}</h2>
          </div>
          <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
            {t(chatMode === 'quick' ? 'chat.modeQuick' : 'chat.modeDeep')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={chatMode} onValueChange={(v) => setChatMode(v as ChatMode)}>
            <SelectTrigger className="w-28 bg-[#111118] border-[#1e1e2e] text-white h-8 text-xs">
              <Zap className="w-3 h-3 mr-1 text-emerald-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-[#1e1e2e]">
              <SelectItem value="quick" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                {t('chat.modeQuick')}
              </SelectItem>
              <SelectItem value="deep" className="text-zinc-300 focus:text-white focus:bg-[#1a1a2e]">
                {t('chat.modeDeep')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-[#1a1a2e] gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            {t('chat.history')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="border-[#1e1e2e] bg-[#0a0a0f] text-red-400/70 hover:text-red-400 hover:bg-red-600/10 hover:border-red-600/20 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('chat.clearHistory')}
          </Button>
          <Button
            size="sm"
            onClick={handleNewChat}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('chat.newChat')}
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-yellow-400">{error}</p>
        </div>
      )}

      {/* History Sidebar */}
      {showHistory && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl mb-4">
          <CardContent className="p-3">
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => { setActiveSessionId(session.id); setShowHistory(false); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    session.id === activeSessionId
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-600/20'
                      : 'bg-[#0a0a0f] text-zinc-400 border border-[#1e1e2e] hover:border-[#2e2e3e]'
                  }`}
                >
                  {session.title.slice(0, 20)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Messages */}
      <Card className="flex-1 min-h-0 bg-[#111118] border-[#1e1e2e] rounded-xl flex flex-col overflow-hidden p-0 gap-0">
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
          {activeSession && activeSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/10 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-zinc-300 text-sm mb-6">{t('chat.welcomeMessage')}</p>

              {/* Suggested Prompts */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    key={prompt.key}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestedPrompt(prompt.key)}
                    disabled={sending}
                    className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-emerald-600/10 hover:text-emerald-400 hover:border-emerald-600/20 gap-2"
                  >
                    <span>{prompt.icon}</span>
                    {t(prompt.key)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {activeSession?.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-xl p-3 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600/15 border border-emerald-600/20'
                      : 'bg-[#0a0a0f] border border-[#1e1e2e]'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="space-y-0.5">{formatMarkdown(msg.content)}</div>
                    ) : (
                      <p className="text-sm text-white">{msg.content}</p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[10px] text-zinc-600">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                      {msg.role === 'assistant' && msg.provider && (
                        <Badge className="bg-purple-600/10 text-purple-400 border-purple-600/20 text-[8px] px-1 py-0">
                          {msg.provider}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-zinc-600/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-zinc-400" />
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-emerald-400 animate-pulse" />
                  </div>
                  <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                      <span className="text-sm text-zinc-400">
                        {chatMode === 'deep' ? t('chat.deepAnalysisProgress') : t('chat.thinking')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

        {/* Suggested Prompts (when chat has messages) */}
        {activeSession && activeSession.messages.length > 0 && !sending && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{t('chat.suggestions')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt.key}
                  onClick={() => handleSuggestedPrompt(prompt.key)}
                  disabled={sending}
                  className="px-2.5 py-1 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[11px] text-zinc-400 hover:text-emerald-400 hover:border-emerald-600/20 transition-colors disabled:opacity-50"
                >
                  {prompt.icon} {t(prompt.key)}
                </button>
              ))}
            </div>
          </div>
        )}

        <Separator className="bg-[#1e1e2e]" />

        {/* Input Area */}
        <div className="p-3 flex gap-2">
          <div className="flex-1 relative">
            <Input
              placeholder={t('chat.inputPlaceholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              disabled={sending}
              className="bg-[#0a0a0f] border-[#1e1e2e] text-white placeholder:text-zinc-500 focus:border-emerald-600/50 pr-10"
            />
          </div>
          <Button
            onClick={() => handleSend()}
            disabled={sending || !inputValue.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('chat.send')}
          </Button>
        </div>
      </Card>

      {/* Clear History Confirmation Dialog */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              {t('chat.clearConfirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t('chat.clearConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setClearConfirmOpen(false)}
              className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={confirmClearHistory}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('chat.clearAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
