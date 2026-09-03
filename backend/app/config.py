from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve relative to this file (backend/app/config.py -> backend/.env) so the
# app finds its .env regardless of the working directory it's launched from
# (local dev vs. Docker's WORKDIR). Actual secrets/deployment config always
# come from real environment variables in Docker; this file is a convenience
# for local `uvicorn` runs.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # MongoDB
    mongodb_uri: str
    mongodb_database: str = "apiwatch"
    mongodb_test_database: str = "apiwatch_test"

    # Monitoring defaults
    default_interval_seconds: int = 300
    default_timeout_seconds: int = 10
    failure_threshold: int = 1
    recovery_threshold: int = 1

    # Retention
    check_retention_days: int = 30

    # Security
    max_request_body_size_kb: int = 64
    follow_redirects: bool = True
    encryption_key: str

    # Frontend / CORS
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"

    # Notifications
    discord_webhook_url: str = ""

    # Frontend refresh (surfaced via /api/health or config endpoints if needed)
    monitor_refresh_seconds: int = 30

    # Scheduler
    enable_scheduler: bool = True

    # Monitor limits (not spec env vars, internal constants exposed for validation reuse)
    min_interval_seconds: int = 30
    max_interval_seconds: int = 86400
    min_timeout_seconds: int = 1
    max_timeout_seconds: int = 60
    manual_check_throttle_seconds: int = 5
    max_redirects: int = 5

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
