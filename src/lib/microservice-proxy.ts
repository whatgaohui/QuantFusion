/**
 * Microservice Proxy Utility for QuantFusion
 *
 * Provides a unified interface to proxy requests to Go data service and Python AI service
 * with automatic fallback to local data service when microservices are unavailable.
 */

// Service configuration
const GO_DATA_SERVICE_URL = process.env.GO_DATA_SERVICE_URL || 'http://127.0.0.1:8080';
const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Service health tracking
const serviceHealth = {
  go: { available: false, lastCheck: 0, checkInterval: 30000, consecutiveFailures: 0 },
  python: { available: false, lastCheck: 0, checkInterval: 30000, consecutiveFailures: 0 },
};

/**
 * Check if a microservice is available (with caching)
 */
async function checkServiceHealth(baseUrl: string, serviceName: 'go' | 'python'): Promise<boolean> {
  const health = serviceHealth[serviceName];
  const now = Date.now();

  // Use cached status if checked recently
  if (now - health.lastCheck < health.checkInterval) {
    return health.available;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    health.available = res.ok;
    health.lastCheck = now;
    health.consecutiveFailures = 0;
    return health.available;
  } catch {
    health.available = false;
    health.lastCheck = now;
    health.consecutiveFailures++;
    // Increase check interval on repeated failures (max 5 min)
    health.checkInterval = Math.min(30000 * Math.pow(2, health.consecutiveFailures - 1), 300000);
    return false;
  }
}

/**
 * Proxy a request to Go data service with timeout
 */
export async function proxyToGoService<T = unknown>(
  path: string,
  params?: Record<string, string>,
  options?: { timeout?: number }
): Promise<{ success: boolean; data: T | null; error: string | null; source: string }> {
  const timeout = options?.timeout || 4000; // 4s timeout for data service
  const isAvailable = await checkServiceHealth(GO_DATA_SERVICE_URL, 'go');

  if (!isAvailable) {
    return { success: false, data: null, error: 'Go data service unavailable', source: 'fallback' };
  }

  try {
    const url = new URL(`${GO_DATA_SERVICE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { success: false, data: null, error: errorData.error || errorData.details || `HTTP ${res.status}`, source: 'go-service' };
    }

    const data = await res.json();
    return { success: true, data: data as T, error: null, source: 'go-service' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Mark service as potentially unavailable
    serviceHealth.go.available = false;
    serviceHealth.go.lastCheck = Date.now();
    return { success: false, data: null, error: `Go service error: ${message}`, source: 'fallback' };
  }
}

/**
 * Proxy a request to Python AI service with timeout
 */
export async function proxyToPythonService<T = unknown>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    timeout?: number;
  }
): Promise<{ success: boolean; data: T | null; error: string | null; source: string }> {
  const timeout = options?.timeout || 10000; // 10s timeout for AI service
  const isAvailable = await checkServiceHealth(PYTHON_AI_SERVICE_URL, 'python');

  if (!isAvailable) {
    return { success: false, data: null, error: 'Python AI service unavailable', source: 'fallback' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const fetchOptions: RequestInit = {
      method: options?.method || 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    };

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const res = await fetch(`${PYTHON_AI_SERVICE_URL}${path}`, fetchOptions);
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { success: false, data: null, error: errorData.error || `HTTP ${res.status}`, source: 'python-service' };
    }

    const data = await res.json();
    return { success: true, data: data as T, error: null, source: 'python-service' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    serviceHealth.python.available = false;
    serviceHealth.python.lastCheck = Date.now();
    return { success: false, data: null, error: `Python service error: ${message}`, source: 'fallback' };
  }
}

/**
 * Get the service health status
 */
export function getServiceStatus() {
  return {
    go: { available: serviceHealth.go.available, lastCheck: serviceHealth.go.lastCheck },
    python: { available: serviceHealth.python.available, lastCheck: serviceHealth.python.lastCheck },
  };
}

/**
 * Convert Go service quote format to our standard QuoteData format
 */
export function convertGoQuote(goQuote: Record<string, unknown>) {
  return {
    symbol: goQuote.symbol as string,
    name: goQuote.name as string || (goQuote.symbol as string),
    currentPrice: goQuote.current as number || 0,
    change: goQuote.change as number || 0,
    changePercent: goQuote.change_pct as number || 0,
    high: goQuote.high as number || 0,
    low: goQuote.low as number || 0,
    open: goQuote.open as number || 0,
    prevClose: goQuote.prev_close as number || 0,
    volume: goQuote.volume as number || 0,
    timestamp: goQuote.timestamp
      ? Math.floor(new Date(goQuote.timestamp as string).getTime() / 1000)
      : Math.floor(Date.now() / 1000),
    market: (goQuote.market as string || 'US') as 'US' | 'A' | 'HK',
  };
}

/**
 * Convert Go service sector format to our standard SectorData format
 */
export function convertGoSector(goSector: Record<string, unknown>) {
  return {
    name: goSector.name as string,
    change: goSector.change_pct as number || 0,
    changePercent: goSector.change_pct as number || 0,
    volume: goSector.volume as number || 0,
    leadingStock: goSector.top_stock as string || '',
    leadingStockChange: goSector.top_change as number || 0,
  };
}
