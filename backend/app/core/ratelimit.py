"""In-memory sliding-window rate limiter keyed by device (ADR 0005).

A single-process, best-effort limiter backed by a module-level deque: enough for
the MVP, backed by a Redis store in later hardening milestones.
"""

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Record and check a hit; True if within the limit."""
        now = time.monotonic()
        with self._lock:
            window = self._hits[key]
            while window and now - window[0] > self.window_seconds:
                window.popleft()
            if len(window) >= self.limit:
                return False
            window.append(now)
            return True


def build_rate_limiter(
    limit: int | None, window_seconds: int, *, enabled: bool
) -> RateLimiter | None:
    if not enabled or limit is None:
        return None
    return RateLimiter(limit, window_seconds)


# Typed alias so endpoints can inject "a rate limiter" or None.
RateLimiterOrNone = Callable[[], "RateLimiter | None"] | RateLimiter | None
