from __future__ import annotations

"""
Base LLM provider class.
All provider implementations should inherit from this class.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(
        self,
        name: str,
        api_key: str = "",
        base_url: str = "",
        default_model: str = "",
    ) -> None:
        self.name = name
        self.api_key = api_key
        self.base_url = base_url
        self.default_model = default_model

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Make a completion request to the provider."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ):
        """Make a streaming completion request. Yields content chunks."""
        ...

    def is_configured(self) -> bool:
        """Check if the provider has valid configuration."""
        return bool(self.api_key)

    def get_info(self) -> dict[str, Any]:
        """Get provider information."""
        return {
            "name": self.name,
            "base_url": self.base_url,
            "default_model": self.default_model,
            "configured": self.is_configured(),
        }
