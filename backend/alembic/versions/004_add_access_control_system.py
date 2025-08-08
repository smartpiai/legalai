"""Add access control system tables

Revision ID: 004
Revises: 003
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create folders table
    op.create_table('folders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('path', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('block_inheritance', sa.Boolean(), nullable=False, default=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_id'], ['folders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_folders_parent', 'folders', ['parent_id'])
    op.create_index('ix_folders_tenant', 'folders', ['tenant_id'])
    op.create_index('ix_folders_path', 'folders', ['path'])
    
    # Create document_permissions table
    op.create_table('document_permissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('access_level', sa.String(length=20), nullable=False),
        sa.Column('granted_by', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id', 'user_id', name='uix_document_user')
    )
    op.create_index('ix_document_permissions_document', 'document_permissions', ['document_id'])
    op.create_index('ix_document_permissions_user', 'document_permissions', ['user_id'])
    op.create_index('ix_document_permissions_tenant', 'document_permissions', ['tenant_id'])
    
    # Create folder_permissions table
    op.create_table('folder_permissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('folder_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('access_level', sa.String(length=20), nullable=False),
        sa.Column('granted_by', sa.Integer(), nullable=False),
        sa.Column('inherit', sa.Boolean(), nullable=False, default=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('folder_id', 'user_id', name='uix_folder_user')
    )
    op.create_index('ix_folder_permissions_folder', 'folder_permissions', ['folder_id'])
    op.create_index('ix_folder_permissions_user', 'folder_permissions', ['user_id'])
    op.create_index('ix_folder_permissions_tenant', 'folder_permissions', ['tenant_id'])
    
    # Create document_shares table
    op.create_table('document_shares',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('share_link', sa.String(length=255), nullable=False),
        sa.Column('recipient_email', sa.String(length=255), nullable=False),
        sa.Column('recipient_id', sa.Integer(), nullable=True),
        sa.Column('access_level', sa.String(length=20), nullable=False),
        sa.Column('shared_by', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('is_external', sa.Boolean(), nullable=False, default=False),
        sa.Column('access_count', sa.Integer(), nullable=False, default=0),
        sa.Column('last_accessed_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['shared_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('share_link')
    )
    op.create_index('ix_document_shares_link', 'document_shares', ['share_link'])
    op.create_index('ix_document_shares_document', 'document_shares', ['document_id'])
    op.create_index('ix_document_shares_recipient', 'document_shares', ['recipient_email'])
    op.create_index('ix_document_shares_tenant', 'document_shares', ['tenant_id'])
    
    # Create external_accesses table
    op.create_table('external_accesses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('access_token', sa.String(length=255), nullable=False),
        sa.Column('access_level', sa.String(length=20), nullable=False),
        sa.Column('granted_by', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('access_count', sa.Integer(), nullable=False, default=0),
        sa.Column('last_accessed_at', sa.DateTime(), nullable=True),
        sa.Column('ip_restrictions', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('access_token')
    )
    op.create_index('ix_external_accesses_token', 'external_accesses', ['access_token'])
    op.create_index('ix_external_accesses_document', 'external_accesses', ['document_id'])
    op.create_index('ix_external_accesses_email', 'external_accesses', ['email'])
    
    # Create access_audit_logs table
    op.create_table('access_audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=True),
        sa.Column('folder_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_access_audit_logs_document', 'access_audit_logs', ['document_id'])
    op.create_index('ix_access_audit_logs_folder', 'access_audit_logs', ['folder_id'])
    op.create_index('ix_access_audit_logs_user', 'access_audit_logs', ['user_id'])
    op.create_index('ix_access_audit_logs_tenant', 'access_audit_logs', ['tenant_id'])
    op.create_index('ix_access_audit_logs_created', 'access_audit_logs', ['created_at'])
    op.create_index('ix_access_audit_logs_action', 'access_audit_logs', ['action'])
    
    # Add folder_id and created_by to documents table
    op.add_column('documents', sa.Column('folder_id', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('created_by', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_documents_folder', 'documents', 'folders', ['folder_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_documents_created_by', 'documents', 'users', ['created_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    # Drop foreign keys from documents table
    op.drop_constraint('fk_documents_created_by', 'documents', type_='foreignkey')
    op.drop_constraint('fk_documents_folder', 'documents', type_='foreignkey')
    op.drop_column('documents', 'created_by')
    op.drop_column('documents', 'folder_id')
    
    # Drop tables
    op.drop_table('access_audit_logs')
    op.drop_table('external_accesses')
    op.drop_table('document_shares')
    op.drop_table('folder_permissions')
    op.drop_table('document_permissions')
    op.drop_table('folders')