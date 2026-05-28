from __future__ import annotations

"""
WeChat Work webhook notification channel.
Sends notifications via WeChat Work (企业微信) group robot webhook.
"""

import logging
from typing import Any

import httpx

from app.notifications.channels.base import BaseNotificationChannel

logger = logging.getLogger(__name__)


class WeChatChannel(BaseNotificationChannel):
    """WeChat Work webhook notification channel."""

    def __init__(self, webhook_url: str = "") -> None:
        super().__init__(name="wechat")
        self.webhook_url = webhook_url

    async def send(
        self,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send notification via WeChat Work webhook."""
        if not self.webhook_url:
            return {"success": False, "error": "Webhook URL not configured"}

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "content": f"## {title}\n\n{content}",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.webhook_url, json=payload)
                response.raise_for_status()
                return {"success": True, "response": response.json()}
        except httpx.HTTPError as e:
            logger.error(f"WeChat notification failed: {e}")
            return {"success": False, "error": str(e)}

    def is_configured(self) -> bool:
        """Check if webhook URL is configured."""
        return bool(self.webhook_url)
