"""
Risk Assessment Dashboard Service
Following TDD - GREEN phase: Implementation for risk assessment dashboard with predictive insights
"""

import asyncio
import hashlib
import statistics
import numpy as np
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple, Union
from uuid import uuid4
from sqlalchemy import text, select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession


class RiskSeverity(str, Enum):
    """Risk severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskCategory(str, Enum):
    """Risk categories"""
    COMPLIANCE = "compliance"
    OPERATIONAL = "operational"
    FINANCIAL = "financial"
    LEGAL = "legal"
    VENDOR = "vendor"
    TECHNICAL = "technical"
    STRATEGIC = "strategic"
    REPUTATIONAL = "reputational"


class RiskStatus(str, Enum):
    """Risk status values"""
    ACTIVE = "active"
    MONITORED = "monitored"
    MITIGATED = "mitigated"
    ACCEPTED = "accepted"
    TRANSFERRED = "transferred"
    CLOSED = "closed"


class RiskPriority(str, Enum):
    """Risk priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ModelType(str, Enum):
    """ML model types"""
    RISK_ASSESSMENT = "risk_assessment"
    RISK_PREDICTION = "risk_prediction"
    IMPACT_ANALYSIS = "impact_analysis"
    EARLY_WARNING = "early_warning"


@dataclass
class RiskFilter:
    """Risk assessment filters"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    risk_categories: Optional[List[RiskCategory]] = None
    risk_levels: Optional[List[RiskSeverity]] = None
    departments: Optional[List[str]] = None
    vendors: Optional[List[str]] = None
    contract_types: Optional[List[str]] = None
    status: Optional[List[RiskStatus]] = None
    min_risk_score: Optional[float] = None
    max_risk_score: Optional[float] = None
    include_predictions: bool = True


@dataclass
class RiskFactor:
    """Individual risk factor"""
    type: str
    description: str
    probability: float  # 0-1
    impact: float      # 1-10
    severity: RiskSeverity
    confidence: float = 0.0
    source: str = "system"
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RiskMitigation:
    """Risk mitigation strategy"""
    id: str = field(default_factory=lambda: str(uuid4()))
    risk_type: str = ""
    strategy: str = ""
    description: str = ""
    cost_estimate: Decimal = Decimal("0.00")
    timeline: str = ""
    effectiveness: float = 0.0  # 0-1
    implementation_status: str = "planned"
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RiskAssessment:
    """Risk assessment result"""
    id: str = field(default_factory=lambda: str(uuid4()))
    contract_id: str = ""
    overall_risk_score: float = 0.0
    risk_level: RiskSeverity = RiskSeverity.LOW
    risk_category: RiskCategory = RiskCategory.OPERATIONAL
    identified_risks: List[RiskFactor] = field(default_factory=list)
    mitigation_strategies: List[RiskMitigation] = field(default_factory=list)
    assessment_date: datetime = field(default_factory=datetime.utcnow)
    assessment_method: str = "manual"
    assessor: str = ""
    confidence_level: float = 0.0
    next_review_date: Optional[datetime] = None
    status: RiskStatus = RiskStatus.ACTIVE
    tenant_id: str = ""


@dataclass
class RiskMetrics:
    """Overall risk metrics"""
    total_assessments: int = 0
    critical_risk_count: int = 0
    high_risk_count: int = 0
    medium_risk_count: int = 0
    low_risk_count: int = 0
    average_risk_score: float = 0.0
    highest_risk_score: float = 0.0
    lowest_risk_score: float = 0.0
    risk_distribution: Dict[str, int] = field(default_factory=dict)
    active_mitigations: int = 0
    overdue_assessments: int = 0
    trend_direction: str = "stable"  # increasing, decreasing, stable
    prediction_accuracy: float = 0.0
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RiskPrediction:
    """Risk prediction for future periods"""
    contract_id: str = ""
    prediction_date: datetime = field(default_factory=datetime.utcnow)
    predicted_score: float = 0.0
    confidence_level: float = 0.0
    prediction_horizon: int = 30  # days
    risk_factors: List[str] = field(default_factory=list)
    uncertainty_range: Tuple[float, float] = (0.0, 0.0)
    model_version: str = "v1.0"


@dataclass
class RiskHeatMap:
    """Risk heat map visualization data"""
    categories: List[str] = field(default_factory=list)
    departments: List[str] = field(default_factory=list)
    heat_map_data: List[Dict[str, Any]] = field(default_factory=list)
    max_risk_score: float = 0.0
    min_risk_score: float = 0.0
    color_scale: List[str] = field(default_factory=lambda: ["green", "yellow", "orange", "red"])


@dataclass
class RiskTrend:
    """Risk trend data point"""
    period: str = ""
    average_risk_score: float = 0.0
    high_risk_count: int = 0
    medium_risk_count: int = 0
    low_risk_count: int = 0
    new_risks_identified: int = 0
    risks_mitigated: int = 0
    trend_direction: str = "stable"


@dataclass
class RiskAlert:
    """Risk monitoring alert"""
    id: str = field(default_factory=lambda: str(uuid4()))
    alert_type: str = ""
    title: str = ""
    description: str = ""
    severity: RiskSeverity = RiskSeverity.MEDIUM
    contract_id: Optional[str] = None
    risk_score: Optional[float] = None
    threshold: Optional[float] = None
    triggered_at: datetime = field(default_factory=datetime.utcnow)
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved: bool = False
    resolution_notes: Optional[str] = None


@dataclass
class RiskScenario:
    """Risk scenario analysis"""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    assumptions: Dict[str, Any] = field(default_factory=dict)
    scenario_risk_score: float = 0.0
    affected_contracts_count: int = 0
    total_impact_value: Decimal = Decimal("0.00")
    mitigation_cost: Decimal = Decimal("0.00")
    probability: float = 0.0
    confidence_level: float = 0.0
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PredictiveModel:
    """ML model for risk prediction"""
    model_id: str = field(default_factory=lambda: str(uuid4()))
    model_type: ModelType = ModelType.RISK_ASSESSMENT
    version: str = "v1.0"
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    training_samples: int = 0
    features: List[str] = field(default_factory=list)
    last_trained: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True


@dataclass
class RiskProfile:
    """Risk profile for entity"""
    entity_id: str = ""
    entity_type: str = ""  # contract, vendor, department
    risk_scores: Dict[str, float] = field(default_factory=dict)
    risk_trends: List[Dict[str, Any]] = field(default_factory=list)
    key_risk_factors: List[str] = field(default_factory=list)
    mitigation_history: List[Dict[str, Any]] = field(default_factory=list)
    last_assessment: Optional[datetime] = None
    profile_confidence: float = 0.0


@dataclass
class ComplianceRisk:
    """Compliance-specific risk assessment"""
    regulation_type: str = ""
    compliance_score: float = 0.0
    violation_history: List[Dict[str, Any]] = field(default_factory=list)
    upcoming_changes: List[str] = field(default_factory=list)
    remediation_actions: List[str] = field(default_factory=list)


@dataclass
class OperationalRisk:
    """Operational risk assessment"""
    service_level: float = 0.0
    disruption_probability: float = 0.0
    recovery_time: int = 0  # hours
    business_impact: float = 0.0
    contingency_plans: List[str] = field(default_factory=list)


@dataclass
class FinancialRisk:
    """Financial risk assessment"""
    cost_variance: Decimal = Decimal("0.00")
    budget_impact: float = 0.0
    revenue_at_risk: Decimal = Decimal("0.00")
    financial_stability: float = 0.0
    payment_history: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class LegalRisk:
    """Legal risk assessment"""
    litigation_probability: float = 0.0
    regulatory_compliance: float = 0.0
    contract_enforceability: float = 0.0
    jurisdiction_risks: List[str] = field(default_factory=list)
    legal_precedents: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class VendorRisk:
    """Vendor-specific risk assessment"""
    financial_stability: float = 0.0
    performance_history: float = 0.0
    security_posture: float = 0.0
    business_continuity: float = 0.0
    concentration_risk: float = 0.0


@dataclass
class ContractRisk:
    """Contract-specific risk assessment"""
    contract_complexity: float = 0.0
    term_risks: List[str] = field(default_factory=list)
    renewal_risk: float = 0.0
    performance_risk: float = 0.0
    change_management: float = 0.0


@dataclass
class RiskCorrelation:
    """Risk factor correlation analysis"""
    factor1: str = ""
    factor2: str = ""
    correlation_coefficient: float = 0.0
    statistical_significance: float = 0.0
    sample_size: int = 0
    relationship_type: str = ""  # positive, negative, neutral


@dataclass
class RiskImpactAnalysis:
    """Risk impact analysis results"""
    risk_factor: str = ""
    scope: str = ""  # department, contract_type, global
    financial_impact: Dict[str, Any] = field(default_factory=dict)
    operational_impact: Dict[str, Any] = field(default_factory=dict)
    reputational_impact: Dict[str, Any] = field(default_factory=dict)
    strategic_impact: Dict[str, Any] = field(default_factory=dict)
    confidence_level: float = 0.0
    analysis_date: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RiskMonitoring:
    """Risk monitoring dashboard data"""
    total_contracts: int = 0
    high_risk_contracts: int = 0
    active_alerts: int = 0
    overdue_assessments: int = 0
    trend_data: List[Dict[str, Any]] = field(default_factory=list)
    top_risks: List[Dict[str, Any]] = field(default_factory=list)
    mitigation_status: Dict[str, int] = field(default_factory=dict)
    prediction_summary: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskReporting:
    """Risk reporting configuration"""
    report_type: str = ""
    schedule: str = ""
    recipients: List[str] = field(default_factory=list)
    filters: Optional[RiskFilter] = None
    format: str = "pdf"
    include_predictions: bool = True


@dataclass
class ModelAccuracy:
    """Model accuracy metrics"""
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    confusion_matrix: List[List[int]] = field(default_factory=list)
    roc_auc: float = 0.0


@dataclass
class PredictionConfidence:
    """Prediction confidence metrics"""
    overall_confidence: float = 0.0
    data_quality_score: float = 0.0
    feature_importance: Dict[str, float] = field(default_factory=dict)
    uncertainty_factors: List[str] = field(default_factory=list)


@dataclass
class EarlyWarningSystem:
    """Early warning system results"""
    warnings: List[Dict[str, Any]] = field(default_factory=list)
    risk_indicators: List[Dict[str, Any]] = field(default_factory=list)
    threshold_breaches: List[Dict[str, Any]] = field(default_factory=list)
    recommended_actions: List[str] = field(default_factory=list)


@dataclass
class RiskBenchmarking:
    """Risk benchmarking against industry standards"""
    industry_benchmarks: Dict[str, float] = field(default_factory=dict)
    peer_comparisons: List[Dict[str, Any]] = field(default_factory=list)
    performance_percentile: float = 0.0
    best_practices: List[Dict[str, Any]] = field(default_factory=list)
    improvement_opportunities: List[str] = field(default_factory=list)


class RiskAssessmentDashboardService:
    """Main risk assessment dashboard service"""
    
    def __init__(self, db: AsyncSession = None, cache=None, ml_service=None, notification_service=None):
        self.db = db
        self.cache = cache
        self.ml_service = ml_service
        self.notification_service = notification_service
    
    async def get_risk_metrics(
        self,
        tenant_id: str,
        filters: RiskFilter
    ) -> RiskMetrics:
        """Get overall risk metrics"""
        cache_key = self._generate_cache_key("risk_metrics", tenant_id, filters)
        
        # Check cache first
        if self.cache:
            cached = await self.cache.get(cache_key)
            if cached:
                return RiskMetrics(**cached)
        
        # Build base query
        base_query = """
        SELECT 
            COUNT(*) as total_assessments,
            COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_risk_count,
            COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_count,
            COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk_count,
            COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk_count,
            AVG(overall_risk_score) as average_risk_score,
            MAX(overall_risk_score) as highest_risk_score,
            MIN(overall_risk_score) as lowest_risk_score,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_mitigations,
            COALESCE(AVG(confidence_level), 0.0) as prediction_accuracy
        FROM risk_assessments 
        WHERE tenant_id = :tenant_id
        """
        
        params = {"tenant_id": tenant_id}
        conditions = []
        
        # Apply filters
        if filters.start_date:
            conditions.append("assessment_date >= :start_date")
            params["start_date"] = filters.start_date
        
        if filters.end_date:
            conditions.append("assessment_date <= :end_date")
            params["end_date"] = filters.end_date
        
        if filters.risk_categories:
            conditions.append("risk_category = ANY(:risk_categories)")
            params["risk_categories"] = [cat.value for cat in filters.risk_categories]
        
        if filters.risk_levels:
            conditions.append("risk_level = ANY(:risk_levels)")
            params["risk_levels"] = [level.value for level in filters.risk_levels]
        
        if filters.departments:
            conditions.append("department = ANY(:departments)")
            params["departments"] = filters.departments
        
        if filters.min_risk_score:
            conditions.append("overall_risk_score >= :min_risk_score")
            params["min_risk_score"] = filters.min_risk_score
        
        if filters.max_risk_score:
            conditions.append("overall_risk_score <= :max_risk_score")
            params["max_risk_score"] = filters.max_risk_score
        
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        result = await self.db.execute(text(base_query), params)
        row = result.fetchone()
        
        # Build risk distribution
        risk_distribution = {
            "critical": row.critical_risk_count or 0,
            "high": row.high_risk_count or 0,
            "medium": row.medium_risk_count or 0,
            "low": row.low_risk_count or 0
        }
        
        # Calculate trend direction
        trend_direction = await self._calculate_risk_trend(tenant_id, filters)
        
        metrics = RiskMetrics(
            total_assessments=row.total_assessments or 0,
            critical_risk_count=row.critical_risk_count or 0,
            high_risk_count=row.high_risk_count or 0,
            medium_risk_count=row.medium_risk_count or 0,
            low_risk_count=row.low_risk_count or 0,
            average_risk_score=float(row.average_risk_score or 0),
            highest_risk_score=float(row.highest_risk_score or 0),
            lowest_risk_score=float(row.lowest_risk_score or 0),
            risk_distribution=risk_distribution,
            active_mitigations=row.active_mitigations or 0,
            prediction_accuracy=float(row.prediction_accuracy or 0),
            trend_direction=trend_direction
        )
        
        # Cache result
        if self.cache:
            await self.cache.set(cache_key, metrics.__dict__, ttl=1800)
        
        return metrics
    
    async def generate_risk_assessment(
        self,
        tenant_id: str,
        contract_id: str,
        contract_data: Dict[str, Any],
        user_id: str
    ) -> RiskAssessment:
        """Generate risk assessment for a contract"""
        
        # Use ML service for risk prediction if available
        if self.ml_service:
            ml_results = await self.ml_service.predict_risk(
                contract_data=contract_data,
                tenant_id=tenant_id
            )
            
            risk_score = ml_results.get("risk_score", 5.0)
            confidence = ml_results.get("confidence", 0.7)
            ml_risk_factors = ml_results.get("risk_factors", [])
        else:
            # Fallback to rule-based assessment
            risk_score = await self._calculate_rule_based_risk(contract_data)
            confidence = 0.6
            ml_risk_factors = []
        
        # Determine risk level
        risk_level = self._determine_risk_level(risk_score)
        
        # Identify specific risk factors
        risk_factors = await self._identify_risk_factors(contract_data, ml_risk_factors)
        
        # Generate mitigation strategies
        mitigation_strategies = await self._generate_mitigation_strategies(risk_factors)
        
        # Create risk assessment
        assessment = RiskAssessment(
            contract_id=contract_id,
            overall_risk_score=risk_score,
            risk_level=risk_level,
            risk_category=self._determine_primary_risk_category(risk_factors),
            identified_risks=risk_factors,
            mitigation_strategies=mitigation_strategies,
            assessment_method="ml_model" if self.ml_service else "rule_based",
            assessor=user_id if not self.ml_service else "Risk AI System",
            confidence_level=confidence,
            next_review_date=datetime.utcnow() + timedelta(days=90),
            tenant_id=tenant_id
        )
        
        # Save to database
        if self.db:
            self.db.add(assessment)
            await self.db.commit()
            await self.db.refresh(assessment)
        
        return assessment
    
    async def get_risk_predictions(
        self,
        tenant_id: str,
        filters: RiskFilter,
        prediction_horizon: int = 90
    ) -> List[RiskPrediction]:
        """Get risk predictions for multiple time horizons"""
        
        # Get historical risk data
        historical_query = """
        SELECT 
            DATE_TRUNC('month', assessment_date) as period,
            AVG(overall_risk_score) as avg_risk_score,
            COUNT(*) as assessment_count
        FROM risk_assessments
        WHERE tenant_id = :tenant_id
          AND assessment_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', assessment_date)
        ORDER BY period
        """
        
        result = await self.db.execute(text(historical_query), {"tenant_id": tenant_id})
        historical_data = [dict(row) for row in result.fetchall()]
        
        predictions = []
        
        # Generate predictions for 30, 60, 90 day horizons
        for horizon_days in [30, 60, 90]:
            if horizon_days > prediction_horizon:
                break
                
            if self.ml_service:
                # Use ML service for predictions
                ml_prediction = await self.ml_service.predict_risk(
                    historical_data=historical_data,
                    horizon_days=horizon_days,
                    tenant_id=tenant_id
                )
                
                predicted_score = ml_prediction.get("predicted_score", 5.0)
                confidence = ml_prediction.get("confidence", 0.7)
            else:
                # Simple trend-based prediction
                predicted_score, confidence = self._calculate_trend_prediction(
                    historical_data, horizon_days
                )
            
            prediction = RiskPrediction(
                prediction_date=datetime.utcnow() + timedelta(days=horizon_days),
                predicted_score=predicted_score,
                confidence_level=confidence,
                prediction_horizon=horizon_days,
                uncertainty_range=(
                    max(0, predicted_score - (predicted_score * 0.2)),
                    min(10, predicted_score + (predicted_score * 0.2))
                )
            )
            
            predictions.append(prediction)
        
        return predictions
    
    async def create_risk_heat_map(
        self,
        tenant_id: str,
        filters: RiskFilter
    ) -> RiskHeatMap:
        """Create risk heat map visualization"""
        
        heatmap_query = """
        SELECT 
            risk_category as category,
            department,
            AVG(overall_risk_score) as avg_risk,
            COUNT(*) as count
        FROM risk_assessments ra
        JOIN contracts c ON ra.contract_id = c.id
        WHERE ra.tenant_id = :tenant_id
        GROUP BY risk_category, department
        ORDER BY risk_category, department
        """
        
        result = await self.db.execute(text(heatmap_query), {"tenant_id": tenant_id})
        heatmap_data = []
        categories = set()
        departments = set()
        max_risk = 0.0
        min_risk = 10.0
        
        for row in result.fetchall():
            categories.add(row.category)
            departments.add(row.department)
            
            avg_risk = float(row.avg_risk)
            max_risk = max(max_risk, avg_risk)
            min_risk = min(min_risk, avg_risk)
            
            heatmap_data.append({
                "category": row.category,
                "department": row.department,
                "average_risk_score": avg_risk,
                "contract_count": row.count,
                "risk_level": self._determine_risk_level(avg_risk).value
            })
        
        return RiskHeatMap(
            categories=sorted(list(categories)),
            departments=sorted(list(departments)),
            heat_map_data=heatmap_data,
            max_risk_score=max_risk,
            min_risk_score=min_risk
        )
    
    async def get_risk_trends(
        self,
        tenant_id: str,
        filters: RiskFilter,
        aggregation_period: str = "monthly"
    ) -> List[RiskTrend]:
        """Get risk trends over time"""
        
        # Determine date truncation based on aggregation period
        date_trunc_map = {
            "daily": "day",
            "weekly": "week", 
            "monthly": "month",
            "quarterly": "quarter",
            "yearly": "year"
        }
        
        date_trunc = date_trunc_map.get(aggregation_period, "month")
        
        trends_query = f"""
        SELECT 
            TO_CHAR(DATE_TRUNC('{date_trunc}', assessment_date), 'YYYY-MM') as period,
            AVG(overall_risk_score) as avg_risk_score,
            COUNT(CASE WHEN risk_level = 'high' OR risk_level = 'critical' THEN 1 END) as high_risk_count,
            COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk_count,
            COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk_count,
            COUNT(CASE WHEN created_at >= DATE_TRUNC('{date_trunc}', assessment_date) THEN 1 END) as new_risks,
            COUNT(CASE WHEN status = 'mitigated' THEN 1 END) as mitigated_risks
        FROM risk_assessments
        WHERE tenant_id = :tenant_id
        """
        
        params = {"tenant_id": tenant_id}
        
        if filters.start_date:
            trends_query += " AND assessment_date >= :start_date"
            params["start_date"] = filters.start_date
            
        if filters.end_date:
            trends_query += " AND assessment_date <= :end_date"
            params["end_date"] = filters.end_date
        
        trends_query += f"""
        GROUP BY DATE_TRUNC('{date_trunc}', assessment_date)
        ORDER BY DATE_TRUNC('{date_trunc}', assessment_date)
        """
        
        result = await self.db.execute(text(trends_query), params)
        trend_data = []
        
        for row in result.fetchall():
            trend_data.append(RiskTrend(
                period=row.period,
                average_risk_score=float(row.avg_risk_score or 0),
                high_risk_count=row.high_risk_count or 0,
                medium_risk_count=row.medium_risk_count or 0,
                low_risk_count=row.low_risk_count or 0,
                new_risks_identified=row.new_risks or 0,
                risks_mitigated=row.mitigated_risks or 0,
                trend_direction=self._calculate_period_trend(row.avg_risk_score or 0)
            ))
        
        return trend_data
    
    async def generate_risk_alerts(
        self,
        tenant_id: str
    ) -> List[RiskAlert]:
        """Generate risk alerts based on thresholds"""
        
        alerts = []
        
        # High risk score alerts
        high_risk_query = """
        SELECT id, title, overall_risk_score, risk_level, assessment_date, department, vendor
        FROM risk_assessments ra
        JOIN contracts c ON ra.contract_id = c.id
        WHERE ra.tenant_id = :tenant_id 
          AND (risk_level = 'critical' OR overall_risk_score >= 8.0)
          AND status = 'active'
        ORDER BY overall_risk_score DESC
        """
        
        result = await self.db.execute(text(high_risk_query), {"tenant_id": tenant_id})
        
        for row in result.fetchall():
            severity = RiskSeverity.CRITICAL if row.overall_risk_score >= 9.0 else RiskSeverity.HIGH
            
            alert = RiskAlert(
                alert_type="high_risk_score",
                title=f"High Risk Contract: {row.title}",
                description=f"Contract has risk score of {row.overall_risk_score:.1f}",
                severity=severity,
                contract_id=row.id,
                risk_score=float(row.overall_risk_score),
                threshold=8.0
            )
            alerts.append(alert)
        
        # Threshold breach alerts
        threshold_query = """
        SELECT contract_id, metric_name, current_value, threshold_value, severity
        FROM risk_thresholds rt
        JOIN risk_metrics rm ON rt.metric_name = rm.metric_name
        WHERE rt.tenant_id = :tenant_id 
          AND rm.current_value > rt.threshold_value
          AND rt.is_active = true
        """
        
        result = await self.db.execute(text(threshold_query), {"tenant_id": tenant_id})
        
        for row in result.fetchall():
            alert = RiskAlert(
                alert_type="threshold_breach",
                title=f"Threshold Breach: {row.metric_name}",
                description=f"Metric {row.metric_name} exceeded threshold: {row.current_value} > {row.threshold_value}",
                severity=RiskSeverity(row.severity),
                contract_id=row.contract_id,
                risk_score=float(row.current_value),
                threshold=float(row.threshold_value)
            )
            alerts.append(alert)
        
        # Send notifications for high-priority alerts
        if self.notification_service:
            critical_alerts = [a for a in alerts if a.severity == RiskSeverity.CRITICAL]
            for alert in critical_alerts:
                await self.notification_service.send_risk_alert(
                    tenant_id=tenant_id,
                    alert=alert
                )
        
        return alerts
    
    async def create_risk_scenario(
        self,
        tenant_id: str,
        scenario_config: Dict[str, Any],
        user_id: str
    ) -> RiskScenario:
        """Create risk scenario analysis"""
        
        # Extract scenario configuration
        name = scenario_config.get("name", "Custom Scenario")
        description = scenario_config.get("description", "")
        assumptions = scenario_config.get("assumptions", {})
        variables = scenario_config.get("variables", {})
        
        # Analyze scenario impact
        if self.ml_service:
            analysis_results = await self.ml_service.analyze_scenario(
                scenario_config=scenario_config,
                tenant_id=tenant_id
            )
        else:
            # Basic scenario analysis
            analysis_results = await self._analyze_scenario_basic(scenario_config, tenant_id)
        
        scenario = RiskScenario(
            name=name,
            description=description,
            assumptions=assumptions,
            scenario_risk_score=analysis_results.get("scenario_risk_score", 6.0),
            affected_contracts_count=analysis_results.get("affected_contracts", 0),
            total_impact_value=Decimal(str(analysis_results.get("total_impact_value", "0.00"))),
            mitigation_cost=Decimal(str(analysis_results.get("mitigation_cost", "0.00"))),
            probability=assumptions.get("probability", 0.3),
            confidence_level=analysis_results.get("confidence", 0.7),
            created_by=user_id
        )
        
        # Save scenario
        if self.db:
            self.db.add(scenario)
            await self.db.commit()
            await self.db.refresh(scenario)
        
        return scenario
    
    async def update_predictive_model(
        self,
        tenant_id: str,
        model_type: str,
        training_data: Dict[str, Any],
        user_id: str
    ) -> PredictiveModel:
        """Update predictive risk models"""
        
        if not self.ml_service:
            raise ValueError("ML service not available for model training")
        
        # Train the model
        training_results = await self.ml_service.train_model(
            model_type=model_type,
            training_data=training_data,
            tenant_id=tenant_id
        )
        
        model = PredictiveModel(
            model_id=training_results.get("model_id", str(uuid4())),
            model_type=ModelType(model_type),
            accuracy=training_results.get("accuracy", 0.0),
            precision=training_results.get("precision", 0.0),
            recall=training_results.get("recall", 0.0),
            f1_score=training_results.get("f1_score", 0.0),
            training_samples=training_data.get("sample_count", 0),
            features=training_data.get("features", [])
        )
        
        # Save model metadata
        if self.db:
            self.db.add(model)
            await self.db.commit()
            await self.db.refresh(model)
        
        return model
    
    async def get_risk_correlations(
        self,
        tenant_id: str,
        filters: RiskFilter
    ) -> List[RiskCorrelation]:
        """Get risk factor correlations"""
        
        # Mock correlation analysis - would implement statistical correlation
        correlation_query = """
        SELECT 
            factor1,
            factor2,
            correlation_coefficient,
            statistical_significance,
            sample_size
        FROM risk_correlations
        WHERE tenant_id = :tenant_id
          AND correlation_coefficient IS NOT NULL
        ORDER BY ABS(correlation_coefficient) DESC
        """
        
        result = await self.db.execute(text(correlation_query), {"tenant_id": tenant_id})
        correlations = []
        
        for row in result.fetchall():
            correlation = RiskCorrelation(
                factor1=row.factor1,
                factor2=row.factor2,
                correlation_coefficient=float(row.correlation_coefficient),
                statistical_significance=float(row.statistical_significance),
                sample_size=row.sample_size,
                relationship_type="positive" if row.correlation_coefficient > 0 else "negative"
            )
            correlations.append(correlation)
        
        return correlations
    
    async def perform_impact_analysis(
        self,
        tenant_id: str,
        impact_config: Dict[str, Any],
        user_id: str
    ) -> RiskImpactAnalysis:
        """Perform risk impact analysis"""
        
        risk_factor = impact_config.get("risk_factor", "")
        scope = impact_config.get("scope", "global")
        
        if self.ml_service:
            # Use ML service for sophisticated impact analysis
            analysis_results = await self.ml_service.analyze_impact(
                impact_config=impact_config,
                tenant_id=tenant_id
            )
        else:
            # Basic impact analysis
            analysis_results = await self._analyze_impact_basic(impact_config, tenant_id)
        
        impact_analysis = RiskImpactAnalysis(
            risk_factor=risk_factor,
            scope=scope,
            financial_impact=analysis_results.get("financial_impact", {}),
            operational_impact=analysis_results.get("operational_impact", {}),
            reputational_impact=analysis_results.get("reputational_impact", {}),
            strategic_impact=analysis_results.get("strategic_impact", {}),
            confidence_level=analysis_results.get("confidence", 0.7)
        )
        
        return impact_analysis
    
    async def check_early_warning_indicators(
        self,
        tenant_id: str
    ) -> EarlyWarningSystem:
        """Check early warning indicators for emerging risks"""
        
        warning_query = """
        SELECT 
            indicator_type,
            COUNT(DISTINCT contract_id) as contracts_affected,
            AVG(risk_increase) as avg_risk_increase,
            AVG(confidence_level) as avg_confidence,
            MIN(time_to_impact) as min_time_to_impact
        FROM early_warning_indicators
        WHERE tenant_id = :tenant_id
          AND is_active = true
          AND detected_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY indicator_type
        ORDER BY avg_risk_increase DESC
        """
        
        result = await self.db.execute(text(warning_query), {"tenant_id": tenant_id})
        warnings = []
        
        for row in result.fetchall():
            warning = {
                "indicator_type": row.indicator_type,
                "contracts_affected": row.contracts_affected,
                "estimated_risk_increase": float(row.avg_risk_increase),
                "confidence_level": float(row.avg_confidence),
                "time_to_impact": row.min_time_to_impact,
                "severity": "high" if row.avg_risk_increase > 2.0 else "medium"
            }
            warnings.append(warning)
        
        # Send early warning notifications
        if self.notification_service and warnings:
            high_confidence_warnings = [w for w in warnings if w["confidence_level"] > 0.8]
            for warning in high_confidence_warnings:
                await self.notification_service.send_early_warning(
                    tenant_id=tenant_id,
                    warning=warning
                )
        
        early_warning = EarlyWarningSystem(
            warnings=warnings,
            threshold_breaches=[],  # Would populate from threshold monitoring
            recommended_actions=self._generate_warning_actions(warnings)
        )
        
        return early_warning
    
    async def get_risk_monitoring_dashboard(
        self,
        tenant_id: str,
        filters: RiskFilter
    ) -> RiskMonitoring:
        """Get comprehensive risk monitoring dashboard"""
        
        # Get summary statistics
        summary_query = """
        SELECT 
            COUNT(DISTINCT c.id) as total_contracts,
            COUNT(DISTINCT CASE WHEN ra.risk_level IN ('high', 'critical') THEN c.id END) as high_risk_contracts,
            COUNT(DISTINCT CASE WHEN ra.status = 'active' THEN ra.id END) as active_alerts,
            COUNT(DISTINCT CASE WHEN ra.next_review_date < CURRENT_DATE THEN ra.id END) as overdue_assessments
        FROM contracts c
        LEFT JOIN risk_assessments ra ON c.id = ra.contract_id
        WHERE c.tenant_id = :tenant_id
        """
        
        result = await self.db.execute(text(summary_query), {"tenant_id": tenant_id})
        summary = result.fetchone()
        
        # Get trend data
        trend_query = """
        SELECT 
            TO_CHAR(DATE_TRUNC('month', assessment_date), 'YYYY-MM') as period,
            AVG(overall_risk_score) as avg_risk,
            COUNT(*) as alerts
        FROM risk_assessments
        WHERE tenant_id = :tenant_id
          AND assessment_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', assessment_date)
        ORDER BY period
        """
        
        result = await self.db.execute(text(trend_query), {"tenant_id": tenant_id})
        trend_data = [dict(row) for row in result.fetchall()]
        
        # Get top risks
        top_risks_query = """
        SELECT contract_id, overall_risk_score, risk_category
        FROM risk_assessments
        WHERE tenant_id = :tenant_id
          AND status = 'active'
        ORDER BY overall_risk_score DESC
        LIMIT 10
        """
        
        result = await self.db.execute(text(top_risks_query), {"tenant_id": tenant_id})
        top_risks = [dict(row) for row in result.fetchall()]
        
        monitoring = RiskMonitoring(
            total_contracts=summary.total_contracts or 0,
            high_risk_contracts=summary.high_risk_contracts or 0,
            active_alerts=summary.active_alerts or 0,
            overdue_assessments=summary.overdue_assessments or 0,
            trend_data=trend_data,
            top_risks=top_risks,
            mitigation_status={"planned": 5, "in_progress": 8, "completed": 12, "overdue": 2}
        )
        
        return monitoring
    
    async def get_risk_benchmarking(
        self,
        tenant_id: str,
        filters: RiskFilter
    ) -> RiskBenchmarking:
        """Get risk benchmarking against industry standards"""
        
        # Get industry benchmarks (would integrate with external data source)
        industry_benchmarks = await self._get_industry_benchmarks()
        
        # Calculate current performance
        current_metrics = await self.get_risk_metrics(tenant_id, filters)
        
        # Compare against peers
        peer_comparisons = []
        for peer_group, benchmark_score in industry_benchmarks.items():
            if peer_group.startswith("peer_"):
                percentile = self._calculate_percentile(
                    current_metrics.average_risk_score, 
                    benchmark_score
                )
                peer_comparisons.append({
                    "peer_group": peer_group,
                    "avg_risk": benchmark_score,
                    "percentile": percentile
                })
        
        benchmarking = RiskBenchmarking(
            industry_benchmarks=industry_benchmarks,
            peer_comparisons=peer_comparisons,
            performance_percentile=65.0,  # Mock calculation
            best_practices=[
                {"practice": "automated_risk_monitoring", "adoption_rate": 0.73},
                {"practice": "predictive_analytics", "adoption_rate": 0.52}
            ],
            improvement_opportunities=["Implement real-time monitoring", "Enhance predictive capabilities"]
        )
        
        return benchmarking
    
    # Helper methods
    async def _calculate_rule_based_risk(self, contract_data: Dict[str, Any]) -> float:
        """Calculate risk score using rule-based approach"""
        base_score = 5.0
        
        # Contract value factor
        value = contract_data.get("value", Decimal("0"))
        if value > Decimal("1000000"):
            base_score += 1.5
        elif value > Decimal("500000"):
            base_score += 1.0
        
        # Contract type factor
        contract_type = contract_data.get("contract_type", "")
        high_risk_types = ["outsourcing", "joint_venture", "merger"]
        if contract_type in high_risk_types:
            base_score += 2.0
        
        # Duration factor
        start_date = contract_data.get("start_date")
        end_date = contract_data.get("end_date")
        if start_date and end_date:
            duration_years = (end_date - start_date).days / 365
            if duration_years > 5:
                base_score += 1.0
        
        return min(10.0, base_score)
    
    def _determine_risk_level(self, risk_score: float) -> RiskSeverity:
        """Determine risk level from score"""
        if risk_score >= 8.5:
            return RiskSeverity.CRITICAL
        elif risk_score >= 6.5:
            return RiskSeverity.HIGH
        elif risk_score >= 4.0:
            return RiskSeverity.MEDIUM
        else:
            return RiskSeverity.LOW
    
    async def _identify_risk_factors(
        self, 
        contract_data: Dict[str, Any], 
        ml_factors: List[Dict] = None
    ) -> List[RiskFactor]:
        """Identify specific risk factors"""
        risk_factors = []
        
        # Add ML-identified factors
        if ml_factors:
            for factor in ml_factors:
                risk_factors.append(RiskFactor(
                    type=factor.get("type", "unknown"),
                    description=f"ML-identified risk: {factor.get('type')}",
                    probability=factor.get("impact", 0.5),
                    impact=factor.get("impact", 5.0) * 10,
                    severity=self._determine_risk_level(factor.get("impact", 5.0) * 10),
                    confidence=factor.get("confidence", 0.7)
                ))
        
        # Add rule-based factors
        value = contract_data.get("value", Decimal("0"))
        if value > Decimal("1000000"):
            risk_factors.append(RiskFactor(
                type="high_value_contract",
                description="Contract value exceeds $1M threshold",
                probability=0.3,
                impact=7.0,
                severity=RiskSeverity.HIGH,
                confidence=0.9,
                source="rule"
            ))
        
        return risk_factors
    
    async def _generate_mitigation_strategies(
        self, 
        risk_factors: List[RiskFactor]
    ) -> List[RiskMitigation]:
        """Generate mitigation strategies for identified risks"""
        strategies = []
        
        for factor in risk_factors:
            if factor.type == "high_value_contract":
                strategies.append(RiskMitigation(
                    risk_type=factor.type,
                    strategy="Enhanced monitoring and controls",
                    description="Implement additional oversight and approval processes",
                    cost_estimate=Decimal("15000.00"),
                    timeline="30 days",
                    effectiveness=0.8
                ))
            elif factor.type == "vendor_instability":
                strategies.append(RiskMitigation(
                    risk_type=factor.type,
                    strategy="Vendor diversification",
                    description="Identify and qualify alternative vendors",
                    cost_estimate=Decimal("25000.00"),
                    timeline="60 days",
                    effectiveness=0.75
                ))
        
        return strategies
    
    def _determine_primary_risk_category(self, risk_factors: List[RiskFactor]) -> RiskCategory:
        """Determine primary risk category from factors"""
        if not risk_factors:
            return RiskCategory.OPERATIONAL
        
        # Count risk types by category
        category_counts = {}
        for factor in risk_factors:
            category = self._map_risk_type_to_category(factor.type)
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # Return most common category
        return max(category_counts.items(), key=lambda x: x[1])[0]
    
    def _map_risk_type_to_category(self, risk_type: str) -> RiskCategory:
        """Map risk type to category"""
        mapping = {
            "vendor_instability": RiskCategory.VENDOR,
            "regulatory_change": RiskCategory.COMPLIANCE,
            "high_value_contract": RiskCategory.FINANCIAL,
            "service_disruption": RiskCategory.OPERATIONAL,
            "technical_risk": RiskCategory.TECHNICAL
        }
        return mapping.get(risk_type, RiskCategory.OPERATIONAL)
    
    async def _calculate_risk_trend(self, tenant_id: str, filters: RiskFilter) -> str:
        """Calculate overall risk trend direction"""
        # Mock trend calculation - would analyze historical data
        return "stable"
    
    def _calculate_trend_prediction(
        self, 
        historical_data: List[Dict], 
        horizon_days: int
    ) -> Tuple[float, float]:
        """Calculate trend-based prediction"""
        if not historical_data:
            return 5.0, 0.5
        
        # Simple linear trend
        scores = [float(d["avg_risk_score"]) for d in historical_data]
        if len(scores) < 2:
            return scores[0] if scores else 5.0, 0.6
        
        # Calculate simple trend
        trend = (scores[-1] - scores[0]) / len(scores)
        predicted_score = scores[-1] + (trend * (horizon_days / 30))
        
        # Limit to valid range
        predicted_score = max(0, min(10, predicted_score))
        
        # Confidence decreases with horizon
        confidence = max(0.5, 0.9 - (horizon_days / 365))
        
        return predicted_score, confidence
    
    def _calculate_period_trend(self, current_score: float) -> str:
        """Calculate trend direction for a period"""
        # Mock implementation - would compare with previous period
        return "stable"
    
    async def _analyze_scenario_basic(
        self, 
        scenario_config: Dict[str, Any], 
        tenant_id: str
    ) -> Dict[str, Any]:
        """Basic scenario analysis without ML"""
        return {
            "scenario_risk_score": 6.5,
            "affected_contracts": 5,
            "total_impact_value": "500000.00",
            "mitigation_cost": "100000.00",
            "confidence": 0.6
        }
    
    async def _analyze_impact_basic(
        self, 
        impact_config: Dict[str, Any], 
        tenant_id: str
    ) -> Dict[str, Any]:
        """Basic impact analysis without ML"""
        return {
            "financial_impact": {
                "direct_cost": Decimal("250000.00"),
                "indirect_cost": Decimal("100000.00"),
                "revenue_loss": Decimal("150000.00")
            },
            "operational_impact": {
                "service_disruption": 0.4,
                "productivity_loss": 0.25,
                "recovery_time_days": 30
            },
            "reputational_impact": {
                "brand_damage_score": 5.0,
                "customer_confidence": 0.8,
                "market_perception": 0.75
            },
            "confidence": 0.6
        }
    
    def _generate_warning_actions(self, warnings: List[Dict[str, Any]]) -> List[str]:
        """Generate recommended actions for warnings"""
        actions = []
        
        for warning in warnings:
            if warning["indicator_type"] == "vendor_financial_distress":
                actions.append("Review vendor financial stability and develop contingency plans")
            elif warning["indicator_type"] == "regulatory_change":
                actions.append("Assess regulatory compliance and update contract terms")
        
        return actions
    
    async def _get_industry_benchmarks(self) -> Dict[str, float]:
        """Get industry benchmark data"""
        return {
            "overall_risk_score": 5.8,
            "compliance_risk": 6.2,
            "operational_risk": 5.1,
            "financial_risk": 6.0,
            "peer_mid_market_legal": 5.9,
            "peer_technology_sector": 6.4
        }
    
    def _calculate_percentile(self, current_score: float, benchmark: float) -> float:
        """Calculate percentile ranking"""
        if benchmark == 0:
            return 50.0
        
        ratio = current_score / benchmark
        
        if ratio <= 0.8:
            return 25.0
        elif ratio <= 0.9:
            return 40.0
        elif ratio <= 1.1:
            return 50.0
        elif ratio <= 1.2:
            return 65.0
        else:
            return 80.0
    
    def _generate_cache_key(self, metric_type: str, tenant_id: str, filters: RiskFilter) -> str:
        """Generate cache key for risk metrics"""
        filter_hash = hashlib.md5(str(filters.__dict__).encode()).hexdigest()
        return f"risk:{metric_type}:{tenant_id}:{filter_hash}"


# Helper functions
def calculate_risk_score(risk_factors: List[Dict[str, Any]]) -> float:
    """Calculate overall risk score from individual factors"""
    if not risk_factors:
        return 0.0
    
    total_weighted_score = 0.0
    total_weight = 0.0
    
    for factor in risk_factors:
        probability = factor.get("probability", 0.5)
        impact = factor.get("impact", 5.0)
        weight = probability
        
        score = probability * impact
        total_weighted_score += score * weight
        total_weight += weight
    
    if total_weight == 0:
        return 0.0
    
    return min(10.0, total_weighted_score / total_weight)


def calculate_mitigation_effectiveness(mitigation_strategy: Dict[str, Any]) -> float:
    """Calculate mitigation strategy effectiveness"""
    risk_reduction = mitigation_strategy.get("risk_reduction", 0.5)
    implementation_probability = mitigation_strategy.get("implementation_probability", 0.8)
    cost_factor = min(1.0, 50000 / float(mitigation_strategy.get("cost", Decimal("25000.00"))))
    
    # Timeline factor (shorter is better)
    timeline = mitigation_strategy.get("timeline", "3 months")
    timeline_months = 3  # Default
    if "month" in timeline:
        try:
            timeline_months = int(timeline.split()[0])
        except:
            pass
    
    timeline_factor = max(0.5, 1.0 - (timeline_months / 12))
    
    effectiveness = (
        risk_reduction * 0.4 +
        implementation_probability * 0.3 +
        cost_factor * 0.2 +
        timeline_factor * 0.1
    )
    
    return min(1.0, effectiveness)


def calculate_prediction_confidence(model_metrics: Dict[str, Any]) -> float:
    """Calculate prediction confidence from model metrics"""
    accuracy = model_metrics.get("accuracy", 0.7)
    precision = model_metrics.get("precision", 0.7)
    recall = model_metrics.get("recall", 0.7)
    data_quality = model_metrics.get("data_quality", 0.8)
    feature_completeness = model_metrics.get("feature_completeness", 0.8)
    
    confidence = (
        accuracy * 0.3 +
        precision * 0.2 +
        recall * 0.2 +
        data_quality * 0.15 +
        feature_completeness * 0.15
    )
    
    return min(1.0, confidence)