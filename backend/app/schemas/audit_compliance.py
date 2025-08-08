"""
Pydantic schemas for Audit & Compliance
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class SignatureStatus(str, Enum):
    """Digital signature status."""
    PENDING = "PENDING"
    VALID = "VALID"
    INVALID = "INVALID"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


class SignatureType(str, Enum):
    """Types of digital signatures."""
    APPROVAL = "APPROVAL"
    WITNESS = "WITNESS"
    NOTARY = "NOTARY"
    CERTIFICATION = "CERTIFICATION"
    ACKNOWLEDGMENT = "ACKNOWLEDGMENT"


class EvidenceType(str, Enum):
    """Types of evidence chains."""
    DOCUMENT = "DOCUMENT"
    CONTRACT = "CONTRACT"
    TRANSACTION = "TRANSACTION"
    COMMUNICATION = "COMMUNICATION"
    AUDIT = "AUDIT"


class ChainStatus(str, Enum):
    """Evidence chain status."""
    ACTIVE = "ACTIVE"
    SEALED = "SEALED"
    ARCHIVED = "ARCHIVED"
    COMPROMISED = "COMPROMISED"


# Certificate Schemas
class CertificateCreate(BaseModel):
    """Request to create a new signature certificate."""
    user_id: int
    validity_days: int = Field(default=365, ge=1, le=1095)
    key_size: int = Field(default=2048, ge=2048)
    key_usage: List[str] = Field(default=["digital_signature", "non_repudiation"])


class CertificateResponse(BaseModel):
    """Certificate response."""
    id: int
    user_id: int
    serial_number: str
    issuer: str
    subject: str
    valid_from: datetime
    valid_to: datetime
    is_active: bool
    public_key: str
    
    class Config:
        from_attributes = True


# Digital Signature Schemas
class SignatureRequest(BaseModel):
    """Request to create a digital signature."""
    document_id: int
    signer_id: int
    certificate_id: int
    signature_type: SignatureType = SignatureType.APPROVAL
    reason: Optional[str] = None
    location: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SignatureVerifyRequest(BaseModel):
    """Request to verify a signature."""
    signature_id: int
    document_content: Optional[bytes] = None


class SignatureResponse(BaseModel):
    """Digital signature response."""
    id: int
    document_id: int
    signer_id: int
    certificate_id: int
    signature_type: str
    document_hash: str
    timestamp: datetime
    status: SignatureStatus
    is_valid: bool
    reason: Optional[str]
    location: Optional[str]
    
    class Config:
        from_attributes = True


class BatchSignRequest(BaseModel):
    """Request for batch signing multiple documents."""
    document_ids: List[int]
    signer_id: int
    certificate_id: int
    signature_type: SignatureType = SignatureType.APPROVAL
    reason: Optional[str] = None


class BatchSignResponse(BaseModel):
    """Response for batch signing."""
    success: bool
    signed_count: int
    failed_count: int
    results: List[Dict[str, Any]]


# Signature Workflow Schemas
class SignatureWorkflowCreate(BaseModel):
    """Create a multi-signature workflow."""
    document_id: int
    workflow_name: str
    signers: List[int]
    require_all: bool = True
    signing_order: Optional[List[int]] = None
    deadline: Optional[datetime] = None


class SignatureWorkflowResponse(BaseModel):
    """Signature workflow response."""
    id: int
    document_id: int
    workflow_name: str
    total_required: int
    completed_count: int
    require_all: bool
    signers: List[int]
    signed_by: List[int]
    status: str
    deadline: Optional[datetime]
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Time-stamping Schemas
class TimeStampRequest(BaseModel):
    """Request to create a timestamp."""
    document_id: int
    hash_value: str
    hash_algorithm: str = "SHA256"
    timestamp_authority: str = "internal"
    nonce: Optional[str] = None


class TimeStampResponse(BaseModel):
    """Timestamp response."""
    id: int
    document_id: int
    hash_value: str
    hash_algorithm: str
    timestamp: datetime
    timestamp_token: str
    timestamp_authority: str
    serial_number: str
    verified: bool
    
    class Config:
        from_attributes = True


class TimeStampVerifyRequest(BaseModel):
    """Request to verify a timestamp."""
    timestamp_id: int
    document_hash: str


class RFC3161Response(BaseModel):
    """RFC 3161 compliant timestamp response."""
    timestamp: datetime
    hash_algorithm: str
    hash_value: str
    tsa_certificate: str
    serial_number: str
    accuracy: Optional[float]
    ordering: bool
    nonce: Optional[str]


# Evidence Chain Schemas
class EvidenceChainCreate(BaseModel):
    """Create a new evidence chain."""
    document_id: Optional[int] = None
    chain_type: EvidenceType = EvidenceType.DOCUMENT
    created_by: int
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class EvidenceChainResponse(BaseModel):
    """Evidence chain response."""
    id: int
    document_id: Optional[int]
    chain_type: str
    chain_id: str
    status: ChainStatus
    created_by: int
    entry_count: int
    hash_pointer: str
    last_entry_hash: Optional[str]
    created_at: datetime
    sealed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class EvidenceEntryAdd(BaseModel):
    """Add an entry to evidence chain."""
    action: str = Field(..., min_length=1, max_length=255)
    actor_id: int
    details: Optional[Dict[str, Any]] = Field(default_factory=dict)
    evidence_hash: Optional[str] = None
    evidence_location: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class EvidenceEntryResponse(BaseModel):
    """Evidence entry response."""
    id: int
    chain_id: int
    entry_number: int
    previous_hash: str
    entry_hash: str
    action: str
    actor_id: int
    timestamp: datetime
    details: Dict[str, Any]
    is_sealed: bool
    
    class Config:
        from_attributes = True


class ChainVerificationResult(BaseModel):
    """Result of chain integrity verification."""
    is_valid: bool
    chain_id: int
    total_entries: int
    valid_entries: int
    invalid_entries: List[int]
    verification_time: datetime
    details: Optional[Dict[str, Any]] = None


class ChainExportRequest(BaseModel):
    """Request to export evidence chain."""
    chain_id: int
    format: str = Field(default="JSON", pattern="^(JSON|XML|PDF)$")
    include_evidence: bool = False
    sign_export: bool = False


class ChainExportResponse(BaseModel):
    """Evidence chain export response."""
    chain_id: int
    format: str
    export_time: datetime
    entries: List[Dict[str, Any]]
    verification_hash: str
    signed: bool
    signature_id: Optional[int] = None


# Compliance Report Schemas
class ComplianceReportRequest(BaseModel):
    """Request to generate compliance report."""
    document_id: Optional[int] = None
    report_type: str
    start_date: datetime
    end_date: datetime
    include_evidence_chains: bool = True
    include_signatures: bool = True
    include_timestamps: bool = True


class ComplianceReportResponse(BaseModel):
    """Compliance report response."""
    id: int
    document_id: Optional[int]
    report_type: str
    report_period_start: datetime
    report_period_end: datetime
    generated_by: int
    compliance_status: str
    issues_found: int
    total_actions: int
    unique_actors: int
    chain_validity: bool
    timeline: List[Dict[str, Any]]
    recommendations: List[str]
    report_hash: str
    
    class Config:
        from_attributes = True


# Audit Trail Schemas
class AuditTrailRequest(BaseModel):
    """Request for audit trail."""
    document_id: int
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_signatures: bool = True
    include_timestamps: bool = True
    include_evidence: bool = True


class AuditTrailResponse(BaseModel):
    """Complete audit trail response."""
    document_id: int
    total_events: int
    signatures: List[SignatureResponse]
    timestamps: List[TimeStampResponse]
    evidence_entries: List[EvidenceEntryResponse]
    timeline: List[Dict[str, Any]]
    integrity_verified: bool


# Revocation Schemas
class SignatureRevokeRequest(BaseModel):
    """Request to revoke a signature."""
    signature_id: int
    revoked_by: int
    reason: str = Field(..., min_length=1, max_length=500)


class CertificateRevokeRequest(BaseModel):
    """Request to revoke a certificate."""
    certificate_id: int
    revoked_by: int
    reason: str = Field(..., min_length=1, max_length=500)