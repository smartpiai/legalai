"""PgVectorRepository — data access layer for ``document_embeddings``.

Implements PR 1.2.4 per ``docs/phase-1/1.2.4_id-spec_pgvector-repository.md``.

The caller owns the transaction; no method in this module calls
``session.commit()``.
"""
from __future__ import annotations

import logging
from typing import Sequence
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import bindparam, delete, func, select, text
from sqlalchemy.exc import DataError, IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_embedding import DocumentEmbedding

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1536
MAX_UPSERT_BATCH = 1000
MAX_TOP_K = 100


# --------------------------------------------------------------------------- #
# Exceptions
# --------------------------------------------------------------------------- #
class RepositoryError(Exception):
    """Base for all PgVectorRepository errors."""

    def __init__(self, message: str, *, tenant_id: UUID | None = None) -> None:
        super().__init__(message)
        self.tenant_id = tenant_id


class DimensionMismatch(RepositoryError):
    def __init__(
        self, *, expected: int, actual: int, tenant_id: UUID | None = None
    ) -> None:
        super().__init__(
            f"vector dimension mismatch: expected {expected}, got {actual}",
            tenant_id=tenant_id,
        )
        self.expected = expected
        self.actual = actual


class ConstraintViolation(RepositoryError):
    def __init__(
        self,
        message: str,
        *,
        constraint: str | None = None,
        tenant_id: UUID | None = None,
    ) -> None:
        super().__init__(message, tenant_id=tenant_id)
        self.constraint = constraint


class TenantMismatch(RepositoryError):
    def __init__(self, *, expected: UUID, actual: UUID) -> None:
        super().__init__(
            f"tenant_id mismatch: method arg {expected}, row {actual}",
            tenant_id=expected,
        )
        self.expected = expected
        self.actual = actual


# --------------------------------------------------------------------------- #
# DTOs
# --------------------------------------------------------------------------- #
class EmbeddingUpsert(BaseModel):
    model_config = ConfigDict(frozen=True)

    tenant_id: UUID
    document_id: UUID
    chunk_index: int = Field(ge=0)
    model_name: str = Field(min_length=1, max_length=255)
    embedding: list[float]

    @field_validator("embedding")
    @classmethod
    def _check_dim(cls, v: list[float]) -> list[float]:
        if len(v) != EMBEDDING_DIM:
            raise ValueError(
                f"embedding must have exactly {EMBEDDING_DIM} dimensions, got {len(v)}"
            )
        return v


class UpsertResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    inserted: int
    skipped: int

    @property
    def total(self) -> int:
        return self.inserted + self.skipped


class SimilarChunk(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: UUID
    document_id: UUID
    chunk_index: int
    model_name: str
    distance: float = Field(ge=0.0, le=2.0)
    similarity: float = Field(ge=-1.0, le=1.0)


# --------------------------------------------------------------------------- #
# Repository
# --------------------------------------------------------------------------- #
class PgVectorRepository:
    """Async repository over the ``document_embeddings`` table."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------ #
    # upsert
    # ------------------------------------------------------------------ #
    async def upsert_embeddings(
        self,
        tenant_id: UUID,
        embeddings: Sequence[EmbeddingUpsert],
    ) -> UpsertResult:
        if len(embeddings) > MAX_UPSERT_BATCH:
            raise ValueError(
                f"batch size {len(embeddings)} exceeds max {MAX_UPSERT_BATCH}"
            )
        if not embeddings:
            return UpsertResult(inserted=0, skipped=0)

        for e in embeddings:
            if e.tenant_id != tenant_id:
                raise TenantMismatch(expected=tenant_id, actual=e.tenant_id)
            if len(e.embedding) != EMBEDDING_DIM:
                # Defence-in-depth; pydantic should already have caught it.
                raise DimensionMismatch(
                    expected=EMBEDDING_DIM,
                    actual=len(e.embedding),
                    tenant_id=tenant_id,
                )

        logger.debug(
            "pgvector.upsert_embeddings",
            extra={"tenant_id": str(tenant_id), "rows": len(embeddings)},
        )

        stmt = text(
            """
            INSERT INTO document_embeddings
                (tenant_id, document_id, chunk_index, model_name, embedding)
            VALUES
                (:tenant_id, :document_id, :chunk_index, :model_name, :embedding)
            ON CONFLICT (document_id, chunk_index, model_name) DO NOTHING
            RETURNING id
            """
        )

        inserted = 0
        try:
            for e in embeddings:
                result = await self._session.execute(
                    stmt,
                    {
                        "tenant_id": str(tenant_id),
                        "document_id": str(e.document_id),
                        "chunk_index": e.chunk_index,
                        "model_name": e.model_name,
                        "embedding": str(list(e.embedding)),
                    },
                )
                if result.first() is not None:
                    inserted += 1
        except IntegrityError as exc:
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
            raise ConstraintViolation(
                str(exc.orig), constraint=constraint, tenant_id=tenant_id
            ) from exc
        except DataError as exc:
            msg = str(exc.orig) if exc.orig else str(exc)
            if "dimension" in msg.lower():
                raise DimensionMismatch(
                    expected=EMBEDDING_DIM, actual=-1, tenant_id=tenant_id
                ) from exc
            raise RepositoryError(msg, tenant_id=tenant_id) from exc
        except SQLAlchemyError as exc:
            raise RepositoryError(str(exc), tenant_id=tenant_id) from exc

        skipped = len(embeddings) - inserted
        return UpsertResult(inserted=inserted, skipped=skipped)

    # ------------------------------------------------------------------ #
    # search
    # ------------------------------------------------------------------ #
    async def search_similar(
        self,
        tenant_id: UUID,
        query_embedding: list[float],
        top_k: int = 10,
        document_ids: list[UUID] | None = None,
        model_name: str | None = None,
    ) -> list[SimilarChunk]:
        if len(query_embedding) != EMBEDDING_DIM:
            raise DimensionMismatch(
                expected=EMBEDDING_DIM,
                actual=len(query_embedding),
                tenant_id=tenant_id,
            )
        if top_k < 1 or top_k > MAX_TOP_K:
            raise ValueError(f"top_k must be in [1, {MAX_TOP_K}], got {top_k}")

        logger.debug(
            "pgvector.search_similar",
            extra={"tenant_id": str(tenant_id), "top_k": top_k},
        )

        sql_parts = [
            "SELECT id, document_id, chunk_index, model_name,",
            "       embedding <=> :query AS distance",
            "  FROM document_embeddings",
            " WHERE tenant_id = :tenant_id",
        ]
        params: dict[str, object] = {
            "tenant_id": str(tenant_id),
            "query": str(list(query_embedding)),
            "top_k": top_k,
        }

        if document_ids:
            sql_parts.append(" AND document_id = ANY(:document_ids)")
            params["document_ids"] = [str(d) for d in document_ids]
        if model_name is not None:
            sql_parts.append(" AND model_name = :model_name")
            params["model_name"] = model_name

        sql_parts.append(" ORDER BY embedding <=> :query")
        sql_parts.append(" LIMIT :top_k")

        stmt = text("\n".join(sql_parts))
        if document_ids:
            stmt = stmt.bindparams(bindparam("document_ids", expanding=False))

        try:
            result = await self._session.execute(stmt, params)
            rows = result.all()
        except SQLAlchemyError as exc:
            raise RepositoryError(str(exc), tenant_id=tenant_id) from exc

        out: list[SimilarChunk] = []
        for row in rows:
            distance = float(row.distance)
            # Clamp to the pydantic-declared range to absorb tiny FP noise.
            if distance < 0.0:
                distance = 0.0
            elif distance > 2.0:
                distance = 2.0
            similarity = 1.0 - distance
            out.append(
                SimilarChunk(
                    id=row.id,
                    document_id=row.document_id,
                    chunk_index=row.chunk_index,
                    model_name=row.model_name,
                    distance=distance,
                    similarity=similarity,
                )
            )
        return out

    # ------------------------------------------------------------------ #
    # delete
    # ------------------------------------------------------------------ #
    async def delete_by_document(
        self, tenant_id: UUID, document_id: UUID
    ) -> int:
        logger.debug(
            "pgvector.delete_by_document",
            extra={
                "tenant_id": str(tenant_id),
                "document_id": str(document_id),
            },
        )
        stmt = delete(DocumentEmbedding).where(
            DocumentEmbedding.tenant_id == tenant_id,
            DocumentEmbedding.document_id == document_id,
        )
        try:
            result = await self._session.execute(stmt)
        except SQLAlchemyError as exc:
            raise RepositoryError(str(exc), tenant_id=tenant_id) from exc
        return int(result.rowcount or 0)

    # ------------------------------------------------------------------ #
    # count
    # ------------------------------------------------------------------ #
    async def count_by_tenant(self, tenant_id: UUID) -> int:
        logger.debug(
            "pgvector.count_by_tenant",
            extra={"tenant_id": str(tenant_id)},
        )
        stmt = select(func.count()).select_from(DocumentEmbedding).where(
            DocumentEmbedding.tenant_id == tenant_id
        )
        try:
            result = await self._session.execute(stmt)
        except SQLAlchemyError as exc:
            raise RepositoryError(str(exc), tenant_id=tenant_id) from exc
        return int(result.scalar_one())
