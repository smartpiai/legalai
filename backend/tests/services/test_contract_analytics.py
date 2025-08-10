"""
Contract Analytics Service Tests
Following TDD - RED phase: Comprehensive test suite for contract analytics and business intelligence
"""

import pytest
import asyncio
from datetime import datetime, timedelta, date
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional
from uuid import uuid4
from decimal import Decimal

from app.services.contract_analytics import (
    ContractAnalyticsService,
    ContractMetrics,
    VendorPerformance,
    RiskMetrics,
    ComplianceMetrics,
    SpendAnalytics,
    ContractTrend,
    AnalyticsFilter,
    TimeRange,
    AggregationLevel,
    MetricType,
    AnalyticsResult,
    VolumeAnalytics,
    ValueAnalytics,
    CycleTimeAnalytics,
    RenewalAnalytics,
    DepartmentAnalytics,
    CategoryAnalytics,
    GeographicAnalytics,
    PerformanceAnalytics,
    BenchmarkAnalytics,
    PredictiveAnalytics
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
def sample_contracts():
    """Sample contract data for analytics"""
    return [
        {
            "id": str(uuid4()),
            "title": "Software License Agreement",
            "contract_type": "software_license",
            "status": "active",
            "value": Decimal("50000.00"),
            "start_date": datetime(2023, 1, 1),
            "end_date": datetime(2023, 12, 31),
            "renewal_date": datetime(2023, 12, 31),
            "department": "IT",
            "vendor": "TechCorp Inc",
            "risk_level": "medium",
            "created_at": datetime(2023, 1, 1),
            "approved_at": datetime(2023, 1, 15),
            "signed_at": datetime(2023, 1, 20),
            "auto_renew": True,
            "currency": "USD",
            "jurisdiction": "New York",
            "category": "Technology"
        },
        {
            "id": str(uuid4()),
            "title": "Service Agreement",
            "contract_type": "service_agreement",
            "status": "pending",
            "value": Decimal("25000.00"),
            "start_date": datetime(2023, 6, 1),
            "end_date": datetime(2024, 6, 1),
            "renewal_date": datetime(2024, 6, 1),
            "department": "Marketing",
            "vendor": "ServicePro LLC",
            "risk_level": "low",
            "created_at": datetime(2023, 5, 15),
            "approved_at": None,
            "signed_at": None,
            "auto_renew": False,
            "currency": "USD",
            "jurisdiction": "California",
            "category": "Services"
        },
        {
            "id": str(uuid4()),
            "title": "Employment Contract",
            "contract_type": "employment",
            "status": "active",
            "value": Decimal("120000.00"),
            "start_date": datetime(2023, 3, 1),
            "end_date": datetime(2024, 3, 1),
            "renewal_date": datetime(2024, 3, 1),
            "department": "Engineering",
            "vendor": None,
            "risk_level": "high",
            "created_at": datetime(2023, 2, 15),
            "approved_at": datetime(2023, 2, 25),
            "signed_at": datetime(2023, 3, 1),
            "auto_renew": False,
            "currency": "USD",
            "jurisdiction": "Delaware",
            "category": "HR"
        }
    ]


@pytest.fixture
def analytics_filter():
    """Default analytics filter"""
    return AnalyticsFilter(
        time_range=TimeRange.YEAR,
        start_date=datetime(2023, 1, 1),
        end_date=datetime(2023, 12, 31),
        departments=["IT", "Marketing", "Engineering"],
        contract_types=["software_license", "service_agreement", "employment"],
        statuses=["active", "pending"],
        risk_levels=["low", "medium", "high"],
        aggregation_level=AggregationLevel.MONTHLY
    )


class TestContractAnalyticsService:
    """Test contract analytics functionality"""
    
    @pytest.mark.asyncio
    async def test_get_contract_metrics(self, mock_db, sample_contracts, analytics_filter):
        """Test getting overall contract metrics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock database responses
        mock_db.scalars.return_value.all.return_value = sample_contracts
        mock_db.scalar.side_effect = [
            3,  # total contracts
            2,  # active contracts
            1,  # pending contracts
            0,  # expired contracts
            Decimal("195000.00"),  # total value
            Decimal("170000.00"),  # active value
            15.5,  # avg cycle time
            85.0   # renewal rate
        ]
        
        result = await service.get_contract_metrics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, ContractMetrics)
        assert result.total_contracts == 3
        assert result.active_contracts == 2
        assert result.pending_contracts == 1
        assert result.expired_contracts == 0
        assert result.total_value == Decimal("195000.00")
        assert result.active_value == Decimal("170000.00")
        assert result.average_cycle_time == 15.5
        assert result.renewal_rate == 85.0
    
    @pytest.mark.asyncio
    async def test_get_volume_analytics(self, mock_db, analytics_filter):
        """Test contract volume analytics over time"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock volume data by month
        mock_volume_data = [
            {"period": "2023-01", "count": 5, "cumulative": 5},
            {"period": "2023-02", "count": 8, "cumulative": 13},
            {"period": "2023-03", "count": 12, "cumulative": 25},
            {"period": "2023-04", "count": 7, "cumulative": 32},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_volume_data
        
        result = await service.get_volume_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, VolumeAnalytics)
        assert len(result.trends) == 4
        assert result.trends[0].period == "2023-01"
        assert result.trends[0].value == 5
        assert result.trends[2].cumulative_value == 25
        assert result.total_volume == 32
        assert result.average_monthly_volume == 8.0
    
    @pytest.mark.asyncio
    async def test_get_value_analytics(self, mock_db, analytics_filter):
        """Test contract value analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock value data by category
        mock_value_data = [
            {"category": "Technology", "total_value": Decimal("500000.00"), "count": 15},
            {"category": "Services", "total_value": Decimal("350000.00"), "count": 12},
            {"category": "HR", "total_value": Decimal("1200000.00"), "count": 8},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_value_data
        mock_db.scalar.return_value = Decimal("2050000.00")  # total portfolio value
        
        result = await service.get_value_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, ValueAnalytics)
        assert result.total_portfolio_value == Decimal("2050000.00")
        assert len(result.value_by_category) == 3
        assert result.value_by_category[0]["category"] == "Technology"
        assert result.value_by_category[2]["total_value"] == Decimal("1200000.00")
        assert result.average_contract_value == Decimal("58571.43")  # 2050000/35
        assert result.largest_contract_value > 0
    
    @pytest.mark.asyncio
    async def test_get_cycle_time_analytics(self, mock_db, analytics_filter):
        """Test contract cycle time analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock cycle time data
        mock_cycle_data = [
            {"stage": "creation_to_review", "avg_days": 3.5, "median_days": 3.0},
            {"stage": "review_to_approval", "avg_days": 7.2, "median_days": 6.0},
            {"stage": "approval_to_signature", "avg_days": 4.8, "median_days": 4.0},
            {"stage": "total_cycle_time", "avg_days": 15.5, "median_days": 13.0},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_cycle_data
        
        result = await service.get_cycle_time_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, CycleTimeAnalytics)
        assert result.average_total_cycle_time == 15.5
        assert result.median_total_cycle_time == 13.0
        assert len(result.stage_breakdown) == 4
        assert result.stage_breakdown[1]["stage"] == "review_to_approval"
        assert result.stage_breakdown[1]["avg_days"] == 7.2
    
    @pytest.mark.asyncio
    async def test_get_renewal_analytics(self, mock_db, analytics_filter):
        """Test contract renewal analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock renewal data
        mock_renewal_data = [
            {"period": "2023-01", "total_renewals": 5, "auto_renewals": 3, "manual_renewals": 2, "non_renewals": 1},
            {"period": "2023-02", "total_renewals": 8, "auto_renewals": 6, "manual_renewals": 2, "non_renewals": 2},
            {"period": "2023-03", "total_renewals": 12, "auto_renewals": 8, "manual_renewals": 4, "non_renewals": 1},
        ]
        
        # Mock upcoming renewals
        mock_upcoming = [
            {"contract_id": "123", "title": "Software License", "renewal_date": datetime(2024, 1, 15), "value": 50000},
            {"contract_id": "456", "title": "Service Contract", "renewal_date": datetime(2024, 2, 1), "value": 25000},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.side_effect = [
            mock_renewal_data,
            mock_upcoming
        ]
        
        result = await service.get_renewal_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, RenewalAnalytics)
        assert len(result.renewal_trends) == 3
        assert result.renewal_trends[2]["total_renewals"] == 12
        assert result.overall_renewal_rate == 86.2  # (25/(25+4)) * 100
        assert result.auto_renewal_rate == 68.0  # (17/25) * 100
        assert len(result.upcoming_renewals) == 2
        assert result.upcoming_renewals[0]["title"] == "Software License"
    
    @pytest.mark.asyncio
    async def test_get_vendor_performance(self, mock_db, analytics_filter):
        """Test vendor performance analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock vendor performance data
        mock_vendor_data = [
            {
                "vendor_name": "TechCorp Inc",
                "contract_count": 15,
                "total_value": Decimal("750000.00"),
                "avg_cycle_time": 12.5,
                "renewal_rate": 90.0,
                "risk_score": 2.1,
                "satisfaction_score": 4.2,
                "on_time_delivery": 95.0,
                "contract_disputes": 1,
                "sla_compliance": 98.5
            },
            {
                "vendor_name": "ServicePro LLC",
                "contract_count": 8,
                "total_value": Decimal("200000.00"),
                "avg_cycle_time": 8.3,
                "renewal_rate": 85.0,
                "risk_score": 1.8,
                "satisfaction_score": 4.5,
                "on_time_delivery": 92.0,
                "contract_disputes": 0,
                "sla_compliance": 99.2
            }
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_vendor_data
        
        result = await service.get_vendor_performance(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, list)
        assert len(result) == 2
        
        vendor1 = result[0]
        assert isinstance(vendor1, VendorPerformance)
        assert vendor1.vendor_name == "TechCorp Inc"
        assert vendor1.contract_count == 15
        assert vendor1.total_value == Decimal("750000.00")
        assert vendor1.renewal_rate == 90.0
        assert vendor1.risk_score == 2.1
        assert vendor1.sla_compliance == 98.5
    
    @pytest.mark.asyncio
    async def test_get_risk_metrics(self, mock_db, analytics_filter):
        """Test risk metrics calculation"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock risk data
        mock_risk_data = [
            {"risk_level": "low", "count": 45, "total_value": Decimal("500000.00")},
            {"risk_level": "medium", "count": 25, "total_value": Decimal("800000.00")},
            {"risk_level": "high", "count": 8, "total_value": Decimal("300000.00")},
            {"risk_level": "critical", "count": 2, "total_value": Decimal("100000.00")},
        ]
        
        mock_risk_categories = [
            {"category": "compliance", "score": 85.5, "trend": "improving"},
            {"category": "financial", "score": 78.2, "trend": "stable"},
            {"category": "operational", "score": 92.1, "trend": "declining"},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.side_effect = [
            mock_risk_data,
            mock_risk_categories
        ]
        
        result = await service.get_risk_metrics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, RiskMetrics)
        assert len(result.risk_distribution) == 4
        assert result.risk_distribution[0]["risk_level"] == "low"
        assert result.risk_distribution[0]["count"] == 45
        assert result.total_risk_exposure == Decimal("1700000.00")
        assert result.high_risk_contracts == 10  # high + critical
        assert result.average_risk_score == 85.3  # (85.5+78.2+92.1)/3
        assert len(result.risk_categories) == 3
    
    @pytest.mark.asyncio
    async def test_get_compliance_metrics(self, mock_db, analytics_filter):
        """Test compliance metrics calculation"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock compliance data
        mock_compliance_data = [
            {"requirement_type": "data_privacy", "compliant": 45, "non_compliant": 5, "score": 90.0},
            {"requirement_type": "financial_reporting", "compliant": 38, "non_compliant": 2, "score": 95.0},
            {"requirement_type": "regulatory", "compliant": 42, "non_compliant": 8, "score": 84.0},
        ]
        
        mock_violations = [
            {"violation_type": "missing_clause", "count": 12, "severity": "medium"},
            {"violation_type": "expired_certificate", "count": 3, "severity": "high"},
            {"violation_type": "incomplete_documentation", "count": 7, "severity": "low"},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.side_effect = [
            mock_compliance_data,
            mock_violations
        ]
        
        result = await service.get_compliance_metrics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, ComplianceMetrics)
        assert result.overall_compliance_score == 89.7  # (90+95+84)/3
        assert len(result.compliance_by_category) == 3
        assert result.compliance_by_category[1]["requirement_type"] == "financial_reporting"
        assert result.total_violations == 22
        assert result.high_severity_violations == 3
        assert len(result.violation_breakdown) == 3
    
    @pytest.mark.asyncio
    async def test_get_spend_analytics(self, mock_db, analytics_filter):
        """Test spend analytics calculation"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock spend data
        mock_spend_trends = [
            {"period": "2023-01", "total_spend": Decimal("150000.00"), "new_contracts": Decimal("50000.00")},
            {"period": "2023-02", "total_spend": Decimal("180000.00"), "new_contracts": Decimal("80000.00")},
            {"period": "2023-03", "total_spend": Decimal("220000.00"), "new_contracts": Decimal("120000.00")},
        ]
        
        mock_department_spend = [
            {"department": "IT", "total_spend": Decimal("800000.00"), "contract_count": 25},
            {"department": "Marketing", "total_spend": Decimal("450000.00"), "contract_count": 18},
            {"department": "Legal", "total_spend": Decimal("200000.00"), "contract_count": 8},
        ]
        
        mock_vendor_spend = [
            {"vendor_name": "TechCorp Inc", "total_spend": Decimal("500000.00")},
            {"vendor_name": "ServicePro LLC", "total_spend": Decimal("300000.00")},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.side_effect = [
            mock_spend_trends,
            mock_department_spend,
            mock_vendor_spend
        ]
        
        result = await service.get_spend_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, SpendAnalytics)
        assert len(result.spend_trends) == 3
        assert result.spend_trends[2]["total_spend"] == Decimal("220000.00")
        assert result.total_annual_spend == Decimal("550000.00")
        assert len(result.spend_by_department) == 3
        assert result.spend_by_department[0]["department"] == "IT"
        assert len(result.top_vendors_by_spend) == 2
        assert result.average_monthly_spend == Decimal("183333.33")
    
    @pytest.mark.asyncio
    async def test_get_department_analytics(self, mock_db, analytics_filter):
        """Test department-specific analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock department data
        mock_dept_data = [
            {
                "department": "IT",
                "total_contracts": 25,
                "active_contracts": 20,
                "total_value": Decimal("800000.00"),
                "avg_cycle_time": 14.5,
                "renewal_rate": 88.0,
                "risk_score": 2.3,
                "compliance_score": 91.5
            },
            {
                "department": "Marketing",
                "total_contracts": 18,
                "active_contracts": 15,
                "total_value": Decimal("450000.00"),
                "avg_cycle_time": 12.1,
                "renewal_rate": 82.5,
                "risk_score": 1.9,
                "compliance_score": 94.2
            }
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_dept_data
        
        result = await service.get_department_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, DepartmentAnalytics)
        assert len(result.departments) == 2
        
        dept1 = result.departments[0]
        assert dept1["department"] == "IT"
        assert dept1["total_contracts"] == 25
        assert dept1["total_value"] == Decimal("800000.00")
        assert dept1["avg_cycle_time"] == 14.5
        assert dept1["renewal_rate"] == 88.0
    
    @pytest.mark.asyncio
    async def test_get_predictive_analytics(self, mock_db, analytics_filter):
        """Test predictive analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock predictive data
        mock_predictions = {
            "renewal_likelihood": [
                {"contract_id": "123", "renewal_probability": 0.85, "factors": ["good_performance", "auto_renew"]},
                {"contract_id": "456", "renewal_probability": 0.45, "factors": ["price_concerns", "competitor"]},
            ],
            "risk_forecast": [
                {"contract_id": "789", "risk_increase_probability": 0.75, "risk_factors": ["vendor_instability"]},
            ],
            "spend_forecast": {
                "next_quarter": Decimal("250000.00"),
                "next_year": Decimal("1100000.00"),
                "confidence": 0.82
            }
        }
        
        with patch.object(service, '_calculate_renewal_predictions', return_value=mock_predictions["renewal_likelihood"]):
            with patch.object(service, '_calculate_risk_forecast', return_value=mock_predictions["risk_forecast"]):
                with patch.object(service, '_calculate_spend_forecast', return_value=mock_predictions["spend_forecast"]):
                    result = await service.get_predictive_analytics(
                        tenant_id="tenant_123",
                        filters=analytics_filter
                    )
        
        assert isinstance(result, PredictiveAnalytics)
        assert len(result.renewal_predictions) == 2
        assert result.renewal_predictions[0]["renewal_probability"] == 0.85
        assert len(result.risk_forecast) == 1
        assert result.spend_forecast["next_year"] == Decimal("1100000.00")
        assert result.confidence_score == 0.82
    
    @pytest.mark.asyncio
    async def test_analytics_caching(self, mock_db, mock_cache, analytics_filter):
        """Test analytics result caching"""
        service = ContractAnalyticsService(db=mock_db, cache=mock_cache)
        
        # Mock cache miss then hit
        mock_cache.get.side_effect = [None, {"total_contracts": 50}]
        
        # First call - cache miss
        mock_db.scalars.return_value.all.return_value = []
        mock_db.scalar.return_value = 50
        
        result1 = await service.get_contract_metrics("tenant_123", analytics_filter)
        
        # Should have tried to get from cache and then set cache
        mock_cache.get.assert_called()
        mock_cache.set.assert_called()
        
        # Second call - cache hit
        result2 = await service.get_contract_metrics("tenant_123", analytics_filter)
        
        # Should have retrieved from cache
        assert mock_cache.get.call_count == 2
    
    @pytest.mark.asyncio
    async def test_analytics_with_filters(self, mock_db, analytics_filter):
        """Test analytics with various filters applied"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Test with specific filters
        custom_filter = AnalyticsFilter(
            time_range=TimeRange.QUARTER,
            departments=["IT"],
            contract_types=["software_license"],
            statuses=["active"],
            risk_levels=["medium", "high"],
            aggregation_level=AggregationLevel.WEEKLY
        )
        
        mock_db.scalars.return_value.all.return_value = []
        mock_db.scalar.return_value = 10
        
        result = await service.get_contract_metrics("tenant_123", custom_filter)
        
        # Verify the query was called (filters applied)
        assert mock_db.scalars.called
        assert mock_db.scalar.called
        assert isinstance(result, ContractMetrics)
    
    @pytest.mark.asyncio
    async def test_trend_calculation(self, mock_db):
        """Test trend calculation algorithms"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock historical data points
        data_points = [
            {"period": "2023-01", "value": 100},
            {"period": "2023-02", "value": 110},
            {"period": "2023-03", "value": 105},
            {"period": "2023-04", "value": 120},
            {"period": "2023-05", "value": 125},
        ]
        
        trend = await service._calculate_trend(data_points)
        
        assert trend.direction in ["up", "down", "stable"]
        assert trend.percentage_change is not None
        assert trend.trend_strength >= 0
        assert trend.is_accelerating is not None
    
    @pytest.mark.asyncio
    async def test_benchmark_comparison(self, mock_db, analytics_filter):
        """Test benchmark comparison functionality"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock industry benchmark data
        mock_benchmarks = {
            "industry_avg_cycle_time": 18.5,
            "industry_renewal_rate": 78.0,
            "industry_compliance_score": 82.5,
            "peer_group_avg_spend": Decimal("1200000.00")
        }
        
        with patch.object(service, '_get_industry_benchmarks', return_value=mock_benchmarks):
            result = await service.get_benchmark_analytics(
                tenant_id="tenant_123",
                filters=analytics_filter
            )
        
        assert isinstance(result, BenchmarkAnalytics)
        assert result.industry_benchmarks["industry_avg_cycle_time"] == 18.5
        assert "cycle_time_vs_industry" in result.performance_vs_benchmarks
    
    @pytest.mark.asyncio
    async def test_geographic_analytics(self, mock_db, analytics_filter):
        """Test geographic distribution analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock geographic data
        mock_geo_data = [
            {"jurisdiction": "New York", "contract_count": 25, "total_value": Decimal("800000.00")},
            {"jurisdiction": "California", "contract_count": 18, "total_value": Decimal("650000.00")},
            {"jurisdiction": "Delaware", "contract_count": 12, "total_value": Decimal("400000.00")},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_geo_data
        
        result = await service.get_geographic_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, GeographicAnalytics)
        assert len(result.by_jurisdiction) == 3
        assert result.by_jurisdiction[0]["jurisdiction"] == "New York"
        assert result.total_jurisdictions == 3
        assert result.primary_jurisdiction == "New York"
    
    @pytest.mark.asyncio
    async def test_performance_analytics(self, mock_db, analytics_filter):
        """Test performance analytics calculation"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock performance data
        mock_perf_data = [
            {"metric": "sla_compliance", "value": 94.5, "target": 95.0, "trend": "stable"},
            {"metric": "on_time_delivery", "value": 87.2, "target": 90.0, "trend": "improving"},
            {"metric": "customer_satisfaction", "value": 4.3, "target": 4.0, "trend": "declining"},
        ]
        
        mock_db.execute.return_value.mappings.return_value.all.return_value = mock_perf_data
        
        result = await service.get_performance_analytics(
            tenant_id="tenant_123",
            filters=analytics_filter
        )
        
        assert isinstance(result, PerformanceAnalytics)
        assert len(result.performance_metrics) == 3
        assert result.performance_metrics[0]["metric"] == "sla_compliance"
        assert result.overall_performance_score > 0
        assert result.metrics_above_target == 1
        assert result.metrics_below_target == 2
    
    @pytest.mark.asyncio
    async def test_error_handling(self, mock_db, analytics_filter):
        """Test error handling in analytics service"""
        service = ContractAnalyticsService(db=mock_db)
        
        # Mock database error
        mock_db.execute.side_effect = Exception("Database connection error")
        
        with pytest.raises(Exception) as exc_info:
            await service.get_contract_metrics("tenant_123", analytics_filter)
        
        assert "Database connection error" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_multi_tenant_isolation(self, mock_db, analytics_filter):
        """Test multi-tenant data isolation in analytics"""
        service = ContractAnalyticsService(db=mock_db)
        
        mock_db.scalars.return_value.all.return_value = []
        mock_db.scalar.return_value = 0
        
        # Call with different tenant IDs
        await service.get_contract_metrics("tenant_1", analytics_filter)
        await service.get_contract_metrics("tenant_2", analytics_filter)
        
        # Verify queries include tenant isolation
        assert mock_db.scalars.call_count == 2
        # In a real implementation, we'd verify the SQL includes tenant_id filters


# Helper function tests
class TestAnalyticsHelpers:
    """Test analytics helper functions"""
    
    @pytest.mark.asyncio
    async def test_contract_trend_calculation(self):
        """Test contract trend calculation"""
        from app.services.contract_analytics import calculate_trend
        
        # Test upward trend
        upward_data = [100, 110, 120, 135, 140]
        trend = calculate_trend(upward_data)
        
        assert trend.direction == "up"
        assert trend.percentage_change > 0
        assert trend.is_accelerating is not None
    
    @pytest.mark.asyncio
    async def test_risk_scoring(self):
        """Test risk scoring algorithm"""
        from app.services.contract_analytics import calculate_risk_score
        
        risk_factors = {
            "vendor_stability": 0.3,
            "contract_complexity": 0.7,
            "financial_exposure": 0.8,
            "regulatory_risk": 0.4
        }
        
        risk_score = calculate_risk_score(risk_factors)
        
        assert 0 <= risk_score <= 5
        assert isinstance(risk_score, float)
    
    @pytest.mark.asyncio
    async def test_analytics_filters(self):
        """Test analytics filter construction"""
        filter_obj = AnalyticsFilter(
            time_range=TimeRange.YEAR,
            departments=["IT", "Legal"],
            contract_types=["software_license"],
            aggregation_level=AggregationLevel.MONTHLY
        )
        
        assert filter_obj.time_range == TimeRange.YEAR
        assert "IT" in filter_obj.departments
        assert filter_obj.aggregation_level == AggregationLevel.MONTHLY
        assert filter_obj.start_date is not None
        assert filter_obj.end_date is not None