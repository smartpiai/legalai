"""
Pydantic schemas for Document Intelligence
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class DocumentType(str, Enum):
    """Types of legal documents."""
    PURCHASE_AGREEMENT = "PURCHASE_AGREEMENT"
    SERVICE_AGREEMENT = "SERVICE_AGREEMENT"
    NDA = "NDA"
    EMPLOYMENT_CONTRACT = "EMPLOYMENT_CONTRACT"
    LEASE_AGREEMENT = "LEASE_AGREEMENT"
    LICENSE_AGREEMENT = "LICENSE_AGREEMENT"
    MASTER_AGREEMENT = "MASTER_AGREEMENT"
    AMENDMENT = "AMENDMENT"
    INVOICE = "INVOICE"
    STATEMENT_OF_WORK = "STATEMENT_OF_WORK"
    TERMS_AND_CONDITIONS = "TERMS_AND_CONDITIONS"
    PRIVACY_POLICY = "PRIVACY_POLICY"
    OTHER = "OTHER"
    UNKNOWN = "UNKNOWN"


class ConfidenceLevel(str, Enum):
    """Confidence levels for predictions."""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Language(str, Enum):
    """Supported languages."""
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    ITALIAN = "it"
    PORTUGUESE = "pt"
    CHINESE = "zh"
    JAPANESE = "ja"
    KOREAN = "ko"
    RUSSIAN = "ru"
    ARABIC = "ar"
    HINDI = "hi"
    DUTCH = "nl"
    POLISH = "pl"
    TURKISH = "tr"
    UNKNOWN = "unknown"


class PageLayout(str, Enum):
    """Page layout types."""
    SINGLE_COLUMN = "SINGLE_COLUMN"
    MULTI_COLUMN = "MULTI_COLUMN"
    MIXED = "MIXED"
    TABLE = "TABLE"
    FORM = "FORM"


# Classification Schemas
class ClassificationRequest(BaseModel):
    """Request for document classification."""
    document_id: int
    content: str
    file_type: str = "pdf"
    use_cache: bool = True
    model_name: Optional[str] = None


class DocumentTypeInfo(BaseModel):
    """Information about a document type."""
    type: DocumentType
    confidence: float = Field(ge=0, le=1)
    
    @validator('confidence')
    def validate_confidence(cls, v):
        return round(v, 3)


class ClassificationResponse(BaseModel):
    """Response from document classification."""
    document_id: int
    primary_type: DocumentType
    confidence: float = Field(ge=0, le=1)
    confidence_level: ConfidenceLevel
    secondary_types: List[DocumentTypeInfo] = Field(default_factory=list)
    features_detected: str
    keywords: List[str] = Field(default_factory=list)
    entities: Dict[str, List[str]] = Field(default_factory=dict)
    requires_review: bool = False
    model_name: str
    model_version: str
    processing_time: Optional[float] = None
    
    class Config:
        from_attributes = True


class BatchClassificationRequest(BaseModel):
    """Request for batch classification."""
    documents: List[Dict[str, Any]]
    model_name: Optional[str] = None
    parallel_processing: bool = True


class TrainingDataItem(BaseModel):
    """Training data for custom classifier."""
    content: str
    type: DocumentType
    metadata: Optional[Dict[str, Any]] = None


class ModelTrainingRequest(BaseModel):
    """Request to train custom classifier."""
    training_data: List[TrainingDataItem]
    model_name: str
    model_type: str = "sklearn"
    test_split: float = Field(default=0.2, ge=0.1, le=0.5)


# Language Detection Schemas
class LanguageDetectionRequest(BaseModel):
    """Request for language detection."""
    document_id: int
    content: str
    target_language: Optional[Language] = None
    detect_segments: bool = False


class LanguageSegment(BaseModel):
    """Language segment in document."""
    start: int
    end: int
    language: Language
    confidence: float = Field(ge=0, le=1)
    text: Optional[str] = None


class LanguageDetectionResponse(BaseModel):
    """Response from language detection."""
    document_id: int
    primary_language: Language
    confidence: float = Field(ge=0, le=1)
    script: Optional[str] = None
    is_multilingual: bool = False
    languages_detected: List[Language] = Field(default_factory=list)
    language_segments: List[LanguageSegment] = Field(default_factory=list)
    translation_required: bool = False
    target_language: Optional[Language] = None
    requires_review: bool = False
    
    class Config:
        from_attributes = True


class SegmentLanguageRequest(BaseModel):
    """Request for segment language detection."""
    document_id: int
    segments: List[str]


class SegmentLanguageResponse(BaseModel):
    """Response for segment language detection."""
    segment_index: int
    language: Language
    confidence: float = Field(ge=0, le=1)


# Page Processing Schemas
class PageProcessingRequest(BaseModel):
    """Request for page processing."""
    document_id: int
    page_number: int = Field(ge=1)
    page_content: Optional[bytes] = None
    page_text: Optional[str] = None
    extract_layout: bool = True
    extract_tables: bool = False
    extract_images: bool = False
    extract_headers_footers: bool = False
    segment_content: bool = False
    detect_signatures: bool = False
    assess_quality: bool = False


class PageSegment(BaseModel):
    """Segment of page content."""
    segment_type: str  # heading, paragraph, list, table, etc.
    content: str
    bbox: Optional[List[float]] = None  # Bounding box [x, y, width, height]
    confidence: float = Field(ge=0, le=1)
    style: Optional[Dict[str, Any]] = None  # Font, size, color, etc.


class TableInfo(BaseModel):
    """Table information."""
    rows: int
    columns: int
    cells: Optional[List[List[str]]] = None
    bbox: Optional[List[float]] = None
    has_header: bool = False


class ImageInfo(BaseModel):
    """Image information."""
    width: int
    height: int
    format: str
    bbox: Optional[List[float]] = None
    caption: Optional[str] = None


class SignatureRegion(BaseModel):
    """Signature region information."""
    bbox: List[float]
    is_signed: bool = False
    signer_name: Optional[str] = None
    signature_date: Optional[str] = None


class PageProcessingResponse(BaseModel):
    """Response from page processing."""
    document_id: int
    page_number: int
    layout_type: PageLayout
    columns_detected: int = 1
    orientation: str = "portrait"
    
    # Page components
    has_header: bool = False
    has_footer: bool = False
    header: Optional[str] = None
    footer: Optional[str] = None
    page_margins: Optional[Dict[str, float]] = None
    
    # Content elements
    segments: List[PageSegment] = Field(default_factory=list)
    tables: List[TableInfo] = Field(default_factory=list)
    images: List[ImageInfo] = Field(default_factory=list)
    
    # Special regions
    has_signatures: bool = False
    signature_regions: List[SignatureRegion] = Field(default_factory=list)
    
    # Quality metrics
    quality_score: Optional[float] = Field(None, ge=0, le=1)
    quality_issues: List[str] = Field(default_factory=list)
    
    # Statistics
    word_count: int = 0
    line_count: int = 0
    
    processing_time: Optional[float] = None
    
    class Config:
        from_attributes = True


class BatchPageProcessingRequest(BaseModel):
    """Request for batch page processing."""
    document_id: int
    pages: List[Dict[str, Any]]
    parallel_processing: bool = True


# Model Management Schemas
class ModelInfoResponse(BaseModel):
    """Information about a trained model."""
    id: int
    model_name: str
    model_type: str
    version: str
    accuracy: float
    precision: Optional[float]
    recall: Optional[float]
    f1_score: Optional[float]
    training_samples: int
    training_date: datetime
    is_active: bool
    
    class Config:
        from_attributes = True


class ModelDeployRequest(BaseModel):
    """Request to deploy a model."""
    model_id: int
    activate: bool = True
    deactivate_others: bool = False


# Processing Queue Schemas
class QueueTaskRequest(BaseModel):
    """Request to queue a processing task."""
    document_id: int
    task_type: str  # classification, language, page_processing
    priority: int = Field(default=5, ge=1, le=10)


class QueueStatusResponse(BaseModel):
    """Queue status response."""
    task_id: int
    document_id: int
    task_type: str
    status: str
    priority: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    processing_time: Optional[float]
    success: Optional[bool]
    error_message: Optional[str]
    
    class Config:
        from_attributes = True


# Analytics Schemas
class ClassificationAnalytics(BaseModel):
    """Classification analytics."""
    total_documents: int
    documents_by_type: Dict[str, int]
    avg_confidence: float
    low_confidence_count: int
    review_required_count: int
    processing_time_avg: float


class LanguageAnalytics(BaseModel):
    """Language analytics."""
    total_documents: int
    documents_by_language: Dict[str, int]
    multilingual_documents: int
    translation_required: int
    avg_confidence: float


class ProcessingAnalytics(BaseModel):
    """Processing analytics."""
    total_processed: int
    pending_tasks: int
    failed_tasks: int
    avg_processing_time: float
    success_rate: float