"""Add document intelligence tables

Revision ID: 006
Revises: 005
Create Date: 2024-01-01 00:00:00.000000

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
    # Create document_classifications table
    op.create_table('document_classifications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('primary_type', sa.String(length=50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('confidence_level', sa.String(length=20), nullable=False),
        sa.Column('secondary_types', sa.JSON(), nullable=True),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('model_version', sa.String(length=50), nullable=False),
        sa.Column('features_detected', sa.Text(), nullable=True),
        sa.Column('keywords', sa.JSON(), nullable=True),
        sa.Column('entities', sa.JSON(), nullable=True),
        sa.Column('requires_review', sa.Boolean(), nullable=False, default=False),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('corrected_type', sa.String(length=50), nullable=True),
        sa.Column('cache_key', sa.String(length=255), nullable=True),
        sa.Column('cached_at', sa.DateTime(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_document_classifications_document', 'document_classifications', ['document_id'])
    op.create_index('ix_document_classifications_type', 'document_classifications', ['primary_type'])
    op.create_index('ix_document_classifications_confidence', 'document_classifications', ['confidence'])
    op.create_index('ix_document_classifications_tenant', 'document_classifications', ['tenant_id'])
    op.create_index('ix_document_classifications_cache', 'document_classifications', ['cache_key'])
    
    # Create language_info table
    op.create_table('language_info',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('primary_language', sa.String(length=10), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('script', sa.String(length=50), nullable=True),
        sa.Column('is_multilingual', sa.Boolean(), nullable=False, default=False),
        sa.Column('languages_detected', sa.JSON(), nullable=True),
        sa.Column('translation_required', sa.Boolean(), nullable=False, default=False),
        sa.Column('target_language', sa.String(length=10), nullable=True),
        sa.Column('translation_status', sa.String(length=50), nullable=True),
        sa.Column('translated_document_id', sa.Integer(), nullable=True),
        sa.Column('language_segments', sa.JSON(), nullable=True),
        sa.Column('requires_review', sa.Boolean(), nullable=False, default=False),
        sa.Column('reviewed_by', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['translated_document_id'], ['documents.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_language_info_document', 'language_info', ['document_id'])
    op.create_index('ix_language_info_language', 'language_info', ['primary_language'])
    op.create_index('ix_language_info_tenant', 'language_info', ['tenant_id'])
    
    # Create page_analyses table
    op.create_table('page_analyses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=False),
        sa.Column('layout_type', sa.String(length=50), nullable=False),
        sa.Column('columns_detected', sa.Integer(), nullable=False, default=1),
        sa.Column('orientation', sa.String(length=20), nullable=True),
        sa.Column('has_header', sa.Boolean(), nullable=False, default=False),
        sa.Column('has_footer', sa.Boolean(), nullable=False, default=False),
        sa.Column('header', sa.Text(), nullable=True),
        sa.Column('footer', sa.Text(), nullable=True),
        sa.Column('page_margins', sa.JSON(), nullable=True),
        sa.Column('text_blocks', sa.Integer(), nullable=False, default=0),
        sa.Column('tables', sa.JSON(), nullable=True),
        sa.Column('images', sa.JSON(), nullable=True),
        sa.Column('charts', sa.JSON(), nullable=True),
        sa.Column('segments', sa.JSON(), nullable=True),
        sa.Column('has_signatures', sa.Boolean(), nullable=False, default=False),
        sa.Column('signature_regions', sa.JSON(), nullable=True),
        sa.Column('has_stamps', sa.Boolean(), nullable=False, default=False),
        sa.Column('stamp_regions', sa.JSON(), nullable=True),
        sa.Column('quality_score', sa.Float(), nullable=True),
        sa.Column('quality_issues', sa.JSON(), nullable=True),
        sa.Column('requires_enhancement', sa.Boolean(), nullable=False, default=False),
        sa.Column('word_count', sa.Integer(), nullable=False, default=0),
        sa.Column('line_count', sa.Integer(), nullable=False, default=0),
        sa.Column('avg_font_size', sa.Float(), nullable=True),
        sa.Column('font_families', sa.JSON(), nullable=True),
        sa.Column('processing_time', sa.Float(), nullable=True),
        sa.Column('processing_errors', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id', 'page_number', name='uix_document_page')
    )
    op.create_index('ix_page_analyses_document', 'page_analyses', ['document_id'])
    op.create_index('ix_page_analyses_quality', 'page_analyses', ['quality_score'])
    
    # Create classification_models table
    op.create_table('classification_models',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('model_type', sa.String(length=50), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=False),
        sa.Column('precision', sa.Float(), nullable=True),
        sa.Column('recall', sa.Float(), nullable=True),
        sa.Column('f1_score', sa.Float(), nullable=True),
        sa.Column('training_samples', sa.Integer(), nullable=False),
        sa.Column('training_date', sa.DateTime(), nullable=False),
        sa.Column('training_duration', sa.Float(), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('feature_names', sa.JSON(), nullable=True),
        sa.Column('class_labels', sa.JSON(), nullable=True),
        sa.Column('model_path', sa.String(length=500), nullable=False),
        sa.Column('model_size', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=False),
        sa.Column('deployed_at', sa.DateTime(), nullable=True),
        sa.Column('deployed_by', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['deployed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('model_name')
    )
    op.create_index('ix_classification_models_name', 'classification_models', ['model_name'])
    op.create_index('ix_classification_models_active', 'classification_models', ['is_active'])
    
    # Create language_models table
    op.create_table('language_models',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('supported_languages', sa.JSON(), nullable=False),
        sa.Column('total_languages', sa.Integer(), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=False),
        sa.Column('avg_confidence', sa.Float(), nullable=True),
        sa.Column('model_type', sa.String(length=50), nullable=False),
        sa.Column('model_path', sa.String(length=500), nullable=False),
        sa.Column('model_size', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=False),
        sa.Column('deployed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('model_name')
    )
    op.create_index('ix_language_models_name', 'language_models', ['model_name'])
    op.create_index('ix_language_models_active', 'language_models', ['is_active'])
    
    # Create processing_queue table
    op.create_table('processing_queue',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, default=5),
        sa.Column('status', sa.String(length=50), nullable=False, default='pending'),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('processing_time', sa.Float(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, default=0),
        sa.Column('max_retries', sa.Integer(), nullable=False, default=3),
        sa.Column('worker_id', sa.String(length=100), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_processing_queue_document', 'processing_queue', ['document_id'])
    op.create_index('ix_processing_queue_status', 'processing_queue', ['status'])
    op.create_index('ix_processing_queue_priority', 'processing_queue', ['priority'])
    op.create_index('ix_processing_queue_tenant', 'processing_queue', ['tenant_id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('processing_queue')
    op.drop_table('language_models')
    op.drop_table('classification_models')
    op.drop_table('page_analyses')
    op.drop_table('language_info')
    op.drop_table('document_classifications')