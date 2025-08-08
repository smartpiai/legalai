"""
Pydantic schemas for API validation and serialization.
"""
from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB,
    UserResponse,
    UserLogin,
    Token,
    TokenPayload,
    PasswordReset,
    PasswordResetConfirm
)
from app.schemas.tenant import (
    TenantBase,
    TenantCreate,
    TenantUpdate,
    TenantInDB,
    TenantResponse
)
from app.schemas.contract import (
    ContractBase,
    ContractCreate,
    ContractUpdate,
    ContractInDB,
    ContractResponse,
    ContractSearch
)

__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserInDB",
    "UserResponse",
    "UserLogin",
    "Token",
    "TokenPayload",
    "PasswordReset",
    "PasswordResetConfirm",
    # Tenant schemas
    "TenantBase",
    "TenantCreate",
    "TenantUpdate",
    "TenantInDB",
    "TenantResponse",
    # Contract schemas
    "ContractBase",
    "ContractCreate",
    "ContractUpdate",
    "ContractInDB",
    "ContractResponse",
    "ContractSearch",
]