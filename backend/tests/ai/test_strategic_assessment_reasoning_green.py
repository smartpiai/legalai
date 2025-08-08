"""
Test suite for Strategic Assessment Engine and Multi-Step Reasoning Pipeline
GREEN phase: Tests verify actual implementations work correctly
Tests business alignment, risk assessment, and complex reasoning chains
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
import asyncio

from app.ai.strategic_assessment_reasoning import (
    StrategicAssessmentEngine,
    MultiStepReasoningPipeline,
    BusinessGoal,
    RiskProfile,
    MarketPosition,
    ComplianceRequirement,
    FinancialModel,
    StrategicRecommendation,
    ReasoningChain,
    ReasoningStep,
    Evidence,
    Hypothesis,
    ConfidenceScore,
    ReasoningPath,
    ReasoningTree,
    CheckpointState,
    VisualizationData,
    AssessmentConfig,
    ReasoningConfig,
    AssessmentException,
    ReasoningException
)


@pytest.fixture
def assessment_config():
    """Assessment engine configuration"""
    return AssessmentConfig(
        min_alignment_score=0.7,
        risk_threshold=0.3,
        confidence_requirement=0.8,
        parallel_assessments=True,
        cache_results=True
    )


@pytest.fixture
def reasoning_config():
    """Reasoning pipeline configuration"""
    return ReasoningConfig(
        max_chain_length=10,
        min_evidence_weight=0.1,
        pruning_threshold=0.3,
        parallel_paths=True,
        checkpoint_frequency=5
    )


@pytest.fixture
def assessment_engine(assessment_config):
    """Create assessment engine instance"""
    return StrategicAssessmentEngine(config=assessment_config)


@pytest.fixture
def reasoning_pipeline(reasoning_config):
    """Create reasoning pipeline instance"""
    return MultiStepReasoningPipeline(config=reasoning_config)


class TestStrategicAssessmentEngine:
    """Test strategic assessment capabilities"""
    
    @pytest.mark.asyncio
    async def test_analyze_business_goal_alignment(self, assessment_engine):
        """GREEN: Test business goal alignment analysis"""
        alignment = await assessment_engine.analyze_business_goal_alignment(
            business_goals=[
                BusinessGoal(id="bg1", description="Reduce legal costs by 30%", priority="high"),
                BusinessGoal(id="bg2", description="Improve compliance", priority="medium")
            ],
            contract_terms={"payment": "net-30", "penalties": "2% late fee"},
            weights={"cost": 0.4, "compliance": 0.3, "efficiency": 0.3}
        )
        
        assert isinstance(alignment, float)
        assert 0.0 <= alignment <= 1.0
        assert alignment > 0.5  # Should be decent alignment
    
    @pytest.mark.asyncio
    async def test_evaluate_risk_tolerance(self, assessment_engine):
        """GREEN: Test risk tolerance evaluation"""
        risk_profile = await assessment_engine.evaluate_risk_tolerance(
            organization_profile={"industry": "technology", "size": "enterprise"},
            historical_data={"past_disputes": 2, "settlements": 1},
            risk_appetite="moderate"
        )
        
        assert isinstance(risk_profile, RiskProfile)
        assert 0.0 <= risk_profile.overall_risk <= 1.0
        assert risk_profile.confidence > 0.8
        assert len(risk_profile.mitigation_strategies) > 0
    
    @pytest.mark.asyncio
    async def test_assess_market_position(self, assessment_engine):
        """GREEN: Test market position assessment"""
        position = await assessment_engine.assess_market_position(
            company_metrics={"market_share": 0.15, "growth_rate": 0.2},
            competitor_analysis={"main_competitors": 5, "relative_strength": 0.7},
            industry_trends=["consolidation", "digital_transformation"]
        )
        
        assert isinstance(position, MarketPosition)
        assert position.market_share == 0.15
        assert position.growth_potential == 0.2
        assert len(position.opportunities) > 0
    
    @pytest.mark.asyncio
    async def test_identify_competitive_advantage(self, assessment_engine):
        """GREEN: Test competitive advantage identification"""
        advantages = await assessment_engine.identify_competitive_advantage(
            strengths=["innovation", "customer_base", "brand"],
            weaknesses=["cost_structure", "supply_chain"],
            opportunities=["new_markets", "partnerships"],
            threats=["regulation", "competition"]
        )
        
        assert isinstance(advantages, dict)
        assert "advantages" in advantages
        assert "strategies" in advantages
        assert len(advantages["advantages"]) > 0
    
    @pytest.mark.asyncio
    async def test_check_regulatory_compliance(self, assessment_engine):
        """GREEN: Test regulatory compliance checking"""
        compliance = await assessment_engine.check_regulatory_compliance(
            contract_type="service_agreement",
            jurisdictions=["California", "New York"],
            regulations=["CCPA", "GDPR", "SOX"],
            contract_clauses={"data_protection": True, "audit_rights": True}
        )
        
        assert isinstance(compliance, dict)
        assert "overall_compliance" in compliance
        assert "details" in compliance
        assert len(compliance["details"]) == 3
    
    @pytest.mark.asyncio
    async def test_model_financial_impact(self, assessment_engine):
        """GREEN: Test financial impact modeling"""
        impact = await assessment_engine.model_financial_impact(
            contract_value=1000000,
            payment_terms={"schedule": "quarterly", "discount": 0.02},
            risk_factors={"default_probability": 0.05, "dispute_likelihood": 0.1},
            time_horizon_months=24
        )
        
        assert isinstance(impact, FinancialModel)
        assert impact.expected_value > 0
        assert impact.worst_case < impact.expected_value < impact.best_case
        assert impact.break_even_months > 0
    
    @pytest.mark.asyncio
    async def test_analyze_timeline_feasibility(self, assessment_engine):
        """GREEN: Test timeline feasibility analysis"""
        feasibility = await assessment_engine.analyze_timeline_feasibility(
            project_milestones=["kickoff", "phase1", "phase2", "delivery"],
            resource_availability={"team_members": 5, "hours_per_week": 40},
            deadline=datetime.now() + timedelta(days=90),
            dependencies=["vendor_selection", "regulatory_approval"]
        )
        
        assert isinstance(feasibility, dict)
        assert "is_feasible" in feasibility
        assert "days_per_milestone" in feasibility
        assert feasibility["days_per_milestone"] > 0
    
    @pytest.mark.asyncio
    async def test_estimate_resource_requirements(self, assessment_engine):
        """GREEN: Test resource requirement estimation"""
        requirements = await assessment_engine.estimate_resource_requirements(
            project_scope={"complexity": "high", "duration_months": 6},
            skill_requirements=["legal", "technical", "financial"],
            utilization_target=0.8
        )
        
        assert isinstance(requirements, dict)
        assert "total_fte_required" in requirements
        assert "estimated_cost" in requirements
        assert requirements["total_fte_required"] > 0
    
    @pytest.mark.asyncio
    async def test_calculate_success_probability(self, assessment_engine):
        """GREEN: Test success probability calculation"""
        probability = await assessment_engine.calculate_success_probability(
            positive_factors=["strong_team", "clear_requirements", "executive_support"],
            risk_factors=["tight_timeline", "budget_constraints"],
            historical_success_rate=0.75
        )
        
        assert isinstance(probability, float)
        assert 0.0 <= probability <= 1.0
    
    @pytest.mark.asyncio
    async def test_generate_strategic_recommendation(self, assessment_engine):
        """GREEN: Test strategic recommendation generation"""
        recommendation = await assessment_engine.generate_strategic_recommendation(
            assessment_results={
                "alignment_score": 0.8,
                "risk_level": 0.3,
                "financial_impact": 500000,
                "success_probability": 0.7
            },
            alternatives=["negotiate", "accept", "reject"],
            decision_criteria=["maximize_value", "minimize_risk"]
        )
        
        assert isinstance(recommendation, StrategicRecommendation)
        assert recommendation.recommendation in ["negotiate", "accept", "reject"]
        assert 0.0 <= recommendation.confidence <= 1.0


class TestMultiStepReasoningPipeline:
    """Test multi-step reasoning capabilities"""
    
    @pytest.mark.asyncio
    async def test_construct_reasoning_chain(self, reasoning_pipeline):
        """GREEN: Test reasoning chain construction"""
        chain = await reasoning_pipeline.construct_reasoning_chain(
            initial_premise="Contract contains unfavorable terms",
            goal="Determine negotiation strategy",
            available_steps=["analyze", "compare", "evaluate", "conclude"],
            max_depth=5
        )
        
        assert isinstance(chain, ReasoningChain)
        assert len(chain.steps) <= 5
        assert len(chain.steps) > 0
        assert chain.confidence > 0.0
    
    @pytest.mark.asyncio
    async def test_manage_step_dependencies(self, reasoning_pipeline):
        """GREEN: Test step dependency management"""
        dependencies = await reasoning_pipeline.manage_step_dependencies(
            steps=[
                ReasoningStep(id="s1", action="analyze_terms"),
                ReasoningStep(id="s2", action="identify_risks", depends_on=["s1"]),
                ReasoningStep(id="s3", action="evaluate_alternatives", depends_on=["s1", "s2"])
            ],
            execution_order="topological"
        )
        
        assert isinstance(dependencies, list)
        assert len(dependencies) == 3
        assert dependencies.index("s1") < dependencies.index("s2")
        assert dependencies.index("s2") < dependencies.index("s3")
    
    @pytest.mark.asyncio
    async def test_execute_parallel_paths(self, reasoning_pipeline):
        """GREEN: Test parallel path execution"""
        results = await reasoning_pipeline.execute_parallel_paths(
            paths=[
                ReasoningPath(id="p1", steps=["legal_analysis", "risk_assessment"]),
                ReasoningPath(id="p2", steps=["financial_analysis", "market_research"]),
                ReasoningPath(id="p3", steps=["technical_review", "compliance_check"])
            ],
            merge_strategy="weighted_consensus"
        )
        
        assert isinstance(results, dict)
        assert "p1" in results
        assert "p2" in results
        assert "p3" in results
        assert "consensus" in results
        assert isinstance(results["consensus"], float)
    
    @pytest.mark.asyncio
    async def test_accumulate_evidence(self, reasoning_pipeline):
        """GREEN: Test evidence accumulation"""
        accumulated = await reasoning_pipeline.accumulate_evidence(
            evidence_sources=[
                Evidence(id="e1", type="precedent", weight=0.8, supports="favorable"),
                Evidence(id="e2", type="market_data", weight=0.6, supports="favorable"),
                Evidence(id="e3", type="risk_analysis", weight=0.7, supports="unfavorable")
            ],
            aggregation_method="bayesian"
        )
        
        assert isinstance(accumulated, dict)
        assert "posterior_probability" in accumulated
        assert "evidence_count" in accumulated
        assert accumulated["evidence_count"] == 3
    
    @pytest.mark.asyncio
    async def test_test_hypothesis(self, reasoning_pipeline):
        """GREEN: Test hypothesis testing"""
        result = await reasoning_pipeline.test_hypothesis(
            hypothesis=Hypothesis(
                id="h1",
                statement="Accepting terms will increase profitability",
                prior_probability=0.6
            ),
            evidence=[
                {"type": "financial_projection", "supports": True, "strength": 0.7},
                {"type": "market_analysis", "supports": False, "strength": 0.4}
            ],
            confidence_threshold=0.75
        )
        
        assert isinstance(result, dict)
        assert "hypothesis_id" in result
        assert "accepted" in result
        assert "posterior_probability" in result
    
    @pytest.mark.asyncio
    async def test_propagate_confidence(self, reasoning_pipeline):
        """GREEN: Test confidence propagation"""
        propagated = await reasoning_pipeline.propagate_confidence(
            reasoning_chain=[
                {"step": "analyze", "confidence": 0.9},
                {"step": "evaluate", "confidence": 0.8},
                {"step": "conclude", "confidence": None}
            ],
            propagation_method="multiplicative",
            decay_factor=0.95
        )
        
        assert isinstance(propagated, list)
        assert len(propagated) == 3
        assert all("confidence" in step for step in propagated)
        assert propagated[2]["confidence"] is not None
    
    @pytest.mark.asyncio
    async def test_prune_reasoning_tree(self, reasoning_pipeline):
        """GREEN: Test reasoning tree pruning"""
        pruned = await reasoning_pipeline.prune_reasoning_tree(
            tree=ReasoningTree(
                root="initial_state",
                branches=[
                    {"path": "branch1", "confidence": 0.2, "depth": 3},
                    {"path": "branch2", "confidence": 0.8, "depth": 2},
                    {"path": "branch3", "confidence": 0.5, "depth": 4}
                ],
                depth=4
            ),
            min_confidence=0.3,
            max_depth=3
        )
        
        assert isinstance(pruned, ReasoningTree)
        assert len(pruned.branches) == 1  # Only branch2 should remain (conf >= 0.3 and depth <= 3)
        assert pruned.pruned_count == 2  # branch1 (low conf) and branch3 (too deep) pruned
    
    @pytest.mark.asyncio
    async def test_track_explanation_path(self, reasoning_pipeline):
        """GREEN: Test explanation path tracking"""
        explanation = await reasoning_pipeline.track_explanation_path(
            from_premise="Contract terms unclear",
            to_conclusion="Request clarification",
            include_evidence=True,
            include_confidence=True
        )
        
        assert isinstance(explanation, dict)
        assert "premise" in explanation
        assert "conclusion" in explanation
        assert "evidence" in explanation
        assert "confidence_scores" in explanation
    
    @pytest.mark.asyncio
    async def test_prepare_reasoning_visualization(self, reasoning_pipeline):
        """GREEN: Test reasoning visualization preparation"""
        viz_data = await reasoning_pipeline.prepare_reasoning_visualization(
            reasoning_chain=ReasoningChain(
                steps=[
                    ReasoningStep(id="s1", action="analyze"),
                    ReasoningStep(id="s2", action="evaluate")
                ],
                evidence=[],
                conclusion="result"
            ),
            format="graph",
            include_metrics=True,
            highlight_critical_path=True
        )
        
        assert isinstance(viz_data, VisualizationData)
        assert len(viz_data.nodes) == 2
        assert len(viz_data.edges) == 1
        assert len(viz_data.critical_path) > 0
    
    @pytest.mark.asyncio
    async def test_checkpoint_reasoning_state(self, reasoning_pipeline):
        """GREEN: Test reasoning state checkpointing"""
        checkpoint = await reasoning_pipeline.checkpoint_reasoning_state(
            current_chain=["step1", "step2", "step3"],
            current_evidence={"e1": 0.8, "e2": 0.6},
            current_confidence=0.75,
            checkpoint_id="checkpoint_001"
        )
        
        assert isinstance(checkpoint, CheckpointState)
        assert checkpoint.checkpoint_id == "checkpoint_001"
        assert len(checkpoint.chain_state) == 3
        assert checkpoint.confidence == 0.75
    
    @pytest.mark.asyncio
    async def test_resume_from_checkpoint(self, reasoning_pipeline):
        """GREEN: Test resume from checkpoint"""
        # First create checkpoint
        await reasoning_pipeline.checkpoint_reasoning_state(
            current_chain=["step1", "step2"],
            current_evidence={"e1": 0.8},
            current_confidence=0.75,
            checkpoint_id="checkpoint_001"
        )
        
        resumed = await reasoning_pipeline.resume_from_checkpoint(
            checkpoint_id="checkpoint_001",
            additional_context={"new_evidence": "discovered"},
            continue_from="last_completed_step"
        )
        
        assert isinstance(resumed, dict)
        assert "resumed_from" in resumed
        assert "chain_state" in resumed
        assert resumed["resumed_from"] == "checkpoint_001"


class TestIntegratedAssessmentReasoning:
    """Test integration between assessment and reasoning"""
    
    @pytest.mark.asyncio
    async def test_assess_then_reason(self, assessment_engine, reasoning_pipeline):
        """GREEN: Test integrated assessment then reasoning"""
        result = await assessment_engine.assess_then_reason(
            initial_assessment={"risk": "high", "value": "medium"},
            reasoning_pipeline=reasoning_pipeline,
            decision_goal="optimal_strategy"
        )
        
        assert isinstance(result, dict)
        assert "assessment" in result
        assert "reasoning_result" in result
        assert "integrated_decision" in result
    
    @pytest.mark.asyncio
    async def test_reason_with_assessment_feedback(self, reasoning_pipeline, assessment_engine):
        """GREEN: Test reasoning with assessment feedback"""
        result = await reasoning_pipeline.reason_with_feedback(
            reasoning_chain=["analyze", "evaluate"],
            assessment_engine=assessment_engine,
            feedback_points=["after_analysis", "before_conclusion"]
        )
        
        assert isinstance(result, dict)
        assert "chain" in result
        assert "feedback_received" in result
        assert len(result["feedback_received"]) == 2
    
    @pytest.mark.asyncio
    async def test_parallel_assessment_reasoning(self, assessment_engine, reasoning_pipeline):
        """GREEN: Test parallel assessment and reasoning execution"""
        results = await assessment_engine.parallel_assessment_reasoning(
            assessment_tasks=["risk", "compliance", "financial"],
            reasoning_tasks=["legal", "strategic", "tactical"],
            synchronization_points=["midpoint", "conclusion"]
        )
        
        assert isinstance(results, dict)
        assert "assessments" in results
        assert "reasoning" in results
        assert len(results["assessments"]) == 3
        assert len(results["reasoning"]) == 3
    
    @pytest.mark.asyncio
    async def test_unified_decision_framework(self, assessment_engine, reasoning_pipeline):
        """GREEN: Test unified decision framework"""
        decision = await assessment_engine.unified_decision_framework(
            assessment_inputs={"market": "favorable", "risk": "moderate"},
            reasoning_inputs={"legal": "compliant", "strategic": "aligned"},
            decision_weights={"assessment": 0.4, "reasoning": 0.6},
            confidence_threshold=0.8
        )
        
        assert isinstance(decision, dict)
        assert "decision" in decision
        assert "confidence" in decision
        assert decision["decision"] in ["approve", "review"]