/**
 * 策略路由器
 * 基于市场状态 + 用户偏好推荐策略
 */

import type { StrategyConfig, MarketRegime } from './strategy-config';
import { BUILTIN_STRATEGIES } from './strategy-config';

/** 用户偏好接口 */
export interface UserPreference {
  /** 偏好策略分类 */
  preferredCategories?: string[];
  /** 风险偏好：conservative / moderate / aggressive */
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
}

/** 推荐结果 */
export interface RecommendedStrategy {
  /** 策略配置 */
  strategy: StrategyConfig;
  /** 匹配度 0-100 */
  matchScore: number;
  /** 推荐理由 */
  reason: string;
}

/** 市场状态中文描述 */
const REGIME_DESCRIPTIONS: Record<MarketRegime, string> = {
  trending_up: '上升趋势',
  trending_down: '下降趋势',
  range_bound: '横盘震荡',
  volatile: '高波动',
};

/** 市场状态对应的推荐策略分类优先级 */
const REGIME_CATEGORY_PRIORITY: Record<MarketRegime, string[]> = {
  trending_up: ['trend', 'momentum', 'volume', 'event'],
  trending_down: ['trend', 'reversal', 'event'],
  range_bound: ['pattern', 'reversal', 'volatility'],
  volatile: ['volatility', 'volume', 'event', 'trend'],
};

/** 风险偏好对应的止损上限 */
const RISK_STOP_LOSS_LIMIT: Record<string, number> = {
  conservative: 0.04,
  moderate: 0.06,
  aggressive: 0.10,
};

/**
 * 路由策略推荐
 * @param regime 市场状态
 * @param preference 用户偏好（可选）
 * @returns 推荐策略列表（按匹配度排序）
 */
export function routeStrategies(
  regime: MarketRegime,
  preference?: UserPreference
): RecommendedStrategy[] {
  const results: RecommendedStrategy[] = [];

  // 获取当前市场状态下的分类优先级
  const categoryPriority = REGIME_CATEGORY_PRIORITY[regime] || [];
  const riskLimit = RISK_STOP_LOSS_LIMIT[preference?.riskTolerance || 'moderate'];

  for (const strategy of BUILTIN_STRATEGIES) {
    let matchScore = 0;
    const reasons: string[] = [];

    // 1. 市场状态匹配度（核心，占60分）
    const regimeMatch = strategy.marketRegimes.includes(regime);
    if (regimeMatch) {
      matchScore += 60;
      reasons.push(`适用于${REGIME_DESCRIPTIONS[regime]}市场`);
    } else {
      matchScore += 10; // 不匹配也给少量分
    }

    // 2. 分类优先级匹配度（占20分）
    const categoryIndex = categoryPriority.indexOf(strategy.category);
    if (categoryIndex >= 0) {
      matchScore += 20 - categoryIndex * 5; // 排名越前分数越高
      reasons.push(`${strategy.category}类策略在此市场下优先推荐`);
    }

    // 3. 风险偏好匹配度（占10分）
    if (strategy.riskManagement.stopLossPct <= riskLimit) {
      matchScore += 10;
      reasons.push('止损比例符合您的风险偏好');
    } else {
      matchScore += 3;
    }

    // 4. 策略评分加成（占10分）
    matchScore += Math.round(strategy.rating * 2.5);

    // 5. 用户偏好分类加分
    if (preference?.preferredCategories?.includes(strategy.category)) {
      matchScore += 10;
      reasons.push('符合您偏好的策略类型');
    }

    // 确保分数在合理范围
    matchScore = Math.max(5, Math.min(98, matchScore));

    results.push({
      strategy,
      matchScore,
      reason: reasons.join('；'),
    });
  }

  // 按匹配度降序排序
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results;
}

/**
 * 获取当前市场状态描述
 */
export function getRegimeDescription(regime: MarketRegime): string {
  return REGIME_DESCRIPTIONS[regime] || '未知';
}

/**
 * 获取推荐策略ID列表
 */
export function getRecommendedStrategyIds(
  regime: MarketRegime,
  topN: number = 3,
  preference?: UserPreference
): string[] {
  return routeStrategies(regime, preference)
    .slice(0, topN)
    .map((r) => r.strategy.id);
}
