import { NextRequest, NextResponse } from 'next/server';
import { getMockChatResponse } from '@/lib/mock-api-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: '消息不能为空' },
        { status: 400 }
      );
    }

    const result = getMockChatResponse(message);
    return NextResponse.json({
      success: true,
      data: {
        response: result.data.response,
        session_id: body.session_id || crypto.randomUUID(),
        source: result.data.source,
      },
      error: null,
    });
  } catch (error) {
    console.error('Agent chat API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: '处理聊天消息失败' },
      { status: 500 }
    );
  }
}
