"""
Tests for workflow engine and execution system.
Following TDD methodology - tests written before implementation.
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, Any, List
from unittest.mock import Mock, AsyncMock, patch
import json

from app.services.workflow import (
    WorkflowEngine,
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowState,
    WorkflowTransition,
    WorkflowTask,
    WorkflowParticipant,
    WorkflowNotification,
    WorkflowStatus,
    TaskStatus,
    TransitionCondition,
    WorkflowExecutor
)
from app.models.user import User
from app.models.contract import Contract


class TestWorkflowDefinition:
    """Test workflow definition and template management."""
    
    def test_create_workflow_definition(self):
        """Test creating a workflow definition."""
        definition = WorkflowDefinition(
            name="Contract Approval Workflow",
            description="Standard contract approval process",
            version="1.0",
            tenant_id=1,
            created_by=1
        )
        
        assert definition.name == "Contract Approval Workflow"
        assert definition.version == "1.0"
        assert definition.is_active is True
        assert definition.is_template is False
    
    def test_workflow_definition_with_states(self):
        """Test workflow definition with multiple states."""
        states = [
            WorkflowState(
                name="draft",
                display_name="Draft",
                is_initial=True,
                is_final=False,
                metadata={"editable": True}
            ),
            WorkflowState(
                name="review",
                display_name="Under Review",
                is_initial=False,
                is_final=False,
                metadata={"requires_comments": True}
            ),
            WorkflowState(
                name="approved",
                display_name="Approved",
                is_initial=False,
                is_final=True,
                metadata={"send_notification": True}
            ),
            WorkflowState(
                name="rejected",
                display_name="Rejected",
                is_initial=False,
                is_final=True,
                metadata={"requires_reason": True}
            )
        ]
        
        definition = WorkflowDefinition(
            name="Approval Workflow",
            states=states
        )
        
        assert len(definition.states) == 4
        assert definition.get_initial_state().name == "draft"
        assert len(definition.get_final_states()) == 2
        assert definition.get_state("review").metadata["requires_comments"] is True
    
    def test_workflow_transitions(self):
        """Test workflow state transitions."""
        transitions = [
            WorkflowTransition(
                name="submit_for_review",
                from_state="draft",
                to_state="review",
                display_name="Submit for Review",
                conditions=[
                    TransitionCondition(
                        type="field_required",
                        field="contract_value",
                        operator="exists"
                    )
                ]
            ),
            WorkflowTransition(
                name="approve",
                from_state="review",
                to_state="approved",
                display_name="Approve",
                permissions=["contracts.approve"]
            ),
            WorkflowTransition(
                name="reject",
                from_state="review",
                to_state="rejected",
                display_name="Reject",
                permissions=["contracts.approve"],
                requires_comment=True
            ),
            WorkflowTransition(
                name="send_back",
                from_state="review",
                to_state="draft",
                display_name="Send Back for Revision"
            )
        ]
        
        definition = WorkflowDefinition(
            name="Contract Workflow",
            transitions=transitions
        )
        
        assert len(definition.transitions) == 4
        assert definition.can_transition("draft", "review") is True
        assert definition.can_transition("draft", "approved") is False
        assert definition.get_available_transitions("review") == ["approve", "reject", "send_back"]
    
    def test_workflow_participants(self):
        """Test workflow participant assignment."""
        participants = [
            WorkflowParticipant(
                role="initiator",
                type="user",
                assignment_type="dynamic",
                assignment_rule="contract.created_by"
            ),
            WorkflowParticipant(
                role="reviewer",
                type="role",
                assignment_type="static",
                assignment_value="contract_reviewer"
            ),
            WorkflowParticipant(
                role="approver",
                type="group",
                assignment_type="conditional",
                assignment_rule="contract.value > 100000 ? 'senior_management' : 'management'"
            )
        ]
        
        definition = WorkflowDefinition(
            name="Approval Workflow",
            participants=participants
        )
        
        assert len(definition.participants) == 3
        assert definition.get_participant("reviewer").type == "role"
        assert definition.get_participant("approver").assignment_type == "conditional"
    
    def test_workflow_sla_configuration(self):
        """Test workflow SLA and deadline configuration."""
        definition = WorkflowDefinition(
            name="Contract Workflow",
            sla_configuration={
                "overall_deadline_days": 14,
                "state_deadlines": {
                    "draft": {"days": 3, "business_days_only": True},
                    "review": {"hours": 48, "escalate_on_breach": True}
                },
                "escalation_rules": [
                    {
                        "trigger": "deadline_approaching",
                        "threshold_hours": 24,
                        "notify": ["manager", "initiator"]
                    }
                ]
            }
        )
        
        assert definition.sla_configuration["overall_deadline_days"] == 14
        assert definition.sla_configuration["state_deadlines"]["review"]["hours"] == 48
        assert len(definition.sla_configuration["escalation_rules"]) == 1


class TestWorkflowInstance:
    """Test workflow instance execution."""
    
    @pytest.mark.asyncio
    async def test_create_workflow_instance(self):
        """Test creating a workflow instance from definition."""
        definition = Mock(
            id=1,
            name="Contract Approval",
            get_initial_state=Mock(return_value=WorkflowState(name="draft"))
        )
        
        instance = WorkflowInstance(
            workflow_definition_id=definition.id,
            entity_type="contract",
            entity_id=123,
            current_state="draft",
            tenant_id=1,
            initiated_by=1
        )
        
        assert instance.workflow_definition_id == 1
        assert instance.entity_type == "contract"
        assert instance.entity_id == 123
        assert instance.current_state == "draft"
        assert instance.status == WorkflowStatus.ACTIVE
    
    @pytest.mark.asyncio
    async def test_workflow_instance_data(self):
        """Test workflow instance data storage."""
        instance = WorkflowInstance(
            workflow_definition_id=1,
            entity_type="contract",
            entity_id=123,
            data={
                "contract_value": 150000,
                "contract_type": "service_agreement",
                "parties": ["Company A", "Company B"]
            }
        )
        
        assert instance.data["contract_value"] == 150000
        assert len(instance.data["parties"]) == 2
        
        # Test data update
        instance.update_data({"approval_notes": "Approved with conditions"})
        assert instance.data["approval_notes"] == "Approved with conditions"
        assert instance.data["contract_value"] == 150000  # Original data preserved
    
    @pytest.mark.asyncio
    async def test_workflow_instance_history(self):
        """Test workflow instance transition history."""
        instance = WorkflowInstance(
            workflow_definition_id=1,
            entity_type="contract",
            entity_id=123,
            current_state="draft"
        )
        
        # Add transition history
        instance.add_history(
            from_state="draft",
            to_state="review",
            transition="submit_for_review",
            performed_by=1,
            comments="Ready for review"
        )
        
        instance.add_history(
            from_state="review",
            to_state="approved",
            transition="approve",
            performed_by=2,
            comments="Looks good"
        )
        
        history = instance.get_history()
        assert len(history) == 2
        assert history[0]["from_state"] == "draft"
        assert history[1]["to_state"] == "approved"
        assert history[1]["performed_by"] == 2


class TestWorkflowEngine:
    """Test workflow engine core functionality."""
    
    @pytest.mark.asyncio
    async def test_engine_initialization(self, test_db_session):
        """Test workflow engine initialization."""
        engine = WorkflowEngine(db_session=test_db_session)
        
        assert engine is not None
        assert engine.db_session == test_db_session
        assert hasattr(engine, 'execute_transition')
        assert hasattr(engine, 'evaluate_conditions')
    
    @pytest.mark.asyncio
    async def test_execute_simple_transition(self, test_db_session):
        """Test executing a simple workflow transition."""
        engine = WorkflowEngine(db_session=test_db_session)
        
        # Mock workflow definition
        definition = Mock(
            get_transition=Mock(return_value=WorkflowTransition(
                name="submit",
                from_state="draft",
                to_state="review",
                conditions=[]
            ))
        )
        
        # Mock workflow instance
        instance = Mock(
            current_state="draft",
            workflow_definition=definition,
            data={}
        )
        
        # Execute transition
        result = await engine.execute_transition(
            instance=instance,
            transition_name="submit",
            user_id=1,
            comments="Submitting for review"
        )
        
        assert result.success is True
        assert result.new_state == "review"
        assert result.message == "Transition completed successfully"
    
    @pytest.mark.asyncio
    async def test_transition_with_conditions(self, test_db_session):
        """Test transition with conditions."""
        engine = WorkflowEngine(db_session=test_db_session)
        
        # Create transition with conditions
        transition = WorkflowTransition(
            name="approve",
            from_state="review",
            to_state="approved",
            conditions=[
                TransitionCondition(
                    type="field_value",
                    field="contract_value",
                    operator="less_than",
                    value=1000000
                ),
                TransitionCondition(
                    type="user_role",
                    value="approver"
                )
            ]
        )
        
        # Test with valid conditions
        instance_data = {"contract_value": 500000}
        user_roles = ["approver", "manager"]
        
        result = await engine.evaluate_conditions(
            transition.conditions,
            instance_data,
            user_roles
        )
        
        assert result is True
        
        # Test with invalid conditions
        instance_data = {"contract_value": 2000000}
        result = await engine.evaluate_conditions(
            transition.conditions,
            instance_data,
            user_roles
        )
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_parallel_workflow_execution(self, test_db_session):
        """Test parallel workflow task execution."""
        engine = WorkflowEngine(db_session=test_db_session)
        
        # Create parallel tasks
        tasks = [
            WorkflowTask(
                name="legal_review",
                type="approval",
                assignee_type="role",
                assignee_value="legal_team",
                parallel=True
            ),
            WorkflowTask(
                name="financial_review",
                type="approval",
                assignee_type="role",
                assignee_value="finance_team",
                parallel=True
            ),
            WorkflowTask(
                name="technical_review",
                type="approval",
                assignee_type="role",
                assignee_value="tech_team",
                parallel=True
            )
        ]
        
        instance = Mock(
            id=1,
            current_state="review",
            tasks=[]
        )
        
        # Execute parallel tasks
        result = await engine.create_parallel_tasks(instance, tasks)
        
        assert len(result) == 3
        assert all(task.status == TaskStatus.PENDING for task in result)
        assert all(task.parallel is True for task in result)
    
    @pytest.mark.asyncio
    async def test_workflow_notifications(self, test_db_session):
        """Test workflow notification system."""
        engine = WorkflowEngine(db_session=test_db_session)
        
        notification_config = [
            WorkflowNotification(
                event="state_change",
                from_state="draft",
                to_state="review",
                recipients=["reviewer", "initiator"],
                template="workflow_state_change",
                channels=["email", "in_app"]
            ),
            WorkflowNotification(
                event="deadline_approaching",
                recipients=["assignee", "manager"],
                template="deadline_warning",
                channels=["email"]
            )
        ]
        
        # Test state change notification
        result = await engine.send_notifications(
            event="state_change",
            instance=Mock(id=1, current_state="review"),
            from_state="draft",
            to_state="review",
            notification_config=notification_config
        )
        
        assert result.sent_count == 2
        assert "email" in result.channels_used
        assert "in_app" in result.channels_used
    
    @pytest.mark.asyncio
    async def test_workflow_deadline_calculation(self, test_db_session):
        """Test workflow deadline calculation."""
        engine = WorkflowEngine(db_session=test_db_session)
        
        sla_config = {
            "overall_deadline_days": 7,
            "state_deadlines": {
                "review": {"hours": 48, "business_days_only": True}
            }
        }
        
        # Calculate deadline for state
        start_time = datetime.now()
        deadline = await engine.calculate_deadline(
            start_time=start_time,
            state="review",
            sla_config=sla_config
        )
        
        # Should be 48 business hours from start
        assert deadline > start_time
        assert deadline <= start_time + timedelta(days=4)  # Account for weekend
    
    @pytest.mark.asyncio
    async def test_workflow_escalation(self, test_db_session):
        """Test workflow escalation rules."""
        engine = WorkflowEngine(db_session=test_db_session)
        
        escalation_rules = [
            {
                "trigger": "deadline_breach",
                "action": "notify_manager",
                "auto_transition": "escalated"
            },
            {
                "trigger": "multiple_rejections",
                "threshold": 3,
                "action": "notify_senior_management"
            }
        ]
        
        instance = Mock(
            id=1,
            current_state="review",
            deadline=datetime.now() - timedelta(hours=1),  # Breached
            rejection_count=0
        )
        
        # Test deadline breach escalation
        result = await engine.check_escalations(instance, escalation_rules)
        
        assert result.escalated is True
        assert result.actions_taken == ["notify_manager"]
        assert result.new_state == "escalated"


class TestWorkflowExecutor:
    """Test workflow executor for async task processing."""
    
    @pytest.mark.asyncio
    async def test_executor_task_assignment(self):
        """Test task assignment to users."""
        executor = WorkflowExecutor()
        
        task = WorkflowTask(
            name="review_contract",
            assignee_type="role",
            assignee_value="contract_reviewer"
        )
        
        # Mock role to user mapping
        with patch.object(executor, 'get_users_by_role') as mock_get_users:
            mock_get_users.return_value = [
                Mock(id=1, email="reviewer1@example.com"),
                Mock(id=2, email="reviewer2@example.com")
            ]
            
            assigned_users = await executor.assign_task(task)
            
            assert len(assigned_users) == 2
            assert assigned_users[0].email == "reviewer1@example.com"
    
    @pytest.mark.asyncio
    async def test_executor_task_completion(self):
        """Test task completion handling."""
        executor = WorkflowExecutor()
        
        task = Mock(
            id=1,
            name="approve_contract",
            status=TaskStatus.PENDING,
            requires_all_approvals=False
        )
        
        result = await executor.complete_task(
            task=task,
            user_id=1,
            action="approve",
            comments="Approved with no issues"
        )
        
        assert result.success is True
        assert task.status == TaskStatus.COMPLETED
        assert result.action == "approve"
    
    @pytest.mark.asyncio
    async def test_executor_celery_integration(self):
        """Test Celery task integration for async processing."""
        from app.tasks.workflow import process_workflow_transition
        
        with patch('app.tasks.workflow.process_workflow_transition.delay') as mock_task:
            mock_task.return_value.id = "task-123"
            
            task_id = process_workflow_transition.delay(
                instance_id=1,
                transition_name="approve",
                user_id=1
            )
            
            assert task_id.id == "task-123"
            mock_task.assert_called_once_with(
                instance_id=1,
                transition_name="approve",
                user_id=1
            )


class TestWorkflowValidation:
    """Test workflow validation and error handling."""
    
    def test_validate_workflow_definition(self):
        """Test workflow definition validation."""
        # Valid definition
        valid_def = WorkflowDefinition(
            name="Test Workflow",
            states=[
                WorkflowState(name="start", is_initial=True),
                WorkflowState(name="end", is_final=True)
            ],
            transitions=[
                WorkflowTransition(
                    name="complete",
                    from_state="start",
                    to_state="end"
                )
            ]
        )
        
        assert valid_def.validate() is True
        
        # Invalid definition - no initial state
        invalid_def = WorkflowDefinition(
            name="Invalid Workflow",
            states=[
                WorkflowState(name="state1", is_initial=False),
                WorkflowState(name="state2", is_final=True)
            ]
        )
        
        with pytest.raises(ValueError, match="No initial state defined"):
            invalid_def.validate()
    
    def test_validate_transition_permissions(self):
        """Test transition permission validation."""
        transition = WorkflowTransition(
            name="approve",
            from_state="review",
            to_state="approved",
            permissions=["contracts.approve", "workflow.admin"]
        )
        
        # User with required permissions
        user_permissions = ["contracts.approve", "contracts.view"]
        assert transition.user_has_permission(user_permissions) is True
        
        # User without required permissions
        user_permissions = ["contracts.view", "contracts.edit"]
        assert transition.user_has_permission(user_permissions) is False
        
        # Admin override
        user_permissions = ["workflow.admin"]
        assert transition.user_has_permission(user_permissions) is True
    
    def test_circular_transition_detection(self):
        """Test detection of circular transitions."""
        definition = WorkflowDefinition(
            name="Test Workflow",
            transitions=[
                WorkflowTransition(name="t1", from_state="a", to_state="b"),
                WorkflowTransition(name="t2", from_state="b", to_state="c"),
                WorkflowTransition(name="t3", from_state="c", to_state="a")  # Creates circle
            ]
        )
        
        assert definition.has_circular_transitions() is True
        assert definition.find_circular_paths() == [["a", "b", "c", "a"]]


class TestWorkflowReporting:
    """Test workflow reporting and analytics."""
    
    @pytest.mark.asyncio
    async def test_workflow_metrics(self, test_db_session):
        """Test workflow metrics calculation."""
        from app.services.workflow import WorkflowAnalytics
        
        analytics = WorkflowAnalytics(db_session=test_db_session)
        
        # Mock workflow instances
        instances = [
            Mock(
                status=WorkflowStatus.COMPLETED,
                created_at=datetime.now() - timedelta(days=5),
                completed_at=datetime.now() - timedelta(days=2),
                current_state="approved"
            ),
            Mock(
                status=WorkflowStatus.ACTIVE,
                created_at=datetime.now() - timedelta(days=3),
                current_state="review"
            ),
            Mock(
                status=WorkflowStatus.COMPLETED,
                created_at=datetime.now() - timedelta(days=7),
                completed_at=datetime.now() - timedelta(days=6),
                current_state="rejected"
            )
        ]
        
        metrics = await analytics.calculate_metrics(instances)
        
        assert metrics["total_instances"] == 3
        assert metrics["completed_instances"] == 2
        assert metrics["active_instances"] == 1
        assert metrics["average_completion_time_days"] == 2.0
        assert metrics["approval_rate"] == 0.5  # 1 approved out of 2 completed
    
    @pytest.mark.asyncio
    async def test_workflow_bottleneck_detection(self, test_db_session):
        """Test detection of workflow bottlenecks."""
        from app.services.workflow import WorkflowAnalytics
        
        analytics = WorkflowAnalytics(db_session=test_db_session)
        
        # Mock state durations
        state_durations = {
            "draft": {"average_hours": 24, "instances": 100},
            "review": {"average_hours": 120, "instances": 95},  # Bottleneck
            "legal_review": {"average_hours": 48, "instances": 90},
            "approved": {"average_hours": 0, "instances": 85}
        }
        
        bottlenecks = await analytics.identify_bottlenecks(state_durations)
        
        assert len(bottlenecks) > 0
        assert bottlenecks[0]["state"] == "review"
        assert bottlenecks[0]["average_hours"] == 120
        assert bottlenecks[0]["severity"] == "high"