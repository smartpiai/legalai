"""Add document security fields

Revision ID: 010
Revises: 009
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    # Create document scan status enum
    op.execute("CREATE TYPE documentscanstatus AS ENUM ('pending', 'clean', 'infected', 'error')")
    
    # Add security columns to documents table
    op.add_column('documents', sa.Column('is_encrypted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('documents', sa.Column('is_compressed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('documents', sa.Column('encryption_key_id', sa.String(length=255), nullable=True))
    op.add_column('documents', sa.Column('compression_ratio', sa.Float(), nullable=True))
    
    # Add virus scanning columns
    op.add_column('documents', sa.Column('scan_status', 
        postgresql.ENUM('pending', 'clean', 'infected', 'error', name='documentscanstatus'),
        nullable=False,
        server_default='pending'
    ))
    op.add_column('documents', sa.Column('scan_timestamp', sa.DateTime(), nullable=True))
    op.add_column('documents', sa.Column('scan_details', sa.JSON(), nullable=True))
    
    # Add backup columns
    op.add_column('documents', sa.Column('backup_location', sa.Text(), nullable=True))
    op.add_column('documents', sa.Column('backup_timestamp', sa.DateTime(), nullable=True))
    op.add_column('documents', sa.Column('last_backup_id', sa.String(length=255), nullable=True))
    
    # Create indexes for performance
    op.create_index('idx_document_scan_status', 'documents', ['scan_status'])
    op.create_index('idx_document_encryption', 'documents', ['is_encrypted'])
    op.create_index('idx_document_backup_timestamp', 'documents', ['backup_timestamp'])
    
    # Create document_scans table for scan history
    op.create_table('document_scans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('scan_status', postgresql.ENUM('pending', 'clean', 'infected', 'error', name='documentscanstatus'), nullable=False),
        sa.Column('threat_name', sa.String(length=255), nullable=True),
        sa.Column('scanner_name', sa.String(length=100), nullable=True),
        sa.Column('scanner_version', sa.String(length=50), nullable=True),
        sa.Column('scan_duration_ms', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('quarantine_location', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_scan_document_id', 'document_scans', ['document_id'])
    op.create_index('idx_scan_tenant_id', 'document_scans', ['tenant_id'])
    op.create_index('idx_scan_created_at', 'document_scans', ['created_at'])
    op.create_index('idx_scan_status', 'document_scans', ['scan_status'])
    
    # Create document_backups table for backup tracking
    op.create_table('document_backups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('backup_id', sa.String(length=255), nullable=False, unique=True),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('backup_type', sa.String(length=20), nullable=False),  # full, incremental, differential
        sa.Column('backup_path', sa.Text(), nullable=False),
        sa.Column('backup_size', sa.BigInteger(), nullable=False),
        sa.Column('checksum', sa.String(length=64), nullable=False),
        sa.Column('parent_backup_id', sa.String(length=255), nullable=True),
        sa.Column('retention_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('verification_timestamp', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_backup_backup_id', 'document_backups', ['backup_id'])
    op.create_index('idx_backup_document_id', 'document_backups', ['document_id'])
    op.create_index('idx_backup_tenant_id', 'document_backups', ['tenant_id'])
    op.create_index('idx_backup_created_at', 'document_backups', ['created_at'])
    op.create_index('idx_backup_expires_at', 'document_backups', ['expires_at'])
    
    # Create encryption_keys table for key management
    op.create_table('encryption_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key_id', sa.String(length=255), nullable=False, unique=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('key_type', sa.String(length=50), nullable=False),  # master, document, backup
        sa.Column('algorithm', sa.String(length=50), nullable=False),  # AES-256-GCM
        sa.Column('key_status', sa.String(length=20), nullable=False),  # active, rotated, expired
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('rotated_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_key_key_id', 'encryption_keys', ['key_id'])
    op.create_index('idx_key_tenant_id', 'encryption_keys', ['tenant_id'])
    op.create_index('idx_key_status', 'encryption_keys', ['key_status'])
    
    # Create quarantine table for infected files
    op.create_table('quarantine_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('threat_name', sa.String(length=255), nullable=False),
        sa.Column('quarantine_path', sa.Text(), nullable=False),
        sa.Column('file_hash', sa.String(length=64), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('detection_date', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action_taken', sa.String(length=50), nullable=True),  # deleted, restored, pending
        sa.Column('action_date', sa.DateTime(), nullable=True),
        sa.Column('action_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['action_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index('idx_quarantine_tenant_id', 'quarantine_files', ['tenant_id'])
    op.create_index('idx_quarantine_detection_date', 'quarantine_files', ['detection_date'])
    op.create_index('idx_quarantine_threat', 'quarantine_files', ['threat_name'])


def downgrade():
    # Drop tables
    op.drop_table('quarantine_files')
    op.drop_table('encryption_keys')
    op.drop_table('document_backups')
    op.drop_table('document_scans')
    
    # Drop indexes
    op.drop_index('idx_document_backup_timestamp', 'documents')
    op.drop_index('idx_document_encryption', 'documents')
    op.drop_index('idx_document_scan_status', 'documents')
    
    # Drop columns
    op.drop_column('documents', 'last_backup_id')
    op.drop_column('documents', 'backup_timestamp')
    op.drop_column('documents', 'backup_location')
    op.drop_column('documents', 'scan_details')
    op.drop_column('documents', 'scan_timestamp')
    op.drop_column('documents', 'scan_status')
    op.drop_column('documents', 'compression_ratio')
    op.drop_column('documents', 'encryption_key_id')
    op.drop_column('documents', 'is_compressed')
    op.drop_column('documents', 'is_encrypted')
    
    # Drop enum
    op.execute("DROP TYPE IF EXISTS documentscanstatus")