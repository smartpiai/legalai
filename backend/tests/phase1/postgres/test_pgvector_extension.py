"""IT-PV-01: the `vector` extension exists after `alembic upgrade head`."""
from __future__ import annotations

import pytest

psycopg2 = pytest.importorskip("psycopg2")


def test_pgvector_extension_installed(migrated_db_url: str) -> None:
    """After migrations run, pg_extension must contain a row for 'vector'."""
    conn = psycopg2.connect(migrated_db_url)
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
            )
            row = cur.fetchone()
    finally:
        conn.close()

    assert row is not None, (
        "pgvector extension not present in pg_extension after alembic upgrade head — "
        "migration 010 should have executed `CREATE EXTENSION IF NOT EXISTS vector`."
    )
    assert row[0] == "vector"
    assert row[1], "pg_extension.extversion should be populated for vector"
