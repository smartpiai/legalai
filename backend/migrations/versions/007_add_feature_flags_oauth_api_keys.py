"""Add feature flags oauth and api keys tables

Revision ID: 007
Revises: 006
Create Date: 2024-01-10 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create feature flags, OAuth, and API key tables."""
    
    # Create feature_flags table
    op.create_table(
        'feature_flags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('flag_type', sa.String(20), nullable=False, default='boolean'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=False),
        sa.Column('percentage', sa.Integer(), nullable=True, default=0),
        sa.Column('allowed_users', sa.JSON(), nullable=True),
        sa.Column('allowed_tenants', sa.JSON(), nullable=True),
        sa.Column('excluded_users', sa.JSON(), nullable=True),
        sa.Column('excluded_tenants', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_feature_flags_name'), 'feature_flags', ['name'], unique=True)
    
    # Create api_keys table
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('key_hash', sa.String(255), nullable=False),
        sa.Column('key_prefix', sa.String(10), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=True),
        sa.Column('permissions', sa.JSON(), nullable=True),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=True),
        sa.Column('rate_limit_per_hour', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=True, default=0),
        sa.Column('last_ip_address', sa.String(45), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key_hash')
    )
    op.create_index(op.f('ix_api_keys_key_hash'), 'api_keys', ['key_hash'], unique=True)
    op.create_index(op.f('ix_api_keys_user_id'), 'api_keys', ['user_id'], unique=False)
    op.create_index(op.f('ix_api_keys_tenant_id'), 'api_keys', ['tenant_id'], unique=False)
    
    # Create api_key_usage_logs table
    op.create_table(
        'api_key_usage_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('api_key_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.String(255), nullable=False),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_key_usage_logs_api_key_id'), 'api_key_usage_logs', ['api_key_id'], unique=False)
    op.create_index(op.f('ix_api_key_usage_logs_created_at'), 'api_key_usage_logs', ['created_at'], unique=False)
    
    # Add OAuth fields to users table
    op.add_column('users', sa.Column('oauth_provider', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('oauth_provider_id', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('oauth_refresh_token', sa.Text(), nullable=True))
    
    # Create index for OAuth lookups
    op.create_index('ix_users_oauth_provider', 'users', ['oauth_provider', 'oauth_provider_id'], unique=False)


def downgrade() -> None:
    """Drop feature flags, OAuth, and API key tables."""
    
    # Drop OAuth fields from users table
    op.drop_index('ix_users_oauth_provider', table_name='users')
    op.drop_column('users', 'oauth_refresh_token')
    op.drop_column('users', 'oauth_provider_id')
    op.drop_column('users', 'oauth_provider')
    
    # Drop API key usage logs table
    op.drop_index(op.f('ix_api_key_usage_logs_created_at'), table_name='api_key_usage_logs')
    op.drop_index(op.f('ix_api_key_usage_logs_api_key_id'), table_name='api_key_usage_logs')
    op.drop_table('api_key_usage_logs')
    
    # Drop API keys table
    op.drop_index(op.f('ix_api_keys_tenant_id'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_user_id'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_key_hash'), table_name='api_keys')
    op.drop_table('api_keys')
    
    # Drop feature flags table
    op.drop_index(op.f('ix_feature_flags_name'), table_name='feature_flags')
    op.drop_table('feature_flags')