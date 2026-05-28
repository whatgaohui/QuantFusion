from __future__ import annotations

"""
Sentiment analysis tool - Fetches sentiment data from the Go Data Service.
"""

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def get_sentiment_analysis(symbol: str) -> dict[str, Any]:
    """
    Get sentiment analysis for a stock symbol.
    Calls the Go Data Service at /api/ai/sentiment.

    Args:
        symbol: Stock symbol, e.g. "SH600519"

    Returns:
        Sentiment analysis data including score, trend, and signals.
    """
    settings = get_settings()

    # Try the AI sentiment endpoint on the Go service
    # The Go service might have its own sentiment endpoint, or we go through BFF
    url = f"{settings.go_data_api_url}/ai/sentiment"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params={"symbol": symbol})
            response.raise_for_status()
            data = response.json()
            return data.get("data", data)
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch sentiment for {symbol}: {e}")
        # Return a default neutral sentiment
        return {
            "symbol": symbol,
            "sentiment_score": 0.0,
            "sentiment_label": "neutral",
            "confidence": 0.0,
            "error": f"Failed to fetch sentiment: {str(e)}",
        }
    except Exception as e:
        logger.error(f"Unexpected error fetching sentiment for {symbol}: {e}")
        return {
            "symbol": symbol,
            "sentiment_score": 0.0,
            "sentiment_label": "neutral",
            "confidence": 0.0,
            "error": f"Unexpected error: {str(e)}",
        }
