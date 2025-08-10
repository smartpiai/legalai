"""
Dashboard API endpoints for aggregated metrics and analytics.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.orm import selectinload

from app.core.database import get_async_session
from app.core.rbac import require_permission
from app.api.v1.auth import get_current_user
from app.models.contract import Contract, ContractStatus
from app.models.user import User
from app.models.notification import Notification
from app.models.activity import Activity
from app.services.analytics import AnalyticsService
from app.services.risk_assessment import RiskAssessmentService
from app.schemas.dashboard import (
    ExecutiveSummaryResponse,
    ContractMetricsResponse,
    RiskAnalyticsResponse,
    ActivityListResponse,
    DashboardFilters
)

router = APIRouter()


@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
@require_permission("dashboard.view")
async def get_executive_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
    analytics_service: AnalyticsService = Depends()
):
    """Get executive summary metrics for the dashboard."""
    tenant_id = current_user.tenant_id
    
    # Get contract counts
    total_contracts = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.is_deleted == False
            )
        )
    )
    
    active_contracts = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.status == ContractStatus.ACTIVE,
                Contract.is_deleted == False
            )
        )
    )
    
    # Contracts expiring in next 30 days
    expiry_date = datetime.utcnow() + timedelta(days=30)
    expiring_soon = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.status == ContractStatus.ACTIVE,
                Contract.end_date <= expiry_date,
                Contract.end_date >= datetime.utcnow(),
                Contract.is_deleted == False
            )
        )
    )
    
    # Total contract value
    total_value = await db.scalar(
        select(func.sum(Contract.value)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.status == ContractStatus.ACTIVE,
                Contract.is_deleted == False
            )
        )
    ) or 0
    
    # Calculate compliance rate (simplified - would be more complex in production)
    compliant_contracts = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.compliance_status == True,
                Contract.is_deleted == False
            )
        )
    )
    compliance_rate = (compliant_contracts / total_contracts) if total_contracts > 0 else 0
    
    # Get average risk score
    avg_risk_score = await analytics_service.calculate_average_risk_score(tenant_id)
    
    # Recent activities count (last 7 days)
    recent_activities = await db.scalar(
        select(func.count(Activity.id)).where(
            and_(
                Activity.tenant_id == tenant_id,
                Activity.created_at >= datetime.utcnow() - timedelta(days=7)
            )
        )
    )
    
    return ExecutiveSummaryResponse(
        total_contracts=total_contracts,
        active_contracts=active_contracts,
        expiring_soon=expiring_soon,
        total_value=float(total_value),
        compliance_rate=compliance_rate,
        risk_score=avg_risk_score,
        recent_activities=recent_activities
    )


@router.get("/contract-metrics", response_model=ContractMetricsResponse)
@require_permission("analytics.view")
async def get_contract_metrics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get detailed contract metrics and analytics."""
    tenant_id = current_user.tenant_id
    
    # Build base query
    base_query = and_(
        Contract.tenant_id == tenant_id,
        Contract.is_deleted == False
    )
    
    if start_date:
        base_query = and_(base_query, Contract.created_at >= start_date)
    if end_date:
        base_query = and_(base_query, Contract.created_at <= end_date)
    
    # Contracts by status
    status_counts = await db.execute(
        select(
            Contract.status,
            func.count(Contract.id).label('count')
        ).where(base_query).group_by(Contract.status)
    )
    by_status = {row.status: row.count for row in status_counts}
    
    # Contracts by type
    type_counts = await db.execute(
        select(
            Contract.contract_type,
            func.count(Contract.id).label('count')
        ).where(base_query).group_by(Contract.contract_type)
    )
    by_type = {row.contract_type: row.count for row in type_counts if row.contract_type}
    
    # Contracts by department
    dept_counts = await db.execute(
        select(
            Contract.department,
            func.count(Contract.id).label('count')
        ).where(base_query).group_by(Contract.department)
    )
    by_department = {row.department: row.count for row in dept_counts if row.department}
    
    # Monthly trend (last 6 months)
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    trend_data = await db.execute(
        select(
            func.date_trunc('month', Contract.created_at).label('month'),
            func.count(Contract.id).label('count'),
            func.sum(Contract.value).label('value')
        ).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.created_at >= six_months_ago,
                Contract.is_deleted == False
            )
        ).group_by('month').order_by('month')
    )
    
    trend = [
        {
            'month': row.month.strftime('%Y-%m'),
            'count': row.count,
            'value': float(row.value or 0)
        }
        for row in trend_data
    ]
    
    return ContractMetricsResponse(
        by_status=by_status,
        by_type=by_type,
        by_department=by_department,
        trend=trend
    )


@router.get("/risk-analytics", response_model=RiskAnalyticsResponse)
@require_permission("analytics.view")
async def get_risk_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
    risk_service: RiskAssessmentService = Depends()
):
    """Get risk analytics and high-risk contracts."""
    tenant_id = current_user.tenant_id
    
    # Get high-risk contracts (risk score > 0.7)
    high_risk_contracts = await risk_service.get_high_risk_contracts(tenant_id, threshold=0.7)
    
    # Get risk distribution
    risk_distribution = await risk_service.get_risk_distribution(tenant_id)
    
    # Get top risk factors
    top_risk_factors = await risk_service.get_top_risk_factors(tenant_id, limit=10)
    
    return RiskAnalyticsResponse(
        high_risk_contracts=[
            {
                'id': c.id,
                'title': c.title,
                'risk_score': c.risk_score,
                'risk_factors': c.risk_factors
            }
            for c in high_risk_contracts
        ],
        risk_distribution=risk_distribution,
        top_risk_factors=top_risk_factors
    )


@router.get("/activities", response_model=ActivityListResponse)
@require_permission("dashboard.view")
async def get_recent_activities(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    activity_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get recent activities for the dashboard."""
    tenant_id = current_user.tenant_id
    
    # Build query
    query = select(Activity).where(
        Activity.tenant_id == tenant_id
    ).options(selectinload(Activity.user))
    
    if activity_type:
        query = query.where(Activity.activity_type == activity_type)
    
    # Get total count
    count_query = select(func.count(Activity.id)).where(
        Activity.tenant_id == tenant_id
    )
    if activity_type:
        count_query = count_query.where(Activity.activity_type == activity_type)
    
    total = await db.scalar(count_query)
    
    # Apply pagination and ordering
    query = query.order_by(Activity.created_at.desc())
    query = query.offset(offset).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    activities = result.scalars().all()
    
    return ActivityListResponse(
        items=[
            {
                'id': a.id,
                'type': a.activity_type,
                'title': a.title,
                'description': a.description,
                'timestamp': a.created_at.isoformat(),
                'user': {
                    'id': a.user.id,
                    'name': a.user.full_name
                },
                'entity': {
                    'type': a.entity_type,
                    'id': a.entity_id,
                    'title': a.entity_title
                }
            }
            for a in activities
        ],
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/quick-stats")
@require_permission("dashboard.view")
async def get_quick_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get quick statistics for dashboard widgets."""
    tenant_id = current_user.tenant_id
    
    # Contracts needing review
    needs_review = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.status == ContractStatus.PENDING_REVIEW,
                Contract.is_deleted == False
            )
        )
    )
    
    # Contracts pending approval
    pending_approval = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.status == ContractStatus.PENDING_APPROVAL,
                Contract.is_deleted == False
            )
        )
    )
    
    # New contracts this month
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    new_this_month = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.created_at >= month_start,
                Contract.is_deleted == False
            )
        )
    )
    
    # Expired contracts
    expired = await db.scalar(
        select(func.count(Contract.id)).where(
            and_(
                Contract.tenant_id == tenant_id,
                Contract.status == ContractStatus.EXPIRED,
                Contract.is_deleted == False
            )
        )
    )
    
    return {
        'needs_review': needs_review,
        'pending_approval': pending_approval,
        'new_this_month': new_this_month,
        'expired': expired
    }


@router.get("/performance-metrics")
@require_permission("analytics.view")
async def get_performance_metrics(
    period: str = Query(default="7d", regex="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
    analytics_service: AnalyticsService = Depends()
):
    """Get performance metrics for the specified period."""
    tenant_id = current_user.tenant_id
    
    # Calculate period start date
    period_map = {
        '7d': timedelta(days=7),
        '30d': timedelta(days=30),
        '90d': timedelta(days=90),
        '1y': timedelta(days=365)
    }
    start_date = datetime.utcnow() - period_map[period]
    
    # Get performance metrics
    metrics = await analytics_service.calculate_performance_metrics(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=datetime.utcnow()
    )
    
    return metrics


@router.post("/export")
@require_permission("dashboard.export")
async def export_dashboard_data(
    format: str = Query(default="pdf", regex="^(pdf|excel|csv)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Export dashboard data in specified format."""
    # This would generate and return the export file
    # Implementation depends on reporting libraries
    return {
        "message": f"Dashboard export in {format} format initiated",
        "status": "processing"
    }