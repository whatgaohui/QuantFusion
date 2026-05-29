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
  isOffline?: boolean;
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

// --- Smart mock response generators ---

const stockSymbols = [
  'AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META',
  '600519', '000858', '601318', '300750', '600036',
  '00700', '09988', '03690', '01810',
];

function detectSymbol(msg: string): string | null {
  const upper = msg.toUpperCase();
  for (const sym of stockSymbols) {
    if (upper.includes(sym)) return sym;
  }
  // Check for common patterns
  const shMatch = upper.match(/(SH|SZ)?(\d{6})/);
  if (shMatch) return shMatch[0];
  return null;
}

function isMarketTrendQuery(msg: string): boolean {
  const keywords = ['市场', '大盘', '走势', '趋势', '行情', '指数', 'market', 'trend', 'index', 'overview', 'outlook'];
  return keywords.some(k => msg.toLowerCase().includes(k));
}

function isStrategyQuery(msg: string): boolean {
  const keywords = ['策略', '推荐', '建议', '选股', '配置', 'strategy', 'recommend', 'suggest', 'portfolio', 'undervalued', '低估值', '高股息'];
  return keywords.some(k => msg.toLowerCase().includes(k));
}

function generateStockResponse(sym: string, lang: 'en' | 'zh'): string {
  const aShareNames: Record<string, string> = {
    '600519': '贵州茅台', '000858': '五粮液', '601318': '中国平安',
    '300750': '宁德时代', '600036': '招商银行',
  };
  const usNames: Record<string, string> = {
    'AAPL': '苹果', 'NVDA': '英伟达', 'TSLA': '特斯拉',
    'MSFT': '微软', 'GOOGL': '谷歌', 'AMZN': '亚马逊',
    'META': 'Meta',
  };
  const hkNames: Record<string, string> = {
    '00700': '腾讯控股', '09988': '阿里巴巴', '03690': '美团', '01810': '小米集团',
  };

  const name = aShareNames[sym] || usNames[sym] || hkNames[sym] || sym;
  const isAShare = aShareNames[sym];
  const isHK = hkNames[sym];
  const price = isAShare ? (1500 + Math.random() * 500).toFixed(2) : (100 + Math.random() * 300).toFixed(2);
  const change = (Math.random() * 6 - 3).toFixed(2);
  const rsi = (40 + Math.random() * 30).toFixed(1);
  const pe = (10 + Math.random() * 40).toFixed(1);
  const changeSign = parseFloat(change) >= 0 ? '+' : '';

  if (lang === 'zh') {
    return `## ${name}(${sym}) 分析报告

**当前价格**: ¥${price} (${changeSign}${change}%)

### 技术指标
- **RSI(14)**: ${rsi}，${parseFloat(rsi) > 65 ? '接近超买区域' : parseFloat(rsi) < 35 ? '超卖区域' : '中性偏多区域'}
- **MACD**: ${parseFloat(change) >= 0 ? '红柱扩大，多头动能增强' : '绿柱收敛，空头动能减弱'}
- **均线系统**: ${parseFloat(change) >= 0 ? 'MA5 > MA10，短期趋势向上' : 'MA5 < MA10，短期承压'}
- **成交量**: ${Math.random() > 0.5 ? '温和放大，量价配合良好' : '略有萎缩，关注后续放量'}

### 基本面
- **市盈率**: ${pe}x
- **行业地位**: ${isAShare ? 'A股龙头企业，品牌护城河深厚' : isHK ? '港股科技龙头，生态体系完善' : '行业标杆企业，创新驱动力强'}
- **盈利能力**: 毛利率稳定，ROE处于行业前列

### 投资建议
${parseFloat(change) >= 0 ? '短期趋势偏多，建议关注上方阻力位突破情况，若有效突破可适当加仓。' : '短期面临调整压力，建议观望等待企稳信号，可关注支撑位附近低吸机会。'}风险提示：注意控制仓位，设置止损。

---
*💡 需要更详细的分析吗？可以切换到"深度"模式获取完整的多智能体分析报告。*`;
  }

  return `## ${name}(${sym}) 分析报告

**当前价格**: $${price} (${changeSign}${change}%)

### 技术指标
- **RSI(14)**: ${rsi}，${parseFloat(rsi) > 65 ? '接近超买区域' : parseFloat(rsi) < 35 ? '超卖区域' : '中性偏多区域'}
- **MACD**: ${parseFloat(change) >= 0 ? '红柱扩大，多头动能增强' : '绿柱收敛，空头动能减弱'}
- **均线系统**: ${parseFloat(change) >= 0 ? 'MA5 > MA10，短期趋势向上' : 'MA5 < MA10，短期承压'}
- **成交量**: ${Math.random() > 0.5 ? '温和放大，量价配合良好' : '略有萎缩，关注后续放量'}

### 基本面
- **市盈率**: ${pe}x
- **行业地位**: ${isAShare ? 'A股龙头企业，品牌护城河深厚' : isHK ? '港股科技龙头，生态体系完善' : '行业标杆企业，创新驱动力强'}
- **盈利能力**: 毛利率稳定，ROE处于行业前列

### 投资建议
${parseFloat(change) >= 0 ? '短期趋势偏多，建议关注上方阻力位突破情况，若有效突破可适当加仓。' : '短期面临调整压力，建议观望等待企稳信号，可关注支撑位附近低吸机会。'}风险提示：注意控制仓位，设置止损。

---
*💡 需要更详细的分析吗？可以切换到"深度"模式获取完整的多智能体分析报告。*`;
}

function generateMarketResponse(lang: 'en' | 'zh'): string {
  const shComp = (3100 + Math.random() * 200).toFixed(2);
  const szComp = (9800 + Math.random() * 800).toFixed(2);
  const hsi = (17000 + Math.random() * 3000).toFixed(2);
  const sp500 = (5000 + Math.random() * 500).toFixed(2);
  const nasdaq = (15000 + Math.random() * 2000).toFixed(2);

  if (lang === 'zh') {
    return `## 大盘走势分析

### A股市场
- **上证指数**: ${shComp} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- **深证成指**: ${szComp} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- 市场整体呈现震荡${Math.random() > 0.5 ? '上行' : '整理'}格局
- 成交量${Math.random() > 0.5 ? '温和放大' : '略有萎缩'}，${Math.random() > 0.5 ? '增量资金入场' : '存量博弈特征明显'}

### 港股市场
- **恒生指数**: ${hsi} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- ${Math.random() > 0.5 ? '科技股表现活跃，受外围利好带动' : '金融板块承压，关注政策面变化'}

### 美股市场
- **S&P 500**: ${sp500} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 1.5 - 0.3).toFixed(2)}%)
- **纳斯达克**: ${nasdaq} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- ${Math.random() > 0.5 ? '科技板块领涨，AI概念持续火热' : '市场等待经济数据指引，波动率有所上升'}

### 展望与建议
短期市场情绪${Math.random() > 0.5 ? '偏积极' : '谨慎'}，${Math.random() > 0.5 ? '关注周五非农数据。建议控制仓位，逢低布局优质标的。' : '建议保持防御性配置，关注低估值蓝筹的配置价值。'}

---
*💡 想了解某只股票的详细分析？直接输入股票代码即可！*`;
  }

  return `## 大盘走势分析

### A股市场
- **上证指数**: ${shComp} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- **深证成指**: ${szComp} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- 市场整体呈现震荡${Math.random() > 0.5 ? '上行' : '整理'}格局
- 成交量${Math.random() > 0.5 ? '温和放大' : '略有萎缩'}，${Math.random() > 0.5 ? '增量资金入场' : '存量博弈特征明显'}

### 港股市场
- **恒生指数**: ${hsi} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- ${Math.random() > 0.5 ? '科技股表现活跃，受外围利好带动' : '金融板块承压，关注政策面变化'}

### 美股市场
- **S&P 500**: ${sp500} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 1.5 - 0.3).toFixed(2)}%)
- **纳斯达克**: ${nasdaq} (${Math.random() > 0.5 ? '+' : ''}${(Math.random() * 2 - 0.5).toFixed(2)}%)
- ${Math.random() > 0.5 ? '科技板块领涨，AI概念持续火热' : '市场等待经济数据指引，波动率有所上升'}

### 展望与建议
短期市场情绪${Math.random() > 0.5 ? '偏积极' : '谨慎'}，${Math.random() > 0.5 ? '关注周五非农数据。建议控制仓位，逢低布局优质标的。' : '建议保持防御性配置，关注低估值蓝筹的配置价值。'}

---
*💡 想了解某只股票的详细分析？直接输入股票代码即可！*`;
}

function generateStrategyResponse(lang: 'en' | 'zh'): string {
  if (lang === 'zh') {
    return `## 投资策略推荐

### 1. 高股息防御策略
- **适用场景**: 震荡市、防御性配置
- **核心标的**: 工商银行(601398)、农业银行(601288)、中国神华(601088)
- **预期收益**: 股息率5-6% + 资本增值
- **风险等级**: 低

### 2. 成长动量策略
- **适用场景**: 上升行情、趋势明确
- **核心标的**: 宁德时代(300750)、立讯精密(002475)
- **预期收益**: 年化15-25%
- **风险等级**: 中高

### 3. 估值修复策略
- **适用场景**: 市场底部、政策催化
- **筛选条件**: PE < 行业均值 & PB < 1
- **关注行业**: 银行、地产、基建
- **风险等级**: 中

### 配置建议
| 策略 | 配置比例 | 持有周期 |
|------|----------|----------|
| 高股息 | 40% | 6-12月 |
| 成长动量 | 35% | 3-6月 |
| 估值修复 | 25% | 3-9月 |

---
*💡 对某个策略感兴趣？我可以进一步分析具体标的和入场时机。*`;
  }

  return `## 投资策略推荐

### 1. 高股息防御策略
- **适用场景**: 震荡市、防御性配置
- **核心标的**: 工商银行(601398)、农业银行(601288)、中国神华(601088)
- **预期收益**: 股息率5-6% + 资本增值
- **风险等级**: 低

### 2. 成长动量策略
- **适用场景**: 上升行情、趋势明确
- **核心标的**: 宁德时代(300750)、立讯精密(002475)
- **预期收益**: 年化15-25%
- **风险等级**: 中高

### 3. 估值修复策略
- **适用场景**: 市场底部、政策催化
- **筛选条件**: PE < 行业均值 & PB < 1
- **关注行业**: 银行、地产、基建
- **风险等级**: 中

### 配置建议
| 策略 | 配置比例 | 持有周期 |
|------|----------|----------|
| 高股息 | 40% | 6-12月 |
| 成长动量 | 35% | 3-6月 |
| 估值修复 | 25% | 3-9月 |

---
*💡 对某个策略感兴趣？我可以进一步分析具体标的和入场时机。*`;
}

function generateDefaultResponse(msg: string, lang: 'en' | 'zh'): string {
  if (lang === 'zh') {
    return `## 分析结果

感谢您的提问。关于"${msg.slice(0, 30)}"，以下是我的分析：

### 关键要点
- 当前市场环境需要谨慎应对，建议关注基本面扎实、估值合理的标的
- 技术面和资金面信号需要综合判断，单一指标不足以作为决策依据
- 风险管理是投资的首要原则，建议严格控制单笔仓位不超过总资金的10%

### 建议操作
1. 明确投资目标和风险承受能力
2. 做好充分的研究和尽职调查
3. 分批建仓，设置止损位
4. 定期复盘，及时调整策略

---
*💡 您可以：
- 输入股票代码获取详细分析（如：AAPL、600519）
- 询问市场趋势（如：大盘走势如何）
- 咨询投资策略（如：推荐低估值股票）*`;
  }

  return `## 分析结果

感谢您的提问。关于"${msg.slice(0, 30)}"，以下是我的分析：

### 关键要点
- 当前市场环境需要谨慎应对，建议关注基本面扎实、估值合理的标的
- 技术面和资金面信号需要综合判断，单一指标不足以作为决策依据
- 风险管理是投资的首要原则，建议严格控制单笔仓位不超过总资金的10%

### 建议操作
1. 明确投资目标和风险承受能力
2. 做好充分的研究和尽职调查
3. 分批建仓，设置止损位
4. 定期复盘，及时调整策略

---
*💡 您可以：
- 输入股票代码获取详细分析（如：AAPL、600519）
- 询问市场趋势（如：大盘走势如何）
- 咨询投资策略（如：推荐低估值股票）*`;
}

function generateMockResponse(msg: string, lang: 'en' | 'zh'): string {
  const symbol = detectSymbol(msg);
  if (symbol) return generateStockResponse(symbol, lang);
  if (isMarketTrendQuery(msg)) return generateMarketResponse(lang);
  if (isStrategyQuery(msg)) return generateStrategyResponse(lang);
  return generateDefaultResponse(msg, lang);
}

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
      title: '新建分析会话',
      messages: [],
      createdAt: new Date().toISOString(),
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [inputValue, setInputValue] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('quick');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
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
    let usedOffline = false;
    try {
      const res = await fetch('/api/fusion/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, mode: chatMode, session_id: activeSessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Support multiple response formats: new AI format uses data.response, old format uses data.data
        const content = data?.data?.response || data?.data?.content || data?.data?.message || data?.response || data?.content || data?.message;
        const source = data?.data?.source || data?.source || 'unknown';
        if (content) {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: typeof content === 'string' ? content : JSON.stringify(content),
            timestamp: new Date().toISOString(),
            isOffline: source === 'mock',
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? { ...s, messages: [...s.messages, assistantMessage] }
                : s
            )
          );
          setIsOfflineMode(source === 'mock');
          setSending(false);
          return;
        }
      }
      usedOffline = true;
    } catch {
      usedOffline = true;
    }

    // Mock response with a small delay for realism
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));
    const mockContent = generateMockResponse(msg, language);

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: mockContent,
      timestamp: new Date().toISOString(),
      isOffline: true,
    };

    setIsOfflineMode(usedOffline);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, assistantMessage] }
          : s
      )
    );
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
          {isOfflineMode && (
            <div className="flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-yellow-500" />
              <span className="text-[10px] text-yellow-500">{t('chat.offlineMode')}</span>
            </div>
          )}
          {!isOfflineMode && activeSession && activeSession.messages.some(m => !m.isOffline) && (
            <div className="flex items-center gap-1">
              <Wifi className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-500">{t('chat.realtimeMode')}</span>
            </div>
          )}
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
                  <div className={`max-w-[80%] rounded-xl p-3 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600/15 border border-emerald-600/20'
                      : 'bg-[#0a0a0f] border border-[#1e1e2e]'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="space-y-0.5">
                        {formatMarkdown(msg.content)}
                        {msg.isOffline && (
                          <div className="flex items-center gap-1 mt-2 pt-1 border-t border-[#1e1e2e]">
                            <WifiOff className="w-2.5 h-2.5 text-yellow-500/60" />
                            <span className="text-[9px] text-yellow-500/60">{t('chat.offlineMode')}</span>
                          </div>
                        )}
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
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">建议</span>
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
