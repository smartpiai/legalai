"""
Contract Reporting Engine
Following TDD - GREEN phase: Implementation for contract reporting and custom report generation
"""

import asyncio
import hashlib
import json
import io
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple, Union
from uuid import uuid4
from decimal import Decimal
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession


class ReportFormat(str, Enum):
    """Report output formats"""
    PDF = "pdf"
    EXCEL = "excel"
    HTML = "html"
    CSV = "csv"
    JSON = "json"


class ReportType(str, Enum):
    """Types of reports"""
    EXECUTIVE = "executive"
    OPERATIONAL = "operational"
    COMPLIANCE = "compliance"
    FINANCIAL = "financial"
    VENDOR = "vendor"
    RISK = "risk"
    PERFORMANCE = "performance"
    CUSTOM = "custom"
    DASHBOARD = "dashboard"


class ReportFrequency(str, Enum):
    """Report scheduling frequency"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    ON_DEMAND = "on_demand"


class ScheduleStatus(str, Enum):
    """Report schedule status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PAUSED = "paused"
    FAILED = "failed"


@dataclass
class ReportFilter:
    """Report filters"""
    date_range: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    departments: Optional[List[str]] = None
    contract_types: Optional[List[str]] = None
    statuses: Optional[List[str]] = None
    risk_levels: Optional[List[str]] = None
    vendors: Optional[List[str]] = None
    jurisdictions: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    value_range: Optional[Tuple[Decimal, Decimal]] = None


@dataclass
class ReportSection:
    """Report section configuration"""
    name: str
    title: str
    type: str  # metrics, chart, table, text, custom
    config: Dict[str, Any] = field(default_factory=dict)
    order: int = 0
    is_required: bool = True
    permissions: List[str] = field(default_factory=list)


@dataclass
class ReportChart:
    """Report chart data"""
    name: str
    title: str
    chart_type: str  # line, bar, pie, area, scatter
    data: List[Dict[str, Any]] = field(default_factory=list)
    x_axis: str = "x"
    y_axis: str = "y" 
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportTable:
    """Report table data"""
    name: str
    title: str
    headers: List[str] = field(default_factory=list)
    rows: List[List[Any]] = field(default_factory=list)
    footer: Optional[List[str]] = None
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportMetric:
    """Report metric data"""
    name: str
    title: str
    value: Any
    format_type: str = "number"
    trend: Optional[str] = None
    comparison: Optional[Dict[str, Any]] = None
    target: Optional[Any] = None


@dataclass
class ReportConfig:
    """Report configuration"""
    title: str
    report_type: ReportType
    format: ReportFormat
    sections: List[ReportSection] = field(default_factory=list)
    filters: Optional[ReportFilter] = None
    include_charts: bool = True
    include_tables: bool = True
    include_summary: bool = True
    include_recommendations: bool = False
    template_id: Optional[str] = None
    cache_enabled: bool = True
    cache_ttl: int = 3600
    email_config: Optional[Dict[str, Any]] = None
    custom_branding: Optional[Dict[str, Any]] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ReportTemplate:
    """Report template"""
    id: str
    name: str
    description: str
    report_type: ReportType
    template_content: Dict[str, Any] = field(default_factory=dict)
    default_config: Optional[ReportConfig] = None
    is_active: bool = True
    is_system: bool = False
    tenant_id: Optional[str] = None
    created_by: str = "system"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


@dataclass
class ReportSchedule:
    """Report scheduling configuration"""
    id: str
    name: str
    description: Optional[str] = None
    config: ReportConfig = None
    frequency: ReportFrequency = ReportFrequency.MONTHLY
    schedule_time: str = "09:00"
    day_of_week: Optional[int] = None  # 0-6, Monday=0
    day_of_month: Optional[int] = None  # 1-31
    recipients: List[str] = field(default_factory=list)
    is_active: bool = True
    status: ScheduleStatus = ScheduleStatus.ACTIVE
    tenant_id: str = ""
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    run_count: int = 0
    error_count: int = 0


@dataclass
class ReportResult:
    """Report generation result"""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    report_type: ReportType = ReportType.OPERATIONAL
    format: ReportFormat = ReportFormat.PDF
    content: Optional[Union[str, bytes]] = None
    sections: List[Dict[str, Any]] = field(default_factory=list)
    charts: List[ReportChart] = field(default_factory=list)
    tables: List[ReportTable] = field(default_factory=list)
    metrics: List[ReportMetric] = field(default_factory=list)
    summary: Optional[str] = None
    recommendations: List[str] = field(default_factory=list)
    status: str = "pending"
    error_message: Optional[str] = None
    generated_at: datetime = field(default_factory=datetime.utcnow)
    generated_by: str = ""
    tenant_id: str = ""
    file_size: Optional[int] = None
    filters_applied: Dict[str, Any] = field(default_factory=dict)
    generation_time_seconds: float = 0.0
    email_sent: bool = False
    download_url: Optional[str] = None


# Specific report types
@dataclass
class CustomReport(ReportResult):
    """Custom report with SQL queries"""
    custom_queries: List[Dict[str, str]] = field(default_factory=list)


@dataclass 
class DashboardReport(ReportResult):
    """Dashboard-style report"""
    widgets: List[Dict[str, Any]] = field(default_factory=list)
    layout: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExecutiveReport(ReportResult):
    """Executive summary report"""
    key_insights: List[str] = field(default_factory=list)
    executive_summary: Optional[str] = None
    strategic_recommendations: List[str] = field(default_factory=list)


@dataclass
class OperationalReport(ReportResult):
    """Operational report with detailed metrics"""
    operational_metrics: List[ReportMetric] = field(default_factory=list)
    process_efficiency: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComplianceReport(ReportResult):
    """Compliance-focused report"""
    compliance_score: float = 0.0
    violations: List[Dict[str, Any]] = field(default_factory=list)
    remediation_actions: List[str] = field(default_factory=list)


@dataclass
class FinancialReport(ReportResult):
    """Financial analysis report"""
    total_spend: Decimal = Decimal("0")
    budget_variance: Decimal = Decimal("0")
    cost_savings: Decimal = Decimal("0")
    roi_analysis: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VendorReport(ReportResult):
    """Vendor performance report"""
    vendor_rankings: List[Dict[str, Any]] = field(default_factory=list)
    performance_trends: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class RiskReport(ReportResult):
    """Risk analysis report"""
    risk_score: float = 0.0
    high_risk_items: List[Dict[str, Any]] = field(default_factory=list)
    mitigation_strategies: List[str] = field(default_factory=list)


@dataclass
class PerformanceReport(ReportResult):
    """Performance metrics report"""
    kpi_summary: Dict[str, Any] = field(default_factory=dict)
    benchmark_comparison: Dict[str, Any] = field(default_factory=dict)


class ContractReportingService:
    """Main contract reporting service"""
    
    def __init__(self, db: AsyncSession = None, cache=None, analytics_service=None, notification_service=None):
        self.db = db
        self.cache = cache
        self.analytics_service = analytics_service
        self.notification_service = notification_service
        self.pdf_generator = PDFReportGenerator()
        self.excel_generator = ExcelReportGenerator()
        self.html_generator = HTMLReportGenerator()
        self.csv_generator = CSVReportGenerator()
    
    async def generate_report(
        self,
        tenant_id: str,
        config: ReportConfig,
        user_id: str
    ) -> ReportResult:
        """Generate a report based on configuration"""
        start_time = datetime.utcnow()
        
        try:
            # Check permissions
            if not await self._check_report_permissions(user_id, config.report_type, tenant_id):
                raise Exception(f"User {user_id} does not have permission to generate {config.report_type} reports")
            
            # Check cache if enabled
            if config.cache_enabled and self.cache:
                cache_key = self._generate_cache_key(tenant_id, config)
                cached = await self.cache.get(cache_key)
                if cached:
                    return ReportResult(**cached)
            
            # Initialize report result
            result = ReportResult(
                title=config.title,
                report_type=config.report_type,
                format=config.format,
                generated_by=user_id,
                tenant_id=tenant_id
            )
            
            # Apply filters
            analytics_filter = await self._convert_filters(config.filters)
            result.filters_applied = analytics_filter.__dict__ if analytics_filter else {}
            
            # Generate sections
            for section in config.sections:
                try:
                    section_data = await self._generate_section(section, tenant_id, analytics_filter)
                    result.sections.append(section_data)
                    
                    # Add section-specific data to result
                    if section.type == "chart":
                        result.charts.append(section_data.get("chart"))
                    elif section.type == "table":
                        result.tables.append(section_data.get("table"))
                    elif section.type == "metrics":
                        result.metrics.extend(section_data.get("metrics", []))
                    
                except Exception as section_error:
                    # Continue with other sections if one fails
                    result.sections.append({
                        "name": section.name,
                        "title": section.title,
                        "error": str(section_error),
                        "status": "failed"
                    })
            
            # Generate content based on format
            if config.format == ReportFormat.PDF:
                result.content = await self.pdf_generator.generate(result, config)
            elif config.format == ReportFormat.EXCEL:
                result.content = await self.excel_generator.generate(result, config)
            elif config.format == ReportFormat.HTML:
                result.content = await self.html_generator.generate(result, config)
            elif config.format == ReportFormat.CSV:
                result.content = await self.csv_generator.generate(result, config)
            elif config.format == ReportFormat.JSON:
                result.content = json.dumps(result.__dict__, default=str, indent=2)
            
            # Generate summary and recommendations if requested
            if config.include_summary:
                result.summary = await self._generate_summary(result, config)
            
            if config.include_recommendations:
                result.recommendations = await self._generate_recommendations(result, config)
            
            # Set completion status
            result.status = "completed"
            end_time = datetime.utcnow()
            result.generation_time_seconds = (end_time - start_time).total_seconds()
            
            if result.content:
                result.file_size = len(result.content) if isinstance(result.content, (str, bytes)) else 0
            
            # Send email if configured
            if config.email_config:
                try:
                    await self._send_report_email(result, config.email_config)
                    result.email_sent = True
                except Exception as email_error:
                    result.email_sent = False
                    # Don't fail the entire report for email issues
            
            # Cache result
            if config.cache_enabled and self.cache:
                await self.cache.set(cache_key, result.__dict__, ttl=config.cache_ttl)
            
            # Save to history
            await self._save_report_history(result)
            
            return result
            
        except Exception as e:
            end_time = datetime.utcnow()
            result = ReportResult(
                title=config.title,
                report_type=config.report_type,
                format=config.format,
                generated_by=user_id,
                tenant_id=tenant_id,
                status="failed",
                error_message=str(e),
                generation_time_seconds=(end_time - start_time).total_seconds()
            )
            
            # Save failed attempt to history
            await self._save_report_history(result)
            return result
    
    async def _generate_section(
        self,
        section: ReportSection,
        tenant_id: str,
        analytics_filter: Optional[Any]
    ) -> Dict[str, Any]:
        """Generate a specific report section"""
        section_data = {
            "name": section.name,
            "title": section.title,
            "type": section.type,
            "status": "completed"
        }
        
        if section.type == "metrics":
            section_data["metrics"] = await self._generate_metrics_section(section, tenant_id, analytics_filter)
        elif section.type == "chart":
            section_data["chart"] = await self._generate_chart_section(section, tenant_id, analytics_filter)
        elif section.type == "table":
            section_data["table"] = await self._generate_table_section(section, tenant_id, analytics_filter)
        elif section.type == "text":
            section_data["text"] = await self._generate_text_section(section, tenant_id, analytics_filter)
        elif section.type == "custom":
            section_data["custom"] = await self._generate_custom_section(section, tenant_id, analytics_filter)
        
        return section_data
    
    async def _generate_metrics_section(self, section: ReportSection, tenant_id: str, analytics_filter) -> List[ReportMetric]:
        """Generate metrics section"""
        metrics = []
        data_source = section.config.get("data_source", "contract_metrics")
        
        if data_source == "contract_metrics" and self.analytics_service:
            contract_metrics = await self.analytics_service.get_contract_metrics(tenant_id, analytics_filter)
            
            metrics.extend([
                ReportMetric(
                    name="total_contracts",
                    title="Total Contracts",
                    value=contract_metrics.total_contracts,
                    format_type="number"
                ),
                ReportMetric(
                    name="active_contracts", 
                    title="Active Contracts",
                    value=contract_metrics.active_contracts,
                    format_type="number"
                ),
                ReportMetric(
                    name="total_value",
                    title="Total Contract Value",
                    value=contract_metrics.total_value,
                    format_type="currency"
                ),
                ReportMetric(
                    name="renewal_rate",
                    title="Renewal Rate",
                    value=contract_metrics.renewal_rate,
                    format_type="percentage"
                )
            ])
        
        elif data_source == "compliance_metrics" and self.analytics_service:
            compliance_metrics = await self.analytics_service.get_compliance_metrics(tenant_id, analytics_filter)
            
            metrics.extend([
                ReportMetric(
                    name="compliance_score",
                    title="Overall Compliance Score",
                    value=compliance_metrics.overall_compliance_score,
                    format_type="percentage"
                ),
                ReportMetric(
                    name="total_violations",
                    title="Total Violations",
                    value=compliance_metrics.total_violations,
                    format_type="number"
                ),
                ReportMetric(
                    name="high_severity_violations",
                    title="High Severity Violations",
                    value=compliance_metrics.high_severity_violations,
                    format_type="number"
                )
            ])
        
        return metrics
    
    async def _generate_chart_section(self, section: ReportSection, tenant_id: str, analytics_filter) -> ReportChart:
        """Generate chart section"""
        chart_config = section.config
        chart_type = chart_config.get("chart_type", "line")
        data_source = chart_config.get("data_source", "volume_analytics")
        
        chart = ReportChart(
            name=section.name,
            title=section.title,
            chart_type=chart_type,
            x_axis=chart_config.get("x_axis", "period"),
            y_axis=chart_config.get("y_axis", "value")
        )
        
        if data_source == "volume_analytics" and self.analytics_service:
            volume_data = await self.analytics_service.get_volume_analytics(tenant_id, analytics_filter)
            chart.data = volume_data.trends
            
        elif data_source == "vendor_performance" and self.analytics_service:
            vendor_data = await self.analytics_service.get_vendor_performance(tenant_id, analytics_filter)
            chart.data = [
                {
                    "vendor": vendor.vendor_name,
                    "contracts": vendor.contract_count,
                    "value": float(vendor.total_value)
                }
                for vendor in vendor_data[:10]  # Top 10
            ]
        
        return chart
    
    async def _generate_table_section(self, section: ReportSection, tenant_id: str, analytics_filter) -> ReportTable:
        """Generate table section"""
        table_config = section.config
        data_source = table_config.get("data_source", "vendor_performance")
        
        table = ReportTable(
            name=section.name,
            title=section.title
        )
        
        if data_source == "vendor_performance" and self.analytics_service:
            vendor_data = await self.analytics_service.get_vendor_performance(tenant_id, analytics_filter)
            
            table.headers = ["Vendor Name", "Contracts", "Total Value", "Renewal Rate", "Risk Score", "SLA Compliance"]
            table.rows = []
            
            for vendor in vendor_data:
                table.rows.append([
                    vendor.vendor_name,
                    vendor.contract_count,
                    f"${vendor.total_value:,.2f}",
                    f"{vendor.renewal_rate:.1f}%",
                    f"{vendor.risk_score:.1f}",
                    f"{vendor.sla_compliance:.1f}%"
                ])
        
        elif data_source == "spend_analytics" and self.analytics_service:
            spend_data = await self.analytics_service.get_spend_analytics(tenant_id, analytics_filter)
            
            table.headers = ["Department", "Total Spend", "Contract Count"]
            table.rows = []
            
            for dept in spend_data.spend_by_department:
                table.rows.append([
                    dept["department"],
                    f"${dept['total_spend']:,.2f}",
                    dept["contract_count"]
                ])
        
        return table
    
    async def _generate_text_section(self, section: ReportSection, tenant_id: str, analytics_filter) -> str:
        """Generate text section"""
        text_content = section.config.get("content", "")
        
        # Simple template variable replacement
        if "{{total_contracts}}" in text_content and self.analytics_service:
            metrics = await self.analytics_service.get_contract_metrics(tenant_id, analytics_filter)
            text_content = text_content.replace("{{total_contracts}}", str(metrics.total_contracts))
        
        return text_content
    
    async def _generate_custom_section(self, section: ReportSection, tenant_id: str, analytics_filter) -> Dict[str, Any]:
        """Generate custom section with SQL query"""
        custom_config = section.config
        sql_query = custom_config.get("sql_query", "")
        
        if not sql_query or not self.db:
            return {"error": "No SQL query provided or database unavailable"}
        
        try:
            # Add tenant isolation to custom queries
            if "WHERE" in sql_query.upper():
                sql_query += f" AND tenant_id = '{tenant_id}'"
            else:
                sql_query += f" WHERE tenant_id = '{tenant_id}'"
            
            result = await self.db.execute(text(sql_query))
            rows = result.fetchall()
            
            # Convert to chart data if chart_type specified
            chart_type = custom_config.get("chart_type")
            if chart_type and rows:
                chart_data = []
                for row in rows:
                    if len(row) >= 2:
                        chart_data.append({
                            "x": row[0],
                            "y": row[1] if isinstance(row[1], (int, float)) else 1
                        })
                return {"chart": {"type": chart_type, "data": chart_data}}
            
            # Return as table data
            return {
                "table": {
                    "headers": list(result.keys()) if result.keys() else [],
                    "rows": [list(row) for row in rows]
                }
            }
            
        except Exception as e:
            return {"error": f"Custom query failed: {str(e)}"}
    
    async def _generate_summary(self, result: ReportResult, config: ReportConfig) -> str:
        """Generate report summary"""
        summary_parts = []
        
        # Basic summary based on metrics
        if result.metrics:
            total_contracts = next((m.value for m in result.metrics if m.name == "total_contracts"), 0)
            active_contracts = next((m.value for m in result.metrics if m.name == "active_contracts"), 0)
            
            summary_parts.append(
                f"This {config.report_type} report covers {total_contracts} total contracts, "
                f"with {active_contracts} currently active."
            )
        
        # Add insights based on report type
        if config.report_type == ReportType.EXECUTIVE:
            summary_parts.append(
                "Key performance indicators show stable contract portfolio growth "
                "with opportunities for optimization in vendor management and renewal processes."
            )
        elif config.report_type == ReportType.COMPLIANCE:
            summary_parts.append(
                "Compliance monitoring indicates strong adherence to regulatory requirements "
                "with focused attention needed on high-risk contract categories."
            )
        
        return " ".join(summary_parts)
    
    async def _generate_recommendations(self, result: ReportResult, config: ReportConfig) -> List[str]:
        """Generate report recommendations"""
        recommendations = []
        
        # Generate recommendations based on metrics
        if result.metrics:
            renewal_rate = next((m.value for m in result.metrics if m.name == "renewal_rate"), 0)
            if renewal_rate < 80:
                recommendations.append("Consider implementing proactive renewal management to improve retention rates.")
            
            compliance_score = next((m.value for m in result.metrics if m.name == "compliance_score"), 100)
            if compliance_score < 90:
                recommendations.append("Enhance compliance monitoring and remediation processes to reduce regulatory risk.")
        
        # Type-specific recommendations
        if config.report_type == ReportType.FINANCIAL:
            recommendations.append("Review vendor spend concentration to identify cost optimization opportunities.")
        
        elif config.report_type == ReportType.RISK:
            recommendations.append("Implement enhanced risk scoring for high-value contracts to improve portfolio visibility.")
        
        return recommendations
    
    async def create_report_template(
        self,
        tenant_id: str,
        template: ReportTemplate,
        user_id: str
    ) -> str:
        """Create a new report template"""
        template.id = str(uuid4())
        template.tenant_id = tenant_id
        template.created_by = user_id
        template.created_at = datetime.utcnow()
        
        # Validate template
        is_valid, errors = validate_report_template(template)
        if not is_valid:
            raise Exception(f"Invalid template: {', '.join(errors)}")
        
        if self.db:
            # Save to database (mock implementation)
            self.db.add(template)
            await self.db.commit()
        
        return template.id
    
    async def update_report_template(
        self,
        template_id: str,
        template: ReportTemplate,
        user_id: str
    ) -> bool:
        """Update existing report template"""
        template.updated_at = datetime.utcnow()
        
        if self.db:
            # Update in database (mock implementation)
            pass
        
        return True
    
    async def get_report_template(self, template_id: str) -> Optional[ReportTemplate]:
        """Get report template by ID"""
        if self.db:
            # Query database (mock implementation)
            pass
        
        # Mock return
        return ReportTemplate(
            id=template_id,
            name="Updated Template Name",
            description="Template description",
            report_type=ReportType.OPERATIONAL,
            template_content={}
        )
    
    async def create_report_schedule(
        self,
        tenant_id: str,
        schedule: ReportSchedule,
        user_id: str
    ) -> str:
        """Create a new report schedule"""
        schedule.id = str(uuid4())
        schedule.tenant_id = tenant_id
        schedule.created_by = user_id
        schedule.created_at = datetime.utcnow()
        schedule.next_run = calculate_next_run(schedule.frequency, schedule.schedule_time)
        
        if self.db:
            # Save to database (mock implementation)
            self.db.add(schedule)
            await self.db.commit()
        
        return schedule.id
    
    async def execute_scheduled_reports(self) -> int:
        """Execute all scheduled reports that are due"""
        if not self.db:
            return 0
        
        # Mock implementation - get due reports
        due_reports = []  # Would query database for due reports
        
        executed_count = 0
        for scheduled_report in due_reports:
            try:
                result = await self.generate_report(
                    tenant_id=scheduled_report.tenant_id,
                    config=scheduled_report.config,
                    user_id="system"
                )
                
                if result.status == "completed":
                    # Send to recipients
                    await self._send_scheduled_report(result, scheduled_report)
                    executed_count += 1
                
                # Update schedule
                scheduled_report.last_run = datetime.utcnow()
                scheduled_report.next_run = calculate_next_run(
                    scheduled_report.frequency,
                    scheduled_report.schedule_time
                )
                scheduled_report.run_count += 1
                
            except Exception as e:
                # Update error count
                scheduled_report.error_count += 1
                if scheduled_report.error_count > 5:
                    scheduled_report.status = ScheduleStatus.FAILED
        
        return executed_count
    
    async def _convert_filters(self, report_filter: Optional[ReportFilter]) -> Optional[Any]:
        """Convert report filters to analytics filters"""
        if not report_filter:
            return None
        
        # Mock conversion - would import and use actual analytics filter
        class MockAnalyticsFilter:
            def __init__(self):
                self.departments = report_filter.departments
                self.contract_types = report_filter.contract_types
                self.statuses = report_filter.statuses
                self.start_date = report_filter.start_date
                self.end_date = report_filter.end_date
                
                if report_filter.date_range:
                    now = datetime.utcnow()
                    if report_filter.date_range == "last_month":
                        self.start_date = now - timedelta(days=30)
                        self.end_date = now
                    elif report_filter.date_range == "last_quarter":
                        self.start_date = now - timedelta(days=90)
                        self.end_date = now
        
        return MockAnalyticsFilter()
    
    async def _check_report_permissions(self, user_id: str, report_type: ReportType, tenant_id: str) -> bool:
        """Check if user has permission to generate report type"""
        # Mock permission check - would integrate with RBAC system
        return True
    
    async def _send_report_email(self, result: ReportResult, email_config: Dict[str, Any]) -> bool:
        """Send report via email"""
        # Mock email sending
        return True
    
    async def _send_scheduled_report(self, result: ReportResult, schedule: ReportSchedule) -> bool:
        """Send scheduled report to recipients"""
        # Mock scheduled report delivery
        return True
    
    async def _save_report_history(self, result: ReportResult) -> bool:
        """Save report generation to history"""
        if self.db:
            # Mock save to history table
            self.db.add(result)
            await self.db.commit()
        return True
    
    def _generate_cache_key(self, tenant_id: str, config: ReportConfig) -> str:
        """Generate cache key for report"""
        config_hash = hashlib.md5(
            f"{tenant_id}:{config.title}:{config.report_type}:{config.format}:"
            f"{len(config.sections)}:{config.filters}".encode()
        ).hexdigest()
        
        return f"report:{tenant_id}:{config_hash}"


# Report generators for different formats
class PDFReportGenerator:
    """PDF report generator"""
    
    async def generate(self, result: ReportResult, config: ReportConfig) -> bytes:
        """Generate PDF report"""
        # Mock PDF generation
        pdf_content = f"PDF Report: {result.title}\n"
        pdf_content += f"Generated: {result.generated_at}\n"
        pdf_content += f"Sections: {len(result.sections)}\n"
        
        for section in result.sections:
            pdf_content += f"\n{section.get('title', 'Section')}\n"
            if section.get('type') == 'metrics':
                metrics = section.get('metrics', [])
                for metric in metrics:
                    pdf_content += f"- {metric.title}: {metric.value}\n"
        
        return pdf_content.encode('utf-8')


class ExcelReportGenerator:
    """Excel report generator"""
    
    async def generate(self, result: ReportResult, config: ReportConfig) -> bytes:
        """Generate Excel report"""
        # Mock Excel generation
        excel_content = f"Excel Report: {result.title}\n"
        excel_content += "Worksheet: Summary\n"
        
        for table in result.tables:
            excel_content += f"\nTable: {table.title}\n"
            excel_content += ",".join(table.headers) + "\n"
            for row in table.rows:
                excel_content += ",".join(str(cell) for cell in row) + "\n"
        
        return excel_content.encode('utf-8')


class HTMLReportGenerator:
    """HTML report generator"""
    
    async def generate(self, result: ReportResult, config: ReportConfig) -> str:
        """Generate HTML report"""
        html_content = f"""
        <html>
        <head><title>{result.title}</title></head>
        <body>
            <h1>{result.title}</h1>
            <p>Generated: {result.generated_at}</p>
        """
        
        for section in result.sections:
            html_content += f"<h2>{section.get('title', 'Section')}</h2>"
            if section.get('type') == 'metrics':
                html_content += "<ul>"
                metrics = section.get('metrics', [])
                for metric in metrics:
                    html_content += f"<li>{metric.title}: {metric.value}</li>"
                html_content += "</ul>"
        
        html_content += "</body></html>"
        return html_content


class CSVReportGenerator:
    """CSV report generator"""
    
    async def generate(self, result: ReportResult, config: ReportConfig) -> str:
        """Generate CSV report"""
        csv_content = f"Report,{result.title}\n"
        csv_content += f"Generated,{result.generated_at}\n\n"
        
        # Add metrics as CSV
        if result.metrics:
            csv_content += "Metric,Value\n"
            for metric in result.metrics:
                csv_content += f"{metric.title},{metric.value}\n"
        
        # Add tables as CSV
        for table in result.tables:
            csv_content += f"\n{table.title}\n"
            csv_content += ",".join(table.headers) + "\n"
            for row in table.rows:
                csv_content += ",".join(str(cell) for cell in row) + "\n"
        
        return csv_content


# Helper functions
def validate_report_config(config: ReportConfig) -> Tuple[bool, List[str]]:
    """Validate report configuration"""
    errors = []
    
    if not config.title or config.title.strip() == "":
        errors.append("Report title is required")
    
    if not config.sections:
        errors.append("Report must have at least one section")
    
    for section in config.sections:
        if not section.name or not section.title:
            errors.append(f"Section must have name and title")
    
    return len(errors) == 0, errors


def validate_report_template(template: ReportTemplate) -> Tuple[bool, List[str]]:
    """Validate report template"""
    errors = []
    
    if not template.name or template.name.strip() == "":
        errors.append("Template name is required")
    
    if not template.description:
        errors.append("Template description is required")
    
    return len(errors) == 0, errors


def calculate_next_run(
    frequency: ReportFrequency,
    schedule_time: str,
    day_of_week: Optional[int] = None,
    day_of_month: Optional[int] = None
) -> datetime:
    """Calculate next run time for scheduled report"""
    now = datetime.utcnow()
    
    # Parse time
    try:
        hour, minute = map(int, schedule_time.split(':'))
    except:
        hour, minute = 9, 0  # Default to 9:00 AM
    
    if frequency == ReportFrequency.DAILY:
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
    
    elif frequency == ReportFrequency.WEEKLY:
        days_ahead = (day_of_week or 0) - now.weekday()
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        next_run = now + timedelta(days=days_ahead)
        next_run = next_run.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    elif frequency == ReportFrequency.MONTHLY:
        target_day = day_of_month or 1
        next_run = now.replace(day=target_day, hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            # Move to next month
            if next_run.month == 12:
                next_run = next_run.replace(year=next_run.year + 1, month=1)
            else:
                next_run = next_run.replace(month=next_run.month + 1)
    
    else:
        # Default to next day
        next_run = now + timedelta(days=1)
        next_run = next_run.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    return next_run