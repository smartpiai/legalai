"""
Pydantic schemas for notification system.
Defines request and response models for notification operations.
"""
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator, EmailStr
from enum import Enum


class NotificationChannel(str, Enum):
    """Notification delivery channels."""
    EMAIL = "email"
    SMS = "sms"
    IN_APP = "in_app"
    PUSH = "push"
    WEBHOOK = "webhook"


class NotificationStatus(str, Enum):
    """Notification delivery status."""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"
    READ = "read"


class NotificationType(str, Enum):
    """Types of notifications."""
    # Contract related
    CONTRACT_CREATED = "contract_created"
    CONTRACT_UPDATED = "contract_updated"
    CONTRACT_APPROVAL = "contract_approval"
    CONTRACT_APPROVED = "contract_approved"
    CONTRACT_REJECTED = "contract_rejected"
    CONTRACT_SIGNED = "contract_signed"
    CONTRACT_EXPIRING = "contract_expiring"
    CONTRACT_EXPIRED = "contract_expired"
    
    # Workflow related
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_COMPLETED = "workflow_completed"
    WORKFLOW_FAILED = "workflow_failed"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_OVERDUE = "task_overdue"
    
    # Document related
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_PROCESSED = "document_processed"
    EXTRACTION_COMPLETED = "extraction_completed"
    
    # Deadline and reminders
    DEADLINE_REMINDER = "deadline_reminder"
    MILESTONE_APPROACHING = "milestone_approaching"
    RENEWAL_REMINDER = "renewal_reminder"
    
    # System notifications
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    MAINTENANCE_NOTICE = "maintenance_notice"
    SECURITY_ALERT = "security_alert"
    
    # User actions
    PASSWORD_RESET = "password_reset"
    ACCOUNT_ACTIVATED = "account_activated"
    ROLE_CHANGED = "role_changed"
    
    # Analytics and reports
    WEEKLY_SUMMARY = "weekly_summary"
    MONTHLY_REPORT = "monthly_report"
    RISK_ALERT = "risk_alert"
    
    # Urgent
    URGENT_ACTION = "urgent_action"
    ESCALATION = "escalation"


class NotificationPriority(str, Enum):
    """Notification priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationBase(BaseModel):
    """Base notification schema."""
    type: NotificationType
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    action_url: Optional[str] = Field(None, max_length=500)
    expires_at: Optional[datetime] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a notification."""
    user_id: int
    channel: Optional[NotificationChannel] = Field(default=NotificationChannel.IN_APP)
    scheduled_for: Optional[datetime] = None
    
    @validator('scheduled_for')
    def validate_scheduled_time(cls, v):
        if v and v <= datetime.utcnow():
            raise ValueError('Scheduled time must be in the future')
        return v

    class Config:
        schema_extra = {
            "example": {
                "user_id": 1,
                "type": "contract_approval",
                "title": "Contract Approval Required",
                "message": "Contract #123 requires your approval",
                "priority": "high",
                "channel": "email",
                "metadata": {"contract_id": 123}
            }
        }


class NotificationUpdate(BaseModel):
    """Schema for updating a notification."""
    status: Optional[NotificationStatus] = None
    is_read: Optional[bool] = None
    read_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None


class NotificationResponse(NotificationBase):
    """Schema for notification response."""
    id: int
    tenant_id: int
    user_id: int
    channel: NotificationChannel
    status: NotificationStatus
    scheduled_for: Optional[datetime]
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    is_read: bool
    read_at: Optional[datetime]
    retry_count: int
    error_message: Optional[str]
    is_recurring: bool
    recurrence_pattern: Optional[str]
    next_occurrence: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class BulkNotificationCreate(BaseModel):
    """Schema for creating bulk notifications."""
    user_ids: List[int] = Field(..., min_items=1)
    type: NotificationType
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    channels: List[NotificationChannel] = Field(default_factory=lambda: [NotificationChannel.IN_APP])
    metadata: Dict[str, Any] = Field(default_factory=dict)
    scheduled_for: Optional[datetime] = None

    class Config:
        schema_extra = {
            "example": {
                "user_ids": [1, 2, 3],
                "type": "system_announcement",
                "title": "System Maintenance",
                "message": "Scheduled maintenance on Sunday 2 AM - 4 AM",
                "priority": "low",
                "channels": ["email", "in_app"]
            }
        }


class NotificationTemplateBase(BaseModel):
    """Base notification template schema."""
    code: str = Field(..., min_length=1, max_length=100, regex="^[A-Z][A-Z0-9_]*$")
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    subject_template: Optional[str] = Field(None, max_length=500)
    body_template: str = Field(..., min_length=1)
    html_template: Optional[str] = None
    sms_template: Optional[str] = Field(None, max_length=500)
    channels: List[NotificationChannel] = Field(default_factory=list)
    default_priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    variables: Dict[str, Any] = Field(default_factory=dict)


class NotificationTemplateCreate(NotificationTemplateBase):
    """Schema for creating a notification template."""
    is_active: bool = Field(default=True)

    class Config:
        schema_extra = {
            "example": {
                "code": "CONTRACT_APPROVED",
                "name": "Contract Approved",
                "subject_template": "Contract {{contract_name}} Approved",
                "body_template": "Your contract {{contract_name}} has been approved by {{approver_name}}.",
                "channels": ["email", "in_app"],
                "variables": {
                    "contract_name": {"type": "string", "required": True},
                    "approver_name": {"type": "string", "required": True}
                }
            }
        }


class NotificationTemplateUpdate(BaseModel):
    """Schema for updating a notification template."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    subject_template: Optional[str] = Field(None, max_length=500)
    body_template: Optional[str] = Field(None, min_length=1)
    html_template: Optional[str] = None
    sms_template: Optional[str] = Field(None, max_length=500)
    channels: Optional[List[NotificationChannel]] = None
    default_priority: Optional[NotificationPriority] = None
    variables: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class NotificationTemplateResponse(NotificationTemplateBase):
    """Schema for notification template response."""
    id: int
    tenant_id: int
    is_active: bool
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class NotificationPreferenceBase(BaseModel):
    """Base notification preference schema."""
    email_enabled: bool = Field(default=True)
    sms_enabled: bool = Field(default=False)
    in_app_enabled: bool = Field(default=True)
    push_enabled: bool = Field(default=False)
    quiet_hours_enabled: bool = Field(default=False)
    quiet_hours_start: Optional[str] = Field(None, regex="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    quiet_hours_end: Optional[str] = Field(None, regex="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    timezone: str = Field(default="UTC", max_length=50)
    instant_notifications: bool = Field(default=True)
    daily_digest: bool = Field(default=False)
    weekly_digest: bool = Field(default=False)
    digest_time: Optional[str] = Field(None, regex="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    language: str = Field(default="en", max_length=10)


class NotificationPreferenceUpdate(NotificationPreferenceBase):
    """Schema for updating notification preferences."""
    notification_types: Optional[Dict[str, Dict[str, Any]]] = None

    class Config:
        schema_extra = {
            "example": {
                "email_enabled": True,
                "in_app_enabled": True,
                "quiet_hours_enabled": True,
                "quiet_hours_start": "22:00",
                "quiet_hours_end": "08:00",
                "timezone": "America/New_York",
                "notification_types": {
                    "contract_approval": {
                        "email": True,
                        "in_app": True,
                        "priority_override": "high"
                    }
                }
            }
        }


class NotificationPreferenceResponse(NotificationPreferenceBase):
    """Schema for notification preference response."""
    id: int
    user_id: int
    tenant_id: int
    notification_types: Dict[str, Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class NotificationSubscriptionCreate(BaseModel):
    """Schema for creating a notification subscription."""
    topic: str = Field(..., min_length=1, max_length=100)
    entity_type: Optional[str] = Field(None, max_length=50)
    entity_id: Optional[int] = None
    channels: List[NotificationChannel] = Field(default_factory=list)

    class Config:
        schema_extra = {
            "example": {
                "topic": "contract_updates",
                "entity_type": "contract",
                "entity_id": 123,
                "channels": ["email", "in_app"]
            }
        }


class NotificationSubscriptionResponse(BaseModel):
    """Schema for notification subscription response."""
    id: int
    user_id: int
    tenant_id: int
    topic: str
    entity_type: Optional[str]
    entity_id: Optional[int]
    channels: List[str]
    is_active: bool
    subscribed_at: datetime
    unsubscribed_at: Optional[datetime]

    class Config:
        orm_mode = True


class NotificationListResponse(BaseModel):
    """Schema for notification list response."""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    per_page: int

    class Config:
        schema_extra = {
            "example": {
                "notifications": [],
                "total": 50,
                "unread_count": 12,
                "page": 1,
                "per_page": 20
            }
        }


class NotificationStatsResponse(BaseModel):
    """Schema for notification statistics."""
    total_sent: int
    total_delivered: int
    total_failed: int
    total_read: int
    average_read_time_seconds: Optional[float]
    by_channel: Dict[str, int]
    by_type: Dict[str, int]
    by_priority: Dict[str, int]

    class Config:
        schema_extra = {
            "example": {
                "total_sent": 1000,
                "total_delivered": 950,
                "total_failed": 50,
                "total_read": 800,
                "average_read_time_seconds": 180.5,
                "by_channel": {
                    "email": 600,
                    "in_app": 400
                },
                "by_type": {
                    "contract_approval": 200,
                    "deadline_reminder": 150
                },
                "by_priority": {
                    "high": 100,
                    "medium": 700,
                    "low": 200
                }
            }
        }


class WebSocketMessage(BaseModel):
    """Schema for WebSocket notification message."""
    type: str = Field(default="notification")
    notification_id: Optional[int] = None
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        schema_extra = {
            "example": {
                "type": "notification",
                "notification_id": 123,
                "data": {
                    "title": "Contract Approved",
                    "message": "Your contract has been approved",
                    "priority": "high",
                    "action_url": "/contracts/123"
                },
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }