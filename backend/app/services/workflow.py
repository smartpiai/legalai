"""
Workflow engine for contract approval and business processes.
Implements state machine pattern with conditional transitions.
"""
import json
import logging
from typing import Dict, Any, List, Optional, Set, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

logger = logging.getLogger(__name__)


class WorkflowStatus(str, Enum):
    """Workflow instance status."""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"
    FAILED = "failed"


class TaskStatus(str, Enum):
    """Task status within workflow."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    ESCALATED = "escalated"


@dataclass
class TransitionCondition:
    """Condition for workflow transition."""
    type: str  # field_required, field_value, user_role, custom
    field: Optional[str] = None
    operator: Optional[str] = None  # exists, equals, greater_than, less_than, contains
    value: Any = None
    error_message: Optional[str] = None


@dataclass
class WorkflowState:
    """Represents a state in workflow."""
    name: str
    display_name: Optional[str] = None
    is_initial: bool = False
    is_final: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    allowed_actions: List[str] = field(default_factory=list)
    entry_actions: List[str] = field(default_factory=list)
    exit_actions: List[str] = field(default_factory=list)


@dataclass
class WorkflowTransition:
    """Represents a transition between states."""
    name: str
    from_state: str
    to_state: str
    display_name: Optional[str] = None
    conditions: List[TransitionCondition] = field(default_factory=list)
    permissions: List[str] = field(default_factory=list)
    requires_comment: bool = False
    auto_execute: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def user_has_permission(self, user_permissions: List[str]) -> bool:
        """Check if user has required permissions for transition."""
        if not self.permissions:
            return True
        
        # Check for admin override
        if "workflow.admin" in user_permissions:
            return True
        
        # Check if user has any required permission
        return any(perm in user_permissions for perm in self.permissions)


@dataclass
class WorkflowParticipant:
    """Participant in workflow."""
    role: str
    type: str  # user, role, group
    assignment_type: str  # static, dynamic, conditional
    assignment_value: Optional[str] = None
    assignment_rule: Optional[str] = None
    notifications: List[str] = field(default_factory=list)


@dataclass
class WorkflowTask:
    """Task within workflow instance."""
    name: str
    type: str  # approval, review, action
    assignee_type: str  # user, role, group
    assignee_value: Optional[str] = None
    parallel: bool = False
    required: bool = True
    deadline_hours: Optional[int] = None
    status: TaskStatus = TaskStatus.PENDING
    assigned_to: List[int] = field(default_factory=list)
    completed_by: Optional[int] = None
    completed_at: Optional[datetime] = None
    comments: Optional[str] = None
    requires_all_approvals: bool = False


@dataclass
class WorkflowNotification:
    """Notification configuration."""
    event: str  # state_change, deadline_approaching, task_assigned
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    recipients: List[str] = field(default_factory=list)
    template: str = "default"
    channels: List[str] = field(default_factory=list)  # email, in_app, sms
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TransitionResult:
    """Result of transition execution."""
    success: bool
    new_state: Optional[str] = None
    message: str = ""
    errors: List[str] = field(default_factory=list)
    notifications_sent: int = 0


@dataclass
class NotificationResult:
    """Result of notification sending."""
    sent_count: int
    failed_count: int = 0
    channels_used: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class WorkflowDefinition:
    """Workflow definition with states and transitions."""
    
    def __init__(
        self,
        name: str,
        description: str = "",
        version: str = "1.0",
        tenant_id: Optional[int] = None,
        created_by: Optional[int] = None,
        states: List[WorkflowState] = None,
        transitions: List[WorkflowTransition] = None,
        participants: List[WorkflowParticipant] = None,
        notifications: List[WorkflowNotification] = None,
        sla_configuration: Dict[str, Any] = None,
        is_active: bool = True,
        is_template: bool = False
    ):
        self.id = None  # Set when saved to database
        self.name = name
        self.description = description
        self.version = version
        self.tenant_id = tenant_id
        self.created_by = created_by
        self.states = states or []
        self.transitions = transitions or []
        self.participants = participants or []
        self.notifications = notifications or []
        self.sla_configuration = sla_configuration or {}
        self.is_active = is_active
        self.is_template = is_template
        
        # Build state and transition maps for quick lookup
        self._state_map = {state.name: state for state in self.states}
        self._transition_map = {t.name: t for t in self.transitions}
        self._build_transition_graph()
    
    def _build_transition_graph(self):
        """Build graph of state transitions."""
        self._transition_graph = defaultdict(list)
        for transition in self.transitions:
            self._transition_graph[transition.from_state].append(transition.to_state)
    
    def get_initial_state(self) -> Optional[WorkflowState]:
        """Get the initial state of workflow."""
        for state in self.states:
            if state.is_initial:
                return state
        return None
    
    def get_final_states(self) -> List[WorkflowState]:
        """Get all final states."""
        return [state for state in self.states if state.is_final]
    
    def get_state(self, state_name: str) -> Optional[WorkflowState]:
        """Get state by name."""
        return self._state_map.get(state_name)
    
    def get_transition(self, transition_name: str) -> Optional[WorkflowTransition]:
        """Get transition by name."""
        return self._transition_map.get(transition_name)
    
    def can_transition(self, from_state: str, to_state: str) -> bool:
        """Check if transition is possible between states."""
        return to_state in self._transition_graph.get(from_state, [])
    
    def get_available_transitions(self, from_state: str) -> List[str]:
        """Get available transitions from a state."""
        return [
            t.name for t in self.transitions 
            if t.from_state == from_state
        ]
    
    def get_participant(self, role: str) -> Optional[WorkflowParticipant]:
        """Get participant by role."""
        for participant in self.participants:
            if participant.role == role:
                return participant
        return None
    
    def validate(self) -> bool:
        """Validate workflow definition."""
        # Check for initial state
        initial_states = [s for s in self.states if s.is_initial]
        if not initial_states:
            raise ValueError("No initial state defined")
        if len(initial_states) > 1:
            raise ValueError("Multiple initial states defined")
        
        # Check for at least one final state
        if not self.get_final_states():
            raise ValueError("No final state defined")
        
        # Validate all transitions reference existing states
        state_names = {s.name for s in self.states}
        for transition in self.transitions:
            if transition.from_state not in state_names:
                raise ValueError(f"Transition references unknown state: {transition.from_state}")
            if transition.to_state not in state_names:
                raise ValueError(f"Transition references unknown state: {transition.to_state}")
        
        return True
    
    def has_circular_transitions(self) -> bool:
        """Check if workflow has circular transitions."""
        visited = set()
        rec_stack = set()
        
        def has_cycle(state: str) -> bool:
            visited.add(state)
            rec_stack.add(state)
            
            for next_state in self._transition_graph.get(state, []):
                if next_state not in visited:
                    if has_cycle(next_state):
                        return True
                elif next_state in rec_stack:
                    return True
            
            rec_stack.remove(state)
            return False
        
        for state in self.states:
            if state.name not in visited:
                if has_cycle(state.name):
                    return True
        
        return False
    
    def find_circular_paths(self) -> List[List[str]]:
        """Find all circular paths in workflow."""
        cycles = []
        
        def find_cycles_from(start: str, current: str, path: List[str]):
            if current == start and len(path) > 1:
                cycles.append(path + [start])
                return
            
            if current in path[:-1]:  # Already visited
                return
            
            for next_state in self._transition_graph.get(current, []):
                find_cycles_from(start, next_state, path + [next_state])
        
        for state in self.states:
            find_cycles_from(state.name, state.name, [state.name])
        
        # Remove duplicate cycles
        unique_cycles = []
        for cycle in cycles:
            if cycle not in unique_cycles and cycle[::-1] not in unique_cycles:
                unique_cycles.append(cycle)
        
        return unique_cycles


class WorkflowInstance:
    """Instance of a workflow execution."""
    
    def __init__(
        self,
        workflow_definition_id: int,
        entity_type: str,
        entity_id: int,
        current_state: str,
        tenant_id: Optional[int] = None,
        initiated_by: Optional[int] = None,
        data: Dict[str, Any] = None,
        status: WorkflowStatus = WorkflowStatus.ACTIVE
    ):
        self.id = None  # Set when saved to database
        self.workflow_definition_id = workflow_definition_id
        self.workflow_definition = None  # Loaded separately
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.current_state = current_state
        self.tenant_id = tenant_id
        self.initiated_by = initiated_by
        self.data = data or {}
        self.status = status
        self.started_at = datetime.now()
        self.completed_at = None
        self.history = []
        self.tasks = []
    
    def update_data(self, new_data: Dict[str, Any]):
        """Update instance data."""
        self.data.update(new_data)
    
    def add_history(
        self,
        from_state: str,
        to_state: str,
        transition: str,
        performed_by: int,
        comments: Optional[str] = None
    ):
        """Add entry to transition history."""
        self.history.append({
            "from_state": from_state,
            "to_state": to_state,
            "transition": transition,
            "performed_by": performed_by,
            "comments": comments,
            "timestamp": datetime.now().isoformat()
        })
    
    def get_history(self) -> List[Dict[str, Any]]:
        """Get transition history."""
        return self.history


class WorkflowEngine:
    """Core workflow execution engine."""
    
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
    
    async def execute_transition(
        self,
        instance: WorkflowInstance,
        transition_name: str,
        user_id: int,
        comments: Optional[str] = None,
        data: Dict[str, Any] = None
    ) -> TransitionResult:
        """Execute a workflow transition."""
        # Get transition definition
        transition = instance.workflow_definition.get_transition(transition_name)
        if not transition:
            return TransitionResult(
                success=False,
                message=f"Transition '{transition_name}' not found"
            )
        
        # Validate current state
        if instance.current_state != transition.from_state:
            return TransitionResult(
                success=False,
                message=f"Invalid transition from state '{instance.current_state}'"
            )
        
        # Evaluate conditions
        if transition.conditions:
            conditions_met = await self.evaluate_conditions(
                transition.conditions,
                instance.data,
                []  # User roles would be fetched here
            )
            if not conditions_met:
                return TransitionResult(
                    success=False,
                    message="Transition conditions not met"
                )
        
        # Check if comment is required
        if transition.requires_comment and not comments:
            return TransitionResult(
                success=False,
                message="Comment is required for this transition"
            )
        
        # Update instance data if provided
        if data:
            instance.update_data(data)
        
        # Execute transition
        old_state = instance.current_state
        instance.current_state = transition.to_state
        
        # Add to history
        instance.add_history(
            from_state=old_state,
            to_state=transition.to_state,
            transition=transition_name,
            performed_by=user_id,
            comments=comments
        )
        
        # Check if workflow is complete
        final_states = instance.workflow_definition.get_final_states()
        if any(state.name == instance.current_state for state in final_states):
            instance.status = WorkflowStatus.COMPLETED
            instance.completed_at = datetime.now()
        
        return TransitionResult(
            success=True,
            new_state=instance.current_state,
            message="Transition completed successfully"
        )
    
    async def evaluate_conditions(
        self,
        conditions: List[TransitionCondition],
        instance_data: Dict[str, Any],
        user_roles: List[str]
    ) -> bool:
        """Evaluate transition conditions."""
        for condition in conditions:
            if condition.type == "field_required":
                if condition.field not in instance_data or not instance_data[condition.field]:
                    return False
            
            elif condition.type == "field_value":
                field_value = instance_data.get(condition.field)
                if field_value is None:
                    return False
                
                if condition.operator == "equals":
                    if field_value != condition.value:
                        return False
                elif condition.operator == "greater_than":
                    if field_value <= condition.value:
                        return False
                elif condition.operator == "less_than":
                    if field_value >= condition.value:
                        return False
                elif condition.operator == "contains":
                    if condition.value not in field_value:
                        return False
            
            elif condition.type == "user_role":
                if condition.value not in user_roles:
                    return False
            
            elif condition.type == "custom":
                # Custom conditions would be evaluated here
                pass
        
        return True
    
    async def create_parallel_tasks(
        self,
        instance: WorkflowInstance,
        tasks: List[WorkflowTask]
    ) -> List[WorkflowTask]:
        """Create parallel tasks for workflow instance."""
        created_tasks = []
        
        for task in tasks:
            task.status = TaskStatus.PENDING
            created_tasks.append(task)
            instance.tasks.append(task)
        
        return created_tasks
    
    async def send_notifications(
        self,
        event: str,
        instance: WorkflowInstance,
        notification_config: List[WorkflowNotification],
        **kwargs
    ) -> NotificationResult:
        """Send workflow notifications."""
        result = NotificationResult(sent_count=0)
        
        for config in notification_config:
            if config.event != event:
                continue
            
            # Check state conditions if specified
            if config.from_state and kwargs.get("from_state") != config.from_state:
                continue
            if config.to_state and kwargs.get("to_state") != config.to_state:
                continue
            
            # Send to recipients through specified channels
            for recipient in config.recipients:
                for channel in config.channels:
                    try:
                        # Actual notification sending would happen here
                        result.sent_count += 1
                        if channel not in result.channels_used:
                            result.channels_used.append(channel)
                    except Exception as e:
                        result.failed_count += 1
                        result.errors.append(str(e))
        
        return result
    
    async def calculate_deadline(
        self,
        start_time: datetime,
        state: str,
        sla_config: Dict[str, Any]
    ) -> datetime:
        """Calculate deadline based on SLA configuration."""
        state_config = sla_config.get("state_deadlines", {}).get(state, {})
        
        if "hours" in state_config:
            hours = state_config["hours"]
            business_days_only = state_config.get("business_days_only", False)
            
            if business_days_only:
                # Calculate business hours
                deadline = start_time
                hours_remaining = hours
                
                while hours_remaining > 0:
                    deadline += timedelta(hours=1)
                    # Skip weekends
                    if deadline.weekday() < 5:  # Monday = 0, Friday = 4
                        hours_remaining -= 1
                
                return deadline
            else:
                return start_time + timedelta(hours=hours)
        
        elif "days" in state_config:
            days = state_config["days"]
            return start_time + timedelta(days=days)
        
        # Default to overall deadline if no state-specific deadline
        overall_days = sla_config.get("overall_deadline_days", 30)
        return start_time + timedelta(days=overall_days)
    
    async def check_escalations(
        self,
        instance: WorkflowInstance,
        escalation_rules: List[Dict[str, Any]]
    ) -> Any:
        """Check and execute escalation rules."""
        class EscalationResult:
            def __init__(self):
                self.escalated = False
                self.actions_taken = []
                self.new_state = None
        
        result = EscalationResult()
        
        for rule in escalation_rules:
            if rule["trigger"] == "deadline_breach":
                if hasattr(instance, 'deadline') and instance.deadline < datetime.now():
                    result.escalated = True
                    result.actions_taken.append(rule["action"])
                    if "auto_transition" in rule:
                        result.new_state = rule["auto_transition"]
            
            elif rule["trigger"] == "multiple_rejections":
                if hasattr(instance, 'rejection_count'):
                    threshold = rule.get("threshold", 3)
                    if instance.rejection_count >= threshold:
                        result.escalated = True
                        result.actions_taken.append(rule["action"])
        
        return result


class WorkflowExecutor:
    """Executor for workflow tasks and assignments."""
    
    async def get_users_by_role(self, role: str) -> List[Any]:
        """Get users by role name."""
        # This would query the database for users with the role
        return []
    
    async def assign_task(self, task: WorkflowTask) -> List[Any]:
        """Assign task to users based on assignment rules."""
        assigned_users = []
        
        if task.assignee_type == "role":
            assigned_users = await self.get_users_by_role(task.assignee_value)
        elif task.assignee_type == "user":
            # Direct user assignment
            pass
        elif task.assignee_type == "group":
            # Group assignment
            pass
        
        return assigned_users
    
    async def complete_task(
        self,
        task: WorkflowTask,
        user_id: int,
        action: str,
        comments: Optional[str] = None
    ) -> Any:
        """Complete a workflow task."""
        class TaskResult:
            def __init__(self):
                self.success = True
                self.action = action
        
        task.status = TaskStatus.COMPLETED
        task.completed_by = user_id
        task.completed_at = datetime.now()
        task.comments = comments
        
        return TaskResult()


class WorkflowAnalytics:
    """Analytics and reporting for workflows."""
    
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
    
    async def calculate_metrics(self, instances: List[WorkflowInstance]) -> Dict[str, Any]:
        """Calculate workflow metrics."""
        total = len(instances)
        completed = sum(1 for i in instances if i.status == WorkflowStatus.COMPLETED)
        active = sum(1 for i in instances if i.status == WorkflowStatus.ACTIVE)
        
        # Calculate average completion time
        completion_times = []
        approved_count = 0
        
        for instance in instances:
            if instance.status == WorkflowStatus.COMPLETED:
                if hasattr(instance, 'completed_at') and hasattr(instance, 'created_at'):
                    duration = (instance.completed_at - instance.created_at).days
                    completion_times.append(duration)
                
                if instance.current_state == "approved":
                    approved_count += 1
        
        avg_completion = sum(completion_times) / len(completion_times) if completion_times else 0
        approval_rate = approved_count / completed if completed > 0 else 0
        
        return {
            "total_instances": total,
            "completed_instances": completed,
            "active_instances": active,
            "average_completion_time_days": avg_completion,
            "approval_rate": approval_rate
        }
    
    async def identify_bottlenecks(
        self,
        state_durations: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Identify workflow bottlenecks."""
        bottlenecks = []
        
        # Calculate average duration across all states
        total_duration = sum(s["average_hours"] for s in state_durations.values())
        avg_duration = total_duration / len(state_durations) if state_durations else 0
        
        # Identify states that take significantly longer
        for state, data in state_durations.items():
            if data["average_hours"] > avg_duration * 1.5:  # 50% above average
                bottlenecks.append({
                    "state": state,
                    "average_hours": data["average_hours"],
                    "instances": data["instances"],
                    "severity": "high" if data["average_hours"] > avg_duration * 2 else "medium"
                })
        
        # Sort by average hours descending
        bottlenecks.sort(key=lambda x: x["average_hours"], reverse=True)
        
        return bottlenecks