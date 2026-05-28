from __future__ import annotations

"""
Token usage tracking for LLM calls.
Tracks prompt/completion/total tokens per provider and model.
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
from typing import Any


@dataclass
class TokenRecord:
    """A single token usage record."""
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    timestamp: float = field(default_factory=time.time)


class TokenTracker:
    """Thread-safe token usage tracker."""

    def __init__(self) -> None:
        self._records: list[TokenRecord] = []
        self._lock = Lock()

    def track(self, response: Any, provider: str = "unknown") -> None:
        """Track token usage from an LLM response."""
        try:
            usage = response.usage if hasattr(response, "usage") else None
            model = response.model if hasattr(response, "model") else "unknown"

            record = TokenRecord(
                provider=provider,
                model=model or "unknown",
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
            )

            with self._lock:
                self._records.append(record)
        except Exception:
            # Never fail the LLM call because of tracking
            pass

    def get_stats(self) -> dict[str, Any]:
        """Get aggregated token usage statistics."""
        with self._lock:
            records = list(self._records)

        if not records:
            return {
                "total_calls": 0,
                "total_tokens": 0,
                "by_provider": {},
                "by_model": {},
            }

        by_provider: dict[str, dict[str, int]] = defaultdict(lambda: {"calls": 0, "tokens": 0})
        by_model: dict[str, dict[str, int]] = defaultdict(lambda: {"calls": 0, "tokens": 0})
        total_tokens = 0

        for r in records:
            by_provider[r.provider]["calls"] += 1
            by_provider[r.provider]["tokens"] += r.total_tokens
            by_model[r.model]["calls"] += 1
            by_model[r.model]["tokens"] += r.total_tokens
            total_tokens += r.total_tokens

        return {
            "total_calls": len(records),
            "total_tokens": total_tokens,
            "by_provider": dict(by_provider),
            "by_model": dict(by_model),
        }

    def reset(self) -> None:
        """Reset all tracking data."""
        with self._lock:
            self._records.clear()
