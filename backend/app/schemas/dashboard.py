"""
Dashboard schemas for API responses.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ExecutiveSummaryResponse(BaseModel):
    """Executive summary metrics response."""
    total_contracts: int = Field(description="Total number of contracts")
    active_contracts: int = Field(description="Number of active contracts")
    expiring_soon: int = Field(description="Contracts expiring in next 30 days")
    total_value: float = Field(description="Total value of active contracts")
    compliance_rate: float = Field(description="Compliance rate (0-1)")
    risk_score: float = Field(description="Average risk score (0-1)")
    recent_activities: int = Field(description="Number of activities in last 7 days")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_contracts": 150,
                "active_contracts": 120,
                "expiring_soon": 15,
                "total_value": 5000000.00,
                "compliance_rate": 0.95,
                "risk_score": 0.25,
                "recent_activities": 45
            }
        }


class ContractMetricsResponse(BaseModel):
    """Contract metrics and analytics response."""
    by_status: Dict[str, int] = Field(description="Contract counts by status")
    by_type: Dict[str, int] = Field(description="Contract counts by type")
    by_department: Dict[str, int] = Field(description="Contract counts by department")
    trend: List[Dict[str, Any]] = Field(description="Monthly trend data")
    
    class Config:
        json_schema_extra = {
            "example": {
                "by_status": {
                    "draft": 20,
                    "active": 80,
                    "expired": 15,
                    "terminated": 5
                },
                "by_type": {
                    "service_agreement": 45,
                    "nda": 30,
                    "purchase_order": 25,
                    "license": 20
                },
                "by_department": {
                    "legal": 40,
                    "procurement": 35,
                    "sales": 25,
                    "hr": 20
                },
                "trend": [
                    {"month": "2024-01", "count": 10, "value": 100000},
                    {"month": "2024-02", "count": 15, "value": 150000}
                ]
            }
        }


class RiskAnalyticsResponse(BaseModel):
    """Risk analytics response."""
    high_risk_contracts: List[Dict[str, Any]] = Field(description="High risk contracts")
    risk_distribution: Dict[str, int] = Field(description="Risk distribution")
    top_risk_factors: List[Dict[str, Any]] = Field(description="Top risk factors")
    
    class Config:
        json_schema_extra = {
            "example": {
                "high_risk_contracts": [
                    {
                        "id": "contract-1",
                        "title": "Service Agreement",
                        "risk_score": 0.85,
                        "risk_factors": ["Missing SLA", "No termination clause"]
                    }
                ],
                "risk_distribution": {
                    "low": 60,
                    "medium": 30,
                    "high": 10
                },
                "top_risk_factors": [
                    {"factor": "Missing clauses", "count": 25},
                    {"factor": "Expired insurance", "count": 18}
                ]
            }
        }


class ActivityListResponse(BaseModel):
    """Activity list response with pagination."""
    items: List[Dict[str, Any]] = Field(description="List of activities")
    total: int = Field(description="Total number of activities")
    limit: int = Field(description="Items per page")
    offset: int = Field(description="Offset for pagination")
    
    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {
                        "id": "activity-1",
                        "type": "contract_created",
                        "title": "New contract created",
                        "description": "Service Agreement created by John Doe",
                        "timestamp": "2024-02-15T10:00:00Z",
                        "user": {
                            "id": "user-1",
                            "name": "John Doe"
                        },
                        "entity": {
                            "type": "contract",
                            "id": "contract-1",
                            "title": "Service Agreement"
                        }
                    }
                ],
                "total": 100,
                "limit": 20,
                "offset": 0
            }
        }


class DashboardFilters(BaseModel):
    """Dashboard filter parameters."""
    start_date: Optional[datetime] = Field(None, description="Start date for filtering")
    end_date: Optional[datetime] = Field(None, description="End date for filtering")
    department: Optional[str] = Field(None, description="Department filter")
    contract_type: Optional[str] = Field(None, description="Contract type filter")
    status: Optional[str] = Field(None, description="Status filter")
    
    class Config:
        json_schema_extra = {
            "example": {
                "start_date": "2024-01-01T00:00:00Z",
                "end_date": "2024-12-31T23:59:59Z",
                "department": "legal",
                "contract_type": "service_agreement",
                "status": "active"
            }
        }


class QuickStatsResponse(BaseModel):
    """Quick statistics response."""
    needs_review: int = Field(description="Contracts needing review")
    pending_approval: int = Field(description="Contracts pending approval")
    new_this_month: int = Field(description="New contracts this month")
    expired: int = Field(description="Expired contracts")
    
    class Config:
        json_schema_extra = {
            "example": {
                "needs_review": 5,
                "pending_approval": 3,
                "new_this_month": 12,
                "expired": 8
            }
        }


class PerformanceMetricsResponse(BaseModel):
    """Performance metrics response."""
    period: str = Field(description="Period for metrics")
    average_processing_time: float = Field(description="Average processing time in seconds")
    total_processed: int = Field(description="Total contracts processed")
    success_rate: float = Field(description="Success rate (0-1)")
    user_satisfaction: float = Field(description="User satisfaction score (0-5)")
    system_uptime: float = Field(description="System uptime percentage")
    
    class Config:
        json_schema_extra = {
            "example": {
                "period": "30d",
                "average_processing_time": 45.2,
                "total_processed": 234,
                "success_rate": 0.98,
                "user_satisfaction": 4.5,
                "system_uptime": 99.9
            }
        }