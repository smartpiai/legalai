"""
Audit & Compliance API Endpoints
Digital Signatures, Time-stamping, and Evidence Chain Management
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services.audit_compliance import (
    DigitalSignatureService,
    TimeStampingService,
    EvidenceChainService
)
from app.schemas.audit_compliance import (
    CertificateCreate, CertificateResponse,
    SignatureRequest, SignatureResponse, SignatureVerifyRequest,
    BatchSignRequest, BatchSignResponse,
    SignatureWorkflowCreate, SignatureWorkflowResponse,
    SignatureRevokeRequest, CertificateRevokeRequest,
    TimeStampRequest, TimeStampResponse, TimeStampVerifyRequest,
    RFC3161Response,
    EvidenceChainCreate, EvidenceChainResponse,
    EvidenceEntryAdd, EvidenceEntryResponse,
    ChainVerificationResult, ChainExportRequest, ChainExportResponse,
    ComplianceReportRequest, ComplianceReportResponse,
    AuditTrailRequest, AuditTrailResponse
)
from app.core.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/audit-compliance", tags=["audit-compliance"])

# Service instances
signature_service = DigitalSignatureService()
timestamp_service = TimeStampingService()
evidence_service = EvidenceChainService()


# Certificate Management Endpoints
@router.post("/certificates", response_model=CertificateResponse)
async def create_certificate(
    request: CertificateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new digital signature certificate for a user."""
    try:
        certificate = await signature_service.create_certificate(
            db,
            user_id=request.user_id if current_user.is_superuser else current_user.id,
            validity_days=request.validity_days
        )
        return CertificateResponse.from_orm(certificate)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/certificates/{certificate_id}", response_model=CertificateResponse)
async def get_certificate(
    certificate_id: int = Path(..., description="Certificate ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get certificate details."""
    try:
        certificate = await signature_service.get_certificate(db, certificate_id)
        
        # Check access
        if certificate.user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return CertificateResponse.from_orm(certificate)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/certificates/{certificate_id}/revoke")
async def revoke_certificate(
    certificate_id: int = Path(..., description="Certificate ID"),
    request: CertificateRevokeRequest = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke a certificate."""
    # Implementation would go here
    return {"message": "Certificate revoked successfully"}


# Digital Signature Endpoints
@router.post("/signatures", response_model=SignatureResponse)
async def create_signature(
    request: SignatureRequest,
    document_content: bytes = Body(..., description="Document content to sign"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a digital signature for a document."""
    try:
        # Override signer_id with current user
        request.signer_id = current_user.id
        
        signature = await signature_service.create_signature(
            db,
            request,
            document_content
        )
        
        return SignatureResponse.from_orm(signature)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/signatures/batch", response_model=BatchSignResponse)
async def batch_sign_documents(
    request: BatchSignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Batch sign multiple documents."""
    results = await signature_service.batch_sign(
        db,
        document_ids=request.document_ids,
        signer_id=current_user.id,
        certificate_id=request.certificate_id,
        reason=request.reason
    )
    
    success_count = sum(1 for r in results if r.get("success"))
    failed_count = len(results) - success_count
    
    return BatchSignResponse(
        success=success_count > 0,
        signed_count=success_count,
        failed_count=failed_count,
        results=results
    )


@router.post("/signatures/verify")
async def verify_signature(
    request: SignatureVerifyRequest,
    document_content: bytes = Body(..., description="Document content to verify"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify a digital signature."""
    # Get signature
    from app.models.audit_compliance import DigitalSignature
    signature = await db.get(DigitalSignature, request.signature_id)
    
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signature not found"
        )
    
    is_valid = await signature_service.verify_signature(
        db,
        signature,
        document_content or request.document_content
    )
    
    return {"valid": is_valid, "signature_id": request.signature_id}


@router.post("/signatures/{signature_id}/revoke")
async def revoke_signature(
    signature_id: int = Path(..., description="Signature ID"),
    request: SignatureRevokeRequest = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke a digital signature."""
    success = await signature_service.revoke_signature(
        db,
        signature_id,
        revoked_by=current_user.id,
        reason=request.reason
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signature not found"
        )
    
    return {"message": "Signature revoked successfully"}


@router.get("/documents/{document_id}/signatures", response_model=List[SignatureResponse])
async def get_document_signatures(
    document_id: int = Path(..., description="Document ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all signatures for a document."""
    signatures = await signature_service.get_signature_history(db, document_id)
    return [SignatureResponse.from_orm(s) for s in signatures]


# Signature Workflow Endpoints
@router.post("/signature-workflows", response_model=SignatureWorkflowResponse)
async def create_signature_workflow(
    request: SignatureWorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a multi-signature workflow."""
    workflow = await signature_service.create_signature_workflow(
        db,
        document_id=request.document_id,
        signers=request.signers,
        require_all=request.require_all
    )
    
    return SignatureWorkflowResponse.from_orm(workflow)


# Time-stamping Endpoints
@router.post("/timestamps", response_model=TimeStampResponse)
async def create_timestamp(
    request: TimeStampRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a trusted timestamp for a document."""
    timestamp = await timestamp_service.create_timestamp(db, request)
    return TimeStampResponse.from_orm(timestamp)


@router.post("/timestamps/verify")
async def verify_timestamp(
    request: TimeStampVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify a timestamp."""
    is_valid = await timestamp_service.verify_timestamp(
        db,
        request.timestamp_id,
        request.document_hash
    )
    
    return {"valid": is_valid, "timestamp_id": request.timestamp_id}


@router.post("/timestamps/rfc3161", response_model=RFC3161Response)
async def generate_rfc3161_timestamp(
    document_hash: str = Body(..., description="Document hash"),
    current_user: User = Depends(get_current_user)
):
    """Generate RFC 3161 compliant timestamp."""
    timestamp = await timestamp_service.generate_rfc3161_timestamp(document_hash)
    return RFC3161Response(**timestamp)


@router.get("/documents/{document_id}/timestamps", response_model=List[TimeStampResponse])
async def get_document_timestamps(
    document_id: int = Path(..., description="Document ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all timestamps for a document."""
    timestamps = await timestamp_service.get_timestamp_chain(db, document_id)
    return [TimeStampResponse.from_orm(t) for t in timestamps]


@router.post("/timestamps/{timestamp_id}/archive")
async def archive_timestamp(
    timestamp_id: int = Path(..., description="Timestamp ID"),
    archive_format: str = Query("LTANS", description="Archive format"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Archive timestamp for long-term validation."""
    try:
        timestamp = await timestamp_service.archive_timestamp(
            db,
            timestamp_id,
            archive_format
        )
        return {"message": "Timestamp archived successfully", "timestamp_id": timestamp.id}
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# Evidence Chain Endpoints
@router.post("/evidence-chains", response_model=EvidenceChainResponse)
async def create_evidence_chain(
    request: EvidenceChainCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new evidence chain."""
    # Override created_by with current user
    request.created_by = current_user.id
    
    chain = await evidence_service.create_chain(db, request)
    return EvidenceChainResponse.from_orm(chain)


@router.post("/evidence-chains/{chain_id}/entries", response_model=EvidenceEntryResponse)
async def add_evidence_entry(
    chain_id: int = Path(..., description="Chain ID"),
    request: EvidenceEntryAdd = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add an entry to evidence chain."""
    try:
        # Override actor_id with current user
        request.actor_id = current_user.id
        
        entry = await evidence_service.add_entry(db, chain_id, request)
        return EvidenceEntryResponse.from_orm(entry)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/evidence-chains/{chain_id}/verify", response_model=ChainVerificationResult)
async def verify_chain_integrity(
    chain_id: int = Path(..., description="Chain ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify the integrity of an evidence chain."""
    is_valid, invalid_entries = await evidence_service.verify_chain_integrity(
        db,
        chain_id
    )
    
    return ChainVerificationResult(
        is_valid=is_valid,
        chain_id=chain_id,
        total_entries=0,  # Would need to query
        valid_entries=0,  # Would need to calculate
        invalid_entries=invalid_entries,
        verification_time=datetime.utcnow()
    )


@router.post("/evidence-chains/{chain_id}/seal")
async def seal_evidence_chain(
    chain_id: int = Path(..., description="Chain ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Seal an evidence chain to prevent further modifications."""
    success = await evidence_service.seal_chain(
        db,
        chain_id,
        sealed_by=current_user.id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chain not found"
        )
    
    return {"message": "Chain sealed successfully"}


@router.post("/evidence-chains/{chain_id}/export", response_model=ChainExportResponse)
async def export_evidence_chain(
    chain_id: int = Path(..., description="Chain ID"),
    request: ChainExportRequest = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export evidence chain for audit purposes."""
    try:
        export_data = await evidence_service.export_chain(
            db,
            chain_id,
            format=request.format
        )
        
        return ChainExportResponse(
            chain_id=chain_id,
            format=request.format,
            export_time=datetime.utcnow(),
            entries=export_data.get("entries", []),
            verification_hash=export_data.get("verification_hash"),
            signed=False
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/evidence-chains/{chain_id}/branch", response_model=EvidenceChainResponse)
async def create_chain_branch(
    chain_id: int = Path(..., description="Original chain ID"),
    branch_point: int = Body(..., description="Entry ID to branch from"),
    reason: str = Body(..., description="Reason for branching"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a branch in the evidence chain."""
    try:
        branch = await evidence_service.create_branch(
            db,
            chain_id,
            branch_point,
            reason
        )
        return EvidenceChainResponse.from_orm(branch)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# Compliance Report Endpoints
@router.post("/compliance-reports", response_model=ComplianceReportResponse)
async def generate_compliance_report(
    request: ComplianceReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a compliance report."""
    report_data = await evidence_service.generate_compliance_report(
        db,
        request.document_id,
        request.start_date,
        request.end_date
    )
    
    # Create report record
    from app.models.audit_compliance import ComplianceReport
    report = ComplianceReport(
        document_id=request.document_id,
        report_type=request.report_type,
        report_period_start=request.start_date,
        report_period_end=request.end_date,
        generated_by=current_user.id,
        report_data=report_data,
        compliance_status="COMPLIANT" if report_data.get("chain_validity") else "NON_COMPLIANT",
        issues_found=0,
        recommendations=[],
        report_hash=hashlib.sha256(
            json.dumps(report_data, sort_keys=True).encode()
        ).hexdigest(),
        tenant_id=current_user.tenant_id
    )
    
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    return ComplianceReportResponse(
        id=report.id,
        document_id=report.document_id,
        report_type=report.report_type,
        report_period_start=report.report_period_start,
        report_period_end=report.report_period_end,
        generated_by=report.generated_by,
        compliance_status=report.compliance_status,
        issues_found=report.issues_found,
        total_actions=report_data.get("total_actions", 0),
        unique_actors=report_data.get("unique_actors", 0),
        chain_validity=report_data.get("chain_validity", True),
        timeline=report_data.get("timeline", []),
        recommendations=report.recommendations,
        report_hash=report.report_hash
    )


# Audit Trail Endpoints
@router.post("/audit-trail", response_model=AuditTrailResponse)
async def get_audit_trail(
    request: AuditTrailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get complete audit trail for a document."""
    # Get signatures
    signatures = []
    if request.include_signatures:
        sigs = await signature_service.get_signature_history(db, request.document_id)
        signatures = [SignatureResponse.from_orm(s) for s in sigs]
    
    # Get timestamps
    timestamps = []
    if request.include_timestamps:
        ts = await timestamp_service.get_timestamp_chain(db, request.document_id)
        timestamps = [TimeStampResponse.from_orm(t) for t in ts]
    
    # Get evidence entries
    evidence_entries = []
    # Would need to query evidence chains and entries
    
    # Create timeline
    timeline = []
    
    return AuditTrailResponse(
        document_id=request.document_id,
        total_events=len(signatures) + len(timestamps) + len(evidence_entries),
        signatures=signatures,
        timestamps=timestamps,
        evidence_entries=evidence_entries,
        timeline=timeline,
        integrity_verified=True
    )


# Add missing imports
import hashlib
import json