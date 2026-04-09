"""IT-QD-05: sparse upsert + sparse search, assert ranking."""
from __future__ import annotations

import asyncio

from qdrant_client.models import PointStruct, SparseVector

from app.core.vector_store import (
    DENSE_VECTOR_NAME,
    DENSE_VECTOR_SIZE,
    SPARSE_VECTOR_NAME,
    build_named_vectors_config,
    build_sparse_vectors_config,
    search_sparse,
)


def test_sparse_upsert_and_search_ranking(
    qdrant_raw_client, qdrant_connection, unique_collection_name, cleanup_collection
) -> None:
    collection = cleanup_collection(unique_collection_name)

    qdrant_raw_client.create_collection(
        collection_name=collection,
        vectors_config=build_named_vectors_config(),
        sparse_vectors_config=build_sparse_vectors_config(),
    )

    tenant_id = "t1"
    zero_dense = [0.0] * DENSE_VECTOR_SIZE
    # Three docs: doc-1 shares all query terms strongly, doc-2 shares one
    # term, doc-3 shares nothing.
    docs = [
        (1, [1, 2, 3], [3.0, 3.0, 3.0]),
        (2, [1, 9], [1.0, 1.0]),
        (3, [100, 101], [2.0, 2.0]),
    ]
    points = [
        PointStruct(
            id=pid,
            vector={
                DENSE_VECTOR_NAME: zero_dense,
                SPARSE_VECTOR_NAME: SparseVector(indices=idx, values=vals),
            },
            payload={"tenant_id": tenant_id},
        )
        for pid, idx, vals in docs
    ]
    qdrant_raw_client.upsert(collection_name=collection, points=points)

    hits = asyncio.get_event_loop().run_until_complete(
        search_sparse(
            qdrant_connection,
            collection,
            query_indices=[1, 2, 3],
            query_values=[1.0, 1.0, 1.0],
            tenant_id=tenant_id,
            limit=5,
        )
    )

    assert len(hits) >= 2
    ids_in_order = [h["id"] for h in hits]
    assert ids_in_order[0] == 1, f"doc-1 should rank first, got {ids_in_order}"
    # doc-3 shares nothing; must not outrank doc-2.
    if 3 in ids_in_order and 2 in ids_in_order:
        assert ids_in_order.index(2) < ids_in_order.index(3)
