import { NextRequest, NextResponse } from 'next/server';

// --- In-Memory Alert Store ---

interface SignalAlert {
  id: string;
  symbol: string;
  message: string;
  type: 'signal' | 'price' | 'position' | 'risk';
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
  ttl: number; // expiration timestamp
}

const alertStore: SignalAlert[] = [];
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let alertCounter = 0;

// Clean expired alerts
function cleanExpired() {
  const now = Date.now();
  const before = alertStore.length;
  const idx = alertStore.findIndex(a => a.ttl <= now);
  if (idx >= 0) {
    alertStore.splice(idx, alertStore.length - idx > 100 ? alertStore.length : idx);
  }
  // Also prune from front if any expired
  while (alertStore.length > 0 && alertStore[0].ttl <= now) {
    alertStore.shift();
  }
}

// Add an alert to the store
function addAlert(symbol: string, message: string, type: SignalAlert['type'], priority: SignalAlert['priority']): SignalAlert {
  cleanExpired();
  const now = Date.now();
  const alert: SignalAlert = {
    id: `alert-${++alertCounter}-${now}`,
    symbol: symbol.toUpperCase(),
    message,
    type,
    priority,
    timestamp: new Date(now).toISOString(),
    ttl: now + TTL_MS,
  };
  alertStore.unshift(alert);

  // Cap at 200 alerts
  while (alertStore.length > 200) {
    alertStore.pop();
  }

  return alert;
}

// --- GET /api/alerts ---

export async function GET() {
  try {
    cleanExpired();
    const recent = alertStore.filter(a => a.ttl > Date.now());
    return NextResponse.json(recent);
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

// --- POST /api/alerts ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, message, type, priority } = body as {
      symbol?: string;
      message?: string;
      type?: SignalAlert['type'];
      priority?: SignalAlert['priority'];
    };

    if (!symbol || !message) {
      return NextResponse.json(
        { error: 'symbol and message are required' },
        { status: 400 }
      );
    }

    const alertType: SignalAlert['type'] = type || 'signal';
    const alertPriority: SignalAlert['priority'] = priority || 'medium';

    const alert = addAlert(symbol, message, alertType, alertPriority);
    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}

// Export addAlert for use by the scan route
export { addAlert };
export type { SignalAlert };
