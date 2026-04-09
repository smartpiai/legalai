"""IT-PV-02: document_embeddings table + HNSW + B-tree(tenant_id) exist."""
from __future__ import annotations

import pytest

psycopg2 = pytest.importorskip("psycopg2")


def _fetchall(conn, query: str, params: tuple = ()) -> list[tuple]:
    with conn.cursor() as cur:
        cur.execute(query, params)
        return list(cur.fetchall())


def test_document_embeddings_table_exists(migrated_db_url: str) -> None:
    conn = psycopg2.connect(migrated_db_url)
    try:
        conn.autocommit = True

        # Table exists.
        rows = _fetchall(
            conn,
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='document_embeddings'",
        )
        assert rows, "document_embeddings table not created by migration 010"

        # Expected columns present with correct data types.
        cols = dict(
            _fetchall(
                conn,
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='document_embeddings'",
            )
        )
        for expected in (
            "id",
            "tenant_id",
            "document_id",
            "chunk_index",
            "embedding",
            "model_name",
            "created_at",
        ):
            assert expected in cols, f"missing column {expected!r}; got {sorted(cols)}"

        assert cols["id"] == "uuid"
        assert cols["tenant_id"] == "uuid"
        assert cols["document_id"] == "uuid"
        # pgvector reports "USER-DEFINED" for the `vector` type.
        assert cols["embedding"] in ("USER-DEFINED", "vector")
    finally:
        conn.close()


def test_hnsw_index_exists(migrated_db_url: str) -> None:
    conn = psycopg2.connect(migrated_db_url)
    try:
        conn.autocommit = True
        rows = _fetchall(
            conn,
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE schemaname='public' AND tablename='document_embeddings'",
        )
    finally:
        conn.close()

    by_name = {name: ddl for name, ddl in rows}
    assert "idx_document_embeddings_hnsw" in by_name, (
        f"HNSW index missing; indexes present: {sorted(by_name)}"
    )
    hnsw_ddl = by_name["idx_document_embeddings_hnsw"].lower()
    assert "using hnsw" in hnsw_ddl, f"expected HNSW access method, got {hnsw_ddl}"
    assert "vector_cosine_ops" in hnsw_ddl, (
        "HNSW index must use vector_cosine_ops opclass"
    )


def test_btree_index_on_tenant_id(migrated_db_url: str) -> None:
    conn = psycopg2.connect(migrated_db_url)
    try:
        conn.autocommit = True
        rows = _fetchall(
            conn,
            """
            SELECT i.relname, am.amname
              FROM pg_class t
              JOIN pg_index ix ON ix.indrelid = t.oid
              JOIN pg_class i  ON i.oid = ix.indexrelid
              JOIN pg_am am    ON am.oid = i.relam
             WHERE t.relname = 'document_embeddings'
            """,
        )
    finally:
        conn.close()

    btree_indexes = {name for name, am in rows if am == "btree"}
    assert "idx_document_embeddings_tenant" in btree_indexes, (
        f"expected btree index idx_document_embeddings_tenant; got {btree_indexes}"
    )
