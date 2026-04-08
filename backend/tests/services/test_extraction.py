"""
Tests for document text and metadata extraction services.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")

import io
from datetime import datetime
from pathlib import Path
import json
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any, Optional

from app.services.extraction import (
    TextExtractor,
    MetadataExtractor,
    ExtractionPipeline,
    ExtractionResult,
    DocumentMetadata,
    ExtractedEntity
)


class TestTextExtractor:
    """Test text extraction from various document formats."""
    
    @pytest.mark.asyncio
    async def test_extract_text_from_pdf(self):
        """Test extracting text from a PDF file."""
        extractor = TextExtractor()
        
        # Create a test PDF content (simplified)
        pdf_content = b"%PDF-1.4\ntest content\nThis is a test contract between Party A and Party B"
        
        result = await extractor.extract_from_pdf(pdf_content)
        
        assert result.success is True
        assert "test contract" in result.text.lower()
        assert "Party A" in result.text
        assert "Party B" in result.text
        assert result.page_count > 0
        assert result.extraction_method == "pdfplumber"
    
    @pytest.mark.asyncio
    async def test_extract_text_from_scanned_pdf_with_ocr(self):
        """Test OCR extraction from scanned PDF."""
        extractor = TextExtractor()
        
        # Mock a scanned PDF (image-based)
        scanned_pdf_content = b"%PDF-1.4\n[image data]"
        
        result = await extractor.extract_from_pdf(
            scanned_pdf_content,
            use_ocr=True
        )
        
        assert result.success is True
        assert result.extraction_method == "tesseract_ocr"
        assert result.ocr_confidence is not None
        assert result.ocr_confidence >= 0.0
    
    @pytest.mark.asyncio
    async def test_extract_text_from_docx(self):
        """Test extracting text from DOCX file."""
        extractor = TextExtractor()
        
        # Create mock DOCX content
        docx_content = b"PK\x03\x04"  # DOCX file signature
        
        with patch('app.services.extraction.Document') as mock_doc:
            mock_doc.return_value.paragraphs = [
                Mock(text="Service Agreement"),
                Mock(text="This agreement is between Company A and Company B"),
                Mock(text="Effective Date: January 1, 2024")
            ]
            
            result = await extractor.extract_from_docx(docx_content)
            
            assert result.success is True
            assert "Service Agreement" in result.text
            assert "Company A" in result.text
            assert "January 1, 2024" in result.text
            assert result.extraction_method == "python-docx"
    
    @pytest.mark.asyncio
    async def test_extract_text_from_txt(self):
        """Test extracting text from plain text file."""
        extractor = TextExtractor()
        
        txt_content = b"Simple Contract\nBetween: John Doe\nAnd: Jane Smith\nDate: 2024-01-15"
        
        result = await extractor.extract_from_txt(txt_content)
        
        assert result.success is True
        assert result.text == txt_content.decode('utf-8')
        assert "John Doe" in result.text
        assert result.extraction_method == "direct"
    
    @pytest.mark.asyncio
    async def test_extract_text_from_xlsx(self):
        """Test extracting text from Excel file."""
        extractor = TextExtractor()
        
        # Mock Excel content
        xlsx_content = b"PK\x03\x04"  # XLSX file signature
        
        with patch('app.services.extraction.openpyxl.load_workbook') as mock_wb:
            mock_ws = Mock()
            mock_ws.iter_rows.return_value = [
                [Mock(value="Contract ID"), Mock(value="CTR-001")],
                [Mock(value="Client"), Mock(value="ABC Corp")],
                [Mock(value="Amount"), Mock(value=50000)]
            ]
            mock_wb.return_value.active = mock_ws
            
            result = await extractor.extract_from_xlsx(xlsx_content)
            
            assert result.success is True
            assert "Contract ID" in result.text
            assert "CTR-001" in result.text
            assert "ABC Corp" in result.text
            assert result.extraction_method == "openpyxl"
    
    @pytest.mark.asyncio
    async def test_extract_with_unsupported_format(self):
        """Test handling of unsupported file formats."""
        extractor = TextExtractor()
        
        result = await extractor.extract(
            content=b"unknown format",
            mime_type="application/unknown"
        )
        
        assert result.success is False
        assert "Unsupported" in result.error_message
    
    @pytest.mark.asyncio
    async def test_extract_with_corrupted_file(self):
        """Test handling of corrupted files."""
        extractor = TextExtractor()
        
        corrupted_pdf = b"corrupted data"
        
        result = await extractor.extract_from_pdf(corrupted_pdf)
        
        assert result.success is False
        assert result.error_message is not None
        assert result.text == ""


class TestMetadataExtractor:
    """Test metadata extraction using NLP."""
    
    @pytest.mark.asyncio
    async def test_extract_contract_title(self):
        """Test extracting contract title from text."""
        extractor = MetadataExtractor()
        
        text = """
        SERVICE AGREEMENT
        
        This Service Agreement ("Agreement") is entered into as of January 1, 2024
        between ABC Corporation and XYZ Limited.
        """
        
        metadata = await extractor.extract_metadata(text)
        
        assert metadata.title == "SERVICE AGREEMENT"
        assert metadata.document_type == "Service Agreement"
    
    @pytest.mark.asyncio
    async def test_extract_parties(self):
        """Test extracting party names from contract."""
        extractor = MetadataExtractor()
        
        text = """
        This Agreement is between:
        1. Tech Solutions Inc., a Delaware corporation ("Client")
        2. Digital Services LLC, a California limited liability company ("Vendor")
        """
        
        metadata = await extractor.extract_metadata(text)
        
        assert len(metadata.parties) == 2
        assert any("Tech Solutions Inc" in party.name for party in metadata.parties)
        assert any("Digital Services LLC" in party.name for party in metadata.parties)
        assert any(party.role == "Client" for party in metadata.parties)
        assert any(party.role == "Vendor" for party in metadata.parties)
    
    @pytest.mark.asyncio
    async def test_extract_dates(self):
        """Test extracting important dates from contract."""
        extractor = MetadataExtractor()
        
        text = """
        Effective Date: January 15, 2024
        Term: This agreement shall commence on January 15, 2024 and 
        continue until December 31, 2024.
        Payment Due: Within 30 days of invoice date.
        """
        
        metadata = await extractor.extract_metadata(text)
        
        assert metadata.effective_date == datetime(2024, 1, 15).date()
        assert metadata.expiration_date == datetime(2024, 12, 31).date()
        assert "January 15, 2024" in [d.text for d in metadata.important_dates]
    
    @pytest.mark.asyncio
    async def test_extract_monetary_values(self):
        """Test extracting monetary amounts from contract."""
        extractor = MetadataExtractor()
        
        text = """
        Total Contract Value: $500,000.00
        Monthly Payment: $41,666.67
        Late Fee: 1.5% per month
        Security Deposit: USD 50,000
        """
        
        metadata = await extractor.extract_metadata(text)
        
        assert len(metadata.monetary_values) >= 3
        assert any(v.amount == 500000.00 for v in metadata.monetary_values)
        assert any(v.amount == 41666.67 for v in metadata.monetary_values)
        assert any(v.amount == 50000.00 for v in metadata.monetary_values)
        assert all(v.currency in ["USD", "$"] for v in metadata.monetary_values)
    
    @pytest.mark.asyncio
    async def test_extract_contract_number(self):
        """Test extracting contract reference number."""
        extractor = MetadataExtractor()
        
        text = """
        Contract Number: CTR-2024-001-SVC
        Reference: PO-12345
        """
        
        metadata = await extractor.extract_metadata(text)
        
        assert metadata.contract_number == "CTR-2024-001-SVC"
        assert "PO-12345" in metadata.reference_numbers
    
    @pytest.mark.asyncio
    async def test_extract_clauses(self):
        """Test identifying important contract clauses."""
        extractor = MetadataExtractor()
        
        text = """
        5. TERMINATION
        Either party may terminate this Agreement with 30 days written notice.
        
        6. CONFIDENTIALITY
        All parties agree to maintain strict confidentiality.
        
        7. LIABILITY LIMITATION
        Neither party shall be liable for indirect damages.
        """
        
        metadata = await extractor.extract_metadata(text)
        
        assert len(metadata.clauses) >= 3
        assert any(c.title == "TERMINATION" for c in metadata.clauses)
        assert any(c.title == "CONFIDENTIALITY" for c in metadata.clauses)
        assert any(c.title == "LIABILITY LIMITATION" for c in metadata.clauses)
    
    @pytest.mark.asyncio
    async def test_extract_jurisdiction(self):
        """Test extracting governing law and jurisdiction."""
        extractor = MetadataExtractor()
        
        text = """
        This Agreement shall be governed by the laws of the State of California,
        without regard to its conflict of laws principles. Any disputes shall be
        resolved in the courts of San Francisco County, California.
        """
        
        metadata = await extractor.extract_metadata(text)
        
        assert metadata.governing_law == "State of California"
        assert metadata.jurisdiction == "San Francisco County, California"


class TestExtractionPipeline:
    """Test the complete extraction pipeline."""
    
    @pytest.mark.asyncio
    async def test_pipeline_pdf_processing(self, test_db_session):
        """Test complete pipeline for PDF processing."""
        pipeline = ExtractionPipeline(db_session=test_db_session)
        
        # Mock document
        document = Mock(
            id=1,
            file_path="test.pdf",
            mime_type="application/pdf",
            tenant_id=1
        )
        
        # Mock file content
        pdf_content = b"%PDF-1.4\nSERVICE AGREEMENT\nBetween ABC Corp and XYZ Ltd"
        
        with patch.object(pipeline, 'download_document', return_value=pdf_content):
            result = await pipeline.process_document(document)
            
            assert result.success is True
            assert result.extracted_text is not None
            assert result.metadata is not None
            assert "SERVICE AGREEMENT" in result.extracted_text
            assert result.metadata.get("title") == "SERVICE AGREEMENT"
            assert len(result.metadata.get("parties", [])) > 0
    
    @pytest.mark.asyncio
    async def test_pipeline_with_celery_task(self, test_db_session):
        """Test async processing with Celery task."""
        from app.tasks.extraction import extract_document_metadata
        
        document_id = 1
        
        # Mock Celery task
        with patch('app.tasks.extraction.extract_document_metadata.delay') as mock_task:
            mock_task.return_value.id = "task-123"
            
            task_id = extract_document_metadata.delay(document_id)
            
            mock_task.assert_called_once_with(document_id)
            assert task_id.id == "task-123"
    
    @pytest.mark.asyncio
    async def test_pipeline_error_handling(self, test_db_session):
        """Test pipeline error handling and recovery."""
        pipeline = ExtractionPipeline(db_session=test_db_session)
        
        document = Mock(
            id=1,
            file_path="corrupted.pdf",
            mime_type="application/pdf",
            tenant_id=1
        )
        
        with patch.object(pipeline, 'download_document', side_effect=Exception("Download failed")):
            result = await pipeline.process_document(document)
            
            assert result.success is False
            assert "Download failed" in result.error_message
            assert result.extracted_text == ""
    
    @pytest.mark.asyncio
    async def test_pipeline_updates_document_status(self, test_db_session):
        """Test that pipeline updates document extraction status."""
        from app.models.document import Document
        
        # Create test document
        document = Document(
            name="test.pdf",
            file_path="test.pdf",
            file_size=1000,
            mime_type="application/pdf",
            tenant_id=1,
            extraction_status="pending"
        )
        test_db_session.add(document)
        await test_db_session.commit()
        
        pipeline = ExtractionPipeline(db_session=test_db_session)
        
        # Mock successful extraction
        with patch.object(pipeline, 'download_document', return_value=b"PDF content"):
            with patch.object(pipeline.text_extractor, 'extract') as mock_extract:
                mock_extract.return_value = Mock(
                    success=True,
                    text="Contract text",
                    page_count=1
                )
                
                result = await pipeline.process_document(document)
                
                # Refresh document
                await test_db_session.refresh(document)
                
                assert document.extraction_status == "completed"
                assert document.extracted_text == "Contract text"
                assert document.extraction_error is None
    
    @pytest.mark.asyncio
    async def test_pipeline_batch_processing(self, test_db_session):
        """Test batch processing of multiple documents."""
        pipeline = ExtractionPipeline(db_session=test_db_session)
        
        documents = [
            Mock(id=1, file_path="doc1.pdf", mime_type="application/pdf"),
            Mock(id=2, file_path="doc2.docx", mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Mock(id=3, file_path="doc3.txt", mime_type="text/plain")
        ]
        
        results = await pipeline.process_batch(documents)
        
        assert len(results) == 3
        assert all(isinstance(r, ExtractionResult) for r in results)
    
    @pytest.mark.asyncio
    async def test_pipeline_with_confidence_threshold(self):
        """Test extraction with OCR confidence threshold."""
        pipeline = ExtractionPipeline(min_ocr_confidence=0.8)
        
        document = Mock(
            id=1,
            file_path="scanned.pdf",
            mime_type="application/pdf"
        )
        
        # Mock low confidence OCR result
        with patch.object(pipeline.text_extractor, 'extract') as mock_extract:
            mock_extract.return_value = Mock(
                success=True,
                text="Low confidence text",
                ocr_confidence=0.6,
                extraction_method="tesseract_ocr"
            )
            
            result = await pipeline.process_document(document)
            
            assert result.success is False
            assert "OCR confidence too low" in result.error_message


class TestExtractionResult:
    """Test extraction result data structure."""
    
    def test_extraction_result_success(self):
        """Test successful extraction result."""
        result = ExtractionResult(
            success=True,
            extracted_text="Contract text",
            metadata={
                "title": "Service Agreement",
                "parties": ["ABC Corp", "XYZ Ltd"]
            },
            page_count=10,
            extraction_method="pdfplumber",
            processing_time=1.5
        )
        
        assert result.success is True
        assert result.extracted_text == "Contract text"
        assert result.metadata["title"] == "Service Agreement"
        assert len(result.metadata["parties"]) == 2
        assert result.error_message is None
    
    def test_extraction_result_failure(self):
        """Test failed extraction result."""
        result = ExtractionResult(
            success=False,
            error_message="File corrupted",
            extracted_text="",
            metadata={}
        )
        
        assert result.success is False
        assert result.error_message == "File corrupted"
        assert result.extracted_text == ""
        assert result.metadata == {}
    
    def test_extraction_result_to_dict(self):
        """Test converting result to dictionary."""
        result = ExtractionResult(
            success=True,
            extracted_text="Text",
            metadata={"key": "value"},
            page_count=5
        )
        
        result_dict = result.to_dict()
        
        assert isinstance(result_dict, dict)
        assert result_dict["success"] is True
        assert result_dict["extracted_text"] == "Text"
        assert result_dict["metadata"]["key"] == "value"
        assert result_dict["page_count"] == 5