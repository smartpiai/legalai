"""
Workflow schemas for API validation and serialization.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum


class WorkflowStatusEnum(str, Enum):
    """Workflow status enumeration."""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"
    FAILED = "failed"


class TaskStatusEnum(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    ESCALATED = "escalated"


class StateSchema(BaseModel):
    """Workflow state schema."""
    name: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = Field(None, max_length=255)
    is_initial: bool = False
    is_final: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
    allowed_actions: List[str] = Field(default_factory=list)
    entry_actions: List[str] = Field(default_factory=list)
    exit_actions: List[str] = Field(default_factory=list)


class TransitionConditionSchema(BaseModel):
    """Transition condition schema."""
    type: str = Field(..., description="Condition type: field_required, field_value, user_role, custom")
    field: Optional[str] = None
    operator: Optional[str] = Field(None, description="Operator: exists, equals, greater_than, less_than, contains")
    value: Optional[Any] = None
    error_message: Optional[str] = None


class TransitionSchema(BaseModel):
    """Workflow transition schema."""
    name: str = Field(..., min_length=1, max_length=100)
    from_state: str = Field(..., min_length=1, max_length=100)
    to_state: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = Field(None, max_length=255)
    conditions: List[TransitionConditionSchema] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    requires_comment: bool = False
    auto_execute: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ParticipantSchema(BaseModel):
    """Workflow participant schema."""
    role: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., description="Participant type: user, role, group")
    assignment_type: str = Field(..., description="Assignment type: static, dynamic, conditional")
    assignment_value: Optional[str] = None
    assignment_rule: Optional[str] = None
    notifications: List[str] = Field(default_factory=list)


class NotificationSchema(BaseModel):
    """Workflow notification configuration."""
    event: str = Field(..., description="Event type: state_change, deadline_approaching, task_assigned")
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    recipients: List[str] = Field(default_factory=list)
    template: str = Field(default="default")
    channels: List[str] = Field(default_factory=list, description="Channels: email, in_app, sms")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SLAConfigurationSchema(BaseModel):
    """SLA configuration schema."""
    overall_deadline_days: Optional[int] = Field(None, ge=1)
    state_deadlines: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    escalation_rules: List[Dict[str, Any]] = Field(default_factory=list)


class WorkflowDefinitionCreate(BaseModel):
    """Schema for creating workflow definition."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    version: str = Field(default="1.0", max_length=50)
    states: List[StateSchema]
    transitions: List[TransitionSchema]
    participants: List[ParticipantSchema] = Field(default_factory=list)
    notifications: List[NotificationSchema] = Field(default_factory=list)
    sla_configuration: Optional[SLAConfigurationSchema] = None
    is_template: bool = False
    category: Optional[str] = Field(None, max_length=100)
    tags: List[str] = Field(default_factory=list)
    
    @field_validator('states')
    def validate_states(cls, states):
        """Validate workflow states."""
        initial_count = sum(1 for s in states if s.is_initial)
        if initial_count != 1:
            raise ValueError("Exactly one initial state must be defined")
        
        final_count = sum(1 for s in states if s.is_final)
        if final_count < 1:
            raise ValueError("At least one final state must be defined")
        
        return states


class WorkflowDefinitionUpdate(BaseModel):
    """Schema for updating workflow definition."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    version: Optional[str] = Field(None, max_length=50)
    states: Optional[List[StateSchema]] = None
    transitions: Optional[List[TransitionSchema]] = None
    participants: Optional[List[ParticipantSchema]] = None
    notifications: Optional[List[NotificationSchema]] = None
    sla_configuration: Optional[SLAConfigurationSchema] = None
    is_active: Optional[bool] = None
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None


class WorkflowDefinitionResponse(BaseModel):
    """Workflow definition response schema."""
    id: int
    name: str
    description: Optional[str] = None
    version: str
    states: List[Dict[str, Any]]
    transitions: List[Dict[str, Any]]
    participants: List[Dict[str, Any]]
    notifications: List[Dict[str, Any]]
    sla_configuration: Dict[str, Any]
    is_active: bool
    is_template: bool
    category: Optional[str] = None
    tags: List[str]
    tenant_id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class WorkflowInstanceCreate(BaseModel):
    """Schema for creating workflow instance."""
    workflow_definition_id: int
    entity_type: str = Field(..., min_length=1, max_length=50)
    entity_id: int
    data: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    deadline: Optional[datetime] = None


class WorkflowInstanceUpdate(BaseModel):
    """Schema for updating workflow instance."""
    data: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None
    current_assignee: Optional[int] = None
    deadline: Optional[datetime] = None


class WorkflowInstanceResponse(BaseModel):
    """Workflow instance response schema."""
    id: int
    workflow_definition_id: int
    entity_type: str
    entity_id: int
    current_state: str
    previous_state: Optional[str] = None
    status: WorkflowStatusEnum
    data: Dict[str, Any]
    context: Dict[str, Any]
    history: List[Dict[str, Any]]
    tenant_id: int
    initiated_by: Optional[int] = None
    current_assignee: Optional[int] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    suspended_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    sla_breached: bool
    sla_breach_time: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class WorkflowTransitionRequest(BaseModel):
    """Request to execute workflow transition."""
    transition_name: str = Field(..., min_length=1, max_length=100)
    comments: Optional[str] = Field(None, max_length=1000)
    data: Dict[str, Any] = Field(default_factory=dict)


class WorkflowTransitionResponse(BaseModel):
    """Response from workflow transition."""
    success: bool
    new_state: Optional[str] = None
    message: str
    errors: List[str] = Field(default_factory=list)
    notifications_sent: int = 0


class WorkflowTaskCreate(BaseModel):
    """Schema for creating workflow task."""
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., description="Task type: approval, review, action")
    description: Optional[str] = None
    assignee_type: str = Field(..., description="Assignee type: user, role, group")
    assignee_value: Optional[str] = None
    parallel: bool = False
    required: bool = True
    requires_all_approvals: bool = False
    deadline_hours: Optional[int] = Field(None, ge=1)
    priority: int = Field(default=0, ge=0, le=10)


class WorkflowTaskUpdate(BaseModel):
    """Schema for updating workflow task."""
    assigned_to: Optional[List[int]] = None
    status: Optional[TaskStatusEnum] = None
    priority: Optional[int] = Field(None, ge=0, le=10)
    deadline: Optional[datetime] = None


class WorkflowTaskResponse(BaseModel):
    """Workflow task response schema."""
    id: int
    name: str
    type: str
    description: Optional[str] = None
    workflow_instance_id: int
    assignee_type: Optional[str] = None
    assignee_value: Optional[str] = None
    assigned_to: List[int]
    assigned_at: Optional[datetime] = None
    status: TaskStatusEnum
    priority: int
    parallel: bool
    required: bool
    requires_all_approvals: bool
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[int] = None
    deadline: Optional[datetime] = None
    outcome: Optional[str] = None
    comments: Optional[str] = None
    data: Dict[str, Any]
    
    model_config = ConfigDict(from_attributes=True)


class WorkflowTaskCompleteRequest(BaseModel):
    """Request to complete workflow task."""
    outcome: str = Field(..., description="Task outcome: approved, rejected, completed")
    comments: Optional[str] = Field(None, max_length=1000)
    data: Dict[str, Any] = Field(default_factory=dict)


class WorkflowTemplateResponse(BaseModel):
    """Workflow template response schema."""
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    definition: Dict[str, Any]
    version: str
    is_active: bool
    is_system: bool
    usage_count: int
    last_used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class WorkflowStatisticsResponse(BaseModel):
    """Workflow statistics response."""
    total_definitions: int
    active_instances: int
    completed_instances: int
    average_completion_time_hours: float
    sla_breach_rate: float
    approval_rate: float
    rejection_rate: float
    bottlenecks: List[Dict[str, Any]]
    
    
class WorkflowHistoryResponse(BaseModel):
    """Workflow transition history response."""
    from_state: str
    to_state: str
    transition_name: Optional[str] = None
    performed_by: Optional[int] = None
    performed_at: datetime
    comments: Optional[str] = None
    success: bool
    error_message: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)