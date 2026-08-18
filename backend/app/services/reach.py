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