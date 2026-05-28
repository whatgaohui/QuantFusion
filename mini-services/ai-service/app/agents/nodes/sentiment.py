from __future__ import annotations

"""
Sentiment analysis agent node.
Analyzes market sentiment, news, and social signals.
"""

import logging
from app.agents.state import AgentState
from app.llm.router import llm_quick_call

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一位专业的市场情绪分析师。你的任务是：
1. 搜索并分析相关新闻和公告
2. 评估市场情绪倾向（乐观/中性/悲观）
3. 识别可能影响股价的重大事件
4. 分析舆论趋势和关注度

请用中文回复，给出结构化的情绪分析报告。"""


async def sentiment_agent(state: AgentState) -> dict:
    """Sentiment analysis agent node for LangGraph."""
    logger.info(f"[Sentiment Agent] Analyzing {state.symbol}")

    # Include technical analysis context if available
    context = ""
    if state.technical_analysis:
        context = f"\n\n已有技术分析结果：\n{state.technical_analysis[:500]}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请对股票 {state.symbol} 进行市场情绪分析。搜索相关新闻，评估市场情绪。{context}"},
    ]

    try:
        result = await llm_quick_call(messages)
        analysis = result.get("content", "情绪分析暂不可用")
    except Exception as e:
        logger.error(f"Sentiment agent error: {e}")
        analysis = f"情绪分析调用失败: {str(e)}"

    return {
        "sentiment_analysis": analysis,
        "current_step": "sentiment_analysis",
        "progress": min(state.progress + 20, 100),
        "llm_calls": state.llm_calls + 1,
    }
