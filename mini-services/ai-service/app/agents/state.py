from __future__ import annotations

"""
Shared agent state for LangGraph workflow.
Defines the state schema passed between agent nodes.
"""

from typing import Any
from pydantic import BaseModel, Field


class AgentState(BaseModel):
    """Shared state flowing through the LangGraph agent workflow."""

    # Input
    symbol: str = Field(description="Stock symbol, e.g. SH600519")
    mode: str = Field(default="standard", description="Analysis mode: quick|standard|full|debate")

    # Progress tracking
    task_id: str = Field(default="", description="Task ID for tracking")
    current_step: str = Field(default="", description="Current step name")
    progress: int = Field(default=0, description="Progress percentage 0-100")

    # Agent outputs
    technical_analysis: str = Field(default="", description="Technical analysis result")
    fundamental_analysis: str = Field(default="", description="Fundamental analysis result")
    sentiment_analysis: str = Field(default="", description="Sentiment analysis result")
    bull_thesis: str = Field(default="", description="Bull researcher arguments")
    bear_thesis: str = Field(default="", description="Bear researcher arguments")
    risk_assessment: str = Field(default="", description="Risk management assessment")
    final_decision: str = Field(default="", description="Final decision/conclusion")

    # Metadata
    llm_calls: int = Field(default=0, description="Number of LLM calls made")
    errors: list[str] = Field(default_factory=list, description="Any errors encountered")

    model_config = {"arbitrary_types_allowed": True}


class ChatState(BaseModel):
    """State for conversational agent chat."""

    session_id: str = Field(default="", description="Chat session ID")
    message: str = Field(default="", description="User message")
    history: list[dict[str, str]] = Field(default_factory=list, description="Chat history")
    response: str = Field(default="", description="Agent response")
    tools_used: list[str] = Field(default_factory=list, description="Tools invoked")

    model_config = {"arbitrary_types_allowed": True}
