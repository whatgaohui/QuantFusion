import { NextRequest, NextResponse } from 'next/server';
import { BUILTIN_STRATEGIES, strategyConfigToApiFormat } from '@/lib/strategy-config';
import { db } from '@/lib/db';

/**
 * GET /api/fusion/strategies
 * 获取策略列表：内置策略 + 数据库中的自定义策略
 */
export async function GET() {
  try {
    // 1. 内置策略
    const builtinStrategies = BUILTIN_STRATEGIES.map(strategyConfigToApiFormat);

    // 2. 数据库中的自定义策略
    const dbStrategies = await db.strategy.findMany({
      where: { isBuiltin: false, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const customStrategies = dbStrategies.map((s) => {
      const config = parseStrategyConfig(s.config);
      return {
        id: s.id,
        name: s.name,
        displayName: s.name,
        type: s.type,
        description: s.description || '',
        parameters: config.parameters || [],
        entryCondition: config.entryCondition || '',
        exitCondition: config.exitCondition || '',
        marketRegimes: config.marketRegimes || [],
        rating: config.rating || 0,
        source: 'custom' as const,
      };
    });

    return NextResponse.json([...builtinStrategies, ...customStrategies]);
  } catch (error) {
    console.error('[fusion/strategies] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fusion/strategies
 * 创建自定义策略
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, description, entryConditions, exitConditions, parameters, marketRegimes } = body;

    if (!name || !entryConditions || entryConditions.length === 0) {
      return NextResponse.json(
        { error: 'Strategy name and entry conditions are required' },
        { status: 400 }
      );
    }

    // Serialize strategy config into JSON
    const config = {
      parameters: parameters || [],
      entryCondition: Array.isArray(entryConditions) ? entryConditions.join('；') : entryConditions,
      exitCondition: Array.isArray(exitConditions) ? exitConditions.join('；') : (exitConditions || ''),
      marketRegimes: marketRegimes || [],
      rating: 0,
    };

    const strategy = await db.strategy.create({
      data: {
        name,
        type: type || 'trend',
        description: description || '',
        config: JSON.stringify(config),
        isBuiltin: false,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: strategy.id,
      name: strategy.name,
      type: strategy.type,
      description: strategy.description,
      ...config,
      source: 'custom',
    }, { status: 201 });
  } catch (error) {
    console.error('[fusion/strategies] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create strategy' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fusion/strategies?id=xxx
 * 删除自定义策略
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    // Ensure it's not a builtin strategy
    const strategy = await db.strategy.findUnique({ where: { id } });
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }
    if (strategy.isBuiltin) {
      return NextResponse.json(
        { error: 'Cannot delete built-in strategies' },
        { status: 403 }
      );
    }

    await db.strategy.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('[fusion/strategies] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete strategy' },
      { status: 500 }
    );
  }
}

/** Parse the JSON config string from the database */
function parseStrategyConfig(configStr: string): {
  parameters?: { name: string; default: string; description: string }[];
  entryCondition?: string;
  exitCondition?: string;
  marketRegimes?: string[];
  rating?: number;
} {
  try {
    return JSON.parse(configStr);
  } catch {
    return {};
  }
}
