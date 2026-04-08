"""
Tests for notification system.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
from unittest.mock import AsyncMock, Mock, patch

from app.models.notification import (
    Notification,
    NotificationTemplate,
    NotificationPreference,
    NotificationChannel,
    NotificationStatus,
    NotificationType,
    NotificationPriority
)
from app.services.notification import (
    NotificationService,
    EmailProvider,
    SMSProvider,
    WebSocketManager,
    NotificationScheduler,
    NotificationTemplateEngine
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    NotificationTemplateCreate,
    NotificationPreferenceUpdate,
    BulkNotificationCreate
)


class TestNotificationModel:
    """Test notification database models."""
    
    @pytest.mark.asyncio
    async def test_create_notification(self, test_db_session):
        """Test creating a new notification."""
        notification = Notification(
            tenant_id=1,
            user_id=1,
            type=NotificationType.CONTRACT_APPROVAL,
            title="Contract Approval Required",
            message="Contract #123 requires your approval",
            priority=NotificationPriority.HIGH,
            channel=NotificationChannel.IN_APP,
            metadata={
                "contract_id": 123,
                "contract_name": "Service Agreement",
                "action_url": "/contracts/123/approve"
            }
        )
        
        test_db_session.add(notification)
        await test_db_session.commit()
        
        assert notification.id is not None
        assert notification.status == NotificationStatus.PENDING
        assert notification.is_read is False
        assert notification.created_at is not None
    
    @pytest.mark.asyncio
    async def test_notification_template(self, test_db_session):
        """Test notification template creation."""
        template = NotificationTemplate(
            tenant_id=1,
            code="CONTRACT_APPROVED",
            name="Contract Approved",
            subject_template="Contract {{contract_name}} has been approved",
            body_template="Your contract {{contract_name}} was approved by {{approver_name}} on {{approval_date}}.",
            channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP],
            default_priority=NotificationPriority.MEDIUM,
            variables={
                "contract_name": {"type": "string", "required": True},
                "approver_name": {"type": "string", "required": True},
                "approval_date": {"type": "date", "required": True}
            }
        )
        
        test_db_session.add(template)
        await test_db_session.commit()
        
        assert template.id is not None
        assert template.code == "CONTRACT_APPROVED"
        assert NotificationChannel.EMAIL in template.channels
        assert "contract_name" in template.variables
    
    @pytest.mark.asyncio
    async def test_notification_preferences(self, test_db_session):
        """Test user notification preferences."""
        preference = NotificationPreference(
            user_id=1,
            tenant_id=1,
            email_enabled=True,
            sms_enabled=False,
            in_app_enabled=True,
            push_enabled=False,
            quiet_hours_start="22:00",
            quiet_hours_end="08:00",
            timezone="America/New_York",
            notification_types={
                NotificationType.CONTRACT_APPROVAL: {
                    "email": True,
                    "in_app": True,
                    "priority_override": NotificationPriority.HIGH
                },
                NotificationType.DEADLINE_REMINDER: {
                    "email": True,
                    "in_app": False
                }
            }
        )
        
        test_db_session.add(preference)
        await test_db_session.commit()
        
        assert preference.id is not None
        assert preference.email_enabled is True
        assert preference.quiet_hours_start == "22:00"
        assert NotificationType.CONTRACT_APPROVAL in preference.notification_types


class TestNotificationService:
    """Test notification service operations."""
    
    @pytest.mark.asyncio
    async def test_send_notification(self, test_db_session):
        """Test sending a single notification."""
        service = NotificationService(test_db_session)
        
        notification_data = NotificationCreate(
            user_id=1,
            type=NotificationType.CONTRACT_SIGNED,
            title="Contract Signed",
            message="Contract #456 has been signed by all parties",
            priority=NotificationPriority.MEDIUM,
            channel=NotificationChannel.EMAIL,
            metadata={"contract_id": 456}
        )
        
        with patch.object(service, 'send_email', new_callable=AsyncMock) as mock_email:
            mock_email.return_value = True
            
            notification = await service.send_notification(
                notification_data,
                tenant_id=1
            )
            
            assert notification.id is not None
            assert notification.status == NotificationStatus.SENT
            assert notification.sent_at is not None
            mock_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_send_templated_notification(self, test_db_session):
        """Test sending notification using template."""
        service = NotificationService(test_db_session)
        
        # Create template first
        template = NotificationTemplate(
            tenant_id=1,
            code="DEADLINE_REMINDER",
            subject_template="Deadline approaching for {{contract_name}}",
            body_template="Contract {{contract_name}} deadline is {{days_remaining}} days away.",
            channels=[NotificationChannel.EMAIL, NotificationChannel.IN_APP]
        )
        test_db_session.add(template)
        await test_db_session.commit()
        
        # Send templated notification
        notification = await service.send_templated_notification(
            template_code="DEADLINE_REMINDER",
            user_id=1,
            tenant_id=1,
            variables={
                "contract_name": "Service Agreement 2024",
                "days_remaining": 3
            }
        )
        
        assert notification is not None
        assert "Service Agreement 2024" in notification.message
        assert "3 days" in notification.message
    
    @pytest.mark.asyncio
    async def test_bulk_notifications(self, test_db_session):
        """Test sending bulk notifications."""
        service = NotificationService(test_db_session)
        
        bulk_data = BulkNotificationCreate(
            user_ids=[1, 2, 3],
            type=NotificationType.SYSTEM_ANNOUNCEMENT,
            title="System Maintenance",
            message="System will be under maintenance from 2 AM to 4 AM EST",
            priority=NotificationPriority.LOW,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        )
        
        notifications = await service.send_bulk_notification(
            bulk_data,
            tenant_id=1
        )
        
        assert len(notifications) == 3
        assert all(n.type == NotificationType.SYSTEM_ANNOUNCEMENT for n in notifications)
        assert all(n.tenant_id == 1 for n in notifications)
    
    @pytest.mark.asyncio
    async def test_respect_user_preferences(self, test_db_session):
        """Test that notifications respect user preferences."""
        service = NotificationService(test_db_session)
        
        # Create user preference - disable email
        preference = NotificationPreference(
            user_id=1,
            tenant_id=1,
            email_enabled=False,
            in_app_enabled=True
        )
        test_db_session.add(preference)
        await test_db_session.commit()
        
        notification_data = NotificationCreate(
            user_id=1,
            type=NotificationType.CONTRACT_APPROVAL,
            title="Test",
            message="Test message",
            channel=NotificationChannel.EMAIL
        )
        
        # Should switch to in-app since email is disabled
        notification = await service.send_notification(
            notification_data,
            tenant_id=1
        )
        
        assert notification.channel == NotificationChannel.IN_APP
    
    @pytest.mark.asyncio
    async def test_quiet_hours_scheduling(self, test_db_session):
        """Test that notifications respect quiet hours."""
        service = NotificationService(test_db_session)
        
        # Create preference with quiet hours
        preference = NotificationPreference(
            user_id=1,
            tenant_id=1,
            quiet_hours_start="22:00",
            quiet_hours_end="08:00",
            timezone="UTC"
        )
        test_db_session.add(preference)
        await test_db_session.commit()
        
        # Try to send notification during quiet hours
        with patch('app.services.notification.datetime') as mock_datetime:
            mock_datetime.now.return_value = datetime(2024, 1, 1, 23, 0)  # 11 PM
            
            notification = await service.send_notification(
                NotificationCreate(
                    user_id=1,
                    type=NotificationType.CONTRACT_UPDATE,
                    title="Update",
                    message="Contract updated",
                    priority=NotificationPriority.LOW
                ),
                tenant_id=1
            )
            
            # Should be scheduled for later
            assert notification.status == NotificationStatus.SCHEDULED
            assert notification.scheduled_for is not None
            assert notification.scheduled_for.hour == 8  # 8 AM next day
    
    @pytest.mark.asyncio
    async def test_high_priority_override_quiet_hours(self, test_db_session):
        """Test that high priority notifications override quiet hours."""
        service = NotificationService(test_db_session)
        
        preference = NotificationPreference(
            user_id=1,
            tenant_id=1,
            quiet_hours_start="22:00",
            quiet_hours_end="08:00"
        )
        test_db_session.add(preference)
        await test_db_session.commit()
        
        with patch('app.services.notification.datetime') as mock_datetime:
            mock_datetime.now.return_value = datetime(2024, 1, 1, 23, 0)
            
            notification = await service.send_notification(
                NotificationCreate(
                    user_id=1,
                    type=NotificationType.URGENT_ACTION,
                    title="Urgent",
                    message="Immediate action required",
                    priority=NotificationPriority.URGENT
                ),
                tenant_id=1
            )
            
            # Should send immediately despite quiet hours
            assert notification.status == NotificationStatus.SENT
            assert notification.scheduled_for is None
    
    @pytest.mark.asyncio
    async def test_mark_notification_read(self, test_db_session):
        """Test marking notifications as read."""
        service = NotificationService(test_db_session)
        
        # Create notification
        notification = Notification(
            tenant_id=1,
            user_id=1,
            type=NotificationType.CONTRACT_APPROVAL,
            title="Test",
            message="Test message",
            is_read=False
        )
        test_db_session.add(notification)
        await test_db_session.commit()
        
        # Mark as read
        updated = await service.mark_as_read(notification.id, user_id=1)
        
        assert updated.is_read is True
        assert updated.read_at is not None
    
    @pytest.mark.asyncio
    async def test_get_unread_count(self, test_db_session):
        """Test getting unread notification count."""
        service = NotificationService(test_db_session)
        
        # Create notifications
        for i in range(5):
            notification = Notification(
                tenant_id=1,
                user_id=1,
                type=NotificationType.CONTRACT_UPDATE,
                title=f"Update {i}",
                message=f"Message {i}",
                is_read=(i < 2)  # First 2 are read
            )
            test_db_session.add(notification)
        
        await test_db_session.commit()
        
        count = await service.get_unread_count(user_id=1, tenant_id=1)
        assert count == 3
    
    @pytest.mark.asyncio
    async def test_notification_retry_on_failure(self, test_db_session):
        """Test notification retry mechanism on failure."""
        service = NotificationService(test_db_session)
        
        with patch.object(service, 'send_email', new_callable=AsyncMock) as mock_email:
            # First attempt fails, second succeeds
            mock_email.side_effect = [Exception("SMTP error"), True]
            
            notification = await service.send_notification(
                NotificationCreate(
                    user_id=1,
                    type=NotificationType.CONTRACT_APPROVAL,
                    title="Test",
                    message="Test",
                    channel=NotificationChannel.EMAIL
                ),
                tenant_id=1,
                retry_on_failure=True,
                max_retries=3
            )
            
            assert notification.retry_count == 1
            assert notification.status == NotificationStatus.SENT
            assert mock_email.call_count == 2


class TestEmailProvider:
    """Test email notification provider."""
    
    @pytest.mark.asyncio
    async def test_send_email(self):
        """Test sending email notification."""
        provider = EmailProvider(
            smtp_host="smtp.test.com",
            smtp_port=587,
            smtp_user="test@test.com",
            smtp_password="password"
        )
        
        with patch('smtplib.SMTP') as mock_smtp:
            mock_server = Mock()
            mock_smtp.return_value.__enter__.return_value = mock_server
            
            result = await provider.send(
                to="user@example.com",
                subject="Test Subject",
                body="Test Body",
                html_body="<p>Test Body</p>"
            )
            
            assert result is True
            mock_server.send_message.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_email_with_attachments(self):
        """Test sending email with attachments."""
        provider = EmailProvider()
        
        with patch('smtplib.SMTP') as mock_smtp:
            mock_server = Mock()
            mock_smtp.return_value.__enter__.return_value = mock_server
            
            result = await provider.send(
                to="user@example.com",
                subject="Contract Document",
                body="Please find attached contract",
                attachments=[
                    {
                        "filename": "contract.pdf",
                        "content": b"PDF content",
                        "content_type": "application/pdf"
                    }
                ]
            )
            
            assert result is True
            # Verify attachment was added to message
            call_args = mock_server.send_message.call_args
            message = call_args[0][0]
            assert message.is_multipart()


class TestWebSocketManager:
    """Test WebSocket real-time notifications."""
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test WebSocket connection management."""
        manager = WebSocketManager()
        
        mock_websocket = Mock()
        user_id = 1
        
        # Connect
        await manager.connect(user_id, mock_websocket)
        assert user_id in manager.active_connections
        assert mock_websocket in manager.active_connections[user_id]
        
        # Disconnect
        await manager.disconnect(user_id, mock_websocket)
        assert mock_websocket not in manager.active_connections.get(user_id, [])
    
    @pytest.mark.asyncio
    async def test_broadcast_to_user(self):
        """Test broadcasting notification to specific user."""
        manager = WebSocketManager()
        
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        
        await manager.connect(1, mock_ws1)
        await manager.connect(1, mock_ws2)  # Same user, different device
        
        notification_data = {
            "type": "CONTRACT_APPROVED",
            "title": "Contract Approved",
            "message": "Your contract has been approved"
        }
        
        await manager.send_to_user(1, notification_data)
        
        # Both connections should receive the message
        mock_ws1.send_json.assert_called_once_with(notification_data)
        mock_ws2.send_json.assert_called_once_with(notification_data)
    
    @pytest.mark.asyncio
    async def test_broadcast_to_tenant(self):
        """Test broadcasting to all users in tenant."""
        manager = WebSocketManager()
        
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        mock_ws3 = AsyncMock()
        
        await manager.connect(1, mock_ws1, tenant_id=1)
        await manager.connect(2, mock_ws2, tenant_id=1)
        await manager.connect(3, mock_ws3, tenant_id=2)  # Different tenant
        
        announcement = {
            "type": "SYSTEM_ANNOUNCEMENT",
            "message": "System maintenance scheduled"
        }
        
        await manager.broadcast_to_tenant(1, announcement)
        
        # Only tenant 1 users should receive
        mock_ws1.send_json.assert_called_once()
        mock_ws2.send_json.assert_called_once()
        mock_ws3.send_json.assert_not_called()


class TestNotificationScheduler:
    """Test notification scheduling functionality."""
    
    @pytest.mark.asyncio
    async def test_schedule_notification(self, test_db_session):
        """Test scheduling a notification for future delivery."""
        scheduler = NotificationScheduler(test_db_session)
        
        scheduled_time = datetime.utcnow() + timedelta(hours=2)
        
        notification = await scheduler.schedule(
            notification_data=NotificationCreate(
                user_id=1,
                type=NotificationType.DEADLINE_REMINDER,
                title="Deadline Reminder",
                message="Contract deadline in 24 hours"
            ),
            scheduled_for=scheduled_time,
            tenant_id=1
        )
        
        assert notification.status == NotificationStatus.SCHEDULED
        assert notification.scheduled_for == scheduled_time
        assert notification.sent_at is None
    
    @pytest.mark.asyncio
    async def test_process_scheduled_notifications(self, test_db_session):
        """Test processing of scheduled notifications."""
        scheduler = NotificationScheduler(test_db_session)
        
        # Create past scheduled notification
        past_time = datetime.utcnow() - timedelta(minutes=5)
        notification = Notification(
            tenant_id=1,
            user_id=1,
            type=NotificationType.CONTRACT_UPDATE,
            title="Update",
            message="Scheduled update",
            status=NotificationStatus.SCHEDULED,
            scheduled_for=past_time
        )
        test_db_session.add(notification)
        await test_db_session.commit()
        
        # Process scheduled notifications
        with patch.object(scheduler, 'send_notification', new_callable=AsyncMock) as mock_send:
            mock_send.return_value = True
            
            processed = await scheduler.process_scheduled()
            
            assert processed == 1
            mock_send.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_recurring_notifications(self, test_db_session):
        """Test recurring notification scheduling."""
        scheduler = NotificationScheduler(test_db_session)
        
        # Schedule weekly reminder
        notification = await scheduler.schedule_recurring(
            notification_data=NotificationCreate(
                user_id=1,
                type=NotificationType.WEEKLY_SUMMARY,
                title="Weekly Summary",
                message="Your weekly contract summary"
            ),
            recurrence_pattern="weekly",
            start_date=datetime.utcnow(),
            tenant_id=1
        )
        
        assert notification.is_recurring is True
        assert notification.recurrence_pattern == "weekly"
        assert notification.next_occurrence is not None


class TestNotificationTemplateEngine:
    """Test notification template rendering."""
    
    def test_render_simple_template(self):
        """Test rendering simple template with variables."""
        engine = NotificationTemplateEngine()
        
        template = "Hello {{user_name}}, your contract {{contract_name}} is ready."
        variables = {
            "user_name": "John Doe",
            "contract_name": "Service Agreement 2024"
        }
        
        result = engine.render(template, variables)
        
        assert result == "Hello John Doe, your contract Service Agreement 2024 is ready."
    
    def test_render_with_conditionals(self):
        """Test template rendering with conditional logic."""
        engine = NotificationTemplateEngine()
        
        template = """
        Contract {{contract_name}} status update:
        {% if approved %}
        ✅ Approved by {{approver}}
        {% else %}
        ⏳ Pending approval
        {% endif %}
        """
        
        variables = {
            "contract_name": "NDA-2024-001",
            "approved": True,
            "approver": "Jane Smith"
        }
        
        result = engine.render(template, variables)
        
        assert "✅ Approved by Jane Smith" in result
        assert "Pending approval" not in result
    
    def test_render_with_loops(self):
        """Test template rendering with loops."""
        engine = NotificationTemplateEngine()
        
        template = """
        Contracts requiring action:
        {% for contract in contracts %}
        - {{contract.name}} (Due: {{contract.due_date}})
        {% endfor %}
        """
        
        variables = {
            "contracts": [
                {"name": "Contract A", "due_date": "2024-01-15"},
                {"name": "Contract B", "due_date": "2024-01-20"}
            ]
        }
        
        result = engine.render(template, variables)
        
        assert "Contract A (Due: 2024-01-15)" in result
        assert "Contract B (Due: 2024-01-20)" in result
    
    def test_template_validation(self):
        """Test template syntax validation."""
        engine = NotificationTemplateEngine()
        
        # Valid template
        valid = "Hello {{name}}"
        assert engine.validate(valid) is True
        
        # Invalid template - unclosed variable
        invalid = "Hello {{name"
        assert engine.validate(invalid) is False
        
        # Invalid template - unclosed conditional
        invalid_conditional = "{% if test %} Content"
        assert engine.validate(invalid_conditional) is False