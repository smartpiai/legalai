"""
Document schemas for API validation.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator
from fastapi import UploadFile
import re


class DocumentBase(BaseModel):
    """Base document schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class DocumentCreate(BaseModel):
    """Schema for creating a document."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    contract_id: Optional[int] = None
    parent_document_id: Optional[int] = None
    version_notes: Optional[str] = Field(None, max_length=500)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    contract_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    extraction_status: Optional[str] = None


class DocumentResponse(BaseModel):
    """Document response schema."""
    id: int
    name: str
    description: Optional[str] = None
    file_path: str
    file_size: int
    mime_type: str
    checksum: Optional[str] = None
    contract_id: Optional[int] = None
    tenant_id: int
    uploaded_by: Optional[int] = None
    metadata: Dict[str, Any]
    is_active: bool = True
    extraction_status: Optional[str] = "pending"
    extraction_error: Optional[str] = None
    version: int = 1
    parent_document_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    """Response for paginated document list."""
    items: List[DocumentResponse]
    total: int
    limit: int
    offset: int


class DocumentDownloadResponse(BaseModel):
    """Response for document download request."""
    download_url: str
    expires_in: int = Field(default=3600, description="URL expiration in seconds")
    file_name: str
    mime_type: str
    file_size: int


class DocumentUploadResponse(DocumentResponse):
    """Response after successful document upload."""
    upload_status: str = "success"
    storage_path: str


class DocumentSearchParams(BaseModel):
    """Document search parameters."""
    search: Optional[str] = None
    contract_id: Optional[int] = None
    mime_type: Optional[str] = None
    extraction_status: Optional[str] = None
    uploaded_by: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_size: Optional[int] = Field(None, ge=0)
    max_size: Optional[int] = Field(None, ge=0)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class DocumentMetadata(BaseModel):
    """Document metadata schema."""
    pages: Optional[int] = None
    author: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[List[str]] = None
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None
    language: Optional[str] = None
    extracted_text: Optional[str] = None
    entities: Optional[Dict[str, List[str]]] = None  # Named entities
    custom: Optional[Dict[str, Any]] = None  # Custom metadata


class DocumentValidation(BaseModel):
    """Document validation result."""
    is_valid: bool
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    file_type: str
    file_size: int
    scan_results: Optional[Dict[str, Any]] = None


class AllowedFileTypes:
    """Allowed file types for upload."""
    DOCUMENTS = {
        'application/pdf': ['.pdf'],
        'application/msword': ['.doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        'application/vnd.ms-excel': ['.xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'text/plain': ['.txt'],
        'text/csv': ['.csv'],
        'application/rtf': ['.rtf'],
    }
    
    IMAGES = {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/gif': ['.gif'],
        'image/tiff': ['.tiff', '.tif'],
        'image/bmp': ['.bmp'],
    }
    
    @classmethod
    def is_allowed(cls, mime_type: str, filename: str) -> bool:
        """Check if file type is allowed."""
        all_types = {**cls.DOCUMENTS, **cls.IMAGES}
        if mime_type not in all_types:
            return False
        
        # Check file extension
        ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        return ext in all_types.get(mime_type, [])
    
    @classmethod
    def get_max_size(cls, mime_type: str) -> int:
        """Get maximum file size for mime type (in bytes)."""
        if mime_type in cls.IMAGES:
            return 10 * 1024 * 1024  # 10MB for images
        return 100 * 1024 * 1024  # 100MB for documents