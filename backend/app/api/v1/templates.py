"""
Template management API endpoints.
Provides CRUD operations for templates, versioning, and rendering.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.auth import get_current_user
from app.core.permissions import require_permission
from app.models.user import User
from app.services.template import TemplateService, TemplateRenderer, VariableManager
from app.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    TemplateListResponse,
    TemplateSearchRequest,
    TemplateVersionResponse,
    TemplateStatistics,
    TemplateApprovalRequest,
    TemplateCloneRequest,
    RenderRequest,
    RenderResponse,
    ClauseLibraryCreate,
    ClauseLibraryResponse
)
from app.core.exceptions import EntityNotFoundError, ValidationError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/",
    response_model=TemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new template",
    dependencies=[Depends(require_permission("templates:create"))]
)
async def create_template(
    template_data: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TemplateResponse:
    """
    Create a new template with variables and metadata.
    
    - Validates template syntax
    - Creates initial version
    - Sets up approval workflow if required
    - Defines template variables
    """
    try:
        service = TemplateService(db)
        template = await service.create_template(
            template_data,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id
        )
        
        return TemplateResponse.from_orm(template)
        
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create template"
        )


@router.get(
    "/{template_id}",
    response_model=TemplateResponse,
    summary="Get template by ID",
    dependencies=[Depends(require_permission("templates:read"))]
)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TemplateResponse:
    """Get template details including variables and metadata."""
    try:
        service = TemplateService(db)
        template = await service.get_template(
            template_id,
            tenant_id=current_user.tenant_id
        )
        
        return TemplateResponse.from_orm(template)
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )


@router.put(
    "/{template_id}",
    response_model=TemplateResponse,
    summary="Update template",
    dependencies=[Depends(require_permission("templates:update"))]
)
async def update_template(
    template_id: int,
    update_data: TemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TemplateResponse:
    """
    Update template and create new version if content changes.
    
    - Creates version history for content changes
    - Updates metadata and configuration
    - Revalidates template syntax
    """
    try:
        service = TemplateService(db)
        template = await service.update_template(
            template_id,
            update_data,
            user_id=current_user.id
        )
        
        return TemplateResponse.from_orm(template)
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete template",
    dependencies=[Depends(require_permission("templates:delete"))]
)
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Soft delete a template (marks as inactive)."""
    try:
        service = TemplateService(db)
        template = await service.get_template(
            template_id,
            tenant_id=current_user.tenant_id
        )
        
        # Soft delete by marking inactive
        update_data = TemplateUpdate(is_active=False)
        await service.update_template(
            template_id,
            update_data,
            user_id=current_user.id
        )
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )


@router.post(
    "/search",
    response_model=TemplateListResponse,
    summary="Search templates",
    dependencies=[Depends(require_permission("templates:read"))]
)
async def search_templates(
    search_request: TemplateSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TemplateListResponse:
    """
    Search and filter templates.
    
    - Search by name and description
    - Filter by category, tags, status
    - Paginated results
    """
    service = TemplateService(db)
    
    templates = await service.search_templates(
        tenant_id=current_user.tenant_id,
        query=search_request.query,
        category=search_request.category,
        tags=search_request.tags,
        is_active=search_request.is_active,
        page=search_request.page,
        per_page=search_request.per_page
    )
    
    # Convert to response models
    template_responses = [TemplateResponse.from_orm(t) for t in templates]
    
    return TemplateListResponse(
        templates=template_responses,
        total=len(templates),  # In real implementation, get total count
        page=search_request.page,
        per_page=search_request.per_page
    )


@router.get(
    "/{template_id}/versions",
    response_model=List[TemplateVersionResponse],
    summary="Get template version history",
    dependencies=[Depends(require_permission("templates:read"))]
)
async def get_template_versions(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[TemplateVersionResponse]:
    """Get version history for a template."""
    try:
        service = TemplateService(db)
        
        # Verify template exists and belongs to tenant
        await service.get_template(template_id, current_user.tenant_id)
        
        versions = await service.get_template_versions(template_id)
        
        return [TemplateVersionResponse.from_orm(v) for v in versions]
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )


@router.post(
    "/{template_id}/approve",
    response_model=TemplateResponse,
    summary="Approve or reject template",
    dependencies=[Depends(require_permission("templates:approve"))]
)
async def approve_template(
    template_id: int,
    approval_request: TemplateApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TemplateResponse:
    """
    Approve or reject a template pending approval.
    
    - Updates approval status
    - Records approver and timestamp
    - Activates template if approved
    """
    try:
        service = TemplateService(db)
        
        if approval_request.action == "approve":
            template = await service.approve_template(
                template_id,
                approver_id=current_user.id,
                comments=approval_request.comments
            )
        else:
            template = await service.reject_template(
                template_id,
                reviewer_id=current_user.id,
                comments=approval_request.comments or "Rejected"
            )
        
        return TemplateResponse.from_orm(template)
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )


@router.post(
    "/{template_id}/clone",
    response_model=TemplateResponse,
    summary="Clone a template",
    dependencies=[Depends(require_permission("templates:create"))]
)
async def clone_template(
    template_id: int,
    clone_request: TemplateCloneRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TemplateResponse:
    """
    Clone an existing template.
    
    - Creates a new template based on existing one
    - Copies variables and configuration
    - Links to parent template
    """
    try:
        service = TemplateService(db)
        
        cloned = await service.clone_template(
            template_id,
            new_name=clone_request.new_name,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id
        )
        
        return TemplateResponse.from_orm(cloned)
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )


@router.post(
    "/render",
    response_model=RenderResponse,
    summary="Render a template",
    dependencies=[Depends(require_permission("templates:use"))]
)
async def render_template(
    render_request: RenderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> RenderResponse:
    """
    Render a template with provided variables.
    
    - Validates all required variables
    - Applies conditional logic
    - Formats dates and numbers
    - Tracks template usage
    """
    try:
        service = TemplateService(db)
        
        # Get template
        template = await service.get_template(
            render_request.template_id,
            tenant_id=current_user.tenant_id
        )
        
        # Validate variables
        manager = VariableManager()
        variable_defs = [
            v for v in template.variables
        ]
        
        errors = manager.validate_variables(
            render_request.context.variables,
            variable_defs
        )
        
        if errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"errors": errors}
            )
        
        # Render template
        renderer = TemplateRenderer()
        start_time = datetime.utcnow()
        
        rendered = renderer.render(
            template.content,
            render_request.context
        )
        
        render_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # Track usage
        await service.track_template_usage(
            template_id=render_request.template_id,
            user_id=current_user.id,
            usage_type="render",
            render_time_ms=render_time_ms,
            variables_used=render_request.context.variables
        )
        
        # Find missing variables
        template_vars = manager.extract_variables(template.content)
        provided_vars = set(render_request.context.variables.keys())
        missing_vars = list(template_vars - provided_vars)
        
        return RenderResponse(
            rendered_content=rendered,
            output_format=render_request.output_format,
            render_time_ms=render_time_ms,
            warnings=[],
            missing_variables=missing_vars
        )
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found"
        )
    except Exception as e:
        logger.error(f"Failed to render template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render template: {str(e)}"
        )


@router.get(
    "/{template_id}/statistics",
    response_model=TemplateStatistics,
    summary="Get template usage statistics",
    dependencies=[Depends(require_permission("templates:read"))]
)
async def get_template_statistics(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TemplateStatistics:
    """
    Get usage statistics for a template.
    
    - Usage count and unique users
    - Most used variables
    - Average render time
    - User ratings
    """
    try:
        service = TemplateService(db)
        
        # Verify template exists and belongs to tenant
        template = await service.get_template(template_id, current_user.tenant_id)
        
        stats = await service.get_template_statistics(template_id)
        
        return TemplateStatistics(
            template_id=template_id,
            usage_count=stats.get("usage_count", 0),
            unique_users=stats.get("unique_users", 0),
            last_used=stats.get("last_used"),
            average_rating=template.rating,
            total_ratings=template.rating_count,
            most_used_variables=stats.get("most_used_variables", {}),
            average_render_time_ms=stats.get("average_render_time_ms")
        )
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template {template_id} not found"
        )


@router.get(
    "/categories",
    response_model=List[str],
    summary="Get available template categories",
    dependencies=[Depends(require_permission("templates:read"))]
)
async def get_template_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[str]:
    """Get list of available template categories for the tenant."""
    # In a real implementation, query distinct categories
    # For now, return predefined categories
    return [
        "service_agreement",
        "nda",
        "employment",
        "purchase_order",
        "sales",
        "partnership",
        "licensing",
        "general"
    ]


# Import datetime for render endpoint
from datetime import datetime