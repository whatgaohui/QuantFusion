from __future__ import annotations

"""
K-line data tool - Fetches K-line (candlestick) data from the Go Data Service.
"""

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def get_kline_data(
    symbol: str,
    period: str = "daily",
    count: int = 120,
) -> dict[str, Any]:
    """
    Get K-line (candlestick) data for a stock symbol.
    Calls the Go Data Service at /api/market/candle.

    Args:
        symbol: Stock symbol, e.g. "SH600519"
        period: K-line period - "daily", "weekly", "monthly", "1m", "5m", "15m", "30m", "60m"
        count: Number of K-line bars to fetch

    Returns:
        K-line data with OHLCV values.
    """
    settings = get_settings()
    url = f"{settings.go_data_api_url}/market/candle"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                params={"symbol": symbol, "period": period, "count": count},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("data", data)
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch kline data for {symbol}: {e}")
        return {"error": f"Failed to fetch kline data: {str(e)}", "symbol": symbol}
    except Exception as e:
        logger.error(f"Unexpected error fetching kline data for {symbol}: {e}")
        return {"error": f"Unexpected error: {str(e)}", "symbol": symbol}
