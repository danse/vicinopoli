"""Prometheus metrics exposition (M6 hardening).

A minimal set of process/request metrics is scraped from ``/metrics`` by the
monitoring stack. No PII is exposed: only counts and durations by route.
"""

from prometheus_client import Counter, Histogram

REQUESTS = Counter(
    "vicinopoli_http_requests_total",
    "HTTP requests served, by method, route and status",
    ["method", "route", "status"],
)

DURATION = Histogram(
    "vicinopoli_http_request_duration_seconds",
    "HTTP request latency, by method and route",
    ["method", "route"],
)


def observe_request(method: str, route: str, status: int, duration_seconds: float) -> None:
    """Record one finished HTTP request."""
    REQUESTS.labels(method=method, route=route, status=str(status)).inc()
    DURATION.labels(method=method, route=route).observe(duration_seconds)
