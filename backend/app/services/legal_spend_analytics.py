"""
Legal Spend Analytics Service
Following TDD - GREEN phase: Implementation for legal spend analytics and budget tracking
"""

import asyncio
import hashlib
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple, Union
from uuid import uuid4
from sqlalchemy import text, select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession


class SpendPeriod(str, Enum):
    """Spend analysis periods"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class BudgetStatus(str, Enum):
    """Budget status values"""
    DRAFT = "draft"
    ACTIVE = "active"
    LOCKED = "locked"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class OptimizationPriority(str, Enum):
    """Optimization recommendation priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class SpendFilter:
    """Spend analytics filters"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    departments: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    subcategories: Optional[List[str]] = None
    vendors: Optional[List[str]] = None
    cost_centers: Optional[List[str]] = None
    project_codes: Optional[List[str]] = None
    matter_types: Optional[List[str]] = None
    minimum_amount: Optional[Decimal] = None
    maximum_amount: Optional[Decimal] = None
    currency: Optional[str] = "USD"
    status: Optional[List[str]] = None
    billing_types: Optional[List[str]] = None


@dataclass
class BudgetFilter:
    """Budget analytics filters"""
    budget_year: Optional[int] = None
    budget_period: Optional[str] = None
    departments: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    cost_centers: Optional[List[str]] = None
    status: Optional[List[str]] = None
    include_historical: bool = True


@dataclass
class SpendTrend:
    """Spend trend analysis"""
    direction: str  # increasing, decreasing, stable
    growth_rate: float
    volatility: float
    seasonal_pattern: Optional[Dict[str, float]] = None
    confidence_level: float = 0.0


@dataclass
class BudgetVariance:
    """Budget variance details"""
    amount: Decimal
    percentage: float
    status: str  # over_budget, under_budget, on_budget
    trend: str   # favorable, unfavorable, neutral


@dataclass
class SpendMetrics:
    """Overall spend metrics"""
    total_spend: Decimal = Decimal("0.00")
    approved_spend: Decimal = Decimal("0.00")
    pending_spend: Decimal = Decimal("0.00")
    rejected_spend: Decimal = Decimal("0.00")
    total_transactions: int = 0
    average_transaction_amount: Decimal = Decimal("0.00")
    median_transaction_amount: Decimal = Decimal("0.00")
    largest_transaction_amount: Decimal = Decimal("0.00")
    smallest_transaction_amount: Decimal = Decimal("0.00")
    unique_vendors_count: int = 0
    unique_categories_count: int = 0
    average_approval_time: float = 0.0
    spend_growth_rate: float = 0.0
    period_comparison: Dict[str, Any] = field(default_factory=dict)
    currency: str = "USD"


@dataclass
class BudgetMetrics:
    """Budget metrics and utilization"""
    total_allocated: Decimal = Decimal("0.00")
    total_spent: Decimal = Decimal("0.00")
    total_committed: Decimal = Decimal("0.00")
    total_available: Decimal = Decimal("0.00")
    utilization_percentage: float = 0.0
    commitment_percentage: float = 0.0
    available_percentage: float = 0.0
    active_budgets_count: int = 0
    over_budget_count: int = 0
    under_budget_count: int = 0
    variance_amount: Decimal = Decimal("0.00")
    variance_percentage: float = 0.0
    budget_accuracy_score: float = 0.0
    currency: str = "USD"


@dataclass
class VendorSpendAnalytics:
    """Vendor spend analysis"""
    vendor_rankings: List[Dict[str, Any]] = field(default_factory=list)
    top_vendor_by_spend: Optional[str] = None
    top_vendor_by_transactions: Optional[str] = None
    vendor_concentration_ratio: float = 0.0  # Top 5 vendors as % of total spend
    total_vendor_count: int = 0
    preferred_vendor_spend_percentage: float = 0.0
    vendor_diversity_score: float = 0.0
    payment_term_analysis: Dict[str, Any] = field(default_factory=dict)
    vendor_risk_exposure: Decimal = Decimal("0.00")


@dataclass
class DepartmentSpendAnalytics:
    """Department spend analysis"""
    departments: List[Dict[str, Any]] = field(default_factory=list)
    highest_spend_department: Optional[str] = None
    most_efficient_department: Optional[str] = None
    total_departments: int = 0
    spend_concentration_ratio: float = 0.0
    average_spend_per_department: Decimal = Decimal("0.00")
    department_budget_performance: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CategorySpendAnalytics:
    """Category spend analysis"""
    categories: List[Dict[str, Any]] = field(default_factory=list)
    largest_category_by_spend: Optional[str] = None
    fastest_growing_category: Optional[str] = None
    total_categories: int = 0
    category_diversity_score: float = 0.0
    external_vs_internal_ratio: float = 0.0
    technology_spend_percentage: float = 0.0
    service_spend_percentage: float = 0.0


@dataclass
class SpendTrendData:
    """Individual spend trend data point"""
    period: str
    amount: Decimal
    transaction_count: int
    unique_vendors: int
    budget_allocated: Optional[Decimal] = None
    variance: Optional[Decimal] = None


@dataclass
class TimeSeriesSpendData:
    """Time series spend data"""
    trends: List[SpendTrendData] = field(default_factory=list)
    total_periods: int = 0
    growth_rate: float = 0.0
    volatility: float = 0.0
    seasonal_factors: Dict[str, float] = field(default_factory=dict)
    average_monthly_spend: Decimal = Decimal("0.00")
    peak_spend_period: Optional[str] = None
    lowest_spend_period: Optional[str] = None


@dataclass
class BudgetVarianceAnalysis:
    """Budget variance analysis"""
    category_variances: List[Dict[str, Any]] = field(default_factory=list)
    department_variances: List[Dict[str, Any]] = field(default_factory=list)
    total_variance: Decimal = Decimal("0.00")
    variance_percentage: float = 0.0
    categories_over_budget: int = 0
    categories_under_budget: int = 0
    favorable_variances: Decimal = Decimal("0.00")
    unfavorable_variances: Decimal = Decimal("0.00")
    variance_trends: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class CostOptimizationRecommendation:
    """Cost optimization recommendation"""
    id: str = field(default_factory=lambda: str(uuid4()))
    recommendation_type: str = ""
    title: str = ""
    description: str = ""
    potential_savings: Decimal = Decimal("0.00")
    implementation_effort: str = "medium"  # low, medium, high
    timeline_months: int = 3
    priority: OptimizationPriority = OptimizationPriority.MEDIUM
    impact_areas: List[str] = field(default_factory=list)
    success_metrics: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    action_items: List[str] = field(default_factory=list)
    confidence_score: float = 0.75


@dataclass
class SpendForecast:
    """Spend forecasting results"""
    forecast_periods: List[Dict[str, Any]] = field(default_factory=list)
    total_forecast_spend: Decimal = Decimal("0.00")
    confidence_level: float = 0.0
    forecast_method: str = "linear_regression"
    seasonal_adjustments: Dict[str, float] = field(default_factory=dict)
    risk_factors: List[str] = field(default_factory=list)
    upper_bound: Decimal = Decimal("0.00")
    lower_bound: Decimal = Decimal("0.00")


@dataclass
class BudgetAllocation:
    """Budget allocation details"""
    category: str
    amount: Decimal
    cost_center: str
    quarterly_distribution: List[float] = field(default_factory=lambda: [0.25, 0.25, 0.25, 0.25])
    approval_required: bool = True
    rollover_allowed: bool = False


@dataclass
class BudgetPlan:
    """Budget planning structure"""
    budget_year: int
    department: str
    total_budget: Decimal
    allocations: List[BudgetAllocation] = field(default_factory=list)
    approval_workflow: List[str] = field(default_factory=list)
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: BudgetStatus = BudgetStatus.DRAFT


@dataclass
class SpendAlert:
    """Spend monitoring alert"""
    id: str = field(default_factory=lambda: str(uuid4()))
    alert_type: str = ""
    title: str = ""
    description: str = ""
    severity: AlertSeverity = AlertSeverity.MEDIUM
    triggered_at: datetime = field(default_factory=datetime.utcnow)
    category: Optional[str] = None
    vendor: Optional[str] = None
    department: Optional[str] = None
    amount: Optional[Decimal] = None
    threshold: Optional[Decimal] = None
    recommendation: Optional[str] = None
    is_resolved: bool = False


@dataclass
class CostCenter:
    """Cost center information"""
    code: str
    name: str
    department: str
    budget_allocated: Decimal
    spend_to_date: Decimal
    manager: str
    status: str = "active"


@dataclass
class ActualSpend:
    """Actual spend data"""
    period: str
    category: str
    amount: Decimal
    transactions: int
    currency: str = "USD"


@dataclass
class VarianceAnalysis:
    """Detailed variance analysis"""
    variance_amount: Decimal
    variance_percentage: float
    classification: str  # favorable, unfavorable
    root_causes: List[str] = field(default_factory=list)
    corrective_actions: List[str] = field(default_factory=list)


@dataclass
class ROIAnalysis:
    """ROI analysis results"""
    category_roi: List[Dict[str, Any]] = field(default_factory=list)
    overall_roi: float = 0.0
    total_investment: Decimal = Decimal("0.00")
    total_cost_savings: Decimal = Decimal("0.00")
    total_time_savings_hours: float = 0.0
    payback_period_months: float = 0.0
    risk_mitigation_value: Decimal = Decimal("0.00")


@dataclass
class CostSavingsAnalysis:
    """Cost savings analysis"""
    total_savings: Decimal = Decimal("0.00")
    savings_by_category: List[Dict[str, Any]] = field(default_factory=list)
    savings_sources: List[Dict[str, Any]] = field(default_factory=list)
    year_over_year_savings: float = 0.0
    cumulative_savings: Decimal = Decimal("0.00")


@dataclass
class BenchmarkAnalysis:
    """Industry benchmark analysis"""
    industry_benchmarks: Dict[str, Any] = field(default_factory=dict)
    peer_comparisons: Dict[str, Any] = field(default_factory=dict)
    performance_vs_benchmarks: Dict[str, Any] = field(default_factory=dict)
    benchmark_score: float = 0.0
    improvement_opportunities: List[str] = field(default_factory=list)


@dataclass
class SpendRiskAnalysis:
    """Spend risk analysis"""
    risk_score: float = 0.0
    risk_factors: List[Dict[str, Any]] = field(default_factory=list)
    vendor_concentration_risk: float = 0.0
    budget_overrun_risk: float = 0.0
    contract_renewal_risk: float = 0.0
    mitigation_strategies: List[str] = field(default_factory=list)


class LegalSpendAnalyticsService:
    """Main legal spend analytics service"""
    
    def __init__(self, db: AsyncSession = None, cache=None, notification_service=None):
        self.db = db
        self.cache = cache
        self.notification_service = notification_service
    
    async def get_spend_metrics(
        self,
        tenant_id: str,
        filters: SpendFilter
    ) -> SpendMetrics:
        """Get overall spend metrics"""
        cache_key = self._generate_cache_key("spend_metrics", tenant_id, filters)
        
        # Check cache first
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return SpendMetrics(**cached)
        
        # Build base query
        base_query = """
        SELECT 
            SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_spend,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_spend,
            SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END) as rejected_spend,
            SUM(amount) as total_spend,
            COUNT(*) as total_transactions,
            AVG(amount) as average_transaction,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) as median_transaction,
            MAX(amount) as largest_transaction,
            MIN(amount) as smallest_transaction,
            COUNT(DISTINCT vendor) as unique_vendors,
            COUNT(DISTINCT category) as unique_categories,
            AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/3600.0) as avg_approval_hours
        FROM legal_spend 
        WHERE tenant_id = :tenant_id
        """
        
        params = {"tenant_id": tenant_id}
        conditions = []
        
        # Apply filters
        if filters.start_date:
            conditions.append("expense_date >= :start_date")
            params["start_date"] = filters.start_date
        
        if filters.end_date:
            conditions.append("expense_date <= :end_date")
            params["end_date"] = filters.end_date
        
        if filters.departments:
            conditions.append("department = ANY(:departments)")
            params["departments"] = filters.departments
        
        if filters.categories:
            conditions.append("category = ANY(:categories)")
            params["categories"] = filters.categories
        
        if filters.vendors:
            conditions.append("vendor = ANY(:vendors)")
            params["vendors"] = filters.vendors
        
        if filters.minimum_amount:
            conditions.append("amount >= :min_amount")
            params["min_amount"] = filters.minimum_amount
        
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        result = await self.db.execute(text(base_query), params)
        row = result.fetchone()
        
        metrics = SpendMetrics(
            total_spend=row.total_spend or Decimal("0.00"),
            approved_spend=row.approved_spend or Decimal("0.00"),
            pending_spend=row.pending_spend or Decimal("0.00"),
            rejected_spend=row.rejected_spend or Decimal("0.00"),
            total_transactions=row.total_transactions or 0,
            average_transaction_amount=row.average_transaction or Decimal("0.00"),
            median_transaction_amount=row.median_transaction or Decimal("0.00"),
            largest_transaction_amount=row.largest_transaction or Decimal("0.00"),
            smallest_transaction_amount=row.smallest_transaction or Decimal("0.00"),
            unique_vendors_count=row.unique_vendors or 0,
            unique_categories_count=row.unique_categories or 0,
            average_approval_time=row.avg_approval_hours or 0.0,
            currency=filters.currency or "USD"
        )
        
        # Calculate growth rate
        metrics.spend_growth_rate = await self._calculate_spend_growth(tenant_id, filters)
        
        # Cache result
        if self.cache:
            await self.cache.set(cache_key, metrics.__dict__, ttl=3600)
        
        return metrics
    
    async def get_budget_metrics(
        self,
        tenant_id: str,
        filters: BudgetFilter
    ) -> BudgetMetrics:
        """Get budget metrics and utilization"""
        cache_key = self._generate_cache_key("budget_metrics", tenant_id, filters)
        
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return BudgetMetrics(**cached)
        
        base_query = """
        SELECT 
            SUM(allocated_amount) as total_allocated,
            SUM(spent_amount) as total_spent,
            SUM(committed_amount) as total_committed,
            SUM(available_amount) as total_available,
            COUNT(*) as active_budgets,
            COUNT(CASE WHEN spent_amount > allocated_amount THEN 1 END) as over_budget_count,
            COUNT(CASE WHEN spent_amount < allocated_amount THEN 1 END) as under_budget_count
        FROM budget_allocations 
        WHERE tenant_id = :tenant_id AND status = 'active'
        """
        
        params = {"tenant_id": tenant_id}
        conditions = []
        
        if filters.budget_year:
            conditions.append("budget_year = :budget_year")
            params["budget_year"] = filters.budget_year
        
        if filters.departments:
            conditions.append("department = ANY(:departments)")
            params["departments"] = filters.departments
        
        if filters.categories:
            conditions.append("category = ANY(:categories)")
            params["categories"] = filters.categories
        
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        result = await self.db.execute(text(base_query), params)
        row = result.fetchone()
        
        total_allocated = row.total_allocated or Decimal("0.00")
        total_spent = row.total_spent or Decimal("0.00")
        
        metrics = BudgetMetrics(
            total_allocated=total_allocated,
            total_spent=total_spent,
            total_committed=row.total_committed or Decimal("0.00"),
            total_available=row.total_available or Decimal("0.00"),
            active_budgets_count=row.active_budgets or 0,
            over_budget_count=row.over_budget_count or 0,
            under_budget_count=row.under_budget_count or 0,
            variance_amount=total_spent - total_allocated,
            currency=filters.currency if hasattr(filters, 'currency') else "USD"
        )
        
        # Calculate percentages
        if total_allocated > 0:
            metrics.utilization_percentage = float((total_spent / total_allocated) * 100)
            metrics.commitment_percentage = float((metrics.total_committed / total_allocated) * 100)
            metrics.available_percentage = float((metrics.total_available / total_allocated) * 100)
            metrics.variance_percentage = float(((total_spent - total_allocated) / total_allocated) * 100)
        
        # Calculate budget accuracy score
        metrics.budget_accuracy_score = await self._calculate_budget_accuracy(tenant_id, filters)
        
        if self.cache:
            await self.cache.set(cache_key, metrics.__dict__, ttl=3600)
        
        return metrics
    
    async def get_vendor_spend_analytics(
        self,
        tenant_id: str,
        filters: SpendFilter
    ) -> VendorSpendAnalytics:
        """Get vendor spend analysis"""
        vendor_query = """
        SELECT 
            vendor as vendor_name,
            SUM(amount) as total_spend,
            COUNT(*) as transaction_count,
            AVG(amount) as average_transaction,
            ARRAY_AGG(DISTINCT category) as categories,
            MAX(expense_date) as last_transaction_date,
            MAX(payment_terms) as payment_terms,
            MAX(preferred_vendor::boolean) as preferred_vendor,
            AVG(risk_score) as risk_score,
            AVG(performance_rating) as performance_rating
        FROM legal_spend 
        WHERE tenant_id = :tenant_id
        """
        
        params = {"tenant_id": tenant_id}
        conditions = []
        
        if filters.start_date:
            conditions.append("expense_date >= :start_date")
            params["start_date"] = filters.start_date
        
        if filters.end_date:
            conditions.append("expense_date <= :end_date")
            params["end_date"] = filters.end_date
        
        if conditions:
            vendor_query += " AND " + " AND ".join(conditions)
        
        vendor_query += """
        GROUP BY vendor
        ORDER BY total_spend DESC
        """
        
        result = await self.db.execute(text(vendor_query), params)
        vendor_data = [dict(row) for row in result.fetchall()]
        
        total_spend = sum(v["total_spend"] for v in vendor_data)
        total_vendors = len(vendor_data)
        
        # Calculate concentration ratio (top 5 vendors)
        top5_spend = sum(v["total_spend"] for v in vendor_data[:5])
        concentration_ratio = float((top5_spend / total_spend) * 100) if total_spend > 0 else 0
        
        # Calculate preferred vendor percentage
        preferred_spend = sum(v["total_spend"] for v in vendor_data if v.get("preferred_vendor"))
        preferred_percentage = float((preferred_spend / total_spend) * 100) if total_spend > 0 else 0
        
        analytics = VendorSpendAnalytics(
            vendor_rankings=vendor_data,
            top_vendor_by_spend=vendor_data[0]["vendor_name"] if vendor_data else None,
            vendor_concentration_ratio=concentration_ratio,
            total_vendor_count=total_vendors,
            preferred_vendor_spend_percentage=preferred_percentage,
            vendor_diversity_score=self._calculate_vendor_diversity(vendor_data),
            vendor_risk_exposure=sum(v["total_spend"] * (v.get("risk_score", 0) / 5) for v in vendor_data)
        )
        
        return analytics
    
    async def get_department_spend_analytics(
        self,
        tenant_id: str,
        filters: SpendFilter
    ) -> DepartmentSpendAnalytics:
        """Get department spend analysis"""
        dept_query = """
        SELECT 
            department,
            SUM(amount) as total_spend,
            COALESCE(SUM(ba.allocated_amount), 0) as budget_allocated,
            COUNT(*) as transaction_count,
            AVG(amount) as average_transaction,
            (SELECT category FROM legal_spend ls2 
             WHERE ls2.department = ls.department AND ls2.tenant_id = ls.tenant_id
             GROUP BY category ORDER BY SUM(amount) DESC LIMIT 1) as top_category,
            ARRAY_AGG(DISTINCT cost_center) as cost_centers
        FROM legal_spend ls
        LEFT JOIN budget_allocations ba ON ba.department = ls.department 
            AND ba.tenant_id = ls.tenant_id
        WHERE ls.tenant_id = :tenant_id
        GROUP BY department
        ORDER BY total_spend DESC
        """
        
        result = await self.db.execute(text(dept_query), {"tenant_id": tenant_id})
        dept_data = []
        
        for row in result.fetchall():
            budget_allocated = row.budget_allocated or Decimal("0.00")
            total_spend = row.total_spend
            variance = total_spend - budget_allocated
            variance_percentage = float((variance / budget_allocated) * 100) if budget_allocated > 0 else 0
            
            dept_data.append({
                "department": row.department,
                "total_spend": total_spend,
                "budget_allocated": budget_allocated,
                "variance": variance,
                "variance_percentage": variance_percentage,
                "transaction_count": row.transaction_count,
                "average_transaction": row.average_transaction,
                "top_category": row.top_category,
                "cost_centers": row.cost_centers or []
            })
        
        total_spend = sum(d["total_spend"] for d in dept_data)
        
        analytics = DepartmentSpendAnalytics(
            departments=dept_data,
            highest_spend_department=dept_data[0]["department"] if dept_data else None,
            total_departments=len(dept_data),
            average_spend_per_department=total_spend / len(dept_data) if dept_data else Decimal("0.00"),
            spend_concentration_ratio=float((dept_data[0]["total_spend"] / total_spend) * 100) if dept_data and total_spend > 0 else 0
        )
        
        # Find most efficient department (best budget performance)
        if dept_data:
            analytics.most_efficient_department = min(
                [d for d in dept_data if d["budget_allocated"] > 0],
                key=lambda x: abs(x["variance_percentage"]),
                default={"department": None}
            )["department"]
        
        return analytics
    
    async def get_category_spend_analytics(
        self,
        tenant_id: str,
        filters: SpendFilter
    ) -> CategorySpendAnalytics:
        """Get category spend analysis"""
        category_query = """
        SELECT 
            category,
            ARRAY_AGG(DISTINCT subcategory) as subcategories,
            SUM(amount) as total_spend,
            COALESCE(AVG(ba.allocated_amount), 0) as budget_allocated,
            COUNT(*) as transaction_count,
            COUNT(DISTINCT vendor) as vendor_count,
            AVG(CASE WHEN billing_type = 'hourly' THEN rate ELSE NULL END) as average_rate,
            CASE 
                WHEN LAG(SUM(amount)) OVER (ORDER BY DATE_TRUNC('month', expense_date)) IS NULL 
                THEN 'stable'
                WHEN SUM(amount) > LAG(SUM(amount)) OVER (ORDER BY DATE_TRUNC('month', expense_date)) * 1.1
                THEN 'increasing'
                WHEN SUM(amount) < LAG(SUM(amount)) OVER (ORDER BY DATE_TRUNC('month', expense_date)) * 0.9
                THEN 'decreasing'
                ELSE 'stable'
            END as spend_trend,
            1.0 + (EXTRACT(MONTH FROM expense_date) - 6.5) * 0.02 as seasonality_factor
        FROM legal_spend ls
        LEFT JOIN budget_allocations ba ON ba.category = ls.category AND ba.tenant_id = ls.tenant_id
        WHERE ls.tenant_id = :tenant_id
        GROUP BY category, DATE_TRUNC('month', expense_date), EXTRACT(MONTH FROM expense_date)
        ORDER BY total_spend DESC
        """
        
        result = await self.db.execute(text(category_query), {"tenant_id": tenant_id})
        category_data = [dict(row) for row in result.fetchall()]
        
        # Calculate external vs internal spend
        external_categories = ["Legal Services", "Consulting", "External Technology"]
        total_spend = sum(c["total_spend"] for c in category_data)
        external_spend = sum(c["total_spend"] for c in category_data if c["category"] in external_categories)
        external_ratio = float((external_spend / total_spend) * 100) if total_spend > 0 else 0
        
        # Calculate technology spend percentage
        tech_spend = sum(c["total_spend"] for c in category_data if "Technology" in c["category"])
        tech_percentage = float((tech_spend / total_spend) * 100) if total_spend > 0 else 0
        
        analytics = CategorySpendAnalytics(
            categories=category_data,
            largest_category_by_spend=category_data[0]["category"] if category_data else None,
            total_categories=len(category_data),
            external_vs_internal_ratio=external_ratio,
            technology_spend_percentage=tech_percentage,
            category_diversity_score=self._calculate_category_diversity(category_data)
        )
        
        # Find fastest growing category
        growing_categories = [c for c in category_data if c.get("spend_trend") == "increasing"]
        if growing_categories:
            analytics.fastest_growing_category = max(
                growing_categories,
                key=lambda x: x["total_spend"]
            )["category"]
        
        return analytics
    
    async def get_spend_trends(
        self,
        tenant_id: str,
        filters: SpendFilter,
        aggregation_level: str = "monthly"
    ) -> TimeSeriesSpendData:
        """Get spend trends over time"""
        # Determine date truncation based on aggregation level
        date_trunc_map = {
            "daily": "day",
            "weekly": "week", 
            "monthly": "month",
            "quarterly": "quarter",
            "yearly": "year"
        }
        
        date_trunc = date_trunc_map.get(aggregation_level, "month")
        
        trends_query = f"""
        SELECT 
            TO_CHAR(DATE_TRUNC('{date_trunc}', expense_date), 'YYYY-MM') as period,
            SUM(amount) as total_spend,
            COUNT(*) as transaction_count,
            COUNT(DISTINCT vendor) as unique_vendors,
            AVG(amount) as average_transaction,
            COALESCE(SUM(ba.allocated_amount), 0) as budget_utilized,
            SUM(amount) - COALESCE(SUM(ba.allocated_amount), 0) as variance_from_budget
        FROM legal_spend ls
        LEFT JOIN budget_allocations ba ON ba.department = ls.department 
            AND ba.tenant_id = ls.tenant_id
            AND DATE_TRUNC('{date_trunc}', ba.period_start) = DATE_TRUNC('{date_trunc}', ls.expense_date)
        WHERE ls.tenant_id = :tenant_id
        """
        
        params = {"tenant_id": tenant_id}
        
        if filters.start_date:
            trends_query += " AND expense_date >= :start_date"
            params["start_date"] = filters.start_date
            
        if filters.end_date:
            trends_query += " AND expense_date <= :end_date"
            params["end_date"] = filters.end_date
        
        trends_query += f"""
        GROUP BY DATE_TRUNC('{date_trunc}', expense_date)
        ORDER BY DATE_TRUNC('{date_trunc}', expense_date)
        """
        
        result = await self.db.execute(text(trends_query), params)
        trend_data = []
        
        for row in result.fetchall():
            trend_data.append(SpendTrendData(
                period=row.period,
                amount=row.total_spend,
                transaction_count=row.transaction_count,
                unique_vendors=row.unique_vendors,
                budget_allocated=row.budget_utilized,
                variance=row.variance_from_budget
            ))
        
        # Calculate metrics
        total_spend = sum(t.amount for t in trend_data)
        total_periods = len(trend_data)
        
        # Calculate growth rate
        growth_rate = 0.0
        if len(trend_data) >= 2:
            first_amount = float(trend_data[0].amount)
            last_amount = float(trend_data[-1].amount)
            if first_amount > 0:
                growth_rate = ((last_amount - first_amount) / first_amount) * 100
        
        # Calculate volatility (standard deviation of amounts)
        if trend_data:
            amounts = [float(t.amount) for t in trend_data]
            volatility = float(statistics.stdev(amounts)) if len(amounts) > 1 else 0.0
        else:
            volatility = 0.0
        
        # Find peak and lowest periods
        peak_period = max(trend_data, key=lambda x: x.amount).period if trend_data else None
        lowest_period = min(trend_data, key=lambda x: x.amount).period if trend_data else None
        
        return TimeSeriesSpendData(
            trends=trend_data,
            total_periods=total_periods,
            growth_rate=growth_rate,
            volatility=volatility,
            average_monthly_spend=total_spend / total_periods if total_periods > 0 else Decimal("0.00"),
            peak_spend_period=peak_period,
            lowest_spend_period=lowest_period
        )
    
    async def get_budget_variance_analysis(
        self,
        tenant_id: str,
        filters: BudgetFilter
    ) -> BudgetVarianceAnalysis:
        """Get budget variance analysis"""
        variance_query = """
        SELECT 
            ba.category,
            ba.department,
            ba.allocated_amount as budgeted,
            COALESCE(SUM(ls.amount), 0) as actual,
            ba.allocated_amount - COALESCE(SUM(ls.amount), 0) as variance,
            CASE 
                WHEN ba.allocated_amount > 0 
                THEN ((ba.allocated_amount - COALESCE(SUM(ls.amount), 0)) / ba.allocated_amount * 100)
                ELSE 0 
            END as variance_percentage,
            CASE 
                WHEN COALESCE(SUM(ls.amount), 0) > ba.allocated_amount THEN 'over_budget'
                WHEN COALESCE(SUM(ls.amount), 0) < ba.allocated_amount * 0.9 THEN 'under_budget'
                ELSE 'on_budget'
            END as status,
            CASE 
                WHEN ba.allocated_amount - COALESCE(SUM(ls.amount), 0) >= 0 THEN 'favorable'
                ELSE 'unfavorable'
            END as trend,
            ba.allocated_amount * 1.1 as forecast
        FROM budget_allocations ba
        LEFT JOIN legal_spend ls ON ls.category = ba.category 
            AND ls.department = ba.department
            AND ls.tenant_id = ba.tenant_id
        WHERE ba.tenant_id = :tenant_id AND ba.status = 'active'
        """
        
        params = {"tenant_id": tenant_id}
        
        if filters.budget_year:
            variance_query += " AND ba.budget_year = :budget_year"
            params["budget_year"] = filters.budget_year
        
        variance_query += " GROUP BY ba.category, ba.department, ba.allocated_amount"
        
        result = await self.db.execute(text(variance_query), params)
        variance_data = [dict(row) for row in result.fetchall()]
        
        # Aggregate variances
        total_budgeted = sum(v["budgeted"] for v in variance_data)
        total_actual = sum(v["actual"] for v in variance_data)
        total_variance = total_budgeted - total_actual
        
        over_budget_count = len([v for v in variance_data if v["status"] == "over_budget"])
        under_budget_count = len([v for v in variance_data if v["status"] == "under_budget"])
        
        favorable_variances = sum(v["variance"] for v in variance_data if v["variance"] > 0)
        unfavorable_variances = sum(abs(v["variance"]) for v in variance_data if v["variance"] < 0)
        
        # Group by category and department
        category_variances = []
        dept_variances = []
        
        for item in variance_data:
            category_variances.append({
                "category": item["category"],
                "budgeted": item["budgeted"],
                "actual": item["actual"],
                "variance": item["variance"],
                "variance_percentage": item["variance_percentage"],
                "status": item["status"],
                "trend": item["trend"],
                "forecast": item["forecast"]
            })
        
        return BudgetVarianceAnalysis(
            category_variances=category_variances,
            department_variances=dept_variances,
            total_variance=total_variance,
            variance_percentage=float((total_variance / total_budgeted) * 100) if total_budgeted > 0 else 0,
            categories_over_budget=over_budget_count,
            categories_under_budget=under_budget_count,
            favorable_variances=favorable_variances,
            unfavorable_variances=unfavorable_variances
        )
    
    async def get_cost_optimization_recommendations(
        self,
        tenant_id: str,
        filters: SpendFilter
    ) -> List[CostOptimizationRecommendation]:
        """Generate cost optimization recommendations"""
        recommendations = []
        
        # Vendor consolidation opportunities
        vendor_consolidation = await self._analyze_vendor_consolidation(tenant_id, filters)
        for opportunity in vendor_consolidation:
            recommendations.append(CostOptimizationRecommendation(
                recommendation_type="vendor_consolidation",
                title="Consolidate Similar Vendors",
                description=f"Consolidate vendors {', '.join(opportunity['vendors'])} to negotiate better rates",
                potential_savings=opportunity["potential_savings"],
                implementation_effort="medium",
                timeline_months=3,
                priority=OptimizationPriority.HIGH if opportunity["potential_savings"] > 10000 else OptimizationPriority.MEDIUM,
                impact_areas=["vendor_management", "cost_reduction"],
                success_metrics=["cost_per_unit", "vendor_count"],
                action_items=["Analyze vendor overlap", "Negotiate consolidated contract", "Migrate services"]
            ))
        
        # Rate optimization opportunities
        rate_optimization = await self._analyze_rate_optimization(tenant_id, filters)
        for opportunity in rate_optimization:
            recommendations.append(CostOptimizationRecommendation(
                recommendation_type="rate_negotiation",
                title=f"Renegotiate Rates with {opportunity['vendor']}",
                description=f"Current rate ${opportunity['current_rate']}/hour vs market rate ${opportunity['market_rate']}/hour",
                potential_savings=opportunity["savings"],
                implementation_effort="low",
                timeline_months=1,
                priority=OptimizationPriority.HIGH,
                impact_areas=["hourly_rates", "vendor_costs"],
                success_metrics=["average_hourly_rate", "total_vendor_spend"],
                action_items=["Benchmark market rates", "Initiate rate negotiation", "Update contracts"]
            ))
        
        # Process improvement opportunities
        process_improvements = await self._analyze_process_improvements(tenant_id, filters)
        for opportunity in process_improvements:
            recommendations.append(CostOptimizationRecommendation(
                recommendation_type="process_optimization",
                title=f"Optimize {opportunity['area']} Process",
                description=f"Streamline {opportunity['area']} to reduce costs from ${opportunity['current_cost']} to ${opportunity['optimized_cost']}",
                potential_savings=opportunity["current_cost"] - opportunity["optimized_cost"],
                implementation_effort="high",
                timeline_months=6,
                priority=OptimizationPriority.MEDIUM,
                impact_areas=["process_efficiency", "operational_costs"],
                success_metrics=["cycle_time", "cost_per_transaction"],
                action_items=["Map current process", "Identify bottlenecks", "Implement automation"]
            ))
        
        # Sort recommendations by potential savings
        recommendations.sort(key=lambda x: x.potential_savings, reverse=True)
        
        return recommendations
    
    async def get_spend_forecast(
        self,
        tenant_id: str,
        filters: SpendFilter,
        forecast_periods: int = 4
    ) -> SpendForecast:
        """Generate spend forecast"""
        # Get historical data for forecasting
        historical_query = """
        SELECT 
            TO_CHAR(DATE_TRUNC('quarter', expense_date), 'YYYY-"Q"Q') as period,
            SUM(amount) as spend
        FROM legal_spend
        WHERE tenant_id = :tenant_id
          AND expense_date >= CURRENT_DATE - INTERVAL '2 years'
        GROUP BY DATE_TRUNC('quarter', expense_date)
        ORDER BY DATE_TRUNC('quarter', expense_date)
        """
        
        result = await self.db.execute(text(historical_query), {"tenant_id": tenant_id})
        historical_data = [dict(row) for row in result.fetchall()]
        
        if not historical_data:
            return SpendForecast()
        
        # Simple linear regression for forecasting
        amounts = [float(h["spend"]) for h in historical_data]
        
        # Calculate trend
        n = len(amounts)
        if n < 2:
            trend = 0
        else:
            x_vals = list(range(n))
            x_mean = sum(x_vals) / n
            y_mean = sum(amounts) / n
            
            numerator = sum((x_vals[i] - x_mean) * (amounts[i] - y_mean) for i in range(n))
            denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))
            
            trend = numerator / denominator if denominator != 0 else 0
        
        # Generate forecasts
        forecast_periods_data = []
        last_amount = amounts[-1] if amounts else 0
        
        for i in range(1, forecast_periods + 1):
            period_num = n + i
            predicted_spend = last_amount + (trend * i)
            
            # Apply seasonal adjustment (simple pattern)
            seasonal_factor = 1.0 + (0.1 * (i % 4 - 2) / 2)  # Quarterly seasonality
            predicted_spend *= seasonal_factor
            
            quarter = ((len(historical_data) + i - 1) % 4) + 1
            year = 2024 + ((len(historical_data) + i - 1) // 4)
            
            forecast_periods_data.append({
                "period": f"{year}-Q{quarter}",
                "predicted_spend": Decimal(str(max(0, predicted_spend))),
                "confidence": 0.8 - (i * 0.1),  # Decreasing confidence
                "upper_bound": Decimal(str(predicted_spend * 1.2)),
                "lower_bound": Decimal(str(predicted_spend * 0.8))
            })
        
        total_forecast = sum(p["predicted_spend"] for p in forecast_periods_data)
        avg_confidence = sum(p["confidence"] for p in forecast_periods_data) / len(forecast_periods_data)
        
        return SpendForecast(
            forecast_periods=forecast_periods_data,
            total_forecast_spend=total_forecast,
            confidence_level=avg_confidence,
            forecast_method="linear_regression",
            risk_factors=["vendor_price_increases", "volume_changes", "economic_conditions"]
        )
    
    async def create_budget_plan(
        self,
        tenant_id: str,
        budget_plan: BudgetPlan,
        user_id: str
    ) -> str:
        """Create a new budget plan"""
        # Validate budget plan
        if sum(alloc.amount for alloc in budget_plan.allocations) != budget_plan.total_budget:
            raise ValueError("Budget allocations do not sum to total budget")
        
        # Generate plan ID
        plan_id = str(uuid4())
        
        # Create budget plan record
        insert_query = """
        INSERT INTO budget_plans (
            id, tenant_id, budget_year, department, total_budget,
            allocations, approval_workflow, created_by, created_at, status
        ) VALUES (
            :plan_id, :tenant_id, :budget_year, :department, :total_budget,
            :allocations, :approval_workflow, :created_by, :created_at, :status
        )
        """
        
        params = {
            "plan_id": plan_id,
            "tenant_id": tenant_id,
            "budget_year": budget_plan.budget_year,
            "department": budget_plan.department,
            "total_budget": budget_plan.total_budget,
            "allocations": [alloc.__dict__ for alloc in budget_plan.allocations],
            "approval_workflow": budget_plan.approval_workflow,
            "created_by": user_id,
            "created_at": datetime.utcnow(),
            "status": budget_plan.status.value
        }
        
        await self.db.execute(text(insert_query), params)
        await self.db.commit()
        
        # Send notification if notification service is available
        if self.notification_service:
            await self.notification_service.send_budget_notification(
                tenant_id=tenant_id,
                message=f"New budget plan created for {budget_plan.department} - {budget_plan.budget_year}",
                recipients=budget_plan.approval_workflow
            )
        
        return plan_id
    
    async def check_spend_alerts(
        self,
        tenant_id: str
    ) -> List[SpendAlert]:
        """Check for spend alerts and anomalies"""
        alerts = []
        
        # Budget threshold alerts
        threshold_query = """
        SELECT 
            ba.category,
            ba.allocated_amount,
            COALESCE(SUM(ls.amount), 0) as current_spend,
            (COALESCE(SUM(ls.amount), 0) / ba.allocated_amount * 100) as utilization_percentage
        FROM budget_allocations ba
        LEFT JOIN legal_spend ls ON ls.category = ba.category 
            AND ls.tenant_id = ba.tenant_id
            AND ls.expense_date >= ba.period_start
            AND ls.expense_date <= ba.period_end
        WHERE ba.tenant_id = :tenant_id AND ba.status = 'active'
        GROUP BY ba.category, ba.allocated_amount
        HAVING (COALESCE(SUM(ls.amount), 0) / ba.allocated_amount * 100) > 80
        """
        
        result = await self.db.execute(text(threshold_query), {"tenant_id": tenant_id})
        
        for row in result.fetchall():
            severity = AlertSeverity.WARNING
            if row.utilization_percentage > 95:
                severity = AlertSeverity.CRITICAL
            elif row.utilization_percentage > 90:
                severity = AlertSeverity.HIGH
            
            alerts.append(SpendAlert(
                alert_type="budget_threshold",
                title=f"Budget Alert: {row.category}",
                description=f"Category has reached {row.utilization_percentage:.1f}% of allocated budget",
                severity=severity,
                category=row.category,
                amount=row.current_spend,
                threshold=row.allocated_amount,
                recommendation="Review spending and consider budget adjustment or spend controls"
            ))
        
        # Unusual spend pattern alerts
        anomaly_query = """
        SELECT 
            vendor,
            amount,
            AVG(amount) OVER (PARTITION BY vendor) as avg_amount,
            STDDEV(amount) OVER (PARTITION BY vendor) as stddev_amount
        FROM legal_spend
        WHERE tenant_id = :tenant_id
          AND expense_date >= CURRENT_DATE - INTERVAL '30 days'
        """
        
        result = await self.db.execute(text(anomaly_query), {"tenant_id": tenant_id})
        
        for row in result.fetchall():
            if row.stddev_amount and row.stddev_amount > 0:
                z_score = abs(float(row.amount - row.avg_amount) / float(row.stddev_amount))
                
                if z_score > 2.5:  # Significant deviation
                    alerts.append(SpendAlert(
                        alert_type="unusual_spend",
                        title=f"Unusual Spend Pattern: {row.vendor}",
                        description=f"Transaction amount ${row.amount:,.2f} is {z_score:.1f} standard deviations from average",
                        severity=AlertSeverity.HIGH if z_score > 3 else AlertSeverity.MEDIUM,
                        vendor=row.vendor,
                        amount=row.amount,
                        recommendation="Review transaction details and verify legitimacy"
                    ))
        
        # Send alert notifications
        if alerts and self.notification_service:
            for alert in alerts:
                await self.notification_service.send_alert(
                    tenant_id=tenant_id,
                    alert=alert
                )
        
        return alerts
    
    async def get_roi_analysis(
        self,
        tenant_id: str,
        filters: SpendFilter
    ) -> ROIAnalysis:
        """Get ROI analysis for legal spend"""
        roi_query = """
        SELECT 
            category,
            SUM(amount) as investment,
            COALESCE(SUM(cost_savings), 0) as cost_savings,
            COALESCE(SUM(time_savings_hours), 0) as time_savings_hours,
            COALESCE(SUM(risk_mitigation_value), 0) as risk_mitigation_value,
            CASE 
                WHEN SUM(amount) > 0 
                THEN ((COALESCE(SUM(cost_savings), 0) + COALESCE(SUM(risk_mitigation_value), 0)) / SUM(amount) * 100)
                ELSE 0 
            END as roi_percentage,
            CASE 
                WHEN COALESCE(SUM(cost_savings), 0) > 0 
                THEN (SUM(amount) / (COALESCE(SUM(cost_savings), 0) / 12))
                ELSE 24
            END as payback_period_months
        FROM legal_spend
        WHERE tenant_id = :tenant_id
        """
        
        params = {"tenant_id": tenant_id}
        
        if filters.start_date:
            roi_query += " AND expense_date >= :start_date"
            params["start_date"] = filters.start_date
        
        if filters.end_date:
            roi_query += " AND expense_date <= :end_date"
            params["end_date"] = filters.end_date
        
        roi_query += " GROUP BY category ORDER BY roi_percentage DESC"
        
        result = await self.db.execute(text(roi_query), params)
        category_roi = [dict(row) for row in result.fetchall()]
        
        # Calculate overall metrics
        total_investment = sum(c["investment"] for c in category_roi)
        total_savings = sum(c["cost_savings"] for c in category_roi)
        total_risk_mitigation = sum(c["risk_mitigation_value"] for c in category_roi)
        total_time_savings = sum(c["time_savings_hours"] for c in category_roi)
        
        overall_roi = float(((total_savings + total_risk_mitigation) / total_investment * 100)) if total_investment > 0 else 0
        payback_period = float(total_investment / (total_savings / 12)) if total_savings > 0 else 24
        
        return ROIAnalysis(
            category_roi=category_roi,
            overall_roi=overall_roi,
            total_investment=total_investment,
            total_cost_savings=total_savings,
            total_time_savings_hours=total_time_savings,
            payback_period_months=payback_period,
            risk_mitigation_value=total_risk_mitigation
        )
    
    async def get_multi_currency_spend_analysis(
        self,
        tenant_id: str,
        filters: SpendFilter,
        base_currency: str = "USD"
    ) -> Dict[str, Any]:
        """Get multi-currency spend analysis"""
        currency_query = """
        SELECT 
            currency,
            SUM(amount) as total_spend,
            COUNT(*) as transaction_count,
            AVG(exchange_rate_to_usd) as avg_exchange_rate
        FROM legal_spend
        WHERE tenant_id = :tenant_id
        GROUP BY currency
        ORDER BY total_spend DESC
        """
        
        result = await self.db.execute(text(currency_query), {"tenant_id": tenant_id})
        currency_data = [dict(row) for row in result.fetchall()]
        
        # Convert to base currency
        total_base_currency = Decimal("0.00")
        for currency_info in currency_data:
            rate = currency_info["avg_exchange_rate"] or Decimal("1.00")
            currency_info["amount_in_base"] = currency_info["total_spend"] * rate
            total_base_currency += currency_info["amount_in_base"]
        
        return {
            "currency_breakdown": currency_data,
            "total_spend_base_currency": total_base_currency,
            "base_currency": base_currency,
            "currency_count": len(currency_data),
            "primary_currency": currency_data[0]["currency"] if currency_data else "USD"
        }
    
    async def get_benchmark_analysis(
        self,
        tenant_id: str,
        filters: SpendFilter
    ) -> BenchmarkAnalysis:
        """Get industry benchmark analysis"""
        # Get industry benchmarks (would integrate with external data source)
        industry_benchmarks = await self._get_industry_benchmarks()
        
        # Get current organization metrics
        current_metrics = await self.get_spend_metrics(tenant_id, filters)
        
        # Calculate performance vs benchmarks
        performance_comparisons = {}
        
        if industry_benchmarks.get("industry_avg_spend_per_employee"):
            # Would need employee count from organization data
            employee_count = 100  # Mock value
            current_spend_per_employee = float(current_metrics.total_spend) / employee_count
            benchmark_spend_per_employee = float(industry_benchmarks["industry_avg_spend_per_employee"])
            
            performance_comparisons["spend_vs_industry"] = {
                "current": current_spend_per_employee,
                "benchmark": benchmark_spend_per_employee,
                "variance_percentage": ((current_spend_per_employee - benchmark_spend_per_employee) / benchmark_spend_per_employee * 100)
            }
        
        # Calculate benchmark score (0-100)
        benchmark_score = 75.0  # Mock calculation
        
        improvement_opportunities = []
        if performance_comparisons.get("spend_vs_industry", {}).get("variance_percentage", 0) > 10:
            improvement_opportunities.append("Reduce spend per employee to industry average")
        
        return BenchmarkAnalysis(
            industry_benchmarks=industry_benchmarks,
            performance_vs_benchmarks=performance_comparisons,
            benchmark_score=benchmark_score,
            improvement_opportunities=improvement_opportunities
        )
    
    # Helper methods
    async def _calculate_spend_growth(self, tenant_id: str, filters: SpendFilter) -> float:
        """Calculate spend growth rate"""
        # Mock implementation - would calculate YoY growth
        return 15.5
    
    async def _calculate_budget_accuracy(self, tenant_id: str, filters: BudgetFilter) -> float:
        """Calculate budget accuracy score"""
        # Mock implementation - would calculate accuracy based on variance history
        return 82.3
    
    def _calculate_vendor_diversity(self, vendor_data: List[Dict]) -> float:
        """Calculate vendor diversity score using Herfindahl index"""
        if not vendor_data:
            return 0.0
        
        total_spend = sum(v["total_spend"] for v in vendor_data)
        if total_spend == 0:
            return 0.0
        
        # Calculate Herfindahl index (sum of squared market shares)
        herfindahl = sum((float(v["total_spend"]) / float(total_spend)) ** 2 for v in vendor_data)
        
        # Convert to diversity score (1 - normalized Herfindahl)
        max_herfindahl = 1.0  # When one vendor has 100% share
        diversity_score = (1 - herfindahl) * 100
        
        return diversity_score
    
    def _calculate_category_diversity(self, category_data: List[Dict]) -> float:
        """Calculate category diversity score"""
        if not category_data:
            return 0.0
        
        # Similar calculation as vendor diversity
        total_spend = sum(c["total_spend"] for c in category_data)
        if total_spend == 0:
            return 0.0
        
        herfindahl = sum((float(c["total_spend"]) / float(total_spend)) ** 2 for c in category_data)
        diversity_score = (1 - herfindahl) * 100
        
        return diversity_score
    
    async def _analyze_vendor_consolidation(self, tenant_id: str, filters: SpendFilter) -> List[Dict]:
        """Analyze vendor consolidation opportunities"""
        # Mock implementation
        return [
            {"vendors": ["Vendor A", "Vendor B"], "potential_savings": Decimal("15000.00")},
            {"vendors": ["Vendor C", "Vendor D"], "potential_savings": Decimal("8000.00")}
        ]
    
    async def _analyze_rate_optimization(self, tenant_id: str, filters: SpendFilter) -> List[Dict]:
        """Analyze rate optimization opportunities"""
        # Mock implementation
        return [
            {"vendor": "BigLaw Firm", "current_rate": 350, "market_rate": 320, "savings": Decimal("12000.00")},
            {"vendor": "Boutique Firm", "current_rate": 280, "market_rate": 260, "savings": Decimal("5000.00")}
        ]
    
    async def _analyze_process_improvements(self, tenant_id: str, filters: SpendFilter) -> List[Dict]:
        """Analyze process improvement opportunities"""
        # Mock implementation
        return [
            {"area": "Contract Review", "current_cost": Decimal("25000.00"), "optimized_cost": Decimal("18000.00")},
            {"area": "Document Management", "current_cost": Decimal("15000.00"), "optimized_cost": Decimal("12000.00")}
        ]
    
    async def _get_industry_benchmarks(self) -> Dict[str, Any]:
        """Get industry benchmark data"""
        # Mock implementation - would integrate with external data sources
        return {
            "industry_avg_spend_per_employee": Decimal("5000.00"),
            "industry_avg_external_legal_percentage": 65.0,
            "industry_avg_technology_percentage": 15.0,
            "peer_group_avg_spend": Decimal("750000.00"),
            "best_in_class_metrics": {
                "cost_per_contract": Decimal("500.00"),
                "vendor_concentration": 0.35
            }
        }
    
    def _generate_cache_key(self, metric_type: str, tenant_id: str, filters: Union[SpendFilter, BudgetFilter]) -> str:
        """Generate cache key for analytics results"""
        filter_hash = hashlib.md5(str(filters.__dict__).encode()).hexdigest()
        return f"legal_spend:{metric_type}:{tenant_id}:{filter_hash}"


# Helper functions
def calculate_spend_trend(data_points: List[Decimal]) -> SpendTrend:
    """Calculate spend trend from data points"""
    if len(data_points) < 2:
        return SpendTrend(direction="stable", growth_rate=0.0, volatility=0.0)
    
    # Calculate linear regression
    n = len(data_points)
    x_vals = list(range(n))
    y_vals = [float(d) for d in data_points]
    
    x_mean = sum(x_vals) / n
    y_mean = sum(y_vals) / n
    
    numerator = sum((x_vals[i] - x_mean) * (y_vals[i] - y_mean) for i in range(n))
    denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))
    
    slope = numerator / denominator if denominator != 0 else 0
    
    # Determine direction
    if slope > y_mean * 0.05:  # 5% threshold
        direction = "increasing"
    elif slope < -y_mean * 0.05:
        direction = "decreasing"
    else:
        direction = "stable"
    
    # Calculate growth rate and volatility
    growth_rate = (slope / y_mean * 100) if y_mean > 0 else 0
    volatility = float(statistics.stdev(y_vals)) if len(y_vals) > 1 else 0.0
    
    return SpendTrend(
        direction=direction,
        growth_rate=growth_rate,
        volatility=volatility,
        confidence_level=0.8
    )


def calculate_budget_variance(budgeted: Decimal, actual: Decimal) -> BudgetVariance:
    """Calculate budget variance details"""
    variance_amount = budgeted - actual
    variance_percentage = float((variance_amount / budgeted) * 100) if budgeted > 0 else 0
    
    if abs(variance_percentage) <= 5:
        status = "on_budget"
        trend = "neutral"
    elif variance_percentage > 0:
        status = "under_budget"
        trend = "favorable"
    else:
        status = "over_budget"
        trend = "unfavorable"
    
    return BudgetVariance(
        amount=variance_amount,
        percentage=variance_percentage,
        status=status,
        trend=trend
    )


def score_optimization_opportunity(opportunity: Dict[str, Any]) -> float:
    """Score cost optimization opportunity (0-100)"""
    savings = float(opportunity.get("potential_savings", 0))
    effort = opportunity.get("implementation_effort", "medium")
    risk = opportunity.get("risk_level", "medium")
    timeline = opportunity.get("time_to_realize", 6)
    
    # Base score from savings (0-40 points)
    savings_score = min(40, savings / 1000)  # $1000 = 1 point
    
    # Effort score (0-25 points)
    effort_map = {"low": 25, "medium": 15, "high": 5}
    effort_score = effort_map.get(effort, 15)
    
    # Risk score (0-20 points)
    risk_map = {"low": 20, "medium": 12, "high": 5}
    risk_score = risk_map.get(risk, 12)
    
    # Timeline score (0-15 points)
    timeline_score = max(0, 15 - timeline)
    
    total_score = savings_score + effort_score + risk_score + timeline_score
    return min(100, total_score)