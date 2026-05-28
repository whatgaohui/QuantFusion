from __future__ import annotations

"""
Telegram bot notification channel.
Sends notifications via Telegram bot API.
"""

import logging
from typing import Any

import httpx

from app.notifications.channels.base import BaseNotificationChannel

logger = logging.getLogger(__name__)


class TelegramChannel(BaseNotificationChannel):
    """Telegram bot notification channel."""

    def __init__(
        self,
        bot_token: str = "",
        chat_id: str = "",
    ) -> None:
        super().__init__(name="telegram")
        self.bot_token = bot_token
        self.chat_id = chat_id

    async def send(
        self,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send notification via Telegram bot."""
        if not self.bot_token or not self.chat_id:
            return {"success": False, "error": "Bot token or chat ID not configured"}

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        text = f"*{title}*\n\n{content}"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return {"success": True, "response": response.json()}
        except httpx.HTTPError as e:
            logger.error(f"Telegram notification failed: {e}")
            return {"success": False, "error": str(e)}

    def is_configured(self) -> bool:
        """Check if bot token and chat ID are configured."""
        return bool(self.bot_token and self.chat_id)
