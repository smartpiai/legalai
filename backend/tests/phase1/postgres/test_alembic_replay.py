"""
PR 1.1.2 — Alembic migration replay on PostgreSQL 17.

Acceptance: IT-PG-03 (replay clean), RT-05 (downgrade round-trip).

This test:
  1. Connects to a PG 17 instance (CI service or local
     `pgvector/pgvector:pg17` container) via `TEST_PG17_ADMIN_URL` env var.
     Skips cleanly if unavailable.
  2. Creates a fresh, empty database.
  3. Runs `alembic upgrade head`.
  4. Asserts `alembic current` == script head revision.
  5. Runs `alembic downgrade base` and back up to head.
  6. Captures a deterministic schema snapshot (tables, columns, indexes,
     constraints) and compares the post-replay snapshot to the
     post-initial-upgrade snapshot — they must be byte-identical.

If any migration fails on PG 17, the failing `alembic` subprocess output
is surfaced verbatim so the offending PG-version-specific SQL can be
identified and fixed.
"""
from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pytest

# psycopg2 is already pinned in backend/requirements.txt
psycopg2 = pytest.importorskip("psycopg2")
from psycopg2 import sql  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[3]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _admin_url() -> str | None:
    """Resolve a PG 17 admin URL from env, or None to skip."""
    return (
        os.getenv("TEST_PG17_ADMIN_URL")
        or os.getenv("TEST_PG_ADMIN_URL")
        # last resort: try the standard test DATABASE_URL pointed at the
        # `postgres` maintenance DB.
        or None
    )


def _require_pg17(admin_url: str) -> None:
    """Connect to admin URL and assert server is PG 17.x; skip otherwise."""
    try:
        conn = psycopg2.connect(admin_url)
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"PostgreSQL 17 not reachable at {admin_url!r}: {exc}")
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SHOW server_version")
            version = cur.fetchone()[0]
    finally:
        conn.close()
    major = version.split(".")[0]
    if major != "17":
        pytest.skip(
            f"Expected PostgreSQL 17.x, got {version!r}. "
            "Set TEST_PG17_ADMIN_URL to a PG 17 instance "
            "(e.g. pgvector/pgvector:pg17)."
        )


@pytest.fixture(scope="module")
def pg17_admin_url() -> str:
    url = _admin_url()
    if not url:
        pytest.skip(
            "TEST_PG17_ADMIN_URL not set — provide a PG 17 admin connection "
            "string (e.g. postgresql://postgres:postgres@localhost:5432/postgres) "
            "to run the Alembic replay suite."
        )
    _require_pg17(url)
    return url


@pytest.fixture()
def fresh_db(pg17_admin_url: str):
    """Create a uniquely-named empty database; drop on teardown."""
    db_name = f"alembic_replay_{uuid.uuid4().hex[:12]}"
    admin = psycopg2.connect(pg17_admin_url)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
    finally:
        admin.close()

    parsed = urlparse(pg17_admin_url)
    target_url = urlunparse(parsed._replace(path=f"/{db_name}"))

    try:
        yield target_url
    finally:
        admin = psycopg2.connect(pg17_admin_url)
        admin.autocommit = True
        try:
            with admin.cursor() as cur:
                # Terminate any leftover connections, then drop.
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _alembic(args: list[str], db_url: str) -> subprocess.CompletedProcess:
    """Run an alembic command against `db_url` from the backend dir."""
    env = os.environ.copy()
    # env.py reads DATABASE_URL and rewrites postgresql:// → postgresql+asyncpg://
    env["DATABASE_URL"] = db_url
    env.setdefault("PYTHONPATH", str(BACKEND_DIR))
    return subprocess.run(
        ["alembic", "-c", str(ALEMBIC_INI), *args],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )


def _check(proc: subprocess.CompletedProcess, label: str) -> str:
    if proc.returncode != 0:
        raise AssertionError(
            f"{label} failed (exit {proc.returncode}).\n"
            f"--- stdout ---\n{proc.stdout}\n"
            f"--- stderr ---\n{proc.stderr}"
        )
    return proc.stdout


def _script_head() -> str:
    """Read the head revision from the local alembic script directory."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(ALEMBIC_INI))
    return ScriptDirectory.from_config(cfg).get_current_head()


def _current_revision(db_url: str) -> str:
    out = _check(_alembic(["current"], db_url), "alembic current")
    # Format: "<rev> (head)" possibly preceded by INFO log lines.
    for line in reversed(out.strip().splitlines()):
        line = line.strip()
        if not line or line.startswith("INFO"):
            continue
        return line.split()[0]
    return ""


def _schema_snapshot(db_url: str) -> dict:
    """Deterministic schema snapshot via information_schema + pg_indexes."""
    conn = psycopg2.connect(db_url)
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name, column_name, data_type, is_nullable,
                       column_default, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
                """
            )
            columns = [list(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT tc.table_name, tc.constraint_name, tc.constraint_type
                FROM information_schema.table_constraints tc
                WHERE tc.table_schema = 'public'
                ORDER BY tc.table_name, tc.constraint_name
                """
            )
            constraints = [list(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT tablename, indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public'
                ORDER BY tablename, indexname
                """
            )
            indexes = [list(r) for r in cur.fetchall()]
    finally:
        conn.close()
    return {"columns": columns, "constraints": constraints, "indexes": indexes}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_alembic_upgrade_head_clean_on_pg17(fresh_db: str):
    """IT-PG-03: all migrations apply cleanly; current == head."""
    _check(_alembic(["upgrade", "head"], fresh_db), "alembic upgrade head")
    head = _script_head()
    assert head, "Could not determine alembic script head revision"
    current = _current_revision(fresh_db)
    assert current == head, (
        f"alembic current ({current!r}) does not equal script head ({head!r})"
    )


def test_alembic_downgrade_base_then_upgrade_head_roundtrip(fresh_db: str):
    """RT-05: downgrade base + re-upgrade head; final schema unchanged."""
    _check(_alembic(["upgrade", "head"], fresh_db), "alembic upgrade head (initial)")
    snapshot_initial = _schema_snapshot(fresh_db)

    _check(
        _alembic(["downgrade", "base"], fresh_db), "alembic downgrade base"
    )

    # After downgrade base, no migration-managed tables should remain other
    # than alembic_version itself.
    after_down = _schema_snapshot(fresh_db)
    leftover_tables = {
        c[0] for c in after_down["columns"] if c[0] != "alembic_version"
    }
    assert not leftover_tables, (
        f"Tables remained after downgrade base: {sorted(leftover_tables)}"
    )

    _check(_alembic(["upgrade", "head"], fresh_db), "alembic upgrade head (replay)")
    snapshot_replay = _schema_snapshot(fresh_db)

    # Stable JSON-string compare for clearer diffs on failure.
    assert json.dumps(snapshot_replay, sort_keys=True) == json.dumps(
        snapshot_initial, sort_keys=True
    ), "Schema after downgrade→upgrade does not match initial upgrade snapshot"
