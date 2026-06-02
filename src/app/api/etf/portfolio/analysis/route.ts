import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_USER_ID } from '@/lib/auth-utils';

interface AllocationEntry {
  name: string;
  weight: number;
  value: number;
}

interface ConcentrationRisk {
  symbol: string;
  name: string;
  currentWeight: number;
  threshold: number;
}

/**
 * GET /api/etf/portfolio/analysis
 * Analyze the user's ETF portfolio.
 * - Gets all open positions where assetType = 'etf'
 * - Calculates allocation by sector, region, category
 * - Calculates portfolio-level metrics: weighted expense ratio, dividend yield, beta
 * - Detects concentration risks (any single ETF > 30% of portfolio)
 * Returns { positions, allocationBySector, allocationByRegion, allocationByCategory,
 *           weightedExpenseRatio, weightedDividendYield, portfolioBeta,
 *           concentrationRisks, totalValue }
 */
export async function GET() {
  try {
    // 1. Get all open ETF positions for the default user
    const positions = await db.position.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        status: 'open',
        assetType: 'etf',
      },
      orderBy: { openedAt: 'desc' },
    });

    if (positions.length === 0) {
      return NextResponse.json({
        positions: [],
        allocationBySector: [],
        allocationByRegion: [],
        allocationByCategory: [],
        weightedExpenseRatio: 0,
        weightedDividendYield: 0,
        portfolioBeta: 0,
        concentrationRisks: [],
        totalValue: 0,
      });
    }

    // 2. Calculate position values
    const positionValues = positions.map((p) => ({
      ...p,
      value: p.currentPrice * p.quantity,
    }));

    const totalValue = positionValues.reduce((sum, p) => sum + p.value, 0);

    if (totalValue === 0) {
      return NextResponse.json({
        positions: positionValues,
        allocationBySector: [],
        allocationByRegion: [],
        allocationByCategory: [],
        weightedExpenseRatio: 0,
        weightedDividendYield: 0,
        portfolioBeta: 0,
        concentrationRisks: [],
        totalValue: 0,
      });
    }

    // 3. Fetch ETF profiles for all position symbols
    const symbols = positionValues.map((p) => p.symbol);
    const etfProfiles = await db.eTFProfile.findMany({
      where: { symbol: { in: symbols } },
    });

    const profileMap = new Map(etfProfiles.map((p) => [p.symbol, p]));

    // 4. Calculate weights for each position
    const positionsWithWeight = positionValues.map((p) => ({
      ...p,
      weight: (p.value / totalValue) * 100,
      profile: profileMap.get(p.symbol) || null,
    }));

    // 5. Calculate allocation by sector
    const sectorMap = new Map<string, { value: number; weight: number }>();
    for (const pos of positionsWithWeight) {
      const profile = pos.profile;
      if (profile?.sectorWeights) {
        try {
          const sectors = JSON.parse(profile.sectorWeights) as Array<{
            sector: string;
            weight: number;
          }>;
          for (const sector of sectors) {
            const existing = sectorMap.get(sector.sector) || { value: 0, weight: 0 };
            existing.value += pos.value * (sector.weight / 100);
            existing.weight += pos.weight * (sector.weight / 100);
            sectorMap.set(sector.sector, existing);
          }
        } catch {
          // If JSON parse fails, skip sector allocation for this position
        }
      } else {
        // No sector data — put under "Unknown"
        const existing = sectorMap.get('Unknown') || { value: 0, weight: 0 };
        existing.value += pos.value;
        existing.weight += pos.weight;
        sectorMap.set('Unknown', existing);
      }
    }

    const allocationBySector: AllocationEntry[] = Array.from(sectorMap.entries())
      .map(([name, data]) => ({ name, weight: Math.round(data.weight * 100) / 100, value: Math.round(data.value * 100) / 100 }))
      .sort((a, b) => b.weight - a.weight);

    // 6. Calculate allocation by region
    const regionMap = new Map<string, { value: number; weight: number }>();
    for (const pos of positionsWithWeight) {
      const profile = pos.profile;
      if (profile?.regionWeights) {
        try {
          const regions = JSON.parse(profile.regionWeights) as Array<{
            region: string;
            weight: number;
          }>;
          for (const region of regions) {
            const existing = regionMap.get(region.region) || { value: 0, weight: 0 };
            existing.value += pos.value * (region.weight / 100);
            existing.weight += pos.weight * (region.weight / 100);
            regionMap.set(region.region, existing);
          }
        } catch {
          // If JSON parse fails, skip region allocation for this position
        }
      } else {
        const existing = regionMap.get('Unknown') || { value: 0, weight: 0 };
        existing.value += pos.value;
        existing.weight += pos.weight;
        regionMap.set('Unknown', existing);
      }
    }

    const allocationByRegion: AllocationEntry[] = Array.from(regionMap.entries())
      .map(([name, data]) => ({ name, weight: Math.round(data.weight * 100) / 100, value: Math.round(data.value * 100) / 100 }))
      .sort((a, b) => b.weight - a.weight);

    // 7. Calculate allocation by category
    const categoryMap = new Map<string, { value: number; weight: number }>();
    for (const pos of positionsWithWeight) {
      const profile = pos.profile;
      const category = profile?.category || 'Unknown';
      const existing = categoryMap.get(category) || { value: 0, weight: 0 };
      existing.value += pos.value;
      existing.weight += pos.weight;
      categoryMap.set(category, existing);
    }

    const allocationByCategory: AllocationEntry[] = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, weight: Math.round(data.weight * 100) / 100, value: Math.round(data.value * 100) / 100 }))
      .sort((a, b) => b.weight - a.weight);

    // 8. Calculate portfolio-level weighted metrics
    let weightedExpenseRatio = 0;
    let weightedDividendYield = 0;
    let portfolioBeta = 0;
    let expenseRatioCoverage = 0;
    let dividendYieldCoverage = 0;
    let betaCoverage = 0;

    for (const pos of positionsWithWeight) {
      const profile = pos.profile;
      const w = pos.weight / 100; // Convert percentage to decimal

      if (profile?.expenseRatio !== null && profile?.expenseRatio !== undefined) {
        weightedExpenseRatio += profile.expenseRatio * w;
        expenseRatioCoverage += w;
      }
      if (profile?.dividendYield !== null && profile?.dividendYield !== undefined) {
        weightedDividendYield += profile.dividendYield * w;
        dividendYieldCoverage += w;
      }
      if (profile?.beta !== null && profile?.beta !== undefined) {
        portfolioBeta += profile.beta * w;
        betaCoverage += w;
      }
    }

    // Normalize by coverage to avoid underestimation
    if (expenseRatioCoverage > 0 && expenseRatioCoverage < 1) {
      weightedExpenseRatio = weightedExpenseRatio / expenseRatioCoverage;
    }
    if (dividendYieldCoverage > 0 && dividendYieldCoverage < 1) {
      weightedDividendYield = weightedDividendYield / dividendYieldCoverage;
    }
    if (betaCoverage > 0 && betaCoverage < 1) {
      portfolioBeta = portfolioBeta / betaCoverage;
    }

    // 9. Detect concentration risks (>30% in any single ETF)
    const CONCENTRATION_THRESHOLD = 30;
    const concentrationRisks: ConcentrationRisk[] = positionsWithWeight
      .filter((pos) => pos.weight > CONCENTRATION_THRESHOLD)
      .map((pos) => ({
        symbol: pos.symbol,
        name: pos.profile?.name || pos.symbol,
        currentWeight: Math.round(pos.weight * 100) / 100,
        threshold: CONCENTRATION_THRESHOLD,
      }));

    // 10. Build response
    const responsePositions = positionsWithWeight.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      market: p.market,
      side: p.side,
      assetType: p.assetType,
      avgCost: p.avgCost,
      quantity: p.quantity,
      currentPrice: p.currentPrice,
      value: Math.round(p.value * 100) / 100,
      weight: Math.round(p.weight * 100) / 100,
      unrealizedPnl: p.unrealizedPnl,
      targetWeight: p.targetWeight,
      profile: p.profile
        ? {
            name: p.profile.name,
            category: p.profile.category,
            expenseRatio: p.profile.expenseRatio,
            dividendYield: p.profile.dividendYield,
            beta: p.profile.beta,
            trackingIndex: p.profile.trackingIndex,
          }
        : null,
    }));

    return NextResponse.json({
      positions: responsePositions,
      allocationBySector,
      allocationByRegion,
      allocationByCategory,
      weightedExpenseRatio: Math.round(weightedExpenseRatio * 100) / 100,
      weightedDividendYield: Math.round(weightedDividendYield * 100) / 100,
      portfolioBeta: Math.round(portfolioBeta * 100) / 100,
      concentrationRisks,
      totalValue: Math.round(totalValue * 100) / 100,
    });
  } catch (error) {
    console.error('ETF portfolio analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze ETF portfolio' },
      { status: 500 }
    );
  }
}
