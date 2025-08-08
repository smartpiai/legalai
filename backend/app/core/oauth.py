"""
OAuth 2.0 authentication support for the Legal AI Platform.
Supports Google, Microsoft, and GitHub OAuth providers.
"""
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import httpx
import secrets
import logging
from urllib.parse import urlencode

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import create_access_token, get_password_hash
from app.core.config import settings


logger = logging.getLogger(__name__)


class OAuthProvider:
    """Base OAuth provider class."""
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        """Initialize OAuth provider."""
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
    
    def get_authorization_url(self, state: str, **kwargs) -> str:
        """Get authorization URL for OAuth flow."""
        raise NotImplementedError
    
    async def get_access_token(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token."""
        raise NotImplementedError
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information using access token."""
        raise NotImplementedError


class GoogleOAuthProvider(OAuthProvider):
    """Google OAuth 2.0 provider."""
    
    AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    def get_authorization_url(self, state: str, **kwargs) -> str:
        """Get Google OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent"
        }
        return f"{self.AUTHORIZATION_URL}?{urlencode(params)}"
    
    async def get_access_token(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get access token from Google"
                )
            
            return response.json()
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Google."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USER_INFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user info from Google"
                )
            
            return response.json()


class MicrosoftOAuthProvider(OAuthProvider):
    """Microsoft OAuth 2.0 provider."""
    
    TENANT = "common"  # Use 'common' for multi-tenant
    AUTHORIZATION_URL = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/authorize"
    TOKEN_URL = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    USER_INFO_URL = "https://graph.microsoft.com/v1.0/me"
    
    def get_authorization_url(self, state: str, **kwargs) -> str:
        """Get Microsoft OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile User.Read",
            "state": state,
            "response_mode": "query"
        }
        return f"{self.AUTHORIZATION_URL}?{urlencode(params)}"
    
    async def get_access_token(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code",
                    "scope": "openid email profile User.Read"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get access token from Microsoft"
                )
            
            return response.json()
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from Microsoft Graph."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USER_INFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user info from Microsoft"
                )
            
            data = response.json()
            # Normalize to match Google's format
            return {
                "id": data.get("id"),
                "email": data.get("mail") or data.get("userPrincipalName"),
                "name": data.get("displayName"),
                "given_name": data.get("givenName"),
                "family_name": data.get("surname"),
                "picture": None  # Microsoft doesn't provide picture in basic scope
            }


class GitHubOAuthProvider(OAuthProvider):
    """GitHub OAuth 2.0 provider."""
    
    AUTHORIZATION_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USER_INFO_URL = "https://api.github.com/user"
    USER_EMAIL_URL = "https://api.github.com/user/emails"
    
    def get_authorization_url(self, state: str, **kwargs) -> str:
        """Get GitHub OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "read:user user:email",
            "state": state
        }
        return f"{self.AUTHORIZATION_URL}?{urlencode(params)}"
    
    async def get_access_token(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                headers={"Accept": "application/json"},
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get access token from GitHub"
                )
            
            return response.json()
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information from GitHub."""
        async with httpx.AsyncClient() as client:
            # Get basic user info
            response = await client.get(
                self.USER_INFO_URL,
                headers={"Authorization": f"token {access_token}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user info from GitHub"
                )
            
            user_data = response.json()
            
            # Get primary email if not public
            if not user_data.get("email"):
                email_response = await client.get(
                    self.USER_EMAIL_URL,
                    headers={"Authorization": f"token {access_token}"}
                )
                
                if email_response.status_code == 200:
                    emails = email_response.json()
                    primary_email = next(
                        (e["email"] for e in emails if e.get("primary")),
                        emails[0]["email"] if emails else None
                    )
                    user_data["email"] = primary_email
            
            # Normalize to match Google's format
            return {
                "id": str(user_data.get("id")),
                "email": user_data.get("email"),
                "name": user_data.get("name") or user_data.get("login"),
                "given_name": user_data.get("name", "").split()[0] if user_data.get("name") else None,
                "family_name": " ".join(user_data.get("name", "").split()[1:]) if user_data.get("name") else None,
                "picture": user_data.get("avatar_url")
            }


class OAuthService:
    """Service for handling OAuth authentication."""
    
    PROVIDERS = {
        "google": GoogleOAuthProvider,
        "microsoft": MicrosoftOAuthProvider,
        "github": GitHubOAuthProvider
    }
    
    def __init__(self, db_session: AsyncSession):
        """Initialize OAuth service."""
        self.db = db_session
        self._providers = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize OAuth providers from configuration."""
        # Google OAuth
        if hasattr(settings, "GOOGLE_CLIENT_ID"):
            self._providers["google"] = GoogleOAuthProvider(
                client_id=settings.GOOGLE_CLIENT_ID,
                client_secret=settings.GOOGLE_CLIENT_SECRET,
                redirect_uri=settings.GOOGLE_REDIRECT_URI
            )
        
        # Microsoft OAuth
        if hasattr(settings, "MICROSOFT_CLIENT_ID"):
            self._providers["microsoft"] = MicrosoftOAuthProvider(
                client_id=settings.MICROSOFT_CLIENT_ID,
                client_secret=settings.MICROSOFT_CLIENT_SECRET,
                redirect_uri=settings.MICROSOFT_REDIRECT_URI
            )
        
        # GitHub OAuth
        if hasattr(settings, "GITHUB_CLIENT_ID"):
            self._providers["github"] = GitHubOAuthProvider(
                client_id=settings.GITHUB_CLIENT_ID,
                client_secret=settings.GITHUB_CLIENT_SECRET,
                redirect_uri=settings.GITHUB_REDIRECT_URI
            )
    
    def get_provider(self, provider_name: str) -> Optional[OAuthProvider]:
        """Get OAuth provider by name."""
        return self._providers.get(provider_name)
    
    def get_authorization_url(self, provider_name: str) -> str:
        """Get authorization URL for OAuth provider."""
        provider = self.get_provider(provider_name)
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"OAuth provider '{provider_name}' not configured"
            )
        
        # Generate state token for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Store state in Redis for verification
        # TODO: Store state in Redis with expiration
        
        return provider.get_authorization_url(state)
    
    async def authenticate(
        self,
        provider_name: str,
        code: str,
        state: str,
        tenant_slug: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate user with OAuth provider.
        
        Returns:
            Dictionary with access_token, refresh_token, and user info
        """
        provider = self.get_provider(provider_name)
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"OAuth provider '{provider_name}' not configured"
            )
        
        # TODO: Verify state token from Redis
        
        # Exchange code for access token
        token_data = await provider.get_access_token(code)
        access_token = token_data.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get access token"
            )
        
        # Get user information
        user_info = await provider.get_user_info(access_token)
        email = user_info.get("email")
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by OAuth provider"
            )
        
        # Find or create user
        user = await self._find_or_create_user(
            email=email,
            provider=provider_name,
            provider_user_id=user_info.get("id"),
            full_name=user_info.get("name"),
            avatar_url=user_info.get("picture"),
            tenant_slug=tenant_slug
        )
        
        # Create JWT tokens
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        
        refresh_token = create_access_token(
            data={"sub": str(user.id), "email": user.email},
            expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "avatar_url": user.avatar_url
            }
        }
    
    async def _find_or_create_user(
        self,
        email: str,
        provider: str,
        provider_user_id: str,
        full_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        tenant_slug: Optional[str] = None
    ) -> User:
        """Find existing user or create new one from OAuth data."""
        # Check if user exists
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        
        if user:
            # Update user info
            user.last_login = datetime.utcnow()
            if full_name and not user.full_name:
                user.full_name = full_name
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            
            await self.db.commit()
            await self.db.refresh(user)
            return user
        
        # Get or create tenant
        tenant_id = await self._get_or_create_tenant(tenant_slug, email)
        
        # Create new user
        user = User(
            email=email,
            username=email.split("@")[0],  # Use email prefix as username
            full_name=full_name or email.split("@")[0],
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password
            is_active=True,
            email_verified=True,  # OAuth providers verify email
            avatar_url=avatar_url,
            tenant_id=tenant_id,
            last_login=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Store OAuth provider info in user metadata
        # TODO: Add oauth_providers field to User model
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        logger.info(f"Created new user via OAuth: {email} (provider: {provider})")
        
        return user
    
    async def _get_or_create_tenant(
        self,
        tenant_slug: Optional[str],
        email: str
    ) -> int:
        """Get existing tenant or create new one."""
        if tenant_slug:
            # Try to find tenant by slug
            result = await self.db.execute(
                select(Tenant).where(Tenant.slug == tenant_slug)
            )
            tenant = result.scalar_one_or_none()
            
            if tenant:
                return tenant.id
        
        # Create new tenant based on email domain
        domain = email.split("@")[1]
        tenant_name = domain.split(".")[0].title()
        tenant_slug = domain.replace(".", "-")
        
        # Check if tenant with this slug exists
        result = await self.db.execute(
            select(Tenant).where(Tenant.slug == tenant_slug)
        )
        tenant = result.scalar_one_or_none()
        
        if tenant:
            return tenant.id
        
        # Create new tenant
        tenant = Tenant(
            name=f"{tenant_name} Organization",
            slug=tenant_slug,
            is_active=True,
            settings={
                "created_via": "oauth",
                "domain": domain
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.db.add(tenant)
        await self.db.commit()
        await self.db.refresh(tenant)
        
        logger.info(f"Created new tenant via OAuth: {tenant.name}")
        
        return tenant.id