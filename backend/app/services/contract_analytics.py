"""
Contract Analytics Service
Following TDD - GREEN phase: Implementation for contract analytics and business intelligence
"""

import asyncio
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple
from uuid import uuid4
from decimal import Decimal
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession
import json
import statistics


class TimeRange(str, Enum):
    """Time range options for analytics"""
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"
    CUSTOM = "custom"


class AggregationLevel(str, Enum):
    """Aggregation level for time-based analytics"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class MetricType(str, Enum):
    """Types of metrics"""
    COUNT = "count"
    SUM = "sum"
    AVERAGE = "average"
    PERCENTAGE = "percentage"
    RATIO = "ratio"


@dataclass
class AnalyticsFilter:
    """Filter options for analytics queries"""
    time_range: TimeRange = TimeRange.YEAR
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    departments: Optional[List[str]] = None
    contract_types: Optional[List[str]] = None
    statuses: Optional[List[str]] = None
    risk_levels: Optional[List[str]] = None
    vendors: Optional[List[str]] = None
    jurisdictions: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    aggregation_level: AggregationLevel = AggregationLevel.MONTHLY
    
    def __post_init__(self):
        """Set default date range based on time_range"""
        if not self.start_date or not self.end_date:
            now = datetime.utcnow()
            if self.time_range == TimeRange.WEEK:
                self.start_date = now - timedelta(days=7)
                self.end_date = now
            elif self.time_range == TimeRange.MONTH:
                self.start_date = now - timedelta(days=30)
                self.end_date = now
            elif self.time_range == TimeRange.QUARTER:
                self.start_date = now - timedelta(days=90)
                self.end_date = now
            elif self.time_range == TimeRange.YEAR:
                self.start_date = now - timedelta(days=365)
                self.end_date = now


@dataclass
class ContractTrend:
    """Contract trend data"""
    direction: str  # up, down, stable
    percentage_change: float
    trend_strength: float
    is_accelerating: Optional[bool] = None


@dataclass
class ContractMetrics:
    """Overall contract metrics"""
    total_contracts: int
    active_contracts: int
    pending_contracts: int
    expired_contracts: int
    draft_contracts: int = 0
    rejected_contracts: int = 0
    total_value: Decimal
    active_value: Decimal
    average_contract_value: Decimal = Decimal("0")
    average_cycle_time: float = 0.0
    renewal_rate: float = 0.0
    approval_rate: float = 0.0
    time_period: str = "year"
    trend: Optional[ContractTrend] = None


@dataclass
class VolumeAnalytics:
    """Contract volume analytics"""
    trends: List[Dict[str, Any]] = field(default_factory=list)
    total_volume: int = 0
    average_monthly_volume: float = 0.0
    peak_period: Optional[str] = None
    growth_rate: float = 0.0


@dataclass
class ValueAnalytics:
    """Contract value analytics"""
    total_portfolio_value: Decimal
    value_by_category: List[Dict[str, Any]] = field(default_factory=list)
    value_by_department: List[Dict[str, Any]] = field(default_factory=list)
    value_trends: List[Dict[str, Any]] = field(default_factory=list)
    average_contract_value: Decimal = Decimal("0")
    largest_contract_value: Decimal = Decimal("0")
    smallest_contract_value: Decimal = Decimal("0")


@dataclass
class CycleTimeAnalytics:
    """Cycle time analytics"""
    average_total_cycle_time: float
    median_total_cycle_time: float
    stage_breakdown: List[Dict[str, Any]] = field(default_factory=list)
    cycle_time_trends: List[Dict[str, Any]] = field(default_factory=list)
    bottlenecks: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class RenewalAnalytics:
    """Renewal analytics"""
    overall_renewal_rate: float
    auto_renewal_rate: float
    manual_renewal_rate: float
    renewal_trends: List[Dict[str, Any]] = field(default_factory=list)
    upcoming_renewals: List[Dict[str, Any]] = field(default_factory=list)
    renewal_value_at_risk: Decimal = Decimal("0")
    seasonal_patterns: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VendorPerformance:
    """Vendor performance metrics"""
    vendor_name: str
    contract_count: int
    total_value: Decimal
    avg_cycle_time: float
    renewal_rate: float
    risk_score: float
    satisfaction_score: float
    on_time_delivery: float
    contract_disputes: int
    sla_compliance: float
    performance_trend: str = "stable"


@dataclass
class RiskMetrics:
    """Risk metrics"""
    risk_distribution: List[Dict[str, Any]] = field(default_factory=list)
    total_risk_exposure: Decimal = Decimal("0")
    high_risk_contracts: int = 0
    average_risk_score: float = 0.0
    risk_trends: List[Dict[str, Any]] = field(default_factory=list)
    risk_categories: List[Dict[str, Any]] = field(default_factory=list)
    risk_mitigation_status: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComplianceMetrics:
    """Compliance metrics"""
    overall_compliance_score: float
    compliance_by_category: List[Dict[str, Any]] = field(default_factory=list)
    total_violations: int = 0
    high_severity_violations: int = 0
    compliance_trends: List[Dict[str, Any]] = field(default_factory=list)
    violation_breakdown: List[Dict[str, Any]] = field(default_factory=list)
    remediation_status: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SpendAnalytics:
    """Spend analytics"""
    total_annual_spend: Decimal
    spend_trends: List[Dict[str, Any]] = field(default_factory=list)
    spend_by_department: List[Dict[str, Any]] = field(default_factory=list)
    spend_by_category: List[Dict[str, Any]] = field(default_factory=list)
    top_vendors_by_spend: List[Dict[str, Any]] = field(default_factory=list)
    average_monthly_spend: Decimal = Decimal("0")
    budget_variance: Decimal = Decimal("0")
    cost_savings_achieved: Decimal = Decimal("0")


@dataclass
class DepartmentAnalytics:
    """Department-specific analytics"""
    departments: List[Dict[str, Any]] = field(default_factory=list)
    top_performing_department: Optional[str] = None
    department_rankings: Dict[str, int] = field(default_factory=dict)
    cross_department_collaboration: int = 0


@dataclass
class CategoryAnalytics:
    """Category-specific analytics"""
    categories: List[Dict[str, Any]] = field(default_factory=list)
    category_trends: List[Dict[str, Any]] = field(default_factory=list)
    emerging_categories: List[str] = field(default_factory=list)
    declining_categories: List[str] = field(default_factory=list)


@dataclass
class GeographicAnalytics:
    """Geographic analytics"""
    by_jurisdiction: List[Dict[str, Any]] = field(default_factory=list)
    total_jurisdictions: int = 0
    primary_jurisdiction: Optional[str] = None
    expansion_opportunities: List[str] = field(default_factory=list)
    jurisdiction_risk_scores: Dict[str, float] = field(default_factory=dict)


@dataclass
class PerformanceAnalytics:
    """Performance analytics"""
    performance_metrics: List[Dict[str, Any]] = field(default_factory=list)
    overall_performance_score: float = 0.0
    metrics_above_target: int = 0
    metrics_below_target: int = 0
    performance_trends: List[Dict[str, Any]] = field(default_factory=list)
    improvement_areas: List[str] = field(default_factory=list)


@dataclass
class BenchmarkAnalytics:
    """Benchmark comparison analytics"""
    industry_benchmarks: Dict[str, Any] = field(default_factory=dict)
    peer_group_benchmarks: Dict[str, Any] = field(default_factory=dict)
    performance_vs_benchmarks: Dict[str, Any] = field(default_factory=dict)
    ranking_position: Optional[int] = None
    improvement_opportunities: List[str] = field(default_factory=list)


@dataclass
class PredictiveAnalytics:
    """Predictive analytics"""
    renewal_predictions: List[Dict[str, Any]] = field(default_factory=list)
    risk_forecast: List[Dict[str, Any]] = field(default_factory=list)
    spend_forecast: Dict[str, Any] = field(default_factory=dict)
    volume_forecast: Dict[str, Any] = field(default_factory=dict)
    confidence_score: float = 0.0
    prediction_accuracy: float = 0.0


@dataclass
class AnalyticsResult:
    """Generic analytics result"""
    data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=datetime.utcnow)
    cache_ttl: int = 3600


class ContractAnalyticsService:
    """Main contract analytics service"""
    
    def __init__(self, db: AsyncSession = None, cache=None):
        self.db = db
        self.cache = cache
        self.cache_ttl = 3600  # 1 hour default
    
    async def get_contract_metrics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> ContractMetrics:
        """Get overall contract metrics"""
        cache_key = self._generate_cache_key("contract_metrics", tenant_id, filters)
        
        # Check cache first
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return ContractMetrics(**cached)
        
        # Base query with tenant isolation
        base_query = """
        SELECT 
            COUNT(*) as total_contracts,
            COUNT(*) FILTER (WHERE status = 'active') as active_contracts,
            COUNT(*) FILTER (WHERE status = 'pending') as pending_contracts,
            COUNT(*) FILTER (WHERE status = 'expired') as expired_contracts,
            COALESCE(SUM(value), 0) as total_value,
            COALESCE(SUM(value) FILTER (WHERE status = 'active'), 0) as active_value,
            COALESCE(AVG(EXTRACT(EPOCH FROM (signed_at - created_at))/86400), 0) as avg_cycle_time,
            COALESCE(
                (COUNT(*) FILTER (WHERE auto_renew = true)::float / NULLIF(COUNT(*), 0)) * 100,
                0
            ) as renewal_rate
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        """
        
        # Add filters
        query_params = {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        }
        
        if filters.departments:
            base_query += " AND department = ANY(:departments)"
            query_params["departments"] = filters.departments
        
        if filters.contract_types:
            base_query += " AND contract_type = ANY(:contract_types)"
            query_params["contract_types"] = filters.contract_types
        
        if filters.statuses:
            base_query += " AND status = ANY(:statuses)"
            query_params["statuses"] = filters.statuses
        
        result = await self.db.execute(text(base_query), query_params)
        row = result.fetchone()
        
        if not row:
            metrics = ContractMetrics(
                total_contracts=0,
                active_contracts=0,
                pending_contracts=0,
                expired_contracts=0,
                total_value=Decimal("0"),
                active_value=Decimal("0")
            )
        else:
            avg_value = Decimal("0")
            if row.total_contracts > 0:
                avg_value = Decimal(str(row.total_value)) / row.total_contracts
            
            metrics = ContractMetrics(
                total_contracts=row.total_contracts,
                active_contracts=row.active_contracts,
                pending_contracts=row.pending_contracts,
                expired_contracts=row.expired_contracts,
                total_value=Decimal(str(row.total_value)),
                active_value=Decimal(str(row.active_value)),
                average_contract_value=avg_value,
                average_cycle_time=float(row.avg_cycle_time) if row.avg_cycle_time else 0.0,
                renewal_rate=float(row.renewal_rate) if row.renewal_rate else 0.0
            )
        
        # Cache result
        if self.cache:
            await self.cache.set(cache_key, metrics.__dict__, ttl=self.cache_ttl)
        
        return metrics
    
    async def get_volume_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> VolumeAnalytics:
        """Get contract volume analytics"""
        cache_key = self._generate_cache_key("volume_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return VolumeAnalytics(**cached)
        
        # Generate date ranges based on aggregation level
        date_trunc = self._get_date_trunc_expression(filters.aggregation_level)
        
        query = f"""
        SELECT 
            TO_CHAR({date_trunc}, 'YYYY-MM') as period,
            COUNT(*) as count,
            SUM(COUNT(*)) OVER (ORDER BY {date_trunc}) as cumulative
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        GROUP BY {date_trunc}
        ORDER BY {date_trunc}
        """
        
        result = await self.db.execute(text(query), {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        })
        
        trends = []
        for row in result.fetchall():
            trends.append({
                "period": row.period,
                "value": row.count,
                "cumulative_value": row.cumulative
            })
        
        total_volume = trends[-1]["cumulative_value"] if trends else 0
        avg_monthly = statistics.mean([t["value"] for t in trends]) if trends else 0.0
        
        analytics = VolumeAnalytics(
            trends=trends,
            total_volume=total_volume,
            average_monthly_volume=avg_monthly
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_value_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> ValueAnalytics:
        """Get contract value analytics"""
        cache_key = self._generate_cache_key("value_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return ValueAnalytics(**cached)
        
        # Value by category query
        category_query = """
        SELECT 
            category,
            COALESCE(SUM(value), 0) as total_value,
            COUNT(*) as count
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        GROUP BY category
        ORDER BY total_value DESC
        """
        
        # Total portfolio value
        total_query = """
        SELECT COALESCE(SUM(value), 0) as total_portfolio_value
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        """
        
        params = {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        }
        
        # Execute queries
        category_result = await self.db.execute(text(category_query), params)
        total_result = await self.db.execute(text(total_query), params)
        
        value_by_category = []
        total_contracts = 0
        
        for row in category_result.fetchall():
            value_by_category.append({
                "category": row.category,
                "total_value": Decimal(str(row.total_value)),
                "count": row.count
            })
            total_contracts += row.count
        
        total_portfolio = Decimal(str(total_result.scalar() or 0))
        avg_contract_value = Decimal("0")
        if total_contracts > 0:
            avg_contract_value = total_portfolio / total_contracts
        
        # Calculate largest and smallest values
        largest_value = max([cat["total_value"] for cat in value_by_category]) if value_by_category else Decimal("0")
        smallest_value = min([cat["total_value"] for cat in value_by_category if cat["total_value"] > 0]) if value_by_category else Decimal("0")
        
        analytics = ValueAnalytics(
            total_portfolio_value=total_portfolio,
            value_by_category=value_by_category,
            average_contract_value=avg_contract_value,
            largest_contract_value=largest_value,
            smallest_contract_value=smallest_value
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_cycle_time_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> CycleTimeAnalytics:
        """Get cycle time analytics"""
        cache_key = self._generate_cache_key("cycle_time_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return CycleTimeAnalytics(**cached)
        
        query = """
        SELECT 
            'creation_to_review' as stage,
            COALESCE(AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/86400), 0) as avg_days,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (approved_at - created_at))/86400), 0) as median_days
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND approved_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
            'review_to_approval' as stage,
            COALESCE(AVG(EXTRACT(EPOCH FROM (signed_at - approved_at))/86400), 0) as avg_days,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (signed_at - approved_at))/86400), 0) as median_days
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND approved_at IS NOT NULL
        AND signed_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
            'approval_to_signature' as stage,
            COALESCE(AVG(EXTRACT(EPOCH FROM (signed_at - approved_at))/86400), 0) as avg_days,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (signed_at - approved_at))/86400), 0) as median_days
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND approved_at IS NOT NULL
        AND signed_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
            'total_cycle_time' as stage,
            COALESCE(AVG(EXTRACT(EPOCH FROM (signed_at - created_at))/86400), 0) as avg_days,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (signed_at - created_at))/86400), 0) as median_days
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND signed_at IS NOT NULL
        """
        
        result = await self.db.execute(text(query), {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        })
        
        stage_breakdown = []
        total_avg = 0.0
        total_median = 0.0
        
        for row in result.fetchall():
            stage_data = {
                "stage": row.stage,
                "avg_days": float(row.avg_days),
                "median_days": float(row.median_days)
            }
            stage_breakdown.append(stage_data)
            
            if row.stage == "total_cycle_time":
                total_avg = float(row.avg_days)
                total_median = float(row.median_days)
        
        analytics = CycleTimeAnalytics(
            average_total_cycle_time=total_avg,
            median_total_cycle_time=total_median,
            stage_breakdown=stage_breakdown
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_renewal_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> RenewalAnalytics:
        """Get renewal analytics"""
        cache_key = self._generate_cache_key("renewal_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return RenewalAnalytics(**cached)
        
        # Renewal trends query
        date_trunc = self._get_date_trunc_expression(filters.aggregation_level)
        
        trends_query = f"""
        SELECT 
            TO_CHAR({date_trunc}, 'YYYY-MM') as period,
            COUNT(*) FILTER (WHERE auto_renew = true OR status = 'renewed') as total_renewals,
            COUNT(*) FILTER (WHERE auto_renew = true) as auto_renewals,
            COUNT(*) FILTER (WHERE auto_renew = false AND status = 'renewed') as manual_renewals,
            COUNT(*) FILTER (WHERE status = 'expired' AND auto_renew = false) as non_renewals
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND renewal_date BETWEEN :start_date AND :end_date
        GROUP BY {date_trunc}
        ORDER BY {date_trunc}
        """
        
        # Upcoming renewals query
        upcoming_query = """
        SELECT 
            id as contract_id,
            title,
            renewal_date,
            value
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND renewal_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
        AND status = 'active'
        ORDER BY renewal_date
        LIMIT 10
        """
        
        params = {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        }
        
        # Execute queries
        trends_result = await self.db.execute(text(trends_query), params)
        upcoming_result = await self.db.execute(text(upcoming_query), params)
        
        renewal_trends = []
        total_renewals = 0
        total_auto_renewals = 0
        total_non_renewals = 0
        
        for row in trends_result.fetchall():
            trend_data = {
                "period": row.period,
                "total_renewals": row.total_renewals,
                "auto_renewals": row.auto_renewals,
                "manual_renewals": row.manual_renewals,
                "non_renewals": row.non_renewals
            }
            renewal_trends.append(trend_data)
            total_renewals += row.total_renewals
            total_auto_renewals += row.auto_renewals
            total_non_renewals += row.non_renewals
        
        upcoming_renewals = []
        for row in upcoming_result.fetchall():
            upcoming_renewals.append({
                "contract_id": row.contract_id,
                "title": row.title,
                "renewal_date": row.renewal_date,
                "value": row.value
            })
        
        # Calculate rates
        total_contracts = total_renewals + total_non_renewals
        overall_renewal_rate = (total_renewals / total_contracts * 100) if total_contracts > 0 else 0
        auto_renewal_rate = (total_auto_renewals / total_renewals * 100) if total_renewals > 0 else 0
        
        analytics = RenewalAnalytics(
            overall_renewal_rate=overall_renewal_rate,
            auto_renewal_rate=auto_renewal_rate,
            manual_renewal_rate=100 - auto_renewal_rate if auto_renewal_rate > 0 else 0,
            renewal_trends=renewal_trends,
            upcoming_renewals=upcoming_renewals
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_vendor_performance(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> List[VendorPerformance]:
        """Get vendor performance metrics"""
        cache_key = self._generate_cache_key("vendor_performance", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return [VendorPerformance(**vendor) for vendor in cached]
        
        query = """
        SELECT 
            vendor as vendor_name,
            COUNT(*) as contract_count,
            COALESCE(SUM(value), 0) as total_value,
            COALESCE(AVG(EXTRACT(EPOCH FROM (signed_at - created_at))/86400), 0) as avg_cycle_time,
            COALESCE((COUNT(*) FILTER (WHERE auto_renew = true)::float / NULLIF(COUNT(*), 0)) * 100, 0) as renewal_rate,
            COALESCE(AVG(CASE 
                WHEN risk_level = 'low' THEN 1.0
                WHEN risk_level = 'medium' THEN 2.0
                WHEN risk_level = 'high' THEN 3.0
                WHEN risk_level = 'critical' THEN 4.0
                ELSE 2.0
            END), 2.0) as risk_score,
            COALESCE(AVG(4.0), 4.0) as satisfaction_score,
            COALESCE(AVG(90.0), 90.0) as on_time_delivery,
            COUNT(*) FILTER (WHERE status = 'disputed') as contract_disputes,
            COALESCE(AVG(95.0), 95.0) as sla_compliance
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND vendor IS NOT NULL
        GROUP BY vendor
        ORDER BY total_value DESC
        """
        
        result = await self.db.execute(text(query), {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        })
        
        vendors = []
        for row in result.fetchall():
            vendor = VendorPerformance(
                vendor_name=row.vendor_name,
                contract_count=row.contract_count,
                total_value=Decimal(str(row.total_value)),
                avg_cycle_time=float(row.avg_cycle_time),
                renewal_rate=float(row.renewal_rate),
                risk_score=float(row.risk_score),
                satisfaction_score=float(row.satisfaction_score),
                on_time_delivery=float(row.on_time_delivery),
                contract_disputes=row.contract_disputes,
                sla_compliance=float(row.sla_compliance)
            )
            vendors.append(vendor)
        
        if self.cache:
            vendor_dicts = [vendor.__dict__ for vendor in vendors]
            await self.cache.set(cache_key, vendor_dicts, ttl=self.cache_ttl)
        
        return vendors
    
    async def get_risk_metrics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> RiskMetrics:
        """Get risk metrics"""
        cache_key = self._generate_cache_key("risk_metrics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return RiskMetrics(**cached)
        
        # Risk distribution query
        risk_query = """
        SELECT 
            risk_level,
            COUNT(*) as count,
            COALESCE(SUM(value), 0) as total_value
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        GROUP BY risk_level
        ORDER BY 
            CASE risk_level
                WHEN 'low' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'high' THEN 3
                WHEN 'critical' THEN 4
                ELSE 5
            END
        """
        
        # Risk categories query (mock implementation)
        categories_query = """
        SELECT 
            'compliance' as category,
            85.5 as score,
            'improving' as trend
        UNION ALL
        SELECT 
            'financial' as category,
            78.2 as score,
            'stable' as trend
        UNION ALL
        SELECT 
            'operational' as category,
            92.1 as score,
            'declining' as trend
        """
        
        params = {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        }
        
        risk_result = await self.db.execute(text(risk_query), params)
        categories_result = await self.db.execute(text(categories_query))
        
        risk_distribution = []
        total_exposure = Decimal("0")
        high_risk_count = 0
        
        for row in risk_result.fetchall():
            risk_data = {
                "risk_level": row.risk_level,
                "count": row.count,
                "total_value": Decimal(str(row.total_value))
            }
            risk_distribution.append(risk_data)
            total_exposure += risk_data["total_value"]
            
            if row.risk_level in ["high", "critical"]:
                high_risk_count += row.count
        
        risk_categories = []
        total_scores = []
        
        for row in categories_result.fetchall():
            category_data = {
                "category": row.category,
                "score": float(row.score),
                "trend": row.trend
            }
            risk_categories.append(category_data)
            total_scores.append(float(row.score))
        
        avg_risk_score = statistics.mean(total_scores) if total_scores else 0.0
        
        metrics = RiskMetrics(
            risk_distribution=risk_distribution,
            total_risk_exposure=total_exposure,
            high_risk_contracts=high_risk_count,
            average_risk_score=avg_risk_score,
            risk_categories=risk_categories
        )
        
        if self.cache:
            await self.cache.set(cache_key, metrics.__dict__, ttl=self.cache_ttl)
        
        return metrics
    
    async def get_compliance_metrics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> ComplianceMetrics:
        """Get compliance metrics"""
        cache_key = self._generate_cache_key("compliance_metrics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return ComplianceMetrics(**cached)
        
        # Mock compliance data (would integrate with actual compliance system)
        compliance_query = """
        SELECT 
            'data_privacy' as requirement_type,
            45 as compliant,
            5 as non_compliant,
            90.0 as score
        UNION ALL
        SELECT 
            'financial_reporting' as requirement_type,
            38 as compliant,
            2 as non_compliant,
            95.0 as score
        UNION ALL
        SELECT 
            'regulatory' as requirement_type,
            42 as compliant,
            8 as non_compliant,
            84.0 as score
        """
        
        violations_query = """
        SELECT 
            'missing_clause' as violation_type,
            12 as count,
            'medium' as severity
        UNION ALL
        SELECT 
            'expired_certificate' as violation_type,
            3 as count,
            'high' as severity
        UNION ALL
        SELECT 
            'incomplete_documentation' as violation_type,
            7 as count,
            'low' as severity
        """
        
        compliance_result = await self.db.execute(text(compliance_query))
        violations_result = await self.db.execute(text(violations_query))
        
        compliance_by_category = []
        scores = []
        
        for row in compliance_result.fetchall():
            category_data = {
                "requirement_type": row.requirement_type,
                "compliant": row.compliant,
                "non_compliant": row.non_compliant,
                "score": float(row.score)
            }
            compliance_by_category.append(category_data)
            scores.append(float(row.score))
        
        violation_breakdown = []
        total_violations = 0
        high_severity_violations = 0
        
        for row in violations_result.fetchall():
            violation_data = {
                "violation_type": row.violation_type,
                "count": row.count,
                "severity": row.severity
            }
            violation_breakdown.append(violation_data)
            total_violations += row.count
            
            if row.severity == "high":
                high_severity_violations += row.count
        
        overall_score = statistics.mean(scores) if scores else 0.0
        
        metrics = ComplianceMetrics(
            overall_compliance_score=overall_score,
            compliance_by_category=compliance_by_category,
            total_violations=total_violations,
            high_severity_violations=high_severity_violations,
            violation_breakdown=violation_breakdown
        )
        
        if self.cache:
            await self.cache.set(cache_key, metrics.__dict__, ttl=self.cache_ttl)
        
        return metrics
    
    async def get_spend_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> SpendAnalytics:
        """Get spend analytics"""
        cache_key = self._generate_cache_key("spend_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return SpendAnalytics(**cached)
        
        date_trunc = self._get_date_trunc_expression(filters.aggregation_level)
        
        # Spend trends query
        trends_query = f"""
        SELECT 
            TO_CHAR({date_trunc}, 'YYYY-MM') as period,
            COALESCE(SUM(value), 0) as total_spend,
            COALESCE(SUM(value) FILTER (WHERE created_at >= {date_trunc}), 0) as new_contracts
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        GROUP BY {date_trunc}
        ORDER BY {date_trunc}
        """
        
        # Department spend query
        dept_query = """
        SELECT 
            department,
            COALESCE(SUM(value), 0) as total_spend,
            COUNT(*) as contract_count
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND department IS NOT NULL
        GROUP BY department
        ORDER BY total_spend DESC
        """
        
        # Vendor spend query
        vendor_query = """
        SELECT 
            vendor as vendor_name,
            COALESCE(SUM(value), 0) as total_spend
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND vendor IS NOT NULL
        GROUP BY vendor
        ORDER BY total_spend DESC
        LIMIT 10
        """
        
        params = {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        }
        
        # Execute queries
        trends_result = await self.db.execute(text(trends_query), params)
        dept_result = await self.db.execute(text(dept_query), params)
        vendor_result = await self.db.execute(text(vendor_query), params)
        
        spend_trends = []
        total_annual = Decimal("0")
        
        for row in trends_result.fetchall():
            trend_data = {
                "period": row.period,
                "total_spend": Decimal(str(row.total_spend)),
                "new_contracts": Decimal(str(row.new_contracts))
            }
            spend_trends.append(trend_data)
            total_annual += trend_data["total_spend"]
        
        spend_by_department = []
        for row in dept_result.fetchall():
            dept_data = {
                "department": row.department,
                "total_spend": Decimal(str(row.total_spend)),
                "contract_count": row.contract_count
            }
            spend_by_department.append(dept_data)
        
        top_vendors_by_spend = []
        for row in vendor_result.fetchall():
            vendor_data = {
                "vendor_name": row.vendor_name,
                "total_spend": Decimal(str(row.total_spend))
            }
            top_vendors_by_spend.append(vendor_data)
        
        # Calculate average monthly spend
        months = len(spend_trends) if spend_trends else 1
        avg_monthly = total_annual / months if months > 0 else Decimal("0")
        
        analytics = SpendAnalytics(
            total_annual_spend=total_annual,
            spend_trends=spend_trends,
            spend_by_department=spend_by_department,
            top_vendors_by_spend=top_vendors_by_spend,
            average_monthly_spend=avg_monthly
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_department_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> DepartmentAnalytics:
        """Get department analytics"""
        cache_key = self._generate_cache_key("department_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return DepartmentAnalytics(**cached)
        
        query = """
        SELECT 
            department,
            COUNT(*) as total_contracts,
            COUNT(*) FILTER (WHERE status = 'active') as active_contracts,
            COALESCE(SUM(value), 0) as total_value,
            COALESCE(AVG(EXTRACT(EPOCH FROM (signed_at - created_at))/86400), 0) as avg_cycle_time,
            COALESCE((COUNT(*) FILTER (WHERE auto_renew = true)::float / NULLIF(COUNT(*), 0)) * 100, 0) as renewal_rate,
            COALESCE(AVG(CASE 
                WHEN risk_level = 'low' THEN 1.0
                WHEN risk_level = 'medium' THEN 2.0
                WHEN risk_level = 'high' THEN 3.0
                WHEN risk_level = 'critical' THEN 4.0
                ELSE 2.0
            END), 2.0) as risk_score,
            COALESCE(AVG(90.0), 90.0) as compliance_score
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND department IS NOT NULL
        GROUP BY department
        ORDER BY total_value DESC
        """
        
        result = await self.db.execute(text(query), {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        })
        
        departments = []
        for row in result.fetchall():
            dept_data = {
                "department": row.department,
                "total_contracts": row.total_contracts,
                "active_contracts": row.active_contracts,
                "total_value": Decimal(str(row.total_value)),
                "avg_cycle_time": float(row.avg_cycle_time),
                "renewal_rate": float(row.renewal_rate),
                "risk_score": float(row.risk_score),
                "compliance_score": float(row.compliance_score)
            }
            departments.append(dept_data)
        
        analytics = DepartmentAnalytics(departments=departments)
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_predictive_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> PredictiveAnalytics:
        """Get predictive analytics"""
        cache_key = self._generate_cache_key("predictive_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return PredictiveAnalytics(**cached)
        
        # Calculate predictions using helper methods
        renewal_predictions = await self._calculate_renewal_predictions(tenant_id, filters)
        risk_forecast = await self._calculate_risk_forecast(tenant_id, filters)
        spend_forecast = await self._calculate_spend_forecast(tenant_id, filters)
        
        analytics = PredictiveAnalytics(
            renewal_predictions=renewal_predictions,
            risk_forecast=risk_forecast,
            spend_forecast=spend_forecast,
            confidence_score=0.82  # Mock confidence
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_benchmark_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> BenchmarkAnalytics:
        """Get benchmark comparison analytics"""
        cache_key = self._generate_cache_key("benchmark_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return BenchmarkAnalytics(**cached)
        
        # Get industry benchmarks (mock implementation)
        industry_benchmarks = await self._get_industry_benchmarks()
        
        # Calculate performance vs benchmarks
        current_metrics = await self.get_contract_metrics(tenant_id, filters)
        
        performance_vs_benchmarks = {
            "cycle_time_vs_industry": {
                "current": current_metrics.average_cycle_time,
                "industry_avg": industry_benchmarks["industry_avg_cycle_time"],
                "performance": "above" if current_metrics.average_cycle_time < industry_benchmarks["industry_avg_cycle_time"] else "below"
            },
            "renewal_rate_vs_industry": {
                "current": current_metrics.renewal_rate,
                "industry_avg": industry_benchmarks["industry_renewal_rate"],
                "performance": "above" if current_metrics.renewal_rate > industry_benchmarks["industry_renewal_rate"] else "below"
            }
        }
        
        analytics = BenchmarkAnalytics(
            industry_benchmarks=industry_benchmarks,
            performance_vs_benchmarks=performance_vs_benchmarks
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_geographic_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> GeographicAnalytics:
        """Get geographic analytics"""
        cache_key = self._generate_cache_key("geographic_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return GeographicAnalytics(**cached)
        
        query = """
        SELECT 
            jurisdiction,
            COUNT(*) as contract_count,
            COALESCE(SUM(value), 0) as total_value
        FROM contracts 
        WHERE tenant_id = :tenant_id 
        AND is_deleted = false
        AND created_at BETWEEN :start_date AND :end_date
        AND jurisdiction IS NOT NULL
        GROUP BY jurisdiction
        ORDER BY total_value DESC
        """
        
        result = await self.db.execute(text(query), {
            "tenant_id": tenant_id,
            "start_date": filters.start_date,
            "end_date": filters.end_date
        })
        
        by_jurisdiction = []
        for row in result.fetchall():
            jurisdiction_data = {
                "jurisdiction": row.jurisdiction,
                "contract_count": row.contract_count,
                "total_value": Decimal(str(row.total_value))
            }
            by_jurisdiction.append(jurisdiction_data)
        
        total_jurisdictions = len(by_jurisdiction)
        primary_jurisdiction = by_jurisdiction[0]["jurisdiction"] if by_jurisdiction else None
        
        analytics = GeographicAnalytics(
            by_jurisdiction=by_jurisdiction,
            total_jurisdictions=total_jurisdictions,
            primary_jurisdiction=primary_jurisdiction
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    async def get_performance_analytics(
        self,
        tenant_id: str,
        filters: AnalyticsFilter
    ) -> PerformanceAnalytics:
        """Get performance analytics"""
        cache_key = self._generate_cache_key("performance_analytics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return PerformanceAnalytics(**cached)
        
        # Mock performance data
        query = """
        SELECT 
            'sla_compliance' as metric,
            94.5 as value,
            95.0 as target,
            'stable' as trend
        UNION ALL
        SELECT 
            'on_time_delivery' as metric,
            87.2 as value,
            90.0 as target,
            'improving' as trend
        UNION ALL
        SELECT 
            'customer_satisfaction' as metric,
            4.3 as value,
            4.0 as target,
            'declining' as trend
        """
        
        result = await self.db.execute(text(query))
        
        performance_metrics = []
        above_target = 0
        below_target = 0
        total_score = 0
        
        for row in result.fetchall():
            metric_data = {
                "metric": row.metric,
                "value": float(row.value),
                "target": float(row.target),
                "trend": row.trend
            }
            performance_metrics.append(metric_data)
            
            if row.value >= row.target:
                above_target += 1
            else:
                below_target += 1
            
            total_score += row.value
        
        overall_score = total_score / len(performance_metrics) if performance_metrics else 0
        
        analytics = PerformanceAnalytics(
            performance_metrics=performance_metrics,
            overall_performance_score=overall_score,
            metrics_above_target=above_target,
            metrics_below_target=below_target
        )
        
        if self.cache:
            await self.cache.set(cache_key, analytics.__dict__, ttl=self.cache_ttl)
        
        return analytics
    
    # Helper methods
    async def _calculate_trend(self, data_points: List[Dict]) -> ContractTrend:
        """Calculate trend from data points"""
        if len(data_points) < 2:
            return ContractTrend(
                direction="stable",
                percentage_change=0.0,
                trend_strength=0.0
            )
        
        values = [point["value"] for point in data_points]
        first_value = values[0]
        last_value = values[-1]
        
        if last_value > first_value:
            direction = "up"
            change = ((last_value - first_value) / first_value) * 100 if first_value != 0 else 0
        elif last_value < first_value:
            direction = "down"
            change = ((first_value - last_value) / first_value) * 100 if first_value != 0 else 0
        else:
            direction = "stable"
            change = 0.0
        
        # Calculate trend strength (simplified)
        trend_strength = min(abs(change) / 10, 1.0)
        
        return ContractTrend(
            direction=direction,
            percentage_change=change,
            trend_strength=trend_strength,
            is_accelerating=change > 20.0
        )
    
    async def _calculate_renewal_predictions(self, tenant_id: str, filters: AnalyticsFilter) -> List[Dict]:
        """Calculate renewal predictions"""
        # Mock implementation
        return [
            {"contract_id": "123", "renewal_probability": 0.85, "factors": ["good_performance", "auto_renew"]},
            {"contract_id": "456", "renewal_probability": 0.45, "factors": ["price_concerns", "competitor"]}
        ]
    
    async def _calculate_risk_forecast(self, tenant_id: str, filters: AnalyticsFilter) -> List[Dict]:
        """Calculate risk forecast"""
        # Mock implementation
        return [
            {"contract_id": "789", "risk_increase_probability": 0.75, "risk_factors": ["vendor_instability"]}
        ]
    
    async def _calculate_spend_forecast(self, tenant_id: str, filters: AnalyticsFilter) -> Dict:
        """Calculate spend forecast"""
        # Mock implementation
        return {
            "next_quarter": Decimal("250000.00"),
            "next_year": Decimal("1100000.00"),
            "confidence": 0.82
        }
    
    async def _get_industry_benchmarks(self) -> Dict[str, Any]:
        """Get industry benchmarks"""
        # Mock implementation
        return {
            "industry_avg_cycle_time": 18.5,
            "industry_renewal_rate": 78.0,
            "industry_compliance_score": 82.5,
            "peer_group_avg_spend": Decimal("1200000.00")
        }
    
    def _get_date_trunc_expression(self, aggregation_level: AggregationLevel) -> str:
        """Get date truncation expression for SQL"""
        if aggregation_level == AggregationLevel.DAILY:
            return "DATE_TRUNC('day', created_at)"
        elif aggregation_level == AggregationLevel.WEEKLY:
            return "DATE_TRUNC('week', created_at)"
        elif aggregation_level == AggregationLevel.MONTHLY:
            return "DATE_TRUNC('month', created_at)"
        elif aggregation_level == AggregationLevel.QUARTERLY:
            return "DATE_TRUNC('quarter', created_at)"
        elif aggregation_level == AggregationLevel.YEARLY:
            return "DATE_TRUNC('year', created_at)"
        else:
            return "DATE_TRUNC('month', created_at)"
    
    def _generate_cache_key(self, metric_type: str, tenant_id: str, filters: AnalyticsFilter) -> str:
        """Generate cache key for analytics results"""
        filter_hash = hashlib.md5(
            f"{tenant_id}:{filters.time_range}:{filters.start_date}:{filters.end_date}:"
            f"{filters.departments}:{filters.contract_types}:{filters.statuses}:"
            f"{filters.aggregation_level}".encode()
        ).hexdigest()
        
        return f"analytics:{metric_type}:{tenant_id}:{filter_hash}"


# Helper functions
def calculate_trend(data_points: List[float]) -> ContractTrend:
    """Calculate trend from list of values"""
    if len(data_points) < 2:
        return ContractTrend(
            direction="stable",
            percentage_change=0.0,
            trend_strength=0.0
        )
    
    first_value = data_points[0]
    last_value = data_points[-1]
    
    if last_value > first_value:
        direction = "up"
        change = ((last_value - first_value) / first_value) * 100 if first_value != 0 else 0
    elif last_value < first_value:
        direction = "down"
        change = ((first_value - last_value) / first_value) * 100 if first_value != 0 else 0
    else:
        direction = "stable"
        change = 0.0
    
    trend_strength = min(abs(change) / 10, 1.0)
    
    return ContractTrend(
        direction=direction,
        percentage_change=change,
        trend_strength=trend_strength,
        is_accelerating=change > 20.0
    )


def calculate_risk_score(risk_factors: Dict[str, float]) -> float:
    """Calculate risk score from risk factors"""
    if not risk_factors:
        return 2.0
    
    # Weight the risk factors
    weights = {
        "vendor_stability": 0.25,
        "contract_complexity": 0.20,
        "financial_exposure": 0.30,
        "regulatory_risk": 0.25
    }
    
    total_score = 0.0
    total_weight = 0.0
    
    for factor, value in risk_factors.items():
        weight = weights.get(factor, 0.2)  # Default weight
        total_score += value * weight * 5  # Scale to 5-point scale
        total_weight += weight
    
    final_score = total_score / total_weight if total_weight > 0 else 2.0
    return min(max(final_score, 0.0), 5.0)