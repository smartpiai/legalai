"""
Compliance Monitoring Service Tests
Following TDD - RED phase: Comprehensive test suite for compliance monitoring service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.compliance_monitoring import (
    ComplianceMonitoringService,
    ComplianceRule,
    ComplianceCheck,
    ComplianceViolation,
    ComplianceReport,
    ComplianceMetrics,
    ComplianceAlert,
    ComplianceAudit,
    ComplianceCertificate,
    RegulatoryUpdate,
    ComplianceRisk,
    RuleType,
    SeverityLevel,
    ComplianceStatus,
    CheckFrequency,
    RiskLevel
)
from app.models.compliance import Compliance, ComplianceHistory, CompliancePolicy
from app.core.exceptions import ValidationError, ComplianceError, NotFoundError


class TestComplianceMonitoringService:
    """Test suite for compliance monitoring service"""

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
        redis.delete = AsyncMock()
        return redis

    @pytest.fixture
    def mock_notification_service(self):
        """Mock notification service"""
        service = AsyncMock()
        service.send = AsyncMock()
        service.send_batch = AsyncMock()
        return service

    @pytest.fixture
    def mock_audit_service(self):
        """Mock audit service"""
        service = AsyncMock()
        service.log = AsyncMock()
        service.create_trail = AsyncMock()
        return service

    @pytest.fixture
    def compliance_service(
        self,
        mock_postgres,
        mock_redis,
        mock_notification_service,
        mock_audit_service
    ):
        """Create compliance monitoring service instance"""
        return ComplianceMonitoringService(
            postgres=mock_postgres,
            redis=mock_redis,
            notification_service=mock_notification_service,
            audit_service=mock_audit_service
        )

    @pytest.fixture
    def sample_rule(self):
        """Sample compliance rule"""
        return ComplianceRule(
            id="rule-123",
            name="GDPR Data Retention",
            description="Ensure personal data is not retained beyond legal limits",
            rule_type=RuleType.DATA_PRIVACY,
            severity=SeverityLevel.HIGH,
            conditions={
                "max_retention_days": 730,
                "data_types": ["personal", "sensitive"]
            },
            enabled=True
        )

    @pytest.fixture
    def sample_check(self):
        """Sample compliance check"""
        return ComplianceCheck(
            rule_id="rule-123",
            contract_id="contract-456",
            check_date=datetime.utcnow(),
            status=ComplianceStatus.COMPLIANT,
            details={"retention_days": 365}
        )

    # Test Rule Management

    @pytest.mark.asyncio
    async def test_create_compliance_rule(self, compliance_service, sample_rule):
        """Test creating a compliance rule"""
        result = await compliance_service.create_rule(
            rule=sample_rule,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, ComplianceRule)
        assert result.name == "GDPR Data Retention"
        assert result.enabled is True

    @pytest.mark.asyncio
    async def test_update_compliance_rule(self, compliance_service):
        """Test updating a compliance rule"""
        updates = {
            "severity": SeverityLevel.CRITICAL,
            "enabled": False
        }
        
        updated = await compliance_service.update_rule(
            rule_id="rule-123",
            updates=updates,
            tenant_id="tenant-123"
        )
        
        assert updated.severity == SeverityLevel.CRITICAL
        assert updated.enabled is False

    @pytest.mark.asyncio
    async def test_delete_compliance_rule(self, compliance_service):
        """Test deleting a compliance rule"""
        result = await compliance_service.delete_rule(
            rule_id="rule-123",
            tenant_id="tenant-123"
        )
        
        assert result is True

    @pytest.mark.asyncio
    async def test_get_compliance_rules(self, compliance_service):
        """Test getting compliance rules"""
        rules = await compliance_service.get_rules(
            rule_type=RuleType.DATA_PRIVACY,
            enabled=True,
            tenant_id="tenant-123"
        )
        
        assert isinstance(rules, list)
        assert all(isinstance(r, ComplianceRule) for r in rules)

    # Test Compliance Checking

    @pytest.mark.asyncio
    async def test_check_contract_compliance(self, compliance_service):
        """Test checking contract compliance"""
        result = await compliance_service.check_compliance(
            contract_id="contract-123",
            rule_ids=["rule-1", "rule-2"],
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, list)
        assert all(isinstance(c, ComplianceCheck) for c in result)

    @pytest.mark.asyncio
    async def test_batch_compliance_check(self, compliance_service):
        """Test batch compliance checking"""
        results = await compliance_service.batch_check(
            contract_ids=["contract-1", "contract-2", "contract-3"],
            tenant_id="tenant-123"
        )
        
        assert len(results) == 3
        assert all("contract_id" in r for r in results)

    @pytest.mark.asyncio
    async def test_automated_compliance_scan(self, compliance_service):
        """Test automated compliance scanning"""
        scan_result = await compliance_service.automated_scan(
            scope="all_active_contracts",
            tenant_id="tenant-123"
        )
        
        assert scan_result["scanned_count"] > 0
        assert "violations" in scan_result
        assert "compliant_count" in scan_result

    @pytest.mark.asyncio
    async def test_schedule_compliance_check(self, compliance_service):
        """Test scheduling compliance checks"""
        schedule = await compliance_service.schedule_check(
            contract_id="contract-123",
            frequency=CheckFrequency.WEEKLY,
            start_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert schedule.frequency == CheckFrequency.WEEKLY
        assert schedule.is_active is True

    # Test Violation Management

    @pytest.mark.asyncio
    async def test_detect_violations(self, compliance_service):
        """Test detecting compliance violations"""
        violations = await compliance_service.detect_violations(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(violations, list)
        assert all(isinstance(v, ComplianceViolation) for v in violations)

    @pytest.mark.asyncio
    async def test_create_violation_record(self, compliance_service):
        """Test creating violation record"""
        violation = ComplianceViolation(
            rule_id="rule-123",
            contract_id="contract-456",
            severity=SeverityLevel.HIGH,
            description="Data retention exceeds legal limit",
            detected_date=datetime.utcnow()
        )
        
        result = await compliance_service.record_violation(
            violation=violation,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.status == "open"

    @pytest.mark.asyncio
    async def test_resolve_violation(self, compliance_service):
        """Test resolving a violation"""
        resolved = await compliance_service.resolve_violation(
            violation_id="violation-123",
            resolution="Data purged according to policy",
            resolved_by="user-456",
            tenant_id="tenant-123"
        )
        
        assert resolved.status == "resolved"
        assert resolved.resolution_date is not None

    @pytest.mark.asyncio
    async def test_escalate_violation(self, compliance_service):
        """Test escalating a violation"""
        escalated = await compliance_service.escalate_violation(
            violation_id="violation-123",
            escalation_reason="Not resolved within SLA",
            escalate_to="legal-team",
            tenant_id="tenant-123"
        )
        
        assert escalated.is_escalated is True
        assert escalated.escalation_level > 0

    # Test Compliance Reporting

    @pytest.mark.asyncio
    async def test_generate_compliance_report(self, compliance_service):
        """Test generating compliance report"""
        report = await compliance_service.generate_report(
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow(),
            include_violations=True,
            tenant_id="tenant-123"
        )
        
        assert isinstance(report, ComplianceReport)
        assert report.total_checks > 0
        assert "compliance_rate" in report.summary

    @pytest.mark.asyncio
    async def test_compliance_dashboard_metrics(self, compliance_service):
        """Test getting compliance dashboard metrics"""
        metrics = await compliance_service.get_dashboard_metrics(
            tenant_id="tenant-123"
        )
        
        assert isinstance(metrics, ComplianceMetrics)
        assert metrics.overall_compliance_rate >= 0
        assert metrics.active_violations >= 0

    @pytest.mark.asyncio
    async def test_compliance_trend_analysis(self, compliance_service):
        """Test compliance trend analysis"""
        trends = await compliance_service.analyze_trends(
            period="monthly",
            months=6,
            tenant_id="tenant-123"
        )
        
        assert len(trends) == 6
        assert all("compliance_rate" in t for t in trends)

    @pytest.mark.asyncio
    async def test_export_compliance_data(self, compliance_service):
        """Test exporting compliance data"""
        export = await compliance_service.export_data(
            format="excel",
            include_history=True,
            tenant_id="tenant-123"
        )
        
        assert export.format == "excel"
        assert export.file_path is not None

    # Test Alert Management

    @pytest.mark.asyncio
    async def test_create_compliance_alert(self, compliance_service):
        """Test creating compliance alert"""
        alert = await compliance_service.create_alert(
            title="Critical GDPR Violation",
            message="Personal data retention exceeds limit",
            severity=SeverityLevel.CRITICAL,
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(alert, ComplianceAlert)
        assert alert.is_active is True

    @pytest.mark.asyncio
    async def test_send_compliance_notifications(self, compliance_service):
        """Test sending compliance notifications"""
        sent = await compliance_service.send_notifications(
            violation_ids=["vio-1", "vio-2"],
            recipients=["legal@company.com", "compliance@company.com"],
            tenant_id="tenant-123"
        )
        
        assert sent["success_count"] == 2

    @pytest.mark.asyncio
    async def test_alert_escalation_chain(self, compliance_service):
        """Test alert escalation chain"""
        chain = await compliance_service.get_escalation_chain(
            rule_id="rule-123",
            tenant_id="tenant-123"
        )
        
        assert len(chain) > 0
        assert all("role" in level for level in chain)

    # Test Audit and History

    @pytest.mark.asyncio
    async def test_create_compliance_audit(self, compliance_service):
        """Test creating compliance audit"""
        audit = await compliance_service.create_audit(
            audit_type="quarterly",
            scope="all_contracts",
            auditor="external-auditor",
            tenant_id="tenant-123"
        )
        
        assert isinstance(audit, ComplianceAudit)
        assert audit.status == "in_progress"

    @pytest.mark.asyncio
    async def test_get_compliance_history(self, compliance_service):
        """Test getting compliance history"""
        history = await compliance_service.get_history(
            contract_id="contract-123",
            days=90,
            tenant_id="tenant-123"
        )
        
        assert isinstance(history, list)
        assert all(h.contract_id == "contract-123" for h in history)

    @pytest.mark.asyncio
    async def test_audit_trail_generation(self, compliance_service):
        """Test audit trail generation"""
        trail = await compliance_service.generate_audit_trail(
            entity_id="contract-123",
            entity_type="contract",
            start_date=datetime.utcnow() - timedelta(days=30),
            tenant_id="tenant-123"
        )
        
        assert len(trail) > 0
        assert all("timestamp" in entry for entry in trail)

    # Test Regulatory Updates

    @pytest.mark.asyncio
    async def test_fetch_regulatory_updates(self, compliance_service):
        """Test fetching regulatory updates"""
        updates = await compliance_service.fetch_regulatory_updates(
            jurisdictions=["US", "EU"],
            categories=["data_privacy", "financial"],
            tenant_id="tenant-123"
        )
        
        assert isinstance(updates, list)
        assert all(isinstance(u, RegulatoryUpdate) for u in updates)

    @pytest.mark.asyncio
    async def test_apply_regulatory_changes(self, compliance_service):
        """Test applying regulatory changes"""
        applied = await compliance_service.apply_regulatory_changes(
            update_id="update-123",
            test_mode=True,
            tenant_id="tenant-123"
        )
        
        assert applied["rules_updated"] > 0
        assert applied["contracts_affected"] >= 0

    @pytest.mark.asyncio
    async def test_regulatory_impact_assessment(self, compliance_service):
        """Test regulatory impact assessment"""
        impact = await compliance_service.assess_regulatory_impact(
            update_id="update-123",
            tenant_id="tenant-123"
        )
        
        assert "affected_contracts" in impact
        assert "compliance_gap" in impact
        assert "remediation_steps" in impact

    # Test Risk Assessment

    @pytest.mark.asyncio
    async def test_calculate_compliance_risk(self, compliance_service):
        """Test calculating compliance risk"""
        risk = await compliance_service.calculate_risk(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(risk, ComplianceRisk)
        assert risk.risk_level in [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]

    @pytest.mark.asyncio
    async def test_risk_matrix_generation(self, compliance_service):
        """Test risk matrix generation"""
        matrix = await compliance_service.generate_risk_matrix(
            tenant_id="tenant-123"
        )
        
        assert "high_risk_contracts" in matrix
        assert "risk_distribution" in matrix

    @pytest.mark.asyncio
    async def test_risk_mitigation_recommendations(self, compliance_service):
        """Test risk mitigation recommendations"""
        recommendations = await compliance_service.get_mitigation_recommendations(
            risk_level=RiskLevel.HIGH,
            rule_types=[RuleType.DATA_PRIVACY],
            tenant_id="tenant-123"
        )
        
        assert len(recommendations) > 0
        assert all("action" in r for r in recommendations)

    # Test Certification Management

    @pytest.mark.asyncio
    async def test_generate_compliance_certificate(self, compliance_service):
        """Test generating compliance certificate"""
        certificate = await compliance_service.generate_certificate(
            contract_id="contract-123",
            certification_type="SOC2",
            tenant_id="tenant-123"
        )
        
        assert isinstance(certificate, ComplianceCertificate)
        assert certificate.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_certificate(self, compliance_service):
        """Test verifying compliance certificate"""
        is_valid = await compliance_service.verify_certificate(
            certificate_id="cert-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(is_valid, bool)

    @pytest.mark.asyncio
    async def test_certificate_renewal(self, compliance_service):
        """Test certificate renewal"""
        renewed = await compliance_service.renew_certificate(
            certificate_id="cert-123",
            extension_days=365,
            tenant_id="tenant-123"
        )
        
        assert renewed.expiry_date > datetime.utcnow()

    # Test Policy Management

    @pytest.mark.asyncio
    async def test_create_compliance_policy(self, compliance_service):
        """Test creating compliance policy"""
        policy = await compliance_service.create_policy(
            name="Data Protection Policy",
            description="Company-wide data protection standards",
            rules=["rule-1", "rule-2", "rule-3"],
            tenant_id="tenant-123"
        )
        
        assert policy.name == "Data Protection Policy"
        assert len(policy.rules) == 3

    @pytest.mark.asyncio
    async def test_apply_policy_to_contracts(self, compliance_service):
        """Test applying policy to contracts"""
        applied = await compliance_service.apply_policy(
            policy_id="policy-123",
            contract_ids=["contract-1", "contract-2"],
            tenant_id="tenant-123"
        )
        
        assert applied["success_count"] == 2

    @pytest.mark.asyncio
    async def test_policy_compliance_check(self, compliance_service):
        """Test policy compliance check"""
        results = await compliance_service.check_policy_compliance(
            policy_id="policy-123",
            tenant_id="tenant-123"
        )
        
        assert "compliant_contracts" in results
        assert "violation_count" in results

    # Test Integration Features

    @pytest.mark.asyncio
    async def test_third_party_compliance_check(self, compliance_service):
        """Test third-party compliance checking"""
        result = await compliance_service.third_party_check(
            vendor="compliance-vendor",
            contract_id="contract-123",
            check_type="anti_money_laundering",
            tenant_id="tenant-123"
        )
        
        assert result["status"] in ["passed", "failed", "pending"]

    @pytest.mark.asyncio
    async def test_compliance_api_webhook(self, compliance_service):
        """Test compliance API webhook"""
        webhook_result = await compliance_service.handle_webhook(
            event_type="violation_detected",
            payload={"contract_id": "contract-123", "rule_id": "rule-456"},
            tenant_id="tenant-123"
        )
        
        assert webhook_result["processed"] is True

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_compliance_isolation(self, compliance_service):
        """Test compliance data isolation between tenants"""
        # Create rule for tenant A
        rule_a = await compliance_service.create_rule(
            rule=ComplianceRule(
                name="Tenant A Rule",
                rule_type=RuleType.FINANCIAL,
                severity=SeverityLevel.HIGH
            ),
            tenant_id="tenant-A"
        )
        
        # Try to access from tenant B
        rules_b = await compliance_service.get_rules(
            tenant_id="tenant-B"
        )
        
        assert not any(r.id == rule_a.id for r in rules_b)

    @pytest.mark.asyncio
    async def test_tenant_violation_isolation(self, compliance_service):
        """Test violation isolation between tenants"""
        # Record violation for tenant A
        violation_a = await compliance_service.record_violation(
            violation=ComplianceViolation(
                rule_id="rule-123",
                contract_id="contract-A",
                severity=SeverityLevel.CRITICAL
            ),
            tenant_id="tenant-A"
        )
        
        # Tenant B should not see tenant A's violations
        violations_b = await compliance_service.detect_violations(
            contract_id="contract-A",
            tenant_id="tenant-B"
        )
        
        assert len(violations_b) == 0