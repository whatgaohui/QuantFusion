from __future__ import annotations

"""
Analysis API endpoints.
Handles stock analysis workflow start, status, and streaming.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.agents.graph import run_analysis, get_analysis_result, stream_analysis

logger = logging.getLogger(__name__)

router = APIRouter()


class StartAnalysisRequest(BaseModel):
    """Request body for starting an analysis."""
    symbol: str
    mode: str = "standard"  # quick | standard | full | debate


@router.post("/analysis/start")
async def start_analysis(request: StartAnalysisRequest) -> dict:
    """
    Start a stock analysis workflow.
    Returns a task_id for tracking progress.
    """
    if request.mode not in ("quick", "standard", "full", "debate"):
        return {
            "success": False,
            "error": f"Invalid mode '{request.mode}'. Must be: quick, standard, full, or debate",
            "data": None,
        }

    result = await run_analysis(request.symbol, request.mode)
    return {"success": True, "data": result, "error": None}


@router.get("/analysis/{task_id}")
async def get_analysis(task_id: str) -> dict:
    """
    Get the current result of an analysis task.
    """
    result = get_analysis_result(task_id)
    if not result:
        return {
            "success": False,
            "error": f"Analysis task '{task_id}' not found",
            "data": None,
        }
    return {"success": True, "data": result, "error": None}


@router.get("/analysis/{task_id}/stream")
async def stream_analysis_progress(task_id: str) -> EventSourceResponse:
    """
    SSE stream for analysis progress.
    This endpoint re-runs the analysis for streaming; use the task_id
    from /analysis/start for async tracking.
    """
    # Get existing task info
    result = get_analysis_result(task_id)
    if not result:
        # If task not found, return error as SSE
        async def error_stream():
            yield json.dumps({"success": False, "error": f"Task '{task_id}' not found"})
        return EventSourceResponse(error_stream())

    async def event_stream():
        # Stream the current state updates
        current = result
        yield json.dumps({"success": True, "data": current})

        # If analysis is still running, poll for updates
        import asyncio
        while current.get("current_step") not in ("completed", "failed"):
            await asyncio.sleep(1)
            updated = get_analysis_result(task_id)
            if updated:
                current = updated
                yield json.dumps({"success": True, "data": current})
            if current.get("errors"):
                break

    return EventSourceResponse(event_stream())


@router.post("/analysis/stream")
async def start_stream_analysis(request: StartAnalysisRequest) -> EventSourceResponse:
    """
    Start a new analysis and stream progress via SSE.
    """
    if request.mode not in ("quick", "standard", "full", "debate"):
        async def error_stream():
            yield json.dumps({
                "success": False,
                "error": f"Invalid mode '{request.mode}'",
            })
        return EventSourceResponse(error_stream())

    async def event_stream():
        async for state_update in stream_analysis(request.symbol, request.mode):
            yield json.dumps({"success": True, "data": state_update}, ensure_ascii=False)

    return EventSourceResponse(event_stream())
