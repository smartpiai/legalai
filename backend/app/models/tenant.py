"""Tenant ORM stub (PR FU-8).

Minimal declarative model for the ``tenants`` table created in migration
001. Only the columns needed to anchor ``relationship(..., back_populates=)``
from child models are declared; the full tenant domain model (billing,
subscription, feature flags, etc.) lives elsewhere or will be filled in
under the multi-tenancy workstream.

This stub exists solely so that ``DocumentEmbedding.tenant`` (and any
future per-tenant child) can resolve its mapper during SQLAlchemy
configure. Do NOT rely on this class as the source of truth for the
tenant domain — column coverage is intentionally partial.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.document_embedding import DocumentEmbedding
    from app.models.user import User


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="tenant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="tenant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    document_embeddings: Mapped[list["DocumentEmbedding"]] = relationship(
        "DocumentEmbedding",
        back_populates="tenant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
