"""Enable pg_stat_statements extension and create monitoring role

Revision ID: 009
Revises: 008
Create Date: 2026-04-09 00:00:00.000000

Implements PR 1.1.3 (Tech Spec docs/phase-1/1.0_tech-spec_infrastructure-upgrades.md
§3 Configuration, §8 Security).

- Enables pg_stat_statements extension (shared_preload_libraries must be set at
  the server level via docker-compose `command:`; this migration only creates
  the extension objects in the target database).
- Creates a least-privilege `monitoring` role with SELECT-only access to the
  pg_stat_statements view. The application role is intentionally NOT granted
  access to this view to prevent exposure of query text that may contain PII.

Acceptance: IT-PG-06, IT-PG-07, RT-06.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extension (idempotent). Requires shared_preload_libraries=pg_stat_statements
    # to be configured on the PostgreSQL server (see docker-compose.yml).
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;")

    # Create a dedicated, login-capable monitoring role with no password by
    # default. Operators must set a password out-of-band (ALTER ROLE monitoring
    # WITH PASSWORD '...') or rely on pg_hba trust/peer for the metrics
    # exporter. The role is NOINHERIT and has no other privileges.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitoring') THEN
                CREATE ROLE monitoring WITH LOGIN NOINHERIT;
            END IF;
        END
        $$;
        """
    )

    # SELECT-only access to the stats view and the reset function is
    # deliberately NOT granted. App role is untouched.
    # CRITICAL (Tech Spec §8): pg_stat_statements grants SELECT on its view to
    # PUBLIC by default. Query text may contain PII, so revoke from PUBLIC and
    # grant explicitly only to the monitoring role.
    op.execute("REVOKE ALL ON pg_stat_statements FROM PUBLIC;")
    # Revoke the reset function from PUBLIC regardless of its signature
    # (PG17 exposes pg_stat_statements_reset(oid, oid, bigint, bool)).
    op.execute(
        """
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN
                SELECT oid::regprocedure AS sig
                FROM pg_proc
                WHERE proname = 'pg_stat_statements_reset'
            LOOP
                EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
            END LOOP;
        END
        $$;
        """
    )
    op.execute("GRANT pg_read_all_stats TO monitoring;")
    op.execute("GRANT SELECT ON pg_stat_statements TO monitoring;")


def downgrade() -> None:
    op.execute("REVOKE SELECT ON pg_stat_statements FROM monitoring;")
    op.execute("REVOKE pg_read_all_stats FROM monitoring;")
    op.execute("DROP ROLE IF EXISTS monitoring;")
    op.execute("DROP EXTENSION IF EXISTS pg_stat_statements;")
