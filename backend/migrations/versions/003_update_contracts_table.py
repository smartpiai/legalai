"""Update contracts table with new fields

Revision ID: 003
Revises: 002
Create Date: 2024-01-03 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to contracts table
    op.add_column('contracts', sa.Column('contract_type', sa.String(length=100), nullable=True))
    op.add_column('contracts', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('contracts', sa.Column('start_date', sa.DateTime(), nullable=True))
    op.add_column('contracts', sa.Column('end_date', sa.DateTime(), nullable=True))
    op.add_column('contracts', sa.Column('signed_date', sa.DateTime(), nullable=True))
    op.add_column('contracts', sa.Column('approved_at', sa.DateTime(), nullable=True))
    op.add_column('contracts', sa.Column('parties', sa.JSON(), nullable=True, server_default='{}'))
    op.add_column('contracts', sa.Column('contract_metadata', sa.JSON(), nullable=True, server_default='{}'))
    op.add_column('contracts', sa.Column('created_by_id', sa.Integer(), nullable=True))
    op.add_column('contracts', sa.Column('updated_by_id', sa.Integer(), nullable=True))
    op.add_column('contracts', sa.Column('approved_by_id', sa.Integer(), nullable=True))
    op.add_column('contracts', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('contracts', sa.Column('parent_contract_id', sa.Integer(), nullable=True))
    op.add_column('contracts', sa.Column('search_vector', sa.Text(), nullable=True))
    
    # Create foreign key constraints
    op.create_foreign_key(
        'fk_contracts_created_by',
        'contracts', 'users',
        ['created_by_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_contracts_updated_by',
        'contracts', 'users',
        ['updated_by_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_contracts_approved_by',
        'contracts', 'users',
        ['approved_by_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_contracts_parent',
        'contracts', 'contracts',
        ['parent_contract_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Create unique constraint for contract_number within tenant
    op.create_unique_constraint(
        'uq_contract_number_tenant',
        'contracts',
        ['contract_number', 'tenant_id']
    )
    
    # Create index for status
    op.create_index('ix_contracts_status', 'contracts', ['status'])
    
    # Create index for is_deleted
    op.create_index('ix_contracts_is_deleted', 'contracts', ['is_deleted'])
    
    # Update status enum to include new values
    op.execute("""
        ALTER TABLE contracts 
        ALTER COLUMN status TYPE VARCHAR(50);
    """)
    
    # Update default values
    op.execute("""
        UPDATE contracts 
        SET is_deleted = false,
            version = 1,
            parties = '{}',
            contract_metadata = '{}'
        WHERE is_deleted IS NULL;
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_contracts_is_deleted', table_name='contracts')
    op.drop_index('ix_contracts_status', table_name='contracts')
    
    # Drop unique constraint
    op.drop_constraint('uq_contract_number_tenant', 'contracts', type_='unique')
    
    # Drop foreign key constraints
    op.drop_constraint('fk_contracts_parent', 'contracts', type_='foreignkey')
    op.drop_constraint('fk_contracts_approved_by', 'contracts', type_='foreignkey')
    op.drop_constraint('fk_contracts_updated_by', 'contracts', type_='foreignkey')
    op.drop_constraint('fk_contracts_created_by', 'contracts', type_='foreignkey')
    
    # Drop columns
    op.drop_column('contracts', 'search_vector')
    op.drop_column('contracts', 'parent_contract_id')
    op.drop_column('contracts', 'version')
    op.drop_column('contracts', 'approved_by_id')
    op.drop_column('contracts', 'updated_by_id')
    op.drop_column('contracts', 'created_by_id')
    op.drop_column('contracts', 'contract_metadata')
    op.drop_column('contracts', 'parties')
    op.drop_column('contracts', 'approved_at')
    op.drop_column('contracts', 'signed_date')
    op.drop_column('contracts', 'end_date')
    op.drop_column('contracts', 'start_date')
    op.drop_column('contracts', 'is_deleted')
    op.drop_column('contracts', 'contract_type')