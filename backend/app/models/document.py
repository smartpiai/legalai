"""Document ORM stub (PR FU-8).

Minimal declarative model for the ``documents`` table created in migration
001. See app/models/tenant.py for the rationale — this stub exists to
anchor relationship() wiring from DocumentEmbedding and is intentionally
NOT the full document domain model.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.document_embedding import DocumentEmbedding
    from app.models.tenant import Tenant


class Document(Base):
    __tablename__ = "documents"

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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="documents")
    embeddings: Mapped[list["DocumentEmbedding"]] = relationship(
        "DocumentEmbedding",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
