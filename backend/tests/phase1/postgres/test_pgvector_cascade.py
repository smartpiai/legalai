"""IT-PV-06: FK cascade delete + repository.delete_by_document is tenant-scoped."""
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.repositories.pgvector_repository import (
    EmbeddingUpsert,
    PgVectorRepository,
)


@pytest.mark.asyncio
async def test_deleting_document_cascades_to_embeddings(
    async_session,
    seed_tenant_and_document,
    seeded_vectors,
) -> None:
    ids = seed_tenant_and_document()
    vectors = seeded_vectors(10, seed=3)

    repo = PgVectorRepository(async_session)
    await repo.upsert_embeddings(
        ids.tenant_id,
        [
            EmbeddingUpsert(
                tenant_id=ids.tenant_id,
                document_id=ids.document_id,
                chunk_index=i,
                model_name="m",
                embedding=v,
            )
            for i, v in enumerate(vectors)
        ],
    )
    await async_session.commit()

    assert await repo.count_by_tenant(ids.tenant_id) == 10

    # Delete the parent document row directly — FK ondelete=CASCADE must
    # wipe the matching document_embeddings rows.
    await async_session.execute(
        text("DELETE FROM documents WHERE id = :id"),
        {"id": str(ids.document_id)},
    )
    await async_session.commit()

    remaining = await repo.count_by_tenant(ids.tenant_id)
    assert remaining == 0, (
        f"expected FK CASCADE to remove all embeddings; {remaining} remain"
    )


@pytest.mark.asyncio
async def test_delete_by_document_is_tenant_scoped(
    async_session,
    seed_tenant_and_document,
    seeded_vectors,
) -> None:
    tenant_a = seed_tenant_and_document()
    tenant_b = seed_tenant_and_document()

    vectors = seeded_vectors(6, seed=9)
    repo = PgVectorRepository(async_session)

    await repo.upsert_embeddings(
        tenant_a.tenant_id,
        [
            EmbeddingUpsert(
                tenant_id=tenant_a.tenant_id,
                document_id=tenant_a.document_id,
                chunk_index=i,
                model_name="m",
                embedding=v,
            )
            for i, v in enumerate(vectors[:3])
        ],
    )
    await repo.upsert_embeddings(
        tenant_b.tenant_id,
        [
            EmbeddingUpsert(
                tenant_id=tenant_b.tenant_id,
                document_id=tenant_b.document_id,
                chunk_index=i,
                model_name="m",
                embedding=v,
            )
            for i, v in enumerate(vectors[3:])
        ],
    )
    await async_session.commit()

    # Calling delete_by_document with tenant_a but tenant_b's document_id
    # must delete nothing (tenant scoping).
    deleted_wrong = await repo.delete_by_document(
        tenant_a.tenant_id, tenant_b.document_id
    )
    assert deleted_wrong == 0
    await async_session.commit()
    assert await repo.count_by_tenant(tenant_b.tenant_id) == 3

    # Correct tenant/document pairing deletes only tenant_a's rows.
    deleted_right = await repo.delete_by_document(
        tenant_a.tenant_id, tenant_a.document_id
    )
    assert deleted_right == 3
    await async_session.commit()
    assert await repo.count_by_tenant(tenant_a.tenant_id) == 0
    assert await repo.count_by_tenant(tenant_b.tenant_id) == 3
