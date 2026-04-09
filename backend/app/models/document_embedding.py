"""DocumentEmbedding ORM model (PR 1.2.3, relationships added in FU-8).

Stores per-chunk vector embeddings for tenant documents using pgvector.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.tenant import Tenant


class DocumentEmbedding(Base):
    __tablename__ = "document_embeddings"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship(
        "Tenant", back_populates="document_embeddings"
    )
    document: Mapped["Document"] = relationship(
        "Document", back_populates="embeddings"
    )

    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "chunk_index",
            "model_name",
            name="uq_document_embeddings_doc_chunk_model",
        ),
    )
