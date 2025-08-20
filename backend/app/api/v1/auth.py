"""
Authentication endpoints for user registration, login, and token management.
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_async_session
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token
)
from app.core.config import settings
from app.models.user import User
from app.models.tenant import Tenant
from app.models.refresh_token import RefreshToken
from app.services.auth_service import AuthService
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserLogin,
    Token,
    TokenPayload,
    PasswordReset,
    PasswordResetConfirm
)
from app.schemas.auth import (
    TokenPair,
    RefreshTokenRequest,
    LoginRequest,
    LogoutRequest,
    ActiveSessionsResponse
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_async_session)
) -> User:
    """Get current authenticated user from token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
    
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user


async def get_current_active_superuser(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active superuser."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_async_session)
):
    """Register a new user."""
    try:
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Check if username already exists
        result = await db.execute(select(User).where(User.username == user_data.username))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        tenant_id = user_data.tenant_id
        if not tenant_id:
            # Create a new tenant for the user
            tenant_name = user_data.full_name or user_data.username
            slug = f"{tenant_name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:6]}"
            
            new_tenant = Tenant(
                name=tenant_name,
                slug=slug,
                is_active=True
            )
            db.add(new_tenant)
            await db.flush()
            tenant_id = new_tenant.id
        else:
            # Verify tenant exists if provided
            result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            if not tenant or not tenant.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or inactive tenant"
                )
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        
        db_user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            is_active=True,
            is_superuser=False, # Default to non-superuser
            tenant_id=tenant_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        
        return db_user
    except IntegrityError:
        await db.rollback()
        logging.error("Registration failed due to integrity error.", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User could not be created due to a database conflict."
        )
    except HTTPException as e:
        logging.error(f"Registration failed: {e.detail}")
        raise e
    except Exception as e:
        logging.error(f"An unexpected error occurred during registration: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred."
        )


@router.post("/login", response_model=TokenPair)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """Login user and return access/refresh token pair."""
    # Find user by email
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Get device info and IP
    device_info = credentials.device_info or request.headers.get("User-Agent", "Unknown")
    ip_address = request.client.host if request.client else None
    
    # Create tokens using auth service
    auth_service = AuthService(db)
    token_pair = await auth_service.create_token_pair(
        user=user,
        device_info=device_info,
        ip_address=ip_address
    )
    
    await db.commit()
    return token_pair


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(
    token_request: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """Refresh access token using refresh token with rotation."""
    auth_service = AuthService(db)
    
    # Get device info and IP
    device_info = request.headers.get("User-Agent", "Unknown")
    ip_address = request.client.host if request.client else None
    
    try:
        token_pair = await auth_service.refresh_tokens(
            refresh_token=token_request.refresh_token,
            device_info=device_info,
            ip_address=ip_address
        )
        await db.commit()
        return token_pair
    except ValueError as e:
        # Map specific errors to appropriate HTTP status codes
        error_message = str(e)
        if "expired" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif "revoked" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif "family" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token family has been invalidated due to security violation",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif "lifetime" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Maximum token lifetime exceeded",
                headers={"WWW-Authenticate": "Bearer"},
            )
        elif "inactive" in error_message.lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive",
                headers={"WWW-Authenticate": "Bearer"},
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )


@router.post("/password-reset", status_code=status.HTTP_200_OK)
async def request_password_reset(
    reset_request: PasswordReset,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_session)
):
    """Request password reset email."""
    # Find user by email
    result = await db.execute(select(User).where(User.email == reset_request.email))
    user = result.scalar_one_or_none()
    
    # Always return success to avoid email enumeration
    message = "If the email exists, a password reset link has been sent"
    
    if user and user.is_active:
        # Generate reset token (valid for 1 hour)
        reset_token = create_access_token(
            data={"sub": user.email, "type": "password_reset"},
            expires_delta=timedelta(hours=1)
        )
        
        # In production, send email here
        # background_tasks.add_task(send_reset_email, user.email, reset_token)
        
        # For testing, we'll just log it
        print(f"Password reset token for {user.email}: {reset_token}")
    
    return {"message": message}


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_async_session)
):
    """Confirm password reset with token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired reset token"
    )
    
    payload = verify_token(reset_data.token)
    if payload is None or payload.get("type") != "password_reset":
        raise credentials_exception
    
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    # Find user and update password
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise credentials_exception
    
    # Update password
    user.hashed_password = get_password_hash(reset_data.new_password)
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Password successfully reset"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user profile."""
    return current_user


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    logout_request: Optional[LogoutRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Logout user and revoke refresh tokens."""
    auth_service = AuthService(db)
    
    # Revoke all user tokens if requested or just current session
    if logout_request and logout_request.all_devices:
        await auth_service.revoke_all_user_tokens(
            user_id=current_user.id,
            reason="User logout from all devices"
        )
        message = "Successfully logged out from all devices"
    else:
        # In production, we would track the specific token family
        # For now, revoke all tokens (can be improved with session tracking)
        await auth_service.revoke_all_user_tokens(
            user_id=current_user.id,
            reason="User logout"
        )
        message = "Successfully logged out"
    
    await db.commit()
    return {"message": message}


@router.get("/sessions", response_model=ActiveSessionsResponse)
async def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all active sessions for the current user."""
    auth_service = AuthService(db)
    sessions = await auth_service.get_active_sessions(current_user.id)
    
    return ActiveSessionsResponse(
        sessions=sessions,
        total=len(sessions)
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Revoke a specific session."""
    # Verify the session belongs to the current user
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == session_id,
            RefreshToken.user_id == current_user.id
        )
    )
    token = result.scalar_one_or_none()
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if token.is_active:
        token.revoke("User revoked session")
        await db.commit()
    
    return {"message": "Session revoked successfully"}
