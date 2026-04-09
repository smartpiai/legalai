"""Shared fixtures for the pgvector integration test suite (PR 1.2.5).

Each test gets a freshly-created PostgreSQL 17 database with the full
Alembic schema applied, plus an async SQLAlchemy session and a helper
to seed minimal ``tenants`` / ``documents`` rows (no ORM models exist
for those tables yet, so we insert via raw SQL).

The whole module skips cleanly if a PG 17 instance is not reachable
via ``TEST_PG17_ADMIN_URL`` (or ``TEST_PG_ADMIN_URL``).
"""
from __future__ import annotations

import os
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator, Callable
from urllib.parse import urlparse, urlunparse

import pytest
import pytest_asyncio

psycopg2 = pytest.importorskip("psycopg2")
from psycopg2 import sql  # noqa: E402

# Skip the whole pgvector suite if SQLAlchemy async / asyncpg aren't installed.
pytest.importorskip("sqlalchemy.ext.asyncio")
pytest.importorskip("asyncpg")

from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

BACKEND_DIR = Path(__file__).resolve().parents[3]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


# --------------------------------------------------------------------------- #
# PG 17 discovery
# --------------------------------------------------------------------------- #
def _admin_url() -> str | None:
    return os.getenv("TEST_PG17_ADMIN_URL") or os.getenv("TEST_PG_ADMIN_URL")


def _require_pg17(admin_url: str) -> None:
    try:
        conn = psycopg2.connect(admin_url)
    except Exception as exc:  # pragma: no cover - env dependent
        pytest.skip(f"PostgreSQL 17 not reachable at {admin_url!r}: {exc}")
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SHOW server_version")
            version = cur.fetchone()[0]
    finally:
        conn.close()
    if version.split(".")[0] != "17":
        pytest.skip(
            f"Expected PostgreSQL 17.x, got {version!r}. "
            "Set TEST_PG17_ADMIN_URL to a pgvector/pgvector:pg17 instance."
        )


@pytest.fixture(scope="session")
def pg17_admin_url() -> str:
    url = _admin_url()
    if not url:
        pytest.skip(
            "TEST_PG17_ADMIN_URL not set — provide a PG 17 admin URL to run "
            "the pgvector integration suite."
        )
    _require_pg17(url)
    return url


# --------------------------------------------------------------------------- #
# Fresh migrated DB per test
# --------------------------------------------------------------------------- #
def _alembic_upgrade_head(db_url: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = db_url
    env.setdefault("PYTHONPATH", str(BACKEND_DIR))
    proc = subprocess.run(
        ["alembic", "-c", str(ALEMBIC_INI), "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise AssertionError(
            "alembic upgrade head failed.\n"
            f"--- stdout ---\n{proc.stdout}\n"
            f"--- stderr ---\n{proc.stderr}"
        )


@pytest.fixture()
def migrated_db_url(pg17_admin_url: str) -> str:
    """Create a fresh DB, run alembic upgrade head, return the sync URL."""
    db_name = f"pgvector_it_{uuid.uuid4().hex[:12]}"

    admin = psycopg2.connect(pg17_admin_url)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            cur.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name))
            )
    finally:
        admin.close()

    parsed = urlparse(pg17_admin_url)
    target_url = urlunparse(parsed._replace(path=f"/{db_name}"))

    try:
        _alembic_upgrade_head(target_url)
        yield target_url
    finally:
        admin = psycopg2.connect(pg17_admin_url)
        admin.autocommit = True
        try:
            with admin.cursor() as cur:
                cur.execute(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = %s AND pid <> pg_backend_pid()",
                    (db_name,),
                )
                cur.execute(
                    sql.SQL("DROP DATABASE IF EXISTS {}").format(
                        sql.Identifier(db_name)
                    )
                )
        finally:
            admin.close()


def _to_asyncpg(url: str) -> str:
    parsed = urlparse(url)
    scheme = "postgresql+asyncpg"
    return urlunparse(parsed._replace(scheme=scheme))


@pytest_asyncio.fixture()
async def async_session(migrated_db_url: str) -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(_to_asyncpg(migrated_db_url), future=True)
    maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with maker() as session:
        try:
            yield session
        finally:
            await session.rollback()
    await engine.dispose()


# --------------------------------------------------------------------------- #
# Fixture rows (raw SQL — no ORM models for tenants/documents yet)
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class FixtureIds:
    tenant_id: uuid.UUID
    document_id: uuid.UUID


@pytest.fixture()
def seed_tenant_and_document(migrated_db_url: str) -> Callable[..., FixtureIds]:
    """Return a callable that inserts a tenant + document row and returns UUIDs.

    Uses raw SQL through psycopg2 so the test does not depend on ORM models
    that have not been authored yet. Inserts are intentionally minimal and
    rely only on NOT NULL columns declared by migrations 001 and 004.
    """
    created: list[tuple[uuid.UUID, uuid.UUID]] = []

    def _seed(
        tenant_id: uuid.UUID | None = None,
        document_id: uuid.UUID | None = None,
    ) -> FixtureIds:
        tid = tenant_id or uuid.uuid4()
        did = document_id or uuid.uuid4()
        conn = psycopg2.connect(migrated_db_url)
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tenants (id, name, slug, is_active, settings,
                                         created_at, updated_at)
                    VALUES (%s, %s, %s, TRUE, '{}'::json, NOW(), NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (str(tid), f"tenant-{tid}", f"t-{tid.hex[:10]}"),
                )
                cur.execute(
                    """
                    INSERT INTO documents
                        (id, name, file_path, file_size, mime_type,
                         tenant_id, is_active, version,
                         created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE, 1, NOW(), NOW())
                    """,
                    (
                        str(did),
                        f"doc-{did.hex[:8]}.pdf",
                        f"/tmp/{did.hex}.pdf",
                        1024,
                        "application/pdf",
                        str(tid),
                    ),
                )
        finally:
            conn.close()
        created.append((tid, did))
        return FixtureIds(tenant_id=tid, document_id=did)

    return _seed


# --------------------------------------------------------------------------- #
# Deterministic vector generator
# --------------------------------------------------------------------------- #
@pytest.fixture()
def seeded_vectors() -> Callable[[int, int], list[list[float]]]:
    """Return a function that yields N deterministic unit-norm 1536-dim vectors."""
    np = pytest.importorskip("numpy")

    def _gen(count: int, seed: int = 42) -> list[list[float]]:
        rng = np.random.default_rng(seed)
        mat = rng.standard_normal((count, 1536)).astype("float64")
        # L2-normalize so cosine distances are well-defined and bounded.
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        mat = mat / norms
        return [row.tolist() for row in mat]

    return _gen
