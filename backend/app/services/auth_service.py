"""
Authentication service for managing tokens and sessions.
Following TDD - GREEN phase: Implementing service to pass tests.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
import hashlib
import secrets
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from jose import jwt, JWTError

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import TokenPair, RefreshTokenRequest


class AuthService:
    """Service for handling authentication operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.max_token_lifetime_days = 90  # Maximum lifetime for token family
        self.refresh_token_expire_days = settings.REFRESH_TOKEN_EXPIRE_DAYS
    
    async def create_token_pair(
        self,
        user: User,
        device_info: Optional[str] = None,
        ip_address: Optional[str] = None,
        scopes: Optional[list] = None
    ) -> TokenPair:
        """Create a new access/refresh token pair."""
        # Generate family ID for token rotation tracking
        family_id = secrets.token_urlsafe(32)
        
        # Create access token
        access_token_data = {
            "sub": user.email,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "user_id": str(user.id),
            "scopes": scopes or []
        }
        access_token = create_access_token(
            data=access_token_data,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        # Create refresh token
        refresh_token_data = {
            "sub": user.email,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "user_id": str(user.id),
            "family_id": family_id,
            "type": "refresh",
            "issued_at": datetime.utcnow().isoformat(),
            "scopes": scopes or []
        }
        refresh_token = create_refresh_token(data=refresh_token_data)
        
        # Store refresh token in database
        await self._store_refresh_token(
            user=user,
            token=refresh_token,
            family_id=family_id,
            device_info=device_info,
            ip_address=ip_address,
            scopes=scopes
        )
        
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    async def refresh_tokens(
        self,
        refresh_token: str,
        device_info: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> TokenPair:
        """Refresh access and refresh tokens using refresh token."""
        # Verify token format and decode
        payload = verify_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        
        # Check token in database
        token_hash = self._hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash
            )
        )
        stored_token = result.scalar_one_or_none()
        
        if not stored_token:
            # Token not found - might be using old token after rotation
            await self._handle_token_reuse(payload.get("family_id"))
            raise ValueError("Token has been revoked")
        
        if not stored_token.is_active:
            raise ValueError("Token has been revoked")
        
        if stored_token.is_expired():
            raise ValueError("Token has expired")
        
        # Check maximum lifetime for token family
        if await self._check_family_lifetime(stored_token.family_id, payload.get("issued_at")):
            raise ValueError("Maximum token lifetime exceeded")
        
        # Get user
        result = await self.db.execute(
            select(User).where(User.id == stored_token.user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            stored_token.revoke("User inactive")
            await self.db.commit()
            raise ValueError("User account is inactive")
        
        # Mark old token as used
        stored_token.use(ip_address)
        stored_token.revoke("Token rotation")
        
        # Create new token pair with same family ID
        new_tokens = await self._rotate_tokens(
            user=user,
            family_id=stored_token.family_id,
            parent_token_id=stored_token.id,
            device_info=device_info or stored_token.device_info,
            ip_address=ip_address or stored_token.ip_address,
            scopes=json.loads(stored_token.scopes) if stored_token.scopes else None,
            original_issued_at=payload.get("issued_at")
        )
        
        await self.db.commit()
        return new_tokens
    
    async def revoke_token(self, refresh_token: str, reason: str = "User action"):
        """Revoke a specific refresh token."""
        token_hash = self._hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash
            )
        )
        stored_token = result.scalar_one_or_none()
        
        if stored_token and stored_token.is_active:
            stored_token.revoke(reason)
            await self.db.commit()
    
    async def revoke_all_user_tokens(self, user_id: int, reason: str = "Logout"):
        """Revoke all refresh tokens for a user."""
        await self.db.execute(
            update(RefreshToken)
            .where(
                and_(
                    RefreshToken.user_id == user_id,
                    RefreshToken.is_active == True
                )
            )
            .values(
                is_active=False,
                revoked_at=datetime.utcnow(),
                revoked_reason=reason
            )
        )
        await self.db.commit()
    
    async def revoke_token_family(self, family_id: str, reason: str = "Security violation"):
        """Revoke all tokens in a family (used for security breach detection)."""
        await self.db.execute(
            update(RefreshToken)
            .where(
                and_(
                    RefreshToken.family_id == family_id,
                    RefreshToken.is_active == True
                )
            )
            .values(
                is_active=False,
                revoked_at=datetime.utcnow(),
                revoked_reason=reason
            )
        )
        await self.db.commit()
    
    async def cleanup_expired_tokens(self):
        """Remove expired tokens from database (maintenance task)."""
        cutoff_date = datetime.utcnow() - timedelta(days=7)  # Keep for 7 days after expiry
        
        await self.db.execute(
            select(RefreshToken).where(
                or_(
                    RefreshToken.expires_at < cutoff_date,
                    and_(
                        RefreshToken.is_active == False,
                        RefreshToken.revoked_at < cutoff_date
                    )
                )
            ).delete()
        )
        await self.db.commit()
    
    async def get_active_sessions(self, user_id: int) -> list:
        """Get all active sessions for a user."""
        result = await self.db.execute(
            select(RefreshToken).where(
                and_(
                    RefreshToken.user_id == user_id,
                    RefreshToken.is_active == True,
                    RefreshToken.expires_at > datetime.utcnow()
                )
            ).order_by(RefreshToken.last_used_at.desc())
        )
        
        return [
            {
                "id": str(token.id),
                "device_info": token.device_info,
                "ip_address": token.ip_address,
                "last_used": token.last_used_at,
                "created": token.created_at
            }
            for token in result.scalars()
        ]
    
    # Private helper methods
    
    def _hash_token(self, token: str) -> str:
        """Hash token for secure storage."""
        return hashlib.sha256(token.encode()).hexdigest()
    
    async def _store_refresh_token(
        self,
        user: User,
        token: str,
        family_id: str,
        device_info: Optional[str] = None,
        ip_address: Optional[str] = None,
        scopes: Optional[list] = None,
        parent_token_id: Optional[str] = None
    ):
        """Store refresh token in database."""
        token_hash = self._hash_token(token)
        
        refresh_token = RefreshToken(
            token_hash=token_hash,
            family_id=family_id,
            user_id=user.id,
            tenant_id=user.tenant_id,
            expires_at=datetime.utcnow() + timedelta(days=self.refresh_token_expire_days),
            device_info=device_info,
            ip_address=ip_address,
            scopes=json.dumps(scopes) if scopes else None,
            parent_token_id=parent_token_id
        )
        
        self.db.add(refresh_token)
        await self.db.flush()
    
    async def _rotate_tokens(
        self,
        user: User,
        family_id: str,
        parent_token_id: str,
        device_info: Optional[str] = None,
        ip_address: Optional[str] = None,
        scopes: Optional[list] = None,
        original_issued_at: Optional[str] = None
    ) -> TokenPair:
        """Rotate tokens while preserving family ID."""
        # Create new access token
        access_token_data = {
            "sub": user.email,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "user_id": str(user.id),
            "scopes": scopes or []
        }
        access_token = create_access_token(
            data=access_token_data,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        # Create new refresh token with same family
        refresh_token_data = {
            "sub": user.email,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "user_id": str(user.id),
            "family_id": family_id,
            "type": "refresh",
            "issued_at": original_issued_at or datetime.utcnow().isoformat(),
            "scopes": scopes or []
        }
        refresh_token = create_refresh_token(data=refresh_token_data)
        
        # Store new refresh token
        await self._store_refresh_token(
            user=user,
            token=refresh_token,
            family_id=family_id,
            device_info=device_info,
            ip_address=ip_address,
            scopes=scopes,
            parent_token_id=parent_token_id
        )
        
        return TokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    async def _handle_token_reuse(self, family_id: Optional[str]):
        """Handle potential token theft by invalidating entire family."""
        if family_id:
            await self.revoke_token_family(
                family_id=family_id,
                reason="Token reuse detected - possible theft"
            )
    
    async def _check_family_lifetime(self, family_id: str, issued_at: Optional[str]) -> bool:
        """Check if token family has exceeded maximum lifetime."""
        if not issued_at:
            return False
        
        try:
            original_date = datetime.fromisoformat(issued_at)
            lifetime = datetime.utcnow() - original_date
            return lifetime.days > self.max_token_lifetime_days
        except (ValueError, TypeError):
            return False