"""add documents table

Revision ID: 004
Revises: 003
Create Date: 2024-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    return  # Skip - documents table already created in 001_initial_schema.py
    """Create documents table for file storage and metadata."""
    
    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        
        # File information
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('file_path', sa.Text(), nullable=False),  # S3/MinIO path
        sa.Column('file_size', sa.BigInteger(), nullable=False),  # Size in bytes
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('checksum', sa.String(64), nullable=True),  # SHA-256 hash
        
        # Relationships
        sa.Column('contract_id', sa.Integer(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        
        # Metadata
        sa.Column('document_metadata', sa.JSON(), nullable=True, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        
        # Extracted content
        sa.Column('extracted_text', sa.Text(), nullable=True),
        sa.Column('extraction_status', sa.String(50), nullable=True, server_default='pending'),
        sa.Column('extraction_error', sa.Text(), nullable=True),
        
        # Version control
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('parent_document_id', sa.Integer(), nullable=True),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['parent_document_id'], ['documents.id'], ondelete='SET NULL')
    )
    
    # Create indexes for better query performance
    op.create_index('ix_documents_contract_id', 'documents', ['contract_id'])
    op.create_index('ix_documents_tenant_id', 'documents', ['tenant_id'])
    op.create_index('ix_documents_uploaded_by', 'documents', ['uploaded_by'])
    op.create_index('ix_documents_parent_document_id', 'documents', ['parent_document_id'])
    op.create_index('ix_documents_checksum', 'documents', ['checksum'])
    op.create_index('ix_documents_is_active', 'documents', ['is_active'])
    op.create_index('ix_documents_extraction_status', 'documents', ['extraction_status'])
    op.create_index('ix_documents_created_at', 'documents', ['created_at'])
    op.create_index('ix_documents_name', 'documents', ['name'])
    
    # Create compound indexes for common queries
    op.create_index('ix_documents_tenant_active', 'documents', ['tenant_id', 'is_active'])
    op.create_index('ix_documents_contract_tenant', 'documents', ['contract_id', 'tenant_id'])
    
    # Create trigger to update updated_at timestamp
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)
    
    op.execute("""
        CREATE TRIGGER update_documents_updated_at 
        BEFORE UPDATE ON documents
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    """Drop documents table and related objects."""
    
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS update_documents_updated_at ON documents")
    
    # Drop indexes
    op.drop_index('ix_documents_contract_tenant', 'documents')
    op.drop_index('ix_documents_tenant_active', 'documents')
    op.drop_index('ix_documents_name', 'documents')
    op.drop_index('ix_documents_created_at', 'documents')
    op.drop_index('ix_documents_extraction_status', 'documents')
    op.drop_index('ix_documents_is_active', 'documents')
    op.drop_index('ix_documents_checksum', 'documents')
    op.drop_index('ix_documents_parent_document_id', 'documents')
    op.drop_index('ix_documents_uploaded_by', 'documents')
    op.drop_index('ix_documents_tenant_id', 'documents')
    op.drop_index('ix_documents_contract_id', 'documents')
    
    # Drop table
    op.drop_table('documents')