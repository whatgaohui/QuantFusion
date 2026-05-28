from __future__ import annotations

"""
Market data tool - Fetches market data from the Go Data Service.
"""

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def get_market_data(symbol: str) -> dict[str, Any]:
    """
    Get current market data for a stock symbol.
    Calls the Go Data Service at /api/market/quote.

    Args:
        symbol: Stock symbol, e.g. "SH600519"

    Returns:
        Market data including price, volume, change, etc.
    """
    settings = get_settings()
    url = f"{settings.go_data_api_url}/market/quote"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params={"symbol": symbol})
            response.raise_for_status()
            data = response.json()
            return data.get("data", data)
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch market data for {symbol}: {e}")
        return {"error": f"Failed to fetch market data: {str(e)}", "symbol": symbol}
    except Exception as e:
        logger.error(f"Unexpected error fetching market data for {symbol}: {e}")
        return {"error": f"Unexpected error: {str(e)}", "symbol": symbol}


async def get_stock_profile(symbol: str) -> dict[str, Any]:
    """
    Get stock profile information.
    Calls the Go Data Service at /api/market/profile.
    """
    settings = get_settings()
    url = f"{settings.go_data_api_url}/market/profile"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params={"symbol": symbol})
            response.raise_for_status()
            data = response.json()
            return data.get("data", data)
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch stock profile for {symbol}: {e}")
        return {"error": f"Failed to fetch stock profile: {str(e)}", "symbol": symbol}
