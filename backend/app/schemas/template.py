"""
Pydantic schemas for template management.
Defines request and response models for template operations.
"""
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator, EmailStr
from enum import Enum


class TemplateStatus(str, Enum):
    """Template approval status."""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class VariableType(str, Enum):
    """Template variable types."""
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    SELECT = "select"
    MULTISELECT = "multiselect"
    EMAIL = "email"
    URL = "url"
    CURRENCY = "currency"
    PERCENTAGE = "percentage"
    TEXTAREA = "textarea"


class VariableDefinition(BaseModel):
    """Variable definition for templates."""
    name: str = Field(..., min_length=1, max_length=100, regex="^[a-zA-Z][a-zA-Z0-9_]*$")
    type: VariableType = Field(default=VariableType.TEXT)
    display_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    is_required: bool = Field(default=False)
    default_value: Optional[Union[str, int, float, bool]] = None
    validation_rules: Optional[Dict[str, Any]] = Field(default_factory=dict)
    options: Optional[List[Dict[str, str]]] = None  # For select/multiselect
    depends_on: Optional[str] = None
    show_when: Optional[Dict[str, Any]] = None
    format_pattern: Optional[str] = None
    transform: Optional[str] = None
    position: int = Field(default=0)
    group_name: Optional[str] = None

    @validator('options')
    def validate_options(cls, v, values):
        if values.get('type') in [VariableType.SELECT, VariableType.MULTISELECT]:
            if not v or len(v) == 0:
                raise ValueError('Options are required for select/multiselect types')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "name": "company_name",
                "type": "text",
                "display_name": "Company Name",
                "description": "Legal name of the company",
                "is_required": True,
                "validation_rules": {"min_length": 2, "max_length": 100}
            }
        }


class TemplateBase(BaseModel):
    """Base template schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    content: str = Field(..., min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    tags: List[str] = Field(default_factory=list)
    requires_approval: bool = Field(default=False)
    config: Dict[str, Any] = Field(default_factory=dict)
    metadata_fields: Dict[str, Any] = Field(default_factory=dict)


class TemplateCreate(TemplateBase):
    """Schema for creating a template."""
    variables: List[VariableDefinition] = Field(default_factory=list)
    parent_template_id: Optional[int] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Service Agreement Template",
                "description": "Standard service agreement for professional services",
                "content": "This Agreement is between {{company}} and {{client}}...",
                "category": "service_agreement",
                "tags": ["service", "professional", "standard"],
                "variables": [
                    {
                        "name": "company",
                        "type": "text",
                        "display_name": "Company Name",
                        "is_required": True
                    },
                    {
                        "name": "client",
                        "type": "text",
                        "display_name": "Client Name",
                        "is_required": True
                    }
                ]
            }
        }


class TemplateUpdate(BaseModel):
    """Schema for updating a template."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    content: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    subcategory: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    requires_approval: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None
    metadata_fields: Optional[Dict[str, Any]] = None
    variables: Optional[List[VariableDefinition]] = None
    change_summary: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "content": "Updated agreement content...",
                "change_summary": "Added new confidentiality clause"
            }
        }


class TemplateResponse(TemplateBase):
    """Schema for template response."""
    id: int
    tenant_id: int
    version: int
    parent_template_id: Optional[int]
    is_latest_version: bool
    approval_status: TemplateStatus
    is_active: bool
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    approval_comments: Optional[str]
    usage_count: int
    last_used_at: Optional[datetime]
    rating: Optional[float]
    rating_count: int
    created_by: int
    created_at: datetime
    updated_by: Optional[int]
    updated_at: datetime
    variables: List[VariableDefinition]

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    """Schema for template list response."""
    templates: List[TemplateResponse]
    total: int
    page: int
    per_page: int

    class Config:
        json_schema_extra = {
            "example": {
                "templates": [],
                "total": 25,
                "page": 1,
                "per_page": 10
            }
        }


class TemplateVersionResponse(BaseModel):
    """Schema for template version response."""
    id: int
    template_id: int
    version_number: int
    content: str
    change_summary: Optional[str]
    change_type: Optional[str]
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateSearchRequest(BaseModel):
    """Schema for template search request."""
    query: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    approval_status: Optional[TemplateStatus] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    sort_by: str = Field(default="name")
    sort_order: str = Field(default="asc", regex="^(asc|desc)$")
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=10, ge=1, le=100)


class RenderContext(BaseModel):
    """Context for rendering templates."""
    variables: Dict[str, Any] = Field(default_factory=dict)
    conditions: Dict[str, bool] = Field(default_factory=dict)
    formats: Dict[str, str] = Field(default_factory=dict)
    strict_mode: bool = Field(default=True)
    locale: str = Field(default="en-US")

    class Config:
        json_schema_extra = {
            "example": {
                "variables": {
                    "company_name": "TechCorp Inc.",
                    "contract_date": "2024-01-15",
                    "amount": 50000
                },
                "conditions": {
                    "include_warranty": True,
                    "include_support": False
                },
                "formats": {
                    "date": "MMMM d, yyyy",
                    "currency": "USD"
                }
            }
        }


class RenderRequest(BaseModel):
    """Request for rendering a template."""
    template_id: int
    context: RenderContext
    output_format: str = Field(default="html", regex="^(html|pdf|docx|text)$")

    class Config:
        json_schema_extra = {
            "example": {
                "template_id": 1,
                "context": {
                    "variables": {
                        "company_name": "TechCorp Inc.",
                        "client_name": "Client LLC"
                    }
                },
                "output_format": "pdf"
            }
        }


class RenderResponse(BaseModel):
    """Response from template rendering."""
    rendered_content: str
    output_format: str
    render_time_ms: int
    warnings: List[str] = Field(default_factory=list)
    missing_variables: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "rendered_content": "<html>...</html>",
                "output_format": "html",
                "render_time_ms": 150,
                "warnings": [],
                "missing_variables": []
            }
        }


class ClauseLibraryCreate(BaseModel):
    """Schema for creating a clause library entry."""
    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    clause_type: Optional[str] = Field(None, max_length=50)
    tags: List[str] = Field(default_factory=list)
    jurisdiction: Optional[str] = None
    legal_area: Optional[str] = None
    risk_level: Optional[str] = Field(None, regex="^(low|medium|high)$")
    notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Standard Confidentiality Clause",
                "content": "The Receiving Party shall maintain confidentiality...",
                "category": "confidentiality",
                "clause_type": "standard",
                "tags": ["nda", "confidentiality"],
                "risk_level": "low"
            }
        }


class ClauseLibraryResponse(ClauseLibraryCreate):
    """Schema for clause library response."""
    id: int
    tenant_id: int
    version: int
    parent_clause_id: Optional[int]
    is_approved: bool
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    usage_count: int
    last_used_at: Optional[datetime]
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateStatistics(BaseModel):
    """Template usage statistics."""
    template_id: int
    usage_count: int
    unique_users: int
    last_used: Optional[datetime]
    average_rating: Optional[float]
    total_ratings: int
    most_used_variables: Dict[str, int]
    average_render_time_ms: Optional[float]

    class Config:
        json_schema_extra = {
            "example": {
                "template_id": 1,
                "usage_count": 150,
                "unique_users": 45,
                "last_used": "2024-01-15T10:30:00Z",
                "average_rating": 4.5,
                "total_ratings": 20,
                "most_used_variables": {
                    "company_name": 150,
                    "contract_date": 150,
                    "payment_terms": 120
                },
                "average_render_time_ms": 250.5
            }
        }


class TemplateApprovalRequest(BaseModel):
    """Request for template approval."""
    action: str = Field(..., regex="^(approve|reject)$")
    comments: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "action": "approve",
                "comments": "Approved after legal review"
            }
        }


class TemplateCloneRequest(BaseModel):
    """Request for cloning a template."""
    new_name: str = Field(..., min_length=1, max_length=255)
    new_category: Optional[str] = None
    include_variables: bool = Field(default=True)
    include_versions: bool = Field(default=False)

    class Config:
        json_schema_extra = {
            "example": {
                "new_name": "Service Agreement - Modified",
                "new_category": "service_modified",
                "include_variables": True,
                "include_versions": False
            }
        }