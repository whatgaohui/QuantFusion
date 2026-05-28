import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const res = await fetch(`${PYTHON_SERVICE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Fallback: generate mock response
    const message = (typeof request.body === 'object' && request.body !== null) ? '' : '';
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
