"""
RBAC (Role-Based Access Control) middleware and permission checking.
"""
from typing import List, Optional, Set
from functools import wraps
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.role import Role, Permission
from app.core.database import get_async_session
from app.api.v1.auth import get_current_user


async def get_user_permissions(
    user: User,
    db: AsyncSession
) -> List[Permission]:
    """
    Get all permissions for a user through their roles.
    
    Args:
        user: The user to get permissions for
        db: Database session
        
    Returns:
        List of Permission objects
    """
    # Superusers have all permissions
    if user.is_superuser:
        result = await db.execute(select(Permission))
        return result.scalars().all()
    
    # Get user with roles and permissions loaded
    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(
            selectinload(User.roles).selectinload(Role.permissions)
        )
    )
    user_with_roles = result.scalar_one_or_none()
    
    if not user_with_roles:
        return []
    
    # Collect all unique permissions from all roles
    permissions_set: Set[Permission] = set()
    
    for role in user_with_roles.roles:
        # Get direct permissions
        for permission in role.permissions:
            permissions_set.add(permission)
        
        # Get inherited permissions if role has parent
        if role.parent_role_id:
            parent_result = await db.execute(
                select(Role)
                .where(Role.id == role.parent_role_id)
                .options(selectinload(Role.permissions))
            )
            parent_role = parent_result.scalar_one_or_none()
            if parent_role:
                for permission in parent_role.get_all_permissions():
                    permissions_set.add(permission)
    
    return list(permissions_set)


async def check_user_permission(
    user: User,
    permission_name: str,
    db: AsyncSession
) -> bool:
    """
    Check if a user has a specific permission.
    
    Args:
        user: The user to check
        permission_name: Name of the permission to check
        db: Database session
        
    Returns:
        True if user has permission, False otherwise
    """
    # Superusers always have permission
    if user.is_superuser:
        return True
    
    # Get user permissions
    permissions = await get_user_permissions(user, db)
    
    # Check if permission exists
    return any(p.name == permission_name for p in permissions)


def require_permission(permission_name: str):
    """
    Decorator to require a specific permission for an endpoint.
    
    Args:
        permission_name: Name of the required permission
        
    Usage:
        @app.get("/contracts")
        @require_permission("contracts.read")
        async def get_contracts(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(
            *args,
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
            **kwargs
        ):
            # Check permission
            has_permission = await check_user_permission(
                current_user,
                permission_name,
                db
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied. Required permission: {permission_name}"
                )
            
            # Call the original function
            return await func(*args, current_user=current_user, db=db, **kwargs)
        
        return wrapper
    return decorator


def require_any_permission(permission_names: List[str]):
    """
    Decorator to require at least one of the specified permissions.
    
    Args:
        permission_names: List of permission names (user needs at least one)
        
    Usage:
        @app.post("/contracts")
        @require_any_permission(["contracts.write", "contracts.admin"])
        async def create_contract(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(
            *args,
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
            **kwargs
        ):
            # Check if user has any of the required permissions
            for permission_name in permission_names:
                has_permission = await check_user_permission(
                    current_user,
                    permission_name,
                    db
                )
                if has_permission:
                    # User has at least one required permission
                    return await func(*args, current_user=current_user, db=db, **kwargs)
            
            # User has none of the required permissions
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required one of: {', '.join(permission_names)}"
            )
        
        return wrapper
    return decorator


def require_all_permissions(permission_names: List[str]):
    """
    Decorator to require all specified permissions.
    
    Args:
        permission_names: List of permission names (user needs all)
        
    Usage:
        @app.delete("/contracts/{id}")
        @require_all_permissions(["contracts.delete", "contracts.admin"])
        async def delete_contract(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(
            *args,
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(get_async_session),
            **kwargs
        ):
            # Check if user has all required permissions
            missing_permissions = []
            
            for permission_name in permission_names:
                has_permission = await check_user_permission(
                    current_user,
                    permission_name,
                    db
                )
                if not has_permission:
                    missing_permissions.append(permission_name)
            
            if missing_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied. Missing permissions: {', '.join(missing_permissions)}"
                )
            
            # User has all required permissions
            return await func(*args, current_user=current_user, db=db, **kwargs)
        
        return wrapper
    return decorator


class PermissionChecker:
    """
    Dependency class for checking permissions in path operations.
    
    Usage:
        @app.get("/contracts")
        async def get_contracts(
            has_perm: bool = Depends(PermissionChecker("contracts.read"))
        ):
            ...
    """
    
    def __init__(self, permission_name: str):
        self.permission_name = permission_name
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session)
    ) -> bool:
        """Check if current user has the permission."""
        has_permission = await check_user_permission(
            current_user,
            self.permission_name,
            db
        )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission: {self.permission_name}"
            )
        
        return True


async def get_user_roles(
    user: User,
    db: AsyncSession
) -> List[Role]:
    """
    Get all roles for a user.
    
    Args:
        user: The user to get roles for
        db: Database session
        
    Returns:
        List of Role objects
    """
    result = await db.execute(
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.roles))
    )
    user_with_roles = result.scalar_one_or_none()
    
    if not user_with_roles:
        return []
    
    return user_with_roles.roles


async def has_role(
    user: User,
    role_slug: str,
    db: AsyncSession
) -> bool:
    """
    Check if a user has a specific role.
    
    Args:
        user: The user to check
        role_slug: Slug of the role to check
        db: Database session
        
    Returns:
        True if user has role, False otherwise
    """
    roles = await get_user_roles(user, db)
    return any(role.slug == role_slug for role in roles)