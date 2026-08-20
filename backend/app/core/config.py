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
    minio_region: str = "us-east-1"
    media_public_base_url: str = "http://localhost:8080/media"

    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    # Photon (OSM autocomplete/search). Used in "photon" mode; point this at
    # the self-hosted instance later (plan: self-hosted photon).
    photon_base_url: str = "https://photon.komoot.io"
    # "static" is the deterministic dev/test mode (a handful of hardcoded
    # addresses). Production MUST set GEOCODER_MODE to a live provider
    # ("photon" or "nominatim") — otherwise real addresses fail to geocode and
    # posts cannot be published.
    geocoder_mode: str = "static"
    geocoder_cache_ttl: int = 86400

    sentry_dsn: str | None = None

    device_cookie_name: str = "device_id"
    device_cookie_secure: bool = False

    post_rate_limit_per_minute: int | None = 5
    report_threshold: int = 3

    # Link previews (ADR 0028): server-side proxy for oEmbed/OpenGraph metadata.
    preview_cache_ttl: int = 3600
    preview_timeout: float = 10.0
    preview_rate_limit_per_minute: int | None = 30

    # Shared secret for the internal admin API (/api/admin/*). Requests without
    # the correct X-Admin-Token header are rejected with 401 (ADR 0021). The
    # admin surface is bound to the loopback interface in both compose files.
    admin_token: str | None = None

    # Push notifications (ADR 0025).
    # PUSH_SENDER: "mock" (dev/test) POSTs the payload to the subscription's
    # endpoint verbatim; "webpush" delivers via pywebpush (production).
    push_sender: str = "mock"
    # VAPID keys as base64url raw values (RFC 8292). When unset (dev/test) an
    # ephemeral pair is generated at startup.
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:info@vicinopoli.it"


settings = Settings()
