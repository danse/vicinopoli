"""Tests for the Prometheus metrics endpoint and middleware."""

import pytest
from prometheus_client import REGISTRY

from app.services.metrics import observe_request


def test_observe_request_increments_counter() -> None:
    observe_request("GET", "/api/feed", 200, 0.01)
    observe_request("GET", "/api/feed", 200, 0.02)

    value = REGISTRY.get_sample_value(
        "vicinopoli_http_requests_total",
        {"method": "GET", "route": "/api/feed", "status": "200"},
    )
    assert value == 2.0


def test_observe_request_records_histogram() -> None:
    observe_request("POST", "/api/posts", 201, 0.5)

    count = REGISTRY.get_sample_value(
        "vicinopoli_http_request_duration_seconds_count",
        {"method": "POST", "route": "/api/posts"},
    )
    assert count == 1.0


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_prometheus_text(client) -> None:
    response = await client.get("/metrics")

    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "vicinopoli_http_requests_total" in response.text
