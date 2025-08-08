"""
Workflow management API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.database import get_async_session
from app.core.rbac import require_permission
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.workflow import (
    WorkflowDefinition as WorkflowDefinitionModel,
    WorkflowInstance as WorkflowInstanceModel,
    WorkflowTask as WorkflowTaskModel,
    WorkflowTransitionLog,
    WorkflowTemplate
)
from app.schemas.workflow import (
    WorkflowDefinitionCreate,
    WorkflowDefinitionUpdate,
    WorkflowDefinitionResponse,
    WorkflowInstanceCreate,
    WorkflowInstanceUpdate,
    WorkflowInstanceResponse,
    WorkflowTransitionRequest,
    WorkflowTransitionResponse,
    WorkflowTaskCreate,
    WorkflowTaskUpdate,
    WorkflowTaskResponse,
    WorkflowTaskCompleteRequest,
    WorkflowTemplateResponse,
    WorkflowStatisticsResponse
)
from app.services.workflow import WorkflowEngine, WorkflowAnalytics

router = APIRouter()


# Workflow Definition Endpoints

@router.post("/definitions", response_model=WorkflowDefinitionResponse)
@require_permission("workflows.create")
async def create_workflow_definition(
    definition: WorkflowDefinitionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new workflow definition."""
    # Create database model
    db_definition = WorkflowDefinitionModel(
        name=definition.name,
        description=definition.description,
        version=definition.version,
        states=[s.model_dump() for s in definition.states],
        transitions=[t.model_dump() for t in definition.transitions],
        participants=[p.model_dump() for p in definition.participants],
        notifications=[n.model_dump() for n in definition.notifications],
        sla_configuration=definition.sla_configuration.model_dump() if definition.sla_configuration else {},
        is_template=definition.is_template,
        category=definition.category,
        tags=definition.tags,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id
    )
    
    db.add(db_definition)
    await db.commit()
    await db.refresh(db_definition)
    
    return db_definition


@router.get("/definitions", response_model=List[WorkflowDefinitionResponse])
@require_permission("workflows.read")
async def list_workflow_definitions(
    is_active: Optional[bool] = Query(default=True),
    is_template: Optional[bool] = Query(default=None),
    category: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List workflow definitions."""
    query = select(WorkflowDefinitionModel).where(
        WorkflowDefinitionModel.tenant_id == current_user.tenant_id
    )
    
    if is_active is not None:
        query = query.where(WorkflowDefinitionModel.is_active == is_active)
    
    if is_template is not None:
        query = query.where(WorkflowDefinitionModel.is_template == is_template)
    
    if category:
        query = query.where(WorkflowDefinitionModel.category == category)
    
    result = await db.execute(query)
    definitions = result.scalars().all()
    
    return definitions


@router.get("/definitions/{definition_id}", response_model=WorkflowDefinitionResponse)
@require_permission("workflows.read")
async def get_workflow_definition(
    definition_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific workflow definition."""
    result = await db.execute(
        select(WorkflowDefinitionModel).where(
            and_(
                WorkflowDefinitionModel.id == definition_id,
                WorkflowDefinitionModel.tenant_id == current_user.tenant_id
            )
        )
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow definition not found"
        )
    
    return definition


@router.patch("/definitions/{definition_id}", response_model=WorkflowDefinitionResponse)
@require_permission("workflows.update")
async def update_workflow_definition(
    definition_id: int,
    update_data: WorkflowDefinitionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a workflow definition."""
    result = await db.execute(
        select(WorkflowDefinitionModel).where(
            and_(
                WorkflowDefinitionModel.id == definition_id,
                WorkflowDefinitionModel.tenant_id == current_user.tenant_id
            )
        )
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow definition not found"
        )
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if field in ["states", "transitions", "participants", "notifications"]:
            # Convert pydantic models to dicts
            if value is not None:
                value = [item.model_dump() if hasattr(item, 'model_dump') else item for item in value]
        elif field == "sla_configuration" and value is not None:
            value = value.model_dump() if hasattr(value, 'model_dump') else value
        
        setattr(definition, field, value)
    
    await db.commit()
    await db.refresh(definition)
    
    return definition


# Workflow Instance Endpoints

@router.post("/instances", response_model=WorkflowInstanceResponse)
@require_permission("workflows.execute")
async def create_workflow_instance(
    instance_data: WorkflowInstanceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create and start a new workflow instance."""
    # Get workflow definition
    result = await db.execute(
        select(WorkflowDefinitionModel).where(
            and_(
                WorkflowDefinitionModel.id == instance_data.workflow_definition_id,
                WorkflowDefinitionModel.tenant_id == current_user.tenant_id,
                WorkflowDefinitionModel.is_active == True
            )
        )
    )
    definition = result.scalar_one_or_none()
    
    if not definition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow definition not found or inactive"
        )
    
    # Find initial state
    initial_state = None
    for state in definition.states:
        if state.get("is_initial", False):
            initial_state = state["name"]
            break
    
    if not initial_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workflow definition has no initial state"
        )
    
    # Create instance
    db_instance = WorkflowInstanceModel(
        workflow_definition_id=definition.id,
        entity_type=instance_data.entity_type,
        entity_id=instance_data.entity_id,
        current_state=initial_state,
        data=instance_data.data,
        context=instance_data.context,
        tenant_id=current_user.tenant_id,
        initiated_by=current_user.id,
        deadline=instance_data.deadline
    )
    
    db.add(db_instance)
    await db.commit()
    await db.refresh(db_instance)
    
    return db_instance


@router.get("/instances", response_model=List[WorkflowInstanceResponse])
@require_permission("workflows.read")
async def list_workflow_instances(
    entity_type: Optional[str] = Query(default=None),
    entity_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List workflow instances."""
    query = select(WorkflowInstanceModel).where(
        WorkflowInstanceModel.tenant_id == current_user.tenant_id
    )
    
    if entity_type:
        query = query.where(WorkflowInstanceModel.entity_type == entity_type)
    
    if entity_id is not None:
        query = query.where(WorkflowInstanceModel.entity_id == entity_id)
    
    if status:
        query = query.where(WorkflowInstanceModel.status == status)
    
    result = await db.execute(query)
    instances = result.scalars().all()
    
    return instances


@router.get("/instances/{instance_id}", response_model=WorkflowInstanceResponse)
@require_permission("workflows.read")
async def get_workflow_instance(
    instance_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific workflow instance."""
    result = await db.execute(
        select(WorkflowInstanceModel).where(
            and_(
                WorkflowInstanceModel.id == instance_id,
                WorkflowInstanceModel.tenant_id == current_user.tenant_id
            )
        )
    )
    instance = result.scalar_one_or_none()
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow instance not found"
        )
    
    return instance


@router.post("/instances/{instance_id}/transition", response_model=WorkflowTransitionResponse)
@require_permission("workflows.execute")
async def execute_workflow_transition(
    instance_id: int,
    transition: WorkflowTransitionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Execute a workflow transition."""
    # Get instance with definition
    result = await db.execute(
        select(WorkflowInstanceModel).where(
            and_(
                WorkflowInstanceModel.id == instance_id,
                WorkflowInstanceModel.tenant_id == current_user.tenant_id
            )
        )
    )
    instance = result.scalar_one_or_none()
    
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow instance not found"
        )
    
    # Load definition
    await db.refresh(instance, ["definition"])
    
    # Create workflow engine
    engine = WorkflowEngine(db_session=db)
    
    # Convert DB model to service model for processing
    from app.services.workflow import WorkflowInstance, WorkflowDefinition
    
    # Create service definition
    service_definition = WorkflowDefinition(
        name=instance.definition.name,
        states=[],  # Would be populated from instance.definition.states
        transitions=[]  # Would be populated from instance.definition.transitions
    )
    
    # Create service instance
    service_instance = WorkflowInstance(
        workflow_definition_id=instance.workflow_definition_id,
        entity_type=instance.entity_type,
        entity_id=instance.entity_id,
        current_state=instance.current_state,
        data=instance.data
    )
    service_instance.workflow_definition = service_definition
    
    # Execute transition
    result = await engine.execute_transition(
        instance=service_instance,
        transition_name=transition.transition_name,
        user_id=current_user.id,
        comments=transition.comments,
        data=transition.data
    )
    
    if result.success:
        # Update database instance
        instance.current_state = result.new_state
        instance.previous_state = instance.current_state
        instance.data.update(transition.data)
        
        # Add to history
        if not instance.history:
            instance.history = []
        instance.history.append({
            "from_state": instance.previous_state,
            "to_state": result.new_state,
            "transition": transition.transition_name,
            "performed_by": current_user.id,
            "comments": transition.comments,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Create transition log
        log = WorkflowTransitionLog(
            workflow_instance_id=instance_id,
            from_state=instance.previous_state,
            to_state=result.new_state,
            transition_name=transition.transition_name,
            performed_by=current_user.id,
            comments=transition.comments,
            data=transition.data,
            success=True,
            tenant_id=current_user.tenant_id
        )
        db.add(log)
        
        await db.commit()
    
    return result


# Workflow Task Endpoints

@router.get("/instances/{instance_id}/tasks", response_model=List[WorkflowTaskResponse])
@require_permission("workflows.read")
async def list_workflow_tasks(
    instance_id: int,
    status: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List tasks for a workflow instance."""
    query = select(WorkflowTaskModel).where(
        and_(
            WorkflowTaskModel.workflow_instance_id == instance_id,
            WorkflowTaskModel.tenant_id == current_user.tenant_id
        )
    )
    
    if status:
        query = query.where(WorkflowTaskModel.status == status)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    return tasks


@router.post("/tasks/{task_id}/complete", response_model=WorkflowTaskResponse)
@require_permission("workflows.execute")
async def complete_workflow_task(
    task_id: int,
    completion: WorkflowTaskCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Complete a workflow task."""
    result = await db.execute(
        select(WorkflowTaskModel).where(
            and_(
                WorkflowTaskModel.id == task_id,
                WorkflowTaskModel.tenant_id == current_user.tenant_id
            )
        )
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check if task can be completed
    if task.status != "pending" and task.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task cannot be completed from status: {task.status}"
        )
    
    # Update task
    task.status = "completed"
    task.outcome = completion.outcome
    task.comments = completion.comments
    task.data.update(completion.data)
    task.completed_by = current_user.id
    task.completed_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(task)
    
    return task


# Workflow Templates

@router.get("/templates", response_model=List[WorkflowTemplateResponse])
async def list_workflow_templates(
    category: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    db: AsyncSession = Depends(get_async_session)
):
    """List available workflow templates."""
    query = select(WorkflowTemplate).where(
        WorkflowTemplate.is_active == is_active
    )
    
    if category:
        query = query.where(WorkflowTemplate.category == category)
    
    result = await db.execute(query)
    templates = result.scalars().all()
    
    return templates


# Workflow Statistics

@router.get("/statistics", response_model=WorkflowStatisticsResponse)
@require_permission("workflows.read")
async def get_workflow_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get workflow statistics for the tenant."""
    analytics = WorkflowAnalytics(db_session=db)
    
    # Get counts
    definition_count = await db.execute(
        select(func.count(WorkflowDefinitionModel.id)).where(
            and_(
                WorkflowDefinitionModel.tenant_id == current_user.tenant_id,
                WorkflowDefinitionModel.is_active == True
            )
        )
    )
    total_definitions = definition_count.scalar() or 0
    
    instance_count = await db.execute(
        select(
            WorkflowInstanceModel.status,
            func.count(WorkflowInstanceModel.id)
        ).where(
            WorkflowInstanceModel.tenant_id == current_user.tenant_id
        ).group_by(WorkflowInstanceModel.status)
    )
    
    status_counts = {row[0]: row[1] for row in instance_count.fetchall()}
    
    return WorkflowStatisticsResponse(
        total_definitions=total_definitions,
        active_instances=status_counts.get("active", 0),
        completed_instances=status_counts.get("completed", 0),
        average_completion_time_hours=0.0,  # Would be calculated
        sla_breach_rate=0.0,  # Would be calculated
        approval_rate=0.0,  # Would be calculated
        rejection_rate=0.0,  # Would be calculated
        bottlenecks=[]  # Would be analyzed
    )