from __future__ import annotations

"""
Backtesting engine skeleton.
Evaluates trading strategies against historical data.
"""

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.strategies.loader import load_strategy
from app.agents.tools.kline import get_kline_data

logger = logging.getLogger(__name__)


@dataclass
class BacktestTrade:
    """A single trade in a backtest."""
    entry_date: str
    entry_price: float
    exit_date: str = ""
    exit_price: float = 0.0
    direction: str = "long"  # long or short
    pnl: float = 0.0
    pnl_pct: float = 0.0


@dataclass
class BacktestResult:
    """Result of a backtest run."""
    backtest_id: str = ""
    strategy_id: str = ""
    symbol: str = ""
    start_date: str = ""
    end_date: str = ""
    initial_capital: float = 100000.0
    final_capital: float = 100000.0
    total_return: float = 0.0
    total_return_pct: float = 0.0
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    avg_trade_return: float = 0.0
    trades: list[BacktestTrade] = field(default_factory=list)
    status: str = "pending"


# In-memory backtest results store
_backtest_results: dict[str, BacktestResult] = {}


async def run_backtest(
    strategy_id: str,
    symbol: str,
    start_date: str,
    end_date: str,
    initial_capital: float = 100000.0,
) -> dict[str, Any]:
    """
    Run a backtest for a strategy on a given symbol and date range.

    This is a skeleton implementation. A full version would:
    1. Load historical data from the Go service
    2. Apply the strategy entry/exit conditions to each bar
    3. Simulate trade execution with realistic fills
    4. Calculate comprehensive performance metrics
    5. Generate equity curve and trade log

    Args:
        strategy_id: Strategy to backtest
        symbol: Stock symbol
        start_date: Backtest start date (YYYY-MM-DD)
        end_date: Backtest end date (YYYY-MM-DD)
        initial_capital: Starting capital

    Returns:
        Backtest result with performance metrics.
    """
    backtest_id = str(uuid.uuid4())

    # Validate strategy exists
    strategy = load_strategy(strategy_id)
    if not strategy:
        return {
            "success": False,
            "error": f"Strategy '{strategy_id}' not found",
            "data": None,
        }

    result = BacktestResult(
        backtest_id=backtest_id,
        strategy_id=strategy_id,
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        initial_capital=initial_capital,
        status="running",
    )
    _backtest_results[backtest_id] = result

    try:
        # Fetch historical kline data
        kline = await get_kline_data(symbol, period="daily", count=500)

        # If Go service is unavailable, fall back to simulated data for skeleton
        data_available = "error" not in kline

        # Skeleton backtest: simulate basic results
        # In a real implementation, this would iterate through each bar
        # and evaluate the strategy conditions
        result.total_trades = 12
        result.winning_trades = 7
        result.losing_trades = 5
        result.win_rate = result.winning_trades / result.total_trades if result.total_trades > 0 else 0.0
        result.total_return_pct = 15.3
        result.total_return = initial_capital * result.total_return_pct / 100
        result.final_capital = initial_capital + result.total_return
        result.max_drawdown_pct = 8.5
        result.max_drawdown = initial_capital * result.max_drawdown_pct / 100
        result.sharpe_ratio = 1.42
        result.avg_trade_return = result.total_return_pct / result.total_trades if result.total_trades > 0 else 0.0
        result.status = "completed"

        # Add sample trades
        result.trades = [
            BacktestTrade(
                entry_date="2024-01-15",
                entry_price=1680.0,
                exit_date="2024-02-05",
                exit_price=1750.0,
                pnl=70.0,
                pnl_pct=4.17,
            ),
            BacktestTrade(
                entry_date="2024-03-10",
                entry_price=1720.0,
                exit_date="2024-03-25",
                exit_price=1690.0,
                pnl=-30.0,
                pnl_pct=-1.74,
            ),
        ]

        _backtest_results[backtest_id] = result

        return {
            "success": True,
            "data": {
                "backtest_id": backtest_id,
                "status": result.status,
                "strategy_id": strategy_id,
                "symbol": symbol,
                "start_date": start_date,
                "end_date": end_date,
                "initial_capital": result.initial_capital,
                "final_capital": result.final_capital,
                "total_return_pct": result.total_return_pct,
                "max_drawdown_pct": result.max_drawdown_pct,
                "sharpe_ratio": result.sharpe_ratio,
                "win_rate": result.win_rate,
                "total_trades": result.total_trades,
                "winning_trades": result.winning_trades,
                "losing_trades": result.losing_trades,
                "avg_trade_return": result.avg_trade_return,
                "trades": [
                    {
                        "entry_date": t.entry_date,
                        "entry_price": t.entry_price,
                        "exit_date": t.exit_date,
                        "exit_price": t.exit_price,
                        "pnl": t.pnl,
                        "pnl_pct": t.pnl_pct,
                    }
                    for t in result.trades
                ],
                "note": "Skeleton backtest - simulated results" + ("" if data_available else " (Go data service unavailable, using defaults)"),
            },
            "error": None,
        }

    except Exception as e:
        logger.error(f"Backtest failed for {strategy_id}/{symbol}: {e}")
        result.status = "failed"
        _backtest_results[backtest_id] = result
        return {
            "success": False,
            "error": f"Backtest execution failed: {str(e)}",
            "data": None,
        }


def get_backtest_result(backtest_id: str) -> dict[str, Any] | None:
    """Get the result of a backtest run."""
    result = _backtest_results.get(backtest_id)
    if not result:
        return None
    return {
        "backtest_id": result.backtest_id,
        "status": result.status,
        "strategy_id": result.strategy_id,
        "symbol": result.symbol,
        "total_return_pct": result.total_return_pct,
        "max_drawdown_pct": result.max_drawdown_pct,
        "sharpe_ratio": result.sharpe_ratio,
        "win_rate": result.win_rate,
        "total_trades": result.total_trades,
    }
