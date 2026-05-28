from __future__ import annotations

"""
LangGraph workflow definition for stock analysis.
Defines the graph structure with different analysis modes.
"""

import asyncio
import logging
import uuid
from typing import Any, AsyncIterator

from app.agents.state import AgentState
from app.agents.nodes.technical import technical_agent
from app.agents.nodes.fundamental import fundamental_agent
from app.agents.nodes.sentiment import sentiment_agent
from app.agents.nodes.bull import bull_agent
from app.agents.nodes.bear import bear_agent
from app.agents.nodes.risk import risk_agent
from app.agents.nodes.decision import decision_agent

logger = logging.getLogger(__name__)

# In-memory task store for tracking analysis progress
_analysis_tasks: dict[str, AgentState] = {}


def _build_quick_graph() -> list:
    """Quick mode: Technical → Decision (2 LLM calls)."""
    return [
        ("technical", technical_agent),
        ("decision", decision_agent),
    ]


def _build_standard_graph() -> list:
    """Standard mode: Technical → Sentiment → Decision (3 LLM calls)."""
    return [
        ("technical", technical_agent),
        ("sentiment", sentiment_agent),
        ("decision", decision_agent),
    ]


def _build_full_graph() -> list:
    """Full mode: Technical → Fundamental → Sentiment → Risk → Decision (5 LLM calls)."""
    return [
        ("technical", technical_agent),
        ("fundamental", fundamental_agent),
        ("sentiment", sentiment_agent),
        ("risk", risk_agent),
        ("decision", decision_agent),
    ]


def _build_debate_graph() -> list:
    """Debate mode: Technical → Fundamental → Sentiment → Bull ↔ Bear (2 rounds) → Risk → Decision (8+ LLM calls)."""
    return [
        ("technical", technical_agent),
        ("fundamental", fundamental_agent),
        ("sentiment", sentiment_agent),
        ("bull_round1", bull_agent),
        ("bear_round1", bear_agent),
        ("bull_round2", bull_agent),
        ("bear_round2", bear_agent),
        ("risk", risk_agent),
        ("decision", decision_agent),
    ]


# Map mode names to graph builders
GRAPH_BUILDERS: dict[str, Any] = {
    "quick": _build_quick_graph,
    "standard": _build_standard_graph,
    "full": _build_full_graph,
    "debate": _build_debate_graph,
}


async def run_analysis(symbol: str, mode: str = "standard") -> dict[str, Any]:
    """
    Run a stock analysis workflow.
    Returns a task_id immediately and runs the analysis asynchronously.
    """
    task_id = str(uuid.uuid4())

    # Initialize state
    state = AgentState(
        symbol=symbol,
        mode=mode,
        task_id=task_id,
        current_step="init",
        progress=0,
    )
    _analysis_tasks[task_id] = state

    # Start analysis in background
    asyncio.create_task(_execute_workflow(task_id, mode))

    return {"task_id": task_id, "status": "running"}


async def _execute_workflow(task_id: str, mode: str) -> None:
    """Execute the analysis workflow for a given task."""
    state = _analysis_tasks.get(task_id)
    if not state:
        return

    builder = GRAPH_BUILDERS.get(mode, _build_standard_graph)
    nodes = builder()

    for step_name, node_func in nodes:
        try:
            state.current_step = step_name
            _analysis_tasks[task_id] = state

            # Execute the node
            updates = await node_func(state)

            # Apply updates to state
            for key, value in updates.items():
                if hasattr(state, key):
                    setattr(state, key, value)

            _analysis_tasks[task_id] = state

            logger.info(f"[Workflow {task_id}] Completed step: {step_name}")

        except Exception as e:
            logger.error(f"[Workflow {task_id}] Error in step {step_name}: {e}")
            state.errors.append(f"{step_name}: {str(e)}")
            _analysis_tasks[task_id] = state

    state.progress = 100
    state.current_step = "completed"
    _analysis_tasks[task_id] = state


async def stream_analysis(symbol: str, mode: str = "standard") -> AsyncIterator[dict[str, Any]]:
    """
    Stream analysis progress as SSE events.
    Yields state updates as they happen.
    """
    task_id = str(uuid.uuid4())

    state = AgentState(
        symbol=symbol,
        mode=mode,
        task_id=task_id,
        current_step="init",
        progress=0,
    )
    _analysis_tasks[task_id] = state

    builder = GRAPH_BUILDERS.get(mode, _build_standard_graph)
    nodes = builder()

    for step_name, node_func in nodes:
        try:
            state.current_step = step_name
            yield state.model_dump()

            updates = await node_func(state)
            for key, value in updates.items():
                if hasattr(state, key):
                    setattr(state, key, value)

            _analysis_tasks[task_id] = state
            yield state.model_dump()

        except Exception as e:
            logger.error(f"[Stream {task_id}] Error in step {step_name}: {e}")
            state.errors.append(f"{step_name}: {str(e)}")
            yield state.model_dump()

    state.progress = 100
    state.current_step = "completed"
    _analysis_tasks[task_id] = state
    yield state.model_dump()


def get_analysis_result(task_id: str) -> dict[str, Any] | None:
    """Get the current state of an analysis task."""
    state = _analysis_tasks.get(task_id)
    if not state:
        return None
    return state.model_dump()
