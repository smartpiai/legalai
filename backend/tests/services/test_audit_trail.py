"""
Audit Trail Service Tests
Following TDD - RED phase: Comprehensive test suite for audit trail service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json
import hashlib

from app.services.audit_trail import (
    AuditTrailService,
    AuditEvent,
    AuditLog,
    AuditQuery,
    AuditReport,
    AuditRetention,
    AuditExport,
    AuditAlert,
    EventType,
    EventSeverity,
    EntityType,
    ActionType,
    ComplianceStandard
)
from app.models.audit import Audit, AuditEntry, AuditArchive
from app.core.exceptions import ValidationError, SecurityError, RetentionError


class TestAuditTrailService:
    """Test suite for audit trail service"""

    @pytest.fixture
    def mock_postgres(self):
        """Mock PostgreSQL connection"""
        db = AsyncMock()
        db.query = AsyncMock()
        db.execute = AsyncMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.lpush = AsyncMock()
        return redis

    @pytest.fixture
    def mock_elasticsearch(self):
        """Mock Elasticsearch client"""
        es = AsyncMock()
        es.index = AsyncMock()
        es.search = AsyncMock()
        es.delete = AsyncMock()
        return es

    @pytest.fixture
    def mock_encryption_service(self):
        """Mock encryption service"""
        service = AsyncMock()
        service.encrypt = AsyncMock(return_value="encrypted_data")
        service.decrypt = AsyncMock(return_value="decrypted_data")
        return service

    @pytest.fixture
    def audit_service(
        self,
        mock_postgres,
        mock_redis,
        mock_elasticsearch,
        mock_encryption_service
    ):
        """Create audit trail service instance"""
        return AuditTrailService(
            postgres=mock_postgres,
            redis=mock_redis,
            elasticsearch=mock_elasticsearch,
            encryption_service=mock_encryption_service
        )

    @pytest.fixture
    def sample_event(self):
        """Sample audit event"""
        return AuditEvent(
            event_type=EventType.DATA_ACCESS,
            entity_type=EntityType.CONTRACT,
            entity_id="contract-123",
            action=ActionType.READ,
            user_id="user-456",
            details={"fields_accessed": ["title", "value"]}
        )

    # Test Event Logging

    @pytest.mark.asyncio
    async def test_log_audit_event(self, audit_service, sample_event):
        """Test logging an audit event"""
        result = await audit_service.log_event(
            event=sample_event,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, AuditLog)
        assert result.event_id is not None
        assert result.timestamp is not None
        assert result.hash is not None

    @pytest.mark.asyncio
    async def test_log_batch_events(self, audit_service):
        """Test logging multiple events in batch"""
        events = [
            AuditEvent(
                event_type=EventType.DATA_MODIFY,
                entity_type=EntityType.CONTRACT,
                entity_id=f"contract-{i}",
                action=ActionType.UPDATE,
                user_id="user-123"
            )
            for i in range(5)
        ]
        
        results = await audit_service.log_batch(
            events=events,
            tenant_id="tenant-123"
        )
        
        assert len(results) == 5
        assert all(r.event_id is not None for r in results)

    @pytest.mark.asyncio
    async def test_log_sensitive_operation(self, audit_service):
        """Test logging sensitive operations with encryption"""
        event = AuditEvent(
            event_type=EventType.SECURITY_EVENT,
            entity_type=EntityType.USER,
            entity_id="user-789",
            action=ActionType.PASSWORD_CHANGE,
            user_id="user-789",
            details={"ip_address": "192.168.1.1"},
            is_sensitive=True
        )
        
        result = await audit_service.log_event(
            event=event,
            tenant_id="tenant-123"
        )
        
        assert result.is_encrypted is True

    @pytest.mark.asyncio
    async def test_log_with_session_context(self, audit_service):
        """Test logging with session context"""
        result = await audit_service.log_with_context(
            event_type=EventType.DATA_ACCESS,
            entity_id="doc-123",
            action=ActionType.READ,
            session_id="session-456",
            ip_address="10.0.0.1",
            user_agent="Mozilla/5.0",
            tenant_id="tenant-123"
        )
        
        assert result.session_id == "session-456"
        assert result.metadata["ip_address"] == "10.0.0.1"

    # Test Audit Querying

    @pytest.mark.asyncio
    async def test_query_audit_logs(self, audit_service):
        """Test querying audit logs"""
        query = AuditQuery(
            start_date=datetime.utcnow() - timedelta(days=7),
            end_date=datetime.utcnow(),
            entity_type=EntityType.CONTRACT,
            user_id="user-123"
        )
        
        results = await audit_service.query_logs(
            query=query,
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, list)
        assert all(isinstance(log, AuditLog) for log in results)

    @pytest.mark.asyncio
    async def test_search_audit_logs(self, audit_service):
        """Test searching audit logs with text search"""
        results = await audit_service.search_logs(
            search_text="contract modification",
            limit=50,
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, list)
        assert len(results) <= 50

    @pytest.mark.asyncio
    async def test_get_entity_history(self, audit_service):
        """Test getting complete audit history for an entity"""
        history = await audit_service.get_entity_history(
            entity_type=EntityType.CONTRACT,
            entity_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(history, list)
        assert all(log.entity_id == "contract-123" for log in history)

    @pytest.mark.asyncio
    async def test_get_user_activity(self, audit_service):
        """Test getting user activity audit logs"""
        activity = await audit_service.get_user_activity(
            user_id="user-123",
            start_date=datetime.utcnow() - timedelta(days=30),
            tenant_id="tenant-123"
        )
        
        assert isinstance(activity, list)
        assert all(log.user_id == "user-123" for log in activity)

    # Test Audit Analytics

    @pytest.mark.asyncio
    async def test_generate_audit_report(self, audit_service):
        """Test generating audit report"""
        report = await audit_service.generate_report(
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow(),
            group_by="event_type",
            tenant_id="tenant-123"
        )
        
        assert isinstance(report, AuditReport)
        assert report.total_events > 0
        assert report.summary is not None

    @pytest.mark.asyncio
    async def test_get_audit_statistics(self, audit_service):
        """Test getting audit statistics"""
        stats = await audit_service.get_statistics(
            period="monthly",
            tenant_id="tenant-123"
        )
        
        assert "total_events" in stats
        assert "events_by_type" in stats
        assert "top_users" in stats

    @pytest.mark.asyncio
    async def test_detect_anomalies(self, audit_service):
        """Test detecting anomalies in audit logs"""
        anomalies = await audit_service.detect_anomalies(
            lookback_hours=24,
            tenant_id="tenant-123"
        )
        
        assert isinstance(anomalies, list)
        assert all("anomaly_type" in a for a in anomalies)

    @pytest.mark.asyncio
    async def test_get_access_patterns(self, audit_service):
        """Test analyzing access patterns"""
        patterns = await audit_service.analyze_access_patterns(
            entity_type=EntityType.CONTRACT,
            days=7,
            tenant_id="tenant-123"
        )
        
        assert "peak_hours" in patterns
        assert "frequent_users" in patterns
        assert "access_frequency" in patterns

    # Test Compliance Features

    @pytest.mark.asyncio
    async def test_compliance_audit_trail(self, audit_service):
        """Test generating compliance-specific audit trail"""
        trail = await audit_service.get_compliance_trail(
            standard=ComplianceStandard.SOC2,
            start_date=datetime.utcnow() - timedelta(days=90),
            tenant_id="tenant-123"
        )
        
        assert trail.standard == ComplianceStandard.SOC2
        assert trail.is_compliant is not None

    @pytest.mark.asyncio
    async def test_gdpr_audit_requirements(self, audit_service):
        """Test GDPR-specific audit requirements"""
        gdpr_logs = await audit_service.get_gdpr_logs(
            user_id="user-123",
            include_data_processing=True,
            tenant_id="tenant-123"
        )
        
        assert "data_access" in gdpr_logs
        assert "data_modifications" in gdpr_logs
        assert "consent_records" in gdpr_logs

    @pytest.mark.asyncio
    async def test_regulatory_export(self, audit_service):
        """Test exporting audit logs for regulatory purposes"""
        export = await audit_service.export_for_regulator(
            regulator="SEC",
            period_start=datetime.utcnow() - timedelta(days=365),
            period_end=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert export.format == "regulatory_standard"
        assert export.is_signed is True

    # Test Data Retention

    @pytest.mark.asyncio
    async def test_set_retention_policy(self, audit_service):
        """Test setting audit retention policy"""
        policy = await audit_service.set_retention_policy(
            event_type=EventType.DATA_ACCESS,
            retention_days=2555,
            tenant_id="tenant-123"
        )
        
        assert isinstance(policy, AuditRetention)
        assert policy.retention_days == 2555

    @pytest.mark.asyncio
    async def test_archive_old_logs(self, audit_service):
        """Test archiving old audit logs"""
        archived = await audit_service.archive_logs(
            older_than_days=90,
            tenant_id="tenant-123"
        )
        
        assert archived["archived_count"] > 0
        assert archived["archive_location"] is not None

    @pytest.mark.asyncio
    async def test_purge_expired_logs(self, audit_service):
        """Test purging expired audit logs"""
        purged = await audit_service.purge_expired_logs(
            tenant_id="tenant-123"
        )
        
        assert "purged_count" in purged
        assert "freed_space_mb" in purged

    @pytest.mark.asyncio
    async def test_restore_from_archive(self, audit_service):
        """Test restoring audit logs from archive"""
        restored = await audit_service.restore_from_archive(
            archive_id="archive-123",
            tenant_id="tenant-123"
        )
        
        assert restored["restored_count"] > 0

    # Test Export and Import

    @pytest.mark.asyncio
    async def test_export_audit_logs(self, audit_service):
        """Test exporting audit logs"""
        export = await audit_service.export_logs(
            format="json",
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert isinstance(export, AuditExport)
        assert export.format == "json"
        assert export.file_path is not None

    @pytest.mark.asyncio
    async def test_export_with_filters(self, audit_service):
        """Test exporting with filters"""
        export = await audit_service.export_logs(
            format="csv",
            filters={
                "event_type": EventType.DATA_MODIFY,
                "entity_type": EntityType.CONTRACT
            },
            tenant_id="tenant-123"
        )
        
        assert export.row_count > 0

    @pytest.mark.asyncio
    async def test_import_audit_logs(self, audit_service):
        """Test importing audit logs"""
        imported = await audit_service.import_logs(
            file_path="/imports/audit_backup.json",
            validate=True,
            tenant_id="tenant-123"
        )
        
        assert imported["imported_count"] > 0
        assert imported["validation_errors"] == 0

    # Test Real-time Features

    @pytest.mark.asyncio
    async def test_stream_audit_events(self, audit_service):
        """Test streaming audit events in real-time"""
        stream = await audit_service.create_event_stream(
            filters={"event_type": EventType.SECURITY_EVENT},
            tenant_id="tenant-123"
        )
        
        assert stream.is_active is True
        assert stream.stream_id is not None

    @pytest.mark.asyncio
    async def test_subscribe_to_events(self, audit_service):
        """Test subscribing to audit events"""
        subscription = await audit_service.subscribe(
            event_types=[EventType.DATA_DELETE, EventType.SECURITY_EVENT],
            callback_url="https://webhook.example.com/audit",
            tenant_id="tenant-123"
        )
        
        assert subscription.is_active is True

    @pytest.mark.asyncio
    async def test_audit_alert_rules(self, audit_service):
        """Test creating audit alert rules"""
        rule = await audit_service.create_alert_rule(
            name="Suspicious Activity",
            condition="failed_login_attempts > 5",
            severity=EventSeverity.HIGH,
            tenant_id="tenant-123"
        )
        
        assert isinstance(rule, AuditAlert)
        assert rule.is_enabled is True

    # Test Integrity Features

    @pytest.mark.asyncio
    async def test_verify_log_integrity(self, audit_service):
        """Test verifying audit log integrity"""
        verification = await audit_service.verify_integrity(
            start_date=datetime.utcnow() - timedelta(days=7),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert verification["is_valid"] is True
        assert verification["invalid_entries"] == 0

    @pytest.mark.asyncio
    async def test_calculate_log_hash(self, audit_service):
        """Test calculating hash for audit log"""
        log_hash = await audit_service.calculate_hash(
            event_id="event-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(log_hash, str)
        assert len(log_hash) == 64  # SHA-256

    @pytest.mark.asyncio
    async def test_create_hash_chain(self, audit_service):
        """Test creating hash chain for audit logs"""
        chain = await audit_service.create_hash_chain(
            start_id="event-100",
            end_id="event-200",
            tenant_id="tenant-123"
        )
        
        assert chain["chain_valid"] is True
        assert len(chain["hashes"]) > 0

    # Test Search and Filter

    @pytest.mark.asyncio
    async def test_advanced_search(self, audit_service):
        """Test advanced search capabilities"""
        results = await audit_service.advanced_search(
            query="action:UPDATE AND entity_type:CONTRACT",
            date_range="last_7_days",
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_filter_by_ip_range(self, audit_service):
        """Test filtering by IP address range"""
        results = await audit_service.filter_by_ip_range(
            start_ip="192.168.1.1",
            end_ip="192.168.1.255",
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_filter_by_risk_level(self, audit_service):
        """Test filtering by risk level"""
        high_risk = await audit_service.filter_by_risk(
            risk_level="high",
            tenant_id="tenant-123"
        )
        
        assert all(log.risk_score >= 7 for log in high_risk)

    # Test Correlation

    @pytest.mark.asyncio
    async def test_correlate_events(self, audit_service):
        """Test correlating related audit events"""
        correlations = await audit_service.correlate_events(
            base_event_id="event-123",
            correlation_window_minutes=60,
            tenant_id="tenant-123"
        )
        
        assert "related_events" in correlations
        assert "correlation_score" in correlations

    @pytest.mark.asyncio
    async def test_identify_event_chains(self, audit_service):
        """Test identifying event chains"""
        chains = await audit_service.identify_chains(
            user_id="user-123",
            time_window_hours=24,
            tenant_id="tenant-123"
        )
        
        assert isinstance(chains, list)
        assert all("chain_id" in c for c in chains)

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_audit_isolation(self, audit_service):
        """Test audit log isolation between tenants"""
        # Log event for tenant A
        event_a = await audit_service.log_event(
            event=AuditEvent(
                event_type=EventType.DATA_ACCESS,
                entity_id="secret-doc",
                action=ActionType.READ,
                user_id="user-A"
            ),
            tenant_id="tenant-A"
        )
        
        # Try to query from tenant B
        results_b = await audit_service.query_logs(
            query=AuditQuery(entity_id="secret-doc"),
            tenant_id="tenant-B"
        )
        
        assert len(results_b) == 0

    @pytest.mark.asyncio
    async def test_tenant_retention_isolation(self, audit_service):
        """Test retention policy isolation between tenants"""
        # Set retention for tenant A
        policy_a = await audit_service.set_retention_policy(
            event_type=EventType.DATA_ACCESS,
            retention_days=30,
            tenant_id="tenant-A"
        )
        
        # Tenant B should have different policy
        policy_b = await audit_service.get_retention_policy(
            event_type=EventType.DATA_ACCESS,
            tenant_id="tenant-B"
        )
        
        assert policy_b.retention_days != 30