"""IT-PV-05: tenant isolation in search + TenantMismatch on cross-tenant upsert."""
from __future__ import annotations

import pytest

from app.repositories.pgvector_repository import (
    EmbeddingUpsert,
    PgVectorRepository,
    TenantMismatch,
)


@pytest.mark.asyncio
async def test_search_does_not_leak_across_tenants(
    async_session,
    seed_tenant_and_document,
    seeded_vectors,
) -> None:
    tenant_a = seed_tenant_and_document()
    tenant_b = seed_tenant_and_document()

    vectors_a = seeded_vectors(20, seed=11)
    vectors_b = seeded_vectors(20, seed=22)

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
            for i, v in enumerate(vectors_a)
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
            for i, v in enumerate(vectors_b)
        ],
    )
    await async_session.commit()

    # Use tenant_b's exact vector as the query but search under tenant_a.
    results = await repo.search_similar(
        tenant_id=tenant_a.tenant_id,
        query_embedding=list(vectors_b[0]),
        top_k=20,
    )
    assert len(results) == 20
    returned_doc_ids = {r.document_id for r in results}
    assert tenant_b.document_id not in returned_doc_ids, (
        "search_similar under tenant_a leaked a tenant_b document_id"
    )
    assert returned_doc_ids == {tenant_a.document_id}

    # Counts per tenant are correctly scoped.
    assert await repo.count_by_tenant(tenant_a.tenant_id) == 20
    assert await repo.count_by_tenant(tenant_b.tenant_id) == 20


@pytest.mark.asyncio
async def test_cross_tenant_upsert_raises_tenant_mismatch(
    async_session,
    seed_tenant_and_document,
    seeded_vectors,
) -> None:
    tenant_a = seed_tenant_and_document()
    tenant_b = seed_tenant_and_document()
    vec = seeded_vectors(1, seed=5)[0]

    repo = PgVectorRepository(async_session)

    bad = EmbeddingUpsert(
        tenant_id=tenant_b.tenant_id,   # row claims tenant_b
        document_id=tenant_b.document_id,
        chunk_index=0,
        model_name="m",
        embedding=vec,
    )

    with pytest.raises(TenantMismatch) as excinfo:
        await repo.upsert_embeddings(tenant_a.tenant_id, [bad])

    assert excinfo.value.expected == tenant_a.tenant_id
    assert excinfo.value.actual == tenant_b.tenant_id
