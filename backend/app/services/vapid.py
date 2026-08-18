"""VAPID key management (RFC 8292, ADR 0025).

The public key is served to the browser (``GET /api/push/config``) so it can
``pushManager.subscribe``; the private key signs every push sent by the
``webpush`` sender. Keys are base64url raw values. When unset in
dev/test, an ephemeral P-256 pair is generated at startup.
"""

import base64
from functools import lru_cache

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.core.config import settings


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _generate_keypair() -> tuple[str, str]:
    """Return ``(public_key, private_key)`` as base64url raw values."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_raw = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
    return _b64url(public_raw), _b64url(private_raw)


@lru_cache(maxsize=1)
def vapid_keys() -> tuple[str, str]:
    """Return the configured ``(public_key, private_key)`` or generate a pair."""
    if settings.vapid_public_key and settings.vapid_private_key:
        return settings.vapid_public_key, settings.vapid_private_key
    return _generate_keypair()