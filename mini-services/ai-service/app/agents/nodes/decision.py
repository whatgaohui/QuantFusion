from __future__ import annotations

"""
Final decision agent node.
Synthesizes all analysis into a final recommendation.
"""

import logging
from app.agents.state import AgentState
from app.llm.router import llm_deep_call

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一位资深投资决策顾问。你的任务是：
1. 综合技术分析、基本面分析、情绪分析、风险评估等所有分析结果
2. 权衡多空双方的观点（如有辩论结果）
3. 给出明确的投资建议：强烈买入/买入/持有/卖出/强烈卖出
4. 给出目标价位和止损建议
5. 列出关键假设和风险提示

请用中文回复，给出结构化的最终投资决策报告。格式如下：
## 投资建议
[建议]

## 目标价位
[目标价]

## 止损建议
[止损价]

## 关键支撑论据
[要点]

## 主要风险
[要点]

## 置信度
[高/中/低]"""


async def decision_agent(state: AgentState) -> dict:
    """Final decision agent node for LangGraph."""
    logger.info(f"[Decision Agent] Making final decision for {state.symbol}")

    # Gather all analysis
    context_parts = []
    if state.technical_analysis:
        context_parts.append(f"## 技术分析\n{state.technical_analysis[:800]}")
    if state.fundamental_analysis:
        context_parts.append(f"## 基本面分析\n{state.fundamental_analysis[:800]}")
    if state.sentiment_analysis:
        context_parts.append(f"## 情绪分析\n{state.sentiment_analysis[:800]}")
    if state.bull_thesis:
        context_parts.append(f"## 看多论据\n{state.bull_thesis[:600]}")
    if state.bear_thesis:
        context_parts.append(f"## 看空论据\n{state.bear_thesis[:600]}")
    if state.risk_assessment:
        context_parts.append(f"## 风险评估\n{state.risk_assessment[:600]}")

    context = "\n\n".join(context_parts)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请综合所有分析，对股票 {state.symbol} 给出最终投资决策。\n\n{context}"},
    ]

    try:
        result = await llm_deep_call(messages)
        analysis = result.get("content", "决策分析暂不可用")
    except Exception as e:
        logger.error(f"Decision agent error: {e}")
        analysis = f"决策分析调用失败: {str(e)}"

    return {
        "final_decision": analysis,
        "current_step": "final_decision",
        "progress": 100,
        "llm_calls": state.llm_calls + 1,
    }
