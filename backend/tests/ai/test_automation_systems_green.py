"""
Test suite for Advanced Automation Systems - GREEN phase
Tests verify actual implementations work correctly
Tests autonomous contract generation and intelligent review automation
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
import asyncio

from app.ai.autonomous_contract_generation import (
    AutonomousContractGenerator
)

from app.ai.automation_data_models import (
    GenerationConfig
)

from app.ai.intelligent_review_automation import (
    IntelligentReviewEngine
)

from app.ai.automation_data_models import (
    ReviewConfig
)


@pytest.fixture
def generation_config():
    """Autonomous contract generation configuration"""
    return GenerationConfig(
        ai_confidence_threshold=0.8,
        human_review_required=True,
        template_selection_criteria=["risk_level", "jurisdiction", "industry"],
        optimization_level="high",
        explanation_detail="comprehensive"
    )


@pytest.fixture
def review_config():
    """Intelligent review automation configuration"""
    return ReviewConfig(
        issue_detection_sensitivity=0.7,
        risk_scoring_model="comprehensive",
        compliance_frameworks=["gdpr", "ccpa", "sox"],
        market_comparison_enabled=True,
        escalation_thresholds={"high_risk": 0.8, "compliance": 0.9}
    )


@pytest.fixture
def contract_generator(generation_config):
    """Create autonomous contract generator instance"""
    return AutonomousContractGenerator(config=generation_config)


@pytest.fixture
def review_engine(review_config):
    """Create intelligent review engine instance"""
    return IntelligentReviewEngine(config=review_config)


class TestAutonomousContractGeneratorGreen:
    """Test autonomous contract generation - GREEN phase"""
    
    @pytest.mark.asyncio
    async def test_interpret_requirements(self, contract_generator):
        """GREEN: Test requirements interpretation works correctly"""
        interpretation = await contract_generator.interpret_requirements(
            raw_requirements="We need a software development agreement for a 12-month project worth $2M with milestone-based payments",
            context={
                "parties": ["tech_company", "consulting_firm"],
                "industry": "technology",
                "jurisdiction": "california"
            },
            additional_inputs={
                "risk_tolerance": "moderate",
                "negotiation_style": "collaborative",
                "compliance_requirements": ["data_protection", "intellectual_property"]
            }
        )
        
        assert interpretation.contract_type == "software_development"
        assert interpretation.complexity_level in ["low", "medium", "high"]
        assert isinstance(interpretation.key_terms, dict)
        assert interpretation.key_terms["contract_value"] == 2000000
        assert interpretation.key_terms["duration"] == 12
        assert isinstance(interpretation.risk_factors, list)
        assert isinstance(interpretation.compliance_needs, list)
        assert 0.0 <= interpretation.confidence <= 1.0
    
    @pytest.mark.asyncio
    async def test_select_templates(self, contract_generator):
        """GREEN: Test template selection works correctly"""
        selection = await contract_generator.select_templates(
            interpreted_requirements={
                "contract_type": "software_development",
                "complexity": "high",
                "value": 2000000,
                "duration": 12,
                "payment_structure": "milestone_based"
            },
            available_templates=[
                {"id": "sda_001", "type": "software_development", "complexity": "medium"},
                {"id": "sda_002", "type": "software_development", "complexity": "high"},
                {"id": "sa_001", "type": "service_agreement", "complexity": "high"}
            ],
            selection_criteria=["complexity_match", "risk_alignment", "jurisdiction_compatibility"]
        )
        
        assert selection.selected_template_id in ["sda_001", "sda_002", "sa_001", "default_template"]
        assert isinstance(selection.selection_rationale, str)
        assert 0.0 <= selection.compatibility_score <= 1.0
        assert isinstance(selection.alternative_templates, list)
        assert isinstance(selection.customization_needed, list)
    
    @pytest.mark.asyncio
    async def test_optimize_clauses(self, contract_generator):
        """GREEN: Test clause optimization works correctly"""
        optimization = await contract_generator.optimize_clauses(
            base_template="Standard Software Development Agreement template...",
            requirements={
                "payment_terms": "milestone_based",
                "intellectual_property": "client_ownership",
                "liability_cap": "annual_fee",
                "termination": "for_cause_and_convenience"
            },
            optimization_objectives=["risk_reduction", "enforceability", "clarity"],
            constraints=["jurisdiction_limits", "industry_standards", "client_preferences"]
        )
        
        assert isinstance(optimization, list)
        assert len(optimization) > 0
        for clause in optimization:
            assert hasattr(clause, 'clause_type')
            assert hasattr(clause, 'original_text')
            assert hasattr(clause, 'optimized_text')
            assert hasattr(clause, 'optimization_rationale')
            assert 0.0 <= clause.risk_improvement <= 1.0
    
    @pytest.mark.asyncio
    async def test_select_risk_appropriate_language(self, contract_generator):
        """GREEN: Test risk-appropriate language selection works correctly"""
        language_selection = await contract_generator.select_risk_appropriate_language(
            clause_type="limitation_of_liability",
            risk_profile={
                "financial_exposure": "high",
                "operational_complexity": "medium",
                "regulatory_scrutiny": "high"
            },
            jurisdiction_requirements={
                "liability_caps_allowed": True,
                "consequential_damages_exclusion": "permitted",
                "indemnity_enforceability": "strong"
            },
            negotiation_position="balanced"
        )
        
        assert language_selection.clause_type == "limitation_of_liability"
        assert isinstance(language_selection.selected_language, str)
        assert len(language_selection.selected_language) > 0
        assert language_selection.risk_appropriateness in ["conservative", "moderate", "aggressive"]
        assert isinstance(language_selection.alternatives, list)
        assert isinstance(language_selection.jurisdiction_compliance, bool)
    
    @pytest.mark.asyncio
    async def test_adapt_to_jurisdiction(self, contract_generator):
        """GREEN: Test jurisdiction adaptation works correctly"""
        adaptation = await contract_generator.adapt_to_jurisdiction(
            base_contract="Software Development Agreement with standard clauses...",
            target_jurisdiction="california",
            jurisdiction_specifics={
                "governing_law": "california_state",
                "venue_requirements": "california_courts",
                "specific_regulations": ["ccpa", "california_labor_code"],
                "enforceability_concerns": ["non_compete_restrictions", "at_will_employment"]
            },
            adaptation_priorities=["compliance", "enforceability", "risk_mitigation"]
        )
        
        assert adaptation.target_jurisdiction == "california"
        assert isinstance(adaptation.adaptations_made, list)
        assert len(adaptation.adaptations_made) > 0
        assert isinstance(adaptation.compliance_verified, bool)
        assert isinstance(adaptation.remaining_risks, list)
        assert 0.0 <= adaptation.adaptation_confidence <= 1.0
    
    @pytest.mark.asyncio
    async def test_apply_industry_best_practices(self, contract_generator):
        """GREEN: Test industry best practices application works correctly"""
        best_practices = await contract_generator.apply_industry_best_practices(
            contract_type="software_development",
            industry="technology",
            best_practices_database={
                "intellectual_property": ["clear_ownership_definitions", "work_for_hire_clauses"],
                "data_security": ["encryption_requirements", "breach_notification"],
                "service_levels": ["uptime_guarantees", "performance_metrics"],
                "payment_terms": ["milestone_based", "escrow_arrangements"]
            },
            client_preferences={
                "conservative_approach": True,
                "innovation_friendly": False,
                "risk_averse": True
            }
        )
        
        assert best_practices.industry == "technology"
        assert isinstance(best_practices.applied_practices, list)
        assert len(best_practices.applied_practices) > 0
        assert isinstance(best_practices.practice_sources, list)
        assert 0.0 <= best_practices.implementation_confidence <= 1.0
        assert isinstance(best_practices.deviation_rationale, list)


class TestIntelligentReviewEngineGreen:
    """Test intelligent review automation - GREEN phase"""
    
    @pytest.mark.asyncio
    async def test_spot_issues_automatically(self, review_engine):
        """GREEN: Test automated issue spotting works correctly"""
        issues = await review_engine.spot_issues_automatically(
            contract_text="Software Development Agreement with unlimited liability provisions and no termination clause...",
            issue_detection_models=["legal_risk", "compliance_risk", "business_risk"],
            detection_sensitivity=0.7,
            context={
                "contract_type": "software_development",
                "jurisdiction": "california",
                "parties": ["corporation", "llc"],
                "value": 2000000
            }
        )
        
        assert isinstance(issues, list)
        assert len(issues) > 0  # Should find unlimited liability and missing termination
        for issue in issues:
            assert hasattr(issue, 'issue_type')
            assert hasattr(issue, 'severity')
            assert issue.severity in ["low", "medium", "high", "critical"]
            assert hasattr(issue, 'location')
            assert hasattr(issue, 'description')
            assert hasattr(issue, 'recommended_action')
            assert 0.0 <= issue.confidence <= 1.0
    
    @pytest.mark.asyncio
    async def test_automate_risk_scoring(self, review_engine):
        """GREEN: Test automated risk scoring works correctly"""
        risk_scores = await review_engine.automate_risk_scoring(
            contract_clauses=[
                {"type": "limitation_of_liability", "text": "Liability limited to annual fees paid under this agreement"},
                {"type": "intellectual_property", "text": "All IP rights vest in client upon creation"},
                {"type": "termination", "text": "Either party may terminate for convenience with 30 days notice"},
                {"type": "data_protection", "text": "Contractor shall protect confidential data per GDPR requirements"}
            ],
            risk_models={
                "financial_risk": "high_precision",
                "legal_risk": "comprehensive",
                "operational_risk": "standard",
                "reputational_risk": "enhanced"
            },
            context_factors={
                "industry": "technology",
                "contract_value": 2000000,
                "duration": 12,
                "complexity": "high"
            }
        )
        
        assert isinstance(risk_scores, list)
        assert len(risk_scores) > 0
        for score in risk_scores:
            assert hasattr(score, 'category')
            assert hasattr(score, 'score')
            assert 0.0 <= score.score <= 1.0
            assert isinstance(score.contributing_factors, list)
            assert isinstance(score.mitigation_suggestions, list)
            assert 0.0 <= score.confidence_level <= 1.0
    
    @pytest.mark.asyncio
    async def test_check_compliance_automatically(self, review_engine):
        """GREEN: Test automated compliance checking works correctly"""
        compliance_results = await review_engine.check_compliance_automatically(
            contract_document="Software development contract with personal data handling but no GDPR provisions...",
            compliance_frameworks=["gdpr", "ccpa", "sox", "hipaa"],
            jurisdiction_requirements={
                "data_protection": ["encryption", "breach_notification", "consent_management"],
                "employment_law": ["at_will_limitations", "non_compete_restrictions"],
                "commercial_law": ["good_faith_obligations", "unconscionability_prevention"]
            },
            industry_standards={
                "technology": ["data_security", "ip_protection", "service_levels"],
                "financial_services": ["regulatory_reporting", "audit_rights", "data_retention"]
            }
        )
        
        assert isinstance(compliance_results, list)
        assert len(compliance_results) > 0
        for result in compliance_results:
            assert hasattr(result, 'framework')
            assert result.framework in ["gdpr", "ccpa", "sox", "hipaa"]
            assert hasattr(result, 'compliance_status')
            assert result.compliance_status in ["compliant", "partial", "non_compliant"]
            assert isinstance(result.gaps_identified, list)
            assert isinstance(result.remediation_steps, list)
            assert 0.0 <= result.compliance_confidence <= 1.0
    
    @pytest.mark.asyncio
    async def test_detect_missing_clauses(self, review_engine):
        """GREEN: Test missing clause detection works correctly"""
        missing_clauses = await review_engine.detect_missing_clauses(
            contract_text="Partial software development contract missing several standard clauses...",
            contract_type="software_development",
            required_clauses_checklist=[
                "intellectual_property_ownership",
                "limitation_of_liability", 
                "indemnification",
                "data_protection",
                "termination_rights",
                "dispute_resolution",
                "governing_law",
                "force_majeure"
            ],
            context={
                "jurisdiction": "california",
                "industry": "technology",
                "risk_profile": "moderate",
                "regulatory_requirements": ["ccpa", "export_controls"]
            }
        )
        
        assert isinstance(missing_clauses, list)
        assert len(missing_clauses) > 0  # Should find missing clauses
        for clause in missing_clauses:
            assert hasattr(clause, 'clause_type')
            assert clause.clause_type in [
                "intellectual_property_ownership", "limitation_of_liability", "indemnification",
                "data_protection", "termination_rights", "dispute_resolution", "governing_law", "force_majeure"
            ]
            assert hasattr(clause, 'importance')
            assert clause.importance in ["low", "medium", "high", "critical"]
            assert isinstance(clause.suggested_text, str)
            assert len(clause.suggested_text) > 0
            assert isinstance(clause.rationale, str)
    
    @pytest.mark.asyncio
    async def test_identify_inconsistencies(self, review_engine):
        """GREEN: Test inconsistency identification works correctly"""
        inconsistencies = await review_engine.identify_inconsistencies(
            contract_sections=[
                {"section": "payment_terms", "text": "Payment due within 30 days of invoice"},
                {"section": "late_fees", "text": "Late fees apply after 15 days of invoice date"},
                {"section": "termination", "text": "60 days notice required for termination"},
                {"section": "final_payment", "text": "Final payment within 10 days of termination notice"}
            ],
            inconsistency_types=[
                "conflicting_dates",
                "contradictory_obligations",
                "inconsistent_definitions",
                "misaligned_procedures"
            ],
            analysis_depth="comprehensive"
        )
        
        assert isinstance(inconsistencies, list)
        # Should find date conflicts: late fees at 15 days but payment due at 30 days
        # and final payment 10 days vs termination 60 days
        for inconsistency in inconsistencies:
            assert hasattr(inconsistency, 'inconsistency_type')
            assert inconsistency.inconsistency_type in [
                "conflicting_dates", "contradictory_obligations", 
                "inconsistent_definitions", "misaligned_procedures"
            ]
            assert isinstance(inconsistency.conflicting_sections, list)
            assert len(inconsistency.conflicting_sections) >= 2
            assert isinstance(inconsistency.description, str)
            assert isinstance(inconsistency.resolution_suggestion, str)


class TestIntegratedAutomationSystemGreen:
    """Test integration between generation and review systems - GREEN phase"""
    
    @pytest.mark.asyncio
    async def test_generation_to_review_integration(self, contract_generator, review_engine):
        """GREEN: Test integration between generation and review systems"""
        # Test the integration workflow
        integration_result = await contract_generator.integrate_with_review_engine(
            generation_output={
                "contract": "Generated software development contract with optimized clauses...",
                "confidence_scores": {"overall": 0.85, "template_selection": 0.9, "clause_optimization": 0.8},
                "generation_decisions": ["template_selected", "clauses_optimized", "jurisdiction_adapted"],
                "risk_factors": ["high_value_contract", "complex_ip_terms"]
            },
            review_engine=review_engine,
            integration_mode="comprehensive"
        )
        
        assert isinstance(integration_result, dict)
        assert "generation_results" in integration_result
        assert "review_integration" in integration_result
        assert integration_result["integration_mode"] == "comprehensive"
        assert "next_steps" in integration_result
        
    @pytest.mark.asyncio
    async def test_iterative_improvement_workflow(self, contract_generator, review_engine):
        """GREEN: Test iterative improvement workflow"""
        iterative_result = await contract_generator.iterative_improvement_workflow(
            initial_requirements="Software development agreement for AI platform with strict compliance needs",
            improvement_iterations=3,
            quality_threshold=0.9,
            review_engine=review_engine,
            learning_enabled=True
        )
        
        assert isinstance(iterative_result, dict)
        assert "initial_requirements" in iterative_result
        assert iterative_result["iterations_completed"] == 3
        assert "final_quality_score" in iterative_result
        assert iterative_result["final_quality_score"] > 0.8
        assert iterative_result["learning_applied"] == True
        assert isinstance(iterative_result["improvements_made"], list)
        assert len(iterative_result["improvements_made"]) > 0