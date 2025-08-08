"""
Tenant management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.exc import IntegrityError

from app.core.database import get_async_session
from app.api.v1.auth import get_current_user, get_current_active_superuser
from app.models.tenant import Tenant
from app.models.user import User
from app.models.contract import Contract
from app.models.document import Document
from app.schemas.tenant import (
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantListResponse,
    TenantStatistics
)

router = APIRouter()


@router.get("/me", response_model=TenantResponse)
async def get_current_tenant(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get current user's tenant information."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant


@router.get("/me/stats", response_model=TenantStatistics)
async def get_current_tenant_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get statistics for current user's tenant."""
    tenant_id = current_user.tenant_id
    
    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Get user counts
    user_count_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant_id)
    )
    user_count = user_count_result.scalar() or 0
    
    active_user_count_result = await db.execute(
        select(func.count(User.id)).where(
            and_(User.tenant_id == tenant_id, User.is_active == True)
        )
    )
    active_user_count = active_user_count_result.scalar() or 0
    
    # Get contract count
    contract_count_result = await db.execute(
        select(func.count(Contract.id)).where(Contract.tenant_id == tenant_id)
    )
    contract_count = contract_count_result.scalar() or 0
    
    # Get document count and storage
    doc_result = await db.execute(
        select(
            func.count(Document.id),
            func.coalesce(func.sum(Document.file_size), 0)
        ).where(Document.tenant_id == tenant_id)
    )
    doc_row = doc_result.first()
    document_count = doc_row[0] or 0
    storage_used_bytes = doc_row[1] or 0
    storage_used_gb = storage_used_bytes / (1024 ** 3)
    
    # Get last activity (last user login)
    last_login_result = await db.execute(
        select(func.max(User.last_login)).where(User.tenant_id == tenant_id)
    )
    last_activity = last_login_result.scalar()
    
    # Get storage limit from settings
    settings = tenant.settings or {}
    storage_limit_gb = settings.get('max_storage_gb', 100)
    
    return TenantStatistics(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        user_count=user_count,
        active_user_count=active_user_count,
        contract_count=contract_count,
        document_count=document_count,
        storage_used_gb=round(storage_used_gb, 2),
        storage_limit_gb=storage_limit_gb,
        last_activity=last_activity
    )


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_async_session)
):
    """List all tenants (superuser only)."""
    query = select(Tenant)
    count_query = select(func.count(Tenant.id))
    
    # Apply filters
    if is_active is not None:
        query = query.where(Tenant.is_active == is_active)
        count_query = count_query.where(Tenant.is_active == is_active)
    
    if search:
        search_filter = or_(
            Tenant.name.ilike(f"%{search}%"),
            Tenant.slug.ilike(f"%{search}%"),
            Tenant.description.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination and ordering
    query = query.offset(offset).limit(limit)
    query = query.order_by(Tenant.created_at.desc())
    
    # Execute query
    result = await db.execute(query)
    tenants = result.scalars().all()
    
    return TenantListResponse(
        items=tenants,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: int,
    current_user: User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific tenant by ID (superuser only)."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return tenant


@router.get("/{tenant_id}/stats", response_model=TenantStatistics)
async def get_tenant_stats(
    tenant_id: int,
    current_user: User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_async_session)
):
    """Get statistics for a specific tenant (superuser only)."""
    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Get user counts
    user_count_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant_id)
    )
    user_count = user_count_result.scalar() or 0
    
    active_user_count_result = await db.execute(
        select(func.count(User.id)).where(
            and_(User.tenant_id == tenant_id, User.is_active == True)
        )
    )
    active_user_count = active_user_count_result.scalar() or 0
    
    # Get contract count
    contract_count_result = await db.execute(
        select(func.count(Contract.id)).where(Contract.tenant_id == tenant_id)
    )
    contract_count = contract_count_result.scalar() or 0
    
    # Get document count and storage
    doc_result = await db.execute(
        select(
            func.count(Document.id),
            func.coalesce(func.sum(Document.file_size), 0)
        ).where(Document.tenant_id == tenant_id)
    )
    doc_row = doc_result.first()
    document_count = doc_row[0] or 0
    storage_used_bytes = doc_row[1] or 0
    storage_used_gb = storage_used_bytes / (1024 ** 3)
    
    # Get last activity
    last_login_result = await db.execute(
        select(func.max(User.last_login)).where(User.tenant_id == tenant_id)
    )
    last_activity = last_login_result.scalar()
    
    # Get storage limit from settings
    settings = tenant.settings or {}
    storage_limit_gb = settings.get('max_storage_gb', 100)
    
    return TenantStatistics(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        user_count=user_count,
        active_user_count=active_user_count,
        contract_count=contract_count,
        document_count=document_count,
        storage_used_gb=round(storage_used_gb, 2),
        storage_limit_gb=storage_limit_gb,
        last_activity=last_activity
    )


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    current_user: User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new tenant (superuser only)."""
    # Check if slug already exists
    result = await db.execute(
        select(Tenant).where(Tenant.slug == tenant_data.slug)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant slug already exists"
        )
    
    # Create tenant
    db_tenant = Tenant(
        name=tenant_data.name,
        slug=tenant_data.slug,
        description=tenant_data.description,
        is_active=tenant_data.is_active,
        settings=tenant_data.settings or {},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    try:
        db.add(db_tenant)
        await db.commit()
        await db.refresh(db_tenant)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create tenant"
        )
    
    return db_tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: int,
    tenant_update: TenantUpdate,
    current_user: User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a tenant (superuser only)."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Update fields (note: slug cannot be updated)
    if tenant_update.name is not None:
        tenant.name = tenant_update.name
    
    if tenant_update.description is not None:
        tenant.description = tenant_update.description
    
    if tenant_update.is_active is not None:
        tenant.is_active = tenant_update.is_active
    
    if tenant_update.settings is not None:
        # Merge settings
        current_settings = tenant.settings or {}
        current_settings.update(tenant_update.settings)
        tenant.settings = current_settings
    
    tenant.updated_at = datetime.utcnow()
    
    try:
        await db.commit()
        await db.refresh(tenant)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update tenant"
        )
    
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_200_OK)
async def delete_tenant(
    tenant_id: int,
    current_user: User = Depends(get_current_active_superuser),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete (deactivate) a tenant (superuser only)."""
    # Check if it's the current user's tenant
    if tenant_id == current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own tenant"
        )
    
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Soft delete - just deactivate
    tenant.is_active = False
    tenant.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": f"Tenant '{tenant.name}' has been deactivated"}