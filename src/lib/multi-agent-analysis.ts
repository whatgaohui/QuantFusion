import ZAI from 'z-ai-web-dev-sdk';
import { getZAI } from '@/lib/ai-service';

// ==================== Timeout Helper ====================
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// ==================== Analysis State ====================
export interface AnalysisState {
  symbol: string;
  stockName: string;
  marketData: Record<string, unknown>;
  technicalReport?: string;
  fundamentalReport?: string;
  sentimentReport?: string;
  bullThesis?: string;
  bearThesis?: string;
  debateHistory?: string;
  investmentPlan?: string;
  aggressiveArgument?: string;
  conservativeArgument?: string;
  neutralArgument?: string;
  riskDebateHistory?: string;
  finalDecision?: string;
  currentStep: string;
  progress: number;
  llmCalls: number;
  errors: string[];
}

// ==================== Agent System Prompts (All in Chinese) ====================

const MARKET_ANALYST_SYSTEM = `你是一位资深技术分析专家，擅长通过价格走势、技术指标来研判市场趋势。

你的分析框架：
1. **趋势判断** - 基于均线系统（MA5/MA10/MA20/MA60）判断短期和中期趋势
2. **动量分析** - 通过MACD（DIF/DEA/柱状体）、RSI判断买卖动能
3. **波动分析** - 布林带宽度、KDJ超买超卖状态
4. **量价关系** - 成交量变化与价格走势的配合程度
5. **关键位置** - 支撑位和阻力位的识别

输出要求：
- 使用专业但易懂的中文
- 给出明确的技术面判断（看多/看空/中性）
- 标注关键技术位和止损位
- 总结技术面对后市的影响`;

const FUNDAMENTAL_ANALYST_SYSTEM = `你是一位基本面分析专家，擅长通过财务数据、估值模型来评估股票内在价值。

你的分析框架：
1. **估值评估** - PE/PB/PS等相对估值指标，与行业和历史水平对比
2. **成长性** - 营收增速、利润增速、ROE变化趋势
3. **财务健康** - 现金流、负债率、毛利率稳定性
4. **行业地位** - 市场份额、竞争壁垒、行业景气度
5. **分红与回购** - 股息率、回购计划、股东回报

输出要求：
- 使用专业但易懂的中文
- 给出明确的基本面判断（被低估/合理/被高估）
- 标注核心财务指标和估值数据
- 说明基本面因素对股价的支撑或压力`;

const SENTIMENT_ANALYST_SYSTEM = `你是一位市场情绪分析专家，擅长通过资金流向、市场氛围来判断情绪周期。

你的分析框架：
1. **资金流向** - 北向资金/主力资金净流入流出，大单成交占比
2. **市场情绪** - 市场恐慌贪婪指数、融资融券变化
3. **机构行为** - 机构调研频率、分析师评级变化
4. **新闻舆情** - 新闻正面/负面比例、社交媒体热度
5. **板块轮动** - 所属板块资金流向、板块相对强弱

输出要求：
- 使用专业但易懂的中文
- 给出明确的情绪判断（偏多/中性/偏空）
- 标注关键情绪指标和资金数据
- 说明情绪面对短期走势的影响`;

const BULL_RESEARCHER_SYSTEM = `你是一位看涨研究员，你的任务是从多头角度论证买入该股票的理由。

你需要：
1. 从技术面找到看多信号和支撑位
2. 从基本面挖掘增长潜力和价值低估
3. 从情绪面捕捉积极因素和资金流入
4. 对空头观点进行有理有据的反驳
5. 提出具体的买入策略和目标价位

输出要求：
- 论点要有数据支撑，逻辑严密
- 承认风险但不放大风险
- 用有力的论证说服对手
- 保持专业客观，避免过度乐观`;

const BEAR_RESEARCHER_SYSTEM = `你是一位看跌研究员，你的任务是从空头角度论证卖出或规避该股票的理由。

你需要：
1. 从技术面找到看空信号和阻力位
2. 从基本面揭示估值泡沫和增长隐忧
3. 从情绪面发现消极因素和资金流出
4. 对多头观点进行有理有据的反驳
5. 提出具体的风险控制建议

输出要求：
- 论点要有数据支撑，逻辑严密
- 承认机会但不夸大机会
- 用有力的论证说服对手
- 保持专业客观，避免过度悲观`;

const RESEARCH_MANAGER_SYSTEM = `你是一位研究经理，负责评估多空辩论双方的观点，给出最终投资建议。

你需要：
1. 客观评估多空双方论点的合理性
2. 权衡各方论据的权重和可靠性
3. 考虑当前市场环境下的适用性
4. 给出明确的投资建议和操作策略
5. 设定风险控制措施

输出格式（必须包含以下部分）：
- **多空评估**: 简要评价多空双方的核心论点
- **投资建议**: 明确的 BUY / HOLD / SELL 判断
- **评分**: 0-100分，反映看多程度
- **操作策略**: 具体的入场点位、仓位建议、止损止盈设置
- **风险提示**: 需要密切关注的风险因素`;

const AGGRESSIVE_ANALYST_SYSTEM = `你是一位激进风险分析师，主张高风险高回报的投资策略。

你的观点倾向：
1. 倾向于重仓操作，追求最大收益
2. 认为市场波动是机会而非风险
3. 建议利用杠杆和衍生品放大收益
4. 看重短期趋势和动量信号
5. 对止损设置较宽松

输出要求：
- 论证为什么要承担更大风险
- 说明高收益的潜在空间
- 反驳保守派的过度谨慎
- 给出激进策略的具体执行方案`;

const CONSERVATIVE_ANALYST_SYSTEM = `你是一位保守风险分析师，主张稳健安全的投资策略。

你的观点倾向：
1. 倾向于轻仓操作，安全第一
2. 认为保本比追求收益更重要
3. 建议分散投资降低集中风险
4. 看重长期价值和基本面安全边际
5. 对止损设置较严格

输出要求：
- 论证为什么要控制风险敞口
- 说明当前市场的不确定性
- 反驳激进派的冒进行为
- 给出保守策略的具体执行方案`;

const NEUTRAL_ANALYST_SYSTEM = `你是一位中性风险分析师，主张平衡风险和收益的投资策略。

你的观点倾向：
1. 倾向于中等仓位，攻守兼备
2. 认为风险和收益需要合理平衡
3. 建议根据市场信号灵活调整仓位
4. 同时关注趋势和估值
5. 设定合理的止损止盈

输出要求：
- 论证平衡策略的合理性
- 指出激进和保守策略各自的盲点
- 给出平衡策略的具体执行方案
- 根据不同情景给出应对方案`;

const RISK_MANAGER_SYSTEM = `你是一位风险管理经理，负责评估风险辩论各方观点，做出最终风险决策。

你需要：
1. 评估激进、保守、中性三方策略的优劣
2. 考虑当前市场环境的风险收益比
3. 综合投资建议和风险控制要求
4. 做出最终的风险决策

输出格式（必须包含以下部分）：
- **风险评级**: LOW / MEDIUM / HIGH
- **风险评分**: 0-100（越高越危险）
- **最终建议**: BUY / HOLD / SELL
- **最终评分**: 0-100
- **仓位建议**: 具体仓位百分比
- **止损止盈**: 具体价格或百分比
- **风险警示**: 需重点关注的风险因素
- **综合总结**: 整体分析的最终结论（3-5句话）`;

// ==================== Agent Functions ====================

async function callLLM(zai: ZAI, systemPrompt: string, userPrompt: string, timeoutMs = 30000): Promise<string> {
  const completion = await withTimeout(
    zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      thinking: { type: 'disabled' }
    }),
    timeoutMs
  );
  return completion.choices[0]?.message?.content || '';
}

function buildMarketContext(state: AnalysisState): string {
  const md = state.marketData;
  return `
股票: ${state.stockName} (${state.symbol})
当前价格: ${md.currentPrice ?? md.price ?? 'N/A'}
涨跌幅: ${md.changePercent != null ? `${Number(md.changePercent).toFixed(2)}%` : 'N/A'}
成交量: ${md.volume ?? 'N/A'}
${md.indicators ? `技术指标: ${JSON.stringify(md.indicators, null, 2)}` : ''}
${md.kline ? `最近5日收盘价: ${(md.kline as {c:number[]}).c?.slice(-5).join(', ') || 'N/A'}` : ''}
  `.trim();
}

async function runMarketAnalyst(state: AnalysisState, zai: ZAI): Promise<AnalysisState> {
  try {
    const context = buildMarketContext(state);
    const report = await callLLM(zai, MARKET_ANALYST_SYSTEM,
      `请基于以下市场数据对 ${state.stockName}(${state.symbol}) 进行技术分析:\n\n${context}`,
      30000
    );
    return { ...state, technicalReport: report, llmCalls: state.llmCalls + 1 };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '技术分析失败';
    return { ...state, technicalReport: '技术分析暂时不可用，请参考其他分析维度。', errors: [...state.errors, `技术分析师: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runFundamentalAnalyst(state: AnalysisState, zai: ZAI): Promise<AnalysisState> {
  try {
    const context = buildMarketContext(state);
    const report = await callLLM(zai, FUNDAMENTAL_ANALYST_SYSTEM,
      `请基于以下数据对 ${state.stockName}(${state.symbol}) 进行基本面分析:\n\n${context}`,
      30000
    );
    return { ...state, fundamentalReport: report, llmCalls: state.llmCalls + 1 };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '基本面分析失败';
    return { ...state, fundamentalReport: '基本面分析暂时不可用，请参考其他分析维度。', errors: [...state.errors, `基本面分析师: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runSentimentAnalyst(state: AnalysisState, zai: ZAI): Promise<AnalysisState> {
  try {
    const context = buildMarketContext(state);
    const report = await callLLM(zai, SENTIMENT_ANALYST_SYSTEM,
      `请基于以下数据对 ${state.stockName}(${state.symbol}) 进行市场情绪分析:\n\n${context}`,
      30000
    );
    return { ...state, sentimentReport: report, llmCalls: state.llmCalls + 1 };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '情绪分析失败';
    return { ...state, sentimentReport: '情绪分析暂时不可用，请参考其他分析维度。', errors: [...state.errors, `情绪分析师: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runBullResearcher(state: AnalysisState, zai: ZAI, round: number, previousBearThesis?: string): Promise<AnalysisState> {
  try {
    const analystContext = `
=== 技术分析报告 ===
${state.technicalReport || '暂无'}

=== 基本面分析报告 ===
${state.fundamentalReport || '暂无'}

=== 情绪分析报告 ===
${state.sentimentReport || '暂无'}
${previousBearThesis ? `\n=== 空头研究员的反驳（请对此进行回应）===\n${previousBearThesis}` : ''}
    `.trim();

    const prompt = round === 1
      ? `你是第${round}轮辩论的多头方。请基于以下分析师报告，从多头角度论证买入 ${state.stockName}(${state.symbol}) 的理由:\n\n${analystContext}`
      : `你是第${round}轮辩论的多头方。空头研究员提出了以下反驳，请回应并加强你的多头论点:\n\n${analystContext}`;

    const thesis = await callLLM(zai, BULL_RESEARCHER_SYSTEM, prompt, 30000);
    return {
      ...state,
      bullThesis: thesis,
      debateHistory: (state.debateHistory || '') + `\n\n--- 第${round}轮 多头论点 ---\n${thesis}`,
      llmCalls: state.llmCalls + 1
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '多头研究失败';
    return { ...state, bullThesis: '多头研究暂时不可用。', errors: [...state.errors, `多头研究员: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runBearResearcher(state: AnalysisState, zai: ZAI, round: number, previousBullThesis?: string): Promise<AnalysisState> {
  try {
    const analystContext = `
=== 技术分析报告 ===
${state.technicalReport || '暂无'}

=== 基本面分析报告 ===
${state.fundamentalReport || '暂无'}

=== 情绪分析报告 ===
${state.sentimentReport || '暂无'}
${previousBullThesis ? `\n=== 多头研究员的论点（请对此进行反驳）===\n${previousBullThesis}` : ''}
    `.trim();

    const prompt = round === 1
      ? `你是第${round}轮辩论的空头方。请基于以下分析师报告，从空头角度论证卖出或规避 ${state.stockName}(${state.symbol}) 的理由:\n\n${analystContext}`
      : `你是第${round}轮辩论的空头方。多头研究员提出了以下论点，请反驳并加强你的空头论点:\n\n${analystContext}`;

    const thesis = await callLLM(zai, BEAR_RESEARCHER_SYSTEM, prompt, 30000);
    return {
      ...state,
      bearThesis: thesis,
      debateHistory: (state.debateHistory || '') + `\n\n--- 第${round}轮 空头论点 ---\n${thesis}`,
      llmCalls: state.llmCalls + 1
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '空头研究失败';
    return { ...state, bearThesis: '空头研究暂时不可用。', errors: [...state.errors, `空头研究员: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runResearchManager(state: AnalysisState, zai: ZAI): Promise<AnalysisState> {
  try {
    const debateContext = `
=== 技术分析报告 ===
${state.technicalReport || '暂无'}

=== 基本面分析报告 ===
${state.fundamentalReport || '暂无'}

=== 情绪分析报告 ===
${state.sentimentReport || '暂无'}

=== 多空辩论记录 ===
${state.debateHistory || '暂无辩论记录'}
    `.trim();

    const plan = await callLLM(zai, RESEARCH_MANAGER_SYSTEM,
      `作为研究经理，请评估以上多空辩论，为 ${state.stockName}(${state.symbol}) 给出投资建议:\n\n${debateContext}`,
      35000
    );
    return { ...state, investmentPlan: plan, llmCalls: state.llmCalls + 1 };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '研究经理分析失败';
    return { ...state, investmentPlan: '投资建议生成暂时不可用。', errors: [...state.errors, `研究经理: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runAggressiveAnalyst(state: AnalysisState, zai: ZAI, previousArgs?: string): Promise<AnalysisState> {
  try {
    const context = `
=== 投资建议 ===
${state.investmentPlan || '暂无'}
${previousArgs ? `\n=== 其他风险分析师观点（请回应）===\n${previousArgs}` : ''}
    `.trim();

    const arg = await callLLM(zai, AGGRESSIVE_ANALYST_SYSTEM,
      `请从激进风险角度，为 ${state.stockName}(${state.symbol}) 提出高风险高回报的投资策略:\n\n${context}`,
      30000
    );
    return {
      ...state,
      aggressiveArgument: arg,
      riskDebateHistory: (state.riskDebateHistory || '') + `\n\n--- 激进风险分析师 ---\n${arg}`,
      llmCalls: state.llmCalls + 1
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '激进分析失败';
    return { ...state, aggressiveArgument: '激进风险分析暂时不可用。', errors: [...state.errors, `激进分析师: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runConservativeAnalyst(state: AnalysisState, zai: ZAI, previousArgs?: string): Promise<AnalysisState> {
  try {
    const context = `
=== 投资建议 ===
${state.investmentPlan || '暂无'}
${previousArgs ? `\n=== 其他风险分析师观点（请回应）===\n${previousArgs}` : ''}
    `.trim();

    const arg = await callLLM(zai, CONSERVATIVE_ANALYST_SYSTEM,
      `请从保守风险角度，为 ${state.stockName}(${state.symbol}) 提出稳健安全的投资策略:\n\n${context}`,
      30000
    );
    return {
      ...state,
      conservativeArgument: arg,
      riskDebateHistory: (state.riskDebateHistory || '') + `\n\n--- 保守风险分析师 ---\n${arg}`,
      llmCalls: state.llmCalls + 1
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '保守分析失败';
    return { ...state, conservativeArgument: '保守风险分析暂时不可用。', errors: [...state.errors, `保守分析师: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runNeutralAnalyst(state: AnalysisState, zai: ZAI, previousArgs?: string): Promise<AnalysisState> {
  try {
    const context = `
=== 投资建议 ===
${state.investmentPlan || '暂无'}
${previousArgs ? `\n=== 其他风险分析师观点（请回应）===\n${previousArgs}` : ''}
    `.trim();

    const arg = await callLLM(zai, NEUTRAL_ANALYST_SYSTEM,
      `请从中性风险角度，为 ${state.stockName}(${state.symbol}) 提出平衡风险收益的投资策略:\n\n${context}`,
      30000
    );
    return {
      ...state,
      neutralArgument: arg,
      riskDebateHistory: (state.riskDebateHistory || '') + `\n\n--- 中性风险分析师 ---\n${arg}`,
      llmCalls: state.llmCalls + 1
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '中性分析失败';
    return { ...state, neutralArgument: '中性风险分析暂时不可用。', errors: [...state.errors, `中性分析师: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

async function runRiskManager(state: AnalysisState, zai: ZAI): Promise<AnalysisState> {
  try {
    const riskContext = `
=== 投资建议 ===
${state.investmentPlan || '暂无'}

=== 风险辩论记录 ===
${state.riskDebateHistory || '暂无辩论记录'}
    `.trim();

    const decision = await callLLM(zai, RISK_MANAGER_SYSTEM,
      `作为风险管理经理，请评估以上风险辩论，为 ${state.stockName}(${state.symbol}) 做出最终风险决策:\n\n${riskContext}`,
      35000
    );
    return { ...state, finalDecision: decision, llmCalls: state.llmCalls + 1 };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '风险管理决策失败';
    return { ...state, finalDecision: '风险管理决策暂时不可用。', errors: [...state.errors, `风险管理经理: ${errMsg}`], llmCalls: state.llmCalls + 1 };
  }
}

// ==================== Main Analysis Pipeline ====================

export type AnalysisMode = 'quick' | 'standard' | 'full' | 'debate';

export async function runMultiAgentAnalysis(
  symbol: string,
  stockName: string,
  marketData: Record<string, unknown>,
  mode: AnalysisMode,
  onProgress?: (step: string, progress: number, agentName: string) => void
): Promise<AnalysisState> {
  const zai = await getZAI();

  let state: AnalysisState = {
    symbol,
    stockName,
    marketData,
    currentStep: 'initializing',
    progress: 0,
    llmCalls: 0,
    errors: [],
  };

  const progress = (step: string, pct: number, agent: string) => {
    state = { ...state, currentStep: step, progress: pct };
    onProgress?.(step, pct, agent);
  };

  try {
    switch (mode) {
      case 'quick': {
        // Market Analyst → Decision (2 steps)
        progress('技术分析', 10, '技术分析师');
        state = await runMarketAnalyst(state, zai);
        progress('生成决策', 80, '决策引擎');
        state = await runResearchManager(state, zai);
        progress('分析完成', 100, '系统');
        break;
      }

      case 'standard': {
        // Market → Sentiment → Decision (3 steps)
        progress('技术分析', 8, '技术分析师');
        state = await runMarketAnalyst(state, zai);
        progress('情绪分析', 35, '情绪分析师');
        state = await runSentimentAnalyst(state, zai);
        progress('生成投资建议', 80, '研究经理');
        state = await runResearchManager(state, zai);
        progress('分析完成', 100, '系统');
        break;
      }

      case 'full': {
        // Market → Fundamental → Sentiment → Risk Assessment → Decision (5 steps)
        progress('技术分析', 6, '技术分析师');
        state = await runMarketAnalyst(state, zai);
        progress('基本面分析', 22, '基本面分析师');
        state = await runFundamentalAnalyst(state, zai);
        progress('情绪分析', 40, '情绪分析师');
        state = await runSentimentAnalyst(state, zai);

        // For full mode, do a brief bull-bear debate
        progress('多头研究', 55, '多头研究员');
        state = await runBullResearcher(state, zai, 1);
        progress('空头研究', 68, '空头研究员');
        state = await runBearResearcher(state, zai, 1, state.bullThesis);

        progress('生成投资建议', 85, '研究经理');
        state = await runResearchManager(state, zai);
        progress('分析完成', 100, '系统');
        break;
      }

      case 'debate': {
        // Full multi-agent debate pipeline
        // Phase 1: Analyst reports
        progress('技术分析', 4, '技术分析师');
        state = await runMarketAnalyst(state, zai);
        progress('基本面分析', 10, '基本面分析师');
        state = await runFundamentalAnalyst(state, zai);
        progress('情绪分析', 16, '情绪分析师');
        state = await runSentimentAnalyst(state, zai);

        // Phase 2: Investment Debate (2 rounds)
        const debateRounds = 2;
        for (let round = 1; round <= debateRounds; round++) {
          progress(`多空辩论 第${round}轮 - 多头`, 22 + (round - 1) * 14, '多头研究员');
          state = await runBullResearcher(state, zai, round, round > 1 ? state.bearThesis : undefined);
          progress(`多空辩论 第${round}轮 - 空头`, 28 + (round - 1) * 14, '空头研究员');
          state = await runBearResearcher(state, zai, round, state.bullThesis);
        }

        // Research Manager adjudicates
        progress('研究经理评估', 52, '研究经理');
        state = await runResearchManager(state, zai);

        // Phase 3: Risk Debate (2 rounds with 3 analysts)
        const riskDebateRounds = 2;
        for (let round = 1; round <= riskDebateRounds; round++) {
          progress(`风险辩论 第${round}轮 - 激进`, 58 + (round - 1) * 14, '激进风险分析师');
          state = await runAggressiveAnalyst(state, zai, round > 1 ? [state.conservativeArgument, state.neutralArgument].filter(Boolean).join('\n') : undefined);
          progress(`风险辩论 第${round}轮 - 保守`, 63 + (round - 1) * 14, '保守风险分析师');
          state = await runConservativeAnalyst(state, zai, [state.aggressiveArgument].filter(Boolean).join('\n'));
          progress(`风险辩论 第${round}轮 - 中性`, 68 + (round - 1) * 14, '中性风险分析师');
          state = await runNeutralAnalyst(state, zai, [state.aggressiveArgument, state.conservativeArgument].filter(Boolean).join('\n'));
        }

        // Risk Manager final decision
        progress('风险管理决策', 92, '风险管理经理');
        state = await runRiskManager(state, zai);
        progress('分析完成', 100, '系统');
        break;
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '分析过程发生未知错误';
    state = { ...state, errors: [...state.errors, `系统: ${errMsg}`] };
    // If we have partial results, still try to generate a decision
    if (!state.finalDecision && !state.investmentPlan) {
      try {
        progress('降级处理', 90, '系统');
        state = await runResearchManager(state, zai);
      } catch {
        state = { ...state, investmentPlan: '分析过程中出现异常，无法生成投资建议。' };
      }
    }
    progress('分析完成（部分）', 100, '系统');
  }

  return state;
}

// ==================== Task Store for Background Analysis ====================

export interface AnalysisTask {
  id: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  currentAgent: string;
  result?: AnalysisState;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// In-memory task store using globalThis to persist across Next.js route handler instances
const MAX_TASKS = 100;

const globalForStore = globalThis as Record<string, unknown>;
if (!globalForStore.__analysisTaskStore) {
  globalForStore.__analysisTaskStore = new Map<string, AnalysisTask>();
}
const taskStore = globalForStore.__analysisTaskStore as Map<string, AnalysisTask>;

export function createTask(id: string): AnalysisTask {
  // Evict oldest if at capacity
  if (taskStore.size >= MAX_TASKS) {
    const firstKey = taskStore.keys().next().value;
    if (firstKey) taskStore.delete(firstKey);
  }

  const task: AnalysisTask = {
    id,
    status: 'running',
    progress: 0,
    currentStep: '初始化',
    currentAgent: '系统',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  taskStore.set(id, task);
  return task;
}

export function getTask(id: string): AnalysisTask | undefined {
  return taskStore.get(id);
}

export function updateTask(id: string, updates: Partial<AnalysisTask>): void {
  const task = taskStore.get(id);
  if (task) {
    Object.assign(task, updates, { updatedAt: Date.now() });
    taskStore.set(id, task);
  }
}

// ==================== Parse Analysis State to Frontend Format ====================

export function parseAnalysisResult(state: AnalysisState): {
  technical_summary: string;
  fundamental_summary: string;
  sentiment_summary: string;
  risk_assessment: string;
  bull_thesis: string;
  bear_thesis: string;
  debate_history: string;
  investment_plan: string;
  aggressive_argument: string;
  conservative_argument: string;
  neutral_argument: string;
  risk_debate_history: string;
  final_decision: string;
  recommendation: string;
  score: number;
  confidence: string;
  risk_level: string;
  risk_score: number;
  llm_calls: number;
  errors: string[];
  source: string;
} {
  // Extract recommendation from final decision or investment plan
  const decisionText = state.finalDecision || state.investmentPlan || '';
  let recommendation = 'HOLD';
  let score = 50;
  let confidence = 'medium';
  let riskLevel = 'MEDIUM';
  let riskScore = 50;

  // Try to extract recommendation from text
  const recMatch = decisionText.match(/(?:投资建议|最终建议|建议)[：:]*\s*\*{0,2}\s*(BUY|HOLD|SELL|买入|持有|卖出)/i);
  if (recMatch) {
    const rec = recMatch[1].toUpperCase();
    if (rec === 'BUY' || rec === '买入') recommendation = 'BUY';
    else if (rec === 'SELL' || rec === '卖出') recommendation = 'SELL';
    else recommendation = 'HOLD';
  }

  // Try to extract score - handles various formats like "65分", "评分: 65", "**65**分"
  const scoreMatch = decisionText.match(/(?:评分|综合评分|最终评分)[：:]*\s*\*{0,2}\s*(\d{1,3})\s*\*{0,2}\s*分?/);
  if (scoreMatch) {
    score = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)));
  }

  // Try to extract risk level
  const riskMatch = decisionText.match(/(?:风险评级|风险等级)[：:]\s*(LOW|MEDIUM|HIGH|低|中|高)/i);
  if (riskMatch) {
    const r = riskMatch[1].toUpperCase();
    if (r === 'LOW' || r === '低') riskLevel = 'LOW';
    else if (r === 'HIGH' || r === '高') riskLevel = 'HIGH';
    else riskLevel = 'MEDIUM';
  }

  // Try to extract risk score
  const riskScoreMatch = decisionText.match(/(?:风险评分)[：:]\s*(\d{1,3})/);
  if (riskScoreMatch) {
    riskScore = Math.min(100, Math.max(0, parseInt(riskScoreMatch[1], 10)));
  } else {
    riskScore = 100 - score;
  }

  // Determine confidence based on LLM calls
  if (state.llmCalls >= 8) confidence = 'high';
  else if (state.llmCalls >= 3) confidence = 'medium';
  else confidence = 'low';

  return {
    technical_summary: state.technicalReport || '',
    fundamental_summary: state.fundamentalReport || '',
    sentiment_summary: state.sentimentReport || '',
    risk_assessment: state.investmentPlan || '',
    bull_thesis: state.bullThesis || '',
    bear_thesis: state.bearThesis || '',
    debate_history: state.debateHistory || '',
    investment_plan: state.investmentPlan || '',
    aggressive_argument: state.aggressiveArgument || '',
    conservative_argument: state.conservativeArgument || '',
    neutral_argument: state.neutralArgument || '',
    risk_debate_history: state.riskDebateHistory || '',
    final_decision: state.finalDecision || state.investmentPlan || '',
    recommendation,
    score,
    confidence,
    risk_level: riskLevel,
    risk_score: riskScore,
    llm_calls: state.llmCalls,
    errors: state.errors,
    source: state.errors.length === 0 ? 'ai-multi-agent' : 'ai-partial',
  };
}
