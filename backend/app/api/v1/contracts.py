"""
Contract management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.exc import IntegrityError

from app.core.database import get_async_session
from app.core.rbac import require_permission, require_any_permission
from app.api.v1.auth import get_current_user
from app.models.contract import Contract, ContractStatus
from app.models.user import User
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    ContractListResponse,
    ContractApproval
)

router = APIRouter()


@router.get("", response_model=ContractListResponse)
@require_permission("contracts.read")
async def list_contracts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: Optional[str] = None,
    contract_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List contracts with filtering and pagination."""
    # Base query - filter by tenant
    query = select(Contract).where(
        and_(
            Contract.tenant_id == current_user.tenant_id,
            Contract.is_deleted == False
        )
    )
    count_query = select(func.count(Contract.id)).where(
        and_(
            Contract.tenant_id == current_user.tenant_id,
            Contract.is_deleted == False
        )
    )
    
    # Apply filters
    if status:
        query = query.where(Contract.status == status)
        count_query = count_query.where(Contract.status == status)
    
    if contract_type:
        query = query.where(Contract.contract_type == contract_type)
        count_query = count_query.where(Contract.contract_type == contract_type)
    
    if search:
        search_filter = or_(
            Contract.title.ilike(f"%{search}%"),
            Contract.description.ilike(f"%{search}%"),
            Contract.contract_number.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination and ordering
    query = query.offset(offset).limit(limit)
    query = query.order_by(Contract.created_at.desc())
    
    # Execute query
    result = await db.execute(query)
    contracts = result.scalars().all()
    
    return ContractListResponse(
        items=contracts,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/{contract_id}", response_model=ContractResponse)
@require_permission("contracts.read")
async def get_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific contract by ID."""
    result = await db.execute(
        select(Contract).where(
            and_(
                Contract.id == contract_id,
                Contract.tenant_id == current_user.tenant_id,
                Contract.is_deleted == False
            )
        )
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    return contract


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
@require_permission("contracts.create")
async def create_contract(
    contract_data: ContractCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new contract."""
    # Check for duplicate contract number within tenant
    if contract_data.contract_number:
        result = await db.execute(
            select(Contract).where(
                and_(
                    Contract.contract_number == contract_data.contract_number,
                    Contract.tenant_id == current_user.tenant_id,
                    Contract.is_deleted == False
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contract number already exists"
            )
    
    # Create contract
    db_contract = Contract(
        title=contract_data.title,
        description=contract_data.description,
        contract_number=contract_data.contract_number,
        contract_type=contract_data.contract_type,
        content=contract_data.content,
        parties=contract_data.parties or {},
        contract_metadata=contract_data.contract_metadata or {},
        start_date=contract_data.start_date,
        end_date=contract_data.end_date,
        status=ContractStatus.DRAFT,
        tenant_id=current_user.tenant_id,
        created_by_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    try:
        db.add(db_contract)
        await db.commit()
        await db.refresh(db_contract)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create contract"
        )
    
    return db_contract


@router.patch("/{contract_id}", response_model=ContractResponse)
@require_permission("contracts.update")
async def update_contract(
    contract_id: int,
    contract_update: ContractUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a contract."""
    # Get contract
    result = await db.execute(
        select(Contract).where(
            and_(
                Contract.id == contract_id,
                Contract.tenant_id == current_user.tenant_id,
                Contract.is_deleted == False
            )
        )
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # Check for duplicate contract number if updating
    if contract_update.contract_number and contract_update.contract_number != contract.contract_number:
        result = await db.execute(
            select(Contract).where(
                and_(
                    Contract.contract_number == contract_update.contract_number,
                    Contract.tenant_id == current_user.tenant_id,
                    Contract.id != contract_id,
                    Contract.is_deleted == False
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contract number already exists"
            )
    
    # Update fields
    update_data = contract_update.model_dump(exclude_unset=True)
    
    # Validate status transition if status is being updated
    if "status" in update_data:
        new_status = ContractStatus(update_data["status"])
        if not contract.can_transition_to(new_status):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from {contract.status} to {new_status}"
            )
    
    for field, value in update_data.items():
        setattr(contract, field, value)
    
    contract.updated_by_id = current_user.id
    contract.updated_at = datetime.utcnow()
    
    try:
        await db.commit()
        await db.refresh(contract)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update contract"
        )
    
    return contract


@router.delete("/{contract_id}", status_code=status.HTTP_200_OK)
@require_permission("contracts.delete")
async def delete_contract(
    contract_id: int,
    force: bool = Query(default=False, description="Force delete active contract"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete (soft delete) a contract."""
    # Get contract
    result = await db.execute(
        select(Contract).where(
            and_(
                Contract.id == contract_id,
                Contract.tenant_id == current_user.tenant_id,
                Contract.is_deleted == False
            )
        )
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # Prevent deletion of active contracts unless forced
    if contract.status == ContractStatus.ACTIVE and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete active contract without force flag"
        )
    
    # Soft delete
    contract.is_deleted = True
    contract.updated_by_id = current_user.id
    contract.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": f"Contract '{contract.title}' has been deleted"}


@router.post("/{contract_id}/approve", response_model=ContractResponse)
@require_permission("contracts.approve")
async def approve_contract(
    contract_id: int,
    approval_data: ContractApproval,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Approve or reject a contract."""
    # Get contract
    result = await db.execute(
        select(Contract).where(
            and_(
                Contract.id == contract_id,
                Contract.tenant_id == current_user.tenant_id,
                Contract.is_deleted == False
            )
        )
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # Check if contract can be approved/rejected
    if contract.status not in [ContractStatus.DRAFT, ContractStatus.REVIEW]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract in {contract.status} status cannot be approved or rejected"
        )
    
    # Update contract status
    if approval_data.action == "approve":
        contract.status = ContractStatus.APPROVED
        contract.approved_by_id = current_user.id
        contract.approved_at = datetime.utcnow()
    else:  # reject
        contract.status = ContractStatus.REJECTED
        contract.approved_by_id = None
        contract.approved_at = None
    
    # Add comments to metadata if provided
    if approval_data.comments:
        if not contract.contract_metadata:
            contract.contract_metadata = {}
        if "approval_history" not in contract.contract_metadata:
            contract.contract_metadata["approval_history"] = []
        
        contract.contract_metadata["approval_history"].append({
            "action": approval_data.action,
            "comments": approval_data.comments,
            "user_id": current_user.id,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    contract.updated_by_id = current_user.id
    contract.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(contract)
    
    return contract


@router.get("/{contract_id}/versions", response_model=List[ContractResponse])
@require_permission("contracts.read")
async def get_contract_versions(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all versions of a contract."""
    # Get the contract to ensure it exists and user has access
    result = await db.execute(
        select(Contract).where(
            and_(
                Contract.id == contract_id,
                Contract.tenant_id == current_user.tenant_id,
                Contract.is_deleted == False
            )
        )
    )
    contract = result.scalar_one_or_none()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # Get all versions (contracts with same parent or this contract as parent)
    parent_id = contract.parent_contract_id or contract.id
    result = await db.execute(
        select(Contract).where(
            and_(
                or_(
                    Contract.id == parent_id,
                    Contract.parent_contract_id == parent_id
                ),
                Contract.tenant_id == current_user.tenant_id
            )
        ).order_by(Contract.version)
    )
    versions = result.scalars().all()
    
    return versions