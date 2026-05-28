from __future__ import annotations

"""
Technical analysis agent node.
Performs technical indicator analysis on stock data.
"""

import logging
from app.agents.state import AgentState
from app.llm.router import llm_quick_call

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一位专业的股票技术分析师。你的任务是：
1. 查询股票的K线数据和技术指标
2. 分析价格趋势、成交量、均线系统、MACD、RSI、KDJ等技术指标
3. 识别关键支撑位和阻力位
4. 判断当前的技术面信号（买入/卖出/持有）

请用中文回复，给出结构化的技术分析报告。"""


async def technical_agent(state: AgentState) -> dict:
    """Technical analysis agent node for LangGraph."""
    logger.info(f"[Technical Agent] Analyzing {state.symbol}")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请对股票 {state.symbol} 进行技术分析。查询最新的K线数据和技术指标，给出你的分析判断。"},
    ]

    try:
        result = await llm_quick_call(messages)
        analysis = result.get("content", "技术分析暂不可用")
    except Exception as e:
        logger.error(f"Technical agent error: {e}")
        analysis = f"技术分析调用失败: {str(e)}"

    return {
        "technical_analysis": analysis,
        "current_step": "technical_analysis",
        "progress": min(state.progress + 20, 100),
        "llm_calls": state.llm_calls + 1,
    }
