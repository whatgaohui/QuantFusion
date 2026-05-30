import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** GET /api/settings/llm — read LLM config from SystemConfig table */
export async function GET() {
  try {
    const keys = ['llm_provider', 'llm_api_key', 'llm_base_url', 'llm_model', 'llm_temperature', 'llm_max_tokens', 'llm_enabled'];
    const configs = await db.systemConfig.findMany({
      where: { key: { in: keys } },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json({
      provider: configMap.llm_provider || 'deepseek',
      apiKey: configMap.llm_api_key || '',
      baseUrl: configMap.llm_base_url || '',
      model: configMap.llm_model || 'deepseek-chat',
      temperature: parseFloat(configMap.llm_temperature || '0.7'),
      maxTokens: parseInt(configMap.llm_max_tokens || '4096', 10),
      enabled: configMap.llm_enabled !== 'false',
    });
  } catch (error) {
    console.error('[settings/llm] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load LLM settings' },
      { status: 500 },
    );
  }
}

/** POST /api/settings/llm — save LLM config to SystemConfig table */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, baseUrl, model, temperature, maxTokens, enabled } = body;

    const entries = [
      { key: 'llm_provider', value: provider || 'deepseek', category: 'llm', description: 'LLM provider name' },
      { key: 'llm_api_key', value: apiKey || '', category: 'llm', description: 'LLM API key' },
      { key: 'llm_base_url', value: baseUrl || '', category: 'llm', description: 'LLM API base URL' },
      { key: 'llm_model', value: model || 'deepseek-chat', category: 'llm', description: 'LLM model name' },
      { key: 'llm_temperature', value: String(temperature ?? 0.7), category: 'llm', description: 'LLM temperature' },
      { key: 'llm_max_tokens', value: String(maxTokens ?? 4096), category: 'llm', description: 'LLM max tokens' },
      { key: 'llm_enabled', value: String(enabled ?? true), category: 'llm', description: 'LLM enabled flag' },
    ];

    for (const entry of entries) {
      await db.systemConfig.upsert({
        where: { key: entry.key },
        update: { value: entry.value, category: entry.category, description: entry.description },
        create: { key: entry.key, value: entry.value, category: entry.category, description: entry.description },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[settings/llm] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save LLM settings' },
      { status: 500 },
    );
  }
}
