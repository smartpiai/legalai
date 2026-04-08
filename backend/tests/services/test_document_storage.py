"""
Tests for enhanced document storage service with security features.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database/MinIO.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live MinIO required")

import os
import hashlib
import gzip
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, Optional
import asyncio

from app.services.document_storage import (
    DocumentStorageService,
    FileSanitizer,
    VirusScanner,
    DocumentEncryption,
    BackupManager,
    DocumentCompressionService,
    ScanStatus,
    DocumentSecurityError,
    VirusScanError,
    EncryptionError,
    BackupError
)
from app.models.document import Document, DocumentScanStatus
from app.core.config import settings


class TestFileSanitizer:
    """Test file sanitization and validation."""
    
    @pytest.mark.asyncio
    async def test_validate_mime_type(self):
        """Test MIME type validation against actual file content."""
        sanitizer = FileSanitizer()
        
        # Create a real PDF header
        pdf_content = b"%PDF-1.4\n%\x93\x8C\x8B\x9E Test PDF content"
        result = await sanitizer.validate_mime_type(
            content=pdf_content,
            claimed_mime="application/pdf",
            filename="test.pdf"
        )
        assert result is True
        
        # Test mismatched MIME type
        result = await sanitizer.validate_mime_type(
            content=pdf_content,
            claimed_mime="image/jpeg",
            filename="fake.jpg"
        )
        assert result is False
    
    @pytest.mark.asyncio
    async def test_detect_malicious_patterns(self):
        """Test detection of malicious patterns in files."""
        sanitizer = FileSanitizer()
        
        # Test file with embedded executable
        malicious_content = b"MZ\x90\x00\x03" + b"\x00" * 100  # PE executable header
        is_safe = await sanitizer.check_for_malicious_patterns(malicious_content)
        assert is_safe is False
        
        # Test safe content
        safe_content = b"This is a safe text document content"
        is_safe = await sanitizer.check_for_malicious_patterns(safe_content)
        assert is_safe is True
    
    @pytest.mark.asyncio
    async def test_sanitize_filename(self):
        """Test filename sanitization."""
        sanitizer = FileSanitizer()
        
        # Test path traversal attempt
        malicious_name = "../../../etc/passwd"
        safe_name = await sanitizer.sanitize_filename(malicious_name)
        assert ".." not in safe_name
        assert "/" not in safe_name
        
        # Test special characters
        special_name = "file<>:|?*name.pdf"
        safe_name = await sanitizer.sanitize_filename(special_name)
        assert all(c not in safe_name for c in '<>:|?*')
    
    @pytest.mark.asyncio
    async def test_check_file_size_limits(self):
        """Test file size validation by type."""
        sanitizer = FileSanitizer()
        
        # Test PDF within limit (100MB)
        pdf_size = 50 * 1024 * 1024  # 50MB
        is_valid = await sanitizer.check_size_limit(
            size=pdf_size,
            mime_type="application/pdf"
        )
        assert is_valid is True
        
        # Test PDF exceeding limit
        large_pdf = 150 * 1024 * 1024  # 150MB
        is_valid = await sanitizer.check_size_limit(
            size=large_pdf,
            mime_type="application/pdf"
        )
        assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_extract_metadata(self):
        """Test metadata extraction from files."""
        sanitizer = FileSanitizer()
        
        # Create test content with metadata
        test_content = b"Test document content"
        metadata = await sanitizer.extract_metadata(
            content=test_content,
            mime_type="text/plain"
        )
        
        assert "file_hash" in metadata
        assert "content_length" in metadata
        assert metadata["content_length"] == len(test_content)


class TestVirusScanner:
    """Test virus scanning functionality."""
    
    @pytest.mark.asyncio
    async def test_connect_to_clamav(self, test_db_session):
        """Test ClamAV connection."""
        scanner = VirusScanner(db_session=test_db_session)
        
        # Test connection (will use real ClamAV in Docker)
        is_connected = await scanner.connect()
        assert is_connected is True
        
        # Test version check
        version = await scanner.get_version()
        assert version is not None
        assert "ClamAV" in version
    
    @pytest.mark.asyncio
    async def test_scan_clean_file(self, test_db_session):
        """Test scanning a clean file."""
        scanner = VirusScanner(db_session=test_db_session)
        
        # Create clean content
        clean_content = b"This is a clean document with safe content."
        
        result = await scanner.scan_content(clean_content)
        assert result["status"] == ScanStatus.CLEAN
        assert result["threat"] is None
    
    @pytest.mark.asyncio
    async def test_scan_infected_file(self, test_db_session):
        """Test scanning an infected file."""
        scanner = VirusScanner(db_session=test_db_session)
        
        # EICAR test virus string (safe test pattern)
        eicar_content = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
        
        result = await scanner.scan_content(eicar_content)
        assert result["status"] == ScanStatus.INFECTED
        assert result["threat"] is not None
        assert "EICAR" in result["threat"]
    
    @pytest.mark.asyncio
    async def test_quarantine_infected_file(self, test_db_session):
        """Test quarantine process for infected files."""
        scanner = VirusScanner(db_session=test_db_session)
        
        # Create infected content
        infected_content = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
        document_id = 123
        
        # Quarantine the file
        quarantine_path = await scanner.quarantine_file(
            content=infected_content,
            document_id=document_id,
            tenant_id=1
        )
        
        assert quarantine_path is not None
        assert "quarantine" in quarantine_path
        assert str(document_id) in quarantine_path
    
    @pytest.mark.asyncio
    async def test_async_scan_queue(self, test_db_session):
        """Test async scanning queue for multiple files."""
        scanner = VirusScanner(db_session=test_db_session)
        
        # Queue multiple scans
        scan_tasks = []
        for i in range(5):
            content = f"Test content {i}".encode()
            task = scanner.queue_scan(
                content=content,
                document_id=i,
                priority="normal"
            )
            scan_tasks.append(task)
        
        # Process queue
        results = await asyncio.gather(*scan_tasks)
        
        assert len(results) == 5
        assert all(r["status"] == ScanStatus.CLEAN for r in results)
    
    @pytest.mark.asyncio
    async def test_scan_status_update(self, test_db_session):
        """Test updating document scan status in database."""
        scanner = VirusScanner(db_session=test_db_session)
        
        # Create a document
        document = Document(
            id=1,
            name="test.pdf",
            tenant_id=1,
            scan_status=DocumentScanStatus.PENDING
        )
        test_db_session.add(document)
        await test_db_session.commit()
        
        # Update scan status
        await scanner.update_scan_status(
            document_id=1,
            status=DocumentScanStatus.CLEAN,
            scan_details={"scanner": "ClamAV", "version": "0.104"}
        )
        
        # Verify update
        await test_db_session.refresh(document)
        assert document.scan_status == DocumentScanStatus.CLEAN
        assert document.scan_timestamp is not None


class TestDocumentEncryption:
    """Test document encryption functionality."""
    
    @pytest.mark.asyncio
    async def test_generate_encryption_key(self):
        """Test encryption key generation."""
        encryption = DocumentEncryption()
        
        key = await encryption.generate_key()
        assert key is not None
        assert len(key) == 44  # Base64 encoded 256-bit key
    
    @pytest.mark.asyncio
    async def test_encrypt_document(self):
        """Test document encryption."""
        encryption = DocumentEncryption()
        
        # Original content
        original_content = b"Sensitive document content that needs encryption"
        
        # Encrypt
        encrypted_data = await encryption.encrypt(
            content=original_content,
            key_id="test-key-001"
        )
        
        assert encrypted_data["encrypted_content"] != original_content
        assert encrypted_data["key_id"] == "test-key-001"
        assert "iv" in encrypted_data  # Initialization vector
        assert "tag" in encrypted_data  # Authentication tag
    
    @pytest.mark.asyncio
    async def test_decrypt_document(self):
        """Test document decryption."""
        encryption = DocumentEncryption()
        
        # Original content
        original_content = b"Sensitive document content"
        
        # Encrypt then decrypt
        encrypted_data = await encryption.encrypt(
            content=original_content,
            key_id="test-key-001"
        )
        
        decrypted_content = await encryption.decrypt(
            encrypted_content=encrypted_data["encrypted_content"],
            key_id=encrypted_data["key_id"],
            iv=encrypted_data["iv"],
            tag=encrypted_data["tag"]
        )
        
        assert decrypted_content == original_content
    
    @pytest.mark.asyncio
    async def test_key_rotation(self):
        """Test encryption key rotation."""
        encryption = DocumentEncryption()
        
        # Encrypt with old key
        content = b"Document content"
        old_encrypted = await encryption.encrypt(
            content=content,
            key_id="key-v1"
        )
        
        # Rotate key
        new_encrypted = await encryption.rotate_key(
            encrypted_data=old_encrypted,
            old_key_id="key-v1",
            new_key_id="key-v2"
        )
        
        assert new_encrypted["key_id"] == "key-v2"
        
        # Verify decryption with new key
        decrypted = await encryption.decrypt(
            encrypted_content=new_encrypted["encrypted_content"],
            key_id=new_encrypted["key_id"],
            iv=new_encrypted["iv"],
            tag=new_encrypted["tag"]
        )
        
        assert decrypted == content
    
    @pytest.mark.asyncio
    async def test_secure_key_storage(self):
        """Test secure key storage and retrieval."""
        encryption = DocumentEncryption()
        
        # Store key
        key_id = "secure-key-001"
        key_value = await encryption.generate_key()
        
        await encryption.store_key(key_id, key_value)
        
        # Retrieve key
        retrieved_key = await encryption.retrieve_key(key_id)
        assert retrieved_key == key_value
        
        # Test key deletion
        await encryption.delete_key(key_id)
        retrieved_key = await encryption.retrieve_key(key_id)
        assert retrieved_key is None


class TestDocumentCompression:
    """Test document compression functionality."""
    
    @pytest.mark.asyncio
    async def test_compress_large_file(self):
        """Test compression of large files."""
        compression = DocumentCompressionService()
        
        # Create large content (>10MB threshold)
        large_content = b"A" * (15 * 1024 * 1024)  # 15MB
        
        compressed = await compression.compress(large_content)
        
        assert len(compressed["content"]) < len(large_content)
        assert compressed["compression_ratio"] > 0
        assert compressed["algorithm"] == "gzip"
        assert compressed["original_size"] == len(large_content)
    
    @pytest.mark.asyncio
    async def test_decompress_file(self):
        """Test decompression."""
        compression = DocumentCompressionService()
        
        # Original content
        original = b"Test content " * 1000
        
        # Compress and decompress
        compressed = await compression.compress(original)
        decompressed = await compression.decompress(
            compressed_content=compressed["content"],
            algorithm=compressed["algorithm"]
        )
        
        assert decompressed == original
    
    @pytest.mark.asyncio
    async def test_skip_small_file_compression(self):
        """Test that small files are not compressed."""
        compression = DocumentCompressionService()
        
        # Small content (<10MB threshold)
        small_content = b"Small file content"
        
        result = await compression.compress(small_content)
        
        assert result["content"] == small_content
        assert result["compression_ratio"] == 1.0
        assert result["algorithm"] == "none"
    
    @pytest.mark.asyncio
    async def test_compression_levels(self):
        """Test different compression levels."""
        compression = DocumentCompressionService()
        
        content = b"Test content " * 10000
        
        # Test different levels
        fast_compressed = await compression.compress(content, level=1)
        best_compressed = await compression.compress(content, level=9)
        
        # Higher compression level should produce smaller file
        assert len(best_compressed["content"]) <= len(fast_compressed["content"])


class TestBackupManager:
    """Test backup and recovery functionality."""
    
    @pytest.mark.asyncio
    async def test_create_backup(self, test_db_session):
        """Test backup creation."""
        backup_manager = BackupManager(db_session=test_db_session)
        
        # Create test document
        document = Document(
            id=1,
            name="important.pdf",
            tenant_id=1,
            file_path="tenant_1/documents/important.pdf"
        )
        content = b"Important document content"
        
        # Create backup
        backup_info = await backup_manager.create_backup(
            document=document,
            content=content
        )
        
        assert backup_info["backup_id"] is not None
        assert backup_info["backup_path"] is not None
        assert backup_info["checksum"] is not None
        assert backup_info["timestamp"] is not None
    
    @pytest.mark.asyncio
    async def test_restore_from_backup(self, test_db_session):
        """Test restoration from backup."""
        backup_manager = BackupManager(db_session=test_db_session)
        
        # Create document and backup
        document = Document(
            id=1,
            name="important.pdf",
            tenant_id=1
        )
        original_content = b"Original content"
        
        backup_info = await backup_manager.create_backup(
            document=document,
            content=original_content
        )
        
        # Restore from backup
        restored_content = await backup_manager.restore_backup(
            backup_id=backup_info["backup_id"],
            document_id=1
        )
        
        assert restored_content == original_content
    
    @pytest.mark.asyncio
    async def test_backup_retention_policy(self, test_db_session):
        """Test backup retention and cleanup."""
        backup_manager = BackupManager(db_session=test_db_session)
        
        # Create old backup (beyond retention period)
        old_backup = await backup_manager.create_backup(
            document=Document(id=1, name="old.pdf", tenant_id=1),
            content=b"Old content",
            timestamp=datetime.utcnow() - timedelta(days=35)
        )
        
        # Create recent backup
        recent_backup = await backup_manager.create_backup(
            document=Document(id=2, name="recent.pdf", tenant_id=1),
            content=b"Recent content"
        )
        
        # Run cleanup (30 day retention)
        deleted_count = await backup_manager.cleanup_old_backups(
            retention_days=30
        )
        
        assert deleted_count == 1
        
        # Verify old backup is gone
        old_exists = await backup_manager.backup_exists(old_backup["backup_id"])
        assert old_exists is False
        
        # Verify recent backup still exists
        recent_exists = await backup_manager.backup_exists(recent_backup["backup_id"])
        assert recent_exists is True
    
    @pytest.mark.asyncio
    async def test_incremental_backup(self, test_db_session):
        """Test incremental backup functionality."""
        backup_manager = BackupManager(db_session=test_db_session)
        
        document = Document(id=1, name="doc.pdf", tenant_id=1)
        
        # Create initial full backup
        full_backup = await backup_manager.create_backup(
            document=document,
            content=b"Initial content",
            backup_type="full"
        )
        
        # Create incremental backup with changes
        incremental_backup = await backup_manager.create_backup(
            document=document,
            content=b"Initial content with modifications",
            backup_type="incremental",
            parent_backup_id=full_backup["backup_id"]
        )
        
        assert incremental_backup["backup_type"] == "incremental"
        assert incremental_backup["parent_backup_id"] == full_backup["backup_id"]
        assert incremental_backup["size"] < full_backup["size"]  # Should be smaller
    
    @pytest.mark.asyncio
    async def test_backup_verification(self, test_db_session):
        """Test backup integrity verification."""
        backup_manager = BackupManager(db_session=test_db_session)
        
        document = Document(id=1, name="doc.pdf", tenant_id=1)
        content = b"Document content"
        
        # Create backup
        backup_info = await backup_manager.create_backup(
            document=document,
            content=content
        )
        
        # Verify backup integrity
        is_valid = await backup_manager.verify_backup(
            backup_id=backup_info["backup_id"],
            expected_checksum=backup_info["checksum"]
        )
        
        assert is_valid is True
        
        # Test with wrong checksum
        is_valid = await backup_manager.verify_backup(
            backup_id=backup_info["backup_id"],
            expected_checksum="wrong_checksum"
        )
        
        assert is_valid is False


class TestDocumentStorageService:
    """Test complete document storage service integration."""
    
    @pytest.mark.asyncio
    async def test_secure_document_upload(self, test_db_session):
        """Test complete secure document upload flow."""
        service = DocumentStorageService(db_session=test_db_session)
        
        # Prepare test file
        content = b"Test document content for secure upload"
        filename = "test_document.pdf"
        mime_type = "application/pdf"
        tenant_id = 1
        user_id = 1
        
        # Upload with all security features
        result = await service.secure_upload(
            content=content,
            filename=filename,
            mime_type=mime_type,
            tenant_id=tenant_id,
            user_id=user_id,
            enable_encryption=True,
            enable_compression=True,
            enable_backup=True
        )
        
        assert result["document_id"] is not None
        assert result["scan_status"] == ScanStatus.CLEAN
        assert result["is_encrypted"] is True
        assert result["is_compressed"] is False  # Too small to compress
        assert result["backup_id"] is not None
    
    @pytest.mark.asyncio
    async def test_tenant_isolation_in_storage(self, test_db_session):
        """Test multi-tenant isolation in storage."""
        service = DocumentStorageService(db_session=test_db_session)
        
        # Upload for tenant 1
        doc1 = await service.secure_upload(
            content=b"Tenant 1 document",
            filename="tenant1.pdf",
            mime_type="application/pdf",
            tenant_id=1,
            user_id=1
        )
        
        # Upload for tenant 2
        doc2 = await service.secure_upload(
            content=b"Tenant 2 document",
            filename="tenant2.pdf",
            mime_type="application/pdf",
            tenant_id=2,
            user_id=2
        )
        
        # Try to access tenant 1's document as tenant 2
        with pytest.raises(PermissionError):
            await service.download_document(
                document_id=doc1["document_id"],
                tenant_id=2
            )
        
        # Verify proper access
        content = await service.download_document(
            document_id=doc1["document_id"],
            tenant_id=1
        )
        assert content == b"Tenant 1 document"
    
    @pytest.mark.asyncio
    async def test_infected_file_handling(self, test_db_session):
        """Test handling of infected files."""
        service = DocumentStorageService(db_session=test_db_session)
        
        # EICAR test virus
        infected_content = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
        
        with pytest.raises(VirusScanError) as exc_info:
            await service.secure_upload(
                content=infected_content,
                filename="virus.exe",
                mime_type="application/x-msdownload",
                tenant_id=1,
                user_id=1
            )
        
        assert "infected" in str(exc_info.value).lower()
        assert "quarantine" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_concurrent_uploads(self, test_db_session):
        """Test handling concurrent uploads."""
        service = DocumentStorageService(db_session=test_db_session)
        
        # Create multiple upload tasks
        upload_tasks = []
        for i in range(10):
            task = service.secure_upload(
                content=f"Document {i} content".encode(),
                filename=f"doc_{i}.pdf",
                mime_type="application/pdf",
                tenant_id=1,
                user_id=1
            )
            upload_tasks.append(task)
        
        # Execute concurrently
        results = await asyncio.gather(*upload_tasks)
        
        assert len(results) == 10
        assert all(r["scan_status"] == ScanStatus.CLEAN for r in results)
        assert len(set(r["document_id"] for r in results)) == 10  # All unique IDs
    
    @pytest.mark.asyncio
    async def test_disaster_recovery(self, test_db_session):
        """Test disaster recovery scenario."""
        service = DocumentStorageService(db_session=test_db_session)
        
        # Upload critical document
        upload_result = await service.secure_upload(
            content=b"Critical business document",
            filename="critical.pdf",
            mime_type="application/pdf",
            tenant_id=1,
            user_id=1,
            enable_backup=True
        )
        
        document_id = upload_result["document_id"]
        
        # Simulate document corruption/loss
        await service.simulate_document_loss(document_id)
        
        # Recover from backup
        recovery_result = await service.recover_document(
            document_id=document_id,
            tenant_id=1
        )
        
        assert recovery_result["success"] is True
        assert recovery_result["recovered_content"] == b"Critical business document"
        assert recovery_result["recovery_source"] == "backup"