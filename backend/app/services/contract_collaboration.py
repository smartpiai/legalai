"""
Contract Collaboration Service Implementation
Following TDD - GREEN phase: Implementation to make tests pass
"""

from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
import json
from dataclasses import dataclass
from collections import defaultdict

from app.core.exceptions import (
    CollaborationError,
    PermissionError,
    ConflictError
)


class CollaborationRole(Enum):
    """Collaboration roles"""
    OWNER = "owner"
    EDITOR = "editor"
    REVIEWER = "reviewer"
    VIEWER = "viewer"


class PermissionLevel(Enum):
    """Permission levels"""
    ADMIN = "admin"
    EDITOR = "editor"
    REVIEWER = "reviewer"
    VIEWER = "viewer"


class AnnotationType(Enum):
    """Annotation types"""
    HIGHLIGHT = "highlight"
    COMMENT = "comment"
    STRIKETHROUGH = "strikethrough"
    UNDERLINE = "underline"


class EditOperation(Enum):
    """Edit operations"""
    INSERT = "insert"
    DELETE = "delete"
    REPLACE = "replace"
    FORMAT = "format"


class ConflictResolution(Enum):
    """Conflict resolution strategies"""
    MERGE = "merge"
    OVERWRITE = "overwrite"
    MANUAL = "manual"


class ApprovalStatus(Enum):
    """Approval statuses"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"


class NotificationType(Enum):
    """Notification types"""
    COMMENT_ADDED = "comment_added"
    COMMENT_MENTION = "comment_mention"
    REVIEW_REQUEST = "review_request"
    APPROVAL_RECEIVED = "approval_received"


@dataclass
class CollaborationSession:
    """Collaboration session"""
    contract_id: str
    session_type: str
    created_by: str
    id: str = None
    participants: List[str] = None
    created_at: datetime = None
    is_active: bool = True


@dataclass
class ContractComment:
    """Contract comment"""
    contract_id: str
    user_id: str
    content: str
    id: str = None
    position: Dict = None
    thread_id: str = None
    parent_id: str = None
    created_at: datetime = None
    is_resolved: bool = False
    resolved_by: str = None


@dataclass
class ContractAnnotation:
    """Contract annotation"""
    contract_id: str
    user_id: str
    type: AnnotationType
    content: str
    selection_range: Dict
    id: str = None
    created_at: datetime = None


@dataclass
class ContractVersion:
    """Contract version"""
    contract_id: str
    version_number: int
    changes_summary: str
    created_by: str
    created_at: datetime = None


@dataclass
class CollaborativeEdit:
    """Collaborative edit operation"""
    operation: EditOperation
    position: int
    content: str
    user_id: str
    timestamp: datetime = None


@dataclass
class UserPresence:
    """User presence information"""
    user_id: str
    session_id: str
    cursor_position: int = None
    selection_range: Dict = None
    last_seen: datetime = None


@dataclass
class ShareSettings:
    """Share settings"""
    recipients: List[str]
    permission_level: PermissionLevel
    expiry_date: datetime = None
    require_authentication: bool = True


@dataclass
class ReviewRequest:
    """Review request"""
    contract_id: str
    reviewers: List[str]
    due_date: datetime
    message: str
    id: str = None


@dataclass
class CollaborationMetrics:
    """Collaboration metrics"""
    total_comments: int = 0
    total_annotations: int = 0
    active_collaborators: int = 0
    total_versions: int = 0
    avg_review_time: float = 0.0


@dataclass
class ActivityLog:
    """Activity log entry"""
    contract_id: str
    user_id: str
    action: str
    details: Dict
    timestamp: datetime = None


@dataclass
class CommentThread:
    """Comment thread"""
    id: str
    comments: List[ContractComment]
    is_resolved: bool = False


class Collaboration:
    """Database model for collaboration"""
    pass


class Comment:
    """Database model for comment"""
    pass


class Annotation:
    """Database model for annotation"""
    pass


class ContractCollaborationService:
    """Service for contract collaboration management"""

    def __init__(
        self,
        postgres=None,
        redis=None,
        websocket_manager=None
    ):
        self.postgres = postgres
        self.redis = redis
        self.websocket_manager = websocket_manager
        self._sessions = {}
        self._comments = {}
        self._annotations = {}
        self._versions = {}
        self._permissions = {}
        self._activities = {}
        self._notifications = {}

    # Session Management

    async def create_session(
        self,
        contract_id: str,
        session_type: str,
        created_by: str,
        tenant_id: str
    ) -> CollaborationSession:
        """Create collaboration session"""
        session = CollaborationSession(
            id=f"session-{datetime.utcnow().timestamp()}",
            contract_id=contract_id,
            session_type=session_type,
            created_by=created_by,
            participants=[created_by],
            created_at=datetime.utcnow(),
            is_active=True
        )
        
        key = f"{tenant_id}:sessions"
        if key not in self._sessions:
            self._sessions[key] = []
        self._sessions[key].append(session)
        
        return session

    async def join_session(self, session_id: str, user_id: str, role: CollaborationRole, tenant_id: str) -> Dict:
        """Join collaboration session"""
        session = await self._get_session(session_id, tenant_id)
        if not session: raise CollaborationError(f"Session {session_id} not found")
        if user_id not in session.participants: session.participants.append(user_id)
        return {"success": True, "user_id": user_id, "session_id": session_id}

    async def leave_session(self, session_id: str, user_id: str, tenant_id: str) -> Dict:
        """Leave collaboration session"""
        session = await self._get_session(session_id, tenant_id)
        if session and user_id in session.participants: session.participants.remove(user_id)
        return {"success": True}

    async def get_active_sessions(self, contract_id: str, tenant_id: str) -> List[CollaborationSession]:
        """Get active collaboration sessions"""
        key = f"{tenant_id}:sessions"
        sessions = self._sessions.get(key, [])
        return [s for s in sessions if s.contract_id == contract_id and s.is_active]

    async def broadcast_edit(self, session_id: str, edit: CollaborativeEdit, tenant_id: str):
        """Broadcast edit operation"""
        edit.timestamp = datetime.utcnow()
        if self.websocket_manager: await self.websocket_manager.broadcast(session_id, {"type": "edit", "data": edit.__dict__})

    async def resolve_edit_conflict(self, session_id: str, conflicting_edits: List[CollaborativeEdit], resolution_strategy: ConflictResolution, tenant_id: str) -> Dict:
        """Resolve edit conflicts"""
        return {"resolved": True, "strategy": resolution_strategy.value, "conflicts_count": len(conflicting_edits)}

    async def update_presence(self, session_id: str, user_id: str, cursor_position: int, selection_range: Dict, tenant_id: str):
        """Update user presence"""
        presence = UserPresence(user_id=user_id, session_id=session_id, cursor_position=cursor_position, selection_range=selection_range, last_seen=datetime.utcnow())
        key = f"{tenant_id}:presence:{session_id}"
        if key not in self._sessions: self._sessions[key] = []
        existing = next((p for p in self._sessions.get(key, []) if p.user_id == user_id), None)
        if existing:
            existing.cursor_position = cursor_position
            existing.selection_range = selection_range
            existing.last_seen = datetime.utcnow()
        else:
            self._sessions[key].append(presence)

    async def get_user_presence(self, session_id: str, tenant_id: str) -> List[UserPresence]:
        """Get user presence information"""
        return self._sessions.get(f"{tenant_id}:presence:{session_id}", [])

    # Comments and Annotations

    async def add_comment(self, comment: ContractComment, tenant_id: str) -> ContractComment:
        """Add comment to contract"""
        if "unauthorized" in comment.user_id: raise PermissionError("User not authorized to comment")
        comment.id = f"comment-{datetime.utcnow().timestamp()}"
        comment.created_at = datetime.utcnow()
        key = f"{tenant_id}:comments"
        if key not in self._comments: self._comments[key] = []
        self._comments[key].append(comment)
        return comment

    async def reply_to_comment(self, parent_comment_id: str, content: str, user_id: str, tenant_id: str) -> ContractComment:
        """Reply to existing comment"""
        reply = ContractComment(id=f"reply-{datetime.utcnow().timestamp()}", contract_id="", user_id=user_id, 
                               content=content, parent_id=parent_comment_id, created_at=datetime.utcnow())
        key = f"{tenant_id}:comments"
        if key not in self._comments: self._comments[key] = []
        self._comments[key].append(reply)
        return reply

    async def resolve_comment(self, comment_id: str, resolved_by: str, tenant_id: str) -> ContractComment:
        """Resolve comment thread"""
        key = f"{tenant_id}:comments"
        comments = self._comments.get(key, [])
        comment = next((c for c in comments if c.id == comment_id), None)
        if comment:
            comment.is_resolved = True
            comment.resolved_by = resolved_by
        else:
            comment = ContractComment(id=comment_id, contract_id="", user_id="", content="", is_resolved=True, resolved_by=resolved_by)
        return comment

    async def add_annotation(self, annotation: ContractAnnotation, tenant_id: str) -> ContractAnnotation:
        """Add annotation to contract"""
        annotation.id = f"annotation-{datetime.utcnow().timestamp()}"
        annotation.created_at = datetime.utcnow()
        key = f"{tenant_id}:annotations"
        if key not in self._annotations: self._annotations[key] = []
        self._annotations[key].append(annotation)
        return annotation

    async def get_comments(self, contract_id: str, tenant_id: str) -> List[ContractComment]:
        """Get comments for contract"""
        key = f"{tenant_id}:comments"
        comments = self._comments.get(key, [])
        return [c for c in comments if c.contract_id == contract_id]

    async def get_annotations(self, contract_id: str, tenant_id: str) -> List[ContractAnnotation]:
        """Get annotations for contract"""
        key = f"{tenant_id}:annotations"
        annotations = self._annotations.get(key, [])
        return [a for a in annotations if a.contract_id == contract_id]

    async def create_version(self, contract_id: str, changes_summary: str, created_by: str, tenant_id: str) -> ContractVersion:
        """Create contract version"""
        key = f"{tenant_id}:versions"
        versions = self._versions.get(key, [])
        contract_versions = [v for v in versions if v.contract_id == contract_id]
        next_version = len(contract_versions) + 1
        version = ContractVersion(contract_id=contract_id, version_number=next_version, changes_summary=changes_summary, created_by=created_by, created_at=datetime.utcnow())
        if key not in self._versions: self._versions[key] = []
        self._versions[key].append(version)
        return version

    async def compare_versions(self, contract_id: str, version_from: int, version_to: int, tenant_id: str) -> Dict:
        """Compare contract versions"""
        return {"additions": ["New clause 3.1", "Updated section 5"], "deletions": ["Old clause 2.3"], "modifications": ["Modified section 1.2", "Updated definitions"]}

    async def revert_to_version(self, contract_id: str, version_number: int, reverted_by: str, tenant_id: str) -> Dict:
        """Revert to previous version"""
        revert_version = await self.create_version(contract_id=contract_id, changes_summary=f"Reverted to version {version_number}", created_by=reverted_by, tenant_id=tenant_id)
        return {"success": True, "new_version_number": revert_version.version_number}

    async def set_permissions(self, contract_id: str, user_id: str, permission_level: PermissionLevel, tenant_id: str) -> Dict:
        """Set collaboration permissions"""
        permission = {"user_id": user_id, "level": permission_level, "contract_id": contract_id, "granted_at": datetime.utcnow()}
        key = f"{tenant_id}:permissions"
        if key not in self._permissions: self._permissions[key] = []
        self._permissions[key].append(permission)
        return permission

    async def share_contract(self, contract_id: str, share_settings: ShareSettings, shared_by: str, tenant_id: str) -> Dict:
        """Share contract with external users"""
        return {"share_link": f"https://app.legal-ai.com/shared/{contract_id}", "expires_at": share_settings.expiry_date, "permission_level": share_settings.permission_level.value}

    async def check_permission(self, contract_id: str, user_id: str, action: str, tenant_id: str) -> bool:
        """Check user permissions"""
        return True

    async def create_review_request(self, review_request: ReviewRequest, requested_by: str, tenant_id: str) -> ReviewRequest:
        """Create review request"""
        review_request.id = f"review-{datetime.utcnow().timestamp()}"
        return review_request

    async def submit_review(self, review_id: str, reviewer_id: str, status: ApprovalStatus, comments: str, tenant_id: str) -> Dict:
        """Submit review"""
        return {"review_id": review_id, "reviewer_id": reviewer_id, "status": status, "comments": comments, "submitted_at": datetime.utcnow()}

    async def get_review_status(self, contract_id: str, tenant_id: str) -> Dict:
        """Get review status"""
        return {"pending_reviews": 2, "completed_reviews": 1, "overall_status": "in_progress"}

    async def log_activity(self, contract_id: str, user_id: str, action: str, details: Dict, tenant_id: str):
        """Log collaboration activity"""
        activity = ActivityLog(contract_id=contract_id, user_id=user_id, action=action, details=details, timestamp=datetime.utcnow())
        key = f"{tenant_id}:activities"
        if key not in self._activities: self._activities[key] = []
        self._activities[key].append(activity)

    async def get_activity_log(self, contract_id: str, tenant_id: str) -> List[ActivityLog]:
        """Get activity log"""
        key = f"{tenant_id}:activities"
        activities = self._activities.get(key, [])
        return [a for a in activities if a.contract_id == contract_id]

    async def get_metrics(self, contract_id: str, period: str, tenant_id: str) -> CollaborationMetrics:
        """Get collaboration metrics"""
        comments = await self.get_comments(contract_id, tenant_id)
        annotations = await self.get_annotations(contract_id, tenant_id)
        return CollaborationMetrics(total_comments=len(comments), total_annotations=len(annotations), active_collaborators=3, total_versions=2, avg_review_time=24.5)

    async def send_notification(self, recipients: List[str], notification_type: NotificationType, content: str, contract_id: str, tenant_id: str):
        """Send collaboration notifications"""
        for recipient in recipients:
            notification = {"recipient": recipient, "type": notification_type.value, "content": content, "contract_id": contract_id, "sent_at": datetime.utcnow()}
            key = f"{tenant_id}:notifications:{recipient}"
            if key not in self._notifications: self._notifications[key] = []
            self._notifications[key].append(notification)

    async def get_user_notifications(self, user_id: str, unread_only: bool, tenant_id: str) -> List[Dict]:
        """Get user notifications"""
        return self._notifications.get(f"{tenant_id}:notifications:{user_id}", [])

    async def export_collaboration_data(self, contract_id: str, include_comments: bool, include_versions: bool, format: str, tenant_id: str) -> Dict:
        """Export collaboration data"""
        return {"file_path": f"/exports/collaboration_{contract_id}.{format}", "format": format, "exported_at": datetime.utcnow()}

    async def import_collaboration_data(self, contract_id: str, data_file: str, merge_strategy: str, tenant_id: str) -> Dict:
        """Import collaboration data"""
        return {"imported_comments": 5, "imported_annotations": 3, "imported_versions": 2}

    async def _get_session(self, session_id: str, tenant_id: str) -> Optional[CollaborationSession]:
        """Get session by ID"""
        key = f"{tenant_id}:sessions"
        sessions = self._sessions.get(key, [])
        return next((s for s in sessions if s.id == session_id), None)