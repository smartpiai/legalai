"""Add template models

Revision ID: 008
Revises: 007
Create Date: 2024-01-20 10:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # Create template_categories table
    op.create_table(
        'template_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('parent_id', sa.Integer()),
        sa.Column('path', sa.String(500)),
        sa.Column('icon', sa.String(50)),
        sa.Column('color', sa.String(7)),
        sa.Column('display_order', sa.Integer(), default=0),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['template_categories.id']),
    )
    op.create_index('idx_category_tenant', 'template_categories', ['tenant_id', 'name'])
    op.create_unique_constraint(
        'uq_category_name', 'template_categories', 
        ['tenant_id', 'name', 'parent_id']
    )
    
    # Create templates table
    op.create_table(
        'templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(100)),
        sa.Column('subcategory', sa.String(100)),
        sa.Column('tags', postgresql.ARRAY(sa.String()), default=[]),
        sa.Column('version', sa.Integer(), default=1, nullable=False),
        sa.Column('parent_template_id', sa.Integer()),
        sa.Column('is_latest_version', sa.Boolean(), default=True),
        sa.Column('approval_status', sa.Enum(
            'draft', 'pending', 'approved', 'rejected', 'archived',
            name='template_status'
        ), default='draft', nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('requires_approval', sa.Boolean(), default=False),
        sa.Column('approved_by', sa.Integer()),
        sa.Column('approved_at', sa.DateTime()),
        sa.Column('approval_comments', sa.Text()),
        sa.Column('usage_count', sa.Integer(), default=0),
        sa.Column('last_used_at', sa.DateTime()),
        sa.Column('rating', sa.Float()),
        sa.Column('rating_count', sa.Integer(), default=0),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by', sa.Integer()),
        sa.Column('updated_at', sa.DateTime()),
        sa.Column('config', sa.JSON(), default={}),
        sa.Column('metadata_fields', sa.JSON(), default={}),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['parent_template_id'], ['templates.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
    )
    op.create_index('idx_template_tenant_category', 'templates', ['tenant_id', 'category'])
    op.create_index('idx_template_tenant_active', 'templates', ['tenant_id', 'is_active'])
    op.create_index('idx_template_search', 'templates', ['tenant_id', 'name', 'category'])
    op.create_unique_constraint(
        'uq_template_name_version', 'templates',
        ['tenant_id', 'name', 'version']
    )
    
    # Create template_versions table
    op.create_table(
        'template_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('change_summary', sa.Text()),
        sa.Column('change_type', sa.String(50)),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['template_id'], ['templates.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )
    op.create_index('idx_template_version', 'template_versions', ['template_id', 'version_number'])
    op.create_unique_constraint(
        'uq_template_version', 'template_versions',
        ['template_id', 'version_number']
    )
    
    # Create template_variables table
    op.create_table(
        'template_variables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('variable_name', sa.String(100), nullable=False),
        sa.Column('variable_type', sa.Enum(
            'text', 'number', 'date', 'datetime', 'boolean',
            'select', 'multiselect', 'email', 'url', 'currency',
            'percentage', 'textarea',
            name='variable_type'
        ), nullable=False),
        sa.Column('display_name', sa.String(255)),
        sa.Column('description', sa.Text()),
        sa.Column('placeholder', sa.String(255)),
        sa.Column('help_text', sa.Text()),
        sa.Column('is_required', sa.Boolean(), default=False),
        sa.Column('default_value', sa.Text()),
        sa.Column('validation_rules', sa.JSON(), default={}),
        sa.Column('options', sa.JSON()),
        sa.Column('depends_on', sa.String(100)),
        sa.Column('show_when', sa.JSON()),
        sa.Column('format_pattern', sa.String(255)),
        sa.Column('transform', sa.String(50)),
        sa.Column('position', sa.Integer(), default=0),
        sa.Column('group_name', sa.String(100)),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['template_id'], ['templates.id']),
    )
    op.create_index('idx_template_variable', 'template_variables', ['template_id', 'variable_name'])
    op.create_unique_constraint(
        'uq_template_variable', 'template_variables',
        ['template_id', 'variable_name']
    )
    
    # Create clause_library table
    op.create_table(
        'clause_library',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(100)),
        sa.Column('clause_type', sa.String(50)),
        sa.Column('tags', postgresql.ARRAY(sa.String()), default=[]),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('parent_clause_id', sa.Integer()),
        sa.Column('jurisdiction', sa.String(100)),
        sa.Column('legal_area', sa.String(100)),
        sa.Column('risk_level', sa.String(20)),
        sa.Column('is_approved', sa.Boolean(), default=False),
        sa.Column('approved_by', sa.Integer()),
        sa.Column('approved_at', sa.DateTime()),
        sa.Column('usage_count', sa.Integer(), default=0),
        sa.Column('last_used_at', sa.DateTime()),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
        sa.Column('notes', sa.Text()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['parent_clause_id'], ['clause_library.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
    )
    op.create_index('idx_clause_tenant_category', 'clause_library', ['tenant_id', 'category'])
    op.create_index('idx_clause_search', 'clause_library', ['tenant_id', 'name', 'category'])
    op.create_unique_constraint(
        'uq_clause_name_version', 'clause_library',
        ['tenant_id', 'name', 'version']
    )
    
    # Create template_usage table
    op.create_table(
        'template_usage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('used_by', sa.Integer(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=False),
        sa.Column('contract_id', sa.Integer()),
        sa.Column('usage_type', sa.String(50)),
        sa.Column('render_time_ms', sa.Integer()),
        sa.Column('variables_used', sa.JSON()),
        sa.Column('user_rating', sa.Integer()),
        sa.Column('user_feedback', sa.Text()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['template_id'], ['templates.id']),
        sa.ForeignKeyConstraint(['used_by'], ['users.id']),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id']),
    )
    op.create_index('idx_usage_template_date', 'template_usage', ['template_id', 'used_at'])
    op.create_index('idx_usage_user', 'template_usage', ['used_by', 'used_at'])


def downgrade():
    # Drop tables in reverse order
    op.drop_table('template_usage')
    op.drop_table('clause_library')
    op.drop_table('template_variables')
    op.drop_table('template_versions')
    op.drop_table('templates')
    op.drop_table('template_categories')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS template_status')
    op.execute('DROP TYPE IF EXISTS variable_type')