import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateFinnhubCache } from '@/lib/finnhub-config';

/** GET /api/settings/data-sources — read data source config from SystemConfig */
export async function GET() {
  try {
    const keys = ['finnhub_api_key', 'finnhub_enabled', 'sina_enabled', 'cls_enabled'];
    const configs = await db.systemConfig.findMany({
      where: { key: { in: keys } },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json({
      finnhubApiKey: configMap.finnhub_api_key || '',
      finnhubEnabled: configMap.finnhub_enabled !== 'false',
      sinaEnabled: configMap.sina_enabled !== 'false',
      clsEnabled: configMap.cls_enabled !== 'false',
    });
  } catch (error) {
    console.error('[settings/data-sources] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load data source settings' },
      { status: 500 },
    );
  }
}

/** POST /api/settings/data-sources — save data source config to SystemConfig */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { finnhubApiKey, finnhubEnabled, sinaEnabled, clsEnabled } = body;

    const entries = [
      { key: 'finnhub_api_key', value: finnhubApiKey || '', category: 'data_source', description: 'Finnhub API key' },
      { key: 'finnhub_enabled', value: String(finnhubEnabled ?? true), category: 'data_source', description: 'Finnhub enabled flag' },
      { key: 'sina_enabled', value: String(sinaEnabled ?? true), category: 'data_source', description: 'Sina data source enabled flag' },
      { key: 'cls_enabled', value: String(clsEnabled ?? true), category: 'data_source', description: 'CLS data source enabled flag' },
    ];

    for (const entry of entries) {
      await db.systemConfig.upsert({
        where: { key: entry.key },
        update: { value: entry.value, category: entry.category, description: entry.description },
        create: { key: entry.key, value: entry.value, category: entry.category, description: entry.description },
      });
    }

    // Invalidate the Finnhub cache so the new key is picked up immediately
    invalidateFinnhubCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[settings/data-sources] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save data source settings' },
      { status: 500 },
    );
  }
}
