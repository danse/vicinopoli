"""Shared test fixtures.

Tests run against a real PostGIS instance (the dev docker stack, reachable on
localhost:5433) per ADR 0011 — never SQLite. The schema is created once per
session from the ORM metadata and truncated between tests.
"""

import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://vicinopoli:vicinopoli@localhost:5433/vicinopoli_test",
)
os.environ.setdefault("GEOCODER_MODE", "static")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.api.deps import get_geocoder, get_session
from app.core.geocoder import StaticGeocoder
from app.main import app
from app.models import Base

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def session_factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def _truncate_tables(session_factory):
    yield
    async with session_factory() as session:
        await session.execute(
            text("TRUNCATE reports, posts, devices, locations RESTART IDENTITY CASCADE")
        )
        await session.commit()


@pytest_asyncio.fixture(loop_scope="session")
async def client(session_factory):
    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_geocoder] = lambda: StaticGeocoder()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
