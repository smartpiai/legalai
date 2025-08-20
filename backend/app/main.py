"""
Main FastAPI application with comprehensive middleware and configuration.
"""
import uuid
import time
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import init_database, async_engine
from app.api.v1.health import router as health_router
from app.core.middleware import (
    TenantAwareMiddleware,
    ResourceQuotaMiddleware,
    BillingIntegrationMiddleware
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'"
        )
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        
        return response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add unique request ID to all requests."""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware."""
    
    def __init__(self, app, calls: int = 60, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.clients: Dict[str, list] = {}
    
    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        
        # Clean old entries
        if client_ip in self.clients:
            self.clients[client_ip] = [
                timestamp for timestamp in self.clients[client_ip]
                if timestamp > now - self.period
            ]
        
        # Check rate limit
        if client_ip in self.clients and len(self.clients[client_ip]) >= self.calls:
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded"},
            )
            response.headers["Retry-After"] = str(self.period)
            response.headers["X-RateLimit-Limit"] = str(self.calls)
            response.headers["X-RateLimit-Remaining"] = "0"
            return response
        
        # Track request
        if client_ip not in self.clients:
            self.clients[client_ip] = []
        self.clients[client_ip].append(now)
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.calls)
        response.headers["X-RateLimit-Remaining"] = str(
            self.calls - len(self.clients[client_ip])
        )
        
        return response


async def close_database():
    """Close database connections."""
    await async_engine.dispose()


async def init_storage_and_collections():
    """Initialize required storage buckets and vector collections."""
    try:
        # Initialize MinIO bucket
        from app.core.storage import get_storage_client, create_bucket
        client = await get_storage_client()
        bucket_name = 'legal-documents'
        await create_bucket(client, bucket_name)
        print(f"✓ MinIO bucket '{bucket_name}' initialized")
        
        # Initialize Qdrant collections
        from app.core.vector_store import get_qdrant_client, create_collection
        qdrant = await get_qdrant_client()
        await qdrant.connect()
        
        # Create collections if they don't exist
        collections = await qdrant.list_collections()
        existing_names = {c['name'] for c in collections}
        
        required_collections = [
            ('documents', 384),
            ('contracts', 384)
        ]
        
        for coll_name, vector_size in required_collections:
            if coll_name not in existing_names:
                await create_collection(qdrant, coll_name, vector_size)
                print(f"✓ Qdrant collection '{coll_name}' created")
            else:
                print(f"✓ Qdrant collection '{coll_name}' already exists")
                
    except Exception as e:
        print(f"Warning: Failed to initialize storage/collections: {e}")
        # Don't fail startup, just log the error


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    print("Starting up Legal AI Platform...")
    await init_database()
    print("Database initialized")
    
    # Initialize storage and vector collections
    await init_storage_and_collections()
    print("Storage and collections initialized")
    
    yield
    
    # Shutdown
    print("Shutting down Legal AI Platform...")
    await close_database()
    print("Cleanup complete")


# Create FastAPI app
app = FastAPI(
    title="Legal AI Platform",
    description="Enterprise Contract Lifecycle Management with AI",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={
        "name": "Legal AI Team",
        "email": "support@legalai.com",
    },
    license_info={
        "name": "Proprietary",
        "url": "https://legalai.com/license",
    },
)

# Add middleware in correct order (executed in reverse order)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    RateLimitMiddleware,
    calls=settings.RATE_LIMIT_PER_MINUTE if hasattr(settings, 'RATE_LIMIT_PER_MINUTE') else 60,
    period=60
)
# Add tenant-aware middleware
app.add_middleware(TenantAwareMiddleware)
app.add_middleware(ResourceQuotaMiddleware)
app.add_middleware(BillingIntegrationMiddleware)


# Exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "request_id": getattr(request.state, "request_id", None)
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    # Print the detailed error to the console for debugging
    print(f"Caught validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "request_id": getattr(request.state, "request_id", None)
        },
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "detail": "The requested resource was not found",
            "path": str(request.url.path),
            "request_id": getattr(request.state, "request_id", None)
        },
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle internal server errors."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred",
            "request_id": getattr(request.state, "request_id", None)
        },
    )


# Root endpoint
@app.get("/", tags=["root"])
async def root():
    """Root health check endpoint."""
    return {
        "status": "healthy",
        "service": "Legal AI Platform",
        "version": settings.VERSION,
        "docs": "/docs",
        "api": settings.API_V1_STR
    }


# Include routers
app.include_router(health_router, prefix="/api/v1", tags=["health"])

# Try to include API router if it exists
try:
    from app.api.v1.router import api_router
    app.include_router(api_router, prefix=settings.API_V1_STR)
except ImportError:
    pass  # API router not yet implemented


# Additional root health for load balancers
@app.get("/health", tags=["health"])
async def simple_health():
    """Simple health check for load balancers."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
