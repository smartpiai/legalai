"""
Notification service for the Legal AI Platform.
Handles notification delivery, templates, preferences, and real-time updates.
"""
import logging
import smtplib
import asyncio
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta, time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import pytz
from jinja2 import Template, Environment, TemplateSyntaxError
from sqlalchemy import select, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import WebSocket
import json

from app.models.notification import (
    Notification,
    NotificationTemplate,
    NotificationPreference,
    NotificationLog,
    NotificationSubscription,
    NotificationBatch,
    NotificationChannel as ModelChannel,
    NotificationStatus as ModelStatus,
    NotificationType as ModelType,
    NotificationPriority as ModelPriority
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    BulkNotificationCreate,
    NotificationTemplateCreate,
    NotificationPreferenceUpdate
)
from app.core.exceptions import EntityNotFoundError

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing notifications."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize notification service."""
        self.db = db_session
        self.email_provider = EmailProvider()
        self.sms_provider = SMSProvider()
        self.template_engine = NotificationTemplateEngine()
        self.websocket_manager = WebSocketManager()
    
    async def send_notification(
        self,
        notification_data: NotificationCreate,
        tenant_id: int,
        retry_on_failure: bool = False,
        max_retries: int = 3
    ) -> Notification:
        """Send a notification to a user."""
        # Get user preferences
        preferences = await self._get_user_preferences(
            notification_data.user_id,
            tenant_id
        )
        
        # Determine channel based on preferences
        channel = await self._determine_channel(
            notification_data.channel,
            preferences,
            notification_data.type
        )
        
        # Check quiet hours
        if await self._should_respect_quiet_hours(
            preferences,
            notification_data.priority
        ):
            scheduled_time = await self._calculate_next_send_time(preferences)
            notification_data.scheduled_for = scheduled_time
            status = ModelStatus.SCHEDULED
        else:
            status = ModelStatus.PENDING
        
        # Create notification record
        notification = Notification(
            tenant_id=tenant_id,
            user_id=notification_data.user_id,
            type=ModelType(notification_data.type),
            title=notification_data.title,
            message=notification_data.message,
            priority=ModelPriority(notification_data.priority),
            channel=ModelChannel(channel),
            status=status,
            scheduled_for=notification_data.scheduled_for,
            metadata=notification_data.metadata,
            action_url=notification_data.action_url,
            expires_at=notification_data.expires_at
        )
        
        self.db.add(notification)
        await self.db.flush()
        
        # Send immediately if not scheduled
        if status == ModelStatus.PENDING:
            success = await self._send_notification(
                notification,
                retry_on_failure,
                max_retries
            )
            
            if success:
                notification.status = ModelStatus.SENT
                notification.sent_at = datetime.utcnow()
            else:
                notification.status = ModelStatus.FAILED
        
        await self.db.commit()
        await self.db.refresh(notification)
        
        return notification
    
    async def send_templated_notification(
        self,
        template_code: str,
        user_id: int,
        tenant_id: int,
        variables: Dict[str, Any],
        override_channel: Optional[str] = None
    ) -> Notification:
        """Send notification using a template."""
        # Get template
        query = select(NotificationTemplate).where(
            and_(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.code == template_code,
                NotificationTemplate.is_active == True
            )
        )
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise EntityNotFoundError("NotificationTemplate", template_code)
        
        # Render template
        subject = self.template_engine.render(
            template.subject_template or "",
            variables
        )
        body = self.template_engine.render(
            template.body_template,
            variables
        )
        
        # Determine channel
        if override_channel:
            channel = override_channel
        else:
            channel = template.channels[0] if template.channels else "in_app"
        
        # Create notification
        notification_data = NotificationCreate(
            user_id=user_id,
            type="contract_update",  # Default type
            title=subject or template.name,
            message=body,
            priority=template.default_priority,
            channel=channel,
            metadata=variables
        )
        
        return await self.send_notification(notification_data, tenant_id)
    
    async def send_bulk_notification(
        self,
        bulk_data: BulkNotificationCreate,
        tenant_id: int
    ) -> List[Notification]:
        """Send notifications to multiple users."""
        notifications = []
        
        # Create batch record
        batch = NotificationBatch(
            tenant_id=tenant_id,
            batch_id=f"batch_{datetime.utcnow().timestamp()}",
            type=ModelType(bulk_data.type),
            total_recipients=len(bulk_data.user_ids),
            metadata=bulk_data.metadata
        )
        self.db.add(batch)
        await self.db.flush()
        
        # Send to each user
        for user_id in bulk_data.user_ids:
            for channel in bulk_data.channels:
                notification_data = NotificationCreate(
                    user_id=user_id,
                    type=bulk_data.type,
                    title=bulk_data.title,
                    message=bulk_data.message,
                    priority=bulk_data.priority,
                    channel=channel,
                    metadata=bulk_data.metadata,
                    scheduled_for=bulk_data.scheduled_for
                )
                
                notification = await self.send_notification(
                    notification_data,
                    tenant_id
                )
                notifications.append(notification)
                
                # Update batch counts
                if notification.status == ModelStatus.SENT:
                    batch.sent_count += 1
                elif notification.status == ModelStatus.FAILED:
                    batch.failed_count += 1
                else:
                    batch.pending_count += 1
        
        batch.completed_at = datetime.utcnow()
        await self.db.commit()
        
        return notifications
    
    async def mark_as_read(
        self,
        notification_id: int,
        user_id: int
    ) -> Notification:
        """Mark a notification as read."""
        query = select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        result = await self.db.execute(query)
        notification = result.scalar_one_or_none()
        
        if not notification:
            raise EntityNotFoundError("Notification", notification_id)
        
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        notification.status = ModelStatus.READ
        
        await self.db.commit()
        await self.db.refresh(notification)
        
        return notification
    
    async def get_unread_count(
        self,
        user_id: int,
        tenant_id: int
    ) -> int:
        """Get count of unread notifications for a user."""
        query = select(Notification).where(
            and_(
                Notification.tenant_id == tenant_id,
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        return len(notifications)
    
    async def _get_user_preferences(
        self,
        user_id: int,
        tenant_id: int
    ) -> Optional[NotificationPreference]:
        """Get user's notification preferences."""
        query = select(NotificationPreference).where(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.tenant_id == tenant_id
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def _determine_channel(
        self,
        requested_channel: str,
        preferences: Optional[NotificationPreference],
        notification_type: str
    ) -> str:
        """Determine the best channel based on preferences."""
        if not preferences:
            return requested_channel
        
        # Check if requested channel is enabled
        channel_map = {
            "email": preferences.email_enabled,
            "sms": preferences.sms_enabled,
            "in_app": preferences.in_app_enabled,
            "push": preferences.push_enabled
        }
        
        if channel_map.get(requested_channel, False):
            return requested_channel
        
        # Find alternative channel
        for channel, enabled in channel_map.items():
            if enabled:
                return channel
        
        # Default to in-app
        return "in_app"
    
    async def _should_respect_quiet_hours(
        self,
        preferences: Optional[NotificationPreference],
        priority: str
    ) -> bool:
        """Check if notification should respect quiet hours."""
        # High priority notifications bypass quiet hours
        if priority in ["high", "urgent"]:
            return False
        
        if not preferences or not preferences.quiet_hours_enabled:
            return False
        
        if not preferences.quiet_hours_start or not preferences.quiet_hours_end:
            return False
        
        # Check current time in user's timezone
        tz = pytz.timezone(preferences.timezone or "UTC")
        now = datetime.now(tz)
        current_time = now.time()
        
        start_time = time.fromisoformat(preferences.quiet_hours_start)
        end_time = time.fromisoformat(preferences.quiet_hours_end)
        
        # Handle overnight quiet hours
        if start_time > end_time:
            return current_time >= start_time or current_time < end_time
        else:
            return start_time <= current_time < end_time
    
    async def _calculate_next_send_time(
        self,
        preferences: NotificationPreference
    ) -> datetime:
        """Calculate next available send time after quiet hours."""
        tz = pytz.timezone(preferences.timezone or "UTC")
        now = datetime.now(tz)
        
        end_time = time.fromisoformat(preferences.quiet_hours_end)
        
        # Calculate next day at end time
        next_send = now.replace(
            hour=end_time.hour,
            minute=end_time.minute,
            second=0,
            microsecond=0
        )
        
        # If end time has passed today, use tomorrow
        if next_send <= now:
            next_send += timedelta(days=1)
        
        return next_send.astimezone(pytz.UTC).replace(tzinfo=None)
    
    async def _send_notification(
        self,
        notification: Notification,
        retry_on_failure: bool,
        max_retries: int
    ) -> bool:
        """Send notification through appropriate channel."""
        success = False
        
        try:
            if notification.channel == ModelChannel.EMAIL:
                success = await self.send_email(
                    to="user@example.com",  # Get from user record
                    subject=notification.title,
                    body=notification.message
                )
            elif notification.channel == ModelChannel.SMS:
                success = await self.send_sms(
                    to="+1234567890",  # Get from user record
                    message=notification.message
                )
            elif notification.channel == ModelChannel.IN_APP:
                # Send via WebSocket if connected
                await self.websocket_manager.send_to_user(
                    notification.user_id,
                    {
                        "notification_id": notification.id,
                        "title": notification.title,
                        "message": notification.message,
                        "priority": notification.priority.value,
                        "action_url": notification.action_url
                    }
                )
                success = True
            
            if not success and retry_on_failure and notification.retry_count < max_retries:
                notification.retry_count += 1
                notification.last_retry_at = datetime.utcnow()
                
                # Retry with exponential backoff
                await asyncio.sleep(2 ** notification.retry_count)
                success = await self._send_notification(
                    notification,
                    retry_on_failure,
                    max_retries
                )
            
        except Exception as e:
            logger.error(f"Failed to send notification {notification.id}: {e}")
            notification.error_message = str(e)
            
            if retry_on_failure and notification.retry_count < max_retries:
                notification.retry_count += 1
                notification.last_retry_at = datetime.utcnow()
                
                # Retry
                await asyncio.sleep(2 ** notification.retry_count)
                success = await self._send_notification(
                    notification,
                    retry_on_failure,
                    max_retries
                )
        
        return success
    
    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send email notification."""
        return await self.email_provider.send(
            to=to,
            subject=subject,
            body=body,
            html_body=html_body,
            attachments=attachments
        )
    
    async def send_sms(self, to: str, message: str) -> bool:
        """Send SMS notification."""
        return await self.sms_provider.send(to=to, message=message)


class EmailProvider:
    """Email notification provider."""
    
    def __init__(
        self,
        smtp_host: str = "localhost",
        smtp_port: int = 587,
        smtp_user: str = "",
        smtp_password: str = ""
    ):
        """Initialize email provider."""
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
    
    async def send(
        self,
        to: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """Send email."""
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_user or "noreply@legalai.com"
            msg['To'] = to
            
            # Add text part
            text_part = MIMEText(body, 'plain')
            msg.attach(text_part)
            
            # Add HTML part if provided
            if html_body:
                html_part = MIMEText(html_body, 'html')
                msg.attach(html_part)
            
            # Add attachments
            if attachments:
                for attachment in attachments:
                    part = MIMEApplication(
                        attachment['content'],
                        Name=attachment['filename']
                    )
                    part['Content-Disposition'] = f'attachment; filename="{attachment["filename"]}"'
                    msg.attach(part)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_user and self.smtp_password:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False


class SMSProvider:
    """SMS notification provider."""
    
    async def send(self, to: str, message: str) -> bool:
        """Send SMS."""
        # Placeholder for SMS implementation (Twilio, AWS SNS, etc.)
        logger.info(f"SMS to {to}: {message}")
        return True


class WebSocketManager:
    """Manage WebSocket connections for real-time notifications."""
    
    def __init__(self):
        """Initialize WebSocket manager."""
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self.tenant_connections: Dict[int, Set[WebSocket]] = {}
    
    async def connect(
        self,
        user_id: int,
        websocket: WebSocket,
        tenant_id: Optional[int] = None
    ):
        """Connect a WebSocket."""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        
        if tenant_id:
            if tenant_id not in self.tenant_connections:
                self.tenant_connections[tenant_id] = set()
            self.tenant_connections[tenant_id].add(websocket)
    
    async def disconnect(
        self,
        user_id: int,
        websocket: WebSocket,
        tenant_id: Optional[int] = None
    ):
        """Disconnect a WebSocket."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        if tenant_id and tenant_id in self.tenant_connections:
            self.tenant_connections[tenant_id].discard(websocket)
            if not self.tenant_connections[tenant_id]:
                del self.tenant_connections[tenant_id]
    
    async def send_to_user(self, user_id: int, data: Dict[str, Any]):
        """Send notification to specific user."""
        if user_id in self.active_connections:
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(data)
                except Exception as e:
                    logger.error(f"Failed to send WebSocket message: {e}")
    
    async def broadcast_to_tenant(self, tenant_id: int, data: Dict[str, Any]):
        """Broadcast to all users in tenant."""
        if tenant_id in self.tenant_connections:
            for websocket in self.tenant_connections[tenant_id]:
                try:
                    await websocket.send_json(data)
                except Exception as e:
                    logger.error(f"Failed to broadcast WebSocket message: {e}")


class NotificationScheduler:
    """Handle scheduled notifications."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize scheduler."""
        self.db = db_session
        self.service = NotificationService(db_session)
    
    async def schedule(
        self,
        notification_data: NotificationCreate,
        scheduled_for: datetime,
        tenant_id: int
    ) -> Notification:
        """Schedule a notification."""
        notification_data.scheduled_for = scheduled_for
        
        notification = Notification(
            tenant_id=tenant_id,
            user_id=notification_data.user_id,
            type=ModelType(notification_data.type),
            title=notification_data.title,
            message=notification_data.message,
            priority=ModelPriority(notification_data.priority),
            channel=ModelChannel(notification_data.channel or "in_app"),
            status=ModelStatus.SCHEDULED,
            scheduled_for=scheduled_for,
            metadata=notification_data.metadata
        )
        
        self.db.add(notification)
        await self.db.commit()
        
        return notification
    
    async def process_scheduled(self) -> int:
        """Process scheduled notifications."""
        # Get due notifications
        query = select(Notification).where(
            and_(
                Notification.status == ModelStatus.SCHEDULED,
                Notification.scheduled_for <= datetime.utcnow()
            )
        )
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        processed = 0
        for notification in notifications:
            if await self.send_notification(notification):
                notification.status = ModelStatus.SENT
                notification.sent_at = datetime.utcnow()
                processed += 1
        
        await self.db.commit()
        return processed
    
    async def schedule_recurring(
        self,
        notification_data: NotificationCreate,
        recurrence_pattern: str,
        start_date: datetime,
        tenant_id: int
    ) -> Notification:
        """Schedule recurring notification."""
        notification = await self.schedule(
            notification_data,
            start_date,
            tenant_id
        )
        
        notification.is_recurring = True
        notification.recurrence_pattern = recurrence_pattern
        
        # Calculate next occurrence
        if recurrence_pattern == "daily":
            notification.next_occurrence = start_date + timedelta(days=1)
        elif recurrence_pattern == "weekly":
            notification.next_occurrence = start_date + timedelta(weeks=1)
        elif recurrence_pattern == "monthly":
            notification.next_occurrence = start_date + timedelta(days=30)
        
        await self.db.commit()
        return notification
    
    async def send_notification(self, notification: Notification) -> bool:
        """Send a scheduled notification."""
        # Placeholder - would integrate with main service
        return True


class NotificationTemplateEngine:
    """Template rendering engine for notifications."""
    
    def __init__(self):
        """Initialize template engine."""
        self.env = Environment(autoescape=True)
    
    def render(self, template_str: str, variables: Dict[str, Any]) -> str:
        """Render template with variables."""
        try:
            template = self.env.from_string(template_str)
            return template.render(**variables)
        except Exception as e:
            logger.error(f"Template rendering error: {e}")
            return template_str
    
    def validate(self, template_str: str) -> bool:
        """Validate template syntax."""
        try:
            self.env.from_string(template_str)
            return True
        except TemplateSyntaxError:
            return False