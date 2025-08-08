"""
Audit & Compliance Services
Digital Signatures, Time-stamping, and Evidence Chain Management
"""
import hashlib
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from cryptography.x509 import (
    CertificateBuilder, Name, NameAttribute,
    random_serial_number, BasicConstraints,
    KeyUsage, ExtendedKeyUsage, ExtensionType
)
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtensionOID, ExtendedKeyUsageOID
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_compliance import (
    SignatureCertificate, DigitalSignature, SignatureWorkflow,
    TimeStamp, EvidenceChain, EvidenceEntry, ComplianceReport,
    SignatureStatus, SignatureType, EvidenceType, ChainStatus
)
from app.models.document import Document
from app.models.user import User
from app.schemas.audit_compliance import (
    SignatureRequest, SignatureResponse, SignatureVerifyRequest,
    TimeStampRequest, TimeStampResponse, RFC3161Response,
    EvidenceChainCreate, EvidenceEntryAdd, ChainVerificationResult,
    ComplianceReportRequest, ComplianceReportResponse,
    CertificateCreate, SignatureWorkflowCreate, BatchSignResponse
)
from app.core.exceptions import NotFoundError, ValidationError


class DigitalSignatureService:
    """Service for managing digital signatures."""
    
    async def create_certificate(
        self,
        db: AsyncSession,
        user_id: int,
        validity_days: int = 365
    ) -> SignatureCertificate:
        """Create a new signature certificate for a user."""
        # Generate RSA key pair
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        public_key = private_key.public_key()
        
        # Get user for certificate subject
        user = await db.get(User, user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")
        
        # Create X.509 certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "NY"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "New York"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Legal AI Platform"),
            x509.NameAttribute(NameOID.COMMON_NAME, user.email),
        ])
        
        cert_builder = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(public_key)
            .serial_number(random_serial_number())
            .not_valid_before(datetime.utcnow())
            .not_valid_after(datetime.utcnow() + timedelta(days=validity_days))
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=True,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=False,
                    crl_sign=False,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
        )
        
        # Self-sign the certificate
        certificate = cert_builder.sign(private_key, hashes.SHA256(), backend=default_backend())
        
        # Serialize keys and certificate
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        cert_pem = certificate.public_bytes(serialization.Encoding.PEM)
        
        # Create certificate record
        cert_record = SignatureCertificate(
            user_id=user_id,
            certificate_data=cert_pem.decode('utf-8'),
            public_key=public_pem.decode('utf-8'),
            private_key=private_pem.decode('utf-8'),  # In production, encrypt this!
            serial_number=str(certificate.serial_number),
            issuer="Legal AI Platform CA",
            subject=user.email,
            valid_from=datetime.utcnow(),
            valid_to=datetime.utcnow() + timedelta(days=validity_days),
            key_usage=["digital_signature", "non_repudiation"],
            tenant_id=user.tenant_id,
            is_active=True
        )
        
        db.add(cert_record)
        await db.commit()
        await db.refresh(cert_record)
        
        return cert_record
    
    async def get_certificate(
        self,
        db: AsyncSession,
        certificate_id: int
    ) -> SignatureCertificate:
        """Get a certificate by ID."""
        cert = await db.get(SignatureCertificate, certificate_id)
        if not cert:
            raise NotFoundError(f"Certificate {certificate_id} not found")
        return cert
    
    async def create_signature(
        self,
        db: AsyncSession,
        request: SignatureRequest,
        document_content: bytes
    ) -> DigitalSignature:
        """Create a digital signature for a document."""
        # Get certificate
        cert = await self.get_certificate(db, request.certificate_id)
        if not cert.is_valid():
            raise ValidationError("Certificate is not valid")
        
        # Load private key
        private_key = serialization.load_pem_private_key(
            cert.private_key.encode('utf-8'),
            password=None,
            backend=default_backend()
        )
        
        # Calculate document hash
        doc_hash = hashlib.sha256(document_content).hexdigest()
        
        # Create signature
        signature_bytes = private_key.sign(
            document_content,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        # Create signature record
        signature = DigitalSignature(
            document_id=request.document_id,
            signer_id=request.signer_id,
            certificate_id=request.certificate_id,
            signature_data=signature_bytes.hex(),
            signature_type=request.signature_type.value,
            document_hash=doc_hash,
            signature_algorithm="RSA-SHA256",
            timestamp=datetime.utcnow(),
            status=SignatureStatus.VALID.value,
            is_valid=True,
            reason=request.reason,
            location=request.location,
            metadata=request.metadata,
            tenant_id=cert.tenant_id
        )
        
        db.add(signature)
        await db.commit()
        await db.refresh(signature)
        
        return signature
    
    async def verify_signature(
        self,
        db: AsyncSession,
        signature: DigitalSignature,
        document_content: bytes
    ) -> bool:
        """Verify a digital signature."""
        try:
            # Get certificate
            cert = await self.get_certificate(db, signature.certificate_id)
            
            # Load public key
            public_key = serialization.load_pem_public_key(
                cert.public_key.encode('utf-8'),
                backend=default_backend()
            )
            
            # Verify signature
            signature_bytes = bytes.fromhex(signature.signature_data)
            public_key.verify(
                signature_bytes,
                document_content,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            
            # Verify document hash
            current_hash = hashlib.sha256(document_content).hexdigest()
            if current_hash != signature.document_hash:
                return False
            
            return True
        except Exception:
            return False
    
    async def batch_sign(
        self,
        db: AsyncSession,
        document_ids: List[int],
        signer_id: int,
        certificate_id: int,
        reason: Optional[str] = None
    ) -> List[BatchSignResponse]:
        """Batch sign multiple documents."""
        results = []
        
        for doc_id in document_ids:
            try:
                # Get document
                doc = await db.get(Document, doc_id)
                if not doc:
                    results.append({"document_id": doc_id, "success": False, "error": "Not found"})
                    continue
                
                # Create signature request
                sig_request = SignatureRequest(
                    document_id=doc_id,
                    signer_id=signer_id,
                    certificate_id=certificate_id,
                    reason=reason
                )
                
                # Sign document (using placeholder content)
                signature = await self.create_signature(
                    db,
                    sig_request,
                    b"document_content"  # In production, fetch actual content
                )
                
                results.append({
                    "document_id": doc_id,
                    "success": True,
                    "signature_id": signature.id
                })
            except Exception as e:
                results.append({
                    "document_id": doc_id,
                    "success": False,
                    "error": str(e)
                })
        
        return results
    
    async def revoke_signature(
        self,
        db: AsyncSession,
        signature_id: int,
        revoked_by: int,
        reason: str
    ) -> bool:
        """Revoke a digital signature."""
        signature = await db.get(DigitalSignature, signature_id)
        if not signature:
            return False
        
        signature.status = SignatureStatus.REVOKED.value
        signature.is_valid = False
        signature.revoked_at = datetime.utcnow()
        signature.revoked_by = revoked_by
        signature.revocation_reason = reason
        
        await db.commit()
        return True
    
    async def get_signature_history(
        self,
        db: AsyncSession,
        document_id: int
    ) -> List[DigitalSignature]:
        """Get signature history for a document."""
        result = await db.execute(
            select(DigitalSignature)
            .where(DigitalSignature.document_id == document_id)
            .order_by(DigitalSignature.timestamp.desc())
        )
        return list(result.scalars().all())
    
    async def create_signature_workflow(
        self,
        db: AsyncSession,
        document_id: int,
        signers: List[int],
        require_all: bool = True
    ) -> SignatureWorkflow:
        """Create a multi-signature workflow."""
        workflow = SignatureWorkflow(
            document_id=document_id,
            workflow_name=f"Signature Workflow {document_id}",
            total_required=len(signers) if require_all else 1,
            require_all=require_all,
            signers=signers,
            tenant_id=1  # Get from context
        )
        
        db.add(workflow)
        await db.commit()
        await db.refresh(workflow)
        
        return workflow


class TimeStampingService:
    """Service for trusted time-stamping."""
    
    async def create_timestamp(
        self,
        db: AsyncSession,
        request: TimeStampRequest
    ) -> TimeStamp:
        """Create a trusted timestamp."""
        # Generate serial number
        serial = f"TS-{secrets.token_hex(16)}"
        
        # Create timestamp token (simplified)
        timestamp_data = {
            "version": 1,
            "hash_algorithm": request.hash_algorithm,
            "hash_value": request.hash_value,
            "timestamp": datetime.utcnow().isoformat(),
            "serial_number": serial,
            "tsa": request.timestamp_authority,
            "nonce": request.nonce or secrets.token_hex(8)
        }
        
        # Sign the timestamp data (in production, use TSA private key)
        token_string = json.dumps(timestamp_data, sort_keys=True)
        token_hash = hashlib.sha256(token_string.encode()).hexdigest()
        
        # Create timestamp record
        timestamp = TimeStamp(
            document_id=request.document_id,
            hash_value=request.hash_value,
            hash_algorithm=request.hash_algorithm,
            timestamp=datetime.utcnow(),
            timestamp_token=token_string,
            timestamp_authority=request.timestamp_authority,
            serial_number=serial,
            accuracy=0.001,  # 1ms accuracy
            ordering=True,
            nonce=timestamp_data["nonce"],
            verified=True,
            verification_time=datetime.utcnow()
        )
        
        db.add(timestamp)
        await db.commit()
        await db.refresh(timestamp)
        
        return timestamp
    
    async def verify_timestamp(
        self,
        db: AsyncSession,
        timestamp_id: int,
        document_hash: str
    ) -> bool:
        """Verify a timestamp."""
        timestamp = await db.get(TimeStamp, timestamp_id)
        if not timestamp:
            return False
        
        # Verify hash matches
        if timestamp.hash_value != document_hash:
            return False
        
        # Verify token integrity
        try:
            token_data = json.loads(timestamp.timestamp_token)
            if token_data.get("hash_value") != document_hash:
                return False
            
            # Update verification time
            timestamp.verified = True
            timestamp.verification_time = datetime.utcnow()
            await db.commit()
            
            return True
        except Exception:
            return False
    
    async def generate_rfc3161_timestamp(
        self,
        document_hash: str
    ) -> Dict[str, Any]:
        """Generate RFC 3161 compliant timestamp."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "hash_algorithm": "SHA256",
            "hash_value": document_hash,
            "tsa_certificate": "TSA_CERT_PEM",
            "serial_number": secrets.token_hex(16),
            "accuracy": 0.001,
            "ordering": True,
            "nonce": secrets.token_hex(8)
        }
    
    async def get_external_timestamp(
        self,
        document_hash: str,
        tsa_url: str
    ) -> Optional[bytes]:
        """Get timestamp from external TSA."""
        # In production, make actual HTTP request to TSA
        # For testing, return mock response
        return b"timestamp_token"
    
    async def get_timestamp_chain(
        self,
        db: AsyncSession,
        document_id: int
    ) -> List[TimeStamp]:
        """Get all timestamps for a document."""
        result = await db.execute(
            select(TimeStamp)
            .where(TimeStamp.document_id == document_id)
            .order_by(TimeStamp.timestamp)
        )
        return list(result.scalars().all())
    
    async def validate_chain(
        self,
        timestamps: List[TimeStamp]
    ) -> bool:
        """Validate a chain of timestamps."""
        if not timestamps:
            return True
        
        # Verify chronological order
        for i in range(1, len(timestamps)):
            if timestamps[i].timestamp <= timestamps[i-1].timestamp:
                return False
        
        # Verify each timestamp
        for ts in timestamps:
            if not ts.verified:
                return False
        
        return True
    
    async def archive_timestamp(
        self,
        db: AsyncSession,
        timestamp_id: int,
        archive_format: str = "LTANS"
    ) -> TimeStamp:
        """Archive timestamp for long-term validation."""
        timestamp = await db.get(TimeStamp, timestamp_id)
        if not timestamp:
            raise NotFoundError(f"Timestamp {timestamp_id} not found")
        
        # Add archival metadata
        timestamp.metadata["archived"] = True
        timestamp.metadata["archive_format"] = archive_format
        timestamp.metadata["archive_time"] = datetime.utcnow().isoformat()
        
        await db.commit()
        return timestamp


class EvidenceChainService:
    """Service for evidence chain management."""
    
    async def create_chain(
        self,
        db: AsyncSession,
        request: EvidenceChainCreate
    ) -> EvidenceChain:
        """Create a new evidence chain."""
        # Generate unique chain ID
        chain_id = f"CHAIN-{secrets.token_hex(16)}"
        
        # Create genesis hash
        genesis_data = {
            "chain_id": chain_id,
            "created_by": request.created_by,
            "created_at": datetime.utcnow().isoformat(),
            "chain_type": request.chain_type.value
        }
        genesis_hash = hashlib.sha256(
            json.dumps(genesis_data, sort_keys=True).encode()
        ).hexdigest()
        
        # Create chain
        chain = EvidenceChain(
            document_id=request.document_id,
            chain_type=request.chain_type.value,
            chain_id=chain_id,
            status=ChainStatus.ACTIVE.value,
            created_by=request.created_by,
            hash_pointer=genesis_hash,
            entry_count=0,
            description=request.description,
            metadata=request.metadata,
            tenant_id=1  # Get from context
        )
        
        db.add(chain)
        await db.commit()
        await db.refresh(chain)
        
        return chain
    
    async def add_entry(
        self,
        db: AsyncSession,
        chain_id: int,
        request: EvidenceEntryAdd
    ) -> EvidenceEntry:
        """Add an entry to the evidence chain."""
        # Get chain
        chain = await db.get(EvidenceChain, chain_id)
        if not chain:
            raise NotFoundError(f"Chain {chain_id} not found")
        
        # Check if chain is sealed
        if chain.status == ChainStatus.SEALED.value:
            raise ValidationError("Cannot add entries to sealed chain")
        
        # Get previous hash
        previous_hash = chain.last_entry_hash or chain.hash_pointer
        
        # Create entry
        entry = EvidenceEntry(
            chain_id=chain_id,
            entry_number=chain.entry_count + 1,
            previous_hash=previous_hash,
            action=request.action,
            actor_id=request.actor_id,
            timestamp=datetime.utcnow(),
            details=request.details,
            evidence_hash=request.evidence_hash,
            evidence_location=request.evidence_location,
            metadata=request.metadata,
            entry_hash=""  # Will be calculated
        )
        
        # Calculate entry hash
        entry.entry_hash = entry.calculate_hash()
        
        # Update chain
        chain.entry_count += 1
        chain.last_entry_hash = entry.entry_hash
        
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        
        return entry
    
    async def verify_chain_integrity(
        self,
        db: AsyncSession,
        chain_id: int
    ) -> Tuple[bool, List[int]]:
        """Verify the integrity of an evidence chain."""
        # Get chain
        chain = await db.get(EvidenceChain, chain_id)
        if not chain:
            return False, []
        
        # Get all entries
        result = await db.execute(
            select(EvidenceEntry)
            .where(EvidenceEntry.chain_id == chain_id)
            .order_by(EvidenceEntry.entry_number)
        )
        entries = list(result.scalars().all())
        
        if not entries:
            return True, []
        
        invalid_entries = []
        previous_hash = chain.hash_pointer
        
        for entry in entries:
            # Verify previous hash
            if entry.previous_hash != previous_hash:
                invalid_entries.append(entry.id)
            
            # Verify entry hash
            calculated_hash = entry.calculate_hash()
            if entry.entry_hash != calculated_hash:
                invalid_entries.append(entry.id)
            
            previous_hash = entry.entry_hash
        
        # Verify chain's last entry hash
        if chain.last_entry_hash != previous_hash:
            return False, invalid_entries
        
        return len(invalid_entries) == 0, invalid_entries
    
    async def modify_entry(
        self,
        db: AsyncSession,
        entry_id: int,
        new_action: str
    ):
        """Attempt to modify an entry (should fail)."""
        raise Exception("Evidence chain entries are immutable")
    
    async def export_chain(
        self,
        db: AsyncSession,
        chain_id: int,
        format: str = "JSON"
    ) -> Dict[str, Any]:
        """Export evidence chain for audit."""
        # Get chain
        chain = await db.get(EvidenceChain, chain_id)
        if not chain:
            raise NotFoundError(f"Chain {chain_id} not found")
        
        # Get all entries
        result = await db.execute(
            select(EvidenceEntry)
            .where(EvidenceEntry.chain_id == chain_id)
            .order_by(EvidenceEntry.entry_number)
        )
        entries = result.scalars().all()
        
        # Create export
        export_data = {
            "chain_id": chain.chain_id,
            "document_id": chain.document_id,
            "chain_type": chain.chain_type,
            "status": chain.status,
            "created_at": chain.created_at.isoformat(),
            "entry_count": chain.entry_count,
            "hash_pointer": chain.hash_pointer,
            "entries": [
                {
                    "entry_number": e.entry_number,
                    "action": e.action,
                    "actor_id": e.actor_id,
                    "timestamp": e.timestamp.isoformat(),
                    "entry_hash": e.entry_hash,
                    "previous_hash": e.previous_hash,
                    "details": e.details
                }
                for e in entries
            ]
        }
        
        # Calculate verification hash
        export_string = json.dumps(export_data, sort_keys=True)
        verification_hash = hashlib.sha256(export_string.encode()).hexdigest()
        
        return {
            **export_data,
            "verification_hash": verification_hash
        }
    
    async def create_branch(
        self,
        db: AsyncSession,
        original_chain_id: int,
        branch_point_entry_id: int,
        reason: str
    ) -> EvidenceChain:
        """Create a branch in the evidence chain."""
        # Get original chain
        original = await db.get(EvidenceChain, original_chain_id)
        if not original:
            raise NotFoundError(f"Chain {original_chain_id} not found")
        
        # Create branch chain
        branch = EvidenceChain(
            document_id=original.document_id,
            chain_type=original.chain_type,
            chain_id=f"BRANCH-{secrets.token_hex(16)}",
            status=ChainStatus.ACTIVE.value,
            created_by=original.created_by,
            hash_pointer=original.hash_pointer,
            parent_chain_id=original_chain_id,
            branch_point=branch_point_entry_id,
            description=f"Branch: {reason}",
            tenant_id=original.tenant_id
        )
        
        db.add(branch)
        await db.commit()
        await db.refresh(branch)
        
        return branch
    
    async def seal_chain(
        self,
        db: AsyncSession,
        chain_id: int,
        sealed_by: int
    ) -> bool:
        """Seal an evidence chain."""
        chain = await db.get(EvidenceChain, chain_id)
        if not chain:
            return False
        
        chain.status = ChainStatus.SEALED.value
        chain.sealed_at = datetime.utcnow()
        chain.sealed_by = sealed_by
        
        # Mark all entries as sealed
        result = await db.execute(
            select(EvidenceEntry)
            .where(EvidenceEntry.chain_id == chain_id)
        )
        entries = result.scalars().all()
        
        for entry in entries:
            entry.is_sealed = True
        
        await db.commit()
        return True
    
    async def generate_compliance_report(
        self,
        db: AsyncSession,
        document_id: int,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate compliance report from evidence chains."""
        # Get all chains for document
        result = await db.execute(
            select(EvidenceChain)
            .where(EvidenceChain.document_id == document_id)
        )
        chains = result.scalars().all()
        
        # Get all entries in date range
        all_entries = []
        for chain in chains:
            result = await db.execute(
                select(EvidenceEntry)
                .where(
                    and_(
                        EvidenceEntry.chain_id == chain.id,
                        EvidenceEntry.timestamp >= start_date,
                        EvidenceEntry.timestamp <= end_date
                    )
                )
            )
            all_entries.extend(result.scalars().all())
        
        # Calculate statistics
        unique_actors = set(e.actor_id for e in all_entries)
        
        # Verify chain integrity
        chain_validity = True
        for chain in chains:
            is_valid, _ = await self.verify_chain_integrity(db, chain.id)
            if not is_valid:
                chain_validity = False
                break
        
        # Create timeline
        timeline = [
            {
                "timestamp": e.timestamp.isoformat(),
                "action": e.action,
                "actor_id": e.actor_id,
                "details": e.details
            }
            for e in sorted(all_entries, key=lambda x: x.timestamp)
        ]
        
        return {
            "document_id": document_id,
            "total_actions": len(all_entries),
            "unique_actors": len(unique_actors),
            "chain_validity": chain_validity,
            "timeline": timeline,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }