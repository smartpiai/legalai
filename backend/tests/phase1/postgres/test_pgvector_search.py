"""IT-PV-04: search_similar returns nearest neighbor in ascending distance."""
from __future__ import annotations

import pytest

from app.repositories.pgvector_repository import (
    EmbeddingUpsert,
    PgVectorRepository,
)


@pytest.mark.asyncio
async def test_search_similar_returns_nearest_first(
    async_session,
    seed_tenant_and_document,
    seeded_vectors,
) -> None:
    ids = seed_tenant_and_document()

    # 50 seeded vectors; pick one as the known "target" nearest neighbor.
    vectors = seeded_vectors(50, seed=7)
    target_chunk_index = 23
    query_embedding = list(vectors[target_chunk_index])

    rows = [
        EmbeddingUpsert(
            tenant_id=ids.tenant_id,
            document_id=ids.document_id,
            chunk_index=i,
            model_name="text-embedding-3-small",
            embedding=vec,
        )
        for i, vec in enumerate(vectors)
    ]

    repo = PgVectorRepository(async_session)
    await repo.upsert_embeddings(ids.tenant_id, rows)
    await async_session.commit()

    results = await repo.search_similar(
        tenant_id=ids.tenant_id,
        query_embedding=query_embedding,
        top_k=5,
    )

    assert len(results) == 5, f"expected 5 hits, got {len(results)}"

    # Top-1 must be the exact seeded vector (distance ≈ 0).
    assert results[0].chunk_index == target_chunk_index, (
        f"top-1 chunk_index={results[0].chunk_index}, expected {target_chunk_index}"
    )
    assert results[0].distance < 1e-5, (
        f"top-1 distance {results[0].distance} should be ≈0 for exact-match query"
    )

    # Strictly ascending distance ordering.
    distances = [r.distance for r in results]
    assert distances == sorted(distances), (
        f"results not ordered by distance ascending: {distances}"
    )

    # similarity = 1 - distance sanity.
    for r in results:
        assert abs(r.similarity - (1.0 - r.distance)) < 1e-9
