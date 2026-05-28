from __future__ import annotations

"""
Agent chat API endpoints.
Handles conversational agent interactions with SSE streaming.
"""

import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agents.state import ChatState
from app.llm.router import llm_stream_call

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory chat sessions
_chat_sessions: dict[str, ChatState] = {}


class AgentChatRequest(BaseModel):
    """Request body for agent chat."""
    message: str
    session_id: str = ""


SYSTEM_PROMPT = """你是 QuantFusion 智能投研助手。你可以帮助用户：
1. 分析股票的技术面、基本面和情绪面
2. 解读市场数据和新闻
3. 提供投资建议和风险提示
4. 回答关于交易策略的问题

请用中文回复。如果用户询问具体股票，可以调用相关工具获取数据进行分析。"""


@router.post("/agent/chat")
async def agent_chat(request: AgentChatRequest) -> EventSourceResponse:
    """
    Agent chat endpoint with SSE streaming.
    Streams agent responses in real-time.
    """
    session_id = request.session_id or str(uuid.uuid4())

    # Get or create chat session
    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = ChatState(
            session_id=session_id,
            message=request.message,
        )

    session = _chat_sessions[session_id]
    session.message = request.message
    session.history.append({"role": "user", "content": request.message})

    # Build messages with history
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    # Keep last 10 messages for context window
    for msg in session.history[-10:]:
        messages.append(msg)

    async def event_stream():
        full_response = ""
        async for chunk in llm_stream_call(messages, mode="quick"):
            full_response += chunk
            yield json.dumps({"chunk": chunk}, ensure_ascii=False)

        # Save assistant response to history
        session.history.append({"role": "assistant", "content": full_response})
        _chat_sessions[session_id] = session

        # Send final event with metadata
        yield json.dumps({
            "done": True,
            "session_id": session_id,
            "tools_used": [],
        })

    return EventSourceResponse(event_stream())
