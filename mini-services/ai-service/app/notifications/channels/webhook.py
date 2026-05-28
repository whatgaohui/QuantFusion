from __future__ import annotations

"""
Custom webhook notification channel.
Sends notifications via generic HTTP webhook (POST).
"""

import logging
from typing import Any

import httpx

from app.notifications.channels.base import BaseNotificationChannel

logger = logging.getLogger(__name__)


class WebhookChannel(BaseNotificationChannel):
    """Custom webhook notification channel."""

    def __init__(self, url: str = "") -> None:
        super().__init__(name="webhook")
        self.url = url

    async def send(
        self,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send notification via custom webhook."""
        if not self.url:
            return {"success": False, "error": "Webhook URL not configured"}

        payload = {
            "title": title,
            "content": content,
            "source": "quantfusion-ai-service",
            **kwargs,
        }

        headers = kwargs.get("headers", {"Content-Type": "application/json"})

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.url, json=payload, headers=headers)
                response.raise_for_status()
                return {"success": True, "status_code": response.status_code}
        except httpx.HTTPError as e:
            logger.error(f"Webhook notification failed: {e}")
            return {"success": False, "error": str(e)}

    def is_configured(self) -> bool:
        """Check if webhook URL is configured."""
        return bool(self.url)
