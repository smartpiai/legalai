"""Add RBAC tables for roles and permissions

Revision ID: 002
Revises: 001
Create Date: 2024-01-02 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # RBAC migration enabled - creating roles and permissions tables
    # Create permissions table
    op.create_table('permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('resource', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_permissions_name'), 'permissions', ['name'], unique=True)
    op.create_index(op.f('ix_permissions_resource'), 'permissions', ['resource'], unique=False)
    
    # Note: roles table was created in 001_initial_schema.py
    # Add new columns to existing roles table instead of recreating
    try:
        op.add_column('roles', sa.Column('slug', sa.String(length=100), nullable=True))
        op.add_column('roles', sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'))
        op.add_column('roles', sa.Column('parent_role_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_roles_parent', 'roles', 'roles', ['parent_role_id'], ['id'], ondelete='SET NULL')
        op.create_unique_constraint('uq_role_slug_tenant', 'roles', ['slug', 'tenant_id'])
        op.create_index(op.f('ix_roles_slug'), 'roles', ['slug'], unique=False)
    except Exception:
        pass  # Columns may already exist
    
    # Create role_permissions association table
    op.create_table('role_permissions',
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )
    
    # Note: user_roles table was created in 001_initial_schema.py
    # Skip recreation to avoid conflicts
    
    # Create role_permissions_explicit table for additional metadata if needed
    op.create_table('role_permissions_explicit',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission')
    )
    
    # Insert default permissions
    op.execute("""
        INSERT INTO permissions (name, description, resource, action, created_at, updated_at) VALUES
        -- Contract permissions
        ('contracts.create', 'Create new contracts', 'contracts', 'create', NOW(), NOW()),
        ('contracts.read', 'View contracts', 'contracts', 'read', NOW(), NOW()),
        ('contracts.update', 'Update contracts', 'contracts', 'update', NOW(), NOW()),
        ('contracts.delete', 'Delete contracts', 'contracts', 'delete', NOW(), NOW()),
        ('contracts.approve', 'Approve contracts', 'contracts', 'approve', NOW(), NOW()),
        ('contracts.export', 'Export contracts', 'contracts', 'export', NOW(), NOW()),
        
        -- User permissions
        ('users.create', 'Create new users', 'users', 'create', NOW(), NOW()),
        ('users.read', 'View users', 'users', 'read', NOW(), NOW()),
        ('users.update', 'Update users', 'users', 'update', NOW(), NOW()),
        ('users.delete', 'Delete users', 'users', 'delete', NOW(), NOW()),
        ('users.manage', 'Manage all users', 'users', 'manage', NOW(), NOW()),
        
        -- Tenant permissions
        ('tenants.create', 'Create new tenants', 'tenants', 'create', NOW(), NOW()),
        ('tenants.read', 'View tenants', 'tenants', 'read', NOW(), NOW()),
        ('tenants.update', 'Update tenants', 'tenants', 'update', NOW(), NOW()),
        ('tenants.delete', 'Delete tenants', 'tenants', 'delete', NOW(), NOW()),
        ('tenants.manage', 'Manage all tenants', 'tenants', 'manage', NOW(), NOW()),
        
        -- Document permissions
        ('documents.upload', 'Upload documents', 'documents', 'upload', NOW(), NOW()),
        ('documents.read', 'View documents', 'documents', 'read', NOW(), NOW()),
        ('documents.update', 'Update documents', 'documents', 'update', NOW(), NOW()),
        ('documents.delete', 'Delete documents', 'documents', 'delete', NOW(), NOW()),
        ('documents.download', 'Download documents', 'documents', 'download', NOW(), NOW()),
        
        -- Template permissions
        ('templates.create', 'Create templates', 'templates', 'create', NOW(), NOW()),
        ('templates.read', 'View templates', 'templates', 'read', NOW(), NOW()),
        ('templates.update', 'Update templates', 'templates', 'update', NOW(), NOW()),
        ('templates.delete', 'Delete templates', 'templates', 'delete', NOW(), NOW()),
        
        -- Analytics permissions
        ('analytics.view', 'View analytics', 'analytics', 'view', NOW(), NOW()),
        ('analytics.export', 'Export analytics', 'analytics', 'export', NOW(), NOW()),
        
        -- Settings permissions
        ('settings.read', 'View settings', 'settings', 'read', NOW(), NOW()),
        ('settings.update', 'Update settings', 'settings', 'update', NOW(), NOW()),
        
        -- Audit permissions
        ('audit.view', 'View audit logs', 'audit', 'view', NOW(), NOW()),
        ('audit.export', 'Export audit logs', 'audit', 'export', NOW(), NOW())
    """)
    
    # Insert default system roles
    op.execute("""
        INSERT INTO roles (name, slug, description, permissions, tenant_id, is_system, created_at, updated_at) VALUES
        ('System Administrator', 'system-admin', 'Full system access', '[]'::json, NULL, true, NOW(), NOW()),
        ('Tenant Administrator', 'tenant-admin', 'Full tenant access', '[]'::json, NULL, true, NOW(), NOW()),
        ('Contract Manager', 'contract-manager', 'Manage contracts', '[]'::json, NULL, true, NOW(), NOW()),
        ('Contract Viewer', 'contract-viewer', 'View contracts only', '[]'::json, NULL, true, NOW(), NOW()),
        ('User Manager', 'user-manager', 'Manage users', '[]'::json, NULL, true, NOW(), NOW())
    """)
    
    # Assign permissions to default roles (one statement per execute —
    # asyncpg does not support multiple commands in a single prepared statement).
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r CROSS JOIN permissions p
        WHERE r.slug = 'system-admin'
    """)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r CROSS JOIN permissions p
        WHERE r.slug = 'tenant-admin' AND p.resource != 'tenants'
    """)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r CROSS JOIN permissions p
        WHERE r.slug = 'contract-manager'
        AND p.resource IN ('contracts', 'documents', 'templates')
    """)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r CROSS JOIN permissions p
        WHERE r.slug = 'contract-viewer'
        AND p.resource IN ('contracts', 'documents', 'templates')
        AND p.action IN ('read', 'download')
    """)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r CROSS JOIN permissions p
        WHERE r.slug = 'user-manager' AND p.resource = 'users'
    """)


def downgrade() -> None:
    op.drop_table('role_permissions_explicit')
    # Don't drop tables created in 001_initial_schema.py
    # op.drop_table('user_roles')
    op.drop_table('role_permissions')
    # op.drop_table('roles')
    op.drop_table('permissions')