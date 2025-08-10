"""
Metrics schemas for API validation
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator
from enum import Enum


class MetricType(str, Enum):
    """Types of metrics"""
    COUNT = "count"
    PERCENTAGE = "percentage"
    CURRENCY = "currency"
    DURATION = "duration"
    SCORE = "score"
    RATE = "rate"
    RATIO = "ratio"


class TimeGranularity(str, Enum):
    """Time granularity for aggregation"""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class AggregationMethod(str, Enum):
    """Aggregation methods"""
    SUM = "sum"
    AVERAGE = "average"
    MIN = "min"
    MAX = "max"
    MEDIAN = "median"
    COUNT = "count"


class MetricRequest(BaseModel):
    """Request to calculate a metric"""
    metric_id: str = Field(..., description="Metric identifier")
    tenant_id: str = Field(..., description="Tenant ID")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    refresh: bool = Field(False, description="Force refresh from source")


class MetricBatchRequest(BaseModel):
    """Request to calculate multiple metrics"""
    metrics: List[MetricRequest]
    tenant_id: str
    parallel: bool = Field(True, description="Process metrics in parallel")


class MetricResponse(BaseModel):
    """Metric calculation response"""
    metric_id: str
    value: float
    metric_type: MetricType
    unit: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
    trend: Optional[str] = None
    change_percentage: Optional[float] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class MetricTrendResponse(BaseModel):
    """Metric trend analysis response"""
    metric_id: str
    trend_direction: str = Field(..., pattern="^(increasing|decreasing|stable)$")
    trend_strength: float = Field(..., ge=0, le=1)
    slope: float
    r_squared: float = Field(..., ge=0, le=1)
    forecast: Optional[List[float]] = None
    confidence_interval: Optional[Dict[str, List[float]]] = None


class MetricHistoryResponse(BaseModel):
    """Metric history response"""
    metric_id: str
    history: List[Dict[str, Any]]
    granularity: TimeGranularity
    aggregation: AggregationMethod
    start_date: datetime
    end_date: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class MetricThresholdConfig(BaseModel):
    """Metric threshold configuration"""
    metric_id: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    warning_threshold: Optional[float] = None
    critical_threshold: Optional[float] = None
    alert_enabled: bool = True
    notification_channels: List[str] = Field(default_factory=list)

    @validator('min_value', 'max_value')
    def validate_thresholds(cls, v, values):
        if 'min_value' in values and 'max_value' in values:
            if values.get('min_value') and v and values['min_value'] >= v:
                raise ValueError("min_value must be less than max_value")
        return v


class MetricAlertResponse(BaseModel):
    """Metric alert response"""
    alert_id: str
    metric_id: str
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    message: str
    current_value: float
    threshold_value: float
    breach_type: str = Field(..., pattern="^(above|below)$")
    timestamp: datetime
    acknowledged: bool = False

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class MetricDashboardConfig(BaseModel):
    """Dashboard metrics configuration"""
    dashboard_id: str
    name: str
    description: Optional[str] = None
    metrics: List[str]
    layout: Dict[str, Any] = Field(default_factory=dict)
    refresh_interval: int = Field(300, ge=60, le=3600)
    filters: Optional[Dict[str, Any]] = None
    is_public: bool = False


class MetricExportRequest(BaseModel):
    """Request to export metrics"""
    metric_ids: List[str]
    tenant_id: str
    start_date: datetime
    end_date: datetime
    format: str = Field("csv", pattern="^(csv|json|excel)$")
    granularity: TimeGranularity = TimeGranularity.DAILY
    include_metadata: bool = False


class PerformanceScoreResponse(BaseModel):
    """Performance score response"""
    overall_score: float = Field(..., ge=0, le=100)
    category_scores: Dict[str, float]
    metrics_used: List[str]
    calculation_method: str
    benchmark_comparison: Optional[Dict[str, Any]] = None
    recommendations: List[str] = Field(default_factory=list)
    timestamp: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class MetricComparisonRequest(BaseModel):
    """Request to compare metrics"""
    metric_id: str
    tenant_id: str
    comparison_type: str = Field(..., pattern="^(period|department|category|tenant)$")
    entities: List[str] = Field(..., min_items=2, max_items=10)
    period: Optional[Dict[str, datetime]] = None


class MetricComparisonResponse(BaseModel):
    """Metric comparison response"""
    metric_id: str
    comparison_type: str
    results: List[Dict[str, Any]]
    winner: Optional[str] = None
    variance: float
    statistical_significance: bool
    visualization_data: Optional[Dict[str, Any]] = None