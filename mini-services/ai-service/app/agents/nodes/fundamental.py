from __future__ import annotations

"""
Fundamental analysis agent node.
Analyzes company fundamentals, financials, and valuation.
"""

import logging
from app.agents.state import AgentState
from app.llm.router import llm_quick_call

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一位专业的股票基本面分析师。你的任务是：
1. 分析公司的财务数据（营收、利润、现金流等）
2. 评估估值水平（PE、PB、PS等）
3. 判断行业地位和竞争优势
4. 分析成长性和盈利质量

请用中文回复，给出结构化的基本面分析报告。"""


async def fundamental_agent(state: AgentState) -> dict:
    """Fundamental analysis agent node for LangGraph."""
    logger.info(f"[Fundamental Agent] Analyzing {state.symbol}")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请对股票 {state.symbol} 进行基本面分析。分析公司的财务状况、估值水平和行业地位。"},
    ]

    try:
        result = await llm_quick_call(messages)
        analysis = result.get("content", "基本面分析暂不可用")
    except Exception as e:
        logger.error(f"Fundamental agent error: {e}")
        analysis = f"基本面分析调用失败: {str(e)}"

    return {
        "fundamental_analysis": analysis,
        "current_step": "fundamental_analysis",
        "progress": min(state.progress + 20, 100),
        "llm_calls": state.llm_calls + 1,
    }
