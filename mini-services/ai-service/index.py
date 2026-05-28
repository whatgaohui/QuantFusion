from __future__ import annotations

"""
QuantFusion AI Service - Entry point for bun integration.
This module provides a programmatic way to start the FastAPI server.
"""

import uvicorn


def main() -> None:
    """Start the AI service server."""
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )


if __name__ == "__main__":
    main()
