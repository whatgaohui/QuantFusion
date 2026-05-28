from __future__ import annotations

"""
Strategy API endpoints.
Lists and executes trading strategies.
"""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.strategies.loader import list_strategies, load_strategy
from app.strategies.engine import execute_strategy

logger = logging.getLogger(__name__)

router = APIRouter()


class ExecuteStrategyRequest(BaseModel):
    """Request body for strategy execution."""
    strategy_id: str
    symbol: str
    parameters: Optional[dict] = None


@router.get("/strategies")
async def get_strategies() -> dict:
    """List all available strategies."""
    strategies = list_strategies()
    # Return summary info (without full conditions for list view)
    summary = [
        {
            "id": s.get("id", ""),
            "name": s.get("name", ""),
            "type": s.get("type", ""),
            "description": s.get("description", ""),
        }
        for s in strategies
    ]
    return {"success": True, "data": {"strategies": summary, "total": len(summary)}, "error": None}


@router.get("/strategies/{strategy_id}")
async def get_strategy(strategy_id: str) -> dict:
    """Get a specific strategy definition."""
    strategy = load_strategy(strategy_id)
    if not strategy:
        return {
            "success": False,
            "error": f"Strategy '{strategy_id}' not found",
            "data": None,
        }
    return {"success": True, "data": strategy, "error": None}


@router.post("/strategies/execute")
async def execute_strategy_endpoint(request: ExecuteStrategyRequest) -> dict:
    """Execute a strategy against current market data."""
    result = await execute_strategy(
        strategy_id=request.strategy_id,
        symbol=request.symbol,
        parameters=request.parameters,
    )
    return result
