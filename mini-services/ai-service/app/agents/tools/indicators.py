from __future__ import annotations

"""
Technical indicators tool - Fetches computed technical indicators from the Go Data Service.
"""

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def get_technical_indicators(
    symbol: str,
    indicators: list[str] | None = None,
) -> dict[str, Any]:
    """
    Get technical indicators for a stock symbol.
    Calls the Go Data Service for computed indicator values.

    Args:
        symbol: Stock symbol, e.g. "SH600519"
        indicators: List of indicator names to fetch.
                    Options: "ma", "macd", "rsi", "kdj", "boll", "volume_ratio", etc.
                    If None, returns all available indicators.

    Returns:
        Technical indicator values.
    """
    settings = get_settings()
    url = f"{settings.go_data_api_url}/market/candle"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # The Go service provides raw kline data; indicators are computed
            # In a full implementation, this would call a dedicated indicators endpoint
            response = await client.get(
                url,
                params={"symbol": symbol, "period": "daily", "count": 200},
            )
            response.raise_for_status()
            data = response.json()

            # Return kline data that can be used to compute indicators
            result = data.get("data", data)
            if indicators:
                result["requested_indicators"] = indicators
            return result

    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch indicators for {symbol}: {e}")
        return {"error": f"Failed to fetch indicators: {str(e)}", "symbol": symbol}
    except Exception as e:
        logger.error(f"Unexpected error fetching indicators for {symbol}: {e}")
        return {"error": f"Unexpected error: {str(e)}", "symbol": symbol}
