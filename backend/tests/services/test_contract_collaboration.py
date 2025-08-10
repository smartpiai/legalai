"""
Contract Collaboration Service Tests
Following TDD - RED phase: Comprehensive test suite for contract collaboration service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.contract_collaboration import (
    ContractCollaborationService,
    CollaborationSession,
    ContractComment,
    ContractAnnotation,
    ContractVersion,
    CollaborativeEdit,
    UserPresence,
    ShareSettings,
    CollaborationRole,
    PermissionLevel,
    CommentThread,
    AnnotationType,
    EditOperation,
    ConflictResolution,
    ReviewRequest,
    ApprovalStatus,
    CollaborationMetrics,
    NotificationType,
    ActivityLog
)
from app.models.collaboration import Collaboration, Comment, Annotation
from app.core.exceptions import CollaborationError, PermissionError, ConflictError


class TestContractCollaborationService:
    """Test suite for contract collaboration service"""

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
        redis.publish = AsyncMock()
        redis.subscribe = AsyncMock()
        return redis

    @pytest.fixture
    def mock_websocket_manager(self):
        """Mock WebSocket manager"""
        manager = AsyncMock()
        manager.broadcast = AsyncMock()
        manager.send_to_user = AsyncMock()
        manager.add_connection = AsyncMock()
        return manager

    @pytest.fixture
    def collaboration_service(
        self,
        mock_postgres,
        mock_redis,
        mock_websocket_manager
    ):
        """Create contract collaboration service instance"""
        return ContractCollaborationService(
            postgres=mock_postgres,
            redis=mock_redis,
            websocket_manager=mock_websocket_manager
        )

    @pytest.fixture
    def sample_collaboration_session(self):
        """Sample collaboration session"""
        return CollaborationSession(
            id="session-123",
            contract_id="contract-456",
            participants=["user-1", "user-2", "user-3"],
            session_type="edit",
            created_by="user-1"
        )

    @pytest.fixture
    def sample_comment(self):
        """Sample contract comment"""
        return ContractComment(
            id="comment-123",
            contract_id="contract-456",
            user_id="user-1",
            content="This clause needs review",
            position={"page": 1, "x": 100, "y": 200},
            thread_id="thread-123"
        )

    # Test Session Management

    @pytest.mark.asyncio
    async def test_create_collaboration_session(self, collaboration_service):
        """Test creating collaboration session"""
        result = await collaboration_service.create_session(
            contract_id="contract-123",
            session_type="review",
            created_by="user-1",
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.contract_id == "contract-123"
        assert result.created_by == "user-1"

    @pytest.mark.asyncio
    async def test_join_collaboration_session(self, collaboration_service):
        """Test joining collaboration session"""
        result = await collaboration_service.join_session(
            session_id="session-123",
            user_id="user-2",
            role=CollaborationRole.REVIEWER,
            tenant_id="tenant-123"
        )
        
        assert result.success is True
        assert result.user_id == "user-2"

    @pytest.mark.asyncio
    async def test_leave_collaboration_session(self, collaboration_service):
        """Test leaving collaboration session"""
        result = await collaboration_service.leave_session(
            session_id="session-123",
            user_id="user-2",
            tenant_id="tenant-123"
        )
        
        assert result.success is True

    @pytest.mark.asyncio
    async def test_get_active_sessions(self, collaboration_service):
        """Test getting active collaboration sessions"""
        sessions = await collaboration_service.get_active_sessions(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(sessions, list)
        assert all(s.contract_id == "contract-123" for s in sessions)

    # Test Real-time Collaboration

    @pytest.mark.asyncio
    async def test_broadcast_edit_operation(self, collaboration_service):
        """Test broadcasting edit operations"""
        edit = CollaborativeEdit(
            operation=EditOperation.INSERT,
            position=150,
            content="new text",
            user_id="user-1"
        )
        
        await collaboration_service.broadcast_edit(
            session_id="session-123",
            edit=edit,
            tenant_id="tenant-123"
        )
        
        # Verify broadcast was called
        collaboration_service.websocket_manager.broadcast.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_concurrent_edits(self, collaboration_service):
        """Test handling concurrent edits"""
        edit1 = CollaborativeEdit(
            operation=EditOperation.INSERT,
            position=100,
            content="text1",
            user_id="user-1"
        )
        
        edit2 = CollaborativeEdit(
            operation=EditOperation.INSERT,
            position=100,
            content="text2",
            user_id="user-2"
        )
        
        result = await collaboration_service.resolve_edit_conflict(
            session_id="session-123",
            conflicting_edits=[edit1, edit2],
            resolution_strategy=ConflictResolution.MERGE,
            tenant_id="tenant-123"
        )
        
        assert result.resolved is True

    @pytest.mark.asyncio
    async def test_track_user_presence(self, collaboration_service):
        """Test tracking user presence"""
        await collaboration_service.update_presence(
            session_id="session-123",
            user_id="user-1",
            cursor_position=250,
            selection_range={"start": 200, "end": 300},
            tenant_id="tenant-123"
        )
        
        presence = await collaboration_service.get_user_presence(
            session_id="session-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(presence, list)
        assert any(p.user_id == "user-1" for p in presence)

    # Test Comments and Annotations

    @pytest.mark.asyncio
    async def test_add_comment(self, collaboration_service, sample_comment):
        """Test adding comment to contract"""
        result = await collaboration_service.add_comment(
            comment=sample_comment,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.contract_id == sample_comment.contract_id

    @pytest.mark.asyncio
    async def test_reply_to_comment(self, collaboration_service):
        """Test replying to existing comment"""
        reply = await collaboration_service.reply_to_comment(
            parent_comment_id="comment-123",
            content="I agree with this assessment",
            user_id="user-2",
            tenant_id="tenant-123"
        )
        
        assert reply.parent_id == "comment-123"
        assert reply.user_id == "user-2"

    @pytest.mark.asyncio
    async def test_resolve_comment(self, collaboration_service):
        """Test resolving comment thread"""
        result = await collaboration_service.resolve_comment(
            comment_id="comment-123",
            resolved_by="user-1",
            tenant_id="tenant-123"
        )
        
        assert result.is_resolved is True
        assert result.resolved_by == "user-1"

    @pytest.mark.asyncio
    async def test_add_annotation(self, collaboration_service):
        """Test adding annotation to contract"""
        annotation = ContractAnnotation(
            contract_id="contract-123",
            user_id="user-1",
            type=AnnotationType.HIGHLIGHT,
            content="Important clause",
            selection_range={"start": 100, "end": 200}
        )
        
        result = await collaboration_service.add_annotation(
            annotation=annotation,
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert result.type == AnnotationType.HIGHLIGHT

    @pytest.mark.asyncio
    async def test_get_comments_and_annotations(self, collaboration_service):
        """Test retrieving comments and annotations"""
        comments = await collaboration_service.get_comments(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        annotations = await collaboration_service.get_annotations(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(comments, list)
        assert isinstance(annotations, list)

    # Test Version Control

    @pytest.mark.asyncio
    async def test_create_contract_version(self, collaboration_service):
        """Test creating contract version"""
        version = await collaboration_service.create_version(
            contract_id="contract-123",
            changes_summary="Updated payment terms",
            created_by="user-1",
            tenant_id="tenant-123"
        )
        
        assert version.version_number > 0
        assert version.changes_summary == "Updated payment terms"

    @pytest.mark.asyncio
    async def test_compare_versions(self, collaboration_service):
        """Test comparing contract versions"""
        diff = await collaboration_service.compare_versions(
            contract_id="contract-123",
            version_from=1,
            version_to=2,
            tenant_id="tenant-123"
        )
        
        assert "additions" in diff
        assert "deletions" in diff
        assert "modifications" in diff

    @pytest.mark.asyncio
    async def test_revert_to_version(self, collaboration_service):
        """Test reverting to previous version"""
        result = await collaboration_service.revert_to_version(
            contract_id="contract-123",
            version_number=1,
            reverted_by="user-1",
            tenant_id="tenant-123"
        )
        
        assert result.success is True
        assert result.new_version_number > 1

    # Test Permissions and Sharing

    @pytest.mark.asyncio
    async def test_set_collaboration_permissions(self, collaboration_service):
        """Test setting collaboration permissions"""
        permissions = await collaboration_service.set_permissions(
            contract_id="contract-123",
            user_id="user-2",
            permission_level=PermissionLevel.REVIEWER,
            tenant_id="tenant-123"
        )
        
        assert permissions.user_id == "user-2"
        assert permissions.level == PermissionLevel.REVIEWER

    @pytest.mark.asyncio
    async def test_share_contract(self, collaboration_service):
        """Test sharing contract with external users"""
        share_settings = ShareSettings(
            recipients=["external@company.com"],
            permission_level=PermissionLevel.VIEWER,
            expiry_date=datetime.utcnow() + timedelta(days=7),
            require_authentication=True
        )
        
        result = await collaboration_service.share_contract(
            contract_id="contract-123",
            share_settings=share_settings,
            shared_by="user-1",
            tenant_id="tenant-123"
        )
        
        assert result.share_link is not None
        assert result.expires_at is not None

    @pytest.mark.asyncio
    async def test_check_user_permissions(self, collaboration_service):
        """Test checking user permissions"""
        has_permission = await collaboration_service.check_permission(
            contract_id="contract-123",
            user_id="user-2",
            action="edit",
            tenant_id="tenant-123"
        )
        
        assert isinstance(has_permission, bool)

    # Test Review and Approval Workflow

    @pytest.mark.asyncio
    async def test_create_review_request(self, collaboration_service):
        """Test creating review request"""
        review_request = ReviewRequest(
            contract_id="contract-123",
            reviewers=["user-2", "user-3"],
            due_date=datetime.utcnow() + timedelta(days=3),
            message="Please review the updated terms"
        )
        
        result = await collaboration_service.create_review_request(
            review_request=review_request,
            requested_by="user-1",
            tenant_id="tenant-123"
        )
        
        assert result.id is not None
        assert len(result.reviewers) == 2

    @pytest.mark.asyncio
    async def test_submit_review(self, collaboration_service):
        """Test submitting review"""
        result = await collaboration_service.submit_review(
            review_id="review-123",
            reviewer_id="user-2",
            status=ApprovalStatus.APPROVED,
            comments="Looks good to me",
            tenant_id="tenant-123"
        )
        
        assert result.status == ApprovalStatus.APPROVED
        assert result.reviewer_id == "user-2"

    @pytest.mark.asyncio
    async def test_get_review_status(self, collaboration_service):
        """Test getting review status"""
        status = await collaboration_service.get_review_status(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert "pending_reviews" in status
        assert "completed_reviews" in status
        assert "overall_status" in status

    # Test Activity Tracking

    @pytest.mark.asyncio
    async def test_log_collaboration_activity(self, collaboration_service):
        """Test logging collaboration activity"""
        await collaboration_service.log_activity(
            contract_id="contract-123",
            user_id="user-1",
            action="comment_added",
            details={"comment_id": "comment-123"},
            tenant_id="tenant-123"
        )
        
        activities = await collaboration_service.get_activity_log(
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(activities, list)
        assert len(activities) > 0

    @pytest.mark.asyncio
    async def test_get_collaboration_metrics(self, collaboration_service):
        """Test getting collaboration metrics"""
        metrics = await collaboration_service.get_metrics(
            contract_id="contract-123",
            period="weekly",
            tenant_id="tenant-123"
        )
        
        assert isinstance(metrics, CollaborationMetrics)
        assert metrics.total_comments >= 0
        assert metrics.active_collaborators >= 0

    # Test Notifications

    @pytest.mark.asyncio
    async def test_send_collaboration_notification(self, collaboration_service):
        """Test sending collaboration notifications"""
        await collaboration_service.send_notification(
            recipients=["user-2", "user-3"],
            notification_type=NotificationType.COMMENT_MENTION,
            content="You were mentioned in a comment",
            contract_id="contract-123",
            tenant_id="tenant-123"
        )
        
        # Verify notification was processed
        # In real implementation, this would check notification queue

    @pytest.mark.asyncio
    async def test_get_user_notifications(self, collaboration_service):
        """Test getting user notifications"""
        notifications = await collaboration_service.get_user_notifications(
            user_id="user-2",
            unread_only=True,
            tenant_id="tenant-123"
        )
        
        assert isinstance(notifications, list)

    # Test Integration Features

    @pytest.mark.asyncio
    async def test_export_collaboration_data(self, collaboration_service):
        """Test exporting collaboration data"""
        export = await collaboration_service.export_collaboration_data(
            contract_id="contract-123",
            include_comments=True,
            include_versions=True,
            format="pdf",
            tenant_id="tenant-123"
        )
        
        assert export.file_path is not None
        assert export.format == "pdf"

    @pytest.mark.asyncio
    async def test_import_collaboration_data(self, collaboration_service):
        """Test importing collaboration data"""
        result = await collaboration_service.import_collaboration_data(
            contract_id="contract-123",
            data_file="/imports/collaboration.json",
            merge_strategy="append",
            tenant_id="tenant-123"
        )
        
        assert result.imported_comments >= 0
        assert result.imported_annotations >= 0

    # Test Error Handling

    @pytest.mark.asyncio
    async def test_handle_invalid_session(self, collaboration_service):
        """Test handling invalid session access"""
        with pytest.raises(CollaborationError):
            await collaboration_service.join_session(
                session_id="invalid-session",
                user_id="user-1",
                role=CollaborationRole.EDITOR,
                tenant_id="tenant-123"
            )

    @pytest.mark.asyncio
    async def test_handle_permission_denied(self, collaboration_service):
        """Test handling permission denied scenarios"""
        with pytest.raises(PermissionError):
            await collaboration_service.add_comment(
                comment=ContractComment(
                    contract_id="restricted-contract",
                    user_id="unauthorized-user",
                    content="Unauthorized comment"
                ),
                tenant_id="tenant-123"
            )

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_collaboration_isolation(self, collaboration_service):
        """Test collaboration isolation between tenants"""
        # Create session for tenant A
        session_a = await collaboration_service.create_session(
            contract_id="contract-A",
            session_type="edit",
            created_by="user-A",
            tenant_id="tenant-A"
        )
        
        # Try to access from tenant B
        sessions_b = await collaboration_service.get_active_sessions(
            contract_id="contract-A",
            tenant_id="tenant-B"
        )
        
        assert len(sessions_b) == 0

    @pytest.mark.asyncio
    async def test_tenant_comment_isolation(self, collaboration_service):
        """Test comment isolation between tenants"""
        # Add comment for tenant A
        comment_a = ContractComment(
            contract_id="contract-A",
            user_id="user-A",
            content="Tenant A comment"
        )
        
        await collaboration_service.add_comment(
            comment=comment_a,
            tenant_id="tenant-A"
        )
        
        # Try to get comments from tenant B
        comments_b = await collaboration_service.get_comments(
            contract_id="contract-A",
            tenant_id="tenant-B"
        )
        
        assert len(comments_b) == 0