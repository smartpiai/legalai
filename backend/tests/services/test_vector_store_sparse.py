"""
Unit tests for PR 1.4.4 sparse vector support (IT-QD-05).

These tests exercise the sparse validation, config, and fusion logic in
``app.core.vector_store`` without a live Qdrant instance (the Qdrant
client calls themselves are covered by the skipped integration suite in
``tests/integration/test_qdrant.py``).
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Dict, List
from unittest.mock import MagicMock

import pytest

pytest.importorskip("qdrant_client")

from app.core.vector_store import (  # noqa: E402
    DENSE_VECTOR_NAME,
    DENSE_VECTOR_SIZE,
    SPARSE_VECTOR_NAME,
    InvalidSparseVector,
    QdrantConnection,
    _validate_sparse,
    build_sparse_vectors_config,
    hybrid_search,
    search_sparse,
    upsert_with_sparse,
)
from qdrant_client.models import Modifier, SparseVector, SparseVectorParams, UpdateStatus


# ---------------------------------------------------------------------------
# build_sparse_vectors_config
# ---------------------------------------------------------------------------


def test_build_sparse_vectors_config_declares_sparse_idf():
    cfg = build_sparse_vectors_config()
    assert SPARSE_VECTOR_NAME in cfg
    params = cfg[SPARSE_VECTOR_NAME]
    assert isinstance(params, SparseVectorParams)
    assert params.modifier == Modifier.IDF


# ---------------------------------------------------------------------------
# _validate_sparse (ID Spec §6)
# ---------------------------------------------------------------------------


class TestValidateSparse:
    def test_happy_path_returns_sparse_vector(self):
        sv = _validate_sparse([1, 5, 42], [0.1, 2.5, 0.9])
        assert isinstance(sv, SparseVector)
        assert sv.indices == [1, 5, 42]
        assert sv.values == [0.1, 2.5, 0.9]

    def test_length_mismatch(self):
        with pytest.raises(InvalidSparseVector, match="length mismatch"):
            _validate_sparse([1, 2], [0.5])

    def test_empty_rejected(self):
        with pytest.raises(InvalidSparseVector, match=r"nnz must be in"):
            _validate_sparse([], [])

    def test_over_10k_rejected(self):
        n = 10_001
        with pytest.raises(InvalidSparseVector, match=r"nnz must be in"):
            _validate_sparse(list(range(n)), [1.0] * n)

    def test_negative_index(self):
        with pytest.raises(InvalidSparseVector, match="int32"):
            _validate_sparse([-1, 2], [0.5, 0.5])

    def test_unsorted_or_duplicate_indices(self):
        with pytest.raises(InvalidSparseVector, match="strictly ascending"):
            _validate_sparse([3, 1], [0.5, 0.5])
        with pytest.raises(InvalidSparseVector, match="strictly ascending"):
            _validate_sparse([3, 3], [0.5, 0.5])

    def test_non_positive_value(self):
        with pytest.raises(InvalidSparseVector, match="must be > 0"):
            _validate_sparse([1, 2], [0.5, 0.0])

    def test_non_finite_value(self):
        with pytest.raises(InvalidSparseVector, match="finite"):
            _validate_sparse([1, 2], [0.5, float("nan")])


# ---------------------------------------------------------------------------
# Helpers to stub QdrantConnection
# ---------------------------------------------------------------------------


def _make_conn() -> QdrantConnection:
    conn = QdrantConnection.__new__(QdrantConnection)
    conn.client = MagicMock()
    return conn


def _hit(id_: str, score: float) -> SimpleNamespace:
    return SimpleNamespace(id=id_, score=score, payload={"id": id_})


def _response(hits: List[SimpleNamespace]) -> SimpleNamespace:
    return SimpleNamespace(points=hits)


# ---------------------------------------------------------------------------
# upsert_with_sparse
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upsert_with_sparse_builds_named_vector_points():
    conn = _make_conn()
    conn.client.upsert.return_value = SimpleNamespace(status=UpdateStatus.COMPLETED)

    dense = [0.01] * DENSE_VECTOR_SIZE
    result = await upsert_with_sparse(
        conn,
        "c",
        points=[{"id": "p1", "payload": {"tenant_id": "t1"}}],
        dense_vectors=[dense],
        sparse_vectors=[{"indices": [1, 5], "values": [0.7, 1.2]}],
    )

    assert result == {"status": "success", "inserted_count": 1}
    conn.client.upsert.assert_called_once()
    sent_points = conn.client.upsert.call_args.kwargs["points"]
    assert len(sent_points) == 1
    v = sent_points[0].vector
    assert DENSE_VECTOR_NAME in v and SPARSE_VECTOR_NAME in v
    assert isinstance(v[SPARSE_VECTOR_NAME], SparseVector)
    assert v[SPARSE_VECTOR_NAME].indices == [1, 5]


@pytest.mark.asyncio
async def test_upsert_with_sparse_rejects_dense_dim_mismatch():
    conn = _make_conn()
    with pytest.raises(ValueError, match="Dense vector dim"):
        await upsert_with_sparse(
            conn,
            "c",
            points=[{"id": "p1", "payload": {"tenant_id": "t1"}}],
            dense_vectors=[[0.0] * 10],
            sparse_vectors=[{"indices": [1], "values": [0.5]}],
        )


@pytest.mark.asyncio
async def test_upsert_with_sparse_propagates_invalid_sparse():
    conn = _make_conn()
    with pytest.raises(InvalidSparseVector):
        await upsert_with_sparse(
            conn,
            "c",
            points=[{"id": "p1", "payload": {"tenant_id": "t1"}}],
            dense_vectors=[[0.01] * DENSE_VECTOR_SIZE],
            sparse_vectors=[{"indices": [2, 1], "values": [0.5, 0.5]}],
        )


# ---------------------------------------------------------------------------
# search_sparse
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_sparse_uses_sparse_channel_and_enforces_tenant():
    conn = _make_conn()
    conn.client.query_points.return_value = _response(
        [_hit("a", 0.9), _hit("b", 0.5)]
    )

    out = await search_sparse(
        conn, "c",
        query_indices=[1, 3],
        query_values=[0.6, 0.4],
        tenant_id="t1",
        limit=5,
    )
    assert [h["id"] for h in out] == ["a", "b"]
    kwargs = conn.client.query_points.call_args.kwargs
    assert kwargs["using"] == SPARSE_VECTOR_NAME
    assert isinstance(kwargs["query"], SparseVector)
    # Tenant filter must be present
    qf = kwargs["query_filter"]
    assert any(
        getattr(c, "key", None) == "tenant_id" for c in qf.must
    )


@pytest.mark.asyncio
async def test_search_sparse_requires_tenant_id():
    conn = _make_conn()
    with pytest.raises(ValueError, match="tenant_id"):
        await search_sparse(
            conn, "c",
            query_indices=[1],
            query_values=[0.5],
            tenant_id=None,  # type: ignore[arg-type]
        )


# ---------------------------------------------------------------------------
# hybrid_search RRF fusion
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_hybrid_search_fuses_dense_and_sparse_via_rrf():
    conn = _make_conn()

    # First call = dense search → ranks [a, b, c]
    # Second call = sparse search → ranks [c, b, d]
    conn.client.query_points.side_effect = [
        _response([_hit("a", 0.9), _hit("b", 0.8), _hit("c", 0.7)]),
        _response([_hit("c", 0.9), _hit("b", 0.8), _hit("d", 0.7)]),
    ]

    dense_query = [0.01] * DENSE_VECTOR_SIZE
    results = await hybrid_search(
        conn, "c",
        query_vector=dense_query,
        tenant_id="t1",
        query_sparse_indices=[1, 2],
        query_sparse_values=[0.5, 0.5],
        limit=4,
        rrf_k=60,
    )

    ids = [r["id"] for r in results]
    # b appears in both lists so fusion should rank it first (highest summed RRF)
    assert ids[0] == "b"
    # All four unique ids present
    assert set(ids) == {"a", "b", "c", "d"}
    # Two query_points calls: dense, then sparse
    assert conn.client.query_points.call_count == 2
    usings = [
        call.kwargs["using"] for call in conn.client.query_points.call_args_list
    ]
    assert usings == [DENSE_VECTOR_NAME, SPARSE_VECTOR_NAME]


@pytest.mark.asyncio
async def test_hybrid_search_dense_only_when_no_sparse_query():
    conn = _make_conn()
    conn.client.query_points.return_value = _response(
        [_hit("a", 0.9), _hit("b", 0.5)]
    )
    results = await hybrid_search(
        conn, "c",
        query_vector=[0.01] * DENSE_VECTOR_SIZE,
        tenant_id="t1",
        limit=2,
    )
    assert [r["id"] for r in results] == ["a", "b"]
    assert conn.client.query_points.call_count == 1
