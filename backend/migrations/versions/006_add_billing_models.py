"""Add billing models for resource usage and payment tracking

Revision ID: 006
Revises: 005
Create Date: 2024-01-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create billing-related tables."""
    
    # Create tenant_subscriptions table
    op.create_table(
        'tenant_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('plan', sa.Enum('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM', name='billingplan'), nullable=False),
        sa.Column('status', sa.Enum('ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', name='paymentstatus'), nullable=False),
        sa.Column('billing_email', sa.String(255), nullable=True),
        sa.Column('billing_name', sa.String(255), nullable=True),
        sa.Column('billing_address', sa.JSON(), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('payment_details', sa.JSON(), nullable=True),
        sa.Column('trial_ends_at', sa.DateTime(), nullable=True),
        sa.Column('current_period_start', sa.DateTime(), nullable=True),
        sa.Column('current_period_end', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.Column('stripe_customer_id', sa.String(255), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(255), nullable=True),
        sa.Column('custom_quotas', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id'),
        sa.UniqueConstraint('stripe_customer_id'),
        sa.UniqueConstraint('stripe_subscription_id')
    )
    op.create_index(op.f('ix_tenant_subscriptions_tenant_id'), 'tenant_subscriptions', ['tenant_id'], unique=False)
    
    # Create billing_events table
    op.create_table(
        'billing_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('event_name', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=True, default=1.0),
        sa.Column('unit_price', sa.Float(), nullable=True, default=0.0),
        sa.Column('total_price', sa.Float(), nullable=True, default=0.0),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('resource_id', sa.String(255), nullable=True),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('is_processed', sa.Boolean(), nullable=True, default=False),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('invoice_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_billing_events_tenant_id'), 'billing_events', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_billing_events_user_id'), 'billing_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_billing_events_event_type'), 'billing_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_billing_events_created_at'), 'billing_events', ['created_at'], unique=False)
    
    # Create resource_usage table
    op.create_table(
        'resource_usage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('period_start', sa.DateTime(), nullable=False),
        sa.Column('period_end', sa.DateTime(), nullable=False),
        sa.Column('storage_gb', sa.Float(), nullable=True, default=0.0),
        sa.Column('api_calls', sa.Integer(), nullable=True, default=0),
        sa.Column('user_count', sa.Integer(), nullable=True, default=0),
        sa.Column('contract_count', sa.Integer(), nullable=True, default=0),
        sa.Column('document_count', sa.Integer(), nullable=True, default=0),
        sa.Column('ai_tokens_used', sa.Integer(), nullable=True, default=0),
        sa.Column('total_cost', sa.Float(), nullable=True, default=0.0),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_resource_usage_tenant_id'), 'resource_usage', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_resource_usage_period_start'), 'resource_usage', ['period_start'], unique=False)
    op.create_index(op.f('ix_resource_usage_period_end'), 'resource_usage', ['period_end'], unique=False)
    
    # Create invoices table
    op.create_table(
        'invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('invoice_number', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='draft'),
        sa.Column('subtotal', sa.Float(), nullable=True, default=0.0),
        sa.Column('tax_amount', sa.Float(), nullable=True, default=0.0),
        sa.Column('total_amount', sa.Float(), nullable=True, default=0.0),
        sa.Column('paid_amount', sa.Float(), nullable=True, default=0.0),
        sa.Column('invoice_date', sa.DateTime(), nullable=False),
        sa.Column('due_date', sa.DateTime(), nullable=False),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('line_items', sa.JSON(), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('stripe_invoice_id', sa.String(255), nullable=True),
        sa.Column('payment_intent_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number'),
        sa.UniqueConstraint('stripe_invoice_id')
    )
    op.create_index(op.f('ix_invoices_tenant_id'), 'invoices', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_invoices_invoice_number'), 'invoices', ['invoice_number'], unique=True)


def downgrade() -> None:
    """Drop billing-related tables."""
    op.drop_index(op.f('ix_invoices_invoice_number'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_tenant_id'), table_name='invoices')
    op.drop_table('invoices')
    
    op.drop_index(op.f('ix_resource_usage_period_end'), table_name='resource_usage')
    op.drop_index(op.f('ix_resource_usage_period_start'), table_name='resource_usage')
    op.drop_index(op.f('ix_resource_usage_tenant_id'), table_name='resource_usage')
    op.drop_table('resource_usage')
    
    op.drop_index(op.f('ix_billing_events_created_at'), table_name='billing_events')
    op.drop_index(op.f('ix_billing_events_event_type'), table_name='billing_events')
    op.drop_index(op.f('ix_billing_events_user_id'), table_name='billing_events')
    op.drop_index(op.f('ix_billing_events_tenant_id'), table_name='billing_events')
    op.drop_table('billing_events')
    
    op.drop_index(op.f('ix_tenant_subscriptions_tenant_id'), table_name='tenant_subscriptions')
    op.drop_table('tenant_subscriptions')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS billingplan')
    op.execute('DROP TYPE IF EXISTS paymentstatus')