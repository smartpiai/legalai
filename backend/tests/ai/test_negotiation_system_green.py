"""
Test suite for Negotiation Strategy Engine and Real-time Negotiation Assistant
GREEN phase: Tests verify actual implementations work correctly
Tests negotiation strategies, BATNA analysis, and real-time assistance
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
import asyncio

from app.ai.negotiation_system import (
    NegotiationStrategyEngine,
    RealtimeNegotiationAssistant,
    NegotiationConfig,
    AssistantConfig
)


@pytest.fixture
def negotiation_config():
    """Negotiation engine configuration"""
    return NegotiationConfig(
        max_concessions=5,
        min_acceptable_value=0.6,
        confidence_threshold=0.8,
        cultural_weight=0.2,
        game_theory_enabled=True
    )


@pytest.fixture
def assistant_config():
    """Assistant configuration"""
    return AssistantConfig(
        suggestion_frequency=30,
        risk_alert_threshold=0.7,
        emotional_analysis_enabled=True,
        trust_tracking=True,
        script_generation=True
    )


@pytest.fixture
def strategy_engine(negotiation_config):
    """Create negotiation strategy engine instance"""
    return NegotiationStrategyEngine(config=negotiation_config)


@pytest.fixture
def negotiation_assistant(assistant_config):
    """Create real-time negotiation assistant instance"""
    return RealtimeNegotiationAssistant(config=assistant_config)


class TestNegotiationStrategyEngine:
    """Test negotiation strategy capabilities"""
    
    @pytest.mark.asyncio
    async def test_calculate_opening_position(self, strategy_engine):
        """GREEN: Test opening position calculation"""
        position = await strategy_engine.calculate_opening_position(
            target_value=1000000,
            minimum_acceptable=600000,
            market_conditions={"favorable": True, "competition": "moderate"},
            counterpart_profile={"experience": "high", "style": "competitive"},
            historical_data={"similar_deals": 15, "avg_discount": 0.12}
        )
        
        assert position.initial_offer > position.aspiration_level
        assert position.aspiration_level > position.reservation_point
        assert 0.0 <= position.confidence <= 1.0
        assert len(position.justification) > 0
    
    @pytest.mark.asyncio
    async def test_determine_batna(self, strategy_engine):
        """GREEN: Test BATNA determination"""
        batna = await strategy_engine.determine_batna(
            alternatives=[
                {"option": "vendor_a", "value": 800000, "probability": 0.8},
                {"option": "vendor_b", "value": 750000, "probability": 0.9},
                {"option": "in_house", "value": 900000, "probability": 0.7}
            ],
            current_deal_terms={"value": 1000000, "timeline": 90},
            risk_factors={"market_volatility": 0.3, "technology_risk": 0.2}
        )
        
        assert batna.best_alternative in ["vendor_a", "vendor_b", "in_house"]
        assert batna.alternative_value > 0
        assert 0.0 <= batna.probability_of_success <= 1.0
        assert len(batna.alternatives_ranked) == 3
    
    @pytest.mark.asyncio
    async def test_plan_concessions(self, strategy_engine):
        """GREEN: Test concession planning"""
        plan = await strategy_engine.plan_concessions(
            issues=["price", "timeline", "scope", "warranty"],
            priorities={"price": 0.4, "timeline": 0.3, "scope": 0.2, "warranty": 0.1},
            concession_limits={"price": 0.15, "timeline": 30, "scope": 0.1},
            negotiation_rounds=5
        )
        
        assert len(plan.issues) == 4
        assert plan.maximum_rounds == 5
        assert len(plan.concession_sequence) > 0
        assert len(plan.contingency_plans) > 0
    
    @pytest.mark.asyncio
    async def test_analyze_tradeoffs(self, strategy_engine):
        """GREEN: Test trade-off analysis"""
        analysis = await strategy_engine.analyze_tradeoffs(
            issue_combinations=[
                {"give": "price_reduction", "get": "faster_delivery"},
                {"give": "extended_warranty", "get": "bulk_discount"},
                {"give": "flexible_terms", "get": "preferred_status"}
            ],
            value_weights={"cost": 0.5, "time": 0.3, "quality": 0.2},
            counterpart_preferences={"speed": "high", "cost": "medium"}
        )
        
        assert isinstance(analysis.viable_trades, list)
        assert len(analysis.recommendations) > 0
        assert isinstance(analysis.value_impact, dict)
    
    @pytest.mark.asyncio
    async def test_handle_multi_issue_negotiation(self, strategy_engine):
        """GREEN: Test multi-issue negotiation handling"""
        strategy = await strategy_engine.handle_multi_issue_negotiation(
            issues=[
                {"name": "price", "range": [800000, 1200000], "weight": 0.4},
                {"name": "delivery", "range": [30, 120], "weight": 0.3},
                {"name": "support", "range": [6, 24], "weight": 0.3}
            ],
            dependencies={"price-delivery": "inverse", "support-price": "positive"},
            negotiation_style="integrative"
        )
        
        assert len(strategy.issue_priorities) == 3
        assert strategy.sequencing_strategy in ["simultaneous_discussion", "sequential_by_priority"]
        assert 0.0 <= strategy.integrative_potential <= 1.0
    
    @pytest.mark.asyncio
    async def test_form_coalitions(self, strategy_engine):
        """GREEN: Test coalition formation"""
        coalitions = await strategy_engine.form_coalitions(
            stakeholders=[
                {"name": "legal", "influence": 0.8, "interests": ["compliance", "risk"]},
                {"name": "finance", "influence": 0.7, "interests": ["cost", "roi"]},
                {"name": "operations", "influence": 0.6, "interests": ["timeline", "quality"]}
            ],
            negotiation_issues=["price", "timeline", "compliance", "quality"],
            coalition_strategies=["blocking", "supporting", "neutral"]
        )
        
        assert isinstance(coalitions.potential_coalitions, list)
        assert isinstance(coalitions.coalition_values, dict)
        assert len(coalitions.recommended_approach) > 0
    
    @pytest.mark.asyncio
    async def test_optimize_timing(self, strategy_engine):
        """GREEN: Test timing optimization"""
        timing = await strategy_engine.optimize_timing(
            negotiation_phases=["preparation", "opening", "bargaining", "closing"],
            market_conditions={"urgency": "medium", "seasonality": "favorable"},
            counterpart_schedule={"availability": "limited", "deadlines": [datetime.now() + timedelta(days=30)]},
            internal_constraints={"budget_cycle": "Q4", "decision_makers": "available"}
        )
        
        assert len(timing.optimal_schedule) == 4
        assert isinstance(timing.urgency_factors, dict)
        assert timing.pacing_strategy in ["Accelerated", "Standard"]
    
    @pytest.mark.asyncio
    async def test_consider_cultural_factors(self, strategy_engine):
        """GREEN: Test cultural factors consideration"""
        factors = await strategy_engine.consider_cultural_factors(
            counterpart_culture="japanese",
            negotiation_location="tokyo",
            communication_style="high_context",
            business_practices={"relationship_first": True, "consensus_building": True},
            cultural_sensitivities=["face_saving", "hierarchy_respect"]
        )
        
        assert 0.0 <= factors.relationship_importance <= 1.0
        assert 0.0 <= factors.hierarchy_sensitivity <= 1.0
        assert len(factors.adaptation_recommendations) > 0
    
    @pytest.mark.asyncio
    async def test_build_psychological_profile(self, strategy_engine):
        """GREEN: Test psychological profiling"""
        profile = await strategy_engine.build_psychological_profile(
            behavioral_indicators=["aggressive", "detail_oriented", "relationship_focused"],
            communication_patterns={"direct": 0.7, "emotional": 0.3},
            decision_making_style="analytical",
            risk_tolerance="moderate",
            past_negotiations=[{"outcome": "win", "style": "competitive"}]
        )
        
        assert isinstance(profile.personality_traits, dict)
        assert profile.negotiation_style in ["competitive", "collaborative", "accommodating"]
        assert isinstance(profile.emotional_triggers, list)
    
    @pytest.mark.asyncio
    async def test_apply_game_theory(self, strategy_engine):
        """GREEN: Test game theory application"""
        strategy = await strategy_engine.apply_game_theory(
            game_type="cooperative",
            players=["our_company", "counterpart", "competitor"],
            payoff_matrix={
                ("cooperate", "cooperate"): (100, 100),
                ("cooperate", "defect"): (50, 150),
                ("defect", "cooperate"): (150, 50),
                ("defect", "defect"): (75, 75)
            },
            equilibrium_strategy="nash"
        )
        
        assert strategy.game_type == "cooperative"
        assert strategy.equilibrium_strategy == "nash"
        assert len(strategy.strategic_recommendations) > 0


class TestRealtimeNegotiationAssistant:
    """Test real-time negotiation assistance"""
    
    @pytest.mark.asyncio
    async def test_generate_live_suggestions(self, negotiation_assistant):
        """GREEN: Test live suggestion generation"""
        suggestions = await negotiation_assistant.generate_live_suggestions(
            current_context={
                "phase": "bargaining",
                "last_offer": {"price": 950000, "timeline": 60},
                "counterpart_mood": "frustrated",
                "time_elapsed": 45
            },
            negotiation_history=[
                {"offer": 1000000, "response": "too_high"},
                {"offer": 980000, "response": "still_high"}
            ],
            strategic_goals=["minimize_cost", "maintain_relationship"]
        )
        
        assert isinstance(suggestions, list)
        for suggestion in suggestions:
            assert hasattr(suggestion, 'suggestion')
            assert hasattr(suggestion, 'urgency')
            assert hasattr(suggestion, 'confidence')
    
    @pytest.mark.asyncio
    async def test_analyze_counter_offer(self, negotiation_assistant):
        """GREEN: Test counter-offer analysis"""
        analysis = await negotiation_assistant.analyze_counter_offer(
            counter_offer={
                "price": 850000,
                "timeline": 90,
                "payment_terms": "net-60",
                "warranty": "12_months"
            },
            original_offer={
                "price": 950000,
                "timeline": 60,
                "payment_terms": "net-30",
                "warranty": "24_months"
            },
            market_benchmarks={"typical_price": 900000, "standard_warranty": 18}
        )
        
        assert analysis.acceptance_recommendation in ["accept", "reject", "counter"]
        assert isinstance(analysis.offer_evaluation, dict)
        assert isinstance(analysis.counter_proposal, dict)
    
    @pytest.mark.asyncio
    async def test_assess_clause_risk(self, negotiation_assistant):
        """GREEN: Test clause risk assessment"""
        risk = await negotiation_assistant.assess_clause_risk(
            clause_text="Liability shall be limited to direct damages only",
            clause_type="limitation_of_liability",
            industry_standards={"typical_caps": "annual_fee", "exclusions": "standard"},
            precedent_outcomes=[{"case": "similar", "result": "favorable"}]
        )
        
        assert risk.risk_level in ["low", "medium", "high"]
        assert isinstance(risk.risk_factors, list)
        assert isinstance(risk.mitigation_strategies, list)
    
    @pytest.mark.asyncio
    async def test_generate_alternatives(self, negotiation_assistant):
        """GREEN: Test alternative proposal generation"""
        alternatives = await negotiation_assistant.generate_alternatives(
            sticking_point="payment_terms",
            current_positions={
                "our_position": "net-30",
                "their_position": "net-90"
            },
            creative_options=True,
            value_preservation_priority="high"
        )
        
        assert len(alternatives.proposals) > 0
        assert 0.0 <= alternatives.value_preservation <= 1.0
        assert 0.0 <= alternatives.creativity_score <= 1.0
    
    @pytest.mark.asyncio
    async def test_resolve_deadlocks(self, negotiation_assistant):
        """GREEN: Test deadlock resolution"""
        resolution = await negotiation_assistant.resolve_deadlocks(
            deadlock_issues=["price", "intellectual_property"],
            positions_summary={
                "price": {"gap": 100000, "flexibility": "low"},
                "ip": {"disagreement": "ownership", "complexity": "high"}
            },
            available_strategies=["mediation", "arbitration", "creative_restructuring"]
        )
        
        assert len(resolution.resolution_strategies) > 0
        assert resolution.intervention_timing in ["immediate", "next_round"]
        assert 0.0 <= resolution.success_probability <= 1.0
    
    @pytest.mark.asyncio
    async def test_analyze_emotional_tone(self, negotiation_assistant):
        """GREEN: Test emotional tone analysis"""
        analysis = await negotiation_assistant.analyze_emotional_tone(
            communication_samples=[
                "We're disappointed with this proposal",
                "This is our final offer",
                "We value the partnership"
            ],
            communication_channel="email",
            historical_tone_baseline="professional",
            cultural_context="western_business"
        )
        
        assert analysis.emotional_state in ["positive", "negative", "neutral"]
        assert analysis.sentiment_trend in ["declining", "stable", "improving"]
        assert isinstance(analysis.stress_indicators, list)
    
    @pytest.mark.asyncio
    async def test_assess_power_dynamics(self, negotiation_assistant):
        """GREEN: Test power dynamics assessment"""
        dynamics = await negotiation_assistant.assess_power_dynamics(
            party_attributes={
                "us": {"market_position": "strong", "alternatives": 3, "urgency": "low"},
                "them": {"market_position": "moderate", "alternatives": 1, "urgency": "high"}
            },
            leverage_factors=["exclusive_technology", "market_access", "timing"],
            dependency_analysis={"mutual": ["expertise"], "asymmetric": ["customer_base"]}
        )
        
        assert "us" in dynamics.power_balance
        assert "them" in dynamics.power_balance
        assert isinstance(dynamics.leverage_points, list)
        assert len(dynamics.strategic_implications) > 0
    
    @pytest.mark.asyncio
    async def test_track_success_probability(self, negotiation_assistant):
        """GREEN: Test success probability tracking"""
        probability = await negotiation_assistant.track_success_probability(
            negotiation_progress={
                "issues_resolved": 3,
                "issues_remaining": 2,
                "satisfaction_level": "medium",
                "time_remaining": 10
            },
            success_factors=["relationship_quality", "value_alignment", "timing"],
            risk_factors=["competitive_pressure", "internal_constraints"]
        )
        
        assert 0.0 <= probability.current_probability <= 1.0
        assert probability.trend_direction in ["positive", "negative", "stable"]
        assert len(probability.critical_factors) > 0


class TestIntegratedNegotiationSystem:
    """Test integration between strategy and assistant"""
    
    @pytest.mark.asyncio
    async def test_strategy_to_assistant_flow(self, strategy_engine, negotiation_assistant):
        """GREEN: Test strategy to assistant integration"""
        result = await strategy_engine.integrate_with_assistant(
            strategic_plan={"opening": 1000000, "target": 900000, "minimum": 750000},
            real_time_context={"current_offer": 850000, "counterpart_mood": "positive"},
            assistant=negotiation_assistant
        )
        
        assert isinstance(result, dict)
        assert "strategic_plan" in result
        assert "real_time_adjustments" in result
    
    @pytest.mark.asyncio
    async def test_assistant_to_strategy_feedback(self, negotiation_assistant, strategy_engine):
        """GREEN: Test assistant to strategy feedback"""
        feedback = await negotiation_assistant.provide_strategy_feedback(
            real_time_insights={
                "counterpart_flexibility": "high",
                "emotional_state": "eager",
                "time_pressure": "increasing"
            },
            strategy_adjustments=["increase_ambition", "accelerate_timeline"],
            strategy_engine=strategy_engine
        )
        
        assert isinstance(feedback, dict)
        assert "insights" in feedback
        assert "recommended_adjustments" in feedback
    
    @pytest.mark.asyncio
    async def test_adaptive_negotiation(self, strategy_engine, negotiation_assistant):
        """GREEN: Test adaptive negotiation"""
        adaptation = await strategy_engine.adaptive_negotiation(
            initial_strategy={"style": "competitive", "concession_rate": "slow"},
            real_time_feedback={"effectiveness": "low", "relationship_impact": "negative"},
            adaptation_triggers=["counterpart_reaction", "time_pressure"],
            assistant=negotiation_assistant
        )
        
        assert isinstance(adaptation, dict)
        assert "original_strategy" in adaptation
        assert "adaptations" in adaptation
        assert "new_strategy" in adaptation