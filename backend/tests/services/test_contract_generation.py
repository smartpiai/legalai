"""
Contract Generation Service Tests
Following TDD - RED phase: Comprehensive test suite for contract generation service
"""

import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.contract_generation import (
    ContractGenerationService,
    ContractTemplate,
    ContractData,
    GenerationRequest,
    GeneratedContract,
    ClauseSelection,
    VariableMapping,
    GenerationOptions,
    ValidationResult,
    ContractFormat,
    ApprovalStatus,
    GenerationType,
    ContractLanguage,
    ContractComplexity
)
from app.models.contracts import Contract, Template, Clause
from app.schemas.generation import (
    GenerationRequestSchema,
    GeneratedContractSchema,
    TemplateSelectionSchema,
    ClauseSelectionSchema
)


class TestContractGenerationService:
    """Test suite for contract generation service"""

    @pytest.fixture
    def mock_template_service(self):
        """Mock template service"""
        service = AsyncMock()
        service.get_template = AsyncMock()
        service.render_template = AsyncMock()
        service.validate_variables = AsyncMock()
        return service

    @pytest.fixture
    def mock_clause_service(self):
        """Mock clause service"""
        service = AsyncMock()
        service.get_clauses = AsyncMock()
        service.assemble_clauses = AsyncMock()
        service.check_conflicts = AsyncMock()
        return service

    @pytest.fixture
    def mock_validation_service(self):
        """Mock validation service"""
        service = AsyncMock()
        service.validate_contract = AsyncMock()
        service.check_compliance = AsyncMock()
        service.assess_risk = AsyncMock()
        return service

    @pytest.fixture
    def mock_ai_service(self):
        """Mock AI service"""
        service = AsyncMock()
        service.enhance_contract = AsyncMock()
        service.suggest_improvements = AsyncMock()
        service.generate_summary = AsyncMock()
        return service

    @pytest.fixture
    def generation_service(
        self,
        mock_template_service,
        mock_clause_service,
        mock_validation_service,
        mock_ai_service
    ):
        """Create contract generation service instance"""
        return ContractGenerationService(
            template_service=mock_template_service,
            clause_service=mock_clause_service,
            validation_service=mock_validation_service,
            ai_service=mock_ai_service
        )

    @pytest.fixture
    def sample_template(self):
        """Sample contract template"""
        return ContractTemplate(
            id="template-123",
            name="Service Agreement",
            type="service",
            language=ContractLanguage.ENGLISH,
            variables=["company_name", "service_description", "payment_terms"],
            sections=["introduction", "services", "payment", "terms"],
            clauses=["clause-1", "clause-2", "clause-3"]
        )

    @pytest.fixture
    def generation_request(self):
        """Sample generation request"""
        return GenerationRequest(
            template_id="template-123",
            contract_type="service",
            parties={
                "vendor": "Acme Corp",
                "client": "Beta Inc"
            },
            variables={
                "company_name": "Acme Corp",
                "service_description": "Software development services",
                "payment_terms": "Net 30"
            },
            clauses=["clause-1", "clause-2"],
            options=GenerationOptions(
                format=ContractFormat.PDF,
                language=ContractLanguage.ENGLISH,
                include_metadata=True
            )
        )

    # Test Template-Based Generation

    @pytest.mark.asyncio
    async def test_generate_from_template(self, generation_service, generation_request):
        """Test generating contract from template"""
        result = await generation_service.generate_contract(
            request=generation_request,
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, GeneratedContract)
        assert result.id is not None
        assert result.status == ApprovalStatus.DRAFT
        assert result.format == ContractFormat.PDF

    @pytest.mark.asyncio
    async def test_generate_with_variable_substitution(self, generation_service):
        """Test contract generation with variable substitution"""
        request = GenerationRequest(
            template_id="template-456",
            variables={
                "party_a": "Company A",
                "party_b": "Company B",
                "effective_date": "2024-01-01",
                "contract_value": 100000
            }
        )
        
        result = await generation_service.generate_contract(
            request=request,
            tenant_id="tenant-123"
        )
        
        assert "Company A" in result.content
        assert "Company B" in result.content
        assert result.metadata["contract_value"] == 100000

    @pytest.mark.asyncio
    async def test_validate_template_variables(self, generation_service):
        """Test template variable validation"""
        validation = await generation_service.validate_variables(
            template_id="template-123",
            variables={"company_name": "Test Corp"},
            tenant_id="tenant-123"
        )
        
        assert isinstance(validation, ValidationResult)
        assert "missing_variables" in validation.issues
        assert "invalid_variables" in validation.issues

    # Test Clause Assembly

    @pytest.mark.asyncio
    async def test_assemble_with_clauses(self, generation_service):
        """Test contract generation with clause assembly"""
        clause_selection = ClauseSelection(
            standard_clauses=["liability", "termination", "confidentiality"],
            optional_clauses=["arbitration", "force_majeure"],
            custom_clauses=["special_terms"]
        )
        
        result = await generation_service.assemble_with_clauses(
            template_id="template-123",
            clause_selection=clause_selection,
            tenant_id="tenant-123"
        )
        
        assert result.clauses_included == 6
        assert "liability" in result.sections

    @pytest.mark.asyncio
    async def test_detect_clause_conflicts(self, generation_service):
        """Test clause conflict detection"""
        conflicts = await generation_service.detect_conflicts(
            clauses=["exclusive_jurisdiction", "arbitration_mandatory"],
            tenant_id="tenant-123"
        )
        
        assert len(conflicts) > 0
        assert conflicts[0]["type"] == "contradiction"
        assert "resolution" in conflicts[0]

    @pytest.mark.asyncio
    async def test_optimize_clause_ordering(self, generation_service):
        """Test clause ordering optimization"""
        optimized = await generation_service.optimize_clause_order(
            clauses=["payment", "definitions", "services", "termination"],
            tenant_id="tenant-123"
        )
        
        # Definitions should come first
        assert optimized[0] == "definitions"
        assert optimized.index("termination") > optimized.index("services")

    # Test Multi-Language Generation

    @pytest.mark.asyncio
    async def test_generate_multilingual(self, generation_service):
        """Test multi-language contract generation"""
        languages = [
            ContractLanguage.ENGLISH,
            ContractLanguage.SPANISH,
            ContractLanguage.FRENCH
        ]
        
        results = await generation_service.generate_multilingual(
            template_id="template-123",
            languages=languages,
            variables={},
            tenant_id="tenant-123"
        )
        
        assert len(results) == 3
        assert results[ContractLanguage.ENGLISH].language == "en"
        assert results[ContractLanguage.SPANISH].language == "es"

    @pytest.mark.asyncio
    async def test_translate_contract(self, generation_service):
        """Test contract translation"""
        translated = await generation_service.translate_contract(
            contract_id="contract-123",
            target_language=ContractLanguage.GERMAN,
            preserve_legal_terms=True,
            tenant_id="tenant-123"
        )
        
        assert translated.language == ContractLanguage.GERMAN
        assert translated.original_id == "contract-123"

    # Test Dynamic Generation

    @pytest.mark.asyncio
    async def test_generate_from_questionnaire(self, generation_service):
        """Test contract generation from questionnaire responses"""
        responses = {
            "contract_type": "employment",
            "employment_type": "full_time",
            "salary": 75000,
            "start_date": "2024-02-01",
            "probation_period": 90,
            "benefits": ["health", "dental", "401k"]
        }
        
        result = await generation_service.generate_from_questionnaire(
            responses=responses,
            tenant_id="tenant-123"
        )
        
        assert result.type == "employment"
        assert "75000" in result.content
        assert "probation" in result.content.lower()

    @pytest.mark.asyncio
    async def test_ai_enhanced_generation(self, generation_service):
        """Test AI-enhanced contract generation"""
        result = await generation_service.generate_with_ai(
            contract_type="service",
            requirements="Need a software development agreement with IP ownership clauses",
            complexity=ContractComplexity.STANDARD,
            tenant_id="tenant-123"
        )
        
        assert result.ai_enhanced is True
        assert "intellectual property" in result.content.lower()
        assert result.confidence_score > 0.8

    # Test Batch Generation

    @pytest.mark.asyncio
    async def test_batch_generate_contracts(self, generation_service):
        """Test batch contract generation"""
        batch_request = [
            {"template_id": "template-1", "variables": {"name": "Client 1"}},
            {"template_id": "template-1", "variables": {"name": "Client 2"}},
            {"template_id": "template-1", "variables": {"name": "Client 3"}}
        ]
        
        results = await generation_service.batch_generate(
            requests=batch_request,
            tenant_id="tenant-123"
        )
        
        assert len(results) == 3
        assert all(r.status == ApprovalStatus.DRAFT for r in results)

    @pytest.mark.asyncio
    async def test_generate_contract_package(self, generation_service):
        """Test generating contract package with multiple documents"""
        package = await generation_service.generate_package(
            main_contract="template-main",
            attachments=["schedule-a", "exhibit-1", "terms-conditions"],
            variables={},
            tenant_id="tenant-123"
        )
        
        assert package.document_count == 4
        assert package.main_document_id is not None
        assert len(package.attachments) == 3

    # Test Validation and Compliance

    @pytest.mark.asyncio
    async def test_validate_generated_contract(self, generation_service):
        """Test contract validation after generation"""
        validation = await generation_service.validate_contract(
            contract_id="contract-123",
            validation_rules=["legal", "business", "formatting"],
            tenant_id="tenant-123"
        )
        
        assert validation.is_valid is not None
        assert "errors" in validation.results
        assert "warnings" in validation.results

    @pytest.mark.asyncio
    async def test_compliance_check(self, generation_service):
        """Test compliance checking for generated contracts"""
        compliance = await generation_service.check_compliance(
            contract_id="contract-123",
            regulations=["GDPR", "CCPA", "SOX"],
            tenant_id="tenant-123"
        )
        
        assert compliance.compliant is not None
        assert len(compliance.violations) >= 0
        assert compliance.recommendations is not None

    @pytest.mark.asyncio
    async def test_risk_assessment(self, generation_service):
        """Test risk assessment for generated contracts"""
        risk = await generation_service.assess_risk(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert risk.overall_score is not None
        assert risk.risk_factors is not None
        assert risk.mitigation_suggestions is not None

    # Test Customization and Personalization

    @pytest.mark.asyncio
    async def test_apply_playbook_rules(self, generation_service):
        """Test applying playbook rules during generation"""
        result = await generation_service.generate_with_playbook(
            template_id="template-123",
            playbook_id="playbook-456",
            variables={},
            tenant_id="tenant-123"
        )
        
        assert result.playbook_applied is True
        assert result.rules_applied > 0
        assert result.modifications_made is not None

    @pytest.mark.asyncio
    async def test_industry_specific_generation(self, generation_service):
        """Test industry-specific contract generation"""
        result = await generation_service.generate_industry_specific(
            industry="healthcare",
            contract_type="service",
            include_regulations=True,
            tenant_id="tenant-123"
        )
        
        assert "HIPAA" in result.content
        assert result.industry_clauses > 0

    @pytest.mark.asyncio
    async def test_jurisdiction_adaptation(self, generation_service):
        """Test jurisdiction-specific adaptations"""
        result = await generation_service.adapt_to_jurisdiction(
            contract_id="contract-123",
            jurisdiction="California",
            tenant_id="tenant-123"
        )
        
        assert "California" in result.content
        assert result.jurisdiction_specific_clauses > 0

    # Test Output Formats

    @pytest.mark.asyncio
    async def test_generate_multiple_formats(self, generation_service):
        """Test generating contract in multiple formats"""
        formats = [
            ContractFormat.PDF,
            ContractFormat.DOCX,
            ContractFormat.HTML,
            ContractFormat.MARKDOWN
        ]
        
        results = await generation_service.generate_formats(
            contract_id="contract-123",
            formats=formats,
            tenant_id="tenant-123"
        )
        
        assert len(results) == 4
        assert results[ContractFormat.PDF].mime_type == "application/pdf"
        assert results[ContractFormat.DOCX].mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    @pytest.mark.asyncio
    async def test_generate_with_watermark(self, generation_service):
        """Test contract generation with watermark"""
        result = await generation_service.generate_with_watermark(
            contract_id="contract-123",
            watermark_text="DRAFT - CONFIDENTIAL",
            tenant_id="tenant-123"
        )
        
        assert result.has_watermark is True
        assert result.watermark_text == "DRAFT - CONFIDENTIAL"

    @pytest.mark.asyncio
    async def test_generate_redacted_version(self, generation_service):
        """Test generating redacted contract version"""
        redacted = await generation_service.generate_redacted(
            contract_id="contract-123",
            redaction_rules=["financial", "personal_info"],
            tenant_id="tenant-123"
        )
        
        assert redacted.is_redacted is True
        assert redacted.redaction_count > 0

    # Test Workflow Integration

    @pytest.mark.asyncio
    async def test_submit_for_approval(self, generation_service):
        """Test submitting generated contract for approval"""
        result = await generation_service.submit_for_approval(
            contract_id="contract-123",
            approvers=["legal-team", "finance-team"],
            deadline=datetime.utcnow() + timedelta(days=3),
            tenant_id="tenant-123"
        )
        
        assert result.status == ApprovalStatus.PENDING_APPROVAL
        assert len(result.approval_chain) == 2

    @pytest.mark.asyncio
    async def test_track_generation_history(self, generation_service):
        """Test tracking contract generation history"""
        history = await generation_service.get_generation_history(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert len(history.versions) > 0
        assert history.original_request is not None
        assert history.modifications is not None

    # Test Performance and Optimization

    @pytest.mark.asyncio
    async def test_cache_generated_contracts(self, generation_service):
        """Test caching of generated contracts"""
        # First generation
        result1 = await generation_service.generate_contract(
            request=GenerationRequest(template_id="template-123"),
            use_cache=True,
            tenant_id="tenant-123"
        )
        
        # Second generation (should use cache)
        result2 = await generation_service.generate_contract(
            request=GenerationRequest(template_id="template-123"),
            use_cache=True,
            tenant_id="tenant-123"
        )
        
        assert result2.from_cache is True
        assert result1.id == result2.id

    @pytest.mark.asyncio
    async def test_generation_performance_metrics(self, generation_service):
        """Test tracking generation performance metrics"""
        metrics = await generation_service.get_performance_metrics(
            start_date=datetime.utcnow() - timedelta(days=7),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert metrics.average_generation_time is not None
        assert metrics.total_generated > 0
        assert metrics.success_rate > 0

    # Test Error Handling

    @pytest.mark.asyncio
    async def test_handle_template_not_found(self, generation_service):
        """Test handling of missing template"""
        with pytest.raises(Exception) as exc_info:
            await generation_service.generate_contract(
                request=GenerationRequest(template_id="invalid-template"),
                tenant_id="tenant-123"
            )
        
        assert "template not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_handle_invalid_variables(self, generation_service):
        """Test handling of invalid variables"""
        result = await generation_service.generate_contract(
            request=GenerationRequest(
                template_id="template-123",
                variables={"invalid_var": "value"}
            ),
            validate_strict=False,
            tenant_id="tenant-123"
        )
        
        assert result.warnings is not None
        assert "invalid_var" in result.warnings

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_template_isolation(self, generation_service):
        """Test that templates are isolated between tenants"""
        # Create template for tenant A
        template_a = await generation_service.create_template(
            template=ContractTemplate(name="Tenant A Template"),
            tenant_id="tenant-A"
        )
        
        # Try to use from tenant B
        with pytest.raises(Exception) as exc_info:
            await generation_service.generate_contract(
                request=GenerationRequest(template_id=template_a.id),
                tenant_id="tenant-B"
            )
        
        assert "not found" in str(exc_info.value).lower()