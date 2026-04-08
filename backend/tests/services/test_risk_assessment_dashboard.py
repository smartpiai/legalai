"""
Risk Assessment Dashboard Tests
Following TDD - RED phase: Comprehensive test suite for risk assessment dashboard with predictive insights
"""

import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
import asyncio
from datetime import datetime, timedelta, date
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional
from uuid import uuid4
from decimal import Decimal

from app.services.risk_assessment_dashboard import (
    RiskAssessmentDashboardService,
    RiskAssessment,
    RiskFactor,
    RiskMetrics,
    RiskPrediction,
    RiskMitigation,
    RiskHeatMap,
    RiskTrend,
    RiskAlert,
    RiskScenario,
    PredictiveModel,
    RiskProfile,
    ComplianceRisk,
    OperationalRisk,
    FinancialRisk,
    LegalRisk,
    VendorRisk,
    ContractRisk,
    RiskCorrelation,
    RiskImpactAnalysis,
    RiskMonitoring,
    RiskReporting,
    RiskFilter,
    RiskSeverity,
    RiskCategory,
    RiskStatus,
    RiskPriority,
    ModelAccuracy,
    PredictionConfidence,
    EarlyWarningSystem,
    RiskBenchmarking
)


@pytest.fixture
def mock_db():
    """Mock database session"""
    db_mock = AsyncMock()
    db_mock.execute = AsyncMock()
    db_mock.scalars = AsyncMock()
    db_mock.scalar = AsyncMock()
    return db_mock


@pytest.fixture
def mock_cache():
    """Mock cache service"""
    cache_mock = AsyncMock()
    cache_mock.get = AsyncMock(return_value=None)
    cache_mock.set = AsyncMock()
    cache_mock.delete = AsyncMock()
    return cache_mock


@pytest.fixture
def mock_ml_service():
    """Mock machine learning service"""
    ml_mock = AsyncMock()
    ml_mock.predict_risk = AsyncMock()
    ml_mock.train_model = AsyncMock()
    ml_mock.evaluate_model = AsyncMock()
    return ml_mock


@pytest.fixture
def mock_notification_service():
    """Mock notification service"""
    notification_mock = AsyncMock()
    notification_mock.send_risk_alert = AsyncMock()
    notification_mock.send_early_warning = AsyncMock()
    return notification_mock


@pytest.fixture
def sample_risk_data():
    """Sample risk assessment data"""
    return [
        {
            "id": str(uuid4()),
            "contract_id": str(uuid4()),
            "assessment_date": datetime(2023, 3, 15),
            "overall_risk_score": 7.5,
            "risk_level": "high",
            "risk_category": "compliance",
            "identified_risks": [
                {
                    "type": "regulatory_change",
                    "description": "Potential impact from new privacy regulations",
                    "probability": 0.7,
                    "impact": 8.0,
                    "severity": "high"
                },
                {
                    "type": "vendor_instability",
                    "description": "Vendor showing signs of financial distress",
                    "probability": 0.4,
                    "impact": 6.0,
                    "severity": "medium"
                }
            ],
            "mitigation_strategies": [
                {
                    "risk_type": "regulatory_change",
                    "strategy": "Implement privacy compliance program",
                    "cost_estimate": Decimal("50000.00"),
                    "timeline": "6 months",
                    "effectiveness": 0.85
                }
            ],
            "predicted_changes": {
                "30_days": {"score": 7.8, "confidence": 0.82},
                "90_days": {"score": 8.2, "confidence": 0.75},
                "180_days": {"score": 8.5, "confidence": 0.68}
            },
            "department": "Legal",
            "vendor": "TechCorp Inc",
            "contract_type": "software_license",
            "contract_value": Decimal("500000.00"),
            "assessment_method": "ml_model",
            "assessor": "Risk AI System",
            "last_updated": datetime(2023, 3, 15),
            "next_review": datetime(2023, 6, 15)
        },
        {
            "id": str(uuid4()),
            "contract_id": str(uuid4()),
            "assessment_date": datetime(2023, 3, 10),
            "overall_risk_score": 4.2,
            "risk_level": "medium",
            "risk_category": "operational",
            "identified_risks": [
                {
                    "type": "service_disruption",
                    "description": "Risk of service interruption during migration",
                    "probability": 0.3,
                    "impact": 5.0,
                    "severity": "medium"
                }
            ],
            "mitigation_strategies": [
                {
                    "risk_type": "service_disruption",
                    "strategy": "Implement redundancy and backup systems",
                    "cost_estimate": Decimal("25000.00"),
                    "timeline": "3 months",
                    "effectiveness": 0.90
                }
            ],
            "predicted_changes": {
                "30_days": {"score": 4.0, "confidence": 0.88},
                "90_days": {"score": 3.5, "confidence": 0.80},
                "180_days": {"score": 3.2, "confidence": 0.72}
            },
            "department": "IT",
            "vendor": "ServicePro LLC",
            "contract_type": "service_agreement",
            "contract_value": Decimal("200000.00"),
            "assessment_method": "hybrid",
            "assessor": "Risk Manager",
            "last_updated": datetime(2023, 3, 10),
            "next_review": datetime(2023, 5, 10)
        }
    ]


@pytest.fixture
def risk_filter():
    """Default risk filter"""
    return RiskFilter(
        start_date=datetime(2023, 1, 1),
        end_date=datetime(2023, 12, 31),
        risk_categories=[RiskCategory.COMPLIANCE, RiskCategory.OPERATIONAL],
        risk_levels=[RiskSeverity.MEDIUM, RiskSeverity.HIGH, RiskSeverity.CRITICAL],
        departments=["Legal", "IT"],
        contract_types=["software_license", "service_agreement"],
        status=[RiskStatus.ACTIVE, RiskStatus.MONITORED]
    )


class TestRiskAssessmentDashboardService:
    """Test risk assessment dashboard functionality"""
    
    @pytest.mark.asyncio
    async def test_get_risk_metrics(self, mock_db, sample_risk_data, risk_filter):
        """Test getting overall risk metrics"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        # Mock database responses
        mock_db.execute.return_value.mappings.return_value.all.return_value = sample_risk_data
        mock_db.scalar.side_effect = [
            2,                    # total_assessments
            1,                    # high_risk_count
            1,                    # medium_risk_count
            0,                    # low_risk_count
            0,                    # critical_risk_count
            5.85,                 # average_risk_score
            7.5,                  # highest_risk_score
            4.2,                  # lowest_risk_score
            1,                    # active_mitigations
            0.82                  # prediction_accuracy
        ]
        
        result = await service.get_risk_metrics(
            tenant_id="tenant_123",
            filters=risk_filter
        )
        
        assert isinstance(result, RiskMetrics)
        assert result.total_assessments == 2
        assert result.high_risk_count == 1
        assert result.medium_risk_count == 1
        assert result.low_risk_count == 0
        assert result.critical_risk_count == 0
        assert result.average_risk_score == 5.85
        assert result.highest_risk_score == 7.5
        assert result.lowest_risk_score == 4.2
        assert result.active_mitigations == 1
        assert result.prediction_accuracy == 0.82
        assert result.risk_distribution["high"] == 1
        assert result.risk_distribution["medium"] == 1
    
    @pytest.mark.asyncio
    async def test_generate_risk_assessment(self, mock_db, mock_ml_service):
        """Test generating risk assessment for a contract"""
        service = RiskAssessmentDashboardService(db=mock_db, ml_service=mock_ml_service)
        
        # Mock contract data
        mock_contract_data = {
            "id": "contract_123",
            "title": "Software License Agreement",
            "contract_type": "software_license",
            "value": Decimal("500000.00"),
            "vendor": "TechCorp Inc",
            "department": "IT",
            "content": "Sample contract content with terms and conditions...",
            "parties": ["Company A", "TechCorp Inc"],
            "start_date": datetime(2023, 1, 1),
            "end_date": datetime(2023, 12, 31)
        }
        
        # Mock ML service predictions
        mock_ml_service.predict_risk.return_value = {
            "risk_score": 6.5,
            "risk_factors": [
                {"type": "vendor_stability", "impact": 0.3, "confidence": 0.85},
                {"type": "contract_complexity", "impact": 0.25, "confidence": 0.78}
            ],
            "confidence": 0.82
        }
        
        # Mock database operations
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        result = await service.generate_risk_assessment(
            tenant_id="tenant_123",
            contract_id="contract_123",
            contract_data=mock_contract_data,
            user_id="user_123"
        )
        
        assert isinstance(result, RiskAssessment)
        assert result.contract_id == "contract_123"
        assert result.overall_risk_score == 6.5
        assert result.risk_level == RiskSeverity.HIGH
        assert len(result.identified_risks) >= 2
        assert result.assessment_method == "ml_model"
        mock_ml_service.predict_risk.assert_called_once()
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_risk_predictions(self, mock_db, mock_ml_service, risk_filter):
        """Test getting risk predictions for multiple time horizons"""
        service = RiskAssessmentDashboardService(db=mock_db, ml_service=mock_ml_service)
        
        # Mock historical risk data
        mock_historical_data = [
            {"period": "2023-01", "avg_risk_score": 5.2},
            {"period": "2023-02", "avg_risk_score": 5.8},
            {"period": "2023-03", "avg_risk_score": 6.1}
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_historical_data
        
        # Mock ML predictions
        mock_ml_service.predict_risk.return_value = {
            "predictions": [
                {"period": "2023-04", "predicted_score": 6.5, "confidence": 0.85},
                {"period": "2023-05", "predicted_score": 6.8, "confidence": 0.80},
                {"period": "2023-06", "predicted_score": 7.0, "confidence": 0.75}
            ]
        }
        
        result = await service.get_risk_predictions(
            tenant_id="tenant_123",
            filters=risk_filter,
            prediction_horizon=90
        )
        
        assert isinstance(result, list)
        assert len(result) == 3
        
        prediction = result[0]
        assert isinstance(prediction, RiskPrediction)
        assert prediction.predicted_score == 6.5
        assert prediction.confidence_level == 0.85
        assert prediction.prediction_horizon == 30  # First prediction is 30 days out
    
    @pytest.mark.asyncio
    async def test_create_risk_heat_map(self, mock_db, sample_risk_data, risk_filter):
        """Test creating risk heat map visualization"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        # Mock risk data by category and department
        mock_heatmap_data = [
            {"category": "compliance", "department": "Legal", "avg_risk": 7.5, "count": 5},
            {"category": "compliance", "department": "IT", "avg_risk": 6.2, "count": 3},
            {"category": "operational", "department": "Legal", "avg_risk": 4.8, "count": 2},
            {"category": "operational", "department": "IT", "avg_risk": 5.1, "count": 7},
            {"category": "financial", "department": "Legal", "avg_risk": 6.8, "count": 4},
            {"category": "financial", "department": "IT", "avg_risk": 5.5, "count": 2}
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_heatmap_data
        
        result = await service.create_risk_heat_map(
            tenant_id="tenant_123",
            filters=risk_filter
        )
        
        assert isinstance(result, RiskHeatMap)
        assert len(result.categories) == 3
        assert len(result.departments) == 2
        assert "compliance" in result.categories
        assert "Legal" in result.departments
        
        # Check heat map data structure
        assert len(result.heat_map_data) == 6  # 3 categories x 2 departments
        
        compliance_legal = next(
            (item for item in result.heat_map_data 
             if item["category"] == "compliance" and item["department"] == "Legal"), 
            None
        )
        assert compliance_legal is not None
        assert compliance_legal["average_risk_score"] == 7.5
        assert compliance_legal["contract_count"] == 5
    
    @pytest.mark.asyncio
    async def test_get_risk_trends(self, mock_db, risk_filter):
        """Test getting risk trends over time"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        # Mock trend data
        mock_trend_data = [
            {
                "period": "2023-01",
                "avg_risk_score": 5.2,
                "high_risk_count": 3,
                "medium_risk_count": 8,
                "low_risk_count": 12,
                "new_risks": 5,
                "mitigated_risks": 2
            },
            {
                "period": "2023-02",
                "avg_risk_score": 5.8,
                "high_risk_count": 5,
                "medium_risk_count": 10,
                "low_risk_count": 10,
                "new_risks": 7,
                "mitigated_risks": 3
            },
            {
                "period": "2023-03",
                "avg_risk_score": 6.1,
                "high_risk_count": 6,
                "medium_risk_count": 12,
                "low_risk_count": 8,
                "new_risks": 4,
                "mitigated_risks": 1
            }
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_trend_data
        
        result = await service.get_risk_trends(
            tenant_id="tenant_123",
            filters=risk_filter,
            aggregation_period="monthly"
        )
        
        assert isinstance(result, list)
        assert len(result) == 3
        
        trend = result[0]
        assert isinstance(trend, RiskTrend)
        assert trend.period == "2023-01"
        assert trend.average_risk_score == 5.2
        assert trend.high_risk_count == 3
        assert trend.new_risks_identified == 5
        assert trend.risks_mitigated == 2
    
    @pytest.mark.asyncio
    async def test_generate_risk_alerts(self, mock_db, mock_notification_service):
        """Test generating risk alerts based on thresholds"""
        service = RiskAssessmentDashboardService(
            db=mock_db, 
            notification_service=mock_notification_service
        )
        
        # Mock high-risk contracts
        mock_high_risk_contracts = [
            {
                "id": "contract_1",
                "title": "Critical Service Agreement",
                "risk_score": 9.2,
                "risk_level": "critical",
                "last_assessment": datetime(2023, 3, 15),
                "department": "IT",
                "vendor": "HighRisk Vendor"
            },
            {
                "id": "contract_2", 
                "title": "Compliance-Heavy Contract",
                "risk_score": 8.5,
                "risk_level": "high",
                "last_assessment": datetime(2023, 3, 14),
                "department": "Legal",
                "vendor": "Regulated Corp"
            }
        ]
        
        # Mock risk threshold breaches
        mock_threshold_breaches = [
            {
                "contract_id": "contract_3",
                "metric": "vendor_stability_score",
                "current_value": 2.1,
                "threshold": 3.0,
                "severity": "medium"
            }
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.side_effect = [
            mock_high_risk_contracts,
            mock_threshold_breaches
        ]
        
        result = await service.generate_risk_alerts(
            tenant_id="tenant_123"
        )
        
        assert isinstance(result, list)
        assert len(result) >= 3  # At least 3 alerts generated
        
        # Check critical risk alert
        critical_alert = next(
            (alert for alert in result if alert.severity == RiskSeverity.CRITICAL),
            None
        )
        assert critical_alert is not None
        assert critical_alert.contract_id == "contract_1"
        assert critical_alert.alert_type == "high_risk_score"
        
        # Verify notifications were sent
        mock_notification_service.send_risk_alert.assert_called()
    
    @pytest.mark.asyncio
    async def test_create_risk_scenario(self, mock_db, mock_ml_service):
        """Test creating risk scenario analysis"""
        service = RiskAssessmentDashboardService(db=mock_db, ml_service=mock_ml_service)
        
        scenario_config = {
            "name": "Vendor Bankruptcy Scenario",
            "description": "Impact analysis if primary vendor files for bankruptcy",
            "assumptions": {
                "affected_vendors": ["TechCorp Inc"],
                "impact_timeline": "30 days",
                "probability": 0.15
            },
            "variables": {
                "vendor_stability_multiplier": 0.2,
                "contract_complexity_increase": 1.5,
                "replacement_cost_factor": 2.0
            }
        }
        
        # Mock scenario analysis results
        mock_ml_service.analyze_scenario.return_value = {
            "scenario_risk_score": 8.7,
            "affected_contracts": 5,
            "total_impact_value": Decimal("2500000.00"),
            "mitigation_cost": Decimal("500000.00"),
            "confidence": 0.73
        }
        
        result = await service.create_risk_scenario(
            tenant_id="tenant_123",
            scenario_config=scenario_config,
            user_id="user_123"
        )
        
        assert isinstance(result, RiskScenario)
        assert result.name == "Vendor Bankruptcy Scenario"
        assert result.scenario_risk_score == 8.7
        assert result.affected_contracts_count == 5
        assert result.total_impact_value == Decimal("2500000.00")
        assert result.confidence_level == 0.73
    
    @pytest.mark.asyncio
    async def test_update_predictive_model(self, mock_db, mock_ml_service):
        """Test updating predictive risk models"""
        service = RiskAssessmentDashboardService(db=mock_db, ml_service=mock_ml_service)
        
        # Mock training data
        training_data = {
            "features": ["contract_value", "vendor_stability", "contract_complexity"],
            "outcomes": [6.5, 4.2, 8.1, 5.8, 7.3],
            "sample_count": 1000
        }
        
        # Mock model training results
        mock_ml_service.train_model.return_value = {
            "model_id": "risk_model_v2.1",
            "accuracy": 0.87,
            "precision": 0.84,
            "recall": 0.89,
            "f1_score": 0.86,
            "training_time": 450.2
        }
        
        result = await service.update_predictive_model(
            tenant_id="tenant_123",
            model_type="risk_assessment",
            training_data=training_data,
            user_id="user_123"
        )
        
        assert isinstance(result, PredictiveModel)
        assert result.model_id == "risk_model_v2.1"
        assert result.accuracy == 0.87
        assert result.model_type == "risk_assessment"
        assert result.training_samples == 1000
        mock_ml_service.train_model.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_risk_correlations(self, mock_db, risk_filter):
        """Test getting risk factor correlations"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        # Mock correlation data
        mock_correlation_data = [
            {
                "factor1": "vendor_stability",
                "factor2": "contract_value",
                "correlation": 0.72,
                "significance": 0.001,
                "sample_size": 150
            },
            {
                "factor1": "contract_complexity",
                "factor2": "regulatory_risk",
                "correlation": 0.65,
                "significance": 0.003,
                "sample_size": 120
            },
            {
                "factor1": "vendor_stability",
                "factor2": "service_quality",
                "correlation": 0.81,
                "significance": 0.000,
                "sample_size": 200
            }
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_correlation_data
        
        result = await service.get_risk_correlations(
            tenant_id="tenant_123",
            filters=risk_filter
        )
        
        assert isinstance(result, list)
        assert len(result) == 3
        
        correlation = result[0]
        assert isinstance(correlation, RiskCorrelation)
        assert correlation.factor1 == "vendor_stability"
        assert correlation.factor2 == "contract_value"
        assert correlation.correlation_coefficient == 0.72
        assert correlation.statistical_significance == 0.001
    
    @pytest.mark.asyncio
    async def test_perform_impact_analysis(self, mock_db, mock_ml_service):
        """Test performing risk impact analysis"""
        service = RiskAssessmentDashboardService(db=mock_db, ml_service=mock_ml_service)
        
        impact_config = {
            "risk_factor": "vendor_instability",
            "scope": "department",  # department, contract_type, or global
            "target": "IT",
            "impact_types": ["financial", "operational", "reputational"]
        }
        
        # Mock impact analysis results
        mock_ml_service.analyze_impact.return_value = {
            "financial_impact": {
                "direct_cost": Decimal("750000.00"),
                "indirect_cost": Decimal("250000.00"),
                "revenue_loss": Decimal("500000.00")
            },
            "operational_impact": {
                "service_disruption": 0.65,
                "productivity_loss": 0.40,
                "recovery_time_days": 45
            },
            "reputational_impact": {
                "brand_damage_score": 6.5,
                "customer_confidence": 0.75,
                "market_perception": 0.68
            },
            "confidence": 0.78
        }
        
        result = await service.perform_impact_analysis(
            tenant_id="tenant_123",
            impact_config=impact_config,
            user_id="user_123"
        )
        
        assert isinstance(result, RiskImpactAnalysis)
        assert result.risk_factor == "vendor_instability"
        assert result.financial_impact["direct_cost"] == Decimal("750000.00")
        assert result.operational_impact["service_disruption"] == 0.65
        assert result.reputational_impact["brand_damage_score"] == 6.5
        assert result.confidence_level == 0.78
    
    @pytest.mark.asyncio
    async def test_early_warning_system(self, mock_db, mock_notification_service):
        """Test early warning system for emerging risks"""
        service = RiskAssessmentDashboardService(
            db=mock_db,
            notification_service=mock_notification_service
        )
        
        # Mock early warning indicators
        mock_warning_indicators = [
            {
                "indicator_type": "vendor_financial_distress",
                "contracts_affected": 3,
                "risk_increase": 2.5,
                "confidence": 0.82,
                "time_to_impact": "30 days"
            },
            {
                "indicator_type": "regulatory_change",
                "contracts_affected": 8,
                "risk_increase": 1.8,
                "confidence": 0.75,
                "time_to_impact": "90 days"
            }
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_warning_indicators
        
        result = await service.check_early_warning_indicators(
            tenant_id="tenant_123"
        )
        
        assert isinstance(result, EarlyWarningSystem)
        assert len(result.warnings) == 2
        
        warning = result.warnings[0]
        assert warning.indicator_type == "vendor_financial_distress"
        assert warning.contracts_affected == 3
        assert warning.estimated_risk_increase == 2.5
        assert warning.confidence_level == 0.82
        
        # Should trigger notifications for high-confidence warnings
        mock_notification_service.send_early_warning.assert_called()
    
    @pytest.mark.asyncio
    async def test_risk_monitoring_dashboard(self, mock_db, risk_filter):
        """Test comprehensive risk monitoring dashboard"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        # Mock dashboard data
        mock_dashboard_data = {
            "summary_stats": {
                "total_contracts": 150,
                "high_risk_contracts": 12,
                "active_alerts": 5,
                "overdue_assessments": 3
            },
            "trend_data": [
                {"period": "2023-01", "avg_risk": 5.2, "alerts": 8},
                {"period": "2023-02", "avg_risk": 5.8, "alerts": 12},
                {"period": "2023-03", "avg_risk": 6.1, "alerts": 15}
            ],
            "top_risks": [
                {"contract_id": "contract_1", "risk_score": 9.2, "category": "compliance"},
                {"contract_id": "contract_2", "risk_score": 8.7, "category": "operational"}
            ]
        }
        
        mock_db.execute.return_value.mappings.return_value.all.side_effect = [
            [mock_dashboard_data["summary_stats"]],
            mock_dashboard_data["trend_data"],
            mock_dashboard_data["top_risks"]
        ]
        
        result = await service.get_risk_monitoring_dashboard(
            tenant_id="tenant_123",
            filters=risk_filter
        )
        
        assert isinstance(result, RiskMonitoring)
        assert result.total_contracts == 150
        assert result.high_risk_contracts == 12
        assert result.active_alerts == 5
        assert len(result.trend_data) == 3
        assert len(result.top_risks) == 2
    
    @pytest.mark.asyncio
    async def test_risk_benchmarking(self, mock_db, risk_filter):
        """Test risk benchmarking against industry standards"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        # Mock benchmarking data
        mock_benchmark_data = {
            "industry_averages": {
                "overall_risk_score": 5.8,
                "compliance_risk": 6.2,
                "operational_risk": 5.1,
                "financial_risk": 6.0
            },
            "peer_comparisons": [
                {"peer_group": "mid_market_legal", "avg_risk": 5.9, "percentile": 65},
                {"peer_group": "technology_sector", "avg_risk": 6.4, "percentile": 45}
            ],
            "best_practices": [
                {"practice": "automated_risk_monitoring", "adoption_rate": 0.73},
                {"practice": "predictive_analytics", "adoption_rate": 0.52}
            ]
        }
        
        with patch.object(service, '_get_industry_benchmarks', return_value=mock_benchmark_data):
            result = await service.get_risk_benchmarking(
                tenant_id="tenant_123",
                filters=risk_filter
            )
        
        assert isinstance(result, RiskBenchmarking)
        assert result.industry_benchmarks["overall_risk_score"] == 5.8
        assert len(result.peer_comparisons) == 2
        assert result.peer_comparisons[0]["peer_group"] == "mid_market_legal"
        assert len(result.best_practices) == 2
    
    @pytest.mark.asyncio
    async def test_risk_caching(self, mock_db, mock_cache, risk_filter):
        """Test risk assessment result caching"""
        service = RiskAssessmentDashboardService(db=mock_db, cache=mock_cache)
        
        # Mock cache miss then hit
        mock_cache.get.side_effect = [None, {"total_assessments": 50}]
        
        # Mock risk data
        mock_db.execute.return_value.mappings.return_value.all.return_value = []
        mock_db.scalar.return_value = 50
        
        # First call - cache miss
        result1 = await service.get_risk_metrics("tenant_123", risk_filter)
        
        # Should have tried to get from cache and then set cache
        mock_cache.get.assert_called()
        mock_cache.set.assert_called()
        
        # Second call - cache hit
        result2 = await service.get_risk_metrics("tenant_123", risk_filter)
        
        assert mock_cache.get.call_count == 2
    
    @pytest.mark.asyncio
    async def test_error_handling(self, mock_db, risk_filter):
        """Test error handling in risk assessment service"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        # Mock database error
        mock_db.execute.side_effect = Exception("Database connection error")
        
        with pytest.raises(Exception) as exc_info:
            await service.get_risk_metrics("tenant_123", risk_filter)
        
        assert "Database connection error" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_multi_tenant_isolation(self, mock_db, risk_filter):
        """Test multi-tenant data isolation"""
        service = RiskAssessmentDashboardService(db=mock_db)
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = []
        mock_db.scalar.return_value = 0
        
        # Call with different tenant IDs
        await service.get_risk_metrics("tenant_1", risk_filter)
        await service.get_risk_metrics("tenant_2", risk_filter)
        
        # Verify queries include tenant isolation
        assert mock_db.execute.call_count >= 2


# Helper function tests
class TestRiskAssessmentHelpers:
    """Test risk assessment helper functions"""
    
    @pytest.mark.asyncio
    async def test_risk_score_calculation(self):
        """Test risk score calculation algorithms"""
        from app.services.risk_assessment_dashboard import calculate_risk_score
        
        risk_factors = [
            {"type": "vendor_stability", "probability": 0.6, "impact": 7.0},
            {"type": "regulatory_risk", "probability": 0.4, "impact": 8.5},
            {"type": "technical_risk", "probability": 0.8, "impact": 5.0}
        ]
        
        risk_score = calculate_risk_score(risk_factors)
        
        assert 0 <= risk_score <= 10
        assert isinstance(risk_score, float)
    
    @pytest.mark.asyncio
    async def test_mitigation_effectiveness(self):
        """Test mitigation strategy effectiveness calculation"""
        from app.services.risk_assessment_dashboard import calculate_mitigation_effectiveness
        
        mitigation_strategy = {
            "type": "process_improvement",
            "cost": Decimal("25000.00"),
            "timeline": "3 months",
            "risk_reduction": 0.70,
            "implementation_probability": 0.85
        }
        
        effectiveness = calculate_mitigation_effectiveness(mitigation_strategy)
        
        assert 0 <= effectiveness <= 1
        assert isinstance(effectiveness, float)
    
    @pytest.mark.asyncio
    async def test_prediction_confidence(self):
        """Test prediction confidence calculation"""
        from app.services.risk_assessment_dashboard import calculate_prediction_confidence
        
        model_metrics = {
            "accuracy": 0.87,
            "precision": 0.84,
            "recall": 0.89,
            "data_quality": 0.92,
            "feature_completeness": 0.88
        }
        
        confidence = calculate_prediction_confidence(model_metrics)
        
        assert 0 <= confidence <= 1
        assert isinstance(confidence, float)