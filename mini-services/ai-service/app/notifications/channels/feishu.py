from __future__ import annotations

"""
Feishu/Lark webhook notification channel.
Sends notifications via Feishu (飞书) group robot webhook.
"""

import logging
from typing import Any

import httpx

from app.notifications.channels.base import BaseNotificationChannel

logger = logging.getLogger(__name__)


class FeishuChannel(BaseNotificationChannel):
    """Feishu/Lark webhook notification channel."""

    def __init__(self, webhook_url: str = "") -> None:
        super().__init__(name="feishu")
        self.webhook_url = webhook_url

    async def send(
        self,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send notification via Feishu webhook."""
        if not self.webhook_url:
            return {"success": False, "error": "Webhook URL not configured"}

        payload = {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": title,
                    },
                    "template": "blue",
                },
                "elements": [
                    {
                        "tag": "markdown",
                        "content": content,
                    }
                ],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.webhook_url, json=payload)
                response.raise_for_status()
                return {"success": True, "response": response.json()}
        except httpx.HTTPError as e:
            logger.error(f"Feishu notification failed: {e}")
            return {"success": False, "error": str(e)}

    def is_configured(self) -> bool:
        """Check if webhook URL is configured."""
        return bool(self.webhook_url)
