"""IT-QD-04: Named vectors — create + upsert dense + dense search."""
from __future__ import annotations

import random

from qdrant_client.models import PointStruct, SparseVector

from app.core.vector_store import (
    DENSE_VECTOR_NAME,
    DENSE_VECTOR_SIZE,
    SPARSE_VECTOR_NAME,
    _tenant_filter,
    build_named_vectors_config,
    build_sparse_vectors_config,
)


def _rand_dense(seed: int) -> list[float]:
    rng = random.Random(seed)
    return [rng.random() for _ in range(DENSE_VECTOR_SIZE)]


def test_named_vectors_create_upsert_search(
    qdrant_raw_client, unique_collection_name, cleanup_collection
) -> None:
    collection = cleanup_collection(unique_collection_name)

    qdrant_raw_client.create_collection(
        collection_name=collection,
        vectors_config=build_named_vectors_config(),
        sparse_vectors_config=build_sparse_vectors_config(),
    )

    # Verify named-vector schema
    info = qdrant_raw_client.get_collection(collection_name=collection)
    vectors_cfg = info.config.params.vectors
    assert isinstance(vectors_cfg, dict) and DENSE_VECTOR_NAME in vectors_cfg
    sparse_cfg = info.config.params.sparse_vectors
    assert sparse_cfg is not None and SPARSE_VECTOR_NAME in sparse_cfg

    tenant_id = "tenant-a"
    points = []
    for i in range(5):
        points.append(
            PointStruct(
                id=i + 1,
                vector={
                    DENSE_VECTOR_NAME: _rand_dense(i + 1),
                    SPARSE_VECTOR_NAME: SparseVector(
                        indices=[i, i + 1], values=[1.0, 0.5]
                    ),
                },
                payload={"tenant_id": tenant_id, "n": i},
            )
        )
    qdrant_raw_client.upsert(collection_name=collection, points=points)

    query = _rand_dense(1)  # matches id=1 exactly
    result = qdrant_raw_client.query_points(
        collection_name=collection,
        query=query,
        using=DENSE_VECTOR_NAME,
        query_filter=_tenant_filter(tenant_id),
        limit=3,
        with_payload=True,
    )
    hits = result.points
    assert len(hits) == 3
    assert hits[0].id == 1, f"expected top hit to be id=1, got {hits[0].id}"
