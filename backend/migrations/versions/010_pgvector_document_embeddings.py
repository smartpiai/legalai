"""pgvector document_embeddings

Revision ID: 009
Revises: 008
Create Date: 2026-04-09

Creates the pgvector extension and the `document_embeddings` table with
an HNSW ANN index (cosine) and a B-tree index on `tenant_id`.

See docs/phase-1/1.2.1_tech-spec_pgvector-schema.md for the full design,
index choice rationale (HNSW vs IVFFlat), and downgrade behavior.

Schema ships behind the PGVECTOR_ENABLED feature flag (default false);
reads/writes are gated in the application layer, not at the schema level.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgvector extension (idempotent; requires superuser / rds_superuser).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "document_embeddings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("model_name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "document_id",
            "chunk_index",
            "model_name",
            name="uq_document_embeddings_doc_chunk_model",
        ),
    )

    # B-tree on tenant_id — accelerates the mandatory tenant filter.
    op.create_index(
        "idx_document_embeddings_tenant",
        "document_embeddings",
        ["tenant_id"],
    )

    # HNSW ANN index (cosine). Raw DDL because Alembic's op.create_index
    # does not cleanly express USING hnsw + opclass + WITH parameters.
    # m=16, ef_construction=64 are pgvector defaults; appropriate for the
    # ≤100K vectors/tenant target scale (see Tech Spec §3).
    op.execute(
        "CREATE INDEX idx_document_embeddings_hnsw "
        "ON document_embeddings "
        "USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    # Drop indexes then table. Intentionally DO NOT drop the `vector`
    # extension — other tables may depend on it before a rollback window
    # closes (see Tech Spec §6).
    op.execute("DROP INDEX IF EXISTS idx_document_embeddings_hnsw")
    op.drop_index(
        "idx_document_embeddings_tenant",
        table_name="document_embeddings",
    )
    op.drop_table("document_embeddings")
