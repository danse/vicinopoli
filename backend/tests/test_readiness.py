"""Readiness probe tests (M6 hardening).

The health surface must tell us whether downstream dependencies (the database
and the object store) are actually reachable, not just whether the process is
up. We test the checker with a fake session and a fake object-store client so
the unit tests never touch the network.
"""

import pytest

from app.services.readiness import check_database, check_object_store, readiness_checks


class FakeSession:
    """Minimal stand-in for an AsyncSession whose execute() can be primed."""

    def __init__(self, *, ok: bool, raised: type[Exception] | None = None) -> None:
        self._ok = ok
        self._raised = raised

    async def execute(self, statement: object) -> None:
        if self._raised is not None:
            raise self._raised
        if not self._ok:
            raise RuntimeError("SELECT 1 failed")

    async def commit(self) -> None:
        return None


class FakeObjectStore:
    def __init__(self, *, ok: bool, raised: type[Exception] | None = None) -> None:
        self._ok = ok
        self._raised = raised
        self.called = False

    def bucket_exists(self, name: str) -> bool:
        self.called = True
        if self._raised is not None:
            raise self._raised
        return self._ok


@pytest.mark.asyncio
async def test_database_check_true() -> None:
    assert await check_database(FakeSession(ok=True)) is True


@pytest.mark.asyncio
async def test_database_check_false_on_execute_failure() -> None:
    assert await check_database(FakeSession(ok=False)) is False


@pytest.mark.asyncio
async def test_object_store_check_true() -> None:
    store = FakeObjectStore(ok=True)
    assert await check_object_store(store) is True
    assert store.called


@pytest.mark.asyncio
async def test_object_store_check_false_on_exception() -> None:
    store = FakeObjectStore(ok=True, raised=TimeoutError)
    assert await check_object_store(store) is False
    assert store.called


@pytest.mark.asyncio
async def test_readiness_checks_aggregate() -> None:
    db = FakeSession(ok=True)
    store = FakeObjectStore(ok=True)
    assert await readiness_checks(db, store) == {"database": True, "object_store": True}


@pytest.mark.asyncio
async def test_readiness_checks_flag_failures() -> None:
    db = FakeSession(ok=False)
    store = FakeObjectStore(ok=False)
    assert await readiness_checks(db, store) == {"database": False, "object_store": False}


@pytest.mark.asyncio
async def test_readyz_returns_200_when_all_checks_pass(client, monkeypatch) -> None:
    monkeypatch.setattr("app.main.get_probe_client", lambda: FakeObjectStore(ok=True))

    response = await client.get("/readyz")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"] == {"database": True, "object_store": True}


@pytest.mark.asyncio
async def test_readyz_returns_503_when_dependency_is_down(client, monkeypatch) -> None:
    monkeypatch.setattr("app.main.get_probe_client", lambda: FakeObjectStore(ok=False))

    response = await client.get("/readyz")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["checks"] == {"database": True, "object_store": False}
