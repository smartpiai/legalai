"""
Middleware components for the Legal AI Platform.
Includes tenant-aware middleware, quota enforcement, and billing hooks.
"""
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.models.tenant import Tenant
from app.models.user import User


logger = logging.getLogger(__name__)


class TenantAwareMiddleware(BaseHTTPMiddleware):
    """
    Middleware to ensure tenant isolation and context.
    Validates tenant access and injects tenant context into requests.
    """
    
    async def dispatch(self, request: Request, call_next):
        """Process request with tenant context."""
        # Skip tenant check for public endpoints
        public_paths = [
            "/docs", "/redoc", "/openapi.json", 
            "/api/v1/auth/login", "/api/v1/auth/register",
            "/api/v1/auth/refresh", "/api/v1/auth/password-reset",
            "/api/v1/health", "/"
        ]
        
        if any(request.url.path.startswith(path) for path in public_paths):
            return await call_next(request)
        
        # Extract tenant context from authenticated user
        if hasattr(request.state, "user") and request.state.user:
            user = request.state.user
            tenant_id = user.tenant_id
            
            # Validate tenant is active
            async for db in get_async_session():
                result = await db.execute(
                    select(Tenant).where(
                        Tenant.id == tenant_id,
                        Tenant.is_active == True
                    )
                )
                tenant = result.scalar_one_or_none()
                
                if not tenant:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "Tenant is inactive or not found"}
                    )
                
                # Inject tenant into request state
                request.state.tenant = tenant
                request.state.tenant_id = tenant_id
                
                # Add tenant context to logs
                logger.info(
                    f"Request from tenant: {tenant.name} (ID: {tenant_id})",
                    extra={
                        "tenant_id": tenant_id,
                        "tenant_name": tenant.name,
                        "user_id": user.id,
                        "path": request.url.path
                    }
                )
        
        response = await call_next(request)
        
        # Add tenant header to response for debugging
        if hasattr(request.state, "tenant_id"):
            response.headers["X-Tenant-ID"] = str(request.state.tenant_id)
        
        return response


class ResourceQuotaMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce resource quotas per tenant.
    Checks storage, user limits, and API rate limits.
    """
    
    # Quota types and their default limits
    DEFAULT_QUOTAS = {
        "max_users": 50,
        "max_storage_gb": 100,
        "max_contracts": 1000,
        "max_documents": 10000,
        "max_api_calls_per_hour": 10000,
        "max_file_size_mb": 100
    }
    
    async def dispatch(self, request: Request, call_next):
        """Check resource quotas before processing request."""
        # Skip quota check for non-tenant requests
        if not hasattr(request.state, "tenant"):
            return await call_next(request)
        
        tenant = request.state.tenant
        settings = tenant.settings or {}
        
        # Check specific quotas based on endpoint
        path = request.url.path
        
        # Check storage quota for upload endpoints
        if "upload" in path or "documents" in path:
            if request.method == "POST":
                await self._check_storage_quota(tenant, request)
        
        # Check user quota for user creation
        if "/users" in path and request.method == "POST":
            await self._check_user_quota(tenant)
        
        # Check contract quota
        if "/contracts" in path and request.method == "POST":
            await self._check_contract_quota(tenant)
        
        # Check API rate limit
        await self._check_api_rate_limit(tenant, request)
        
        response = await call_next(request)
        
        # Track resource usage
        await self._track_usage(tenant, request, response)
        
        return response
    
    async def _check_storage_quota(self, tenant: Tenant, request: Request):
        """Check if tenant has exceeded storage quota."""
        settings = tenant.settings or {}
        max_storage_gb = settings.get("max_storage_gb", self.DEFAULT_QUOTAS["max_storage_gb"])
        
        # Get current storage usage
        async for db in get_async_session():
            from app.models.document import Document
            from sqlalchemy import func
            
            result = await db.execute(
                select(func.coalesce(func.sum(Document.file_size), 0))
                .where(Document.tenant_id == tenant.id)
            )
            current_usage_bytes = result.scalar() or 0
            current_usage_gb = current_usage_bytes / (1024 ** 3)
            
            # Check if content-length header exists
            content_length = request.headers.get("content-length", 0)
            file_size_gb = int(content_length) / (1024 ** 3)
            
            if current_usage_gb + file_size_gb > max_storage_gb:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Storage quota exceeded. Current: {current_usage_gb:.2f}GB, "
                           f"Limit: {max_storage_gb}GB"
                )
    
    async def _check_user_quota(self, tenant: Tenant):
        """Check if tenant has exceeded user quota."""
        settings = tenant.settings or {}
        max_users = settings.get("max_users", self.DEFAULT_QUOTAS["max_users"])
        
        async for db in get_async_session():
            from sqlalchemy import func
            
            result = await db.execute(
                select(func.count(User.id))
                .where(User.tenant_id == tenant.id)
            )
            current_users = result.scalar() or 0
            
            if current_users >= max_users:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"User quota exceeded. Maximum users: {max_users}"
                )
    
    async def _check_contract_quota(self, tenant: Tenant):
        """Check if tenant has exceeded contract quota."""
        settings = tenant.settings or {}
        max_contracts = settings.get("max_contracts", self.DEFAULT_QUOTAS["max_contracts"])
        
        async for db in get_async_session():
            from app.models.contract import Contract
            from sqlalchemy import func
            
            result = await db.execute(
                select(func.count(Contract.id))
                .where(Contract.tenant_id == tenant.id)
            )
            current_contracts = result.scalar() or 0
            
            if current_contracts >= max_contracts:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Contract quota exceeded. Maximum contracts: {max_contracts}"
                )
    
    async def _check_api_rate_limit(self, tenant: Tenant, request: Request):
        """Check API rate limit for tenant."""
        settings = tenant.settings or {}
        max_api_calls = settings.get(
            "max_api_calls_per_hour", 
            self.DEFAULT_QUOTAS["max_api_calls_per_hour"]
        )
        
        # Get Redis connection for rate limiting
        from app.core.cache import get_redis_client
        redis_client = await get_redis_client()
        
        if redis_client:
            key = f"api_calls:{tenant.id}:{datetime.utcnow().hour}"
            current_calls = await redis_client.incr(key)
            
            # Set expiry for 1 hour if new key
            if current_calls == 1:
                await redis_client.expire(key, 3600)
            
            if current_calls > max_api_calls:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"API rate limit exceeded. Maximum: {max_api_calls} calls/hour"
                )
    
    async def _track_usage(self, tenant: Tenant, request: Request, response):
        """Track resource usage for billing and analytics."""
        # Skip if response is error
        if response.status_code >= 400:
            return
        
        # Track API usage
        usage_data = {
            "tenant_id": tenant.id,
            "timestamp": datetime.utcnow(),
            "endpoint": request.url.path,
            "method": request.method,
            "status_code": response.status_code
        }
        
        # Log to Redis for real-time tracking
        from app.core.cache import get_redis_client
        redis_client = await get_redis_client()
        
        if redis_client:
            key = f"usage:{tenant.id}:{datetime.utcnow().date()}"
            await redis_client.lpush(key, str(usage_data))
            await redis_client.expire(key, 86400 * 30)  # Keep for 30 days


class BillingIntegrationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for billing integration hooks.
    Tracks billable events and enforces payment status.
    """
    
    async def dispatch(self, request: Request, call_next):
        """Process billing checks and tracking."""
        # Skip for non-tenant requests
        if not hasattr(request.state, "tenant"):
            return await call_next(request)
        
        tenant = request.state.tenant
        settings = tenant.settings or {}
        
        # Check payment status
        payment_status = settings.get("payment_status", "active")
        if payment_status in ["suspended", "overdue"]:
            # Allow read-only operations
            if request.method not in ["GET", "HEAD", "OPTIONS"]:
                return JSONResponse(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    content={
                        "detail": f"Account is {payment_status}. Please update payment information.",
                        "payment_status": payment_status
                    }
                )
        
        # Track billable events
        billable_endpoints = {
            "/api/v1/contracts": "contract_created",
            "/api/v1/documents": "document_uploaded",
            "/api/v1/rag/process": "ai_processing",
            "/api/v1/templates/render": "template_rendered"
        }
        
        response = await call_next(request)
        
        # Record billable event if successful
        if response.status_code < 400:
            for endpoint, event_type in billable_endpoints.items():
                if endpoint in request.url.path and request.method == "POST":
                    await self._record_billable_event(tenant, event_type, request)
        
        return response
    
    async def _record_billable_event(
        self, 
        tenant: Tenant, 
        event_type: str, 
        request: Request
    ):
        """Record a billable event for the tenant."""
        event = {
            "tenant_id": tenant.id,
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "endpoint": request.url.path,
                "user_id": request.state.user.id if hasattr(request.state, "user") else None
            }
        }
        
        # Store in database for billing processing
        async for db in get_async_session():
            # Create billing event (would need BillingEvent model)
            logger.info(f"Billable event recorded: {event}")
            
            # Also send to external billing system if configured
            await self._send_to_billing_system(event)
    
    async def _send_to_billing_system(self, event: Dict[str, Any]):
        """Send billable event to external billing system."""
        # This would integrate with Stripe, Paddle, or other billing providers
        # For now, just log it
        logger.info(f"Would send to billing system: {event}")
        
        # Example integration point:
        # billing_api_key = os.getenv("BILLING_API_KEY")
        # if billing_api_key:
        #     async with httpx.AsyncClient() as client:
        #         await client.post(
        #             "https://billing-api.example.com/events",
        #             json=event,
        #             headers={"Authorization": f"Bearer {billing_api_key}"}
        #         )