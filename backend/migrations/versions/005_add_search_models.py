"""Add search models for search history saved searches and analytics

Revision ID: 005
Revises: 004
Create Date: 2024-01-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create search-related tables."""
    
    # Create search_history table
    op.create_table(
        'search_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('filters', sa.JSON(), nullable=True),
        sa.Column('result_count', sa.Integer(), nullable=True, default=0),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('search_type', sa.String(50), nullable=True, default='contract'),
        sa.Column('execution_time_ms', sa.Float(), nullable=True),
        sa.Column('clicked_results', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_search_history_created_at'), 'search_history', ['created_at'], unique=False)
    op.create_index(op.f('ix_search_history_query'), 'search_history', ['query'], unique=False)
    op.create_index(op.f('ix_search_history_tenant_id'), 'search_history', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_search_history_user_id'), 'search_history', ['user_id'], unique=False)
    
    # Create saved_searches table
    op.create_table(
        'saved_searches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('query', sa.Text(), nullable=False),
        sa.Column('filters', sa.JSON(), nullable=True),
        sa.Column('sort_by', sa.String(50), nullable=True, default='relevance'),
        sa.Column('notify_on_new', sa.Boolean(), nullable=True, default=False),
        sa.Column('notification_frequency', sa.String(20), nullable=True, default='daily'),
        sa.Column('last_notified', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_shared', sa.Boolean(), nullable=True, default=False),
        sa.Column('shared_with_team', sa.Boolean(), nullable=True, default=False),
        sa.Column('shared_with_users', sa.JSON(), nullable=True),
        sa.Column('execution_count', sa.Integer(), nullable=True, default=0),
        sa.Column('last_executed', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_saved_searches_tenant_id'), 'saved_searches', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_saved_searches_user_id'), 'saved_searches', ['user_id'], unique=False)
    
    # Create search_analytics table
    op.create_table(
        'search_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('total_searches', sa.Integer(), nullable=True, default=0),
        sa.Column('unique_users', sa.Integer(), nullable=True, default=0),
        sa.Column('avg_execution_time_ms', sa.Float(), nullable=True),
        sa.Column('zero_result_searches', sa.Integer(), nullable=True, default=0),
        sa.Column('top_queries', sa.JSON(), nullable=True),
        sa.Column('top_filters', sa.JSON(), nullable=True),
        sa.Column('avg_clicks_per_search', sa.Float(), nullable=True),
        sa.Column('top_clicked_results', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_search_analytics_date'), 'search_analytics', ['date'], unique=False)
    op.create_index(op.f('ix_search_analytics_tenant_id'), 'search_analytics', ['tenant_id'], unique=False)
    
    # Create search_index table for optimized search
    op.create_table(
        'search_index',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('search_vector', sa.Text(), nullable=True),
        sa.Column('is_indexed', sa.Boolean(), nullable=True, default=True),
        sa.Column('index_version', sa.Integer(), nullable=True, default=1),
        sa.Column('last_indexed', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_search_index_entity_type'), 'search_index', ['entity_type'], unique=False)
    op.create_index(op.f('ix_search_index_entity_id'), 'search_index', ['entity_id'], unique=False)
    op.create_index(op.f('ix_search_index_tenant_id'), 'search_index', ['tenant_id'], unique=False)
    
    # Create composite index for efficient lookups
    op.create_index(
        'ix_search_index_entity_lookup',
        'search_index',
        ['entity_type', 'entity_id', 'tenant_id'],
        unique=False
    )


def downgrade() -> None:
    """Drop search-related tables."""
    op.drop_index('ix_search_index_entity_lookup', table_name='search_index')
    op.drop_index(op.f('ix_search_index_tenant_id'), table_name='search_index')
    op.drop_index(op.f('ix_search_index_entity_id'), table_name='search_index')
    op.drop_index(op.f('ix_search_index_entity_type'), table_name='search_index')
    op.drop_table('search_index')
    
    op.drop_index(op.f('ix_search_analytics_tenant_id'), table_name='search_analytics')
    op.drop_index(op.f('ix_search_analytics_date'), table_name='search_analytics')
    op.drop_table('search_analytics')
    
    op.drop_index(op.f('ix_saved_searches_user_id'), table_name='saved_searches')
    op.drop_index(op.f('ix_saved_searches_tenant_id'), table_name='saved_searches')
    op.drop_table('saved_searches')
    
    op.drop_index(op.f('ix_search_history_user_id'), table_name='search_history')
    op.drop_index(op.f('ix_search_history_tenant_id'), table_name='search_history')
    op.drop_index(op.f('ix_search_history_query'), table_name='search_history')
    op.drop_index(op.f('ix_search_history_created_at'), table_name='search_history')
    op.drop_table('search_history')