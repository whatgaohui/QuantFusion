from __future__ import annotations

"""
OpenAI LLM provider implementation.
"""

from typing import Any

from app.llm.providers.base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """OpenAI API provider (GPT-4, GPT-4o, etc.)."""

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "https://api.openai.com/v1",
        default_model: str = "gpt-4o",
    ) -> None:
        super().__init__(
            name="openai",
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
        """Complete using OpenAI via LiteLLM."""
        import litellm

        response = await litellm.acompletion(
            model=f"openai/{model or self.default_model}",
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=self.api_key,
            api_base=self.base_url,
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
        """Stream using OpenAI via LiteLLM."""
        import litellm

        response = await litellm.acompletion(
            model=f"openai/{model or self.default_model}",
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=self.api_key,
            api_base=self.base_url,
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
