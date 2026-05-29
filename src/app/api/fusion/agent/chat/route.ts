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

    const { response, isOffline, error } = await chatWithAssistant(
      message,
      sessionId,
      chatMode
    );

    console.log(`[Chat] ${chatMode} mode, offline: ${isOffline}, response length: ${response?.length || 0}, error: ${error || 'none'}`);

    if (isOffline || !response) {
      // AI service is unavailable — return error, NOT mock data
      return NextResponse.json({
        success: false,
        data: {
          response: '',
          session_id: sessionId,
          source: 'ai',
          is_offline: true,
          error: error || 'AI服务暂时不可用，请稍后重试',
        },
        error: 'AI服务暂时不可用，请稍后重试',
      }, { status: 503 });
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
    return NextResponse.json({
      success: false,
      data: null,
      error: 'AI对话服务异常，请稍后重试',
    }, { status: 500 });
  }
}
