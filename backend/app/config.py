from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL"
    )
    openrouter_http_referer: str = Field(
        default="https://sentient-roundtable.app", alias="OPENROUTER_HTTP_REFERER"
    )

    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    session_ttl_seconds: int = Field(default=14_400, alias="SESSION_TTL_SECONDS")
    model_cache_ttl_seconds: int = Field(default=3_600, alias="MODEL_CACHE_TTL_SECONDS")

    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    def cors_origins_list(self) -> list[str]:
        """Return normalized list of CORS origins from comma-separated env value."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance used across the app lifecycle."""
    return Settings()  # type: ignore[call-arg]
