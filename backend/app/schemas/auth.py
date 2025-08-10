"""
Authentication schemas for request/response validation.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class TokenPair(BaseModel):
    """Token pair response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    
    class Config:
        schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "expires_in": 3600
            }
        }


class RefreshTokenRequest(BaseModel):
    """Refresh token request model."""
    refresh_token: str = Field(..., description="The refresh token to use")
    
    class Config:
        schema_extra = {
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }


class LoginRequest(BaseModel):
    """Login request model."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    device_info: Optional[str] = Field(None, description="Device/browser information")
    
    class Config:
        schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword123",
                "device_info": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        }


class LogoutRequest(BaseModel):
    """Logout request model."""
    all_devices: bool = Field(False, description="Logout from all devices")
    
    class Config:
        schema_extra = {
            "example": {
                "all_devices": False
            }
        }


class SessionInfo(BaseModel):
    """Active session information."""
    id: str
    device_info: Optional[str]
    ip_address: Optional[str]
    last_used: Optional[datetime]
    created: datetime
    
    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "device_info": "Chrome on Windows",
                "ip_address": "192.168.1.1",
                "last_used": "2024-01-01T12:00:00",
                "created": "2024-01-01T10:00:00"
            }
        }


class ActiveSessionsResponse(BaseModel):
    """Response containing all active sessions."""
    sessions: List[SessionInfo]
    total: int
    
    class Config:
        schema_extra = {
            "example": {
                "sessions": [
                    {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "device_info": "Chrome on Windows",
                        "ip_address": "192.168.1.1",
                        "last_used": "2024-01-01T12:00:00",
                        "created": "2024-01-01T10:00:00"
                    }
                ],
                "total": 1
            }
        }