"""
Contract Reporting Engine Tests
Following TDD - RED phase: Comprehensive test suite for contract reporting and custom report generation
"""

import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional
from uuid import uuid4
from decimal import Decimal
import io
import json

from app.services.contract_reporting import (
    ContractReportingService,
    ReportTemplate,
    ReportConfig,
    ReportSchedule,
    ReportResult,
    ReportFormat,
    ReportType,
    ReportFrequency,
    ScheduleStatus,
    ReportSection,
    ReportChart,
    ReportTable,
    ReportFilter,
    ReportMetric,
    CustomReport,
    DashboardReport,
    ExecutiveReport,
    OperationalReport,
    ComplianceReport,
    FinancialReport,
    VendorReport,
    RiskReport,
    PerformanceReport
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
def mock_analytics_service():
    """Mock analytics service"""
    analytics_mock = AsyncMock()
    analytics_mock.get_contract_metrics = AsyncMock()
    analytics_mock.get_volume_analytics = AsyncMock()
    analytics_mock.get_vendor_performance = AsyncMock()
    return analytics_mock


@pytest.fixture
def sample_report_config():
    """Sample report configuration"""
    return ReportConfig(
        title="Monthly Contract Summary",
        report_type=ReportType.OPERATIONAL,
        format=ReportFormat.PDF,
        sections=[
            ReportSection(
                name="overview",
                title="Executive Overview",
                type="metrics",
                config={"metrics": ["total_contracts", "total_value", "active_contracts"]}
            ),
            ReportSection(
                name="trends",
                title="Contract Trends",
                type="chart",
                config={"chart_type": "line", "data_source": "volume_analytics"}
            ),
            ReportSection(
                name="vendors",
                title="Top Vendors",
                type="table",
                config={"data_source": "vendor_performance", "limit": 10}
            )
        ],
        filters=ReportFilter(
            date_range="last_month",
            departments=["IT", "Legal"],
            contract_types=["software_license", "service_agreement"]
        ),
        include_charts=True,
        include_tables=True,
        include_summary=True
    )


@pytest.fixture
def sample_report_template():
    """Sample report template"""
    return ReportTemplate(
        id=str(uuid4()),
        name="Executive Summary Template",
        description="Monthly executive summary report template",
        report_type=ReportType.EXECUTIVE,
        template_content={
            "layout": "standard",
            "header": {"company_logo": True, "report_title": True, "date_range": True},
            "sections": ["overview", "key_metrics", "trends", "risks", "recommendations"],
            "footer": {"page_numbers": True, "generation_timestamp": True}
        },
        default_config=ReportConfig(
            title="Executive Summary",
            report_type=ReportType.EXECUTIVE,
            format=ReportFormat.PDF,
            sections=[],
            filters=ReportFilter(),
            include_charts=True,
            include_tables=True,
            include_summary=True
        ),
        is_active=True,
        created_by="system",
        created_at=datetime.utcnow()
    )


class TestContractReportingService:
    """Test contract reporting functionality"""
    
    @pytest.mark.asyncio
    async def test_generate_executive_report(self, mock_db, mock_analytics_service, sample_report_config):
        """Test generating executive report"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=150,
            active_contracts=120,
            total_value=Decimal("2500000.00"),
            renewal_rate=85.5
        )
        
        mock_analytics_service.get_volume_analytics.return_value = Mock(
            trends=[
                {"period": "2023-01", "value": 10},
                {"period": "2023-02", "value": 15},
                {"period": "2023-03", "value": 12}
            ]
        )
        
        result = await service.generate_report(
            tenant_id="tenant_123",
            config=sample_report_config,
            user_id="user_123"
        )
        
        assert isinstance(result, ReportResult)
        assert result.status == "completed"
        assert result.format == ReportFormat.PDF
        assert result.content is not None
        assert len(result.sections) == 3
        assert result.generated_by == "user_123"
        assert result.tenant_id == "tenant_123"
    
    @pytest.mark.asyncio
    async def test_generate_compliance_report(self, mock_db, mock_analytics_service):
        """Test generating compliance report"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock compliance data
        mock_analytics_service.get_compliance_metrics.return_value = Mock(
            overall_compliance_score=92.5,
            compliance_by_category=[
                {"requirement_type": "data_privacy", "score": 95.0},
                {"requirement_type": "financial_reporting", "score": 90.0}
            ],
            total_violations=5,
            high_severity_violations=1
        )
        
        config = ReportConfig(
            title="Compliance Report",
            report_type=ReportType.COMPLIANCE,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="compliance_overview",
                    title="Compliance Overview", 
                    type="metrics",
                    config={"data_source": "compliance_metrics"}
                )
            ],
            filters=ReportFilter(date_range="last_quarter")
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        assert result.status == "completed"
        assert result.report_type == ReportType.COMPLIANCE
        assert len(result.sections) > 0
    
    @pytest.mark.asyncio
    async def test_generate_financial_report(self, mock_db, mock_analytics_service):
        """Test generating financial report"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock financial data
        mock_analytics_service.get_spend_analytics.return_value = Mock(
            total_annual_spend=Decimal("5000000.00"),
            spend_by_department=[
                {"department": "IT", "total_spend": Decimal("2000000.00")},
                {"department": "Marketing", "total_spend": Decimal("1500000.00")}
            ],
            average_monthly_spend=Decimal("416666.67")
        )
        
        config = ReportConfig(
            title="Financial Report",
            report_type=ReportType.FINANCIAL,
            format=ReportFormat.EXCEL,
            sections=[
                ReportSection(
                    name="spend_analysis",
                    title="Spend Analysis",
                    type="table",
                    config={"data_source": "spend_analytics"}
                )
            ]
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        assert result.status == "completed"
        assert result.format == ReportFormat.EXCEL
        assert result.report_type == ReportType.FINANCIAL
    
    @pytest.mark.asyncio
    async def test_generate_vendor_report(self, mock_db, mock_analytics_service):
        """Test generating vendor report"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock vendor data
        mock_vendor_data = [
            Mock(
                vendor_name="TechCorp Inc",
                contract_count=15,
                total_value=Decimal("750000.00"),
                renewal_rate=90.0,
                risk_score=2.1,
                sla_compliance=98.5
            ),
            Mock(
                vendor_name="ServicePro LLC",
                contract_count=8,
                total_value=Decimal("200000.00"),
                renewal_rate=85.0,
                risk_score=1.8,
                sla_compliance=99.2
            )
        ]
        
        mock_analytics_service.get_vendor_performance.return_value = mock_vendor_data
        
        config = ReportConfig(
            title="Vendor Performance Report",
            report_type=ReportType.VENDOR,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="vendor_performance",
                    title="Vendor Performance",
                    type="table",
                    config={"data_source": "vendor_performance"}
                )
            ]
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        assert result.status == "completed"
        assert result.report_type == ReportType.VENDOR
        assert len(result.sections) > 0
    
    @pytest.mark.asyncio
    async def test_generate_custom_report(self, mock_db, mock_analytics_service):
        """Test generating custom report"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        custom_config = ReportConfig(
            title="Custom Analysis Report",
            report_type=ReportType.CUSTOM,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="custom_metrics",
                    title="Custom Metrics",
                    type="custom",
                    config={
                        "sql_query": "SELECT department, COUNT(*) as count FROM contracts GROUP BY department",
                        "chart_type": "bar"
                    }
                )
            ]
        )
        
        # Mock custom query result
        mock_db.execute.return_value.fetchall.return_value = [
            ("IT", 25),
            ("Legal", 18),
            ("Marketing", 12)
        ]
        
        result = await service.generate_report("tenant_123", custom_config, "user_123")
        
        assert result.status == "completed"
        assert result.report_type == ReportType.CUSTOM
    
    @pytest.mark.asyncio
    async def test_generate_report_with_multiple_formats(self, mock_db, mock_analytics_service, sample_report_config):
        """Test generating report in multiple formats"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=100,
            active_contracts=80,
            total_value=Decimal("1000000.00")
        )
        
        formats = [ReportFormat.PDF, ReportFormat.EXCEL, ReportFormat.HTML]
        
        for report_format in formats:
            config = ReportConfig(
                title="Multi-Format Report",
                report_type=ReportType.OPERATIONAL,
                format=report_format,
                sections=sample_report_config.sections,
                filters=sample_report_config.filters
            )
            
            result = await service.generate_report("tenant_123", config, "user_123")
            
            assert result.status == "completed"
            assert result.format == report_format
            assert result.content is not None
    
    @pytest.mark.asyncio
    async def test_report_template_management(self, mock_db, sample_report_template):
        """Test report template management"""
        service = ContractReportingService(db=mock_db)
        
        # Mock template save
        mock_db.scalars.return_value.first.return_value = None
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        
        # Create template
        template_id = await service.create_report_template(
            tenant_id="tenant_123",
            template=sample_report_template,
            user_id="user_123"
        )
        
        assert template_id is not None
        mock_db.add.assert_called_once()
        
        # Update template
        sample_report_template.name = "Updated Template Name"
        await service.update_report_template(
            template_id=template_id,
            template=sample_report_template,
            user_id="user_123"
        )
        
        # Mock template retrieval
        mock_db.scalars.return_value.first.return_value = sample_report_template
        
        retrieved = await service.get_report_template(template_id)
        assert retrieved.name == "Updated Template Name"
    
    @pytest.mark.asyncio
    async def test_report_scheduling(self, mock_db, sample_report_config):
        """Test report scheduling functionality"""
        service = ContractReportingService(db=mock_db)
        
        schedule = ReportSchedule(
            id=str(uuid4()),
            name="Monthly Executive Report",
            config=sample_report_config,
            frequency=ReportFrequency.MONTHLY,
            schedule_time="09:00",
            recipients=["ceo@company.com", "cfo@company.com"],
            is_active=True,
            tenant_id="tenant_123",
            created_by="user_123",
            next_run=datetime.utcnow() + timedelta(days=30)
        )
        
        # Mock schedule save
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        
        schedule_id = await service.create_report_schedule(
            tenant_id="tenant_123",
            schedule=schedule,
            user_id="user_123"
        )
        
        assert schedule_id is not None
        mock_db.add.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_scheduled_report_execution(self, mock_db, mock_analytics_service):
        """Test executing scheduled reports"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock scheduled report
        scheduled_report = Mock(
            id="schedule_123",
            name="Daily Status Report",
            config=ReportConfig(
                title="Daily Status",
                report_type=ReportType.OPERATIONAL,
                format=ReportFormat.PDF,
                sections=[],
                filters=ReportFilter()
            ),
            recipients=["manager@company.com"],
            tenant_id="tenant_123"
        )
        
        mock_db.scalars.return_value.all.return_value = [scheduled_report]
        
        # Mock analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=50,
            active_contracts=40
        )
        
        executed_count = await service.execute_scheduled_reports()
        
        assert executed_count >= 0
    
    @pytest.mark.asyncio
    async def test_report_caching(self, mock_db, mock_cache, mock_analytics_service, sample_report_config):
        """Test report result caching"""
        service = ContractReportingService(db=mock_db, cache=mock_cache, analytics_service=mock_analytics_service)
        
        # Enable caching in config
        sample_report_config.cache_enabled = True
        sample_report_config.cache_ttl = 3600
        
        # Mock cache miss then hit
        mock_cache.get.side_effect = [None, {"content": "cached_report", "status": "completed"}]
        
        # Mock analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=75
        )
        
        # First call - cache miss
        result1 = await service.generate_report("tenant_123", sample_report_config, "user_123")
        
        # Should have tried to get from cache and then set cache
        mock_cache.get.assert_called()
        mock_cache.set.assert_called()
        
        # Second call - cache hit
        result2 = await service.generate_report("tenant_123", sample_report_config, "user_123")
        
        assert mock_cache.get.call_count == 2
    
    @pytest.mark.asyncio
    async def test_report_with_charts(self, mock_db, mock_analytics_service):
        """Test report generation with charts"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock analytics data for chart
        mock_analytics_service.get_volume_analytics.return_value = Mock(
            trends=[
                {"period": "2023-01", "value": 10},
                {"period": "2023-02", "value": 15},
                {"period": "2023-03", "value": 20}
            ]
        )
        
        config = ReportConfig(
            title="Chart Report",
            report_type=ReportType.OPERATIONAL,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="volume_chart",
                    title="Volume Trends",
                    type="chart",
                    config={
                        "chart_type": "line",
                        "data_source": "volume_analytics",
                        "x_axis": "period",
                        "y_axis": "value"
                    }
                )
            ]
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        assert result.status == "completed"
        assert len(result.charts) > 0
        assert result.charts[0].chart_type == "line"
    
    @pytest.mark.asyncio
    async def test_report_with_tables(self, mock_db, mock_analytics_service):
        """Test report generation with tables"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock vendor data for table
        mock_vendor_data = [
            Mock(vendor_name="Vendor A", contract_count=10, total_value=Decimal("100000")),
            Mock(vendor_name="Vendor B", contract_count=5, total_value=Decimal("50000"))
        ]
        
        mock_analytics_service.get_vendor_performance.return_value = mock_vendor_data
        
        config = ReportConfig(
            title="Table Report",
            report_type=ReportType.VENDOR,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="vendor_table",
                    title="Vendor Performance",
                    type="table",
                    config={
                        "data_source": "vendor_performance",
                        "columns": ["vendor_name", "contract_count", "total_value"],
                        "sort_by": "total_value",
                        "sort_order": "desc"
                    }
                )
            ]
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        assert result.status == "completed"
        assert len(result.tables) > 0
        assert len(result.tables[0].headers) == 3
        assert len(result.tables[0].rows) == 2
    
    @pytest.mark.asyncio
    async def test_report_filtering(self, mock_db, mock_analytics_service):
        """Test report with filters applied"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock filtered data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=25,  # Filtered result
            active_contracts=20
        )
        
        config = ReportConfig(
            title="Filtered Report",
            report_type=ReportType.OPERATIONAL,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="filtered_metrics",
                    title="IT Department Contracts",
                    type="metrics",
                    config={"data_source": "contract_metrics"}
                )
            ],
            filters=ReportFilter(
                departments=["IT"],
                contract_types=["software_license"],
                date_range="last_quarter"
            )
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        assert result.status == "completed"
        assert result.filters_applied["departments"] == ["IT"]
        assert result.filters_applied["contract_types"] == ["software_license"]
    
    @pytest.mark.asyncio
    async def test_report_export_formats(self, mock_db, mock_analytics_service):
        """Test report export in different formats"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=100
        )
        
        base_config = ReportConfig(
            title="Export Test Report",
            report_type=ReportType.OPERATIONAL,
            sections=[
                ReportSection(
                    name="metrics",
                    title="Metrics",
                    type="metrics",
                    config={"data_source": "contract_metrics"}
                )
            ]
        )
        
        # Test PDF export
        pdf_config = ReportConfig(**base_config.__dict__)
        pdf_config.format = ReportFormat.PDF
        pdf_result = await service.generate_report("tenant_123", pdf_config, "user_123")
        assert pdf_result.format == ReportFormat.PDF
        assert isinstance(pdf_result.content, bytes)
        
        # Test Excel export
        excel_config = ReportConfig(**base_config.__dict__)
        excel_config.format = ReportFormat.EXCEL
        excel_result = await service.generate_report("tenant_123", excel_config, "user_123")
        assert excel_result.format == ReportFormat.EXCEL
        assert isinstance(excel_result.content, bytes)
        
        # Test HTML export
        html_config = ReportConfig(**base_config.__dict__)
        html_config.format = ReportFormat.HTML
        html_result = await service.generate_report("tenant_123", html_config, "user_123")
        assert html_result.format == ReportFormat.HTML
        assert isinstance(html_result.content, str)
        
        # Test CSV export
        csv_config = ReportConfig(**base_config.__dict__)
        csv_config.format = ReportFormat.CSV
        csv_result = await service.generate_report("tenant_123", csv_config, "user_123")
        assert csv_result.format == ReportFormat.CSV
        assert isinstance(csv_result.content, str)
    
    @pytest.mark.asyncio
    async def test_report_email_delivery(self, mock_db, mock_analytics_service):
        """Test report email delivery"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=50
        )
        
        config = ReportConfig(
            title="Email Report",
            report_type=ReportType.OPERATIONAL,
            format=ReportFormat.PDF,
            sections=[],
            email_config={
                "recipients": ["user@company.com"],
                "subject": "Monthly Contract Report",
                "body": "Please find the attached monthly contract report.",
                "attach_report": True
            }
        )
        
        with patch.object(service, '_send_report_email', return_value=True) as mock_email:
            result = await service.generate_report("tenant_123", config, "user_123")
            
            assert result.status == "completed"
            assert result.email_sent is True
            mock_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_report_history_tracking(self, mock_db, mock_analytics_service, sample_report_config):
        """Test report generation history tracking"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=50
        )
        
        # Mock report history save
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        
        result = await service.generate_report("tenant_123", sample_report_config, "user_123")
        
        assert result.status == "completed"
        # Should save to history
        mock_db.add.assert_called()
        mock_db.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_report_permissions(self, mock_db):
        """Test report generation permissions"""
        service = ContractReportingService(db=mock_db)
        
        # Mock permission check
        with patch.object(service, '_check_report_permissions', return_value=False):
            with pytest.raises(Exception) as exc_info:
                await service.generate_report(
                    tenant_id="tenant_123",
                    config=ReportConfig(title="Test", report_type=ReportType.EXECUTIVE),
                    user_id="unauthorized_user"
                )
            
            assert "permission" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_concurrent_report_generation(self, mock_db, mock_analytics_service):
        """Test concurrent report generation"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=25
        )
        
        configs = [
            ReportConfig(
                title=f"Concurrent Report {i}",
                report_type=ReportType.OPERATIONAL,
                format=ReportFormat.PDF,
                sections=[]
            )
            for i in range(3)
        ]
        
        # Generate reports concurrently
        tasks = [
            service.generate_report(f"tenant_{i}", config, f"user_{i}")
            for i, config in enumerate(configs)
        ]
        
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 3
        assert all(r.status == "completed" for r in results)
    
    @pytest.mark.asyncio
    async def test_report_error_handling(self, mock_db, mock_analytics_service):
        """Test report generation error handling"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock analytics service error
        mock_analytics_service.get_contract_metrics.side_effect = Exception("Data source unavailable")
        
        config = ReportConfig(
            title="Error Test Report",
            report_type=ReportType.OPERATIONAL,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="failing_section",
                    title="Metrics",
                    type="metrics",
                    config={"data_source": "contract_metrics"}
                )
            ]
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        assert result.status == "failed"
        assert "Data source unavailable" in result.error_message
    
    @pytest.mark.asyncio
    async def test_multi_tenant_isolation(self, mock_db, mock_analytics_service):
        """Test multi-tenant data isolation in reports"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock different data for different tenants
        def mock_get_metrics(tenant_id, filters):
            if tenant_id == "tenant_1":
                return Mock(total_contracts=100)
            elif tenant_id == "tenant_2":
                return Mock(total_contracts=50)
            else:
                return Mock(total_contracts=0)
        
        mock_analytics_service.get_contract_metrics.side_effect = mock_get_metrics
        
        config = ReportConfig(
            title="Isolation Test",
            report_type=ReportType.OPERATIONAL,
            format=ReportFormat.PDF,
            sections=[]
        )
        
        # Generate reports for different tenants
        result1 = await service.generate_report("tenant_1", config, "user_1")
        result2 = await service.generate_report("tenant_2", config, "user_2")
        
        assert result1.tenant_id == "tenant_1"
        assert result2.tenant_id == "tenant_2"
        assert result1 != result2  # Different data


# Helper function tests
class TestReportingHelpers:
    """Test reporting helper functions"""
    
    @pytest.mark.asyncio
    async def test_report_config_validation(self):
        """Test report configuration validation"""
        from app.services.contract_reporting import validate_report_config
        
        # Valid config
        valid_config = ReportConfig(
            title="Valid Report",
            report_type=ReportType.OPERATIONAL,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="valid_section",
                    title="Section",
                    type="metrics",
                    config={"data_source": "contract_metrics"}
                )
            ]
        )
        
        is_valid, errors = validate_report_config(valid_config)
        assert is_valid is True
        assert len(errors) == 0
        
        # Invalid config - missing title
        invalid_config = ReportConfig(
            title="",
            report_type=ReportType.OPERATIONAL,
            format=ReportFormat.PDF,
            sections=[]
        )
        
        is_valid, errors = validate_report_config(invalid_config)
        assert is_valid is False
        assert len(errors) > 0
    
    @pytest.mark.asyncio
    async def test_report_template_validation(self):
        """Test report template validation"""
        from app.services.contract_reporting import validate_report_template
        
        template = ReportTemplate(
            id=str(uuid4()),
            name="Test Template",
            description="Test description",
            report_type=ReportType.OPERATIONAL,
            template_content={},
            default_config=ReportConfig(
                title="Default",
                report_type=ReportType.OPERATIONAL,
                format=ReportFormat.PDF,
                sections=[]
            )
        )
        
        is_valid, errors = validate_report_template(template)
        assert is_valid is True
        assert len(errors) == 0
    
    @pytest.mark.asyncio
    async def test_schedule_calculation(self):
        """Test next run calculation for schedules"""
        from app.services.contract_reporting import calculate_next_run
        
        # Test daily schedule
        daily_next = calculate_next_run(ReportFrequency.DAILY, "09:00")
        assert daily_next > datetime.utcnow()
        
        # Test weekly schedule
        weekly_next = calculate_next_run(ReportFrequency.WEEKLY, "09:00", day_of_week=1)
        assert weekly_next > datetime.utcnow()
        
        # Test monthly schedule
        monthly_next = calculate_next_run(ReportFrequency.MONTHLY, "09:00", day_of_month=15)
        assert monthly_next > datetime.utcnow()


# Integration Tests
class TestReportingIntegration:
    """Test reporting service integration"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_report_generation(self, mock_db, mock_analytics_service):
        """Test complete report generation workflow"""
        service = ContractReportingService(db=mock_db, analytics_service=mock_analytics_service)
        
        # Mock complete analytics data
        mock_analytics_service.get_contract_metrics.return_value = Mock(
            total_contracts=200,
            active_contracts=150,
            total_value=Decimal("5000000.00"),
            renewal_rate=88.5
        )
        
        mock_analytics_service.get_volume_analytics.return_value = Mock(
            trends=[{"period": f"2023-{i:02d}", "value": 10+i} for i in range(1, 13)]
        )
        
        mock_analytics_service.get_vendor_performance.return_value = [
            Mock(vendor_name="Vendor A", contract_count=15, total_value=Decimal("500000")),
            Mock(vendor_name="Vendor B", contract_count=10, total_value=Decimal("300000"))
        ]
        
        # Configure comprehensive report
        config = ReportConfig(
            title="Annual Executive Report",
            report_type=ReportType.EXECUTIVE,
            format=ReportFormat.PDF,
            sections=[
                ReportSection(
                    name="executive_summary",
                    title="Executive Summary",
                    type="metrics",
                    config={"data_source": "contract_metrics"}
                ),
                ReportSection(
                    name="volume_trends",
                    title="Contract Volume Trends",
                    type="chart",
                    config={"chart_type": "line", "data_source": "volume_analytics"}
                ),
                ReportSection(
                    name="top_vendors",
                    title="Top Vendors by Value",
                    type="table",
                    config={"data_source": "vendor_performance", "limit": 10}
                )
            ],
            include_charts=True,
            include_tables=True,
            include_summary=True,
            include_recommendations=True
        )
        
        result = await service.generate_report("tenant_123", config, "user_123")
        
        # Verify comprehensive report
        assert result.status == "completed"
        assert result.report_type == ReportType.EXECUTIVE
        assert len(result.sections) == 3
        assert len(result.charts) > 0
        assert len(result.tables) > 0
        assert result.summary is not None
        assert len(result.recommendations) > 0
        assert result.content is not None
        assert result.generated_at is not None
        assert result.tenant_id == "tenant_123"
        assert result.generated_by == "user_123"