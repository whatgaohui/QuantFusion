from __future__ import annotations

"""
Risk management agent node.
Assesses risks and provides risk management recommendations.
"""

import logging
from app.agents.state import AgentState
from app.llm.router import llm_deep_call

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一位专业的风险管理分析师。你的任务是：
1. 评估投资该股票的主要风险因素
2. 分析下行风险和最大可能亏损
3. 评估流动性和波动性风险
4. 给出风险等级（低/中/高）
5. 提出风险对冲建议和止损策略

请用中文回复，给出结构化的风险评估报告。"""


async def risk_agent(state: AgentState) -> dict:
    """Risk management agent node for LangGraph."""
    logger.info(f"[Risk Agent] Assessing risks for {state.symbol}")

    # Gather all available analysis
    context_parts = []
    if state.technical_analysis:
        context_parts.append(f"技术分析：\n{state.technical_analysis[:600]}")
    if state.fundamental_analysis:
        context_parts.append(f"基本面分析：\n{state.fundamental_analysis[:600]}")
    if state.sentiment_analysis:
        context_parts.append(f"情绪分析：\n{state.sentiment_analysis[:600]}")
    if state.bull_thesis:
        context_parts.append(f"看多论据：\n{state.bull_thesis[:400]}")
    if state.bear_thesis:
        context_parts.append(f"看空论据：\n{state.bear_thesis[:400]}")

    context = "\n\n".join(context_parts)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请对股票 {state.symbol} 进行风险评估。\n\n已有分析：\n{context}"},
    ]

    try:
        result = await llm_deep_call(messages)
        analysis = result.get("content", "风险评估暂不可用")
    except Exception as e:
        logger.error(f"Risk agent error: {e}")
        analysis = f"风险评估调用失败: {str(e)}"

    return {
        "risk_assessment": analysis,
        "current_step": "risk_assessment",
        "progress": min(state.progress + 15, 100),
        "llm_calls": state.llm_calls + 1,
    }
