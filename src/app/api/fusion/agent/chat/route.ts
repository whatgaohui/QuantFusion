import { NextRequest, NextResponse } from 'next/server';
import { chatWithAssistant } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, session_id, mode } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: '消息不能为空' },
        { status: 400 }
      );
    }

    const sessionId = session_id || crypto.randomUUID();
    const chatMode = mode === 'deep' ? 'deep' : 'quick';

    const { response, isOffline } = await chatWithAssistant(
      message,
      sessionId,
      chatMode
    );

    if (isOffline || !response) {
      // AI is offline, return mock response
      const mockResponse = generateMockChatResponse(message);
      return NextResponse.json({
        success: true,
        data: {
          response: mockResponse,
          session_id: sessionId,
          source: 'mock',
          is_offline: true,
        },
        error: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        response,
        session_id: sessionId,
        source: 'ai',
        is_offline: false,
      },
      error: null,
    });
  } catch (error) {
    console.error('Agent chat API error:', error);
    const mockResponse = generateMockChatResponse(body?.message || '');
    return NextResponse.json({
      success: true,
      data: {
        response: mockResponse,
        session_id: body?.session_id || crypto.randomUUID(),
        source: 'mock',
        is_offline: true,
      },
      error: null,
    });
  }
}

function generateMockChatResponse(message: string): string {
  const msg = message.toLowerCase();

  if (msg.match(/[0-9]{6}|sh\d{6}|sz\d{6}|hk\d{5}|aapl|nvda|tsla|msft|googl|amzn|meta/)) {
    return `关于您查询的股票，以下是我的分析：

📊 **技术面**：当前股价运行于5日均线上方，短期趋势偏强。RSI(14)处于50-65区间，多头动能尚可。MACD红柱温和放大，趋势有望延续。

📈 **基本面**：公司经营状况稳健，营收保持增长。估值处于行业合理水平，安全边际适中。

💡 **建议**：当前可适度关注，建议等待回调至支撑位附近再考虑介入。注意控制仓位，设置合理止损。

*以上分析仅供参考，不构成投资建议。*`;
  }

  if (msg.match(/趋势|行情|大盘|市场/)) {
    return `📈 **市场趋势分析**

🇨🇳 **A股**：当前市场处于震荡整理阶段，成交量有所萎缩。短期关注3200-3300点区间突破方向。板块轮动加快，建议关注科技和消费主线。

🇭🇰 **港股**：恒生指数在19000点附近震荡，南向资金持续流入提供支撑。互联网龙头估值修复行情可期。

🇺🇸 **美股**：三大指数维持高位运行，科技股领涨。关注美联储议息会议对市场的影响。

💡 **总体观点**：全球市场短期偏多，但需警惕获利回吐压力。建议均衡配置，控制整体仓位。

*以上分析仅供参考，不构成投资建议。*`;
  }

  if (msg.match(/策略|操作|建议|怎么买|怎么卖/)) {
    return `🎯 **投资策略建议**

1. **趋势跟踪策略**：当5日均线上穿20日均线时买入，下穿时卖出。适合趋势明确的市场环境。

2. **均值回归策略**：当股价偏离20日均线超过2个标准差时，考虑反向操作。适合震荡市。

3. **风险管理**：
   - 单一持仓不超过总资金的20%
   - 设置5-8%止损线
   - 盈亏比至少1:2

4. **仓位管理**：
   - 初始建仓不超过1/3
   - 确认趋势后加仓1/3
   - 保留1/3现金应对波动

*以上建议仅供参考，不构成投资建议。*`;
  }

  return `你好！我是QuantFusion AI量化交易助手，我可以帮你：

📊 **分析个股** - 输入股票代码获取技术面、基本面分析
📈 **解读市场** - 了解A股、港股、美股最新趋势
🎯 **策略建议** - 基于量化指标的交易策略推荐
💡 **风险评估** - 个股和组合风险分析

请告诉我你想了解什么，比如输入股票代码或询问市场趋势。`;
}
