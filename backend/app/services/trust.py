"""Trust ladder (ADR 0005, revised by ADR 0022).

New/unknown devices can post immediately but with a reduced *daily posting
quota* until they accrue trust via age and a clean report history. Trust no
longer gates reach — reach is a simple, trust-free property of the post (see
``app.services.reach`` and ADR 0022).

The quota is user-facing and transparent: a brand-new neighbour can publish
``UNTRUSTED_DAILY_POSTS`` per day and the composer tells them so, with a note
that the limit rises once the device has been around for a while.
"""

from datetime import UTC, datetime

from app.models.device import Device

# Trust accrues with age: after ``trusted_after`` days the device is trusted.
TRUSTED_AFTER_DAYS = 7

# Daily posting quotas: a new neighbour can post 3 times a day, a trusted one
# 30. Counted against the device's posts in the current UTC day.
UNTRUSTED_DAILY_POSTS = 3
TRUSTED_DAILY_POSTS = 30


def device_age_days(device: Device, now: datetime | None = None) -> float:
    """Age of the device in days (0.0 if ``created_at`` is missing)."""
    if device.created_at is None:
        return 0.0
    reference = now or datetime.now(UTC)
    created = device.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    return max(0.0, (reference - created).total_seconds() / 86400)


def daily_post_quota(device: Device, now: datetime | None = None) -> int:
    """How many posts this device may publish in a UTC day."""
    if is_trusted(device, now):
        return TRUSTED_DAILY_POSTS
    return UNTRUSTED_DAILY_POSTS


def is_trusted(device: Device, now: datetime | None = None) -> bool:
    """A device is trusted once it has aged past the threshold."""
    if device.status.value == "banned":
        return False
    return device_age_days(device, now) >= TRUSTED_AFTER_DAYS


def is_new_neighbour(device: Device, now: datetime | None = None) -> bool:
    """Feed flag for devices that have not yet accrued trust."""
    return not is_trusted(device, now)