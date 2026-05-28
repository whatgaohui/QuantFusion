from __future__ import annotations

"""
Bear researcher agent node.
Argues for the bearish case of the stock.
"""

import logging
from app.agents.state import AgentState
from app.llm.router import llm_quick_call

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一位看空研究员（Bear Researcher）。你的任务是：
1. 基于已有的分析数据，寻找支持下跌的理由
2. 强调风险因素和潜在利空
3. 提出合理的下行情景和风险价位
4. 反驳看多观点

请用中文回复，给出有力的看空论据。注意要基于事实和逻辑，不要无脑看空。"""


async def bear_agent(state: AgentState) -> dict:
    """Bear researcher agent node for LangGraph debate mode."""
    logger.info(f"[Bear Agent] Building bear case for {state.symbol}")

    # Gather all available analysis
    context_parts = []
    if state.technical_analysis:
        context_parts.append(f"技术分析：\n{state.technical_analysis[:800]}")
    if state.fundamental_analysis:
        context_parts.append(f"基本面分析：\n{state.fundamental_analysis[:800]}")
    if state.sentiment_analysis:
        context_parts.append(f"情绪分析：\n{state.sentiment_analysis[:800]}")

    context = "\n\n".join(context_parts)
    bull_context = ""
    if state.bull_thesis:
        bull_context = f"\n\n看多研究员的观点（请反驳）：\n{state.bull_thesis[:500]}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请为股票 {state.symbol} 构建看空论据。\n\n已有分析：\n{context}{bull_context}"},
    ]

    try:
        result = await llm_quick_call(messages)
        analysis = result.get("content", "看空分析暂不可用")
    except Exception as e:
        logger.error(f"Bear agent error: {e}")
        analysis = f"看空分析调用失败: {str(e)}"

    return {
        "bear_thesis": analysis,
        "current_step": "bear_research",
        "progress": min(state.progress + 10, 100),
        "llm_calls": state.llm_calls + 1,
    }
