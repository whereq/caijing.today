"""Application configuration management.

Reads from environment / .env. Defaults point at the shared dev PostgreSQL and
the KeyToMarvel.com Keycloak server (caijing.today gets its own realm).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """caijing.today API settings loaded from environment variables."""

    # Database — the SAME PostgreSQL instance flowdesk.top uses. The news tables
    # (market_news_items, market_signals, sector_intelligence) are populated by
    # the shared collector; this API only reads them.
    database_url: str = "postgresql+asyncpg://flowdesk:flowdesk@localhost:5432/flowdesk"

    # Keycloak / JWT (public client — SPA). caijing.today has its own realm on the
    # shared KeyToMarvel.com Keycloak server.
    keycloak_url: str = "https://www.keytomarvel.com"
    keycloak_realm: str = "caijing.today"
    keycloak_client_id: str = "caijing-spa"

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://caijing.today",
        "https://www.caijing.today",
    ]

    # Default look-back window (hours) for "hot" ranking and flash feeds.
    news_default_window_hours: int = 24

    # The shared collector now populates the news + cj_* tables, so the API serves
    # real data by default. Seed fallback stays available for offline/local dev
    # without a DB — enable it via env when there is no database attached.
    seed_fallback_enabled: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
