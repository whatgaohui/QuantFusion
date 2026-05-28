from __future__ import annotations

"""
Backtest API endpoints.
Runs and retrieves backtest results.
"""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.backtest.engine import run_backtest, get_backtest_result

logger = logging.getLogger(__name__)

router = APIRouter()


class RunBacktestRequest(BaseModel):
    """Request body for running a backtest."""
    strategy_id: str
    symbol: str
    start: str  # YYYY-MM-DD
    end: str    # YYYY-MM-DD
    initial_capital: float = 100000.0


@router.post("/backtest/run")
async def run_backtest_endpoint(request: RunBacktestRequest) -> dict:
    """Run a backtest for a strategy on a given symbol and date range."""
    result = await run_backtest(
        strategy_id=request.strategy_id,
        symbol=request.symbol,
        start_date=request.start,
        end_date=request.end,
        initial_capital=request.initial_capital,
    )
    return result


@router.get("/backtest/{backtest_id}")
async def get_backtest(backtest_id: str) -> dict:
    """Get the result of a backtest run."""
    result = get_backtest_result(backtest_id)
    if not result:
        return {
            "success": False,
            "error": f"Backtest '{backtest_id}' not found",
            "data": None,
        }
    return {"success": True, "data": result, "error": None}
