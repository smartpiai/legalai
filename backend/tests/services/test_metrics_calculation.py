"""
Metrics Calculation Service Tests
Following TDD - RED phase: Comprehensive test suite for metrics calculation
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
from decimal import Decimal
import json

from app.services.metrics_calculation import (
    MetricsCalculationService,
    MetricType,
    AggregationMethod,
    TimeGranularity,
    MetricDefinition,
    CalculatedMetric,
    MetricThreshold,
    MetricAlert,
    MetricError
)
from app.models.metrics import Metric, MetricHistory, MetricSnapshot
from app.schemas.metrics import (
    MetricRequest,
    MetricResponse,
    MetricBatchRequest,
    MetricTrendResponse
)


class TestMetricsCalculationService:
    """Test suite for metrics calculation service"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        db = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.rollback = AsyncMock()
        return db

    @pytest.fixture
    def mock_contract_repository(self):
        """Mock contract repository for data fetching"""
        repo = AsyncMock()
        repo.get_count = AsyncMock(return_value=1542)
        repo.get_active_count = AsyncMock(return_value=892)
        repo.get_total_value = AsyncMock(return_value=Decimal('15420000.00'))
        repo.get_by_status = AsyncMock(return_value=[
            {'status': 'active', 'count': 892},
            {'status': 'expired', 'count': 450},
            {'status': 'pending', 'count': 200}
        ])
        return repo

    @pytest.fixture
    def mock_user_repository(self):
        """Mock user repository for activity metrics"""
        repo = AsyncMock()
        repo.get_active_users = AsyncMock(return_value=127)
        repo.get_login_count = AsyncMock(return_value=3456)
        repo.get_average_session_duration = AsyncMock(return_value=1823)  # seconds
        return repo

    @pytest.fixture
    def mock_cache_service(self):
        """Mock cache service"""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock()
        cache.delete = AsyncMock()
        return cache

    @pytest.fixture
    def metrics_service(
        self,
        mock_db,
        mock_contract_repository,
        mock_user_repository,
        mock_cache_service
    ):
        """Create metrics service instance"""
        return MetricsCalculationService(
            db=mock_db,
            contract_repository=mock_contract_repository,
            user_repository=mock_user_repository,
            cache_service=mock_cache_service
        )

    @pytest.fixture
    def sample_metric_definition(self):
        """Sample metric definition"""
        return MetricDefinition(
            id="contract_volume",
            name="Contract Volume",
            type=MetricType.COUNT,
            category="contracts",
            description="Total number of contracts",
            calculation_method="count",
            aggregation=AggregationMethod.SUM,
            unit="contracts",
            refresh_interval=300  # 5 minutes
        )

    # Test Volume Metrics

    @pytest.mark.asyncio
    async def test_calculate_contract_volume(self, metrics_service, mock_contract_repository):
        """Test calculating contract volume metrics"""
        result = await metrics_service.calculate_contract_volume(
            tenant_id="tenant-123",
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow()
        )

        assert result.value == 1542
        assert result.metric_type == MetricType.COUNT
        assert result.unit == "contracts"
        mock_contract_repository.get_count.assert_called_once()

    @pytest.mark.asyncio
    async def test_calculate_active_contracts(self, metrics_service, mock_contract_repository):
        """Test calculating active contract count"""
        result = await metrics_service.calculate_active_contracts(
            tenant_id="tenant-123"
        )

        assert result.value == 892
        assert result.metric_type == MetricType.COUNT
        assert result.metadata["status"] == "active"

    @pytest.mark.asyncio
    async def test_calculate_contract_growth_rate(self, metrics_service):
        """Test calculating contract growth rate"""
        metrics_service.get_historical_value = AsyncMock(return_value=1400)
        
        result = await metrics_service.calculate_growth_rate(
            metric_id="contract_volume",
            current_value=1542,
            previous_value=1400,
            tenant_id="tenant-123"
        )

        assert result.value == pytest.approx(10.14, 0.01)  # (1542-1400)/1400 * 100
        assert result.metric_type == MetricType.PERCENTAGE
        assert result.unit == "%"

    # Test Cycle Time Metrics

    @pytest.mark.asyncio
    async def test_calculate_average_cycle_time(self, metrics_service):
        """Test calculating average contract cycle time"""
        mock_contracts = [
            {"created_at": datetime.utcnow() - timedelta(days=10),
             "approved_at": datetime.utcnow() - timedelta(days=5)},
            {"created_at": datetime.utcnow() - timedelta(days=8),
             "approved_at": datetime.utcnow() - timedelta(days=3)},
            {"created_at": datetime.utcnow() - timedelta(days=15),
             "approved_at": datetime.utcnow() - timedelta(days=7)}
        ]
        
        metrics_service.contract_repository.get_completed_contracts = AsyncMock(
            return_value=mock_contracts
        )

        result = await metrics_service.calculate_cycle_time(
            tenant_id="tenant-123",
            period_days=30
        )

        assert result.value == pytest.approx(6.33, 0.01)  # Average of 5, 5, and 8 days
        assert result.metric_type == MetricType.DURATION
        assert result.unit == "days"

    @pytest.mark.asyncio
    async def test_identify_bottlenecks(self, metrics_service):
        """Test identifying process bottlenecks"""
        stage_times = {
            "draft": 2.5,
            "review": 8.2,  # Bottleneck
            "approval": 1.3,
            "signature": 2.1
        }
        
        metrics_service.calculate_stage_times = AsyncMock(return_value=stage_times)

        bottlenecks = await metrics_service.identify_bottlenecks(
            tenant_id="tenant-123",
            threshold_percentile=75
        )

        assert len(bottlenecks) == 1
        assert bottlenecks[0]["stage"] == "review"
        assert bottlenecks[0]["average_time"] == 8.2
        assert bottlenecks[0]["severity"] == "high"

    # Test Value Analytics

    @pytest.mark.asyncio
    async def test_calculate_total_contract_value(self, metrics_service, mock_contract_repository):
        """Test calculating total contract value"""
        result = await metrics_service.calculate_total_value(
            tenant_id="tenant-123",
            currency="USD"
        )

        assert result.value == 15420000
        assert result.metric_type == MetricType.CURRENCY
        assert result.unit == "USD"
        assert result.metadata["formatted"] == "$15,420,000.00"

    @pytest.mark.asyncio
    async def test_calculate_average_contract_value(self, metrics_service):
        """Test calculating average contract value"""
        metrics_service.contract_repository.get_total_value = AsyncMock(
            return_value=Decimal('15420000')
        )
        metrics_service.contract_repository.get_count = AsyncMock(return_value=100)

        result = await metrics_service.calculate_average_value(
            tenant_id="tenant-123"
        )

        assert result.value == 154200
        assert result.metric_type == MetricType.CURRENCY
        assert result.metadata["calculation"] == "total_value / count"

    @pytest.mark.asyncio
    async def test_calculate_value_at_risk(self, metrics_service):
        """Test calculating value at risk for expiring contracts"""
        expiring_contracts = [
            {"id": "1", "value": 500000, "expires_in_days": 15},
            {"id": "2", "value": 750000, "expires_in_days": 25},
            {"id": "3", "value": 300000, "expires_in_days": 10}
        ]
        
        metrics_service.contract_repository.get_expiring_contracts = AsyncMock(
            return_value=expiring_contracts
        )

        result = await metrics_service.calculate_value_at_risk(
            tenant_id="tenant-123",
            days_ahead=30
        )

        assert result.value == 1550000
        assert result.metric_type == MetricType.CURRENCY
        assert len(result.metadata["contracts"]) == 3

    # Test Risk Metrics

    @pytest.mark.asyncio
    async def test_calculate_risk_score(self, metrics_service):
        """Test calculating overall risk score"""
        risk_factors = {
            "high_value_concentration": 0.3,
            "compliance_issues": 0.2,
            "expiring_contracts": 0.25,
            "missing_clauses": 0.15,
            "vendor_performance": 0.1
        }
        
        metrics_service.assess_risk_factors = AsyncMock(return_value=risk_factors)

        result = await metrics_service.calculate_risk_score(
            tenant_id="tenant-123"
        )

        assert 0 <= result.value <= 100
        assert result.metric_type == MetricType.SCORE
        assert "risk_factors" in result.metadata

    @pytest.mark.asyncio
    async def test_calculate_compliance_rate(self, metrics_service):
        """Test calculating compliance rate"""
        metrics_service.contract_repository.get_compliance_stats = AsyncMock(
            return_value={
                "compliant": 945,
                "non_compliant": 55,
                "total": 1000
            }
        )

        result = await metrics_service.calculate_compliance_rate(
            tenant_id="tenant-123"
        )

        assert result.value == 94.5
        assert result.metric_type == MetricType.PERCENTAGE
        assert result.metadata["compliant_count"] == 945

    # Test User Activity Metrics

    @pytest.mark.asyncio
    async def test_calculate_user_activity(self, metrics_service, mock_user_repository):
        """Test calculating user activity metrics"""
        result = await metrics_service.calculate_user_activity(
            tenant_id="tenant-123",
            period_days=7
        )

        assert result["active_users"] == 127
        assert result["total_logins"] == 3456
        assert result["avg_session_duration"] == 1823
        mock_user_repository.get_active_users.assert_called_once()

    @pytest.mark.asyncio
    async def test_calculate_productivity_metrics(self, metrics_service):
        """Test calculating user productivity metrics"""
        metrics_service.user_repository.get_user_actions = AsyncMock(
            return_value={
                "contracts_created": 45,
                "contracts_reviewed": 123,
                "templates_used": 67,
                "avg_processing_time": 234  # seconds
            }
        )

        result = await metrics_service.calculate_productivity(
            tenant_id="tenant-123",
            user_id="user-456",
            period_days=30
        )

        assert result["contracts_per_day"] == pytest.approx(1.5, 0.1)
        assert result["efficiency_score"] > 0

    # Test Cost Savings Metrics

    @pytest.mark.asyncio
    async def test_calculate_cost_savings(self, metrics_service):
        """Test calculating cost savings from automation"""
        automation_stats = {
            "automated_reviews": 234,
            "time_saved_hours": 468,
            "manual_interventions_avoided": 189,
            "hourly_rate": 150
        }
        
        metrics_service.calculate_automation_stats = AsyncMock(
            return_value=automation_stats
        )

        result = await metrics_service.calculate_cost_savings(
            tenant_id="tenant-123",
            period_days=30
        )

        assert result.value == 70200  # 468 * 150
        assert result.metric_type == MetricType.CURRENCY
        assert result.metadata["time_saved_hours"] == 468

    @pytest.mark.asyncio
    async def test_calculate_roi(self, metrics_service):
        """Test calculating return on investment"""
        metrics_service.calculate_cost_savings = AsyncMock(
            return_value=CalculatedMetric(
                metric_id="cost_savings",
                value=250000,
                metric_type=MetricType.CURRENCY
            )
        )
        
        platform_cost = 50000  # Annual cost

        result = await metrics_service.calculate_roi(
            tenant_id="tenant-123",
            investment=platform_cost,
            period_days=365
        )

        assert result.value == 400  # (250000 - 50000) / 50000 * 100
        assert result.metric_type == MetricType.PERCENTAGE

    # Test Efficiency Metrics

    @pytest.mark.asyncio
    async def test_calculate_automation_rate(self, metrics_service):
        """Test calculating automation rate"""
        metrics_service.contract_repository.get_processing_stats = AsyncMock(
            return_value={
                "automated": 780,
                "manual": 220,
                "total": 1000
            }
        )

        result = await metrics_service.calculate_automation_rate(
            tenant_id="tenant-123"
        )

        assert result.value == 78.0
        assert result.metric_type == MetricType.PERCENTAGE

    @pytest.mark.asyncio
    async def test_calculate_error_rate(self, metrics_service):
        """Test calculating error rate in processing"""
        metrics_service.get_error_stats = AsyncMock(
            return_value={
                "errors": 15,
                "total_processed": 1000
            }
        )

        result = await metrics_service.calculate_error_rate(
            tenant_id="tenant-123",
            period_days=30
        )

        assert result.value == 1.5
        assert result.metric_type == MetricType.PERCENTAGE
        assert result.metadata["error_count"] == 15

    # Test Trending and Forecasting

    @pytest.mark.asyncio
    async def test_calculate_trend(self, metrics_service):
        """Test calculating metric trends"""
        historical_data = [
            {"date": "2024-01-01", "value": 100},
            {"date": "2024-01-02", "value": 110},
            {"date": "2024-01-03", "value": 105},
            {"date": "2024-01-04", "value": 115},
            {"date": "2024-01-05", "value": 120}
        ]
        
        metrics_service.get_historical_data = AsyncMock(return_value=historical_data)

        result = await metrics_service.calculate_trend(
            metric_id="contract_volume",
            tenant_id="tenant-123",
            period_days=5
        )

        assert result["trend_direction"] == "increasing"
        assert result["trend_strength"] > 0
        assert "slope" in result
        assert "r_squared" in result

    @pytest.mark.asyncio
    async def test_forecast_metric(self, metrics_service):
        """Test forecasting future metric values"""
        historical_data = [100, 110, 105, 115, 120, 125, 130]
        
        metrics_service.get_time_series_data = AsyncMock(return_value=historical_data)

        forecast = await metrics_service.forecast_metric(
            metric_id="contract_volume",
            tenant_id="tenant-123",
            days_ahead=7
        )

        assert len(forecast["predictions"]) == 7
        assert forecast["confidence_level"] > 0
        assert "upper_bound" in forecast
        assert "lower_bound" in forecast

    # Test Batch Calculations

    @pytest.mark.asyncio
    async def test_calculate_metrics_batch(self, metrics_service):
        """Test calculating multiple metrics in batch"""
        metric_requests = [
            MetricRequest(metric_id="contract_volume", tenant_id="tenant-123"),
            MetricRequest(metric_id="total_value", tenant_id="tenant-123"),
            MetricRequest(metric_id="compliance_rate", tenant_id="tenant-123")
        ]

        results = await metrics_service.calculate_batch(metric_requests)

        assert len(results) == 3
        assert all(isinstance(r, CalculatedMetric) for r in results)

    @pytest.mark.asyncio
    async def test_calculate_all_metrics(self, metrics_service):
        """Test calculating all metrics for a tenant"""
        results = await metrics_service.calculate_all_metrics(
            tenant_id="tenant-123",
            categories=["contracts", "compliance", "efficiency"]
        )

        assert "contracts" in results
        assert "compliance" in results
        assert "efficiency" in results
        assert len(results["contracts"]) > 0

    # Test Metric Aggregation

    @pytest.mark.asyncio
    async def test_aggregate_metrics_by_time(self, metrics_service):
        """Test aggregating metrics by time granularity"""
        raw_data = [
            {"timestamp": datetime(2024, 1, 1, 10), "value": 10},
            {"timestamp": datetime(2024, 1, 1, 14), "value": 15},
            {"timestamp": datetime(2024, 1, 2, 9), "value": 20},
            {"timestamp": datetime(2024, 1, 2, 16), "value": 25}
        ]

        aggregated = await metrics_service.aggregate_by_time(
            data=raw_data,
            granularity=TimeGranularity.DAILY,
            method=AggregationMethod.SUM
        )

        assert len(aggregated) == 2
        assert aggregated[0]["value"] == 25  # Day 1 sum
        assert aggregated[1]["value"] == 45  # Day 2 sum

    @pytest.mark.asyncio
    async def test_aggregate_metrics_by_dimension(self, metrics_service):
        """Test aggregating metrics by dimension"""
        data = [
            {"department": "Legal", "value": 100},
            {"department": "Legal", "value": 150},
            {"department": "Sales", "value": 200},
            {"department": "Sales", "value": 250}
        ]

        aggregated = await metrics_service.aggregate_by_dimension(
            data=data,
            dimension="department",
            method=AggregationMethod.AVERAGE
        )

        assert aggregated["Legal"] == 125
        assert aggregated["Sales"] == 225

    # Test Threshold and Alerts

    @pytest.mark.asyncio
    async def test_check_metric_thresholds(self, metrics_service):
        """Test checking metric against thresholds"""
        threshold = MetricThreshold(
            metric_id="compliance_rate",
            min_value=90,
            max_value=100,
            alert_on_breach=True
        )

        # Below threshold
        alert = await metrics_service.check_threshold(
            value=85,
            threshold=threshold
        )

        assert alert is not None
        assert alert.severity == "high"
        assert "below minimum" in alert.message

    @pytest.mark.asyncio
    async def test_generate_metric_alerts(self, metrics_service):
        """Test generating alerts for metric breaches"""
        metrics_service.get_active_thresholds = AsyncMock(return_value=[
            MetricThreshold(metric_id="compliance_rate", min_value=90),
            MetricThreshold(metric_id="error_rate", max_value=2)
        ])

        metrics_service.calculate_metric = AsyncMock(side_effect=[
            CalculatedMetric(metric_id="compliance_rate", value=85),
            CalculatedMetric(metric_id="error_rate", value=3)
        ])

        alerts = await metrics_service.generate_alerts(tenant_id="tenant-123")

        assert len(alerts) == 2
        assert all(isinstance(a, MetricAlert) for a in alerts)

    # Test Caching

    @pytest.mark.asyncio
    async def test_cache_calculated_metrics(self, metrics_service, mock_cache_service):
        """Test caching of calculated metrics"""
        metric = CalculatedMetric(
            metric_id="contract_volume",
            value=1542,
            metric_type=MetricType.COUNT
        )

        await metrics_service.cache_metric(
            metric=metric,
            tenant_id="tenant-123",
            ttl=300
        )

        mock_cache_service.set.assert_called_once()
        cache_key = mock_cache_service.set.call_args[0][0]
        assert "tenant-123" in cache_key
        assert "contract_volume" in cache_key

    @pytest.mark.asyncio
    async def test_get_cached_metric(self, metrics_service, mock_cache_service):
        """Test retrieving cached metrics"""
        cached_data = {
            "metric_id": "contract_volume",
            "value": 1542,
            "timestamp": datetime.utcnow().isoformat()
        }
        mock_cache_service.get.return_value = json.dumps(cached_data)

        result = await metrics_service.get_cached_metric(
            metric_id="contract_volume",
            tenant_id="tenant-123"
        )

        assert result is not None
        assert result["value"] == 1542

    # Test Historical Data

    @pytest.mark.asyncio
    async def test_save_metric_snapshot(self, metrics_service):
        """Test saving metric snapshot for historical tracking"""
        metrics = {
            "contract_volume": 1542,
            "total_value": 15420000,
            "compliance_rate": 94.5
        }

        snapshot_id = await metrics_service.save_snapshot(
            metrics=metrics,
            tenant_id="tenant-123"
        )

        assert snapshot_id is not None
        metrics_service.db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_get_metric_history(self, metrics_service):
        """Test retrieving metric history"""
        metrics_service.metric_repository = AsyncMock()
        metrics_service.metric_repository.get_history = AsyncMock(return_value=[
            {"date": "2024-01-01", "value": 100},
            {"date": "2024-01-02", "value": 110},
            {"date": "2024-01-03", "value": 105}
        ])

        history = await metrics_service.get_metric_history(
            metric_id="contract_volume",
            tenant_id="tenant-123",
            days=30
        )

        assert len(history) == 3
        assert history[1]["value"] == 110

    # Test Performance Benchmarking

    @pytest.mark.asyncio
    async def test_calculate_performance_score(self, metrics_service):
        """Test calculating overall performance score"""
        metric_weights = {
            "compliance_rate": 0.3,
            "automation_rate": 0.2,
            "cycle_time": 0.25,
            "error_rate": 0.15,
            "user_satisfaction": 0.1
        }

        metric_values = {
            "compliance_rate": 95,
            "automation_rate": 78,
            "cycle_time": 85,  # Normalized score
            "error_rate": 98,  # Inverted (100 - error%)
            "user_satisfaction": 88
        }

        metrics_service.get_normalized_metrics = AsyncMock(return_value=metric_values)

        score = await metrics_service.calculate_performance_score(
            tenant_id="tenant-123",
            weights=metric_weights
        )

        assert 0 <= score <= 100
        assert score == pytest.approx(89.3, 0.1)

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_metric_isolation(self, metrics_service):
        """Test that metrics are isolated between tenants"""
        # Calculate for tenant A
        result_a = await metrics_service.calculate_metric(
            metric_id="contract_volume",
            tenant_id="tenant-A"
        )

        # Calculate for tenant B
        result_b = await metrics_service.calculate_metric(
            metric_id="contract_volume",
            tenant_id="tenant-B"
        )

        # Verify separate calculations
        assert metrics_service.contract_repository.get_count.call_count == 2
        calls = metrics_service.contract_repository.get_count.call_args_list
        assert calls[0][1]["tenant_id"] == "tenant-A"
        assert calls[1][1]["tenant_id"] == "tenant-B"

    # Test Error Handling

    @pytest.mark.asyncio
    async def test_handle_calculation_error(self, metrics_service):
        """Test error handling during metric calculation"""
        metrics_service.contract_repository.get_count.side_effect = Exception(
            "Database connection failed"
        )

        with pytest.raises(MetricError) as exc_info:
            await metrics_service.calculate_contract_volume(tenant_id="tenant-123")

        assert "Failed to calculate metric" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_handle_invalid_metric_type(self, metrics_service):
        """Test handling of invalid metric type"""
        with pytest.raises(ValueError) as exc_info:
            await metrics_service.calculate_metric(
                metric_id="invalid_metric",
                tenant_id="tenant-123"
            )

        assert "Unknown metric" in str(exc_info.value)