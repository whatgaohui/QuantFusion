from __future__ import annotations

"""
Base notification channel class.
All notification channel implementations should inherit from this class.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseNotificationChannel(ABC):
    """Abstract base class for notification channels."""

    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    async def send(
        self,
        title: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Send a notification through this channel.

        Args:
            title: Notification title
            content: Notification content/body
            **kwargs: Channel-specific parameters

        Returns:
            Send result dict.
        """
        ...

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if the channel has valid configuration."""
        ...
