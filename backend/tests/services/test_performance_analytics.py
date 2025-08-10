"""
Performance Analytics Service Tests
Following TDD - RED phase: Comprehensive test suite for performance analytics service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.performance_analytics import (
    PerformanceAnalyticsService,
    PerformanceMetric,
    PerformanceThreshold,
    PerformanceGoal,
    PerformanceBenchmark,
    PerformanceAlert,
    PerformanceReport,
    TrendAnalysis,
    AnomalyDetection,
    PredictiveAnalysis,
    ComparativeAnalysis,
    MetricType,
    TimeGranularity,
    ComparisonType,
    AlertSeverity
)
from app.models.analytics import PerformanceData, Analytics, Benchmark
from app.schemas.analytics import (
    PerformanceRequest,
    PerformanceResponse,
    TrendResponse,
    BenchmarkResponse,
    AlertResponse
)


class TestPerformanceAnalyticsService:
    """Test suite for performance analytics service"""

    @pytest.fixture
    def mock_database(self):
        """Mock database connection"""
        db = AsyncMock()
        db.execute = AsyncMock()
        db.query = AsyncMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def mock_cache_service(self):
        """Mock cache service"""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock()
        cache.delete = AsyncMock()
        return cache

    @pytest.fixture
    def mock_metrics_service(self):
        """Mock metrics calculation service"""
        service = AsyncMock()
        service.calculate_metrics = AsyncMock()
        service.get_historical_metrics = AsyncMock()
        return service

    @pytest.fixture
    def mock_notification_service(self):
        """Mock notification service"""
        service = AsyncMock()
        service.send_alert = AsyncMock()
        service.send_report = AsyncMock()
        return service

    @pytest.fixture
    def performance_service(
        self,
        mock_database,
        mock_cache_service,
        mock_metrics_service,
        mock_notification_service
    ):
        """Create performance analytics service instance"""
        return PerformanceAnalyticsService(
            db=mock_database,
            cache_service=mock_cache_service,
            metrics_service=mock_metrics_service,
            notification_service=mock_notification_service
        )

    @pytest.fixture
    def sample_metrics(self):
        """Sample performance metrics"""
        return [
            PerformanceMetric(
                id="metric-1",
                name="Contract Processing Time",
                type=MetricType.LATENCY,
                value=2.5,
                unit="seconds",
                timestamp=datetime.utcnow()
            ),
            PerformanceMetric(
                id="metric-2",
                name="System Throughput",
                type=MetricType.THROUGHPUT,
                value=150,
                unit="requests/minute",
                timestamp=datetime.utcnow()
            ),
            PerformanceMetric(
                id="metric-3",
                name="Error Rate",
                type=MetricType.ERROR_RATE,
                value=0.5,
                unit="percentage",
                timestamp=datetime.utcnow()
            )
        ]

    # Test Performance Tracking

    @pytest.mark.asyncio
    async def test_track_performance_metric(self, performance_service):
        """Test tracking a performance metric"""
        metric = PerformanceMetric(
            name="API Response Time",
            type=MetricType.LATENCY,
            value=150,
            unit="ms",
            timestamp=datetime.utcnow()
        )
        
        result = await performance_service.track_metric(
            metric=metric,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.name == "API Response Time"
        assert result.value == 150

    @pytest.mark.asyncio
    async def test_batch_track_metrics(self, performance_service, sample_metrics):
        """Test batch tracking of metrics"""
        results = await performance_service.batch_track_metrics(
            metrics=sample_metrics,
            tenant_id="tenant-123"
        )
        
        assert len(results) == 3
        assert all(r.id is not None for r in results)

    @pytest.mark.asyncio
    async def test_get_performance_metrics(self, performance_service):
        """Test retrieving performance metrics"""
        metrics = await performance_service.get_metrics(
            metric_types=[MetricType.LATENCY, MetricType.THROUGHPUT],
            start_date=datetime.utcnow() - timedelta(days=7),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert isinstance(metrics, list)
        assert all(isinstance(m, PerformanceMetric) for m in metrics)

    @pytest.mark.asyncio
    async def test_aggregate_metrics(self, performance_service):
        """Test aggregating metrics by time period"""
        aggregated = await performance_service.aggregate_metrics(
            metric_type=MetricType.LATENCY,
            granularity=TimeGranularity.HOURLY,
            aggregation="avg",
            start_date=datetime.utcnow() - timedelta(days=1),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert "intervals" in aggregated
        assert "values" in aggregated
        assert len(aggregated["intervals"]) == len(aggregated["values"])

    # Test Threshold Management

    @pytest.mark.asyncio
    async def test_set_performance_threshold(self, performance_service):
        """Test setting performance thresholds"""
        threshold = PerformanceThreshold(
            metric_name="API Response Time",
            warning_value=500,
            critical_value=1000,
            unit="ms",
            enabled=True
        )
        
        result = await performance_service.set_threshold(
            threshold=threshold,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.warning_value == 500
        assert result.critical_value == 1000

    @pytest.mark.asyncio
    async def test_check_threshold_violations(self, performance_service):
        """Test checking for threshold violations"""
        violations = await performance_service.check_violations(
            tenant_id="tenant-123"
        )
        
        assert isinstance(violations, list)
        for violation in violations:
            assert "metric" in violation
            assert "threshold" in violation
            assert "severity" in violation

    @pytest.mark.asyncio
    async def test_auto_adjust_thresholds(self, performance_service):
        """Test auto-adjusting thresholds based on historical data"""
        adjusted = await performance_service.auto_adjust_thresholds(
            lookback_days=30,
            percentile=95,
            tenant_id="tenant-123"
        )
        
        assert isinstance(adjusted, list)
        for threshold in adjusted:
            assert threshold.warning_value > 0
            assert threshold.critical_value > threshold.warning_value

    # Test Goal Management

    @pytest.mark.asyncio
    async def test_set_performance_goal(self, performance_service):
        """Test setting performance goals"""
        goal = PerformanceGoal(
            name="Reduce Response Time",
            metric_name="API Response Time",
            target_value=200,
            current_value=350,
            deadline=datetime.utcnow() + timedelta(days=30),
            unit="ms"
        )
        
        result = await performance_service.set_goal(
            goal=goal,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.progress_percentage == 0  # Not yet achieved

    @pytest.mark.asyncio
    async def test_track_goal_progress(self, performance_service):
        """Test tracking progress towards goals"""
        progress = await performance_service.track_goal_progress(
            goal_id="goal-123",
            tenant_id="tenant-123"
        )
        
        assert "goal" in progress
        assert "current_value" in progress
        assert "progress_percentage" in progress
        assert "on_track" in progress
        assert "estimated_completion" in progress

    @pytest.mark.asyncio
    async def test_get_active_goals(self, performance_service):
        """Test getting all active performance goals"""
        goals = await performance_service.get_active_goals(
            tenant_id="tenant-123"
        )
        
        assert isinstance(goals, list)
        assert all(isinstance(g, PerformanceGoal) for g in goals)

    # Test Trend Analysis

    @pytest.mark.asyncio
    async def test_analyze_performance_trends(self, performance_service):
        """Test analyzing performance trends"""
        trends = await performance_service.analyze_trends(
            metric_type=MetricType.LATENCY,
            period_days=30,
            tenant_id="tenant-123"
        )
        
        assert isinstance(trends, TrendAnalysis)
        assert trends.trend_direction in ["improving", "degrading", "stable"]
        assert trends.change_percentage is not None
        assert trends.forecast is not None

    @pytest.mark.asyncio
    async def test_detect_seasonality(self, performance_service):
        """Test detecting seasonal patterns"""
        seasonality = await performance_service.detect_seasonality(
            metric_type=MetricType.THROUGHPUT,
            lookback_days=90,
            tenant_id="tenant-123"
        )
        
        assert "has_seasonality" in seasonality
        assert "pattern_type" in seasonality
        assert "peak_periods" in seasonality
        assert "low_periods" in seasonality

    @pytest.mark.asyncio
    async def test_forecast_performance(self, performance_service):
        """Test forecasting future performance"""
        forecast = await performance_service.forecast(
            metric_type=MetricType.LATENCY,
            forecast_days=7,
            confidence_level=0.95,
            tenant_id="tenant-123"
        )
        
        assert "predictions" in forecast
        assert "confidence_intervals" in forecast
        assert len(forecast["predictions"]) == 7

    # Test Anomaly Detection

    @pytest.mark.asyncio
    async def test_detect_anomalies(self, performance_service):
        """Test detecting performance anomalies"""
        anomalies = await performance_service.detect_anomalies(
            metric_type=MetricType.ERROR_RATE,
            sensitivity="medium",
            lookback_hours=24,
            tenant_id="tenant-123"
        )
        
        assert isinstance(anomalies, list)
        for anomaly in anomalies:
            assert isinstance(anomaly, AnomalyDetection)
            assert anomaly.severity in ["low", "medium", "high"]

    @pytest.mark.asyncio
    async def test_classify_anomaly_patterns(self, performance_service):
        """Test classifying anomaly patterns"""
        patterns = await performance_service.classify_anomaly_patterns(
            anomalies=[],  # Would contain detected anomalies
            tenant_id="tenant-123"
        )
        
        assert "spike" in patterns
        assert "gradual_degradation" in patterns
        assert "sudden_drop" in patterns
        assert "oscillation" in patterns

    @pytest.mark.asyncio
    async def test_root_cause_analysis(self, performance_service):
        """Test root cause analysis for performance issues"""
        root_causes = await performance_service.analyze_root_causes(
            anomaly_id="anomaly-123",
            tenant_id="tenant-123"
        )
        
        assert "probable_causes" in root_causes
        assert "correlated_events" in root_causes
        assert "recommendations" in root_causes

    # Test Benchmarking

    @pytest.mark.asyncio
    async def test_set_benchmark(self, performance_service):
        """Test setting performance benchmarks"""
        benchmark = PerformanceBenchmark(
            name="Industry Average Response Time",
            metric_type=MetricType.LATENCY,
            value=250,
            unit="ms",
            source="Industry Report 2024"
        )
        
        result = await performance_service.set_benchmark(
            benchmark=benchmark,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.value == 250

    @pytest.mark.asyncio
    async def test_compare_to_benchmarks(self, performance_service):
        """Test comparing performance to benchmarks"""
        comparison = await performance_service.compare_to_benchmarks(
            metric_type=MetricType.LATENCY,
            tenant_id="tenant-123"
        )
        
        assert isinstance(comparison, ComparativeAnalysis)
        assert comparison.comparison_type == ComparisonType.BENCHMARK
        assert comparison.difference_percentage is not None
        assert comparison.performance_rating in ["excellent", "good", "average", "poor"]

    @pytest.mark.asyncio
    async def test_industry_percentile(self, performance_service):
        """Test calculating industry percentile ranking"""
        percentile = await performance_service.get_industry_percentile(
            metric_type=MetricType.THROUGHPUT,
            tenant_id="tenant-123"
        )
        
        assert 0 <= percentile <= 100
        assert isinstance(percentile, float)

    # Test Alerting

    @pytest.mark.asyncio
    async def test_create_performance_alert(self, performance_service):
        """Test creating performance alerts"""
        alert = PerformanceAlert(
            title="High Response Time",
            description="API response time exceeded threshold",
            severity=AlertSeverity.WARNING,
            metric_name="API Response Time",
            current_value=750,
            threshold_value=500
        )
        
        result = await performance_service.create_alert(
            alert=alert,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.acknowledged is False

    @pytest.mark.asyncio
    async def test_acknowledge_alert(self, performance_service):
        """Test acknowledging performance alerts"""
        result = await performance_service.acknowledge_alert(
            alert_id="alert-123",
            user_id="user-456",
            notes="Investigating the issue",
            tenant_id="tenant-123"
        )
        
        assert result.acknowledged is True
        assert result.acknowledged_by == "user-456"

    @pytest.mark.asyncio
    async def test_get_active_alerts(self, performance_service):
        """Test getting active performance alerts"""
        alerts = await performance_service.get_active_alerts(
            severity_filter=[AlertSeverity.WARNING, AlertSeverity.CRITICAL],
            tenant_id="tenant-123"
        )
        
        assert isinstance(alerts, list)
        assert all(not a.acknowledged for a in alerts)

    # Test Reporting

    @pytest.mark.asyncio
    async def test_generate_performance_report(self, performance_service):
        """Test generating performance reports"""
        report = await performance_service.generate_report(
            report_type="weekly",
            start_date=datetime.utcnow() - timedelta(days=7),
            end_date=datetime.utcnow(),
            include_trends=True,
            include_anomalies=True,
            tenant_id="tenant-123"
        )
        
        assert isinstance(report, PerformanceReport)
        assert report.summary is not None
        assert report.metrics is not None
        assert report.trends is not None

    @pytest.mark.asyncio
    async def test_executive_summary(self, performance_service):
        """Test generating executive summary"""
        summary = await performance_service.generate_executive_summary(
            period_days=30,
            tenant_id="tenant-123"
        )
        
        assert "overall_health" in summary
        assert "key_achievements" in summary
        assert "areas_of_concern" in summary
        assert "recommendations" in summary

    @pytest.mark.asyncio
    async def test_sla_compliance_report(self, performance_service):
        """Test generating SLA compliance report"""
        sla_report = await performance_service.generate_sla_report(
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert "compliance_percentage" in sla_report
        assert "violations" in sla_report
        assert "metrics_breakdown" in sla_report

    # Test Optimization Recommendations

    @pytest.mark.asyncio
    async def test_get_optimization_recommendations(self, performance_service):
        """Test getting optimization recommendations"""
        recommendations = await performance_service.get_recommendations(
            metric_type=MetricType.LATENCY,
            tenant_id="tenant-123"
        )
        
        assert isinstance(recommendations, list)
        for rec in recommendations:
            assert "title" in rec
            assert "description" in rec
            assert "expected_improvement" in rec
            assert "priority" in rec

    @pytest.mark.asyncio
    async def test_capacity_planning(self, performance_service):
        """Test capacity planning recommendations"""
        capacity_plan = await performance_service.plan_capacity(
            growth_rate=0.2,  # 20% growth
            planning_horizon_months=6,
            tenant_id="tenant-123"
        )
        
        assert "current_capacity" in capacity_plan
        assert "projected_demand" in capacity_plan
        assert "recommended_scaling" in capacity_plan
        assert "cost_estimate" in capacity_plan

    @pytest.mark.asyncio
    async def test_bottleneck_analysis(self, performance_service):
        """Test identifying performance bottlenecks"""
        bottlenecks = await performance_service.identify_bottlenecks(
            tenant_id="tenant-123"
        )
        
        assert isinstance(bottlenecks, list)
        for bottleneck in bottlenecks:
            assert "component" in bottleneck
            assert "impact_score" in bottleneck
            assert "recommended_action" in bottleneck

    # Test Real-time Monitoring

    @pytest.mark.asyncio
    async def test_get_realtime_metrics(self, performance_service):
        """Test getting real-time metrics"""
        realtime = await performance_service.get_realtime_metrics(
            metric_types=[MetricType.LATENCY, MetricType.THROUGHPUT],
            window_seconds=60,
            tenant_id="tenant-123"
        )
        
        assert "metrics" in realtime
        assert "timestamp" in realtime
        assert "update_interval" in realtime

    @pytest.mark.asyncio
    async def test_subscribe_to_metrics(self, performance_service):
        """Test subscribing to metric updates"""
        subscription = await performance_service.subscribe_to_metrics(
            metric_types=[MetricType.ERROR_RATE],
            callback=lambda x: None,
            tenant_id="tenant-123"
        )
        
        assert subscription.id is not None
        assert subscription.active is True

    @pytest.mark.asyncio
    async def test_health_score_calculation(self, performance_service):
        """Test calculating overall system health score"""
        health_score = await performance_service.calculate_health_score(
            tenant_id="tenant-123"
        )
        
        assert 0 <= health_score["score"] <= 100
        assert "components" in health_score
        assert "status" in health_score  # healthy, warning, critical

    # Test Data Export

    @pytest.mark.asyncio
    async def test_export_performance_data(self, performance_service):
        """Test exporting performance data"""
        export_data = await performance_service.export_data(
            format="csv",
            metric_types=[MetricType.LATENCY],
            start_date=datetime.utcnow() - timedelta(days=7),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert export_data["format"] == "csv"
        assert "data" in export_data
        assert "filename" in export_data

    @pytest.mark.asyncio
    async def test_api_analytics_integration(self, performance_service):
        """Test API analytics integration"""
        api_metrics = await performance_service.get_api_analytics(
            endpoint_pattern="/api/v1/contracts/*",
            period_hours=24,
            tenant_id="tenant-123"
        )
        
        assert "request_count" in api_metrics
        assert "average_latency" in api_metrics
        assert "error_rate" in api_metrics
        assert "top_endpoints" in api_metrics

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_performance_isolation(self, performance_service):
        """Test that performance data is isolated between tenants"""
        # Track metric for tenant A
        metric_a = await performance_service.track_metric(
            metric=PerformanceMetric(
                name="Test Metric",
                type=MetricType.LATENCY,
                value=100,
                unit="ms"
            ),
            tenant_id="tenant-A"
        )
        
        # Try to access from tenant B
        metrics_b = await performance_service.get_metrics(
            metric_types=[MetricType.LATENCY],
            start_date=datetime.utcnow() - timedelta(hours=1),
            end_date=datetime.utcnow(),
            tenant_id="tenant-B"
        )
        
        # Should not see tenant A's metrics
        assert not any(m.id == metric_a.id for m in metrics_b)