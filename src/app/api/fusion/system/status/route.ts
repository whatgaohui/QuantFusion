import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      services: {
        nextjs_bff: {
          url: 'http://127.0.0.1:3000',
          available: true,
          features: ['前端渲染', 'BFF代理', '用户认证', '投资组合管理', 'Mock数据服务'],
        },
      },
      data_sources: {
        primary: 'Mock数据服务 (轻量级本地数据)',
      },
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
}
