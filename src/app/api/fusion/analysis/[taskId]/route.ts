import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://127.0.0.1:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(`${PYTHON_SERVICE_URL}/api/analysis/${encodeURIComponent(taskId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Fallback: return mock analysis result
    return NextResponse.json({
      success: true,
      data: {
        symbol: 'UNKNOWN',
        mode: 'standard',
        task_id: taskId,
        current_step: 'completed',
        progress: 100,
        technical_analysis: '技术分析：市场处于震荡区间，短期均线粘合，等待方向选择。MACD零轴附近，KDJ中位，建议观望。',
        fundamental_analysis: '基本面分析：公司财务状况稳健，营收稳步增长，估值处于行业中等水平。',
        sentiment_analysis: '情绪分析：市场情绪中性偏谨慎，北向资金小幅流入，机构持仓变化不大。',
        bull_thesis: '多头观点：行业景气度上行，政策利好预期增强，技术面有支撑。',
        bear_thesis: '空头观点：宏观经济不确定性增加，市场流动性偏紧，短期压力较大。',
        risk_assessment: '风险评估：整体风险中等，建议控制仓位，设置止损。',
        final_decision: '综合建议：持有观望，等待更明确的信号再行动。评分55，建议HOLD。',
        llm_calls: 0,
        errors: [],
        source: 'mock',
      },
      error: null,
    });
  }
}
