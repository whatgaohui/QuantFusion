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
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';

type ChatMode = 'quick' | 'deep';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  isOffline?: boolean;
  errorDetail?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

const suggestedPrompts = [
  { key: 'chat.quickPrompt1', icon: '📊' },
  { key: 'chat.quickPrompt2', icon: '📈' },
  { key: 'chat.quickPrompt3', icon: '💎' },
];

function formatMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-base font-semibold text-emerald-400 mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-white mt-2 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      elements.push(<li key={i} className="text-sm text-zinc-300 ml-4 leading-relaxed">{formatInline(line.slice(2))}</li>);
    } else if (line.startsWith('| ')) {
      elements.push(<p key={i} className="text-xs text-zinc-400 font-mono leading-relaxed">{line}</p>);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="text-sm text-zinc-300 font-semibold mt-1">{line.slice(2, -2)}</p>);
    } else if (line.startsWith('---')) {
      elements.push(<Separator key={i} className="bg-[#1e1e2e] my-2" />);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-sm text-zinc-300 leading-relaxed">{formatInline(line)}</p>);
    }
  }

  return elements;
}

function formatInline(text: string): React.ReactNode {
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
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: language === 'zh' ? '新建分析会话' : 'New Analysis Session',
      messages: [],
      createdAt: new Date().toISOString(),
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [inputValue, setInputValue] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('quick');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Only auto-scroll if user is near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
    }
  }, [activeSession?.messages, scrollToBottom]);

  const handleSend = useCallback(async (message?: string) => {
    const msg = message || inputValue.trim();
    if (!msg || sending) return;

    setInputValue('');
    setSending(true);
    isNearBottomRef.current = true;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, userMessage], title: s.messages.length === 0 ? msg.slice(0, 30) : s.title }
          : s
      )
    );

    try {
      const res = await fetch('/api/fusion/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, mode: chatMode, session_id: activeSessionId }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.data?.response) {
        // Real AI response received!
        setAiConnected(true);
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date().toISOString(),
          isOffline: false,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, assistantMessage] }
              : s
          )
        );
      } else {
        // AI service returned an error — show clear error message
        setAiConnected(false);
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: language === 'zh'
            ? '⚠️ AI分析服务暂时不可用，请稍后重试。'
            : '⚠️ AI analysis service is temporarily unavailable. Please try again later.',
          timestamp: new Date().toISOString(),
          errorDetail: data.error || data.data?.error || undefined,
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, errorMessage] }
              : s
          )
        );
      }
    } catch {
      // Network error — show clear error message
      setAiConnected(false);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: language === 'zh'
          ? '⚠️ 网络连接失败，请检查网络后重试。'
          : '⚠️ Network connection failed. Please check your connection and try again.',
        timestamp: new Date().toISOString(),
        errorDetail: language === 'zh' ? '无法连接到AI分析服务' : 'Cannot connect to AI analysis service',
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, errorMessage] }
            : s
        )
      );
    }

    setSending(false);
  }, [inputValue, sending, chatMode, activeSessionId, language]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: t('chat.sessionTitle'),
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleSuggestedPrompt = (key: string) => {
    const prompt = t(key);
    handleSend(prompt);
  };

  const handleRetryLastMessage = () => {
    // Find the last user message and resend
    if (!activeSession) return;
    const lastUserMsg = [...activeSession.messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // Remove the last error message and resend
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: s.messages.filter(m => m.role !== 'error').slice(0, -1) }
            : s
        )
      );
      setTimeout(() => handleSend(lastUserMsg.content), 100);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-medium text-white">{t('chat.sessionTitle')}</h2>
          </div>
          <Badge className="bg-emerald-600/15 text-emerald-400 border-emerald-600/20 text-[10px]">
            {t(chatMode === 'quick' ? 'chat.modeQuick' : 'chat.modeDeep')}
          </Badge>
          {/* AI Connection Status */}
          <div className="flex items-center gap-1">
            {aiConnected === true && (
              <>
                <Wifi className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-500">{t('chat.realtimeMode')}</span>
              </>
            )}
            {aiConnected === false && (
              <>
                <WifiOff className="w-3 h-3 text-red-500" />
                <span className="text-[10px] text-red-500">{t('chat.aiUnavailable')}</span>
              </>
            )}
            {aiConnected === null && (
              <>
                <div className="w-2 h-2 rounded-full bg-zinc-600" />
                <span className="text-[10px] text-zinc-500">{t('chat.aiWaiting')}</span>
              </>
            )}
          </div>
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
            size="sm"
            onClick={handleNewChat}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('chat.newChat')}
          </Button>
        </div>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <Card className="bg-[#111118] border-[#1e1e2e] rounded-xl mb-3 flex-shrink-0">
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
      <Card className="flex-1 min-h-0 bg-[#111118] border-[#1e1e2e] rounded-xl flex flex-col overflow-hidden">
        <div
          ref={scrollAreaRef}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            isNearBottomRef.current = distanceFromBottom < 100;
          }}
        >
          {activeSession && activeSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-4">
              {/* Welcome Panel */}
              <div className="w-20 h-20 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center mb-5">
                <Brain className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 text-center">
                {t('chat.welcome')}
              </h3>
              <p className="text-zinc-400 text-sm mb-6 text-center max-w-md leading-relaxed">
                {t('chat.welcomeDesc')}
              </p>

              {/* AI Powered Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-600/10 border border-emerald-600/20 mb-6">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">{t('chat.poweredByAI')}</span>
              </div>

              {/* Capability Tags */}
              <div className="flex flex-wrap gap-2 justify-center mb-6 max-w-lg">
                {['📊 股票分析', '📈 市场趋势', '🎯 交易洞察', '💡 策略建议'].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full bg-[#0a0a0f] border border-[#1e1e2e] text-[11px] text-zinc-400">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Suggested Prompts */}
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {suggestedPrompts.map((prompt) => (
                  <Button
                    key={prompt.key}
                    variant="outline"
                    onClick={() => handleSuggestedPrompt(prompt.key)}
                    className="border-[#1e1e2e] bg-[#0a0a0f] text-zinc-300 hover:bg-emerald-600/10 hover:text-emerald-400 hover:border-emerald-600/20 gap-2 justify-start text-left h-auto py-2.5 px-4"
                  >
                    <span className="text-base">{prompt.icon}</span>
                    <span className="text-sm">{t(prompt.key)}</span>
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
                  {msg.role === 'error' && (
                    <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-xl p-3 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600/15 border border-emerald-600/20'
                      : msg.role === 'error'
                      ? 'bg-red-600/10 border border-red-600/20'
                      : 'bg-[#0a0a0f] border border-[#1e1e2e]'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="space-y-0.5">
                        {formatMarkdown(msg.content)}
                        {/* AI source badge */}
                        <div className="flex items-center gap-1 mt-2 pt-1 border-t border-[#1e1e2e]">
                          <Wifi className="w-2.5 h-2.5 text-emerald-500" />
                          <span className="text-[9px] text-emerald-500">{t('chat.realAIResponse')}</span>
                        </div>
                      </div>
                    ) : msg.role === 'error' ? (
                      <div className="space-y-2">
                        <p className="text-sm text-red-300">{msg.content}</p>
                        {msg.errorDetail && (
                          <p className="text-xs text-red-400/60">{msg.errorDetail}</p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRetryLastMessage}
                          className="border-red-600/30 bg-red-600/10 text-red-300 hover:bg-red-600/20 hover:text-red-200 gap-1.5 h-7 text-xs"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t('chat.retry')}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-white">{msg.content}</p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
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
                        {t(chatMode === 'deep' ? 'chat.deepThinking' : 'chat.thinking')}
                      </span>
                    </div>
                    {chatMode === 'deep' && (
                      <p className="text-[10px] text-zinc-600 mt-1">{t('chat.deepThinkingHint')}</p>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Suggested Prompts (when chat has messages) */}
        {activeSession && activeSession.messages.length > 0 && !sending && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                {language === 'zh' ? '建议' : 'Suggest'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt.key}
                  onClick={() => handleSuggestedPrompt(prompt.key)}
                  className="px-2.5 py-1 rounded-md bg-[#0a0a0f] border border-[#1e1e2e] text-[11px] text-zinc-400 hover:text-emerald-400 hover:border-emerald-600/20 transition-colors"
                >
                  {prompt.icon} {t(prompt.key)}
                </button>
              ))}
            </div>
          </div>
        )}

        <Separator className="bg-[#1e1e2e] flex-shrink-0" />

        {/* Input Area */}
        <div className="p-3 flex gap-2 flex-shrink-0">
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
    </div>
  );
}
