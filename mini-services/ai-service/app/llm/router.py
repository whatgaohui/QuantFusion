from __future__ import annotations

"""
LLM unified dispatch router.
Routes calls to quick (fast/cheap) or deep (reasoning) models via LiteLLM.
"""

import logging
from typing import Any, AsyncIterator

import litellm
from fastapi import APIRouter

from app.config import get_settings
from app.llm.token_tracker import TokenTracker
from app.llm.fallback import FallbackManager

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure LiteLLM to suppress verbose logging
litellm.suppress_debug_info = True

# Global instances
_token_tracker = TokenTracker()
_fallback_manager = FallbackManager()


async def llm_quick_call(
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
    tools: list[dict] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Make a quick LLM call (fast/cheap model).
    Uses the default provider configured via LLM_PROVIDER/LLM_MODEL.
    """
    settings = get_settings()
    model = settings.litellm_quick_model
    temp = temperature if temperature is not None else settings.llm_temperature
    tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens

    try:
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            temperature=temp,
            max_tokens=tokens,
            api_key=settings.llm_api_key,
            api_base=settings.llm_base_url,
            tools=tools,
            **kwargs,
        )
        # Track token usage
        _token_tracker.track(response, provider=settings.llm_provider)
        return _format_response(response)
    except Exception as e:
        logger.warning(f"Quick LLM call failed with {model}: {e}")
        return await _fallback_manager.fallback_quick(messages, temperature=temp, max_tokens=tokens, tools=tools, **kwargs)


async def llm_deep_call(
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
    tools: list[dict] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Make a deep LLM call (reasoning model).
    Uses the deep provider configured via LLM_DEEP_PROVIDER/LLM_DEEP_MODEL.
    """
    settings = get_settings()
    model = settings.litellm_deep_model
    temp = temperature if temperature is not None else settings.llm_temperature
    tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens

    try:
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            temperature=temp,
            max_tokens=tokens,
            api_key=settings.llm_api_key,
            api_base=settings.llm_base_url,
            tools=tools,
            **kwargs,
        )
        _token_tracker.track(response, provider=settings.llm_deep_provider)
        return _format_response(response)
    except Exception as e:
        logger.warning(f"Deep LLM call failed with {model}: {e}")
        return await _fallback_manager.fallback_deep(messages, temperature=temp, max_tokens=tokens, tools=tools, **kwargs)


async def llm_stream_call(
    messages: list[dict[str, str]],
    *,
    mode: str = "quick",
    temperature: float | None = None,
    max_tokens: int | None = None,
    **kwargs: Any,
) -> AsyncIterator[str]:
    """
    Make a streaming LLM call. Yields content chunks for SSE.
    """
    settings = get_settings()
    model = settings.litellm_quick_model if mode == "quick" else settings.litellm_deep_model
    temp = temperature if temperature is not None else settings.llm_temperature
    tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens

    try:
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            temperature=temp,
            max_tokens=tokens,
            api_key=settings.llm_api_key,
            api_base=settings.llm_base_url,
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as e:
        logger.error(f"Streaming LLM call failed: {e}")
        yield f"[Error: {str(e)}]"


def _format_response(response: Any) -> dict[str, Any]:
    """Format a LiteLLM response into a standardized dict."""
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


# --- API endpoints ---

@router.get("/providers")
async def list_providers() -> dict:
    """List available LLM providers and their status."""
    settings = get_settings()
    providers = [
        {
            "name": settings.llm_provider,
            "model": settings.llm_model,
            "role": "quick",
            "base_url": settings.llm_base_url,
            "configured": settings.llm_api_key != "sk-xxx",
        },
        {
            "name": settings.llm_deep_provider,
            "model": settings.llm_deep_model,
            "role": "deep",
            "base_url": settings.llm_base_url,
            "configured": settings.llm_api_key != "sk-xxx",
        },
    ]
    return {"success": True, "data": {"providers": providers}, "error": None}


@router.get("/usage")
async def get_token_usage() -> dict:
    """Get token usage statistics."""
    stats = _token_tracker.get_stats()
    return {"success": True, "data": stats, "error": None}
