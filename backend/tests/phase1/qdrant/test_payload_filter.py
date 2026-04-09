"""IT-QD-07: tenant_id payload filter returns only matching tenant points."""
from __future__ import annotations

from qdrant_client.models import PointStruct, SparseVector

from app.core.vector_store import (
    DENSE_VECTOR_NAME,
    DENSE_VECTOR_SIZE,
    SPARSE_VECTOR_NAME,
    _tenant_filter,
    build_named_vectors_config,
    build_sparse_vectors_config,
)


def test_tenant_payload_filter_isolation(
    qdrant_raw_client, unique_collection_name, cleanup_collection
) -> None:
    collection = cleanup_collection(unique_collection_name)

    qdrant_raw_client.create_collection(
        collection_name=collection,
        vectors_config=build_named_vectors_config(),
        sparse_vectors_config=build_sparse_vectors_config(),
    )

    base = [0.0] * DENSE_VECTOR_SIZE
    base[0] = 1.0

    points = []
    for i in range(5):
        tenant = "A" if i < 3 else "B"
        vec = list(base)
        vec[1] = 0.01 * i
        points.append(
            PointStruct(
                id=i + 1,
                vector={
                    DENSE_VECTOR_NAME: vec,
                    SPARSE_VECTOR_NAME: SparseVector(indices=[i], values=[1.0]),
                },
                payload={"tenant_id": tenant, "idx": i},
            )
        )
    qdrant_raw_client.upsert(collection_name=collection, points=points)

    for tenant, expected_ids in (("A", {1, 2, 3}), ("B", {4, 5})):
        result = qdrant_raw_client.query_points(
            collection_name=collection,
            query=base,
            using=DENSE_VECTOR_NAME,
            query_filter=_tenant_filter(tenant),
            limit=10,
            with_payload=True,
        )
        hits = result.points
        ids = {h.id for h in hits}
        assert ids == expected_ids, f"tenant {tenant}: got {ids}, expected {expected_ids}"
        for h in hits:
            assert h.payload["tenant_id"] == tenant
