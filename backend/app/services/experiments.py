"""Experiment segment + feature flags (ADR 0014).

Each device maps deterministically to a segment 0..99 from its id. Feature
flags are pure functions of that segment so a device consistently sees the
same treatment across requests. No PII is involved.
"""

import hashlib
from uuid import UUID

N_SEGMENTS = 100

EXPERIMENT_FEATURE_FLAGS: dict[str, list[bool]] = {
    # A toggle is on for exactly the segments listed.
    # The heatmap UI is hidden pending a working render; off for all segments.
    "heatmap": [],
}


def segment_for(device_id: UUID) -> int:
    digest = hashlib.sha256(str(device_id).encode()).digest()
    return int.from_bytes(digest[:8], "big") % N_SEGMENTS


def feature_flags(segment: int) -> dict[str, bool]:
    return {name: seg_has_flag(segment, flags) for name, flags in EXPERIMENT_FEATURE_FLAGS.items()}


def seg_has_flag(segment: int, enabled_segments: list[bool]) -> bool:
    if not enabled_segments:
        return False
    return bool(enabled_segments[min(segment, len(enabled_segments) - 1)])