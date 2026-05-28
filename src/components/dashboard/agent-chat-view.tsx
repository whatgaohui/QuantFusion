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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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

const mockResponseMap: Record<string, string> = {
  'chat.quickPrompt1': `## 贵州茅台 (SH600519) 技术分析

**当前价格**: ¥1,856.00

### 技术指标
- **MA5 > MA10 > MA20**: 多头排列，短期趋势向上
- **RSI(14)**: 62.3，处于中性偏多区域
- **MACD**: DIF线在DEA线上方，红柱扩大
- **布林带**: 价格位于中轨与上轨之间

### 总结
短期趋势偏多，建议关注 ¥1,880 压力位突破情况。若突破则看 ¥1,920，下方支撑 ¥1,820。`,
  'chat.quickPrompt2': `## 大盘走势分析

### A股市场
- **上证指数**: 3,156.28 (+0.35%)
- **深证成指**: 10,245.67 (+0.52%)
- 市场整体呈现震荡上行格局

### 港股市场
- **恒生指数**: 18,942.35 (+0.82%)
- 科技股表现活跃，受外围利好带动

### 美股市场
- **S&P 500**: 5,248.32 (+0.54%)
- 科技板块领涨，AI概念持续火热

### 展望
短期市场情绪偏积极，关注周五非农数据。建议控制仓位，逢低布局优质标的。`,
  'chat.quickPrompt3': `## 低估值股票推荐

基于 PB/PE/G 估值模型筛选：

| 代码 | 名称 | PE | PB | 股息率 | 行业 |
|------|------|-----|-----|--------|------|
| 601398 | 工商银行 | 5.2 | 0.6 | 5.8% | 银行 |
| 601288 | 农业银行 | 4.8 | 0.5 | 6.1% | 银行 |
| 600028 | 中国石化 | 8.3 | 0.8 | 5.2% | 石化 |
| 601088 | 中国神华 | 7.1 | 1.0 | 6.5% | 煤炭 |

### 策略建议
1. 高股息策略在当前环境下具有防御价值
2. 关注央企改革主题带来的估值修复机会
3. 建议分散配置，单一行业不超过30%`,
};

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
      // Simple table handling - just render as text
      elements.push(<p key={i} className="text-xs text-zinc-400 font-mono leading-relaxed">{line}</p>);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="text-sm text-zinc-300 font-semibold mt-1">{line.slice(2, -2)}</p>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-sm text-zinc-300 leading-relaxed">{formatInline(line)}</p>);
    }
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
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: 'New Analysis Session',
      messages: [],
      createdAt: new Date().toISOString(),
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [inputValue, setInputValue] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('quick');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, scrollToBottom]);

  const handleSend = useCallback(async (message?: string) => {
    const msg = message || inputValue.trim();
    if (!msg || sending) return;

    setInputValue('');
    setSending(true);

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

    // Try real API first, fallback to mock
    try {
      const res = await fetch('/api/fusion/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, mode: chatMode, session_id: activeSessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || data.message || data.response || 'Analysis complete.',
          timestamp: new Date().toISOString(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, assistantMessage] }
              : s
          )
        );
        setSending(false);
        return;
      }
    } catch {
      // Use mock response
    }

    // Mock response
    await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));
    const mockContent = mockResponseMap[
      suggestedPrompts.find(p => t(p.key) === msg)?.key || ''
    ] || `Based on your query about "${msg}", here is my analysis:

### Key Findings
- The current market conditions suggest a cautious approach
- Technical indicators are showing mixed signals
- Consider monitoring the key support and resistance levels

### Recommendation
I recommend further research before making any investment decisions. Would you like me to perform a deeper analysis on any specific aspect?`;

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: mockContent,
      timestamp: new Date().toISOString(),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, assistantMessage] }
          : s
      )
    );
    setSending(false);
  }, [inputValue, sending, chatMode, activeSessionId, t]);

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
      <Card className="flex-1 bg-[#111118] border-[#1e1e2e] rounded-xl flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
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
                        {chatMode === 'deep' ? 'Deep analysis in progress...' : 'Thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Suggested Prompts (when chat has messages) */}
        {activeSession && activeSession.messages.length > 0 && !sending && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Suggestions</span>
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
    </div>
  );
}
