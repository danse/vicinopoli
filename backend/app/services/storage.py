"""Object-storage helpers (ADR 0013).

MinIO is S3-compatible; the client is a thin wrapper used only to issue
presigned PUT URLs. Blobs are never proxied through the API server, but the
reverse proxy (Caddy) forwards ``/media/*`` to MinIO so browsers talk to a
single origin (no CORS). Presigned URLs are therefore signed against the
public host and consumed through the proxy.
"""

import uuid
from datetime import timedelta
from urllib.parse import urlparse

from minio import Minio

from app.core.config import settings

_client: Minio | None = None
_public_client_cache: Minio | None = None


def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
            region=settings.minio_region,
        )
        if not _client.bucket_exists(settings.minio_bucket):
            _client.make_bucket(settings.minio_bucket)
    return _client


def get_probe_client() -> Minio:
    """Return a raw MinIO client for readiness checks (no bucket creation)."""
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        region=settings.minio_region,
    )


def build_object_key(kind: str, content_type: str) -> str:
    extension = content_type.split("/")[-1]
    return f"{kind}s/{uuid.uuid4().hex}.{extension}"


def presign_put(object_key: str, expires_seconds: int = 300) -> str:
    """Return a presigned PUT URL for direct upload through the proxy.

    Signed against the public base host so the browser PUT (through the
    reverse proxy, which preserves the Host header) validates.
    """
    return _public_client().presigned_put_object(
        settings.minio_bucket, object_key, expires=timedelta(seconds=expires_seconds)
    )


def _public_client() -> Minio:
    """Client used only to build presigned URLs against the public host."""
    global _public_client_cache
    if _public_client_cache is None:
        parsed = urlparse(settings.media_public_base_url)
        _public_client_cache = Minio(
            parsed.netloc,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=parsed.scheme == "https",
            region=settings.minio_region,
        )
    return _public_client_cache


def presign_get(object_key: str, expires_seconds: int = 3600) -> str:
    """Return a short-lived presigned GET URL (private bucket, secure reads)."""
    return _public_client().presigned_get_object(
        settings.minio_bucket,
        object_key,
        expires=timedelta(seconds=expires_seconds),
    )
