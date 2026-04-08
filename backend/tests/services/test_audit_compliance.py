"""
Tests for Audit & Compliance Services
Including Digital Signatures, Time-stamping, and Evidence Chain
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import hashlib
import json
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.audit_compliance import (
    DigitalSignatureService,
    TimeStampingService,
    EvidenceChainService,
    SignatureStatus,
    EvidenceType,
    ChainStatus
)
from app.models.audit_compliance import (
    DigitalSignature,
    TimeStamp,
    EvidenceChain,
    EvidenceEntry,
    SignatureCertificate
)
from app.schemas.audit_compliance import (
    SignatureRequest,
    SignatureVerifyRequest,
    TimeStampRequest,
    EvidenceChainCreate,
    EvidenceEntryAdd
)


@pytest.fixture
async def signature_service():
    """Create digital signature service instance."""
    return DigitalSignatureService()


@pytest.fixture
async def timestamp_service():
    """Create time-stamping service instance."""
    return TimeStampingService()


@pytest.fixture
async def evidence_service():
    """Create evidence chain service instance."""
    return EvidenceChainService()


@pytest.fixture
def sample_document():
    """Create sample document for testing."""
    return {
        "id": 1,
        "content": b"This is a test document content",
        "file_path": "/test/document.pdf",
        "checksum": hashlib.sha256(b"This is a test document content").hexdigest(),
        "tenant_id": 1
    }


@pytest.fixture
def rsa_key_pair():
    """Generate RSA key pair for testing."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )
    public_key = private_key.public_key()
    
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return {
        "private_key": private_key,
        "public_key": public_key,
        "private_pem": private_pem.decode('utf-8'),
        "public_pem": public_pem.decode('utf-8')
    }


class TestDigitalSignatureService:
    """Test digital signature functionality."""
    
    async def test_create_signature(self, signature_service, db_session, sample_document, rsa_key_pair):
        """Test creating a digital signature for a document."""
        request = SignatureRequest(
            document_id=sample_document["id"],
            signer_id=1,
            certificate_id=1,
            signature_type="APPROVAL",
            reason="Document approval",
            location="New York, USA"
        )
        
        # Mock certificate retrieval
        with patch.object(signature_service, 'get_certificate') as mock_cert:
            mock_cert.return_value = SignatureCertificate(
                id=1,
                user_id=1,
                private_key=rsa_key_pair["private_pem"],
                public_key=rsa_key_pair["public_pem"],
                certificate_data="test_cert",
                valid_from=datetime.utcnow(),
                valid_to=datetime.utcnow() + timedelta(days=365)
            )
            
            signature = await signature_service.create_signature(
                db_session,
                request,
                sample_document["content"]
            )
            
            assert signature is not None
            assert signature.document_id == sample_document["id"]
            assert signature.signer_id == 1
            assert signature.signature_type == "APPROVAL"
            assert signature.is_valid == True
            assert signature.signature_data is not None
    
    async def test_verify_signature(self, signature_service, db_session, sample_document, rsa_key_pair):
        """Test verifying a digital signature."""
        # Create a signature first
        private_key = rsa_key_pair["private_key"]
        signature_bytes = private_key.sign(
            sample_document["content"],
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        
        # Create signature record
        signature = DigitalSignature(
            document_id=sample_document["id"],
            signer_id=1,
            certificate_id=1,
            signature_data=signature_bytes.hex(),
            signature_type="APPROVAL",
            document_hash=sample_document["checksum"],
            timestamp=datetime.utcnow(),
            is_valid=True,
            tenant_id=1
        )
        
        # Mock certificate retrieval
        with patch.object(signature_service, 'get_certificate') as mock_cert:
            mock_cert.return_value = SignatureCertificate(
                id=1,
                public_key=rsa_key_pair["public_pem"]
            )
            
            is_valid = await signature_service.verify_signature(
                db_session,
                signature,
                sample_document["content"]
            )
            
            assert is_valid == True
    
    async def test_batch_sign_documents(self, signature_service, db_session):
        """Test batch signing multiple documents."""
        document_ids = [1, 2, 3]
        signer_id = 1
        certificate_id = 1
        
        results = await signature_service.batch_sign(
            db_session,
            document_ids,
            signer_id,
            certificate_id,
            reason="Batch approval"
        )
        
        assert len(results) == 3
        assert all(r.success for r in results)
    
    async def test_revoke_signature(self, signature_service, db_session):
        """Test revoking a digital signature."""
        signature_id = 1
        revoked_by = 1
        reason = "Document content changed"
        
        success = await signature_service.revoke_signature(
            db_session,
            signature_id,
            revoked_by,
            reason
        )
        
        assert success == True
    
    async def test_signature_audit_trail(self, signature_service, db_session):
        """Test retrieving signature audit trail for a document."""
        document_id = 1
        
        audit_trail = await signature_service.get_signature_history(
            db_session,
            document_id
        )
        
        assert isinstance(audit_trail, list)
    
    async def test_certificate_management(self, signature_service, db_session):
        """Test certificate creation and management."""
        user_id = 1
        
        certificate = await signature_service.create_certificate(
            db_session,
            user_id,
            validity_days=365
        )
        
        assert certificate is not None
        assert certificate.user_id == user_id
        assert certificate.is_active == True
    
    async def test_multi_signature_workflow(self, signature_service, db_session):
        """Test multi-signature workflow for documents requiring multiple approvals."""
        document_id = 1
        signers = [1, 2, 3]
        
        workflow = await signature_service.create_signature_workflow(
            db_session,
            document_id,
            signers,
            require_all=True
        )
        
        assert workflow is not None
        assert workflow.total_required == 3
        assert workflow.completed_count == 0


class TestTimeStampingService:
    """Test time-stamping service functionality."""
    
    async def test_create_timestamp(self, timestamp_service, db_session, sample_document):
        """Test creating a trusted timestamp."""
        request = TimeStampRequest(
            document_id=sample_document["id"],
            hash_value=sample_document["checksum"],
            timestamp_authority="internal"
        )
        
        timestamp = await timestamp_service.create_timestamp(
            db_session,
            request
        )
        
        assert timestamp is not None
        assert timestamp.document_id == sample_document["id"]
        assert timestamp.hash_value == sample_document["checksum"]
        assert timestamp.timestamp_token is not None
        assert timestamp.verified == True
    
    async def test_verify_timestamp(self, timestamp_service, db_session):
        """Test verifying a timestamp."""
        timestamp_id = 1
        document_hash = "test_hash"
        
        is_valid = await timestamp_service.verify_timestamp(
            db_session,
            timestamp_id,
            document_hash
        )
        
        assert isinstance(is_valid, bool)
    
    async def test_rfc3161_compliance(self, timestamp_service):
        """Test RFC 3161 compliant timestamp generation."""
        document_hash = hashlib.sha256(b"test content").hexdigest()
        
        tst = await timestamp_service.generate_rfc3161_timestamp(
            document_hash
        )
        
        assert tst is not None
        assert "timestamp" in tst
        assert "hash_algorithm" in tst
        assert "tsa_certificate" in tst
    
    async def test_external_tsa_integration(self, timestamp_service):
        """Test integration with external Time Stamp Authority."""
        document_hash = "test_hash"
        
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.content = b"timestamp_token"
            
            timestamp = await timestamp_service.get_external_timestamp(
                document_hash,
                tsa_url="https://timestamp.example.com"
            )
            
            assert timestamp is not None
    
    async def test_timestamp_chain_validation(self, timestamp_service, db_session):
        """Test validating a chain of timestamps."""
        document_id = 1
        
        chain = await timestamp_service.get_timestamp_chain(
            db_session,
            document_id
        )
        
        is_valid = await timestamp_service.validate_chain(chain)
        
        assert isinstance(is_valid, bool)
    
    async def test_timestamp_archival(self, timestamp_service, db_session):
        """Test archiving timestamps for long-term validation."""
        timestamp_id = 1
        
        archived = await timestamp_service.archive_timestamp(
            db_session,
            timestamp_id,
            archive_format="LTANS"
        )
        
        assert archived is not None
        assert archived.archive_format == "LTANS"


class TestEvidenceChainService:
    """Test evidence chain and chain of custody functionality."""
    
    async def test_create_evidence_chain(self, evidence_service, db_session):
        """Test creating a new evidence chain."""
        request = EvidenceChainCreate(
            document_id=1,
            chain_type=EvidenceType.DOCUMENT,
            created_by=1,
            description="Contract negotiation evidence chain"
        )
        
        chain = await evidence_service.create_chain(
            db_session,
            request
        )
        
        assert chain is not None
        assert chain.document_id == 1
        assert chain.chain_type == EvidenceType.DOCUMENT
        assert chain.status == ChainStatus.ACTIVE
        assert chain.hash_pointer is not None
    
    async def test_add_evidence_entry(self, evidence_service, db_session):
        """Test adding entry to evidence chain."""
        chain_id = 1
        entry_request = EvidenceEntryAdd(
            action="DOCUMENT_VIEWED",
            actor_id=1,
            details={"ip": "192.168.1.1", "duration": 120},
            evidence_hash="test_hash"
        )
        
        entry = await evidence_service.add_entry(
            db_session,
            chain_id,
            entry_request
        )
        
        assert entry is not None
        assert entry.chain_id == chain_id
        assert entry.action == "DOCUMENT_VIEWED"
        assert entry.previous_hash is not None
        assert entry.entry_hash is not None
    
    async def test_verify_chain_integrity(self, evidence_service, db_session):
        """Test verifying the integrity of an evidence chain."""
        chain_id = 1
        
        is_valid, invalid_entries = await evidence_service.verify_chain_integrity(
            db_session,
            chain_id
        )
        
        assert isinstance(is_valid, bool)
        assert isinstance(invalid_entries, list)
    
    async def test_chain_immutability(self, evidence_service, db_session):
        """Test that evidence chain entries cannot be modified."""
        entry_id = 1
        
        with pytest.raises(Exception) as exc_info:
            await evidence_service.modify_entry(
                db_session,
                entry_id,
                new_action="MODIFIED_ACTION"
            )
        
        assert "immutable" in str(exc_info.value).lower()
    
    async def test_export_chain_for_audit(self, evidence_service, db_session):
        """Test exporting evidence chain for audit purposes."""
        chain_id = 1
        
        export = await evidence_service.export_chain(
            db_session,
            chain_id,
            format="JSON"
        )
        
        assert export is not None
        assert "chain_id" in export
        assert "entries" in export
        assert "verification_hash" in export
    
    async def test_chain_branching(self, evidence_service, db_session):
        """Test creating a branch in the evidence chain."""
        original_chain_id = 1
        branch_point_entry_id = 5
        
        branch = await evidence_service.create_branch(
            db_session,
            original_chain_id,
            branch_point_entry_id,
            reason="Alternative document version"
        )
        
        assert branch is not None
        assert branch.parent_chain_id == original_chain_id
        assert branch.branch_point == branch_point_entry_id
    
    async def test_seal_evidence_chain(self, evidence_service, db_session):
        """Test sealing an evidence chain to prevent further entries."""
        chain_id = 1
        sealed_by = 1
        
        sealed = await evidence_service.seal_chain(
            db_session,
            chain_id,
            sealed_by
        )
        
        assert sealed == True
        
        # Try to add entry to sealed chain
        with pytest.raises(Exception) as exc_info:
            await evidence_service.add_entry(
                db_session,
                chain_id,
                EvidenceEntryAdd(action="TEST", actor_id=1)
            )
        
        assert "sealed" in str(exc_info.value).lower()
    
    async def test_compliance_reporting(self, evidence_service, db_session):
        """Test generating compliance reports from evidence chains."""
        document_id = 1
        start_date = datetime.utcnow() - timedelta(days=30)
        end_date = datetime.utcnow()
        
        report = await evidence_service.generate_compliance_report(
            db_session,
            document_id,
            start_date,
            end_date
        )
        
        assert report is not None
        assert "total_actions" in report
        assert "unique_actors" in report
        assert "chain_validity" in report
        assert "timeline" in report


class TestIntegrationScenarios:
    """Test integration scenarios combining all audit & compliance features."""
    
    async def test_complete_document_lifecycle(
        self,
        signature_service,
        timestamp_service,
        evidence_service,
        db_session
    ):
        """Test complete document lifecycle with signatures, timestamps, and evidence chain."""
        document_id = 1
        
        # 1. Create evidence chain
        chain = await evidence_service.create_chain(
            db_session,
            EvidenceChainCreate(
                document_id=document_id,
                chain_type=EvidenceType.DOCUMENT,
                created_by=1
            )
        )
        
        # 2. Add creation entry
        await evidence_service.add_entry(
            db_session,
            chain.id,
            EvidenceEntryAdd(action="CREATED", actor_id=1)
        )
        
        # 3. Create timestamp
        timestamp = await timestamp_service.create_timestamp(
            db_session,
            TimeStampRequest(
                document_id=document_id,
                hash_value="doc_hash"
            )
        )
        
        # 4. Add timestamp entry to chain
        await evidence_service.add_entry(
            db_session,
            chain.id,
            EvidenceEntryAdd(
                action="TIMESTAMPED",
                actor_id=1,
                details={"timestamp_id": timestamp.id}
            )
        )
        
        # 5. Create digital signature
        signature = await signature_service.create_signature(
            db_session,
            SignatureRequest(
                document_id=document_id,
                signer_id=1,
                certificate_id=1
            ),
            b"document_content"
        )
        
        # 6. Add signature entry to chain
        await evidence_service.add_entry(
            db_session,
            chain.id,
            EvidenceEntryAdd(
                action="SIGNED",
                actor_id=1,
                details={"signature_id": signature.id}
            )
        )
        
        # 7. Verify complete audit trail
        is_valid, _ = await evidence_service.verify_chain_integrity(
            db_session,
            chain.id
        )
        
        assert is_valid == True
    
    async def test_multi_party_contract_signing(
        self,
        signature_service,
        timestamp_service,
        evidence_service,
        db_session
    ):
        """Test multi-party contract signing with full audit trail."""
        document_id = 1
        parties = [1, 2, 3]
        
        # Create evidence chain
        chain = await evidence_service.create_chain(
            db_session,
            EvidenceChainCreate(
                document_id=document_id,
                chain_type=EvidenceType.CONTRACT,
                created_by=1
            )
        )
        
        # Create signature workflow
        workflow = await signature_service.create_signature_workflow(
            db_session,
            document_id,
            parties,
            require_all=True
        )
        
        # Each party signs
        for party_id in parties:
            # Create timestamp before signing
            timestamp = await timestamp_service.create_timestamp(
                db_session,
                TimeStampRequest(document_id=document_id, hash_value=f"hash_{party_id}")
            )
            
            # Sign document
            signature = await signature_service.create_signature(
                db_session,
                SignatureRequest(
                    document_id=document_id,
                    signer_id=party_id,
                    certificate_id=party_id
                ),
                b"document_content"
            )
            
            # Add to evidence chain
            await evidence_service.add_entry(
                db_session,
                chain.id,
                EvidenceEntryAdd(
                    action="SIGNED",
                    actor_id=party_id,
                    details={
                        "signature_id": signature.id,
                        "timestamp_id": timestamp.id
                    }
                )
            )
        
        # Verify all signatures
        assert workflow.completed_count == len(parties)
        
        # Seal the chain
        sealed = await evidence_service.seal_chain(
            db_session,
            chain.id,
            sealed_by=1
        )
        
        assert sealed == True