"""IT-PV-03: bulk insert 100 deterministic embeddings and verify count."""
from __future__ import annotations

import pytest

from app.repositories.pgvector_repository import (
    EmbeddingUpsert,
    PgVectorRepository,
    UpsertResult,
)


@pytest.mark.asyncio
async def test_upsert_100_embeddings_then_count(
    async_session,
    seed_tenant_and_document,
    seeded_vectors,
) -> None:
    ids = seed_tenant_and_document()
    vectors = seeded_vectors(100, seed=1337)

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
    result = await repo.upsert_embeddings(ids.tenant_id, rows)
    await async_session.commit()

    assert isinstance(result, UpsertResult)
    assert result.inserted == 100, (
        f"expected 100 rows inserted, got inserted={result.inserted} "
        f"skipped={result.skipped}"
    )
    assert result.skipped == 0
    assert result.total == 100

    count = await repo.count_by_tenant(ids.tenant_id)
    assert count == 100, f"count_by_tenant returned {count}, expected 100"
