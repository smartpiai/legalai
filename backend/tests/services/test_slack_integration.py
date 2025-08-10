"""
Slack Integration Service Tests
Following TDD - RED phase: Comprehensive test suite for Slack integration service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.slack_integration import (
    SlackIntegrationService,
    SlackWorkspace,
    SlackChannel,
    SlackMessage,
    SlackNotification,
    SlackCommand,
    SlackEvent,
    SlackUser,
    SlackThread,
    NotificationType,
    EventType,
    CommandType,
    MessageAttachment,
    MessageAction,
    InteractiveComponent
)
from app.models.slack import SlackConfig, SlackInstallation, SlackEventLog
from app.core.exceptions import ValidationError, IntegrationError, AuthenticationError


class TestSlackIntegrationService:
    """Test suite for Slack integration service"""

    @pytest.fixture
    def mock_slack_client(self):
        """Mock Slack WebClient"""
        client = AsyncMock()
        client.auth_test = AsyncMock()
        client.conversations_list = AsyncMock()
        client.chat_postMessage = AsyncMock()
        client.conversations_history = AsyncMock()
        client.users_info = AsyncMock()
        return client

    @pytest.fixture
    def mock_postgres(self):
        """Mock PostgreSQL connection"""
        db = AsyncMock()
        db.query = AsyncMock()
        db.execute = AsyncMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.delete = AsyncMock()
        redis.publish = AsyncMock()
        return redis

    @pytest.fixture
    def mock_notification_service(self):
        """Mock notification service"""
        service = AsyncMock()
        service.send = AsyncMock()
        service.batch_send = AsyncMock()
        return service

    @pytest.fixture
    def slack_service(
        self,
        mock_slack_client,
        mock_postgres,
        mock_redis,
        mock_notification_service
    ):
        """Create Slack integration service instance"""
        return SlackIntegrationService(
            slack_client=mock_slack_client,
            postgres=mock_postgres,
            redis=mock_redis,
            notification_service=mock_notification_service
        )

    @pytest.fixture
    def sample_workspace(self):
        """Sample Slack workspace"""
        return SlackWorkspace(
            team_id="T1234567890",
            name="Legal Team",
            domain="legal-team",
            bot_token="xoxb-test-token",
            app_id="A1234567890"
        )

    @pytest.fixture
    def sample_channel(self):
        """Sample Slack channel"""
        return SlackChannel(
            id="C1234567890",
            name="contracts",
            is_private=False,
            is_member=True,
            topic="Contract discussions"
        )

    @pytest.fixture
    def sample_message(self):
        """Sample Slack message"""
        return SlackMessage(
            text="New contract ready for review",
            channel="C1234567890",
            attachments=[
                MessageAttachment(
                    title="Contract #123",
                    text="Service Agreement with ABC Corp",
                    color="good"
                )
            ]
        )

    # Test Workspace Management

    @pytest.mark.asyncio
    async def test_install_workspace(self, slack_service):
        """Test installing Slack workspace"""
        result = await slack_service.install_workspace(
            code="oauth-code-123",
            redirect_uri="https://legal-ai.com/slack/callback",
            tenant_id="tenant-123"
        )
        
        assert isinstance(result, SlackWorkspace)
        assert result.team_id is not None
        assert result.bot_token is not None

    @pytest.mark.asyncio
    async def test_connect_workspace(self, slack_service, sample_workspace):
        """Test connecting to Slack workspace"""
        connected = await slack_service.connect_workspace(
            workspace=sample_workspace,
            tenant_id="tenant-123"
        )
        
        assert connected.is_connected is True
        assert connected.bot_user_id is not None

    @pytest.mark.asyncio
    async def test_disconnect_workspace(self, slack_service):
        """Test disconnecting Slack workspace"""
        result = await slack_service.disconnect_workspace(
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result is True

    @pytest.mark.asyncio
    async def test_get_workspace_info(self, slack_service):
        """Test getting workspace information"""
        info = await slack_service.get_workspace_info(
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert info["team_id"] == "T1234567890"
        assert "channels_count" in info
        assert "users_count" in info

    # Test Channel Management

    @pytest.mark.asyncio
    async def test_list_channels(self, slack_service):
        """Test listing Slack channels"""
        channels = await slack_service.list_channels(
            workspace_id="T1234567890",
            include_private=False,
            tenant_id="tenant-123"
        )
        
        assert isinstance(channels, list)
        assert all(isinstance(c, SlackChannel) for c in channels)

    @pytest.mark.asyncio
    async def test_join_channel(self, slack_service):
        """Test joining a Slack channel"""
        result = await slack_service.join_channel(
            channel_id="C1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result is True

    @pytest.mark.asyncio
    async def test_leave_channel(self, slack_service):
        """Test leaving a Slack channel"""
        result = await slack_service.leave_channel(
            channel_id="C1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result is True

    @pytest.mark.asyncio
    async def test_configure_channel_notifications(self, slack_service):
        """Test configuring channel notifications"""
        config = await slack_service.configure_channel_notifications(
            channel_id="C1234567890",
            notification_types=[
                NotificationType.CONTRACT_CREATED,
                NotificationType.CONTRACT_APPROVED
            ],
            tenant_id="tenant-123"
        )
        
        assert config.channel_id == "C1234567890"
        assert len(config.notification_types) == 2

    # Test Message Operations

    @pytest.mark.asyncio
    async def test_send_message(self, slack_service, sample_message):
        """Test sending a message to Slack"""
        result = await slack_service.send_message(
            message=sample_message,
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result.message_id is not None
        assert result.timestamp is not None

    @pytest.mark.asyncio
    async def test_send_threaded_message(self, slack_service):
        """Test sending a threaded message"""
        result = await slack_service.send_threaded_message(
            text="This is a reply",
            channel="C1234567890",
            thread_ts="1234567890.123456",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result.thread_ts == "1234567890.123456"

    @pytest.mark.asyncio
    async def test_update_message(self, slack_service):
        """Test updating a Slack message"""
        updated = await slack_service.update_message(
            channel="C1234567890",
            timestamp="1234567890.123456",
            text="Updated message",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert updated is True

    @pytest.mark.asyncio
    async def test_delete_message(self, slack_service):
        """Test deleting a Slack message"""
        deleted = await slack_service.delete_message(
            channel="C1234567890",
            timestamp="1234567890.123456",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert deleted is True

    @pytest.mark.asyncio
    async def test_send_ephemeral_message(self, slack_service):
        """Test sending an ephemeral message"""
        result = await slack_service.send_ephemeral_message(
            text="Only you can see this",
            channel="C1234567890",
            user="U1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result.is_ephemeral is True

    # Test Notifications

    @pytest.mark.asyncio
    async def test_send_contract_notification(self, slack_service):
        """Test sending contract notification"""
        notification = SlackNotification(
            type=NotificationType.CONTRACT_CREATED,
            title="New Contract Created",
            message="Contract #123 has been created",
            contract_id="123",
            url="https://legal-ai.com/contracts/123"
        )
        
        result = await slack_service.send_notification(
            notification=notification,
            channel="C1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result.sent is True

    @pytest.mark.asyncio
    async def test_send_approval_request(self, slack_service):
        """Test sending approval request with actions"""
        request = await slack_service.send_approval_request(
            contract_id="123",
            contract_title="Service Agreement",
            approver_id="U1234567890",
            channel="C1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert request.has_actions is True
        assert len(request.actions) == 2  # Approve and Reject

    @pytest.mark.asyncio
    async def test_send_reminder(self, slack_service):
        """Test sending reminder notification"""
        reminder = await slack_service.send_reminder(
            title="Contract Renewal Reminder",
            message="Contract #456 expires in 30 days",
            user_id="U1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert reminder.type == NotificationType.REMINDER

    @pytest.mark.asyncio
    async def test_batch_notifications(self, slack_service):
        """Test sending batch notifications"""
        notifications = [
            SlackNotification(
                type=NotificationType.CONTRACT_CREATED,
                title=f"Contract {i}",
                message=f"Contract {i} created"
            )
            for i in range(5)
        ]
        
        results = await slack_service.send_batch_notifications(
            notifications=notifications,
            channel="C1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert len(results) == 5
        assert all(r.sent for r in results)

    # Test Slash Commands

    @pytest.mark.asyncio
    async def test_handle_slash_command(self, slack_service):
        """Test handling slash command"""
        command = SlackCommand(
            command="/contract",
            text="search payment terms",
            user_id="U1234567890",
            channel_id="C1234567890",
            team_id="T1234567890"
        )
        
        response = await slack_service.handle_command(
            command=command,
            tenant_id="tenant-123"
        )
        
        assert response.responded is True

    @pytest.mark.asyncio
    async def test_register_command(self, slack_service):
        """Test registering slash command"""
        registered = await slack_service.register_command(
            command="/legal",
            description="Legal AI assistant",
            usage_hint="[search|create|approve] <args>",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert registered.command == "/legal"

    @pytest.mark.asyncio
    async def test_command_help(self, slack_service):
        """Test getting command help"""
        help_text = await slack_service.get_command_help(
            command="/contract",
            tenant_id="tenant-123"
        )
        
        assert "Available commands" in help_text
        assert "/contract search" in help_text

    # Test Event Handling

    @pytest.mark.asyncio
    async def test_handle_message_event(self, slack_service):
        """Test handling message event"""
        event = SlackEvent(
            type=EventType.MESSAGE,
            channel="C1234567890",
            user="U1234567890",
            text="@legal-bot what's the status of contract 123?",
            timestamp="1234567890.123456"
        )
        
        handled = await slack_service.handle_event(
            event=event,
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert handled is True

    @pytest.mark.asyncio
    async def test_handle_app_mention(self, slack_service):
        """Test handling app mention event"""
        event = SlackEvent(
            type=EventType.APP_MENTION,
            channel="C1234567890",
            user="U1234567890",
            text="<@U987654321> find contracts expiring this month"
        )
        
        response = await slack_service.handle_app_mention(
            event=event,
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert response.replied is True

    @pytest.mark.asyncio
    async def test_handle_reaction_added(self, slack_service):
        """Test handling reaction added event"""
        event = SlackEvent(
            type=EventType.REACTION_ADDED,
            reaction="thumbsup",
            item_channel="C1234567890",
            item_ts="1234567890.123456"
        )
        
        handled = await slack_service.handle_reaction(
            event=event,
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert handled is True

    # Test Interactive Components

    @pytest.mark.asyncio
    async def test_handle_button_click(self, slack_service):
        """Test handling button interaction"""
        interaction = InteractiveComponent(
            type="button",
            action_id="approve_contract",
            value="contract_123",
            user="U1234567890",
            channel="C1234567890"
        )
        
        result = await slack_service.handle_interaction(
            interaction=interaction,
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result.action_completed is True

    @pytest.mark.asyncio
    async def test_handle_select_menu(self, slack_service):
        """Test handling select menu interaction"""
        interaction = InteractiveComponent(
            type="select",
            action_id="select_approver",
            selected_option="U987654321",
            user="U1234567890"
        )
        
        result = await slack_service.handle_interaction(
            interaction=interaction,
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert result.updated is True

    @pytest.mark.asyncio
    async def test_create_modal(self, slack_service):
        """Test creating and opening modal"""
        modal = await slack_service.create_modal(
            title="Create Contract",
            trigger_id="123456.789012",
            fields=[
                {"type": "text", "label": "Contract Title"},
                {"type": "select", "label": "Contract Type"},
                {"type": "date", "label": "Expiry Date"}
            ],
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert modal.opened is True
        assert modal.view_id is not None

    # Test User Management

    @pytest.mark.asyncio
    async def test_get_user_info(self, slack_service):
        """Test getting Slack user information"""
        user = await slack_service.get_user_info(
            user_id="U1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert isinstance(user, SlackUser)
        assert user.id == "U1234567890"
        assert user.email is not None

    @pytest.mark.asyncio
    async def test_sync_users(self, slack_service):
        """Test syncing Slack users with system"""
        synced = await slack_service.sync_users(
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert synced["total_users"] > 0
        assert synced["synced_users"] > 0

    @pytest.mark.asyncio
    async def test_map_slack_to_system_user(self, slack_service):
        """Test mapping Slack user to system user"""
        mapping = await slack_service.map_user(
            slack_user_id="U1234567890",
            system_user_id="user-123",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert mapping.slack_user_id == "U1234567890"
        assert mapping.system_user_id == "user-123"

    # Test Search Integration

    @pytest.mark.asyncio
    async def test_search_from_slack(self, slack_service):
        """Test searching contracts from Slack"""
        results = await slack_service.search_contracts(
            query="payment terms",
            user_id="U1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert len(results) > 0
        assert all(r.title is not None for r in results)

    @pytest.mark.asyncio
    async def test_get_contract_details(self, slack_service):
        """Test getting contract details for Slack"""
        details = await slack_service.get_contract_details(
            contract_id="123",
            user_id="U1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert details.contract_id == "123"
        assert details.formatted_for_slack is True

    # Test Analytics

    @pytest.mark.asyncio
    async def test_track_slack_usage(self, slack_service):
        """Test tracking Slack usage analytics"""
        await slack_service.track_usage(
            action="message_sent",
            user_id="U1234567890",
            channel_id="C1234567890",
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        analytics = await slack_service.get_usage_analytics(
            workspace_id="T1234567890",
            tenant_id="tenant-123"
        )
        
        assert analytics["total_messages"] > 0

    @pytest.mark.asyncio
    async def test_get_integration_stats(self, slack_service):
        """Test getting integration statistics"""
        stats = await slack_service.get_integration_stats(
            workspace_id="T1234567890",
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert "messages_sent" in stats
        assert "commands_executed" in stats
        assert "active_users" in stats

    # Test Error Handling

    @pytest.mark.asyncio
    async def test_handle_rate_limit(self, slack_service):
        """Test handling Slack rate limits"""
        with pytest.raises(IntegrationError) as exc:
            # Simulate rate limit
            await slack_service.send_message(
                message=SlackMessage(text="Test"),
                workspace_id="T1234567890",
                tenant_id="tenant-123",
                simulate_rate_limit=True
            )
        
        assert "rate limit" in str(exc.value).lower()

    @pytest.mark.asyncio
    async def test_handle_invalid_token(self, slack_service):
        """Test handling invalid Slack token"""
        with pytest.raises(AuthenticationError):
            await slack_service.connect_workspace(
                workspace=SlackWorkspace(
                    team_id="T999",
                    bot_token="invalid-token"
                ),
                tenant_id="tenant-123"
            )

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_workspace_isolation(self, slack_service):
        """Test workspace isolation between tenants"""
        # Install for tenant A
        workspace_a = await slack_service.install_workspace(
            code="code-a",
            redirect_uri="https://legal-ai.com/slack/callback",
            tenant_id="tenant-A"
        )
        
        # Try to access from tenant B
        with pytest.raises(ValidationError):
            await slack_service.send_message(
                message=SlackMessage(text="Test"),
                workspace_id=workspace_a.team_id,
                tenant_id="tenant-B"
            )

    @pytest.mark.asyncio
    async def test_tenant_notification_isolation(self, slack_service):
        """Test notification isolation between tenants"""
        # Configure notifications for tenant A
        await slack_service.configure_channel_notifications(
            channel_id="C1234567890",
            notification_types=[NotificationType.CONTRACT_CREATED],
            tenant_id="tenant-A"
        )
        
        # Tenant B should not receive tenant A's notifications
        notifications = await slack_service.get_configured_notifications(
            workspace_id="T1234567890",
            tenant_id="tenant-B"
        )
        
        assert len([n for n in notifications if n.channel_id == "C1234567890"]) == 0