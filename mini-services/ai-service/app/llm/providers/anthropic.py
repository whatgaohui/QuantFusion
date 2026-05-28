from __future__ import annotations

"""
Anthropic LLM provider implementation.
"""

from typing import Any

from app.llm.providers.base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    """Anthropic API provider (Claude 3.5, etc.)."""

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "https://api.anthropic.com",
        default_model: str = "claude-3-5-sonnet-20241022",
    ) -> None:
        super().__init__(
            name="anthropic",
            api_key=api_key,
            base_url=base_url,
            default_model=default_model,
        )

    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Complete using Anthropic via LiteLLM."""
        import litellm

        response = await litellm.acompletion(
            model=f"anthropic/{model or self.default_model}",
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=self.api_key,
            **kwargs,
        )
        return {
            "content": response.choices[0].message.content if response.choices else "",
            "model": response.model or "",
            "usage": response.usage.model_dump() if response.usage else {},
        }

    async def stream(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs: Any,
    ):
        """Stream using Anthropic via LiteLLM."""
        import litellm

        response = await litellm.acompletion(
            model=f"anthropic/{model or self.default_model}",
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=self.api_key,
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
