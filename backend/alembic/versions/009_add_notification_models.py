"""Add notification models

Revision ID: 009
Revises: 008
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # Create notification enums
    op.execute("CREATE TYPE notificationchannel AS ENUM ('email', 'sms', 'in_app', 'push', 'webhook')")
    op.execute("CREATE TYPE notificationstatus AS ENUM ('pending', 'scheduled', 'sent', 'delivered', 'failed', 'cancelled', 'read')")
    op.execute("CREATE TYPE notificationtype AS ENUM ('contract_created', 'contract_updated', 'contract_approval', 'contract_approved', 'contract_rejected', 'contract_signed', 'contract_expiring', 'contract_expired', 'workflow_started', 'workflow_completed', 'workflow_failed', 'task_assigned', 'task_completed', 'task_overdue', 'document_uploaded', 'document_processed', 'extraction_completed', 'deadline_reminder', 'milestone_approaching', 'renewal_reminder', 'system_announcement', 'maintenance_notice', 'security_alert', 'password_reset', 'account_activated', 'role_changed', 'weekly_summary', 'monthly_report', 'risk_alert', 'urgent_action', 'escalation')")
    op.execute("CREATE TYPE notificationpriority AS ENUM ('low', 'medium', 'high', 'urgent')")
    
    # Create notifications table
    op.create_table('notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', postgresql.ENUM('contract_created', 'contract_updated', 'contract_approval', 'contract_approved', 'contract_rejected', 'contract_signed', 'contract_expiring', 'contract_expired', 'workflow_started', 'workflow_completed', 'workflow_failed', 'task_assigned', 'task_completed', 'task_overdue', 'document_uploaded', 'document_processed', 'extraction_completed', 'deadline_reminder', 'milestone_approaching', 'renewal_reminder', 'system_announcement', 'maintenance_notice', 'security_alert', 'password_reset', 'account_activated', 'role_changed', 'weekly_summary', 'monthly_report', 'risk_alert', 'urgent_action', 'escalation', name='notificationtype'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('priority', postgresql.ENUM('low', 'medium', 'high', 'urgent', name='notificationpriority'), nullable=False),
        sa.Column('channel', postgresql.ENUM('email', 'sms', 'in_app', 'push', 'webhook', name='notificationchannel'), nullable=False),
        sa.Column('status', postgresql.ENUM('pending', 'scheduled', 'sent', 'delivered', 'failed', 'cancelled', 'read', name='notificationstatus'), nullable=False),
        sa.Column('scheduled_for', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, default=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('retry_count', sa.Integer(), default=0),
        sa.Column('last_retry_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), default={}),
        sa.Column('action_url', sa.String(length=500), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_recurring', sa.Boolean(), default=False),
        sa.Column('recurrence_pattern', sa.String(length=50), nullable=True),
        sa.Column('next_occurrence', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_notification_tenant_id', 'notifications', ['tenant_id'])
    op.create_index('idx_notification_user_id', 'notifications', ['user_id'])
    op.create_index('idx_notification_type', 'notifications', ['type'])
    op.create_index('idx_notification_status', 'notifications', ['status'])
    op.create_index('idx_notification_is_read', 'notifications', ['is_read'])
    op.create_index('idx_notification_scheduled_for', 'notifications', ['scheduled_for'])
    op.create_index('idx_notification_expires_at', 'notifications', ['expires_at'])
    op.create_index('idx_notification_user_unread', 'notifications', ['user_id', 'is_read'])
    op.create_index('idx_notification_user_created', 'notifications', ['user_id', 'created_at'])
    op.create_index('idx_notification_scheduled', 'notifications', ['status', 'scheduled_for'])
    op.create_index('idx_notification_tenant_type', 'notifications', ['tenant_id', 'type'])
    
    # Create notification_templates table
    op.create_table('notification_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('subject_template', sa.String(length=500), nullable=True),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('html_template', sa.Text(), nullable=True),
        sa.Column('sms_template', sa.String(length=500), nullable=True),
        sa.Column('channels', postgresql.ARRAY(sa.String()), default=[]),
        sa.Column('default_priority', postgresql.ENUM('low', 'medium', 'high', 'urgent', name='notificationpriority'), nullable=True),
        sa.Column('variables', sa.JSON(), default={}),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_template_code')
    )
    op.create_index('idx_template_tenant_id', 'notification_templates', ['tenant_id'])
    op.create_index('idx_template_tenant_active', 'notification_templates', ['tenant_id', 'is_active'])
    
    # Create notification_preferences table
    op.create_table('notification_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('email_enabled', sa.Boolean(), default=True),
        sa.Column('sms_enabled', sa.Boolean(), default=False),
        sa.Column('in_app_enabled', sa.Boolean(), default=True),
        sa.Column('push_enabled', sa.Boolean(), default=False),
        sa.Column('quiet_hours_enabled', sa.Boolean(), default=False),
        sa.Column('quiet_hours_start', sa.String(length=5), nullable=True),
        sa.Column('quiet_hours_end', sa.String(length=5), nullable=True),
        sa.Column('timezone', sa.String(length=50), default='UTC'),
        sa.Column('instant_notifications', sa.Boolean(), default=True),
        sa.Column('daily_digest', sa.Boolean(), default=False),
        sa.Column('weekly_digest', sa.Boolean(), default=False),
        sa.Column('digest_time', sa.String(length=5), nullable=True),
        sa.Column('notification_types', sa.JSON(), default={}),
        sa.Column('language', sa.String(length=10), default='en'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    
    # Create notification_logs table
    op.create_table('notification_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('notification_id', sa.Integer(), nullable=False),
        sa.Column('event', sa.String(length=50), nullable=False),
        sa.Column('channel', postgresql.ENUM('email', 'sms', 'in_app', 'push', 'webhook', name='notificationchannel'), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_log_notification', 'notification_logs', ['notification_id', 'occurred_at'])
    op.create_index('idx_log_event', 'notification_logs', ['event', 'occurred_at'])
    
    # Create notification_subscriptions table
    op.create_table('notification_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('topic', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('channels', postgresql.ARRAY(sa.String()), default=[]),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('subscribed_at', sa.DateTime(), nullable=False),
        sa.Column('unsubscribed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'topic', 'entity_type', 'entity_id', name='uq_user_subscription')
    )
    op.create_index('idx_subscription_user_topic', 'notification_subscriptions', ['user_id', 'topic'])
    op.create_index('idx_subscription_entity', 'notification_subscriptions', ['entity_type', 'entity_id'])
    
    # Create notification_batches table
    op.create_table('notification_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.String(length=100), nullable=False),
        sa.Column('type', postgresql.ENUM('contract_created', 'contract_updated', 'contract_approval', 'contract_approved', 'contract_rejected', 'contract_signed', 'contract_expiring', 'contract_expired', 'workflow_started', 'workflow_completed', 'workflow_failed', 'task_assigned', 'task_completed', 'task_overdue', 'document_uploaded', 'document_processed', 'extraction_completed', 'deadline_reminder', 'milestone_approaching', 'renewal_reminder', 'system_announcement', 'maintenance_notice', 'security_alert', 'password_reset', 'account_activated', 'role_changed', 'weekly_summary', 'monthly_report', 'risk_alert', 'urgent_action', 'escalation', name='notificationtype'), nullable=False),
        sa.Column('total_recipients', sa.Integer(), nullable=False),
        sa.Column('sent_count', sa.Integer(), default=0),
        sa.Column('failed_count', sa.Integer(), default=0),
        sa.Column('pending_count', sa.Integer(), default=0),
        sa.Column('metadata', sa.JSON(), default={}),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('batch_id')
    )
    op.create_index('idx_batch_tenant_created', 'notification_batches', ['tenant_id', 'created_at'])


def downgrade():
    # Drop tables
    op.drop_table('notification_batches')
    op.drop_table('notification_subscriptions')
    op.drop_table('notification_logs')
    op.drop_table('notification_preferences')
    op.drop_table('notification_templates')
    op.drop_table('notifications')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS notificationchannel")
    op.execute("DROP TYPE IF EXISTS notificationstatus")
    op.execute("DROP TYPE IF EXISTS notificationtype")
    op.execute("DROP TYPE IF EXISTS notificationpriority")