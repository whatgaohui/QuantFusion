from __future__ import annotations

"""
Google Gemini LLM provider implementation.
"""

from typing import Any

from app.llm.providers.base import BaseLLMProvider


class GoogleProvider(BaseLLMProvider):
    """Google Gemini API provider."""

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "",
        default_model: str = "gemini/gemini-1.5-pro",
    ) -> None:
        super().__init__(
            name="google",
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
        """Complete using Google Gemini via LiteLLM."""
        import litellm

        model_str = model or self.default_model
        if not model_str.startswith("gemini/"):
            model_str = f"gemini/{model_str}"

        response = await litellm.acompletion(
            model=model_str,
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
        """Stream using Google Gemini via LiteLLM."""
        import litellm

        model_str = model or self.default_model
        if not model_str.startswith("gemini/"):
            model_str = f"gemini/{model_str}"

        response = await litellm.acompletion(
            model=model_str,
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
