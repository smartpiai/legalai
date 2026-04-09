"""IT-QD-06: legacy single-vector collection still reads via dual-read shim.

Creates a pre-1.4.3 style collection with an **unnamed** single vector and
verifies:

1. ``QdrantVectorStore.search(..., legacy_fallback=True)`` on the dense
   channel transparently routes to it.
2. A sparse read against the same legacy collection raises
   ``LegacyCollectionNoSparse``.
"""
from __future__ import annotations

import asyncio
import uuid

import pytest
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.core.vector_store import (
    DENSE_VECTOR_SIZE,
    LegacyCollectionNoSparse,
    QdrantVectorStore,
    SPARSE_VECTOR_NAME,
    build_collection_name,
)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_legacy_collection_dual_read(
    qdrant_raw_client, qdrant_connection, cleanup_collection
) -> None:
    logical = f"legacy_{uuid.uuid4().hex[:8]}"
    legacy_name = logical  # v1 layout used the bare logical name
    v2_name = build_collection_name(logical)
    cleanup_collection(legacy_name)
    cleanup_collection(v2_name)

    # v1-style collection: unnamed single vector, no sparse channel.
    qdrant_raw_client.create_collection(
        collection_name=legacy_name,
        vectors_config=VectorParams(size=DENSE_VECTOR_SIZE, distance=Distance.COSINE),
    )

    tenant_id = "tenant-legacy"
    vec = [0.1] * DENSE_VECTOR_SIZE
    qdrant_raw_client.upsert(
        collection_name=legacy_name,
        points=[PointStruct(id=1, vector=vec, payload={"tenant_id": tenant_id})],
    )

    store = QdrantVectorStore(
        qdrant_connection, logical_name=logical, legacy_fallback=True
    )

    # Dense read must fall through to the legacy collection.
    hits = _run(store.search(vec, tenant_id=tenant_id, limit=5))
    assert len(hits) == 1
    assert hits[0]["id"] == 1

    # Sparse read must raise LegacyCollectionNoSparse.
    with pytest.raises(LegacyCollectionNoSparse):
        _run(
            store.search(
                {"indices": [1, 2], "values": [1.0, 1.0]},
                tenant_id=tenant_id,
                vector_name=SPARSE_VECTOR_NAME,
            )
        )
