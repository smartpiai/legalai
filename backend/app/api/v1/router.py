"""
Main API router for v1 endpoints
"""
from fastapi import APIRouter

api_router = APIRouter()

# Import and include routers as they become available
try:
    from app.api.v1 import auth
    api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
except ImportError:
    pass

try:
    from app.api.v1 import users
    api_router.include_router(users.router, prefix="/users", tags=["users"])
except ImportError:
    pass

try:
    from app.api.v1 import tenants  
    api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
except ImportError:
    pass

try:
    from app.api.v1 import contracts
    api_router.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
except ImportError:
    pass

try:
    from app.api.v1 import documents
    api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
except ImportError:
    pass

try:
    from app.api.v1 import extraction
    api_router.include_router(extraction.router, prefix="/extraction", tags=["extraction"])
except ImportError:
    pass

try:
    from app.api.v1 import workflows
    api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
except ImportError:
    pass

try:
    from app.api.v1 import rag
    api_router.include_router(rag.router, prefix="/rag", tags=["rag", "ai", "search"])
except ImportError:
    pass

try:
    from app.api.v1 import templates
    api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
except ImportError:
    pass

try:
    from app.api.v1 import notifications
    api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
except ImportError:
    pass

try:
    from app.api.v1 import search
    api_router.include_router(search.router, prefix="/search", tags=["search"])
except ImportError:
    pass

try:
    from app.api.v1 import access_control
    api_router.include_router(access_control.router, prefix="/access-control", tags=["access-control"])
except ImportError:
    pass

try:
    from app.api.v1 import audit_compliance
    api_router.include_router(audit_compliance.router, prefix="/audit-compliance", tags=["audit-compliance"])
except ImportError:
    pass

try:
    from app.api.v1 import dashboard
    api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
except ImportError:
    pass

# Future endpoints can be added here
# - analysis  
# - integrations
