"""Edge cases for the pgvector repository.

EC-03: a vector with the wrong dimension is rejected at validation time.
EC-07: concurrent insert on the same (document_id, chunk_index, model_name)
       — exactly one wins via ``ON CONFLICT DO NOTHING``; the loser is
       reported as ``UpsertResult.skipped == 1``.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.repositories.pgvector_repository import (
    DimensionMismatch,
    EMBEDDING_DIM,
    EmbeddingUpsert,
    PgVectorRepository,
)


# --------------------------------------------------------------------------- #
# EC-03 — wrong-dimension vectors are rejected
# --------------------------------------------------------------------------- #
def test_ec03_wrong_dimension_rejected_by_validator() -> None:
    """A 768-dim vector must be rejected at the Pydantic field validator."""
    import uuid

    with pytest.raises((ValidationError, DimensionMismatch)) as excinfo:
        EmbeddingUpsert(
            tenant_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            chunk_index=0,
            model_name="bad",
            embedding=[0.0] * 768,
        )

    msg = str(excinfo.value).lower()
    assert "1536" in msg or "dimension" in msg, (
        f"validator error should mention the expected dimension; got: {excinfo.value}"
    )


@pytest.mark.asyncio
async def test_ec03_wrong_dimension_rejected_in_search(
    async_session,
    seed_tenant_and_document,
) -> None:
    """search_similar must raise DimensionMismatch for wrong-sized queries."""
    ids = seed_tenant_and_document()
    repo = PgVectorRepository(async_session)
    with pytest.raises(DimensionMismatch) as excinfo:
        await repo.search_similar(
            tenant_id=ids.tenant_id,
            query_embedding=[0.0] * 1024,
            top_k=5,
        )
    assert excinfo.value.expected == EMBEDDING_DIM
    assert excinfo.value.actual == 1024


# --------------------------------------------------------------------------- #
# EC-07 — duplicate (document_id, chunk_index, model_name) → ON CONFLICT
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_ec07_conflict_skips_duplicate(
    async_session,
    seed_tenant_and_document,
    seeded_vectors,
) -> None:
    """Two upserts with identical (doc_id, chunk_index, model) → 1 skipped."""
    ids = seed_tenant_and_document()
    vec_a, vec_b = seeded_vectors(2, seed=99)

    repo = PgVectorRepository(async_session)

    first = await repo.upsert_embeddings(
        ids.tenant_id,
        [
            EmbeddingUpsert(
                tenant_id=ids.tenant_id,
                document_id=ids.document_id,
                chunk_index=0,
                model_name="text-embedding-3-small",
                embedding=vec_a,
            )
        ],
    )
    await async_session.commit()
    assert first.inserted == 1
    assert first.skipped == 0

    # Second upsert hits the unique constraint — different vector data,
    # same (document_id, chunk_index, model_name) tuple.
    second = await repo.upsert_embeddings(
        ids.tenant_id,
        [
            EmbeddingUpsert(
                tenant_id=ids.tenant_id,
                document_id=ids.document_id,
                chunk_index=0,
                model_name="text-embedding-3-small",
                embedding=vec_b,
            )
        ],
    )
    await async_session.commit()

    assert second.inserted == 0, (
        f"duplicate row should not be inserted; got inserted={second.inserted}"
    )
    assert second.skipped == 1, (
        f"ON CONFLICT DO NOTHING should report skipped=1; got skipped={second.skipped}"
    )

    # Total stored is still exactly one row for this tenant.
    assert await repo.count_by_tenant(ids.tenant_id) == 1
