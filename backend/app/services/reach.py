"""Voice-to-reach conversion (glossary: reach; ADR 0024).

``reach`` is the distance a post travels, derived in the feed from the stored
``voice`` via the fixed mapping ``VOICE_TO_REACH_M``:

- ``street`` -> 5m
- ``some``   -> 500m
- ``area``   -> 3km
- ``city``   -> 50km

The conversion is deliberately a fixed, honest lookup — it is NOT
trust-derived (ADR 0022 gates daily posting volume instead) and NOT
density-derived: an author's intent is a distance, not "whatever the crowd
allows". ``street`` is a 5m radius (there are no street numbers yet), not a
normalized address key match.
"""

from enum import StrEnum

from app.schemas.post import PostVoice

# Voice -> reach in metres (glossary: reach). The single source of truth for
# how far a post travels; the adaptive-feed scope ladder derives from these
# values (see ``app.services.feed``).
VOICE_TO_REACH_M: dict[PostVoice, int] = {
    PostVoice.street: 5,
    PostVoice.some: 500,
    PostVoice.area: 3_000,
    PostVoice.city: 50_000,
}


class ScopeStep(StrEnum):
    """The feed's expanding-radius ladder (human-readable radius strings).

    A static ``StrEnum`` so it is usable as a type annotation and accepted as
    the feed's ``radius_m`` query param; an import-time assertion below keeps
    its values in lockstep with ``VOICE_TO_REACH_M``.
    """

    r5m = "5m"
    r500m = "500m"
    r3km = "3km"
    r50km = "50km"


def scope_step_to_m(step: ScopeStep) -> int:
    """Convert a ``ScopeStep`` back to metres."""
    value = step.value
    if value.endswith("km"):
        return int(value[:-2]) * 1000
    return int(value[:-1])


# Guard against drift: the accepted scope steps must always equal the sorted
# voice reaches, or the feed ladder would silently diverge from post reach.
assert tuple(sorted(scope_step_to_m(step) for step in ScopeStep)) == tuple(
    sorted(set(VOICE_TO_REACH_M.values()))
), "ScopeStep drifted from VOICE_TO_REACH_M"