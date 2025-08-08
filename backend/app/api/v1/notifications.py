"""
Notification API endpoints for the Legal AI Platform.
Handles notification delivery, preferences, templates, and real-time updates.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

from app.api.deps import get_current_user, get_db
from app.core.permissions import require_permission
from app.models.user import User
from app.models.notification import (
    Notification,
    NotificationTemplate,
    NotificationPreference,
    NotificationSubscription,
    NotificationStatus,
    NotificationChannel,
    NotificationType
)
from app.services.notification import NotificationService, WebSocketManager
from app.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    NotificationResponse,
    NotificationListResponse,
    NotificationTemplateCreate,
    NotificationTemplateUpdate,
    NotificationTemplateResponse,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    NotificationSubscriptionCreate,
    NotificationSubscriptionResponse,
    BulkNotificationCreate,
    NotificationStatsResponse,
    WebSocketMessage
)

router = APIRouter()
websocket_manager = WebSocketManager()


@router.post("/send", response_model=NotificationResponse)
async def send_notification(
    notification_data: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a notification to a user."""
    service = NotificationService(db)
    
    # Check if current user can send to target user
    if notification_data.user_id != current_user.id:
        # Check if user has permission to send to others
        await require_permission("notifications.send_to_others")(current_user, db)
    
    notification = await service.send_notification(
        notification_data,
        tenant_id=current_user.tenant_id
    )
    
    return notification


@router.post("/send-bulk", response_model=List[NotificationResponse])
@require_permission("notifications.send_bulk")
async def send_bulk_notifications(
    bulk_data: BulkNotificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send notifications to multiple users."""
    service = NotificationService(db)
    
    notifications = await service.send_bulk_notification(
        bulk_data,
        tenant_id=current_user.tenant_id
    )
    
    return notifications


@router.post("/send-templated", response_model=NotificationResponse)
async def send_templated_notification(
    template_code: str,
    user_id: int,
    variables: dict,
    override_channel: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a notification using a template."""
    service = NotificationService(db)
    
    # Check permissions
    if user_id != current_user.id:
        await require_permission("notifications.send_to_others")(current_user, db)
    
    notification = await service.send_templated_notification(
        template_code=template_code,
        user_id=user_id,
        tenant_id=current_user.tenant_id,
        variables=variables,
        override_channel=override_channel
    )
    
    return notification


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[NotificationStatus] = None,
    type: Optional[NotificationType] = None,
    channel: Optional[NotificationChannel] = None,
    is_read: Optional[bool] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List notifications for the current user."""
    # Build query
    query = select(Notification).where(
        and_(
            Notification.user_id == current_user.id,
            Notification.tenant_id == current_user.tenant_id
        )
    )
    
    # Apply filters
    if status:
        query = query.where(Notification.status == status)
    if type:
        query = query.where(Notification.type == type)
    if channel:
        query = query.where(Notification.channel == channel)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
    if from_date:
        query = query.where(Notification.created_at >= from_date)
    if to_date:
        query = query.where(Notification.created_at <= to_date)
    
    # Order by created date descending
    query = query.order_by(Notification.created_at.desc())
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get unread count
    unread_query = select(func.count()).where(
        and_(
            Notification.user_id == current_user.id,
            Notification.tenant_id == current_user.tenant_id,
            Notification.is_read == False
        )
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)
    
    # Execute query
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return NotificationListResponse(
        notifications=notifications,
        total=total,
        unread_count=unread_count,
        page=page,
        per_page=per_page
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific notification."""
    query = select(Notification).where(
        and_(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.tenant_id == current_user.tenant_id
        )
    )
    
    result = await db.execute(query)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return notification


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a notification as read."""
    service = NotificationService(db)
    
    notification = await service.mark_as_read(
        notification_id=notification_id,
        user_id=current_user.id
    )
    
    return notification


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read for current user."""
    query = select(Notification).where(
        and_(
            Notification.user_id == current_user.id,
            Notification.tenant_id == current_user.tenant_id,
            Notification.is_read == False
        )
    )
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    for notification in notifications:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        notification.status = NotificationStatus.READ
    
    await db.commit()
    
    return {"message": f"Marked {len(notifications)} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a notification."""
    query = select(Notification).where(
        and_(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.tenant_id == current_user.tenant_id
        )
    )
    
    result = await db.execute(query)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notification)
    await db.commit()
    
    return {"message": "Notification deleted"}


# Preference endpoints
@router.get("/preferences/me", response_model=NotificationPreferenceResponse)
async def get_my_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notification preferences for current user."""
    query = select(NotificationPreference).where(
        and_(
            NotificationPreference.user_id == current_user.id,
            NotificationPreference.tenant_id == current_user.tenant_id
        )
    )
    
    result = await db.execute(query)
    preferences = result.scalar_one_or_none()
    
    if not preferences:
        # Create default preferences
        preferences = NotificationPreference(
            user_id=current_user.id,
            tenant_id=current_user.tenant_id
        )
        db.add(preferences)
        await db.commit()
        await db.refresh(preferences)
    
    return preferences


@router.patch("/preferences/me", response_model=NotificationPreferenceResponse)
async def update_my_preferences(
    preferences_data: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update notification preferences for current user."""
    query = select(NotificationPreference).where(
        and_(
            NotificationPreference.user_id == current_user.id,
            NotificationPreference.tenant_id == current_user.tenant_id
        )
    )
    
    result = await db.execute(query)
    preferences = result.scalar_one_or_none()
    
    if not preferences:
        preferences = NotificationPreference(
            user_id=current_user.id,
            tenant_id=current_user.tenant_id
        )
        db.add(preferences)
    
    # Update preferences
    for field, value in preferences_data.dict(exclude_unset=True).items():
        setattr(preferences, field, value)
    
    await db.commit()
    await db.refresh(preferences)
    
    return preferences


# Template endpoints
@router.post("/templates", response_model=NotificationTemplateResponse)
@require_permission("notifications.manage_templates")
async def create_template(
    template_data: NotificationTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a notification template."""
    # Check if template code already exists
    query = select(NotificationTemplate).where(
        and_(
            NotificationTemplate.tenant_id == current_user.tenant_id,
            NotificationTemplate.code == template_data.code
        )
    )
    
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Template with code '{template_data.code}' already exists"
        )
    
    template = NotificationTemplate(
        **template_data.dict(),
        tenant_id=current_user.tenant_id,
        created_by=current_user.id
    )
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return template


@router.get("/templates", response_model=List[NotificationTemplateResponse])
async def list_templates(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List notification templates."""
    query = select(NotificationTemplate).where(
        NotificationTemplate.tenant_id == current_user.tenant_id
    )
    
    if is_active is not None:
        query = query.where(NotificationTemplate.is_active == is_active)
    
    result = await db.execute(query)
    templates = result.scalars().all()
    
    return templates


@router.get("/templates/{template_id}", response_model=NotificationTemplateResponse)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a notification template."""
    query = select(NotificationTemplate).where(
        and_(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == current_user.tenant_id
        )
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


@router.patch("/templates/{template_id}", response_model=NotificationTemplateResponse)
@require_permission("notifications.manage_templates")
async def update_template(
    template_id: int,
    template_data: NotificationTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a notification template."""
    query = select(NotificationTemplate).where(
        and_(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == current_user.tenant_id
        )
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Update template
    for field, value in template_data.dict(exclude_unset=True).items():
        setattr(template, field, value)
    
    await db.commit()
    await db.refresh(template)
    
    return template


@router.delete("/templates/{template_id}")
@require_permission("notifications.manage_templates")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a notification template."""
    query = select(NotificationTemplate).where(
        and_(
            NotificationTemplate.id == template_id,
            NotificationTemplate.tenant_id == current_user.tenant_id
        )
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    await db.delete(template)
    await db.commit()
    
    return {"message": "Template deleted"}


# Subscription endpoints
@router.post("/subscriptions", response_model=NotificationSubscriptionResponse)
async def create_subscription(
    subscription_data: NotificationSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Subscribe to notification topic."""
    # Check if already subscribed
    query = select(NotificationSubscription).where(
        and_(
            NotificationSubscription.user_id == current_user.id,
            NotificationSubscription.topic == subscription_data.topic,
            NotificationSubscription.entity_type == subscription_data.entity_type,
            NotificationSubscription.entity_id == subscription_data.entity_id
        )
    )
    
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Already subscribed")
        else:
            # Reactivate subscription
            existing.is_active = True
            existing.unsubscribed_at = None
            await db.commit()
            await db.refresh(existing)
            return existing
    
    subscription = NotificationSubscription(
        **subscription_data.dict(),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)
    
    return subscription


@router.get("/subscriptions", response_model=List[NotificationSubscriptionResponse])
async def list_subscriptions(
    is_active: Optional[bool] = None,
    topic: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List notification subscriptions."""
    query = select(NotificationSubscription).where(
        and_(
            NotificationSubscription.user_id == current_user.id,
            NotificationSubscription.tenant_id == current_user.tenant_id
        )
    )
    
    if is_active is not None:
        query = query.where(NotificationSubscription.is_active == is_active)
    if topic:
        query = query.where(NotificationSubscription.topic == topic)
    
    result = await db.execute(query)
    subscriptions = result.scalars().all()
    
    return subscriptions


@router.delete("/subscriptions/{subscription_id}")
async def unsubscribe(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unsubscribe from notification topic."""
    query = select(NotificationSubscription).where(
        and_(
            NotificationSubscription.id == subscription_id,
            NotificationSubscription.user_id == current_user.id
        )
    )
    
    result = await db.execute(query)
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    subscription.is_active = False
    subscription.unsubscribed_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Unsubscribed successfully"}


# Statistics endpoint
@router.get("/stats", response_model=NotificationStatsResponse)
async def get_notification_stats(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notification statistics for current user."""
    base_query = select(Notification).where(
        and_(
            Notification.user_id == current_user.id,
            Notification.tenant_id == current_user.tenant_id
        )
    )
    
    if from_date:
        base_query = base_query.where(Notification.created_at >= from_date)
    if to_date:
        base_query = base_query.where(Notification.created_at <= to_date)
    
    result = await db.execute(base_query)
    notifications = result.scalars().all()
    
    # Calculate stats
    stats = {
        "total_sent": len([n for n in notifications if n.status == NotificationStatus.SENT]),
        "total_delivered": len([n for n in notifications if n.status == NotificationStatus.DELIVERED]),
        "total_failed": len([n for n in notifications if n.status == NotificationStatus.FAILED]),
        "total_read": len([n for n in notifications if n.is_read]),
        "by_channel": {},
        "by_type": {},
        "by_priority": {}
    }
    
    # Count by channel
    for channel in NotificationChannel:
        count = len([n for n in notifications if n.channel == channel])
        if count > 0:
            stats["by_channel"][channel.value] = count
    
    # Count by type
    for notification in notifications:
        type_str = notification.type.value
        stats["by_type"][type_str] = stats["by_type"].get(type_str, 0) + 1
    
    # Count by priority
    for notification in notifications:
        priority_str = notification.priority.value
        stats["by_priority"][priority_str] = stats["by_priority"].get(priority_str, 0) + 1
    
    # Calculate average read time
    read_times = []
    for notification in notifications:
        if notification.is_read and notification.read_at and notification.created_at:
            delta = (notification.read_at - notification.created_at).total_seconds()
            read_times.append(delta)
    
    if read_times:
        stats["average_read_time_seconds"] = sum(read_times) / len(read_times)
    else:
        stats["average_read_time_seconds"] = None
    
    return NotificationStatsResponse(**stats)


# WebSocket endpoint
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """WebSocket endpoint for real-time notifications."""
    # Accept connection
    await websocket.accept()
    
    try:
        # Authenticate user
        auth_message = await websocket.receive_json()
        token = auth_message.get("token")
        
        if not token:
            await websocket.close(code=1008, reason="Authentication required")
            return
        
        # Validate token and get user
        # This would normally validate JWT token
        user_id = 1  # Placeholder - extract from token
        tenant_id = 1  # Placeholder - extract from token
        
        # Connect to manager
        await websocket_manager.connect(user_id, websocket, tenant_id)
        
        # Send confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to notification service"
        })
        
        # Keep connection alive
        while True:
            data = await websocket.receive_json()
            
            # Handle ping/pong
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        await websocket_manager.disconnect(user_id, websocket, tenant_id)
    except Exception as e:
        await websocket_manager.disconnect(user_id, websocket, tenant_id)
        await websocket.close(code=1011, reason=str(e))