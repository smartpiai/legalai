"""
Legal Operations Dashboard Service Tests
Following TDD - RED phase: Comprehensive test suite for legal operations dashboard
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.legal_operations_dashboard import (
    LegalOperationsDashboardService,
    DashboardWidget,
    DashboardLayout,
    DashboardData,
    DashboardFilter,
    WidgetType,
    DataSource,
    AggregationType,
    TimeRange,
    ChartType,
    DashboardAlert,
    WidgetConfiguration,
    DashboardMetrics,
    RefreshRate,
    DashboardInsight
)
from app.models.dashboard import Dashboard, Widget, Layout
from app.core.exceptions import ValidationError, DataError, ConfigurationError


class TestLegalOperationsDashboardService:
    """Test suite for legal operations dashboard service"""

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
    def mock_analytics_service(self):
        """Mock analytics service"""
        service = AsyncMock()
        service.get_metrics = AsyncMock()
        service.calculate_kpis = AsyncMock()
        service.get_trends = AsyncMock()
        return service

    @pytest.fixture
    def mock_data_service(self):
        """Mock data service"""
        service = AsyncMock()
        service.fetch_data = AsyncMock()
        service.aggregate_data = AsyncMock()
        service.process_timeseries = AsyncMock()
        return service

    @pytest.fixture
    def dashboard_service(
        self,
        mock_postgres,
        mock_redis,
        mock_analytics_service,
        mock_data_service
    ):
        """Create dashboard service instance"""
        return LegalOperationsDashboardService(
            postgres=mock_postgres,
            redis=mock_redis,
            analytics_service=mock_analytics_service,
            data_service=mock_data_service
        )

    @pytest.fixture
    def sample_widget(self):
        """Sample dashboard widget"""
        return DashboardWidget(
            id="widget-123",
            type=WidgetType.CHART,
            title="Contract Volume Trend",
            data_source=DataSource.CONTRACTS,
            chart_type=ChartType.LINE,
            metrics=["contract_count", "contract_value"],
            time_range=TimeRange.LAST_30_DAYS,
            refresh_rate=RefreshRate.HOURLY
        )

    @pytest.fixture
    def sample_layout(self):
        """Sample dashboard layout"""
        return DashboardLayout(
            id="layout-123",
            name="Executive Dashboard",
            widgets=[
                {"widget_id": "widget-1", "x": 0, "y": 0, "w": 6, "h": 4},
                {"widget_id": "widget-2", "x": 6, "y": 0, "w": 6, "h": 4}
            ],
            is_default=True
        )

    # Test Dashboard Management

    @pytest.mark.asyncio
    async def test_create_dashboard(self, dashboard_service):
        """Test creating a new dashboard"""
        result = await dashboard_service.create_dashboard(
            name="Legal Operations Overview",
            description="Main operational dashboard",
            is_default=True,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.name == "Legal Operations Overview"
        assert result.is_default is True

    @pytest.mark.asyncio
    async def test_get_dashboard(self, dashboard_service):
        """Test retrieving dashboard by ID"""
        dashboard = await dashboard_service.get_dashboard(
            dashboard_id="dash-123",
            tenant_id="tenant-123"
        )
        
        assert dashboard is not None
        assert dashboard.widgets is not None

    @pytest.mark.asyncio
    async def test_list_dashboards(self, dashboard_service):
        """Test listing all dashboards"""
        dashboards = await dashboard_service.list_dashboards(
            tenant_id="tenant-123"
        )
        
        assert isinstance(dashboards, list)
        assert all(d.tenant_id == "tenant-123" for d in dashboards)

    @pytest.mark.asyncio
    async def test_update_dashboard(self, dashboard_service):
        """Test updating dashboard configuration"""
        updated = await dashboard_service.update_dashboard(
            dashboard_id="dash-123",
            name="Updated Dashboard",
            theme="dark",
            tenant_id="tenant-123"
        )
        
        assert updated.name == "Updated Dashboard"
        assert updated.theme == "dark"

    # Test Widget Management

    @pytest.mark.asyncio
    async def test_add_widget(self, dashboard_service, sample_widget):
        """Test adding widget to dashboard"""
        result = await dashboard_service.add_widget(
            dashboard_id="dash-123",
            widget=sample_widget,
            tenant_id="tenant-123"
        )
        
        assert result.widget_id is not None
        assert result.dashboard_id == "dash-123"

    @pytest.mark.asyncio
    async def test_configure_widget(self, dashboard_service):
        """Test configuring widget settings"""
        config = WidgetConfiguration(
            chart_type=ChartType.BAR,
            colors=["#1f77b4", "#ff7f0e"],
            show_legend=True,
            show_grid=True
        )
        
        result = await dashboard_service.configure_widget(
            widget_id="widget-123",
            configuration=config,
            tenant_id="tenant-123"
        )
        
        assert result.configuration == config

    @pytest.mark.asyncio
    async def test_remove_widget(self, dashboard_service):
        """Test removing widget from dashboard"""
        result = await dashboard_service.remove_widget(
            dashboard_id="dash-123",
            widget_id="widget-123",
            tenant_id="tenant-123"
        )
        
        assert result is True

    @pytest.mark.asyncio
    async def test_reorder_widgets(self, dashboard_service):
        """Test reordering widgets in dashboard"""
        new_order = ["widget-3", "widget-1", "widget-2"]
        
        result = await dashboard_service.reorder_widgets(
            dashboard_id="dash-123",
            widget_order=new_order,
            tenant_id="tenant-123"
        )
        
        assert result.widget_order == new_order

    # Test Data Retrieval

    @pytest.mark.asyncio
    async def test_get_widget_data(self, dashboard_service):
        """Test fetching data for a widget"""
        data = await dashboard_service.get_widget_data(
            widget_id="widget-123",
            filters=DashboardFilter(
                date_range=TimeRange.LAST_7_DAYS,
                departments=["legal", "compliance"]
            ),
            tenant_id="tenant-123"
        )
        
        assert isinstance(data, DashboardData)
        assert data.values is not None

    @pytest.mark.asyncio
    async def test_get_dashboard_metrics(self, dashboard_service):
        """Test fetching all metrics for dashboard"""
        metrics = await dashboard_service.get_dashboard_metrics(
            dashboard_id="dash-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(metrics, DashboardMetrics)
        assert metrics.total_contracts >= 0
        assert metrics.active_workflows >= 0

    @pytest.mark.asyncio
    async def test_get_kpi_summary(self, dashboard_service):
        """Test getting KPI summary"""
        kpis = await dashboard_service.get_kpi_summary(
            time_range=TimeRange.CURRENT_QUARTER,
            tenant_id="tenant-123"
        )
        
        assert "contract_cycle_time" in kpis
        assert "compliance_rate" in kpis
        assert "cost_savings" in kpis

    @pytest.mark.asyncio
    async def test_get_real_time_updates(self, dashboard_service):
        """Test real-time data updates"""
        updates = await dashboard_service.get_real_time_updates(
            dashboard_id="dash-123",
            last_update=datetime.utcnow() - timedelta(minutes=5),
            tenant_id="tenant-123"
        )
        
        assert isinstance(updates, list)
        assert all(u.timestamp > datetime.utcnow() - timedelta(minutes=5) for u in updates)

    # Test Chart Data

    @pytest.mark.asyncio
    async def test_get_line_chart_data(self, dashboard_service):
        """Test fetching line chart data"""
        data = await dashboard_service.get_chart_data(
            chart_type=ChartType.LINE,
            metrics=["contract_value", "contract_count"],
            time_range=TimeRange.LAST_30_DAYS,
            tenant_id="tenant-123"
        )
        
        assert "series" in data
        assert len(data["series"]) == 2

    @pytest.mark.asyncio
    async def test_get_bar_chart_data(self, dashboard_service):
        """Test fetching bar chart data"""
        data = await dashboard_service.get_chart_data(
            chart_type=ChartType.BAR,
            metrics=["contracts_by_type"],
            group_by="contract_type",
            tenant_id="tenant-123"
        )
        
        assert "categories" in data
        assert "values" in data

    @pytest.mark.asyncio
    async def test_get_pie_chart_data(self, dashboard_service):
        """Test fetching pie chart data"""
        data = await dashboard_service.get_chart_data(
            chart_type=ChartType.PIE,
            metrics=["contracts_by_status"],
            tenant_id="tenant-123"
        )
        
        assert "labels" in data
        assert "values" in data
        assert len(data["labels"]) == len(data["values"])

    @pytest.mark.asyncio
    async def test_get_heatmap_data(self, dashboard_service):
        """Test fetching heatmap data"""
        data = await dashboard_service.get_chart_data(
            chart_type=ChartType.HEATMAP,
            metrics=["risk_matrix"],
            tenant_id="tenant-123"
        )
        
        assert "matrix" in data
        assert isinstance(data["matrix"], list)

    # Test Filters and Aggregations

    @pytest.mark.asyncio
    async def test_apply_dashboard_filters(self, dashboard_service):
        """Test applying filters to dashboard"""
    filters = DashboardFilter(
            date_range=TimeRange.CUSTOM,
            start_date=datetime.utcnow() - timedelta(days=90),
            end_date=datetime.utcnow(),
            departments=["legal"],
            contract_types=["NDA", "MSA"],
            users=["user-123"]
        )
        
        result = await dashboard_service.apply_filters(
            dashboard_id="dash-123",
            filters=filters,
            tenant_id="tenant-123"
        )
        
        assert result.active_filters == filters

    @pytest.mark.asyncio
    async def test_aggregate_data(self, dashboard_service):
        """Test data aggregation"""
        aggregated = await dashboard_service.aggregate_data(
            data_source=DataSource.CONTRACTS,
            aggregation_type=AggregationType.SUM,
            group_by="month",
            metrics=["contract_value"],
            tenant_id="tenant-123"
        )
        
        assert isinstance(aggregated, dict)
        assert "aggregated_values" in aggregated

    @pytest.mark.asyncio
    async def test_calculate_trends(self, dashboard_service):
        """Test trend calculation"""
        trends = await dashboard_service.calculate_trends(
            metric="contract_volume",
            time_periods=12,
            period_type="month",
            tenant_id="tenant-123"
        )
        
        assert "trend_direction" in trends
        assert "percentage_change" in trends

    # Test Insights and Analytics

    @pytest.mark.asyncio
    async def test_generate_insights(self, dashboard_service):
        """Test generating dashboard insights"""
        insights = await dashboard_service.generate_insights(
            dashboard_id="dash-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(insights, list)
        assert all(isinstance(i, DashboardInsight) for i in insights)

    @pytest.mark.asyncio
    async def test_detect_anomalies(self, dashboard_service):
        """Test anomaly detection in metrics"""
        anomalies = await dashboard_service.detect_anomalies(
            metrics=["contract_cycle_time", "approval_rate"],
            sensitivity=0.8,
            tenant_id="tenant-123"
        )
        
        assert isinstance(anomalies, list)
        assert all("metric" in a for a in anomalies)

    @pytest.mark.asyncio
    async def test_forecast_metrics(self, dashboard_service):
        """Test metric forecasting"""
        forecast = await dashboard_service.forecast_metrics(
            metric="contract_volume",
            periods_ahead=6,
            confidence_level=0.95,
            tenant_id="tenant-123"
        )
        
        assert "predicted_values" in forecast
        assert "confidence_intervals" in forecast

    # Test Alerts and Notifications

    @pytest.mark.asyncio
    async def test_create_dashboard_alert(self, dashboard_service):
        """Test creating dashboard alert"""
        alert = DashboardAlert(
            name="High Risk Contracts",
            condition="risk_score > 8",
            threshold=10,
            notification_channels=["email", "slack"]
        )
        
        result = await dashboard_service.create_alert(
            dashboard_id="dash-123",
            alert=alert,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_check_alert_conditions(self, dashboard_service):
        """Test checking alert conditions"""
        triggered = await dashboard_service.check_alert_conditions(
            dashboard_id="dash-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(triggered, list)
        assert all(t.alert_id is not None for t in triggered)

    # Test Export and Sharing

    @pytest.mark.asyncio
    async def test_export_dashboard(self, dashboard_service):
        """Test exporting dashboard"""
        export = await dashboard_service.export_dashboard(
            dashboard_id="dash-123",
            format="pdf",
            include_data=True,
            tenant_id="tenant-123"
        )
        
        assert export.file_path is not None
        assert export.format == "pdf"

    @pytest.mark.asyncio
    async def test_share_dashboard(self, dashboard_service):
        """Test sharing dashboard"""
        share_link = await dashboard_service.share_dashboard(
            dashboard_id="dash-123",
            recipients=["user@example.com"],
            permissions=["view"],
            expiry_days=7,
            tenant_id="tenant-123"
        )
        
        assert share_link.url is not None
        assert share_link.expires_at is not None

    @pytest.mark.asyncio
    async def test_schedule_dashboard_report(self, dashboard_service):
        """Test scheduling dashboard reports"""
        schedule = await dashboard_service.schedule_report(
            dashboard_id="dash-123",
            frequency="weekly",
            recipients=["team@example.com"],
            format="excel",
            tenant_id="tenant-123"
        )
        
        assert schedule.id is not None
        assert schedule.next_run is not None

    # Test Customization

    @pytest.mark.asyncio
    async def test_customize_theme(self, dashboard_service):
        """Test customizing dashboard theme"""
        theme = await dashboard_service.customize_theme(
            dashboard_id="dash-123",
            primary_color="#1a73e8",
            dark_mode=True,
            font_family="Inter",
            tenant_id="tenant-123"
        )
        
        assert theme.primary_color == "#1a73e8"
        assert theme.dark_mode is True

    @pytest.mark.asyncio
    async def test_save_layout(self, dashboard_service, sample_layout):
        """Test saving dashboard layout"""
        result = await dashboard_service.save_layout(
            dashboard_id="dash-123",
            layout=sample_layout,
            tenant_id="tenant-123"
        )
        
        assert result.layout_id is not None

    @pytest.mark.asyncio
    async def test_duplicate_dashboard(self, dashboard_service):
        """Test duplicating dashboard"""
        duplicate = await dashboard_service.duplicate_dashboard(
            dashboard_id="dash-123",
            new_name="Copy of Dashboard",
            tenant_id="tenant-123"
        )
        
        assert duplicate.id != "dash-123"
        assert duplicate.name == "Copy of Dashboard"

    # Test Performance

    @pytest.mark.asyncio
    async def test_optimize_queries(self, dashboard_service):
        """Test query optimization for dashboard"""
        optimized = await dashboard_service.optimize_queries(
            dashboard_id="dash-123",
            tenant_id="tenant-123"
        )
        
        assert optimized.query_time_reduced > 0
        assert optimized.cache_hits > 0

    @pytest.mark.asyncio
    async def test_preload_dashboard_data(self, dashboard_service):
        """Test preloading dashboard data"""
        preloaded = await dashboard_service.preload_data(
            dashboard_id="dash-123",
            tenant_id="tenant-123"
        )
        
        assert preloaded.widgets_loaded > 0
        assert preloaded.load_time_ms > 0

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_dashboard_isolation(self, dashboard_service):
        """Test dashboard isolation between tenants"""
        # Create dashboard for tenant A
        dash_a = await dashboard_service.create_dashboard(
            name="Tenant A Dashboard",
            tenant_id="tenant-A"
        )
        
        # Try to access from tenant B
        dash_b = await dashboard_service.get_dashboard(
            dashboard_id=dash_a.id,
            tenant_id="tenant-B"
        )
        
        assert dash_b is None

    @pytest.mark.asyncio
    async def test_tenant_widget_isolation(self, dashboard_service, sample_widget):
        """Test widget data isolation between tenants"""
        # Add widget for tenant A
        widget_a = await dashboard_service.add_widget(
            dashboard_id="dash-A",
            widget=sample_widget,
            tenant_id="tenant-A"
        )
        
        # Try to get widget data from tenant B
        data_b = await dashboard_service.get_widget_data(
            widget_id=widget_a.widget_id,
            tenant_id="tenant-B"
        )
        
        assert data_b is None or data_b.values == []