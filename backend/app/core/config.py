"""Application settings.

Values are read from environment variables (and an optional ``.env`` file).
Secrets are never committed; see ``backend/.env.example``.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "vicinopoli"
    environment: str = "development"

    database_url: str = "postgresql+asyncpg://vicinopoli:vicinopoli@localhost:5432/vicinopoli"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "media"
    minio_secure: bool = False

    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    geocoder_mode: str = "static"
    geocoder_cache_ttl: int = 86400

    sentry_dsn: str | None = None

    device_cookie_name: str = "device_id"
    device_cookie_secure: bool = False

    post_rate_limit_per_minute: int | None = 5
    report_threshold: int = 3


settings = Settings()
