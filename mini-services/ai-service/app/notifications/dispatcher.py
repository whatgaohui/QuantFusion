from __future__ import annotations

"""
Unified notification dispatcher.
Routes notifications to the appropriate channel(s).
"""

import logging
from typing import Any

from app.notifications.channels.base import BaseNotificationChannel
from app.notifications.channels.wechat import WeChatChannel
from app.notifications.channels.feishu import FeishuChannel
from app.notifications.channels.telegram import TelegramChannel
from app.notifications.channels.email import EmailChannel
from app.notifications.channels.webhook import WebhookChannel
from app.config import get_settings

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    """Dispatches notifications to configured channels."""

    def __init__(self) -> None:
        self._channels: dict[str, BaseNotificationChannel] = {}
        self._init_channels()

    def _init_channels(self) -> None:
        """Initialize all notification channels from settings."""
        settings = get_settings()

        self._channels = {
            "wechat": WeChatChannel(webhook_url=settings.wechat_webhook_url),
            "feishu": FeishuChannel(webhook_url=settings.feishu_webhook_url),
            "telegram": TelegramChannel(
                bot_token=settings.telegram_bot_token,
                chat_id=settings.telegram_chat_id,
            ),
            "email": EmailChannel(
                smtp_host=settings.email_smtp_host,
                smtp_port=settings.email_smtp_port,
                smtp_user=settings.email_smtp_user,
                smtp_password=settings.email_smtp_password,
                from_addr=settings.email_from,
            ),
            "webhook": WebhookChannel(url=settings.webhook_url),
        }

    async def send(
        self,
        channel: str,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Send a notification to a specific channel.

        Args:
            channel: Channel name (wechat, feishu, telegram, email, webhook)
            title: Notification title
            content: Notification content
            **kwargs: Additional channel-specific parameters

        Returns:
            Send result with success status.
        """
        ch = self._channels.get(channel)
        if not ch:
            return {
                "success": False,
                "error": f"Unknown channel: {channel}. Available: {list(self._channels.keys())}",
                "data": None,
            }

        if not ch.is_configured():
            return {
                "success": False,
                "error": f"Channel '{channel}' is not configured. Please set the required environment variables.",
                "data": None,
            }

        try:
            result = await ch.send(title=title, content=content, **kwargs)
            return {
                "success": True,
                "data": {"channel": channel, "result": result},
                "error": None,
            }
        except Exception as e:
            logger.error(f"Failed to send notification via {channel}: {e}")
            return {
                "success": False,
                "error": f"Failed to send notification: {str(e)}",
                "data": None,
            }

    async def send_all(
        self,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Send a notification to all configured channels.

        Returns:
            Results for each channel.
        """
        results = {}
        for channel_name, ch in self._channels.items():
            if ch.is_configured():
                try:
                    result = await ch.send(title=title, content=content, **kwargs)
                    results[channel_name] = {"success": True, "result": result}
                except Exception as e:
                    results[channel_name] = {"success": False, "error": str(e)}
            else:
                results[channel_name] = {"success": False, "error": "Not configured"}

        return {
            "success": True,
            "data": results,
            "error": None,
        }

    def list_channels(self) -> list[dict[str, Any]]:
        """List all available channels and their configuration status."""
        return [
            {
                "name": name,
                "configured": ch.is_configured(),
            }
            for name, ch in self._channels.items()
        ]


# Global dispatcher instance
_dispatcher: NotificationDispatcher | None = None


def get_dispatcher() -> NotificationDispatcher:
    """Get the notification dispatcher singleton."""
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = NotificationDispatcher()
    return _dispatcher
