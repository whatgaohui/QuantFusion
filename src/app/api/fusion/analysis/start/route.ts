import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(`${PYTHON_SERVICE_URL}/api/analysis/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Fallback: generate a mock task ID
    const taskId = crypto.randomUUID();
    return NextResponse.json({
      success: true,
      data: { task_id: taskId, status: 'running', source: 'mock' },
      error: null,
    });
  }
}
