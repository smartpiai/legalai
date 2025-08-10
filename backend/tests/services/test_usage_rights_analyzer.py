"""
Usage Rights Analysis Service Tests
Following TDD - RED phase: Comprehensive test suite for usage rights analysis
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json
from decimal import Decimal

from app.services.usage_rights_analyzer import (
    UsageRightsAnalyzer,
    UsageRight,
    RightType,
    UsageRestriction,
    RestrictionType,
    PermissionLevel,
    UsageContext,
    RightsMatrix,
    ComplianceCheck,
    RightsAnalysisResult,
    UsagePattern,
    RightsConflict,
    LegalInterpretation,
    RightsRecommendation,
    UsageScenario,
    RightsValidation,
    ContextualAnalysis,
    RightsMapping,
    UsageRightCategory,
    AnalysisConfidence,
    RightScope,
    LicenseScope,
    GeographicScope,
    TemporalScope,
    UserScope,
    DeviceScope
)
from app.models.licensing import LicenseAgreement, UsageRights, RightsHistory
from app.core.exceptions import RightsAnalysisError, ValidationError, ComplianceError


class TestUsageRightsAnalyzer:
    """Test suite for usage rights analysis service"""

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
        redis.expire = AsyncMock()
        return redis

    @pytest.fixture
    def mock_nlp_processor(self):
        """Mock NLP processor"""
        nlp = AsyncMock()
        nlp.extract_entities = AsyncMock()
        nlp.parse_legal_terms = AsyncMock()
        nlp.analyze_context = AsyncMock()
        return nlp

    @pytest.fixture
    def rights_analyzer(
        self,
        mock_postgres,
        mock_redis,
        mock_nlp_processor
    ):
        """Create usage rights analyzer instance"""
        return UsageRightsAnalyzer(
            postgres=mock_postgres,
            redis=mock_redis,
            nlp_processor=mock_nlp_processor
        )

    @pytest.fixture
    def sample_license_text(self):
        """Sample license text with various usage rights"""
        return """
        SOFTWARE LICENSE AGREEMENT
        
        1. GRANT OF LICENSE
        The Licensee is hereby granted a non-exclusive, non-transferable license to:
        a) Install and use the Software on up to 5 computer systems
        b) Make one backup copy for archival purposes
        c) Use the Software for internal business purposes only
        d) Access and use the documentation provided
        
        2. RESTRICTIONS
        The Licensee shall NOT:
        a) Redistribute, sublicense, or sell the Software
        b) Reverse engineer, decompile, or disassemble the Software
        c) Use the Software for commercial resale or service bureau operations
        d) Remove or modify any proprietary notices
        
        3. GEOGRAPHIC RESTRICTIONS
        This license is valid only within the United States and Canada.
        
        4. TERM
        This license is perpetual unless terminated according to the terms herein.
        """

    @pytest.fixture
    def sample_usage_context(self):
        """Sample usage context"""
        return UsageContext(
            user_type="internal_employee",
            use_case="business_operations",
            location="United States",
            device_type="desktop_computer",
            concurrent_users=3,
            commercial_use=False
        )

    # Test Rights Extraction

    @pytest.mark.asyncio
    async def test_extract_usage_rights(self, rights_analyzer, sample_license_text):
        """Test extracting usage rights from license text"""
        rights = await rights_analyzer.extract_usage_rights(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(rights, list)
        assert len(rights) > 0
        assert all(isinstance(r, UsageRight) for r in rights)

    @pytest.mark.asyncio
    async def test_extract_installation_rights(self, rights_analyzer, sample_license_text):
        """Test extracting installation rights"""
        rights = await rights_analyzer.extract_usage_rights(sample_license_text, "tenant-123")
        installation_rights = [r for r in rights if r.right_type == RightType.INSTALLATION]
        
        assert len(installation_rights) > 0
        assert installation_rights[0].description is not None
        assert "install" in installation_rights[0].description.lower()

    @pytest.mark.asyncio
    async def test_extract_usage_restrictions(self, rights_analyzer, sample_license_text):
        """Test extracting usage restrictions"""
        restrictions = await rights_analyzer.extract_restrictions(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(restrictions, list)
        assert len(restrictions) > 0
        assert all(isinstance(r, UsageRestriction) for r in restrictions)

    @pytest.mark.asyncio
    async def test_analyze_geographic_restrictions(self, rights_analyzer, sample_license_text):
        """Test analyzing geographic restrictions"""
        geographic_analysis = await rights_analyzer.analyze_geographic_scope(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(geographic_analysis, GeographicScope)
        assert geographic_analysis.allowed_regions is not None
        assert "United States" in geographic_analysis.allowed_regions

    @pytest.mark.asyncio
    async def test_analyze_temporal_scope(self, rights_analyzer, sample_license_text):
        """Test analyzing temporal scope"""
        temporal_analysis = await rights_analyzer.analyze_temporal_scope(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(temporal_analysis, TemporalScope)
        assert temporal_analysis.duration_type is not None
        assert temporal_analysis.is_perpetual is True

    # Test Rights Analysis

    @pytest.mark.asyncio
    async def test_analyze_rights_compatibility(self, rights_analyzer, sample_usage_context):
        """Test analyzing rights compatibility with usage context"""
        usage_rights = [
            UsageRight(
                right_type=RightType.INSTALLATION,
                description="Install on up to 5 systems",
                limitations={"max_installations": 5}
            )
        ]
        
        compatibility = await rights_analyzer.analyze_compatibility(
            usage_rights=usage_rights,
            usage_context=sample_usage_context,
            tenant_id="tenant-123"
        )
        
        assert isinstance(compatibility, ComplianceCheck)
        assert compatibility.is_compliant is not None
        assert compatibility.compliance_score >= 0

    @pytest.mark.asyncio
    async def test_generate_rights_matrix(self, rights_analyzer):
        """Test generating rights matrix"""
        rights_matrix = await rights_analyzer.generate_rights_matrix(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(rights_matrix, RightsMatrix)
        assert rights_matrix.granted_rights is not None
        assert rights_matrix.restricted_rights is not None

    @pytest.mark.asyncio
    async def test_validate_usage_scenario(self, rights_analyzer, sample_usage_context):
        """Test validating specific usage scenario"""
        scenario = UsageScenario(
            description="Employee using software for daily work",
            context=sample_usage_context,
            actions=["install", "execute", "backup"]
        )
        
        validation = await rights_analyzer.validate_usage_scenario(
            scenario=scenario,
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(validation, RightsValidation)
        assert validation.is_valid is not None
        assert validation.violations is not None

    @pytest.mark.asyncio
    async def test_detect_rights_conflicts(self, rights_analyzer):
        """Test detecting conflicts in rights"""
        conflicting_rights = [
            UsageRight(
                right_type=RightType.COMMERCIAL_USE,
                description="Commercial use permitted"
            ),
            UsageRestriction(
                restriction_type=RestrictionType.COMMERCIAL_PROHIBITION,
                description="Commercial use prohibited"
            )
        ]
        
        conflicts = await rights_analyzer.detect_conflicts(
            rights_list=conflicting_rights,
            tenant_id="tenant-123"
        )
        
        assert isinstance(conflicts, list)
        assert all(isinstance(c, RightsConflict) for c in conflicts)

    # Test Contextual Analysis

    @pytest.mark.asyncio
    async def test_contextual_rights_analysis(self, rights_analyzer, sample_usage_context):
        """Test contextual analysis of rights"""
        contextual_analysis = await rights_analyzer.perform_contextual_analysis(
            license_text=sample_license_text,
            context=sample_usage_context,
            tenant_id="tenant-123"
        )
        
        assert isinstance(contextual_analysis, ContextualAnalysis)
        assert contextual_analysis.applicable_rights is not None
        assert contextual_analysis.context_specific_restrictions is not None

    @pytest.mark.asyncio
    async def test_analyze_user_scope(self, rights_analyzer):
        """Test analyzing user scope restrictions"""
        user_scope = await rights_analyzer.analyze_user_scope(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(user_scope, UserScope)
        assert user_scope.authorized_user_types is not None
        assert user_scope.user_limitations is not None

    @pytest.mark.asyncio
    async def test_analyze_device_scope(self, rights_analyzer):
        """Test analyzing device scope restrictions"""
        device_scope = await rights_analyzer.analyze_device_scope(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(device_scope, DeviceScope)
        assert device_scope.allowed_devices is not None
        assert device_scope.device_limitations is not None

    # Test Rights Recommendations

    @pytest.mark.asyncio
    async def test_generate_rights_recommendations(self, rights_analyzer, sample_usage_context):
        """Test generating rights recommendations"""
        recommendations = await rights_analyzer.generate_recommendations(
            current_usage=sample_usage_context,
            license_rights=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(recommendations, list)
        assert all(isinstance(r, RightsRecommendation) for r in recommendations)

    @pytest.mark.asyncio
    async def test_suggest_compliance_improvements(self, rights_analyzer):
        """Test suggesting compliance improvements"""
        improvements = await rights_analyzer.suggest_compliance_improvements(
            current_compliance_score=0.75,
            identified_issues=["Geographic restriction violation"],
            tenant_id="tenant-123"
        )
        
        assert isinstance(improvements, list)
        assert all(isinstance(i, dict) for i in improvements)
        assert all("recommendation" in i for i in improvements)

    @pytest.mark.asyncio
    async def test_optimize_rights_usage(self, rights_analyzer, sample_usage_context):
        """Test optimizing rights usage"""
        optimization = await rights_analyzer.optimize_rights_usage(
            current_usage=sample_usage_context,
            available_rights=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert "optimized_usage" in optimization
        assert "potential_savings" in optimization
        assert "risk_mitigation" in optimization

    # Test Legal Interpretation

    @pytest.mark.asyncio
    async def test_interpret_ambiguous_rights(self, rights_analyzer):
        """Test interpreting ambiguous rights language"""
        ambiguous_text = "The software may be used for reasonable business purposes"
        
        interpretation = await rights_analyzer.interpret_legal_language(
            legal_text=ambiguous_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(interpretation, LegalInterpretation)
        assert interpretation.interpretation is not None
        assert interpretation.confidence_level is not None

    @pytest.mark.asyncio
    async def test_clarify_usage_boundaries(self, rights_analyzer):
        """Test clarifying usage boundaries"""
        boundaries = await rights_analyzer.clarify_usage_boundaries(
            rights_text="Internal use only",
            tenant_id="tenant-123"
        )
        
        assert "boundary_definition" in boundaries
        assert "examples" in boundaries
        assert "edge_cases" in boundaries

    @pytest.mark.asyncio
    async def test_resolve_rights_ambiguity(self, rights_analyzer):
        """Test resolving rights ambiguity"""
        ambiguous_rights = [
            "Reasonable use permitted",
            "Limited commercial use allowed"
        ]
        
        resolution = await rights_analyzer.resolve_ambiguity(
            ambiguous_statements=ambiguous_rights,
            tenant_id="tenant-123"
        )
        
        assert isinstance(resolution, dict)
        assert "resolved_interpretations" in resolution
        assert "confidence_scores" in resolution

    # Test Rights Mapping

    @pytest.mark.asyncio
    async def test_map_rights_to_actions(self, rights_analyzer):
        """Test mapping rights to specific actions"""
        actions = ["install", "execute", "modify", "distribute"]
        
        mapping = await rights_analyzer.map_rights_to_actions(
            license_text=sample_license_text,
            actions=actions,
            tenant_id="tenant-123"
        )
        
        assert isinstance(mapping, RightsMapping)
        assert mapping.action_permissions is not None
        assert all(action in mapping.action_permissions for action in actions)

    @pytest.mark.asyncio
    async def test_create_permissions_matrix(self, rights_analyzer):
        """Test creating permissions matrix"""
        user_roles = ["employee", "contractor", "partner"]
        actions = ["view", "edit", "distribute"]
        
        matrix = await rights_analyzer.create_permissions_matrix(
            license_text=sample_license_text,
            user_roles=user_roles,
            actions=actions,
            tenant_id="tenant-123"
        )
        
        assert isinstance(matrix, dict)
        assert all(role in matrix for role in user_roles)
        assert all(action in matrix[role] for role in user_roles for action in actions)

    # Test Compliance Monitoring

    @pytest.mark.asyncio
    async def test_monitor_rights_compliance(self, rights_analyzer, sample_usage_context):
        """Test monitoring rights compliance"""
        compliance_status = await rights_analyzer.monitor_compliance(
            current_usage=sample_usage_context,
            license_rights=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(compliance_status, ComplianceCheck)
        assert compliance_status.compliance_score is not None
        assert compliance_status.compliance_issues is not None

    @pytest.mark.asyncio
    async def test_generate_compliance_report(self, rights_analyzer):
        """Test generating compliance report"""
        report = await rights_analyzer.generate_compliance_report(
            license_id="lic-123",
            reporting_period="monthly",
            tenant_id="tenant-123"
        )
        
        assert "compliance_summary" in report
        assert "rights_utilization" in report
        assert "violations_detected" in report

    @pytest.mark.asyncio
    async def test_track_usage_patterns(self, rights_analyzer):
        """Test tracking usage patterns"""
        usage_data = [
            {"action": "install", "user": "user1", "timestamp": datetime.utcnow()},
            {"action": "execute", "user": "user2", "timestamp": datetime.utcnow()}
        ]
        
        patterns = await rights_analyzer.track_usage_patterns(
            usage_data=usage_data,
            tenant_id="tenant-123"
        )
        
        assert isinstance(patterns, list)
        assert all(isinstance(p, UsagePattern) for p in patterns)

    # Test Rights Documentation

    @pytest.mark.asyncio
    async def test_generate_rights_documentation(self, rights_analyzer):
        """Test generating rights documentation"""
        documentation = await rights_analyzer.generate_rights_documentation(
            license_text=sample_license_text,
            target_audience="end_users",
            tenant_id="tenant-123"
        )
        
        assert "summary" in documentation
        assert "detailed_rights" in documentation
        assert "restrictions" in documentation
        assert "examples" in documentation

    @pytest.mark.asyncio
    async def test_create_usage_guidelines(self, rights_analyzer):
        """Test creating usage guidelines"""
        guidelines = await rights_analyzer.create_usage_guidelines(
            license_rights=sample_license_text,
            organization_context="enterprise",
            tenant_id="tenant-123"
        )
        
        assert "do_list" in guidelines
        assert "dont_list" in guidelines
        assert "best_practices" in guidelines

    # Test Rights Categories

    @pytest.mark.asyncio
    async def test_categorize_usage_rights(self, rights_analyzer):
        """Test categorizing usage rights"""
        rights_text = """
        You may install, use, modify, and create derivative works.
        You may not redistribute or sublicense the software.
        """
        
        categories = await rights_analyzer.categorize_rights(
            rights_text=rights_text,
            tenant_id="tenant-123"
        )
        
        assert isinstance(categories, dict)
        assert UsageRightCategory.PERMITTED in categories
        assert UsageRightCategory.RESTRICTED in categories

    @pytest.mark.asyncio
    async def test_classify_right_types(self, rights_analyzer):
        """Test classifying right types"""
        individual_rights = [
            "Install on 5 computers",
            "Use for internal purposes",
            "Make backup copies"
        ]
        
        classifications = await rights_analyzer.classify_right_types(
            rights_statements=individual_rights,
            tenant_id="tenant-123"
        )
        
        assert len(classifications) == len(individual_rights)
        assert all(isinstance(c, RightType) for c in classifications)

    # Test Error Handling

    @pytest.mark.asyncio
    async def test_handle_invalid_license_text(self, rights_analyzer):
        """Test handling invalid license text"""
        with pytest.raises(ValidationError):
            await rights_analyzer.extract_usage_rights(
                license_text=None,
                tenant_id="tenant-123"
            )

    @pytest.mark.asyncio
    async def test_handle_empty_license_text(self, rights_analyzer):
        """Test handling empty license text"""
        with pytest.raises(RightsAnalysisError):
            await rights_analyzer.extract_usage_rights(
                license_text="",
                tenant_id="tenant-123"
            )

    @pytest.mark.asyncio
    async def test_handle_malformed_context(self, rights_analyzer):
        """Test handling malformed usage context"""
        malformed_context = UsageContext(
            user_type=None,  # Invalid
            use_case="business",
            location="US"
        )
        
        with pytest.raises(ValidationError):
            await rights_analyzer.analyze_compatibility(
                usage_rights=[],
                usage_context=malformed_context,
                tenant_id="tenant-123"
            )

    # Test Performance and Caching

    @pytest.mark.asyncio
    async def test_rights_analysis_performance(self, rights_analyzer, sample_license_text):
        """Test rights analysis performance"""
        start_time = datetime.utcnow()
        
        await rights_analyzer.extract_usage_rights(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        assert processing_time < 3.0  # Should complete within 3 seconds

    @pytest.mark.asyncio
    async def test_caching_rights_analysis(self, rights_analyzer, sample_license_text):
        """Test caching of rights analysis results"""
        # First analysis
        result1 = await rights_analyzer.extract_usage_rights(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        # Second analysis should use cache
        result2 = await rights_analyzer.extract_usage_rights(
            license_text=sample_license_text,
            tenant_id="tenant-123"
        )
        
        assert len(result1) == len(result2)

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_rights_isolation(self, rights_analyzer, sample_license_text):
        """Test rights analysis isolation between tenants"""
        # Analyze for tenant A
        rights_a = await rights_analyzer.extract_usage_rights(
            license_text=sample_license_text,
            tenant_id="tenant-A"
        )
        
        # Analyze for tenant B
        rights_b = await rights_analyzer.extract_usage_rights(
            license_text=sample_license_text,
            tenant_id="tenant-B"
        )
        
        # Results should be independent
        assert isinstance(rights_a, list)
        assert isinstance(rights_b, list)

    @pytest.mark.asyncio
    async def test_tenant_configuration_isolation(self, rights_analyzer):
        """Test tenant configuration isolation"""
        # Set configuration for tenant A
        await rights_analyzer.set_analysis_configuration(
            config={"strict_mode": True},
            tenant_id="tenant-A"
        )
        
        # Get configuration for tenant B
        config_b = await rights_analyzer.get_analysis_configuration(
            tenant_id="tenant-B"
        )
        
        # Tenant B should have default configuration
        assert config_b.get("strict_mode") is not True

    # Test Batch Processing

    @pytest.mark.asyncio
    async def test_batch_rights_analysis(self, rights_analyzer):
        """Test batch rights analysis"""
        license_texts = [
            "License 1: Install and use rights granted",
            "License 2: Subscription with usage limits",
            "License 3: Perpetual license with restrictions"
        ]
        
        batch_results = await rights_analyzer.batch_analyze_rights(
            license_texts=license_texts,
            tenant_id="tenant-123"
        )
        
        assert len(batch_results) == len(license_texts)
        assert all(isinstance(result, RightsAnalysisResult) for result in batch_results)

    # Test Integration Features

    @pytest.mark.asyncio
    async def test_export_rights_analysis(self, rights_analyzer):
        """Test exporting rights analysis"""
        export_result = await rights_analyzer.export_rights_analysis(
            license_id="lic-123",
            format="json",
            tenant_id="tenant-123"
        )
        
        assert "export_path" in export_result
        assert "export_size" in export_result
        assert export_result["status"] == "success"

    @pytest.mark.asyncio
    async def test_import_rights_data(self, rights_analyzer):
        """Test importing rights data"""
        import_result = await rights_analyzer.import_rights_data(
            data_file="/imports/rights_data.json",
            tenant_id="tenant-123"
        )
        
        assert "imported_rights" in import_result
        assert "import_status" in import_result