"""Add audit and compliance system tables

Revision ID: 005
Revises: 004
Create Date: 2024-01-01 00:00:00.000000

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
    # Create signature_certificates table
    op.create_table('signature_certificates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('certificate_data', sa.Text(), nullable=False),
        sa.Column('public_key', sa.Text(), nullable=False),
        sa.Column('private_key', sa.Text(), nullable=False),
        sa.Column('serial_number', sa.String(length=255), nullable=False),
        sa.Column('issuer', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('valid_from', sa.DateTime(), nullable=False),
        sa.Column('valid_to', sa.DateTime(), nullable=False),
        sa.Column('key_usage', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('revocation_reason', sa.String(length=255), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('serial_number')
    )
    op.create_index('ix_signature_certificates_user', 'signature_certificates', ['user_id'])
    op.create_index('ix_signature_certificates_serial', 'signature_certificates', ['serial_number'])
    op.create_index('ix_signature_certificates_tenant', 'signature_certificates', ['tenant_id'])
    
    # Create digital_signatures table
    op.create_table('digital_signatures',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('signer_id', sa.Integer(), nullable=False),
        sa.Column('certificate_id', sa.Integer(), nullable=False),
        sa.Column('signature_data', sa.Text(), nullable=False),
        sa.Column('signature_type', sa.String(length=50), nullable=False),
        sa.Column('document_hash', sa.String(length=255), nullable=False),
        sa.Column('signature_algorithm', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('timestamp_token', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('is_valid', sa.Boolean(), nullable=False, default=True),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_by', sa.Integer(), nullable=True),
        sa.Column('revocation_reason', sa.Text(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['signer_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['certificate_id'], ['signature_certificates.id']),
        sa.ForeignKeyConstraint(['revoked_by'], ['users.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_digital_signatures_document', 'digital_signatures', ['document_id'])
    op.create_index('ix_digital_signatures_signer', 'digital_signatures', ['signer_id'])
    op.create_index('ix_digital_signatures_timestamp', 'digital_signatures', ['timestamp'])
    op.create_index('ix_digital_signatures_status', 'digital_signatures', ['status'])
    op.create_index('ix_digital_signatures_tenant', 'digital_signatures', ['tenant_id'])
    
    # Create signature_workflows table
    op.create_table('signature_workflows',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('workflow_name', sa.String(length=255), nullable=False),
        sa.Column('total_required', sa.Integer(), nullable=False),
        sa.Column('completed_count', sa.Integer(), nullable=False, default=0),
        sa.Column('require_all', sa.Boolean(), nullable=False, default=True),
        sa.Column('signers', sa.JSON(), nullable=False),
        sa.Column('signed_by', sa.JSON(), nullable=True),
        sa.Column('signing_order', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('deadline', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_signature_workflows_document', 'signature_workflows', ['document_id'])
    op.create_index('ix_signature_workflows_status', 'signature_workflows', ['status'])
    op.create_index('ix_signature_workflows_tenant', 'signature_workflows', ['tenant_id'])
    
    # Create timestamps table
    op.create_table('timestamps',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('hash_value', sa.String(length=255), nullable=False),
        sa.Column('hash_algorithm', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('timestamp_token', sa.Text(), nullable=False),
        sa.Column('timestamp_authority', sa.String(length=255), nullable=False),
        sa.Column('tsa_certificate', sa.Text(), nullable=True),
        sa.Column('serial_number', sa.String(length=255), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('ordering', sa.Boolean(), nullable=False, default=False),
        sa.Column('nonce', sa.String(length=255), nullable=True),
        sa.Column('verified', sa.Boolean(), nullable=False, default=False),
        sa.Column('verification_time', sa.DateTime(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('serial_number')
    )
    op.create_index('ix_timestamps_document', 'timestamps', ['document_id'])
    op.create_index('ix_timestamps_serial', 'timestamps', ['serial_number'])
    op.create_index('ix_timestamps_timestamp', 'timestamps', ['timestamp'])
    
    # Create evidence_chains table
    op.create_table('evidence_chains',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=True),
        sa.Column('chain_type', sa.String(length=50), nullable=False),
        sa.Column('chain_id', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('sealed_at', sa.DateTime(), nullable=True),
        sa.Column('sealed_by', sa.Integer(), nullable=True),
        sa.Column('hash_pointer', sa.String(length=255), nullable=False),
        sa.Column('entry_count', sa.Integer(), nullable=False, default=0),
        sa.Column('last_entry_hash', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('parent_chain_id', sa.Integer(), nullable=True),
        sa.Column('branch_point', sa.Integer(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['sealed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['parent_chain_id'], ['evidence_chains.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chain_id')
    )
    op.create_index('ix_evidence_chains_document', 'evidence_chains', ['document_id'])
    op.create_index('ix_evidence_chains_chain_id', 'evidence_chains', ['chain_id'])
    op.create_index('ix_evidence_chains_status', 'evidence_chains', ['status'])
    op.create_index('ix_evidence_chains_tenant', 'evidence_chains', ['tenant_id'])
    
    # Create evidence_entries table
    op.create_table('evidence_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('chain_id', sa.Integer(), nullable=False),
        sa.Column('entry_number', sa.Integer(), nullable=False),
        sa.Column('previous_hash', sa.String(length=255), nullable=False),
        sa.Column('entry_hash', sa.String(length=255), nullable=False),
        sa.Column('action', sa.String(length=255), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('evidence_hash', sa.String(length=255), nullable=True),
        sa.Column('evidence_location', sa.String(length=500), nullable=True),
        sa.Column('signature', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('is_sealed', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['chain_id'], ['evidence_chains.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chain_id', 'entry_number', name='uix_chain_entry')
    )
    op.create_index('ix_evidence_entries_chain', 'evidence_entries', ['chain_id'])
    op.create_index('ix_evidence_entries_actor', 'evidence_entries', ['actor_id'])
    op.create_index('ix_evidence_entries_timestamp', 'evidence_entries', ['timestamp'])
    op.create_index('ix_evidence_entries_hash', 'evidence_entries', ['entry_hash'])
    
    # Create compliance_reports table
    op.create_table('compliance_reports',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=True),
        sa.Column('report_type', sa.String(length=100), nullable=False),
        sa.Column('report_period_start', sa.DateTime(), nullable=False),
        sa.Column('report_period_end', sa.DateTime(), nullable=False),
        sa.Column('generated_by', sa.Integer(), nullable=False),
        sa.Column('report_data', sa.JSON(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('compliance_status', sa.String(length=50), nullable=False),
        sa.Column('issues_found', sa.Integer(), nullable=False, default=0),
        sa.Column('recommendations', sa.JSON(), nullable=True),
        sa.Column('report_hash', sa.String(length=255), nullable=False),
        sa.Column('signed', sa.Boolean(), nullable=False, default=False),
        sa.Column('signature_id', sa.Integer(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id']),
        sa.ForeignKeyConstraint(['generated_by'], ['users.id']),
        sa.ForeignKeyConstraint(['signature_id'], ['digital_signatures.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_compliance_reports_document', 'compliance_reports', ['document_id'])
    op.create_index('ix_compliance_reports_type', 'compliance_reports', ['report_type'])
    op.create_index('ix_compliance_reports_period', 'compliance_reports', ['report_period_start', 'report_period_end'])
    op.create_index('ix_compliance_reports_tenant', 'compliance_reports', ['tenant_id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('compliance_reports')
    op.drop_table('evidence_entries')
    op.drop_table('evidence_chains')
    op.drop_table('timestamps')
    op.drop_table('signature_workflows')
    op.drop_table('digital_signatures')
    op.drop_table('signature_certificates')