import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID } from '@/lib/auth-utils';

interface RebalanceSuggestion {
  symbol: string;
  name: string;
  action: 'buy' | 'sell' | 'hold';
  currentWeight: number;
  targetWeight: number;
  weightDiff: number;
  estimatedAmount: number;
}

/**
 * Default allocation based on modern portfolio theory principles.
 * A balanced portfolio across major asset classes.
 */
function getDefaultAllocation(symbols: string[]): Map<string, number> {
  const allocation = new Map<string, number>();

  // Define target allocations for common ETFs based on MPT
  const defaultTargets: Record<string, number> = {
    // US Broad Market / Large Cap
    SPY: 20, VOO: 20, VTI: 20, IVV: 20,
    // Tech
    QQQ: 15, VGT: 15, XLK: 15,
    // Small Cap
    IWM: 10,
    // International
    EFA: 10, VWO: 10,
    // Bonds
    AGG: 15, BND: 15, TLT: 10,
    // Commodities
    GLD: 5, SLV: 3,
    // Sector ETFs (smaller allocations)
    XLF: 5, IBB: 5, XLE: 5, XLY: 5,
    // Real Estate
    VNQ: 5,
  };

  // Assign target weights from defaults where available
  let assignedWeight = 0;
  const assigned: string[] = [];

  for (const symbol of symbols) {
    if (defaultTargets[symbol] !== undefined) {
      allocation.set(symbol, defaultTargets[symbol]);
      assignedWeight += defaultTargets[symbol];
      assigned.push(symbol);
    }
  }

  // For any symbols without default targets, distribute remaining weight equally
  const unassigned = symbols.filter((s) => !assigned.includes(s));
  if (unassigned.length > 0) {
    const remainingWeight = Math.max(0, 100 - assignedWeight);
    const perUnassigned = remainingWeight / unassigned.length;
    for (const symbol of unassigned) {
      allocation.set(symbol, perUnassigned);
    }
  }

  // Normalize to ensure total = 100%
  const total = Array.from(allocation.values()).reduce((sum, w) => sum + w, 0);
  if (total > 0 && Math.abs(total - 100) > 0.01) {
    const scale = 100 / total;
    for (const [key, val] of allocation) {
      allocation.set(key, val * scale);
    }
  }

  return allocation;
}

/**
 * GET /api/etf/portfolio/rebalance
 * Generate rebalancing suggestions for the user's ETF portfolio.
 * - Gets current ETF positions with targetWeight
 * - Calculates current weights vs target weights
 * - Generates buy/sell suggestions to bring portfolio back to target allocation
 * - If no target weights exist, suggests a default allocation based on MPT
 * Returns { suggestions, totalRebalanceAmount }
 */
export async function GET() {
  try {
    // 1. Get all open ETF positions
    const positions = await db.position.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        status: 'open',
        assetType: 'etf',
      },
    });

    if (positions.length === 0) {
      return NextResponse.json({
        suggestions: [],
        totalRebalanceAmount: 0,
        message: 'No ETF positions found. Add ETF positions to get rebalancing suggestions.',
      });
    }

    // 2. Calculate current values and total portfolio value
    const positionValues = positions.map((p) => ({
      ...p,
      value: p.currentPrice * p.quantity,
    }));

    const totalValue = positionValues.reduce((sum, p) => sum + p.value, 0);

    if (totalValue === 0) {
      return NextResponse.json({
        suggestions: [],
        totalRebalanceAmount: 0,
        message: 'Portfolio has zero value. Cannot calculate rebalancing.',
      });
    }

    // 3. Calculate current weights
    const currentWeights = new Map<string, number>();
    for (const pos of positionValues) {
      currentWeights.set(pos.symbol, (pos.value / totalValue) * 100);
    }

    // 4. Determine target weights
    const symbols = positionValues.map((p) => p.symbol);
    const hasAnyTargetWeight = positionValues.some((p) => p.targetWeight !== null && p.targetWeight !== undefined && p.targetWeight > 0);

    let targetWeights: Map<string, number>;

    if (hasAnyTargetWeight) {
      // Use user-defined target weights from positions
      targetWeights = new Map();
      let totalTarget = 0;

      for (const pos of positionValues) {
        if (pos.targetWeight !== null && pos.targetWeight !== undefined && pos.targetWeight > 0) {
          targetWeights.set(pos.symbol, pos.targetWeight);
          totalTarget += pos.targetWeight;
        }
      }

      // For positions without target weights, distribute remaining weight equally
      const positionsWithoutTarget = positions.filter(
        (p) => p.targetWeight === null || p.targetWeight === undefined || p.targetWeight <= 0
      );
      if (positionsWithoutTarget.length > 0) {
        const remaining = Math.max(0, 100 - totalTarget);
        const perPosition = remaining / positionsWithoutTarget.length;
        for (const pos of positionsWithoutTarget) {
          targetWeights.set(pos.symbol, perPosition);
        }
      }

      // Normalize
      const sum = Array.from(targetWeights.values()).reduce((a, b) => a + b, 0);
      if (sum > 0 && Math.abs(sum - 100) > 0.01) {
        const scale = 100 / sum;
        for (const [key, val] of targetWeights) {
          targetWeights.set(key, val * scale);
        }
      }
    } else {
      // No target weights set — use default MPT-based allocation
      targetWeights = getDefaultAllocation(symbols);
    }

    // 5. Fetch ETF profile names
    const etfProfiles = await db.eTFProfile.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, name: true },
    });
    const nameMap = new Map(etfProfiles.map((p) => [p.symbol, p.name]));

    // 6. Generate rebalancing suggestions
    const suggestions: RebalanceSuggestion[] = [];
    let totalRebalanceAmount = 0;
    const REBALANCE_THRESHOLD = 1; // Only suggest if weight difference > 1%

    for (const pos of positionValues) {
      const currentWeight = currentWeights.get(pos.symbol) || 0;
      const targetWeight = targetWeights.get(pos.symbol) || 0;
      const weightDiff = targetWeight - currentWeight;
      const estimatedAmount = (weightDiff / 100) * totalValue;

      let action: 'buy' | 'sell' | 'hold';
      if (Math.abs(weightDiff) <= REBALANCE_THRESHOLD) {
        action = 'hold';
      } else if (weightDiff > 0) {
        action = 'buy';
      } else {
        action = 'sell';
      }

      suggestions.push({
        symbol: pos.symbol,
        name: nameMap.get(pos.symbol) || pos.symbol,
        action,
        currentWeight: Math.round(currentWeight * 100) / 100,
        targetWeight: Math.round(targetWeight * 100) / 100,
        weightDiff: Math.round(weightDiff * 100) / 100,
        estimatedAmount: Math.round(estimatedAmount * 100) / 100,
      });

      if (action !== 'hold') {
        totalRebalanceAmount += Math.abs(estimatedAmount);
      }
    }

    // Sort: sell first (reduce overweight), then buy (add underweight), then hold
    const actionOrder = { sell: 0, buy: 1, hold: 2 };
    suggestions.sort((a, b) => {
      const orderDiff = actionOrder[a.action] - actionOrder[b.action];
      if (orderDiff !== 0) return orderDiff;
      return Math.abs(b.weightDiff) - Math.abs(a.weightDiff);
    });

    return NextResponse.json({
      suggestions,
      totalRebalanceAmount: Math.round(totalRebalanceAmount * 100) / 100,
    });
  } catch (error) {
    console.error('ETF portfolio rebalance error:', error);
    return NextResponse.json(
      { error: 'Failed to generate rebalancing suggestions' },
      { status: 500 }
    );
  }
}
