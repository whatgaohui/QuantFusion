import { NextRequest, NextResponse } from 'next/server';
import { chatWithAssistant } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, session_id, mode = 'quick' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'Message is required' },
        { status: 400 }
      );
    }

    const sessionId = session_id || crypto.randomUUID();

    // Try real AI with timeout - if it fails or takes too long, fall back to mock
    try {
      const result = await chatWithAssistant(message, sessionId, mode);

      if (!result.isOffline && result.response) {
        return NextResponse.json({
          success: true,
          data: {
            response: result.response,
            session_id: sessionId,
            source: 'ai',
          },
          error: null,
        });
      }
    } catch (aiError) {
      console.error('AI chat failed, falling back to mock:', aiError instanceof Error ? aiError.message : 'Unknown');
    }

    // Fallback to mock response
    return NextResponse.json({
      success: true,
      data: {
        response: generateMockChatResponse(message),
        session_id: sessionId,
        source: 'mock',
      },
      error: null,
    });
  } catch (err) {
    console.error('Agent chat API error:', err);
    return NextResponse.json({
      success: true,
      data: {
        response: '您好！我是QuantFusion AI交易助手。当前AI服务暂未连接，请稍后重试。\n\n我可以帮您：\n- 📊 分析个股技术面和基本面\n- 📈 解读市场行情和趋势\n- 🎯 提供投资策略建议',
        session_id: crypto.randomUUID(),
        source: 'mock',
      },
      error: null,
    });
  }
}

function generateMockChatResponse(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes('茅台') || msg.includes('600519')) {
    return '📊 **贵州茅台 (SH600519) 分析**\n\n当前茅台处于高位震荡区间，技术面来看：\n- **MA系统**：5日线与10日线金叉，短期趋势偏多\n- **MACD**：DIF线在零轴上方运行，动能尚可\n- **RSI**：6日RSI在65附近，未进入超买区\n\n基本面：白酒龙头地位稳固，品牌溢价能力强。近期北向资金持续流入白酒板块。\n\n⚠️ 风险提示：注意消费降级对高端白酒的影响，以及估值偏高的问题。\n\n*以上分析仅供参考，不构成投资建议*';
  }
  if (msg.includes('平安') || msg.includes('601318')) {
    return '📊 **中国平安 (SH601318) 分析**\n\n保险龙头近期走势稳健：\n- **技术面**：股价在60日均线附近获得支撑，MACD即将金叉\n- **基本面**：寿险新业务价值增长超预期，回购计划持续推进\n- **资金面**：北向资金持续增持，机构持仓比例上升\n\n⚠️ 风险提示：利率下行对投资收益有压力，新单增长需持续观察。\n\n*以上分析仅供参考，不构成投资建议*';
  }
  if (msg.includes('大盘') || msg.includes('指数') || msg.includes('行情')) {
    return '📈 **今日A股市场行情**\n\n**上证指数**：3268.50 (+0.40%)\n**深证成指**：10456.80 (+0.52%)\n**创业板指**：2089.30 (+0.35%)\n\n市场特征：\n- 成交额突破万亿，市场活跃度提升\n- 白酒板块领涨，新能源概念持续活跃\n- 北向资金净流入超50亿元\n\n💡 后市展望：市场短期震荡偏强，关注3250点支撑力度。\n\n*以上分析仅供参考，不构成投资建议*';
  }
  return '您好！我是QuantFusion AI交易助手。\n\n我可以帮您：\n- 📊 分析个股技术面和基本面\n- 📈 解读市场行情和趋势\n- 🎯 提供投资策略建议\n\n请告诉我您想了解哪只股票或市场信息？';
}
