from __future__ import annotations

"""
News search tool - Searches for stock-related news from the Go Data Service.
"""

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def search_news(
    symbol: str,
    keyword: str = "",
    count: int = 10,
) -> dict[str, Any]:
    """
    Search for stock-related news.
    Calls the Go Data Service at /api/market/news.

    Args:
        symbol: Stock symbol, e.g. "SH600519"
        keyword: Additional search keyword
        count: Number of news items to fetch

    Returns:
        News articles related to the stock.
    """
    settings = get_settings()
    url = f"{settings.go_data_api_url}/market/news"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                params={"symbol": symbol, "keyword": keyword, "count": count},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("data", data)
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch news for {symbol}: {e}")
        return {"error": f"Failed to fetch news: {str(e)}", "symbol": symbol, "articles": []}
    except Exception as e:
        logger.error(f"Unexpected error fetching news for {symbol}: {e}")
        return {"error": f"Unexpected error: {str(e)}", "symbol": symbol, "articles": []}
