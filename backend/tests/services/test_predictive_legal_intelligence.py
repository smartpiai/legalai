"""
Comprehensive tests for Predictive Legal Intelligence service.
Tests for market intelligence, risk management, predictive analytics, and intelligence gathering.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any
from unittest.mock import AsyncMock, MagicMock
import asyncio

from app.services.predictive_legal_intelligence import (
    PredictiveLegalIntelligenceService,
    MarketIntelligenceData,
    RiskAssessmentData,
    PredictiveAnalyticsResult,
    IntelligenceReport,
    TrendAnalysis,
    RegulatoryChange,
    CompetitorActivity,
    MarketSentiment,
    EconomicImpact,
    PoliticalRisk,
    CurrencyImpact,
    SupplyChainRisk,
    MergerPrediction,
    LitigationTrend,
    EarlyWarning,
    RiskPattern,
    AnomalyDetection,
    ComplianceMonitoring,
    CrisisPrediction,
    MitigationRecommendation,
    RiskSimulation,
    StressTesting,
    ScenarioPlanning,
    RiskAppetite,
    TimeSeriesForecast,
    EventCorrelation,
    ProbabilityCalculation,
    ImpactAssessment,
    TrendExtrapolation,
    SeasonalityDetection,
    OutlierIdentification,
    ConfidenceInterval,
    ModelAccuracy,
    DataSourceIntegration,
    InformationValidation,
    SignalExtraction,
    NoiseFiltering,
    EntityRecognition,
    RelationshipMapping,
    KnowledgeGraphUpdate,
    AlertGeneration,
    ReportSynthesis,
    ExecutiveBriefing,
    IntelligenceServiceError,
    PredictionModelError,
    DataValidationError,
    AnalysisError
)


class TestPredictiveLegalIntelligenceService:
    """Test suite for Predictive Legal Intelligence service."""

    @pytest.fixture
    async def service(self):
        """Create service instance for testing."""
        return PredictiveLegalIntelligenceService()

    @pytest.fixture
    def sample_market_data(self):
        """Sample market intelligence data."""
        return {
            "industry": "technology",
            "sector": "cloud_computing",
            "region": "north_america",
            "time_period": "2024-Q1",
            "metrics": {
                "market_size": 150000000000,
                "growth_rate": 0.15,
                "volatility": 0.08,
                "competition_index": 0.75
            },
            "regulatory_environment": "evolving",
            "political_stability": 0.85
        }

    @pytest.fixture
    def sample_risk_data(self):
        """Sample risk assessment data."""
        return {
            "entity_id": "legal_entity_123",
            "risk_categories": ["regulatory", "operational", "financial"],
            "severity_levels": [0.7, 0.4, 0.6],
            "probability_scores": [0.8, 0.3, 0.5],
            "time_horizon": "12_months",
            "mitigation_status": "partial"
        }

    # Market Intelligence System Tests

    @pytest.mark.asyncio
    async def test_analyze_industry_trends(self, service, sample_market_data):
        """Test industry trend analysis with pattern detection."""
        result = await service.analyze_industry_trends(
            industry="technology",
            time_period="2024-Q1",
            data_sources=["market_reports", "regulatory_filings"]
        )
        
        assert isinstance(result, TrendAnalysis)
        assert result.industry == "technology"
        assert result.trend_direction in ["upward", "downward", "stable"]
        assert 0 <= result.confidence_score <= 1
        assert len(result.key_indicators) > 0
        assert result.pattern_detected is not None

    @pytest.mark.asyncio
    async def test_predict_regulatory_changes(self, service):
        """Test regulatory change prediction using historical data."""
        result = await service.predict_regulatory_changes(
            jurisdiction="US",
            industry="healthcare",
            prediction_horizon="6_months"
        )
        
        assert isinstance(result, RegulatoryChange)
        assert result.jurisdiction == "US"
        assert result.change_probability >= 0
        assert result.impact_severity in ["low", "medium", "high", "critical"]
        assert len(result.affected_areas) > 0
        assert result.timeline_estimate is not None

    @pytest.mark.asyncio
    async def test_monitor_competitors(self, service):
        """Test competitor monitoring and analysis."""
        result = await service.monitor_competitors(
            industry="legal_tech",
            competitors=["competitor_a", "competitor_b"],
            monitoring_period="30_days"
        )
        
        assert isinstance(result, CompetitorActivity)
        assert len(result.activities) > 0
        assert result.threat_level in ["low", "medium", "high"]
        assert result.strategic_implications is not None

    @pytest.mark.asyncio
    async def test_analyze_market_sentiment(self, service):
        """Test market sentiment analysis from multiple sources."""
        result = await service.analyze_market_sentiment(
            market="legal_services",
            sources=["news", "social_media", "analyst_reports"],
            time_window="7_days"
        )
        
        assert isinstance(result, MarketSentiment)
        assert -1 <= result.sentiment_score <= 1
        assert result.sentiment_trend in ["improving", "declining", "stable"]
        assert len(result.key_themes) > 0

    @pytest.mark.asyncio
    async def test_model_economic_impact(self, service):
        """Test economic impact modeling with scenarios."""
        result = await service.model_economic_impact(
            scenario="recession",
            industry="legal_services",
            variables=["gdp_growth", "unemployment", "interest_rates"]
        )
        
        assert isinstance(result, EconomicImpact)
        assert result.scenario == "recession"
        assert result.impact_magnitude is not None
        assert len(result.affected_metrics) > 0

    @pytest.mark.asyncio
    async def test_assess_political_risk(self, service):
        """Test political risk assessment algorithms."""
        result = await service.assess_political_risk(
            country="US",
            time_horizon="12_months",
            risk_factors=["election", "policy_changes", "international_relations"]
        )
        
        assert isinstance(result, PoliticalRisk)
        assert 0 <= result.risk_score <= 1
        assert result.stability_outlook in ["stable", "volatile", "uncertain"]
        assert len(result.key_risks) > 0

    @pytest.mark.asyncio
    async def test_calculate_currency_impact(self, service):
        """Test currency fluctuation impact calculations."""
        result = await service.calculate_currency_impact(
            base_currency="USD",
            target_currencies=["EUR", "GBP", "JPY"],
            exposure_amount=1000000,
            time_horizon="3_months"
        )
        
        assert isinstance(result, CurrencyImpact)
        assert result.exposure_amount == 1000000
        assert result.potential_impact is not None
        assert len(result.currency_risks) > 0

    @pytest.mark.asyncio
    async def test_evaluate_supply_chain_risk(self, service):
        """Test supply chain risk evaluation."""
        result = await service.evaluate_supply_chain_risk(
            supply_chain_id="legal_tech_supply_chain",
            risk_factors=["geopolitical", "natural_disasters", "cyber_threats"]
        )
        
        assert isinstance(result, SupplyChainRisk)
        assert 0 <= result.overall_risk_score <= 1
        assert len(result.critical_vulnerabilities) >= 0
        assert result.resilience_score is not None

    @pytest.mark.asyncio
    async def test_predict_merger_activity(self, service):
        """Test merger activity prediction models."""
        result = await service.predict_merger_activity(
            industry="legal_tech",
            market_conditions={"valuation_levels": "high", "interest_rates": "rising"},
            prediction_period="6_months"
        )
        
        assert isinstance(result, MergerPrediction)
        assert result.activity_probability >= 0
        assert result.expected_volume is not None
        assert len(result.likely_participants) >= 0

    @pytest.mark.asyncio
    async def test_analyze_litigation_trends(self, service):
        """Test litigation trend analysis."""
        result = await service.analyze_litigation_trends(
            practice_area="intellectual_property",
            jurisdiction="US",
            time_period="2_years"
        )
        
        assert isinstance(result, LitigationTrend)
        assert result.trend_direction in ["increasing", "decreasing", "stable"]
        assert result.case_volume_change is not None
        assert len(result.emerging_issues) >= 0

    # Proactive Risk Management Tests

    @pytest.mark.asyncio
    async def test_early_warning_system(self, service, sample_risk_data):
        """Test early warning system with thresholds."""
        result = await service.generate_early_warning(
            entity_id="legal_entity_123",
            risk_threshold=0.7,
            monitoring_categories=["regulatory", "operational"]
        )
        
        assert isinstance(result, EarlyWarning)
        assert result.entity_id == "legal_entity_123"
        assert result.warning_level in ["low", "medium", "high", "critical"]
        assert len(result.triggered_indicators) >= 0

    @pytest.mark.asyncio
    async def test_recognize_risk_patterns(self, service):
        """Test risk pattern recognition using ML."""
        result = await service.recognize_risk_patterns(
            historical_data=["risk_event_1", "risk_event_2"],
            pattern_types=["seasonal", "cyclical", "trending"]
        )
        
        assert isinstance(result, RiskPattern)
        assert len(result.identified_patterns) >= 0
        assert result.pattern_confidence >= 0
        assert result.recurrence_probability is not None

    @pytest.mark.asyncio
    async def test_detect_anomalies(self, service):
        """Test anomaly detection algorithms."""
        result = await service.detect_anomalies(
            data_stream="compliance_metrics",
            detection_window="30_days",
            sensitivity_level="medium"
        )
        
        assert isinstance(result, AnomalyDetection)
        assert len(result.detected_anomalies) >= 0
        assert result.anomaly_score is not None
        assert result.detection_confidence >= 0

    @pytest.mark.asyncio
    async def test_monitor_compliance_predictively(self, service):
        """Test predictive compliance monitoring."""
        result = await service.monitor_compliance_predictively(
            compliance_framework="sox",
            monitoring_scope=["financial_reporting", "internal_controls"],
            prediction_horizon="3_months"
        )
        
        assert isinstance(result, ComplianceMonitoring)
        assert result.compliance_score >= 0
        assert len(result.risk_areas) >= 0
        assert result.violation_probability is not None

    @pytest.mark.asyncio
    async def test_predict_crisis(self, service):
        """Test crisis prediction models."""
        result = await service.predict_crisis(
            entity_id="legal_entity_123",
            crisis_types=["reputation", "financial", "operational"],
            prediction_window="6_months"
        )
        
        assert isinstance(result, CrisisPrediction)
        assert result.crisis_probability >= 0
        assert result.severity_estimate in ["low", "medium", "high", "catastrophic"]
        assert len(result.potential_triggers) >= 0

    @pytest.mark.asyncio
    async def test_recommend_mitigation(self, service):
        """Test mitigation recommendation engine."""
        result = await service.recommend_mitigation(
            risk_profile={"type": "regulatory", "severity": 0.8, "probability": 0.6},
            available_resources={"budget": 100000, "timeline": "3_months"},
            constraints=["regulatory_approval", "stakeholder_buy_in"]
        )
        
        assert isinstance(result, MitigationRecommendation)
        assert len(result.recommended_actions) > 0
        assert result.effectiveness_score >= 0
        assert result.implementation_timeline is not None

    @pytest.mark.asyncio
    async def test_simulate_risk_scenarios(self, service):
        """Test risk simulation scenarios."""
        result = await service.simulate_risk_scenarios(
            base_scenario="current_state",
            risk_variables=["market_volatility", "regulatory_changes"],
            simulation_runs=1000
        )
        
        assert isinstance(result, RiskSimulation)
        assert len(result.scenario_outcomes) > 0
        assert result.confidence_intervals is not None
        assert result.worst_case_scenario is not None

    @pytest.mark.asyncio
    async def test_stress_testing_framework(self, service):
        """Test stress testing frameworks."""
        result = await service.conduct_stress_testing(
            stress_scenario="extreme_market_downturn",
            test_parameters={"severity": "high", "duration": "6_months"},
            metrics_to_test=["liquidity", "profitability", "compliance"]
        )
        
        assert isinstance(result, StressTesting)
        assert result.stress_scenario == "extreme_market_downturn"
        assert len(result.test_results) > 0
        assert result.resilience_score is not None

    @pytest.mark.asyncio
    async def test_scenario_planning_tools(self, service):
        """Test scenario planning tools."""
        result = await service.create_scenario_plan(
            planning_horizon="2_years",
            scenarios=["base_case", "optimistic", "pessimistic"],
            key_variables=["market_growth", "regulatory_environment"]
        )
        
        assert isinstance(result, ScenarioPlanning)
        assert len(result.scenarios) >= 3
        assert result.recommended_strategy is not None
        assert result.contingency_plans is not None

    @pytest.mark.asyncio
    async def test_risk_appetite_modeling(self, service):
        """Test risk appetite modeling."""
        result = await service.model_risk_appetite(
            organization_profile={"size": "large", "industry": "legal_services"},
            risk_tolerance={"financial": 0.3, "reputation": 0.1, "operational": 0.5},
            strategic_objectives=["growth", "stability", "innovation"]
        )
        
        assert isinstance(result, RiskAppetite)
        assert result.overall_risk_appetite >= 0
        assert len(result.risk_limits) > 0
        assert result.appetite_alignment is not None

    # Predictive Analytics Engine Tests

    @pytest.mark.asyncio
    async def test_time_series_forecasting(self, service):
        """Test time series forecasting."""
        historical_data = [100, 105, 110, 108, 115, 120, 118, 125]
        result = await service.forecast_time_series(
            historical_data=historical_data,
            forecast_horizon=6,
            model_type="arima"
        )
        
        assert isinstance(result, TimeSeriesForecast)
        assert len(result.forecast_values) == 6
        assert result.model_accuracy >= 0
        assert result.confidence_bands is not None

    @pytest.mark.asyncio
    async def test_analyze_event_correlation(self, service):
        """Test event correlation analysis."""
        result = await service.analyze_event_correlation(
            event_data=[
                {"event": "regulatory_change", "timestamp": "2024-01-01", "impact": 0.8},
                {"event": "market_shift", "timestamp": "2024-01-15", "impact": 0.6}
            ],
            correlation_window="30_days"
        )
        
        assert isinstance(result, EventCorrelation)
        assert len(result.correlations) >= 0
        assert result.strongest_correlation is not None
        assert result.correlation_strength >= -1 and result.correlation_strength <= 1

    @pytest.mark.asyncio
    async def test_calculate_probabilities(self, service):
        """Test probability calculations."""
        result = await service.calculate_probabilities(
            event_type="regulatory_violation",
            historical_frequency=0.05,
            risk_factors={"compliance_score": 0.8, "industry_volatility": 0.3}
        )
        
        assert isinstance(result, ProbabilityCalculation)
        assert 0 <= result.calculated_probability <= 1
        assert result.confidence_level >= 0
        assert len(result.contributing_factors) > 0

    @pytest.mark.asyncio
    async def test_assess_impact(self, service):
        """Test impact assessment models."""
        result = await service.assess_impact(
            event_scenario="data_breach",
            impact_dimensions=["financial", "reputation", "operational"],
            organization_profile={"size": "medium", "industry": "legal_tech"}
        )
        
        assert isinstance(result, ImpactAssessment)
        assert len(result.impact_scores) > 0
        assert result.overall_impact >= 0
        assert result.recovery_timeline is not None

    @pytest.mark.asyncio
    async def test_extrapolate_trends(self, service):
        """Test trend extrapolation."""
        trend_data = [
            {"period": "2024-Q1", "value": 100},
            {"period": "2024-Q2", "value": 110},
            {"period": "2024-Q3", "value": 125}
        ]
        result = await service.extrapolate_trends(
            trend_data=trend_data,
            extrapolation_periods=4,
            trend_model="linear"
        )
        
        assert isinstance(result, TrendExtrapolation)
        assert len(result.extrapolated_values) == 4
        assert result.trend_direction in ["upward", "downward", "stable"]
        assert result.extrapolation_confidence >= 0

    @pytest.mark.asyncio
    async def test_detect_seasonality(self, service):
        """Test seasonality detection."""
        seasonal_data = [10, 15, 20, 25, 30, 35, 25, 20, 15, 10, 15, 20] * 3
        result = await service.detect_seasonality(
            time_series_data=seasonal_data,
            detection_method="fourier_transform",
            minimum_periods=2
        )
        
        assert isinstance(result, SeasonalityDetection)
        assert result.seasonality_detected is not None
        assert result.seasonal_period is not None
        assert result.seasonal_strength >= 0

    @pytest.mark.asyncio
    async def test_identify_outliers(self, service):
        """Test outlier identification."""
        data_points = [10, 12, 11, 13, 12, 100, 11, 12, 13, 11]  # 100 is outlier
        result = await service.identify_outliers(
            data_points=data_points,
            detection_method="statistical",
            sensitivity=2.0
        )
        
        assert isinstance(result, OutlierIdentification)
        assert len(result.outlier_indices) > 0
        assert 5 in result.outlier_indices  # Index of value 100
        assert result.outlier_scores is not None

    @pytest.mark.asyncio
    async def test_calculate_confidence_intervals(self, service):
        """Test confidence intervals calculation."""
        sample_data = [95, 100, 105, 98, 102, 97, 103, 99, 101, 96]
        result = await service.calculate_confidence_intervals(
            sample_data=sample_data,
            confidence_level=0.95,
            distribution_type="normal"
        )
        
        assert isinstance(result, ConfidenceInterval)
        assert result.lower_bound < result.upper_bound
        assert result.confidence_level == 0.95
        assert result.margin_of_error > 0

    @pytest.mark.asyncio
    async def test_track_model_accuracy(self, service):
        """Test model accuracy tracking."""
        predictions = [0.8, 0.6, 0.9, 0.7, 0.5]
        actuals = [0.75, 0.65, 0.85, 0.72, 0.55]
        result = await service.track_model_accuracy(
            model_id="risk_prediction_v1",
            predictions=predictions,
            actual_outcomes=actuals,
            accuracy_metrics=["mae", "rmse", "r_squared"]
        )
        
        assert isinstance(result, ModelAccuracy)
        assert result.model_id == "risk_prediction_v1"
        assert 0 <= result.accuracy_score <= 1
        assert len(result.metric_scores) > 0

    # Intelligence Gathering Tests

    @pytest.mark.asyncio
    async def test_integrate_data_sources(self, service):
        """Test data source integration."""
        result = await service.integrate_data_sources(
            source_types=["regulatory_databases", "news_feeds", "market_data"],
            integration_frequency="hourly",
            data_quality_threshold=0.8
        )
        
        assert isinstance(result, DataSourceIntegration)
        assert len(result.integrated_sources) > 0
        assert result.integration_status == "active"
        assert result.data_quality_score >= 0.8

    @pytest.mark.asyncio
    async def test_validate_information(self, service):
        """Test information validation."""
        information_items = [
            {"source": "reuters", "content": "New regulation announced", "confidence": 0.9},
            {"source": "blog", "content": "Market speculation", "confidence": 0.3}
        ]
        result = await service.validate_information(
            information_items=information_items,
            validation_criteria=["source_credibility", "cross_verification"],
            minimum_confidence=0.7
        )
        
        assert isinstance(result, InformationValidation)
        assert len(result.validated_items) <= len(information_items)
        assert result.validation_score >= 0
        assert result.rejected_count >= 0

    @pytest.mark.asyncio
    async def test_extract_signals(self, service):
        """Test signal extraction."""
        raw_data = {
            "news_articles": ["Article about new regulation", "Market analysis piece"],
            "social_media": ["Tweet about compliance", "LinkedIn post about trends"],
            "reports": ["Analyst report on legal tech"]
        }
        result = await service.extract_signals(
            raw_data=raw_data,
            signal_types=["regulatory_changes", "market_movements", "sentiment_shifts"],
            extraction_confidence=0.6
        )
        
        assert isinstance(result, SignalExtraction)
        assert len(result.extracted_signals) >= 0
        assert result.signal_strength >= 0
        assert result.extraction_accuracy is not None

    @pytest.mark.asyncio
    async def test_filter_noise(self, service):
        """Test noise filtering."""
        noisy_data = [
            {"signal": "important_regulation", "noise_level": 0.1},
            {"signal": "irrelevant_news", "noise_level": 0.9},
            {"signal": "market_trend", "noise_level": 0.3}
        ]
        result = await service.filter_noise(
            noisy_data=noisy_data,
            noise_threshold=0.5,
            filtering_algorithm="adaptive"
        )
        
        assert isinstance(result, NoiseFiltering)
        assert len(result.filtered_data) <= len(noisy_data)
        assert result.noise_reduction_ratio >= 0
        assert result.signal_preservation_rate >= 0

    @pytest.mark.asyncio
    async def test_recognize_entities(self, service):
        """Test entity recognition."""
        text_data = "The SEC announced new regulations affecting JPMorgan Chase and Goldman Sachs."
        result = await service.recognize_entities(
            text_data=text_data,
            entity_types=["organizations", "regulations", "locations"],
            recognition_confidence=0.8
        )
        
        assert isinstance(result, EntityRecognition)
        assert len(result.recognized_entities) > 0
        assert result.recognition_accuracy >= 0
        assert "SEC" in [entity["text"] for entity in result.recognized_entities]

    @pytest.mark.asyncio
    async def test_map_relationships(self, service):
        """Test relationship mapping."""
        entities = [
            {"id": "entity_1", "type": "organization", "name": "Law Firm A"},
            {"id": "entity_2", "type": "regulation", "name": "GDPR"},
            {"id": "entity_3", "type": "client", "name": "Tech Company B"}
        ]
        result = await service.map_relationships(
            entities=entities,
            relationship_types=["affected_by", "advises", "complies_with"],
            mapping_algorithm="graph_analysis"
        )
        
        assert isinstance(result, RelationshipMapping)
        assert len(result.mapped_relationships) >= 0
        assert result.relationship_confidence >= 0
        assert result.network_density is not None

    @pytest.mark.asyncio
    async def test_update_knowledge_graph(self, service):
        """Test knowledge graph updates."""
        new_knowledge = {
            "entities": [{"id": "new_entity", "type": "regulation", "properties": {}}],
            "relationships": [{"from": "entity_1", "to": "new_entity", "type": "related_to"}]
        }
        result = await service.update_knowledge_graph(
            new_knowledge=new_knowledge,
            update_strategy="incremental",
            validation_required=True
        )
        
        assert isinstance(result, KnowledgeGraphUpdate)
        assert result.update_status == "completed"
        assert result.entities_added >= 0
        assert result.relationships_added >= 0

    @pytest.mark.asyncio
    async def test_generate_alerts(self, service):
        """Test alert generation."""
        trigger_conditions = {
            "risk_threshold_exceeded": {"threshold": 0.8, "current_value": 0.85},
            "regulatory_change_detected": {"confidence": 0.9, "impact": "high"}
        }
        result = await service.generate_alerts(
            trigger_conditions=trigger_conditions,
            alert_recipients=["risk_manager", "legal_team"],
            priority_level="high"
        )
        
        assert isinstance(result, AlertGeneration)
        assert len(result.generated_alerts) > 0
        assert result.delivery_status == "sent"
        assert result.alert_priority == "high"

    @pytest.mark.asyncio
    async def test_synthesize_reports(self, service):
        """Test report synthesis."""
        intelligence_data = {
            "market_analysis": {"trend": "positive", "confidence": 0.8},
            "risk_assessment": {"level": "medium", "factors": ["regulatory", "market"]},
            "predictions": {"6_month_outlook": "stable", "probability": 0.7}
        }
        result = await service.synthesize_reports(
            intelligence_data=intelligence_data,
            report_type="executive_summary",
            target_audience="c_suite"
        )
        
        assert isinstance(result, ReportSynthesis)
        assert result.report_type == "executive_summary"
        assert len(result.key_findings) > 0
        assert result.synthesis_quality >= 0

    @pytest.mark.asyncio
    async def test_create_executive_briefing(self, service):
        """Test executive briefing creation."""
        briefing_data = {
            "time_period": "2024-Q1",
            "key_developments": ["new_regulation", "market_shift"],
            "risk_updates": ["increased_compliance_risk"],
            "strategic_implications": ["need_for_policy_review"]
        }
        result = await service.create_executive_briefing(
            briefing_data=briefing_data,
            briefing_format="dashboard",
            update_frequency="weekly"
        )
        
        assert isinstance(result, ExecutiveBriefing)
        assert result.briefing_format == "dashboard"
        assert len(result.key_highlights) > 0
        assert result.action_items is not None

    # Error Handling Tests

    @pytest.mark.asyncio
    async def test_invalid_industry_trend_analysis(self, service):
        """Test error handling for invalid industry trend analysis."""
        with pytest.raises(DataValidationError):
            await service.analyze_industry_trends(
                industry="",  # Invalid empty industry
                time_period="2024-Q1",
                data_sources=[]
            )

    @pytest.mark.asyncio
    async def test_invalid_prediction_horizon(self, service):
        """Test error handling for invalid prediction horizon."""
        with pytest.raises(PredictionModelError):
            await service.predict_regulatory_changes(
                jurisdiction="US",
                industry="healthcare",
                prediction_horizon="invalid_horizon"
            )

    @pytest.mark.asyncio
    async def test_insufficient_data_for_analysis(self, service):
        """Test error handling for insufficient data."""
        with pytest.raises(AnalysisError):
            await service.forecast_time_series(
                historical_data=[],  # Empty data
                forecast_horizon=6,
                model_type="arima"
            )

    @pytest.mark.asyncio
    async def test_invalid_confidence_level(self, service):
        """Test error handling for invalid confidence level."""
        with pytest.raises(DataValidationError):
            await service.calculate_confidence_intervals(
                sample_data=[1, 2, 3, 4, 5],
                confidence_level=1.5,  # Invalid confidence level > 1
                distribution_type="normal"
            )

    @pytest.mark.asyncio
    async def test_model_accuracy_with_mismatched_data(self, service):
        """Test error handling for mismatched prediction and actual data."""
        with pytest.raises(DataValidationError):
            await service.track_model_accuracy(
                model_id="test_model",
                predictions=[0.1, 0.2, 0.3],
                actual_outcomes=[0.15, 0.25],  # Different length
                accuracy_metrics=["mae"]
            )

    @pytest.mark.asyncio
    async def test_concurrent_intelligence_operations(self, service):
        """Test concurrent intelligence gathering operations."""
        tasks = [
            service.analyze_industry_trends("tech", "2024-Q1", ["reports"]),
            service.predict_regulatory_changes("US", "fintech", "6_months"),
            service.monitor_competitors("legal_tech", ["comp1"], "30_days")
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Ensure all operations complete without exceptions
        for result in results:
            assert not isinstance(result, Exception)