from __future__ import annotations

"""
Bull researcher agent node.
Argues for the bullish case of the stock.
"""

import logging
from app.agents.state import AgentState
from app.llm.router import llm_quick_call

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一位看多研究员（Bull Researcher）。你的任务是：
1. 基于已有的分析数据，寻找支持上涨的理由
2. 强调积极因素和潜在催化剂
3. 提出合理的上行情景和目标价
4. 反驳看空观点

请用中文回复，给出有力的看多论据。注意要基于事实和逻辑，不要无脑看多。"""


async def bull_agent(state: AgentState) -> dict:
    """Bull researcher agent node for LangGraph debate mode."""
    logger.info(f"[Bull Agent] Building bull case for {state.symbol}")

    # Gather all available analysis
    context_parts = []
    if state.technical_analysis:
        context_parts.append(f"技术分析：\n{state.technical_analysis[:800]}")
    if state.fundamental_analysis:
        context_parts.append(f"基本面分析：\n{state.fundamental_analysis[:800]}")
    if state.sentiment_analysis:
        context_parts.append(f"情绪分析：\n{state.sentiment_analysis[:800]}")

    context = "\n\n".join(context_parts)
    bear_context = ""
    if state.bear_thesis:
        bear_context = f"\n\n看空研究员的观点（请反驳）：\n{state.bear_thesis[:500]}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请为股票 {state.symbol} 构建看多论据。\n\n已有分析：\n{context}{bear_context}"},
    ]

    try:
        result = await llm_quick_call(messages)
        analysis = result.get("content", "看多分析暂不可用")
    except Exception as e:
        logger.error(f"Bull agent error: {e}")
        analysis = f"看多分析调用失败: {str(e)}"

    return {
        "bull_thesis": analysis,
        "current_step": "bull_research",
        "progress": min(state.progress + 10, 100),
        "llm_calls": state.llm_calls + 1,
    }
