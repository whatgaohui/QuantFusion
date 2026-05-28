from __future__ import annotations

"""
QuantFusion AI Service - FastAPI application setup.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analysis, agent, strategy, notification, backtest
from app.llm.router import router as llm_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(
        title="QuantFusion AI Service",
        description="AI intelligence engine for fused stock analysis platform",
        version="0.1.0",
    )

    # CORS middleware - allow all origins for development
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routers
    application.include_router(analysis.router, prefix="/api", tags=["analysis"])
    application.include_router(agent.router, prefix="/api", tags=["agent"])
    application.include_router(strategy.router, prefix="/api", tags=["strategy"])
    application.include_router(notification.router, prefix="/api", tags=["notification"])
    application.include_router(backtest.router, prefix="/api", tags=["backtest"])
    application.include_router(llm_router, prefix="/api/llm", tags=["llm"])

    # Health check endpoint
    @application.get("/api/health")
    async def health_check() -> dict:
        return {
            "success": True,
            "data": {
                "service": "ai-service",
                "status": "healthy",
                "version": "0.1.0",
            },
            "error": None,
        }

    return application


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
