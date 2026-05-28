from __future__ import annotations

"""
LLM provider fallback chain.
When the primary provider fails, attempts fallback to alternative providers.
"""

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


class FallbackManager:
    """Manages fallback LLM providers when the primary fails."""

    def __init__(self) -> None:
        # Fallback chain: provider -> model pairs to try in order
        self._quick_fallbacks: list[tuple[str, str]] = [
            ("openai", "gpt-4o-mini"),
            ("ollama", "llama3.1"),
        ]
        self._deep_fallbacks: list[tuple[str, str]] = [
            ("openai", "gpt-4o"),
            ("ollama", "llama3.1"),
        ]

    async def fallback_quick(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        tools: list[dict] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Try fallback providers for quick calls."""
        for provider, model in self._quick_fallbacks:
            try:
                result = await self._try_provider(
                    provider, model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                    tools=tools, **kwargs,
                )
                if result:
                    logger.info(f"Fallback quick call succeeded with {provider}/{model}")
                    return result
            except Exception as e:
                logger.warning(f"Fallback quick call failed with {provider}/{model}: {e}")
                continue

        # All fallbacks failed - return error response
        return {
            "content": "[Error: All LLM providers failed]",
            "tool_calls": None,
            "model": "none",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    async def fallback_deep(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        tools: list[dict] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Try fallback providers for deep calls."""
        for provider, model in self._deep_fallbacks:
            try:
                result = await self._try_provider(
                    provider, model, messages,
                    temperature=temperature, max_tokens=max_tokens,
                    tools=tools, **kwargs,
                )
                if result:
                    logger.info(f"Fallback deep call succeeded with {provider}/{model}")
                    return result
            except Exception as e:
                logger.warning(f"Fallback deep call failed with {provider}/{model}: {e}")
                continue

        return {
            "content": "[Error: All LLM providers failed]",
            "tool_calls": None,
            "model": "none",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    async def _try_provider(
        self,
        provider: str,
        model: str,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        tools: list[dict] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any] | None:
        """Try a single fallback provider via LiteLLM."""
        import litellm

        settings = get_settings()

        # Determine API key and base URL based on provider
        api_key = settings.llm_api_key
        api_base = settings.llm_base_url

        if provider == "ollama":
            api_key = "ollama"
            api_base = "http://localhost:11434"
        elif provider == "openai":
            # Would need OpenAI key from env
            api_key = ""
            api_base = "https://api.openai.com/v1"

        if not api_key and provider != "ollama":
            return None

        model_str = f"{provider}/{model}"

        response = await litellm.acompletion(
            model=model_str,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key if api_key else None,
            api_base=api_base,
            tools=tools,
            **kwargs,
        )

        choice = response.choices[0] if response.choices else None
        return {
            "content": choice.message.content if choice and choice.message else "",
            "tool_calls": choice.message.tool_calls if choice and choice.message else None,
            "model": response.model or "",
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            },
        }
