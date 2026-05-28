from __future__ import annotations

"""
Application configuration loaded from environment variables.
Uses pydantic-settings for type-safe configuration management.
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service configuration
    service_name: str = "ai-service"
    service_version: str = "0.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # LLM - Default (quick) provider
    llm_provider: str = "deepseek"
    llm_model: str = "deepseek-chat"
    llm_api_key: str = "sk-xxx"
    llm_base_url: str = "https://api.deepseek.com"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 4096

    # LLM - Deep thinking provider
    llm_deep_provider: str = "deepseek"
    llm_deep_model: str = "deepseek-reasoner"

    # Go Data Service
    go_data_service_url: str = "http://localhost:8080"

    # Notification channels
    wechat_webhook_url: str = ""
    feishu_webhook_url: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    email_smtp_host: str = ""
    email_smtp_port: int = 587
    email_smtp_user: str = ""
    email_smtp_password: str = ""
    email_from: str = ""
    webhook_url: str = ""

    @property
    def go_data_api_url(self) -> str:
        """Get the Go data service API base URL."""
        return f"{self.go_data_service_url}/api"

    @property
    def litellm_quick_model(self) -> str:
        """Get the LiteLLM-format model string for quick calls."""
        return f"{self.llm_provider}/{self.llm_model}"

    @property
    def litellm_deep_model(self) -> str:
        """Get the LiteLLM-format model string for deep calls."""
        return f"{self.llm_deep_provider}/{self.llm_deep_model}"


# Singleton settings instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get the application settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reload_settings() -> Settings:
    """Force reload settings from environment."""
    global _settings
    _settings = Settings()
    return _settings
