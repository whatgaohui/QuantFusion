import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      services: {
        go_data_service: {
          url: 'http://127.0.0.1:8080',
          available: false,
          features: ['A股实时行情(Sina/Tencent)', '港股行情', '美股行情(Finnhub)', 'K线数据', '板块数据', '新闻数据', 'WebSocket实时推送'],
        },
        python_ai_service: {
          url: 'http://127.0.0.1:8000',
          available: false,
          features: ['AI分析', 'Agent对话', '策略管理', '回测引擎', '通知推送'],
        },
        nextjs_bff: {
          url: 'http://127.0.0.1:3000',
          available: true,
          features: ['前端渲染', 'BFF代理', '用户认证', '投资组合管理', '本地数据服务(Finnhub+Mock)'],
        },
      },
      data_sources: {
        primary: '本地数据服务 (Finnhub API + Mock数据)',
        secondary: 'Go数据服务 (Sina/Tencent/Finnhub)',
        ai_engine: 'Python AI服务 (LangGraph + Mock LLM)',
      },
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
}
