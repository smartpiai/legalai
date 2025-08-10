"""
Document Preview Generator Service Tests
Following TDD - RED phase: Comprehensive test suite for document preview generation
"""

import pytest
import asyncio
from io import BytesIO
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional
from uuid import UUID, uuid4
import base64

from app.services.document_preview import (
    DocumentPreviewGenerator,
    PreviewConfig,
    PreviewFormat,
    PreviewQuality,
    PreviewPage,
    PreviewResult,
    ThumbnailGenerator,
    PDFPreviewGenerator,
    WordPreviewGenerator,
    ExcelPreviewGenerator,
    ImagePreviewGenerator,
    VideoPreviewGenerator,
    TextPreviewGenerator,
    PreviewCache,
    PreviewOptimizer,
    WatermarkService,
    MetadataExtractor,
    PreviewSecurity,
    BatchPreviewGenerator,
    PreviewError,
    generate_preview,
    generate_thumbnail,
    extract_first_page,
    add_watermark
)


@pytest.fixture
def mock_storage():
    """Mock storage service"""
    storage_mock = AsyncMock()
    storage_mock.get = AsyncMock(return_value=b"mock file content")
    storage_mock.put = AsyncMock(return_value="storage://preview/file.png")
    storage_mock.exists = AsyncMock(return_value=False)
    return storage_mock


@pytest.fixture
def mock_cache():
    """Mock cache service"""
    cache_mock = AsyncMock()
    cache_mock.get = AsyncMock(return_value=None)
    cache_mock.set = AsyncMock(return_value=True)
    cache_mock.exists = AsyncMock(return_value=False)
    return cache_mock


@pytest.fixture
def sample_pdf_bytes():
    """Sample PDF content"""
    # Minimal PDF structure
    return b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 612 792]/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (Sample PDF) Tj ET
endstream endobj
xref
0 6
trailer<</Size 6/Root 1 0 R>>
startxref
116
%%EOF"""


@pytest.fixture
def preview_config():
    """Default preview configuration"""
    return PreviewConfig(
        format=PreviewFormat.PNG,
        quality=PreviewQuality.MEDIUM,
        max_pages=5,
        page_width=1024,
        page_height=1448,
        thumbnail_size=(200, 280),
        watermark=None,
        cache_enabled=True
    )


class TestDocumentPreviewGenerator:
    """Test document preview generation"""
    
    @pytest.mark.asyncio
    async def test_generate_pdf_preview(self, mock_storage, sample_pdf_bytes, preview_config):
        """Test generating preview from PDF"""
        generator = DocumentPreviewGenerator(storage=mock_storage)
        mock_storage.get.return_value = sample_pdf_bytes
        
        result = await generator.generate_preview(
            document_id="doc_123",
            document_path="documents/contract.pdf",
            config=preview_config
        )
        
        assert result.document_id == "doc_123"
        assert result.format == PreviewFormat.PNG
        assert len(result.pages) > 0
        assert result.pages[0].page_number == 1
        assert result.pages[0].width == 1024
        assert result.pages[0].height == 1448
    
    @pytest.mark.asyncio
    async def test_generate_word_preview(self, mock_storage, preview_config):
        """Test generating preview from Word document"""
        generator = DocumentPreviewGenerator(storage=mock_storage)
        
        # Mock Word document content
        mock_storage.get.return_value = b"PK\x03\x04"  # DOCX magic bytes
        
        result = await generator.generate_preview(
            document_id="doc_456",
            document_path="documents/agreement.docx",
            config=preview_config
        )
        
        assert result.document_id == "doc_456"
        assert result.format == PreviewFormat.PNG
        assert result.status == "completed"
    
    @pytest.mark.asyncio
    async def test_generate_excel_preview(self, mock_storage, preview_config):
        """Test generating preview from Excel spreadsheet"""
        generator = DocumentPreviewGenerator(storage=mock_storage)
        
        # Mock Excel content
        mock_storage.get.return_value = b"PK\x03\x04"  # XLSX magic bytes
        
        result = await generator.generate_preview(
            document_id="doc_789",
            document_path="documents/data.xlsx",
            config=preview_config
        )
        
        assert result.document_id == "doc_789"
        assert len(result.pages) > 0  # Should show spreadsheet pages
    
    @pytest.mark.asyncio
    async def test_preview_with_page_limit(self, mock_storage, sample_pdf_bytes):
        """Test preview generation with page limit"""
        generator = DocumentPreviewGenerator(storage=mock_storage)
        mock_storage.get.return_value = sample_pdf_bytes
        
        config = PreviewConfig(max_pages=3)
        
        result = await generator.generate_preview(
            document_id="doc_123",
            document_path="documents/long_contract.pdf",
            config=config
        )
        
        assert len(result.pages) <= 3
    
    @pytest.mark.asyncio
    async def test_preview_quality_settings(self, mock_storage, sample_pdf_bytes):
        """Test different preview quality settings"""
        generator = DocumentPreviewGenerator(storage=mock_storage)
        mock_storage.get.return_value = sample_pdf_bytes
        
        # Test high quality
        high_config = PreviewConfig(quality=PreviewQuality.HIGH)
        high_result = await generator.generate_preview(
            document_id="doc_123",
            document_path="documents/contract.pdf",
            config=high_config
        )
        
        # Test low quality
        low_config = PreviewConfig(quality=PreviewQuality.LOW)
        low_result = await generator.generate_preview(
            document_id="doc_123",
            document_path="documents/contract.pdf",
            config=low_config
        )
        
        # High quality should have larger dimensions
        assert high_result.pages[0].width > low_result.pages[0].width


class TestThumbnailGenerator:
    """Test thumbnail generation"""
    
    @pytest.mark.asyncio
    async def test_generate_pdf_thumbnail(self, mock_storage, sample_pdf_bytes):
        """Test generating thumbnail from PDF"""
        generator = ThumbnailGenerator(storage=mock_storage)
        mock_storage.get.return_value = sample_pdf_bytes
        
        thumbnail = await generator.generate_thumbnail(
            document_path="documents/contract.pdf",
            size=(200, 280)
        )
        
        assert thumbnail.width == 200
        assert thumbnail.height == 280
        assert thumbnail.format == "PNG"
        assert thumbnail.data is not None
    
    @pytest.mark.asyncio
    async def test_generate_image_thumbnail(self, mock_storage):
        """Test generating thumbnail from image"""
        generator = ThumbnailGenerator(storage=mock_storage)
        
        # Mock image content (simple PNG header)
        mock_storage.get.return_value = b'\x89PNG\r\n\x1a\n'
        
        thumbnail = await generator.generate_thumbnail(
            document_path="documents/scan.png",
            size=(150, 150)
        )
        
        assert thumbnail.width == 150
        assert thumbnail.height == 150
    
    @pytest.mark.asyncio
    async def test_thumbnail_aspect_ratio(self, mock_storage, sample_pdf_bytes):
        """Test thumbnail maintains aspect ratio"""
        generator = ThumbnailGenerator(storage=mock_storage)
        mock_storage.get.return_value = sample_pdf_bytes
        
        thumbnail = await generator.generate_thumbnail(
            document_path="documents/contract.pdf",
            size=(300, 300),
            maintain_aspect_ratio=True
        )
        
        # Should maintain aspect ratio within bounds
        assert thumbnail.width <= 300
        assert thumbnail.height <= 300
    
    @pytest.mark.asyncio
    async def test_batch_thumbnail_generation(self, mock_storage):
        """Test generating thumbnails for multiple documents"""
        generator = ThumbnailGenerator(storage=mock_storage)
        
        documents = [
            "documents/doc1.pdf",
            "documents/doc2.docx",
            "documents/doc3.png"
        ]
        
        thumbnails = await generator.generate_batch(
            documents=documents,
            size=(200, 200)
        )
        
        assert len(thumbnails) == 3
        assert all(t.width == 200 for t in thumbnails)


class TestPDFPreviewGenerator:
    """Test PDF-specific preview generation"""
    
    @pytest.mark.asyncio
    async def test_extract_pdf_pages(self, sample_pdf_bytes):
        """Test extracting specific pages from PDF"""
        generator = PDFPreviewGenerator()
        
        pages = await generator.extract_pages(
            pdf_content=sample_pdf_bytes,
            page_numbers=[1]
        )
        
        assert len(pages) == 1
        assert pages[0].page_number == 1
        assert pages[0].content is not None
    
    @pytest.mark.asyncio
    async def test_pdf_to_images(self, sample_pdf_bytes):
        """Test converting PDF pages to images"""
        generator = PDFPreviewGenerator()
        
        images = await generator.pdf_to_images(
            pdf_content=sample_pdf_bytes,
            dpi=150,
            format="PNG"
        )
        
        assert len(images) > 0
        assert all(img.format == "PNG" for img in images)
    
    @pytest.mark.asyncio
    async def test_pdf_text_extraction(self, sample_pdf_bytes):
        """Test extracting text from PDF for preview"""
        generator = PDFPreviewGenerator()
        
        text_preview = await generator.extract_text_preview(
            pdf_content=sample_pdf_bytes,
            max_chars=500
        )
        
        assert text_preview is not None
        assert len(text_preview) <= 500
    
    @pytest.mark.asyncio
    async def test_pdf_metadata_extraction(self, sample_pdf_bytes):
        """Test extracting metadata from PDF"""
        generator = PDFPreviewGenerator()
        
        metadata = await generator.extract_metadata(sample_pdf_bytes)
        
        assert "page_count" in metadata
        assert "creation_date" in metadata
        assert "file_size" in metadata


class TestWordPreviewGenerator:
    """Test Word document preview generation"""
    
    @pytest.mark.asyncio
    async def test_docx_to_html_preview(self):
        """Test converting DOCX to HTML for preview"""
        generator = WordPreviewGenerator()
        
        # Mock DOCX content
        docx_content = b"PK\x03\x04"  # Simplified DOCX
        
        html_preview = await generator.to_html(docx_content)
        
        assert html_preview is not None
        assert "<html>" in html_preview or "<div>" in html_preview
    
    @pytest.mark.asyncio
    async def test_docx_to_images(self):
        """Test converting DOCX to images"""
        generator = WordPreviewGenerator()
        
        docx_content = b"PK\x03\x04"
        
        images = await generator.to_images(
            docx_content=docx_content,
            format="PNG"
        )
        
        assert len(images) > 0
    
    @pytest.mark.asyncio
    async def test_docx_style_preservation(self):
        """Test preserving styles in Word preview"""
        generator = WordPreviewGenerator()
        
        docx_content = b"PK\x03\x04"
        
        preview = await generator.generate_preview(
            docx_content=docx_content,
            preserve_styles=True
        )
        
        assert preview.styles_preserved is True


class TestExcelPreviewGenerator:
    """Test Excel preview generation"""
    
    @pytest.mark.asyncio
    async def test_excel_to_html_tables(self):
        """Test converting Excel to HTML tables"""
        generator = ExcelPreviewGenerator()
        
        xlsx_content = b"PK\x03\x04"  # Simplified XLSX
        
        html_preview = await generator.to_html_tables(xlsx_content)
        
        assert "<table>" in html_preview
        assert "</table>" in html_preview
    
    @pytest.mark.asyncio
    async def test_excel_sheet_preview(self):
        """Test generating preview for specific sheets"""
        generator = ExcelPreviewGenerator()
        
        xlsx_content = b"PK\x03\x04"
        
        sheet_preview = await generator.preview_sheet(
            xlsx_content=xlsx_content,
            sheet_name="Sheet1",
            max_rows=100
        )
        
        assert sheet_preview is not None
        assert sheet_preview.row_count <= 100
    
    @pytest.mark.asyncio
    async def test_excel_chart_extraction(self):
        """Test extracting charts from Excel"""
        generator = ExcelPreviewGenerator()
        
        xlsx_content = b"PK\x03\x04"
        
        charts = await generator.extract_charts(xlsx_content)
        
        assert isinstance(charts, list)


class TestImagePreviewGenerator:
    """Test image preview generation"""
    
    @pytest.mark.asyncio
    async def test_image_resize(self):
        """Test resizing images for preview"""
        generator = ImagePreviewGenerator()
        
        # Mock image bytes
        image_content = b'\x89PNG\r\n\x1a\n'
        
        resized = await generator.resize(
            image_content=image_content,
            max_width=800,
            max_height=600
        )
        
        assert resized.width <= 800
        assert resized.height <= 600
    
    @pytest.mark.asyncio
    async def test_image_format_conversion(self):
        """Test converting image formats"""
        generator = ImagePreviewGenerator()
        
        png_content = b'\x89PNG\r\n\x1a\n'
        
        jpeg_preview = await generator.convert_format(
            image_content=png_content,
            target_format="JPEG",
            quality=85
        )
        
        assert jpeg_preview.format == "JPEG"
    
    @pytest.mark.asyncio
    async def test_image_optimization(self):
        """Test image optimization for web preview"""
        generator = ImagePreviewGenerator()
        
        image_content = b'\x89PNG\r\n\x1a\n'
        
        optimized = await generator.optimize_for_web(
            image_content=image_content,
            max_file_size=100000  # 100KB
        )
        
        assert len(optimized.data) <= 100000


class TestPreviewCache:
    """Test preview caching functionality"""
    
    @pytest.mark.asyncio
    async def test_cache_hit(self, mock_cache):
        """Test retrieving preview from cache"""
        cache = PreviewCache(cache_client=mock_cache)
        
        cached_preview = {
            "document_id": "doc_123",
            "pages": [{"page_number": 1, "url": "preview/page1.png"}]
        }
        mock_cache.get.return_value = cached_preview
        
        result = await cache.get_preview("doc_123")
        
        assert result == cached_preview
        mock_cache.get.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cache_miss(self, mock_cache):
        """Test cache miss scenario"""
        cache = PreviewCache(cache_client=mock_cache)
        mock_cache.get.return_value = None
        
        result = await cache.get_preview("doc_456")
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, mock_cache):
        """Test invalidating cached previews"""
        cache = PreviewCache(cache_client=mock_cache)
        
        await cache.invalidate("doc_123")
        
        mock_cache.delete.assert_called_with("preview:doc_123")
    
    @pytest.mark.asyncio
    async def test_cache_ttl(self, mock_cache):
        """Test cache with TTL"""
        cache = PreviewCache(cache_client=mock_cache, ttl_seconds=3600)
        
        preview_data = {"document_id": "doc_123"}
        await cache.set_preview("doc_123", preview_data)
        
        mock_cache.set.assert_called_with(
            "preview:doc_123",
            preview_data,
            ttl=3600
        )


class TestWatermarkService:
    """Test watermark functionality"""
    
    @pytest.mark.asyncio
    async def test_add_text_watermark(self):
        """Test adding text watermark to preview"""
        service = WatermarkService()
        
        # Mock image
        image_data = b'\x89PNG\r\n\x1a\n'
        
        watermarked = await service.add_text_watermark(
            image_data=image_data,
            text="CONFIDENTIAL",
            position="center",
            opacity=0.5
        )
        
        assert watermarked is not None
        assert len(watermarked) > len(image_data)
    
    @pytest.mark.asyncio
    async def test_add_image_watermark(self):
        """Test adding image watermark"""
        service = WatermarkService()
        
        image_data = b'\x89PNG\r\n\x1a\n'
        watermark_data = b'\x89PNG\r\n\x1a\n'
        
        watermarked = await service.add_image_watermark(
            image_data=image_data,
            watermark_data=watermark_data,
            position="bottom-right",
            scale=0.2
        )
        
        assert watermarked is not None
    
    @pytest.mark.asyncio
    async def test_diagonal_watermark(self):
        """Test diagonal watermark pattern"""
        service = WatermarkService()
        
        image_data = b'\x89PNG\r\n\x1a\n'
        
        watermarked = await service.add_diagonal_pattern(
            image_data=image_data,
            text="DRAFT",
            spacing=100
        )
        
        assert watermarked is not None


class TestPreviewSecurity:
    """Test preview security features"""
    
    @pytest.mark.asyncio
    async def test_sanitize_preview_content(self):
        """Test sanitizing preview content"""
        security = PreviewSecurity()
        
        # HTML with potentially malicious content
        html_content = """
        <html>
            <script>alert('xss')</script>
            <img src="x" onerror="alert('xss')">
            <p>Safe content</p>
        </html>
        """
        
        sanitized = await security.sanitize_html(html_content)
        
        assert "<script>" not in sanitized
        assert "onerror" not in sanitized
        assert "Safe content" in sanitized
    
    @pytest.mark.asyncio
    async def test_preview_access_control(self):
        """Test preview access control"""
        security = PreviewSecurity()
        
        # Check user permissions
        has_access = await security.check_access(
            user_id="user_123",
            document_id="doc_456",
            tenant_id="tenant_789"
        )
        
        assert isinstance(has_access, bool)
    
    @pytest.mark.asyncio
    async def test_secure_preview_url(self):
        """Test generating secure preview URLs"""
        security = PreviewSecurity()
        
        secure_url = await security.generate_secure_url(
            preview_path="previews/doc_123/page_1.png",
            expiry_minutes=60
        )
        
        assert "signature" in secure_url
        assert "expires" in secure_url


class TestBatchPreviewGenerator:
    """Test batch preview generation"""
    
    @pytest.mark.asyncio
    async def test_batch_preview_generation(self, mock_storage):
        """Test generating previews for multiple documents"""
        generator = BatchPreviewGenerator(storage=mock_storage)
        
        documents = [
            {"id": "doc_1", "path": "documents/doc1.pdf"},
            {"id": "doc_2", "path": "documents/doc2.docx"},
            {"id": "doc_3", "path": "documents/doc3.xlsx"}
        ]
        
        results = await generator.generate_batch(
            documents=documents,
            config=PreviewConfig()
        )
        
        assert len(results) == 3
        assert all(r.status in ["completed", "failed"] for r in results)
    
    @pytest.mark.asyncio
    async def test_batch_with_parallelism(self, mock_storage):
        """Test batch generation with parallel processing"""
        generator = BatchPreviewGenerator(
            storage=mock_storage,
            max_parallel=5
        )
        
        documents = [{"id": f"doc_{i}", "path": f"doc_{i}.pdf"} for i in range(10)]
        
        results = await generator.generate_batch(
            documents=documents,
            config=PreviewConfig()
        )
        
        assert len(results) == 10
    
    @pytest.mark.asyncio
    async def test_batch_error_handling(self, mock_storage):
        """Test error handling in batch preview generation"""
        generator = BatchPreviewGenerator(storage=mock_storage)
        
        # Mock some failures
        mock_storage.get.side_effect = [
            b"content",
            Exception("Storage error"),
            b"content"
        ]
        
        documents = [
            {"id": "doc_1", "path": "doc1.pdf"},
            {"id": "doc_2", "path": "doc2.pdf"},
            {"id": "doc_3", "path": "doc3.pdf"}
        ]
        
        results = await generator.generate_batch(documents=documents)
        
        success_count = sum(1 for r in results if r.status == "completed")
        fail_count = sum(1 for r in results if r.status == "failed")
        
        assert success_count == 2
        assert fail_count == 1


class TestMetadataExtractor:
    """Test metadata extraction from previews"""
    
    @pytest.mark.asyncio
    async def test_extract_document_metadata(self, sample_pdf_bytes):
        """Test extracting metadata from documents"""
        extractor = MetadataExtractor()
        
        metadata = await extractor.extract(
            content=sample_pdf_bytes,
            content_type="application/pdf"
        )
        
        assert "title" in metadata
        assert "page_count" in metadata
        assert "file_size" in metadata
        assert "creation_date" in metadata
    
    @pytest.mark.asyncio
    async def test_extract_image_metadata(self):
        """Test extracting metadata from images"""
        extractor = MetadataExtractor()
        
        image_content = b'\x89PNG\r\n\x1a\n'
        
        metadata = await extractor.extract(
            content=image_content,
            content_type="image/png"
        )
        
        assert "width" in metadata
        assert "height" in metadata
        assert "format" in metadata
    
    @pytest.mark.asyncio
    async def test_extract_text_statistics(self):
        """Test extracting text statistics for preview"""
        extractor = MetadataExtractor()
        
        text_content = b"This is a sample document with some text content."
        
        stats = await extractor.extract_text_stats(text_content)
        
        assert "word_count" in stats
        assert "char_count" in stats
        assert "line_count" in stats