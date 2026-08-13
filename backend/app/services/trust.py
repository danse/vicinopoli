"""Trust ladder (ADR 0005).

New/unknown devices can post immediately but with reduced reach — their posts
are capped to the smallest scope — until they accrue trust via age and a clean
report history.
"""

from datetime import UTC, datetime

from app.models.device import Device
from app.models.post import PostScope

# Trust accrues with age: after ``trusted_after`` days the device is trusted.
TRUSTED_AFTER_DAYS = 7

# Reduced reach while untrusted: smallest scope only.
UNTRUSTED_SCOPE = PostScope.r500m


def device_age_days(device: Device, now: datetime | None = None) -> float:
    """Age of the device in days (0.0 if ``created_at`` is missing)."""
    if device.created_at is None:
        return 0.0
    reference = now or datetime.now(UTC)
    created = device.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    return max(0.0, (reference - created).total_seconds() / 86400)


def is_trusted(device: Device, now: datetime | None = None) -> bool:
    """A device is trusted once it has aged past the threshold."""
    if device.status.value == "banned":
        return False
    return device_age_days(device, now) >= TRUSTED_AFTER_DAYS


def effective_scope(device: Device, requested: PostScope, now: datetime | None = None) -> PostScope:
    """Cap the requested scope for untrusted devices (ADR 0005).

    ``building`` is the most restrictive scope (same normalized address), so it
    is always honoured; radius scopes are capped to the smallest radius while
    the device has not yet accrued trust.
    """
    if is_trusted(device, now) or requested == PostScope.building:
        return requested
    return UNTRUSTED_SCOPE


def is_new_neighbour(device: Device, now: datetime | None = None) -> bool:
    """Feed flag for devices that have not yet accrued trust."""
    return not is_trusted(device, now)
