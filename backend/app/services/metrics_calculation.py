"""
Metrics Calculation Service Implementation
Following TDD - GREEN phase: Implementation to make tests pass
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
import json
import statistics
import numpy as np
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.exceptions import MetricError, ValidationError


class MetricType(Enum):
    """Types of metrics"""
    COUNT = "count"
    PERCENTAGE = "percentage"
    CURRENCY = "currency"
    DURATION = "duration"
    SCORE = "score"
    RATE = "rate"
    RATIO = "ratio"


class AggregationMethod(Enum):
    """Aggregation methods for metrics"""
    SUM = "sum"
    AVERAGE = "average"
    MIN = "min"
    MAX = "max"
    MEDIAN = "median"
    COUNT = "count"


class TimeGranularity(Enum):
    """Time granularity for aggregation"""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class MetricDefinition:
    """Metric definition"""
    def __init__(
        self,
        id: str,
        name: str,
        type: MetricType,
        category: str,
        description: str,
        calculation_method: str,
        aggregation: AggregationMethod,
        unit: str,
        refresh_interval: int = 300
    ):
        self.id = id
        self.name = name
        self.type = type
        self.category = category
        self.description = description
        self.calculation_method = calculation_method
        self.aggregation = aggregation
        self.unit = unit
        self.refresh_interval = refresh_interval


class CalculatedMetric:
    """Calculated metric result"""
    def __init__(
        self,
        metric_id: str,
        value: Any,
        metric_type: MetricType,
        unit: str = None,
        metadata: Dict = None,
        timestamp: datetime = None
    ):
        self.metric_id = metric_id
        self.value = value
        self.metric_type = metric_type
        self.unit = unit or self._get_default_unit(metric_type)
        self.metadata = metadata or {}
        self.timestamp = timestamp or datetime.utcnow()

    def _get_default_unit(self, metric_type: MetricType) -> str:
        """Get default unit for metric type"""
        units = {
            MetricType.COUNT: "items",
            MetricType.PERCENTAGE: "%",
            MetricType.CURRENCY: "USD",
            MetricType.DURATION: "days",
            MetricType.SCORE: "points",
            MetricType.RATE: "per day",
            MetricType.RATIO: "ratio"
        }
        return units.get(metric_type, "")


class MetricThreshold:
    """Metric threshold definition"""
    def __init__(
        self,
        metric_id: str,
        min_value: float = None,
        max_value: float = None,
        alert_on_breach: bool = True
    ):
        self.metric_id = metric_id
        self.min_value = min_value
        self.max_value = max_value
        self.alert_on_breach = alert_on_breach


class MetricAlert:
    """Metric alert"""
    def __init__(
        self,
        metric_id: str,
        message: str,
        severity: str,
        value: float,
        threshold: MetricThreshold
    ):
        self.metric_id = metric_id
        self.message = message
        self.severity = severity
        self.value = value
        self.threshold = threshold


class MetricError(Exception):
    """Metric calculation error"""
    pass


class MetricsCalculationService:
    """Service for calculating and managing metrics"""

    def __init__(
        self,
        db: AsyncSession,
        contract_repository=None,
        user_repository=None,
        cache_service=None
    ):
        self.db = db
        self.contract_repository = contract_repository
        self.user_repository = user_repository
        self.cache_service = cache_service
        self.metric_repository = None

    # Volume Metrics

    async def calculate_contract_volume(
        self,
        tenant_id: str,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> CalculatedMetric:
        """Calculate total contract volume"""
        try:
            count = await self.contract_repository.get_count(
                tenant_id=tenant_id,
                start_date=start_date,
                end_date=end_date
            )
            
            return CalculatedMetric(
                metric_id="contract_volume",
                value=count,
                metric_type=MetricType.COUNT,
                unit="contracts"
            )
        except Exception as e:
            raise MetricError(f"Failed to calculate metric: {str(e)}")

    async def calculate_active_contracts(
        self,
        tenant_id: str
    ) -> CalculatedMetric:
        """Calculate active contract count"""
        count = await self.contract_repository.get_active_count(tenant_id=tenant_id)
        
        return CalculatedMetric(
            metric_id="active_contracts",
            value=count,
            metric_type=MetricType.COUNT,
            unit="contracts",
            metadata={"status": "active"}
        )

    async def calculate_growth_rate(
        self,
        metric_id: str,
        current_value: float,
        previous_value: float,
        tenant_id: str
    ) -> CalculatedMetric:
        """Calculate growth rate percentage"""
        if previous_value == 0:
            growth_rate = 100.0 if current_value > 0 else 0.0
        else:
            growth_rate = ((current_value - previous_value) / previous_value) * 100
        
        return CalculatedMetric(
            metric_id=f"{metric_id}_growth",
            value=round(growth_rate, 2),
            metric_type=MetricType.PERCENTAGE,
            unit="%"
        )

    # Cycle Time Metrics

    async def calculate_cycle_time(
        self,
        tenant_id: str,
        period_days: int = 30
    ) -> CalculatedMetric:
        """Calculate average contract cycle time"""
        contracts = await self.contract_repository.get_completed_contracts(
            tenant_id=tenant_id,
            period_days=period_days
        )
        
        if not contracts:
            return CalculatedMetric(
                metric_id="cycle_time",
                value=0,
                metric_type=MetricType.DURATION,
                unit="days"
            )
        
        cycle_times = []
        for contract in contracts:
            if contract.get("approved_at") and contract.get("created_at"):
                delta = contract["approved_at"] - contract["created_at"]
                cycle_times.append(delta.days)
        
        avg_cycle_time = statistics.mean(cycle_times) if cycle_times else 0
        
        return CalculatedMetric(
            metric_id="cycle_time",
            value=round(avg_cycle_time, 2),
            metric_type=MetricType.DURATION,
            unit="days"
        )

    async def identify_bottlenecks(
        self,
        tenant_id: str,
        threshold_percentile: float = 75
    ) -> List[Dict]:
        """Identify process bottlenecks"""
        stage_times = await self.calculate_stage_times(tenant_id)
        
        if not stage_times:
            return []
        
        # Calculate threshold
        times = list(stage_times.values())
        threshold = np.percentile(times, threshold_percentile)
        
        bottlenecks = []
        for stage, time in stage_times.items():
            if time > threshold:
                bottlenecks.append({
                    "stage": stage,
                    "average_time": time,
                    "severity": "high" if time > threshold * 1.5 else "medium"
                })
        
        return bottlenecks

    async def calculate_stage_times(self, tenant_id: str) -> Dict[str, float]:
        """Calculate average time for each workflow stage"""
        # Mock implementation - would query actual workflow data
        return {
            "draft": 2.5,
            "review": 8.2,
            "approval": 1.3,
            "signature": 2.1
        }

    # Value Analytics

    async def calculate_total_value(
        self,
        tenant_id: str,
        currency: str = "USD"
    ) -> CalculatedMetric:
        """Calculate total contract value"""
        total = await self.contract_repository.get_total_value(
            tenant_id=tenant_id,
            currency=currency
        )
        
        # Format currency
        formatted = f"${total:,.2f}" if currency == "USD" else f"{total:,.2f} {currency}"
        
        return CalculatedMetric(
            metric_id="total_value",
            value=float(total),
            metric_type=MetricType.CURRENCY,
            unit=currency,
            metadata={"formatted": formatted}
        )

    async def calculate_average_value(
        self,
        tenant_id: str
    ) -> CalculatedMetric:
        """Calculate average contract value"""
        total = await self.contract_repository.get_total_value(tenant_id=tenant_id)
        count = await self.contract_repository.get_count(tenant_id=tenant_id)
        
        avg_value = float(total) / count if count > 0 else 0
        
        return CalculatedMetric(
            metric_id="average_value",
            value=avg_value,
            metric_type=MetricType.CURRENCY,
            unit="USD",
            metadata={"calculation": "total_value / count"}
        )

    async def calculate_value_at_risk(
        self,
        tenant_id: str,
        days_ahead: int = 30
    ) -> CalculatedMetric:
        """Calculate value at risk for expiring contracts"""
        expiring = await self.contract_repository.get_expiring_contracts(
            tenant_id=tenant_id,
            days_ahead=days_ahead
        )
        
        total_value = sum(c["value"] for c in expiring)
        
        return CalculatedMetric(
            metric_id="value_at_risk",
            value=total_value,
            metric_type=MetricType.CURRENCY,
            unit="USD",
            metadata={"contracts": expiring}
        )

    # Risk Metrics

    async def calculate_risk_score(
        self,
        tenant_id: str
    ) -> CalculatedMetric:
        """Calculate overall risk score"""
        risk_factors = await self.assess_risk_factors(tenant_id)
        
        # Weighted risk score calculation
        weights = {
            "high_value_concentration": 0.3,
            "compliance_issues": 0.2,
            "expiring_contracts": 0.25,
            "missing_clauses": 0.15,
            "vendor_performance": 0.1
        }
        
        score = sum(
            risk_factors.get(factor, 0) * weight 
            for factor, weight in weights.items()
        )
        
        # Normalize to 0-100
        normalized_score = min(100, max(0, score * 100))
        
        return CalculatedMetric(
            metric_id="risk_score",
            value=round(normalized_score, 1),
            metric_type=MetricType.SCORE,
            unit="points",
            metadata={"risk_factors": risk_factors}
        )

    async def assess_risk_factors(self, tenant_id: str) -> Dict[str, float]:
        """Assess individual risk factors"""
        # Mock implementation
        return {
            "high_value_concentration": 0.3,
            "compliance_issues": 0.2,
            "expiring_contracts": 0.25,
            "missing_clauses": 0.15,
            "vendor_performance": 0.1
        }

    async def calculate_compliance_rate(
        self,
        tenant_id: str
    ) -> CalculatedMetric:
        """Calculate compliance rate"""
        stats = await self.contract_repository.get_compliance_stats(tenant_id=tenant_id)
        
        rate = (stats["compliant"] / stats["total"]) * 100 if stats["total"] > 0 else 0
        
        return CalculatedMetric(
            metric_id="compliance_rate",
            value=round(rate, 1),
            metric_type=MetricType.PERCENTAGE,
            unit="%",
            metadata={"compliant_count": stats["compliant"]}
        )

    # User Activity Metrics

    async def calculate_user_activity(
        self,
        tenant_id: str,
        period_days: int = 7
    ) -> Dict:
        """Calculate user activity metrics"""
        active_users = await self.user_repository.get_active_users(
            tenant_id=tenant_id,
            period_days=period_days
        )
        
        total_logins = await self.user_repository.get_login_count(
            tenant_id=tenant_id,
            period_days=period_days
        )
        
        avg_session = await self.user_repository.get_average_session_duration(
            tenant_id=tenant_id
        )
        
        return {
            "active_users": active_users,
            "total_logins": total_logins,
            "avg_session_duration": avg_session
        }

    async def calculate_productivity(
        self,
        tenant_id: str,
        user_id: str,
        period_days: int = 30
    ) -> Dict:
        """Calculate user productivity metrics"""
        actions = await self.user_repository.get_user_actions(
            tenant_id=tenant_id,
            user_id=user_id,
            period_days=period_days
        )
        
        contracts_per_day = actions["contracts_created"] / period_days
        
        # Simple efficiency score based on actions and time
        efficiency_score = (
            (actions["contracts_created"] * 10 +
             actions["contracts_reviewed"] * 5 +
             actions["templates_used"] * 3) /
            max(1, actions["avg_processing_time"] / 60)
        )
        
        return {
            "contracts_per_day": round(contracts_per_day, 1),
            "efficiency_score": round(efficiency_score, 1)
        }

    # Cost Savings Metrics

    async def calculate_cost_savings(
        self,
        tenant_id: str,
        period_days: int = 30
    ) -> CalculatedMetric:
        """Calculate cost savings from automation"""
        stats = await self.calculate_automation_stats(tenant_id, period_days)
        
        savings = stats["time_saved_hours"] * stats["hourly_rate"]
        
        return CalculatedMetric(
            metric_id="cost_savings",
            value=savings,
            metric_type=MetricType.CURRENCY,
            unit="USD",
            metadata={"time_saved_hours": stats["time_saved_hours"]}
        )

    async def calculate_automation_stats(
        self,
        tenant_id: str,
        period_days: int
    ) -> Dict:
        """Calculate automation statistics"""
        # Mock implementation
        return {
            "automated_reviews": 234,
            "time_saved_hours": 468,
            "manual_interventions_avoided": 189,
            "hourly_rate": 150
        }

    async def calculate_roi(
        self,
        tenant_id: str,
        investment: float,
        period_days: int = 365
    ) -> CalculatedMetric:
        """Calculate return on investment"""
        savings = await self.calculate_cost_savings(tenant_id, period_days)
        
        roi = ((savings.value - investment) / investment) * 100 if investment > 0 else 0
        
        return CalculatedMetric(
            metric_id="roi",
            value=round(roi, 1),
            metric_type=MetricType.PERCENTAGE,
            unit="%"
        )

    # Efficiency Metrics

    async def calculate_automation_rate(
        self,
        tenant_id: str
    ) -> CalculatedMetric:
        """Calculate automation rate"""
        stats = await self.contract_repository.get_processing_stats(tenant_id=tenant_id)
        
        rate = (stats["automated"] / stats["total"]) * 100 if stats["total"] > 0 else 0
        
        return CalculatedMetric(
            metric_id="automation_rate",
            value=round(rate, 1),
            metric_type=MetricType.PERCENTAGE,
            unit="%"
        )

    async def calculate_error_rate(
        self,
        tenant_id: str,
        period_days: int = 30
    ) -> CalculatedMetric:
        """Calculate error rate in processing"""
        stats = await self.get_error_stats(tenant_id, period_days)
        
        rate = (stats["errors"] / stats["total_processed"]) * 100 \
            if stats["total_processed"] > 0 else 0
        
        return CalculatedMetric(
            metric_id="error_rate",
            value=round(rate, 1),
            metric_type=MetricType.PERCENTAGE,
            unit="%",
            metadata={"error_count": stats["errors"]}
        )

    async def get_error_stats(
        self,
        tenant_id: str,
        period_days: int
    ) -> Dict:
        """Get error statistics"""
        # Mock implementation
        return {
            "errors": 15,
            "total_processed": 1000
        }

    # Trending and Forecasting

    async def calculate_trend(
        self,
        metric_id: str,
        tenant_id: str,
        period_days: int = 30
    ) -> Dict:
        """Calculate metric trend"""
        data = await self.get_historical_data(metric_id, tenant_id, period_days)
        
        if len(data) < 2:
            return {"trend_direction": "stable", "trend_strength": 0}
        
        # Extract values
        values = [d["value"] for d in data]
        x = list(range(len(values)))
        
        # Calculate linear regression
        slope, intercept = np.polyfit(x, values, 1)
        
        # Calculate R-squared
        y_pred = [slope * xi + intercept for xi in x]
        ss_res = sum((y - yp) ** 2 for y, yp in zip(values, y_pred))
        ss_tot = sum((y - np.mean(values)) ** 2 for y in values)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        
        # Determine trend direction
        if slope > 0.1:
            direction = "increasing"
        elif slope < -0.1:
            direction = "decreasing"
        else:
            direction = "stable"
        
        return {
            "trend_direction": direction,
            "trend_strength": abs(slope),
            "slope": slope,
            "r_squared": r_squared
        }

    async def get_historical_data(
        self,
        metric_id: str,
        tenant_id: str,
        period_days: int
    ) -> List[Dict]:
        """Get historical metric data"""
        # Mock implementation
        return [
            {"date": "2024-01-01", "value": 100},
            {"date": "2024-01-02", "value": 110},
            {"date": "2024-01-03", "value": 105},
            {"date": "2024-01-04", "value": 115},
            {"date": "2024-01-05", "value": 120}
        ]

    async def forecast_metric(
        self,
        metric_id: str,
        tenant_id: str,
        days_ahead: int = 7
    ) -> Dict:
        """Forecast future metric values"""
        data = await self.get_time_series_data(metric_id, tenant_id)
        
        if len(data) < 3:
            return {"predictions": [], "confidence_level": 0}
        
        # Simple linear extrapolation
        x = list(range(len(data)))
        slope, intercept = np.polyfit(x, data, 1)
        
        predictions = []
        for i in range(days_ahead):
            future_x = len(data) + i
            predicted = slope * future_x + intercept
            predictions.append(round(predicted, 2))
        
        # Calculate confidence bounds
        std_dev = np.std(data)
        
        return {
            "predictions": predictions,
            "confidence_level": 0.85,  # Mock confidence
            "upper_bound": [p + std_dev for p in predictions],
            "lower_bound": [p - std_dev for p in predictions]
        }

    async def get_time_series_data(
        self,
        metric_id: str,
        tenant_id: str
    ) -> List[float]:
        """Get time series data for metric"""
        # Mock implementation
        return [100, 110, 105, 115, 120, 125, 130]

    # Batch Operations

    async def calculate_batch(
        self,
        requests: List
    ) -> List[CalculatedMetric]:
        """Calculate multiple metrics in batch"""
        results = []
        
        for request in requests:
            metric = await self.calculate_metric(
                metric_id=request.metric_id,
                tenant_id=request.tenant_id
            )
            results.append(metric)
        
        return results

    async def calculate_metric(
        self,
        metric_id: str,
        tenant_id: str
    ) -> CalculatedMetric:
        """Calculate a single metric by ID"""
        metric_map = {
            "contract_volume": self.calculate_contract_volume,
            "active_contracts": self.calculate_active_contracts,
            "total_value": self.calculate_total_value,
            "compliance_rate": self.calculate_compliance_rate,
            "automation_rate": self.calculate_automation_rate,
            "risk_score": self.calculate_risk_score
        }
        
        if metric_id not in metric_map:
            raise ValueError(f"Unknown metric: {metric_id}")
        
        return await metric_map[metric_id](tenant_id=tenant_id)

    async def calculate_all_metrics(
        self,
        tenant_id: str,
        categories: List[str]
    ) -> Dict[str, List[CalculatedMetric]]:
        """Calculate all metrics for specified categories"""
        results = {}
        
        category_metrics = {
            "contracts": ["contract_volume", "active_contracts", "total_value"],
            "compliance": ["compliance_rate", "risk_score"],
            "efficiency": ["automation_rate", "error_rate"]
        }
        
        for category in categories:
            if category in category_metrics:
                metrics = []
                for metric_id in category_metrics[category]:
                    metric = await self.calculate_metric(metric_id, tenant_id)
                    metrics.append(metric)
                results[category] = metrics
        
        return results

    # Aggregation

    async def aggregate_by_time(
        self,
        data: List[Dict],
        granularity: TimeGranularity,
        method: AggregationMethod
    ) -> List[Dict]:
        """Aggregate metrics by time granularity"""
        grouped = defaultdict(list)
        
        for item in data:
            timestamp = item["timestamp"]
            
            if granularity == TimeGranularity.DAILY:
                key = timestamp.date()
            elif granularity == TimeGranularity.WEEKLY:
                key = timestamp.isocalendar()[1]  # Week number
            elif granularity == TimeGranularity.MONTHLY:
                key = timestamp.month
            else:
                key = timestamp.date()
            
            grouped[key].append(item["value"])
        
        # Apply aggregation method
        results = []
        for key, values in grouped.items():
            if method == AggregationMethod.SUM:
                agg_value = sum(values)
            elif method == AggregationMethod.AVERAGE:
                agg_value = statistics.mean(values)
            elif method == AggregationMethod.MIN:
                agg_value = min(values)
            elif method == AggregationMethod.MAX:
                agg_value = max(values)
            else:
                agg_value = sum(values)
            
            results.append({"period": key, "value": agg_value})
        
        return results

    async def aggregate_by_dimension(
        self,
        data: List[Dict],
        dimension: str,
        method: AggregationMethod
    ) -> Dict:
        """Aggregate metrics by dimension"""
        grouped = defaultdict(list)
        
        for item in data:
            key = item.get(dimension)
            if key:
                grouped[key].append(item["value"])
        
        results = {}
        for key, values in grouped.items():
            if method == AggregationMethod.AVERAGE:
                results[key] = statistics.mean(values)
            elif method == AggregationMethod.SUM:
                results[key] = sum(values)
            else:
                results[key] = sum(values)
        
        return results

    # Thresholds and Alerts

    async def check_threshold(
        self,
        value: float,
        threshold: MetricThreshold
    ) -> Optional[MetricAlert]:
        """Check if value breaches threshold"""
        if threshold.min_value is not None and value < threshold.min_value:
            return MetricAlert(
                metric_id=threshold.metric_id,
                message=f"Metric below minimum threshold: {value} < {threshold.min_value}",
                severity="high",
                value=value,
                threshold=threshold
            )
        
        if threshold.max_value is not None and value > threshold.max_value:
            return MetricAlert(
                metric_id=threshold.metric_id,
                message=f"Metric above maximum threshold: {value} > {threshold.max_value}",
                severity="high",
                value=value,
                threshold=threshold
            )
        
        return None

    async def generate_alerts(
        self,
        tenant_id: str
    ) -> List[MetricAlert]:
        """Generate alerts for threshold breaches"""
        thresholds = await self.get_active_thresholds(tenant_id)
        alerts = []
        
        for threshold in thresholds:
            metric = await self.calculate_metric(threshold.metric_id, tenant_id)
            alert = await self.check_threshold(metric.value, threshold)
            if alert:
                alerts.append(alert)
        
        return alerts

    async def get_active_thresholds(
        self,
        tenant_id: str
    ) -> List[MetricThreshold]:
        """Get active metric thresholds"""
        # Mock implementation
        return []

    # Caching

    async def cache_metric(
        self,
        metric: CalculatedMetric,
        tenant_id: str,
        ttl: int = 300
    ):
        """Cache calculated metric"""
        if self.cache_service:
            cache_key = f"metric:{tenant_id}:{metric.metric_id}"
            cache_data = {
                "metric_id": metric.metric_id,
                "value": metric.value,
                "timestamp": metric.timestamp.isoformat()
            }
            await self.cache_service.set(
                cache_key,
                json.dumps(cache_data),
                ttl=ttl
            )

    async def get_cached_metric(
        self,
        metric_id: str,
        tenant_id: str
    ) -> Optional[Dict]:
        """Get cached metric if available"""
        if self.cache_service:
            cache_key = f"metric:{tenant_id}:{metric_id}"
            cached = await self.cache_service.get(cache_key)
            if cached:
                return json.loads(cached)
        return None

    # Historical Data

    async def save_snapshot(
        self,
        metrics: Dict,
        tenant_id: str
    ) -> str:
        """Save metrics snapshot"""
        snapshot_id = f"snapshot_{tenant_id}_{datetime.utcnow().isoformat()}"
        
        # Would save to database
        await self.db.commit()
        
        return snapshot_id

    async def get_metric_history(
        self,
        metric_id: str,
        tenant_id: str,
        days: int = 30
    ) -> List[Dict]:
        """Get metric history"""
        if self.metric_repository:
            return await self.metric_repository.get_history(
                metric_id=metric_id,
                tenant_id=tenant_id,
                days=days
            )
        return []

    # Performance Scoring

    async def calculate_performance_score(
        self,
        tenant_id: str,
        weights: Dict[str, float]
    ) -> float:
        """Calculate weighted performance score"""
        metrics = await self.get_normalized_metrics(tenant_id)
        
        score = sum(
            metrics.get(metric, 0) * weight
            for metric, weight in weights.items()
        )
        
        return round(score, 1)

    async def get_normalized_metrics(
        self,
        tenant_id: str
    ) -> Dict[str, float]:
        """Get normalized metric values (0-100 scale)"""
        # Mock implementation
        return {
            "compliance_rate": 95,
            "automation_rate": 78,
            "cycle_time": 85,
            "error_rate": 98,
            "user_satisfaction": 88
        }

    async def get_historical_value(
        self,
        metric_id: str,
        tenant_id: str,
        days_ago: int = 30
    ) -> float:
        """Get historical metric value"""
        # Mock implementation
        return 1400