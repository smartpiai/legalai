"""
Report schemas for API validation
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator
from enum import Enum


class ReportFormat(str, Enum):
    """Supported report formats"""
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    HTML = "html"
    JSON = "json"


class ReportStatus(str, Enum):
    """Report generation status"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ReportParameterSchema(BaseModel):
    """Report parameter schema"""
    name: str
    type: str
    required: bool = False
    default: Optional[Any] = None
    description: Optional[str] = None
    options: Optional[List[str]] = None


class ReportTemplateSchema(BaseModel):
    """Report template schema"""
    id: str
    name: str
    type: str
    category: str
    description: str
    template_file: str
    parameters: List[ReportParameterSchema]
    supported_formats: List[ReportFormat]
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class GenerateReportRequest(BaseModel):
    """Request to generate a report"""
    template_id: str = Field(..., description="Report template ID")
    name: Optional[str] = Field(None, description="Report name")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Report parameters")
    format: ReportFormat = Field(ReportFormat.PDF, description="Output format")
    recipients: Optional[List[str]] = Field(default_factory=list, description="Email recipients")
    schedule: Optional[Dict[str, Any]] = Field(None, description="Schedule configuration")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")
    user_id: Optional[str] = Field(None, description="User ID")

    @validator('recipients')
    def validate_emails(cls, v):
        """Validate email addresses"""
        if v:
            for email in v:
                if '@' not in email:
                    raise ValueError(f"Invalid email address: {email}")
        return v


class ReportStatusResponse(BaseModel):
    """Report status response"""
    id: Optional[str] = None
    status: ReportStatus
    progress: int = Field(0, ge=0, le=100)
    message: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    error_message: Optional[str] = None
    download_url: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ReportHistoryItem(BaseModel):
    """Report history item"""
    id: str
    template_id: str
    template_name: str
    name: str
    format: ReportFormat
    status: ReportStatus
    created_at: datetime
    completed_at: Optional[datetime] = None
    created_by: str
    file_size: Optional[int] = None
    download_url: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ReportScheduleRequest(BaseModel):
    """Request to schedule a report"""
    template_id: str
    name: str
    frequency: str = Field(..., pattern="^(daily|weekly|monthly|quarterly|yearly)$")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    format: ReportFormat = ReportFormat.PDF
    recipients: List[str]
    day_of_week: Optional[int] = Field(None, ge=0, le=6)  # 0=Monday, 6=Sunday
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    time: str = Field("09:00", pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    timezone: str = Field("UTC")
    is_active: bool = True


class ReportScheduleResponse(BaseModel):
    """Report schedule response"""
    id: str
    template_id: str
    name: str
    frequency: str
    next_run: datetime
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ReportMetricsResponse(BaseModel):
    """Report metrics response"""
    total_reports: int
    reports_this_month: int
    reports_this_week: int
    avg_generation_time: float = Field(..., description="Average time in seconds")
    success_rate: float = Field(..., ge=0, le=100, description="Success rate percentage")
    most_used_templates: List[Dict[str, Any]]
    recent_failures: List[Dict[str, Any]]
    storage_used: int = Field(..., description="Storage used in bytes")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ReportShareRequest(BaseModel):
    """Request to share a report"""
    report_id: str
    expiry_hours: int = Field(24, ge=1, le=168)  # Max 1 week
    password_protected: bool = False
    password: Optional[str] = None
    allow_download: bool = True
    notify_recipients: bool = False
    recipients: Optional[List[str]] = None


class ReportShareResponse(BaseModel):
    """Report share response"""
    share_url: str
    expires_at: datetime
    password_protected: bool
    share_id: str

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ReportExportRequest(BaseModel):
    """Request to export report data"""
    report_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    format: str = Field(..., pattern="^(csv|json|xml|xlsx)$")
    include_metadata: bool = False
    filters: Optional[Dict[str, Any]] = None


class ReportExportResponse(BaseModel):
    """Report export response"""
    format: str
    size: int
    download_url: str
    expires_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class BulkReportRequest(BaseModel):
    """Request to generate multiple reports"""
    template_id: str
    entities: List[str] = Field(..., description="List of entity IDs to generate reports for")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    format: ReportFormat = ReportFormat.PDF
    merge_into_single: bool = False
    zip_archive: bool = True


class BulkReportResponse(BaseModel):
    """Bulk report generation response"""
    job_id: str
    total_reports: int
    status: str
    created_at: datetime
    estimated_completion: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }