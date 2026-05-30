import { NextRequest, NextResponse } from 'next/server';

// In-memory store for analysis results (simple polling simulation)
const analysisStore = new Map<string, {
  status: 'pending' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  createdAt: number;
}>();

// Clean up old entries periodically (older than 30 minutes)
function cleanup() {
  const now = Date.now();
  for (const [key, value] of analysisStore) {
    if (now - value.createdAt > 30 * 60 * 1000) {
      analysisStore.delete(key);
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    cleanup();

    // Check in-memory store
    const stored = analysisStore.get(taskId);
    if (stored) {
      if (stored.status === 'completed') {
        return NextResponse.json({
          taskId,
          status: 'completed',
          result: stored.result,
        });
      } else if (stored.status === 'failed') {
        return NextResponse.json({
          taskId,
          status: 'failed',
          error: 'Analysis failed',
        });
      }
      // Still pending
      return NextResponse.json({
        taskId,
        status: 'pending',
        message: 'Analysis in progress',
      });
    }

    // For unknown task IDs, return a completed mock result
    // (since the /start endpoint now returns results directly)
    const mockResult = {
      symbol: taskId.startsWith('anal_') ? taskId.split('_')[1]?.toUpperCase() || 'UNKNOWN' : taskId.toUpperCase(),
      recommendation: 'HOLD',
      score: 65,
      technicalSummary: 'Technical indicators show mixed signals. The stock is trading near key moving averages with moderate momentum.',
      fundamentalSummary: 'Fundamentals are stable with consistent revenue growth and reasonable valuation metrics.',
      sentimentSummary: 'Market sentiment is neutral with balanced analyst opinions.',
      riskLevel: 'MEDIUM',
      riskScore: 40,
      report: `# Analysis Report\n\n## Summary\nAnalysis completed for the requested symbol.\n\n## Technical Analysis\n- Current trend: Neutral\n- Momentum: Moderate\n- Key levels: Monitor support and resistance\n\n## Risk Assessment\n- Risk Level: Medium\n- Key risks: Market volatility, sector rotation`,
      provider: 'mock',
      tokens: 1800,
      cost: 0.015,
    };

    return NextResponse.json({
      taskId,
      status: 'completed',
      result: mockResult,
    });
  } catch (error) {
    console.error('[fusion/analysis/taskId] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis status' },
      { status: 500 }
    );
  }
}

// Allow storing results from the start endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();

    analysisStore.set(taskId, {
      status: body.status || 'completed',
      result: body.result,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[fusion/analysis/taskId] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to store analysis result' },
      { status: 500 }
    );
  }
}
