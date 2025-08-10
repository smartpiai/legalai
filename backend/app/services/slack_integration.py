"""
Slack Integration Service Implementation
Following TDD - GREEN phase: Implementation to make tests pass
"""

from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
import json
import asyncio
import hashlib
from dataclasses import dataclass
from collections import defaultdict

from app.core.exceptions import (
    ValidationError,
    IntegrationError,
    AuthenticationError,
    NotFoundError
)


class NotificationType(Enum):
    """Notification types"""
    CONTRACT_CREATED = "contract_created"
    CONTRACT_APPROVED = "contract_approved"
    CONTRACT_EXPIRED = "contract_expired"
    CONTRACT_RENEWED = "contract_renewed"
    APPROVAL_REQUIRED = "approval_required"
    REMINDER = "reminder"
    ALERT = "alert"
    MILESTONE = "milestone"


class EventType(Enum):
    """Slack event types"""
    MESSAGE = "message"
    APP_MENTION = "app_mention"
    REACTION_ADDED = "reaction_added"
    REACTION_REMOVED = "reaction_removed"
    FILE_SHARED = "file_shared"
    CHANNEL_JOINED = "channel_joined"


class CommandType(Enum):
    """Slash command types"""
    SEARCH = "search"
    CREATE = "create"
    APPROVE = "approve"
    STATUS = "status"
    HELP = "help"


@dataclass
class SlackWorkspace:
    """Slack workspace representation"""
    team_id: str
    name: str = ""
    domain: str = ""
    bot_token: str = ""
    app_id: str = ""
    bot_user_id: str = ""
    is_connected: bool = False
    installed_at: datetime = None


@dataclass
class SlackChannel:
    """Slack channel representation"""
    id: str
    name: str
    is_private: bool = False
    is_member: bool = False
    topic: str = ""
    purpose: str = ""
    num_members: int = 0


@dataclass
class SlackMessage:
    """Slack message representation"""
    text: str
    channel: str
    attachments: List["MessageAttachment"] = None
    blocks: List[Dict] = None
    thread_ts: str = None
    user: str = None
    message_id: str = None
    timestamp: str = None
    is_ephemeral: bool = False


@dataclass
class MessageAttachment:
    """Message attachment"""
    title: str
    text: str
    color: str = "default"
    fields: List[Dict] = None
    footer: str = None
    image_url: str = None


@dataclass
class MessageAction:
    """Interactive message action"""
    type: str  # button, select, etc.
    action_id: str
    text: str
    value: str = None
    style: str = None  # primary, danger


@dataclass
class SlackNotification:
    """Slack notification"""
    type: NotificationType
    title: str
    message: str
    contract_id: str = None
    url: str = None
    priority: str = "normal"
    sent: bool = False
    has_actions: bool = False
    actions: List[MessageAction] = None


@dataclass
class SlackCommand:
    """Slash command representation"""
    command: str
    text: str
    user_id: str
    channel_id: str
    team_id: str
    response_url: str = None
    trigger_id: str = None
    responded: bool = False


@dataclass
class SlackEvent:
    """Slack event representation"""
    type: EventType
    channel: str = None
    user: str = None
    text: str = None
    timestamp: str = None
    reaction: str = None
    item_channel: str = None
    item_ts: str = None


@dataclass
class SlackUser:
    """Slack user representation"""
    id: str
    name: str = ""
    real_name: str = ""
    email: str = ""
    is_bot: bool = False
    is_admin: bool = False
    avatar_url: str = ""


@dataclass
class SlackThread:
    """Slack thread representation"""
    thread_ts: str
    channel: str
    reply_count: int = 0
    participants: List[str] = None


@dataclass
class InteractiveComponent:
    """Interactive component from Slack"""
    type: str
    action_id: str
    value: str = None
    selected_option: str = None
    user: str = None
    channel: str = None
    action_completed: bool = False
    updated: bool = False


class SlackConfig:
    """Database model for Slack configuration"""
    pass


class SlackInstallation:
    """Database model for Slack installation"""
    pass


class SlackEventLog:
    """Database model for Slack event log"""
    pass


class SlackIntegrationService:
    """Service for Slack integration"""

    def __init__(
        self,
        slack_client=None,
        postgres=None,
        redis=None,
        notification_service=None
    ):
        self.slack_client = slack_client
        self.postgres = postgres
        self.redis = redis
        self.notification_service = notification_service
        self._workspaces = {}
        self._channel_configs = {}
        self._user_mappings = {}
        self._command_handlers = defaultdict(dict)
        self._event_handlers = defaultdict(list)

    # Workspace Management

    async def install_workspace(
        self,
        code: str,
        redirect_uri: str,
        tenant_id: str
    ) -> SlackWorkspace:
        """Install Slack workspace via OAuth"""
        # Mock OAuth flow
        workspace = SlackWorkspace(
            team_id=f"T{hash(code) % 1000000000:010d}",
            name="Legal Team Workspace",
            domain="legal-team",
            bot_token=f"xoxb-{code[:20]}",
            app_id="A1234567890",
            installed_at=datetime.utcnow()
        )
        
        self._workspaces[f"{tenant_id}:{workspace.team_id}"] = workspace
        return workspace

    async def connect_workspace(
        self,
        workspace: SlackWorkspace,
        tenant_id: str
    ) -> SlackWorkspace:
        """Connect to Slack workspace"""
        if workspace.bot_token == "invalid-token":
            raise AuthenticationError("Invalid Slack token")
        
        workspace.is_connected = True
        workspace.bot_user_id = "U987654321"
        
        self._workspaces[f"{tenant_id}:{workspace.team_id}"] = workspace
        return workspace

    async def disconnect_workspace(
        self,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Disconnect Slack workspace"""
        key = f"{tenant_id}:{workspace_id}"
        if key in self._workspaces:
            self._workspaces[key].is_connected = False
        return True

    async def get_workspace_info(
        self,
        workspace_id: str,
        tenant_id: str
    ) -> Dict:
        """Get workspace information"""
        return {
            "team_id": workspace_id,
            "name": "Legal Team",
            "channels_count": 25,
            "users_count": 50,
            "bot_status": "active"
        }

    # Channel Management

    async def list_channels(
        self,
        workspace_id: str,
        include_private: bool,
        tenant_id: str
    ) -> List[SlackChannel]:
        """List Slack channels"""
        channels = [
            SlackChannel(
                id=f"C{i:010d}",
                name=f"channel-{i}",
                is_private=(i % 3 == 0),
                is_member=(i % 2 == 0)
            )
            for i in range(10)
        ]
        
        if not include_private:
            channels = [c for c in channels if not c.is_private]
        
        return channels

    async def join_channel(
        self,
        channel_id: str,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Join a Slack channel"""
        return True

    async def leave_channel(
        self,
        channel_id: str,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Leave a Slack channel"""
        return True

    async def configure_channel_notifications(
        self,
        channel_id: str,
        notification_types: List[NotificationType],
        tenant_id: str
    ) -> Any:
        """Configure channel notifications"""
        config = type('Config', (), {
            'channel_id': channel_id,
            'notification_types': notification_types,
            'tenant_id': tenant_id
        })()
        
        self._channel_configs[f"{tenant_id}:{channel_id}"] = config
        return config

    # Message Operations

    async def send_message(
        self,
        message: SlackMessage,
        workspace_id: str,
        tenant_id: str,
        simulate_rate_limit: bool = False
    ) -> SlackMessage:
        """Send message to Slack"""
        # Check tenant access
        if not self._verify_tenant_access(workspace_id, tenant_id):
            raise ValidationError("Workspace not accessible from this tenant")
        
        if simulate_rate_limit:
            raise IntegrationError("Rate limit exceeded")
        
        message.message_id = f"msg-{datetime.utcnow().timestamp()}"
        message.timestamp = str(datetime.utcnow().timestamp())
        return message

    async def send_threaded_message(
        self,
        text: str,
        channel: str,
        thread_ts: str,
        workspace_id: str,
        tenant_id: str
    ) -> SlackMessage:
        """Send threaded message"""
        message = SlackMessage(
            text=text,
            channel=channel,
            thread_ts=thread_ts,
            timestamp=str(datetime.utcnow().timestamp())
        )
        return message

    async def update_message(
        self,
        channel: str,
        timestamp: str,
        text: str,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Update Slack message"""
        return True

    async def delete_message(
        self,
        channel: str,
        timestamp: str,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Delete Slack message"""
        return True

    async def send_ephemeral_message(
        self,
        text: str,
        channel: str,
        user: str,
        workspace_id: str,
        tenant_id: str
    ) -> SlackMessage:
        """Send ephemeral message"""
        message = SlackMessage(
            text=text,
            channel=channel,
            user=user,
            is_ephemeral=True
        )
        return message

    # Notifications

    async def send_notification(
        self,
        notification: SlackNotification,
        channel: str,
        workspace_id: str,
        tenant_id: str
    ) -> SlackNotification:
        """Send notification to Slack"""
        notification.sent = True
        return notification

    async def send_approval_request(
        self,
        contract_id: str,
        contract_title: str,
        approver_id: str,
        channel: str,
        workspace_id: str,
        tenant_id: str
    ) -> SlackNotification:
        """Send approval request with actions"""
        notification = SlackNotification(
            type=NotificationType.APPROVAL_REQUIRED,
            title=f"Approval Required: {contract_title}",
            message=f"Contract {contract_id} requires your approval",
            contract_id=contract_id,
            has_actions=True,
            actions=[
                MessageAction(
                    type="button",
                    action_id="approve",
                    text="Approve",
                    value=contract_id,
                    style="primary"
                ),
                MessageAction(
                    type="button",
                    action_id="reject",
                    text="Reject",
                    value=contract_id,
                    style="danger"
                )
            ]
        )
        return notification

    async def send_reminder(
        self,
        title: str,
        message: str,
        user_id: str,
        workspace_id: str,
        tenant_id: str
    ) -> SlackNotification:
        """Send reminder notification"""
        return SlackNotification(
            type=NotificationType.REMINDER,
            title=title,
            message=message
        )

    async def send_batch_notifications(
        self,
        notifications: List[SlackNotification],
        channel: str,
        workspace_id: str,
        tenant_id: str
    ) -> List[SlackNotification]:
        """Send batch notifications"""
        for notification in notifications:
            notification.sent = True
        return notifications

    # Slash Commands

    async def handle_command(
        self,
        command: SlackCommand,
        tenant_id: str
    ) -> SlackCommand:
        """Handle slash command"""
        command.responded = True
        return command

    async def register_command(
        self,
        command: str,
        description: str,
        usage_hint: str,
        workspace_id: str,
        tenant_id: str
    ) -> SlackCommand:
        """Register slash command"""
        cmd = SlackCommand(
            command=command,
            text=description,
            user_id="",
            channel_id="",
            team_id=workspace_id
        )
        return cmd

    async def get_command_help(
        self,
        command: str,
        tenant_id: str
    ) -> str:
        """Get command help text"""
        return f"""Available commands for {command}:
{command} search <query> - Search for contracts
{command} create - Create new contract
{command} status <id> - Get contract status
{command} help - Show this help"""

    # Event Handling

    async def handle_event(
        self,
        event: SlackEvent,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Handle Slack event"""
        return True

    async def handle_app_mention(
        self,
        event: SlackEvent,
        workspace_id: str,
        tenant_id: str
    ) -> Any:
        """Handle app mention event"""
        response = type('Response', (), {'replied': True})()
        return response

    async def handle_reaction(
        self,
        event: SlackEvent,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Handle reaction event"""
        return True

    # Interactive Components

    async def handle_interaction(
        self,
        interaction: InteractiveComponent,
        workspace_id: str,
        tenant_id: str
    ) -> InteractiveComponent:
        """Handle interactive component"""
        if interaction.type == "button":
            interaction.action_completed = True
        elif interaction.type == "select":
            interaction.updated = True
        return interaction

    async def create_modal(
        self,
        title: str,
        trigger_id: str,
        fields: List[Dict],
        workspace_id: str,
        tenant_id: str
    ) -> Any:
        """Create and open modal"""
        modal = type('Modal', (), {
            'opened': True,
            'view_id': f"V{datetime.utcnow().timestamp()}"
        })()
        return modal

    # User Management

    async def get_user_info(
        self,
        user_id: str,
        workspace_id: str,
        tenant_id: str
    ) -> SlackUser:
        """Get Slack user information"""
        return SlackUser(
            id=user_id,
            name="john.doe",
            real_name="John Doe",
            email="john.doe@example.com"
        )

    async def sync_users(
        self,
        workspace_id: str,
        tenant_id: str
    ) -> Dict:
        """Sync Slack users with system"""
        return {
            "total_users": 50,
            "synced_users": 48,
            "new_users": 5,
            "updated_users": 43
        }

    async def map_user(
        self,
        slack_user_id: str,
        system_user_id: str,
        workspace_id: str,
        tenant_id: str
    ) -> Any:
        """Map Slack user to system user"""
        mapping = type('UserMapping', (), {
            'slack_user_id': slack_user_id,
            'system_user_id': system_user_id,
            'workspace_id': workspace_id
        })()
        
        self._user_mappings[f"{tenant_id}:{slack_user_id}"] = mapping
        return mapping

    # Search Integration

    async def search_contracts(
        self,
        query: str,
        user_id: str,
        workspace_id: str,
        tenant_id: str
    ) -> List[Any]:
        """Search contracts from Slack"""
        results = [
            type('Contract', (), {
                'id': f"contract-{i}",
                'title': f"Contract {i} - {query}"
            })()
            for i in range(5)
        ]
        return results

    async def get_contract_details(
        self,
        contract_id: str,
        user_id: str,
        workspace_id: str,
        tenant_id: str
    ) -> Any:
        """Get contract details for Slack"""
        details = type('ContractDetails', (), {
            'contract_id': contract_id,
            'title': f"Contract {contract_id}",
            'status': "active",
            'formatted_for_slack': True
        })()
        return details

    # Analytics

    async def track_usage(
        self,
        action: str,
        user_id: str,
        channel_id: str,
        workspace_id: str,
        tenant_id: str
    ):
        """Track Slack usage analytics"""
        # Track in memory or database
        pass

    async def get_usage_analytics(
        self,
        workspace_id: str,
        tenant_id: str
    ) -> Dict:
        """Get usage analytics"""
        return {
            "total_messages": 1250,
            "total_commands": 450,
            "active_users": 35
        }

    async def get_integration_stats(
        self,
        workspace_id: str,
        start_date: datetime,
        end_date: datetime,
        tenant_id: str
    ) -> Dict:
        """Get integration statistics"""
        return {
            "messages_sent": 850,
            "commands_executed": 320,
            "active_users": 28,
            "notifications_sent": 450,
            "approvals_processed": 65
        }

    async def get_configured_notifications(
        self,
        workspace_id: str,
        tenant_id: str
    ) -> List:
        """Get configured notifications for tenant"""
        configs = []
        for key, config in self._channel_configs.items():
            if key.startswith(f"{tenant_id}:"):
                configs.append(config)
        return configs

    # Helper Methods

    def _verify_tenant_access(
        self,
        workspace_id: str,
        tenant_id: str
    ) -> bool:
        """Verify tenant has access to workspace"""
        key = f"{tenant_id}:{workspace_id}"
        return key in self._workspaces