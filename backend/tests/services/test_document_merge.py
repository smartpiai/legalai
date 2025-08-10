"""
Document Merge Service Tests
Following TDD - RED phase: Comprehensive test suite for document merging and combining
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional, Tuple
from uuid import uuid4

from app.services.document_merge import (
    DocumentMergeService,
    MergeConfig,
    MergeStrategy,
    MergeResult,
    MergeSection,
    MergeConflict,
    ConflictResolution,
    MergeError,
    PDFMerger,
    WordMerger,
    TextMerger,
    TemplateMerger,
    ClauseMerger,
    VersionMerger,
    ConflictResolver,
    MergeValidator,
    MergeOptimizer,
    MergeCache,
    merge_documents,
    merge_templates,
    resolve_conflicts,
    validate_merge
)


@pytest.fixture
def mock_storage():
    """Mock storage service"""
    storage_mock = AsyncMock()
    storage_mock.get = AsyncMock()
    storage_mock.put = AsyncMock()
    storage_mock.get_document = AsyncMock()
    storage_mock.get_content = AsyncMock()
    return storage_mock


@pytest.fixture
def mock_cache():
    """Mock cache service"""
    cache_mock = AsyncMock()
    cache_mock.get = AsyncMock(return_value=None)
    cache_mock.set = AsyncMock()
    cache_mock.delete = AsyncMock()
    return cache_mock


@pytest.fixture
def sample_documents():
    """Sample documents for merging"""
    return {
        "doc1": {
            "id": str(uuid4()),
            "title": "Service Agreement Template",
            "content": """
            SECTION 1: PARTIES
            This agreement is between Company A and Contractor B.
            
            SECTION 2: SERVICES
            Contractor will provide software development services.
            """,
            "sections": ["PARTIES", "SERVICES"],
            "type": "template"
        },
        "doc2": {
            "id": str(uuid4()),
            "title": "Payment Terms Template", 
            "content": """
            SECTION 3: PAYMENT
            Payment shall be made within 30 days.
            
            SECTION 4: TERMINATION
            Either party may terminate with 30 days notice.
            """,
            "sections": ["PAYMENT", "TERMINATION"],
            "type": "template"
        },
        "doc3": {
            "id": str(uuid4()),
            "title": "Liability Clause",
            "content": """
            SECTION 5: LIABILITY
            Liability is limited to the contract value.
            """,
            "sections": ["LIABILITY"],
            "type": "clause"
        }
    }


@pytest.fixture
def merge_config():
    """Default merge configuration"""
    return MergeConfig(
        strategy=MergeStrategy.APPEND,
        preserve_formatting=True,
        handle_conflicts=True,
        include_metadata=True,
        auto_resolve_conflicts=False,
        merge_headers=True,
        merge_footers=False,
        section_separator="\n\n"
    )


class TestDocumentMergeService:
    """Test document merge functionality"""
    
    @pytest.mark.asyncio
    async def test_merge_multiple_documents(self, mock_storage, sample_documents, merge_config):
        """Test merging multiple documents"""
        service = DocumentMergeService(storage=mock_storage)
        
        # Mock storage responses
        mock_storage.get_document.side_effect = [
            sample_documents["doc1"],
            sample_documents["doc2"],
            sample_documents["doc3"]
        ]
        
        document_ids = [doc["id"] for doc in sample_documents.values()]
        
        result = await service.merge_documents(
            document_ids=document_ids,
            config=merge_config,
            title="Merged Contract Template"
        )
        
        assert result.status == "completed"
        assert result.title == "Merged Contract Template"
        assert len(result.sections) >= 3  # Should have at least original sections
        assert result.merged_content is not None
        assert len(result.conflicts) >= 0  # May have conflicts to resolve
    
    @pytest.mark.asyncio
    async def test_merge_with_strategy_append(self, mock_storage, sample_documents):
        """Test merging with append strategy"""
        service = DocumentMergeService(storage=mock_storage)
        
        mock_storage.get_document.side_effect = [
            sample_documents["doc1"],
            sample_documents["doc2"]
        ]
        
        config = MergeConfig(strategy=MergeStrategy.APPEND)
        document_ids = [sample_documents["doc1"]["id"], sample_documents["doc2"]["id"]]
        
        result = await service.merge_documents(document_ids, config)
        
        assert "SECTION 1: PARTIES" in result.merged_content
        assert "SECTION 3: PAYMENT" in result.merged_content
        # Content should be in original order when appending
    
    @pytest.mark.asyncio
    async def test_merge_with_strategy_interleave(self, mock_storage, sample_documents):
        """Test merging with interleave strategy"""
        service = DocumentMergeService(storage=mock_storage)
        
        mock_storage.get_document.side_effect = [
            sample_documents["doc1"],
            sample_documents["doc2"]
        ]
        
        config = MergeConfig(strategy=MergeStrategy.INTERLEAVE)
        document_ids = [sample_documents["doc1"]["id"], sample_documents["doc2"]["id"]]
        
        result = await service.merge_documents(document_ids, config)
        
        # Should interleave sections from both documents
        assert len(result.sections) == 4  # 2 from each document
    
    @pytest.mark.asyncio
    async def test_merge_with_conflicts(self, mock_storage):
        """Test merge handling conflicts"""
        service = DocumentMergeService(storage=mock_storage)
        
        # Create documents with conflicting sections
        conflicting_docs = [
            {
                "id": "doc1",
                "content": "SECTION 1: PAYMENT\nPayment due in 15 days.",
                "sections": ["PAYMENT"]
            },
            {
                "id": "doc2", 
                "content": "SECTION 1: PAYMENT\nPayment due in 30 days.",
                "sections": ["PAYMENT"]
            }
        ]
        
        mock_storage.get_document.side_effect = conflicting_docs
        
        config = MergeConfig(handle_conflicts=True)
        
        result = await service.merge_documents(["doc1", "doc2"], config)
        
        assert len(result.conflicts) > 0
        assert result.conflicts[0].section_name == "PAYMENT"
        assert result.conflicts[0].type == "duplicate_section"
    
    @pytest.mark.asyncio
    async def test_merge_preserve_formatting(self, mock_storage, sample_documents):
        """Test merge preserving document formatting"""
        service = DocumentMergeService(storage=mock_storage)
        
        # Document with specific formatting
        formatted_doc = {
            "id": "doc1",
            "content": "**BOLD HEADER**\n*Italic text*\n- Bullet point",
            "formatting": {
                "bold_sections": ["BOLD HEADER"],
                "italic_sections": ["Italic text"],
                "lists": ["Bullet point"]
            }
        }
        
        mock_storage.get_document.return_value = formatted_doc
        
        config = MergeConfig(preserve_formatting=True)
        
        result = await service.merge_documents(["doc1"], config)
        
        assert "**BOLD HEADER**" in result.merged_content
        assert "*Italic text*" in result.merged_content
        assert "- Bullet point" in result.merged_content
    
    @pytest.mark.asyncio
    async def test_merge_error_handling(self, mock_storage):
        """Test merge error handling"""
        service = DocumentMergeService(storage=mock_storage)
        
        # Mock storage failure
        mock_storage.get_document.side_effect = Exception("Document not found")
        
        with pytest.raises(MergeError):
            await service.merge_documents(["nonexistent_doc"], MergeConfig())


class TestPDFMerger:
    """Test PDF-specific merge functionality"""
    
    @pytest.mark.asyncio
    async def test_merge_pdf_documents(self):
        """Test merging PDF documents"""
        merger = PDFMerger()
        
        # Mock PDF content
        pdf1_content = b"%PDF-1.4 ... content 1"
        pdf2_content = b"%PDF-1.4 ... content 2"
        
        pdf_list = [
            {"content": pdf1_content, "title": "Document 1"},
            {"content": pdf2_content, "title": "Document 2"}
        ]
        
        merged_pdf = await merger.merge_pdfs(pdf_list)
        
        assert merged_pdf.content is not None
        assert merged_pdf.page_count >= 2  # At least one page from each
        assert len(merged_pdf.bookmarks) == 2  # One bookmark per document
    
    @pytest.mark.asyncio
    async def test_pdf_merge_with_bookmarks(self):
        """Test PDF merge preserving bookmarks"""
        merger = PDFMerger()
        
        pdf_with_bookmarks = [
            {
                "content": b"%PDF content",
                "bookmarks": [{"title": "Chapter 1", "page": 1}]
            }
        ]
        
        result = await merger.merge_with_bookmarks(pdf_with_bookmarks)
        
        assert len(result.bookmarks) > 0
        assert result.bookmarks[0]["title"] == "Chapter 1"
    
    @pytest.mark.asyncio
    async def test_pdf_merge_page_ranges(self):
        """Test merging specific page ranges"""
        merger = PDFMerger()
        
        pdf_content = b"%PDF content"
        page_ranges = [
            {"start": 1, "end": 3},
            {"start": 5, "end": 7}
        ]
        
        result = await merger.merge_page_ranges(pdf_content, page_ranges)
        
        assert result.page_count == 5  # 3 + 2 pages selected
    
    @pytest.mark.asyncio
    async def test_pdf_merge_metadata(self):
        """Test merging PDF with metadata preservation"""
        merger = PDFMerger()
        
        pdfs = [
            {
                "content": b"%PDF content",
                "metadata": {"author": "John Doe", "title": "Doc 1"}
            }
        ]
        
        result = await merger.merge_with_metadata(pdfs)
        
        assert "author" in result.metadata
        assert result.metadata["title"] is not None


class TestWordMerger:
    """Test Word document merge functionality"""
    
    @pytest.mark.asyncio
    async def test_merge_docx_documents(self):
        """Test merging Word documents"""
        merger = WordMerger()
        
        # Mock DOCX content
        docx_files = [
            {"content": b"PK\x03\x04", "title": "Agreement.docx"},
            {"content": b"PK\x03\x04", "title": "Addendum.docx"}
        ]
        
        merged_doc = await merger.merge_documents(docx_files)
        
        assert merged_doc.content is not None
        assert merged_doc.sections_count >= 2
    
    @pytest.mark.asyncio
    async def test_word_merge_styles(self):
        """Test merging Word documents preserving styles"""
        merger = WordMerger()
        
        docs_with_styles = [
            {
                "content": b"PK\x03\x04",
                "styles": {"Heading 1": {"font": "Arial", "size": 16}}
            }
        ]
        
        result = await merger.merge_with_styles(docs_with_styles)
        
        assert result.styles_preserved is True
        assert len(result.style_conflicts) >= 0
    
    @pytest.mark.asyncio
    async def test_word_merge_headers_footers(self):
        """Test merging headers and footers"""
        merger = WordMerger()
        
        docs = [
            {
                "content": b"PK\x03\x04",
                "headers": ["Company Name"],
                "footers": ["Page 1"]
            }
        ]
        
        config = MergeConfig(merge_headers=True, merge_footers=True)
        
        result = await merger.merge_with_headers_footers(docs, config)
        
        assert len(result.headers) > 0
        assert len(result.footers) > 0


class TestTextMerger:
    """Test plain text merge functionality"""
    
    @pytest.mark.asyncio
    async def test_merge_text_documents(self):
        """Test merging plain text documents"""
        merger = TextMerger()
        
        texts = [
            "First document content.\nWith multiple lines.",
            "Second document content.\nAlso with lines."
        ]
        
        config = MergeConfig(section_separator="\n---\n")
        
        result = await merger.merge_texts(texts, config)
        
        assert "First document content" in result
        assert "Second document content" in result
        assert "\n---\n" in result  # Separator should be present
    
    @pytest.mark.asyncio
    async def test_text_merge_line_numbering(self):
        """Test text merge with line numbering"""
        merger = TextMerger()
        
        texts = ["Line 1\nLine 2", "Line 3\nLine 4"]
        
        result = await merger.merge_with_line_numbers(texts)
        
        assert "1: Line 1" in result
        assert "2: Line 2" in result
        assert "3: Line 3" in result
    
    @pytest.mark.asyncio
    async def test_text_merge_sections(self):
        """Test merging text documents by sections"""
        merger = TextMerger()
        
        sectioned_texts = [
            {
                "sections": {
                    "Introduction": "Welcome to our service",
                    "Terms": "These are the terms"
                }
            },
            {
                "sections": {
                    "Privacy": "Your privacy matters",
                    "Contact": "Contact us here"
                }
            }
        ]
        
        result = await merger.merge_by_sections(sectioned_texts)
        
        assert "Introduction" in result.section_titles
        assert "Privacy" in result.section_titles
        assert len(result.merged_sections) == 4


class TestTemplateMerger:
    """Test template-specific merge functionality"""
    
    @pytest.mark.asyncio
    async def test_merge_contract_templates(self, sample_documents):
        """Test merging contract templates"""
        merger = TemplateMerger()
        
        templates = [
            sample_documents["doc1"],
            sample_documents["doc2"]
        ]
        
        result = await merger.merge_templates(templates)
        
        assert result.template_type == "contract"
        assert len(result.merged_clauses) >= 2
        assert result.variable_mappings is not None
    
    @pytest.mark.asyncio
    async def test_template_merge_variables(self):
        """Test merging templates with variable resolution"""
        merger = TemplateMerger()
        
        templates = [
            {
                "content": "Party: {{party_name}}",
                "variables": ["party_name"]
            },
            {
                "content": "Amount: {{contract_amount}}",
                "variables": ["contract_amount"]
            }
        ]
        
        result = await merger.merge_with_variables(templates)
        
        assert "{{party_name}}" in result.content
        assert "{{contract_amount}}" in result.content
        assert len(result.all_variables) == 2
    
    @pytest.mark.asyncio
    async def test_template_merge_conditional_sections(self):
        """Test merging templates with conditional sections"""
        merger = TemplateMerger()
        
        templates = [
            {
                "content": "{% if include_warranty %}Warranty clause{% endif %}",
                "conditions": ["include_warranty"]
            }
        ]
        
        result = await merger.merge_conditional_templates(templates)
        
        assert "include_warranty" in result.conditions
        assert result.has_conditional_content is True


class TestClauseMerger:
    """Test clause-specific merge functionality"""
    
    @pytest.mark.asyncio
    async def test_merge_legal_clauses(self):
        """Test merging legal clauses"""
        merger = ClauseMerger()
        
        clauses = [
            {
                "id": "liability_001",
                "type": "liability",
                "content": "Liability is limited to contract value.",
                "precedence": 1
            },
            {
                "id": "termination_001", 
                "type": "termination",
                "content": "30 days notice required.",
                "precedence": 2
            }
        ]
        
        result = await merger.merge_clauses(clauses)
        
        assert len(result.merged_clauses) == 2
        assert result.clause_order[0]["type"] == "liability"  # Higher precedence first
    
    @pytest.mark.asyncio
    async def test_clause_merge_compatibility(self):
        """Test clause compatibility checking"""
        merger = ClauseMerger()
        
        clauses = [
            {
                "type": "indemnity",
                "content": "Full indemnification required.",
                "compatible_with": ["liability"],
                "conflicts_with": ["limitation_of_liability"]
            },
            {
                "type": "limitation_of_liability",
                "content": "No liability beyond fees paid.",
                "conflicts_with": ["indemnity"]
            }
        ]
        
        result = await merger.check_clause_compatibility(clauses)
        
        assert len(result.conflicts) > 0
        assert result.conflicts[0]["type"] == "clause_conflict"
    
    @pytest.mark.asyncio
    async def test_clause_merge_dependencies(self):
        """Test clause dependency resolution"""
        merger = ClauseMerger()
        
        clauses = [
            {
                "id": "payment",
                "depends_on": ["governing_law"]
            },
            {
                "id": "governing_law"
            }
        ]
        
        result = await merger.resolve_dependencies(clauses)
        
        assert result.dependency_order[0]["id"] == "governing_law"
        assert result.dependency_order[1]["id"] == "payment"


class TestVersionMerger:
    """Test version merge functionality"""
    
    @pytest.mark.asyncio
    async def test_merge_document_versions(self):
        """Test merging different versions of a document"""
        merger = VersionMerger()
        
        versions = [
            {
                "version": "1.0",
                "content": "Original contract terms.",
                "timestamp": datetime(2023, 1, 1)
            },
            {
                "version": "1.1",
                "content": "Updated contract terms with amendments.",
                "timestamp": datetime(2023, 2, 1)
            }
        ]
        
        result = await merger.merge_versions(versions)
        
        assert result.final_version == "1.1"
        assert len(result.version_history) == 2
        assert result.merged_content is not None
    
    @pytest.mark.asyncio
    async def test_version_merge_change_tracking(self):
        """Test tracking changes across versions"""
        merger = VersionMerger()
        
        versions = [
            {"version": "1.0", "content": "Payment due in 15 days."},
            {"version": "2.0", "content": "Payment due in 30 days."}
        ]
        
        result = await merger.merge_with_change_tracking(versions)
        
        assert len(result.changes) > 0
        assert "15 days" in result.changes[0]["old_value"]
        assert "30 days" in result.changes[0]["new_value"]
    
    @pytest.mark.asyncio
    async def test_version_merge_conflict_resolution(self):
        """Test resolving conflicts between versions"""
        merger = VersionMerger()
        
        conflicting_versions = [
            {"version": "1.0", "section": "terms", "content": "Original terms"},
            {"version": "1.1", "section": "terms", "content": "Modified terms"},
            {"version": "1.2", "section": "terms", "content": "Further modified terms"}
        ]
        
        result = await merger.resolve_version_conflicts(conflicting_versions)
        
        assert result.resolution_strategy is not None
        assert result.final_content is not None


class TestConflictResolver:
    """Test conflict resolution functionality"""
    
    @pytest.mark.asyncio
    async def test_detect_merge_conflicts(self):
        """Test detecting conflicts during merge"""
        resolver = ConflictResolver()
        
        sections = [
            {"name": "payment", "content": "Pay in 15 days", "source": "doc1"},
            {"name": "payment", "content": "Pay in 30 days", "source": "doc2"}
        ]
        
        conflicts = await resolver.detect_conflicts(sections)
        
        assert len(conflicts) > 0
        assert conflicts[0].section_name == "payment"
        assert conflicts[0].type == "content_conflict"
    
    @pytest.mark.asyncio
    async def test_auto_resolve_conflicts(self):
        """Test automatic conflict resolution"""
        resolver = ConflictResolver()
        
        conflict = MergeConflict(
            section_name="payment",
            type="content_conflict",
            sources=["doc1", "doc2"],
            content_options=["15 days", "30 days"]
        )
        
        resolution = await resolver.auto_resolve(conflict)
        
        assert resolution.resolution_type in ["latest_wins", "merge_both", "manual_required"]
    
    @pytest.mark.asyncio
    async def test_manual_conflict_resolution(self):
        """Test manual conflict resolution"""
        resolver = ConflictResolver()
        
        conflict = MergeConflict(
            section_name="liability",
            type="content_conflict",
            content_options=["Limited liability", "Full liability"]
        )
        
        manual_resolution = ConflictResolution(
            conflict_id=conflict.id,
            resolution_type="custom",
            selected_content="Moderate liability as agreed"
        )
        
        result = await resolver.apply_resolution(conflict, manual_resolution)
        
        assert result.resolved_content == "Moderate liability as agreed"
        assert result.status == "resolved"


class TestMergeValidator:
    """Test merge validation functionality"""
    
    @pytest.mark.asyncio
    async def test_validate_merge_result(self):
        """Test validating merge results"""
        validator = MergeValidator()
        
        merge_result = MergeResult(
            id=str(uuid4()),
            title="Test Merge",
            merged_content="Complete merged document content",
            sections=[
                MergeSection(name="intro", content="Introduction"),
                MergeSection(name="terms", content="Terms and conditions")
            ],
            status="completed"
        )
        
        validation = await validator.validate(merge_result)
        
        assert validation.is_valid is True
        assert len(validation.errors) == 0
        assert validation.completeness_score > 0.8
    
    @pytest.mark.asyncio
    async def test_validate_merge_completeness(self):
        """Test validation of merge completeness"""
        validator = MergeValidator()
        
        incomplete_merge = MergeResult(
            id=str(uuid4()),
            title="Incomplete Merge",
            merged_content="",  # Empty content
            sections=[],
            status="pending"
        )
        
        validation = await validator.validate_completeness(incomplete_merge)
        
        assert validation.is_complete is False
        assert "empty_content" in validation.missing_elements
    
    @pytest.mark.asyncio
    async def test_validate_legal_compliance(self):
        """Test legal compliance validation"""
        validator = MergeValidator()
        
        legal_document = {
            "content": "This agreement is governed by California law.",
            "clauses": ["governing_law", "dispute_resolution"],
            "required_sections": ["parties", "consideration", "signatures"]
        }
        
        compliance = await validator.validate_legal_compliance(legal_document)
        
        assert compliance.is_compliant is not None
        assert len(compliance.missing_clauses) >= 0


class TestMergeCache:
    """Test merge result caching"""
    
    @pytest.mark.asyncio
    async def test_cache_merge_result(self, mock_cache):
        """Test caching merge results"""
        cache = MergeCache(cache_client=mock_cache)
        
        merge_result = MergeResult(
            id="merge_123",
            title="Cached Merge",
            merged_content="Cached content",
            sections=[],
            status="completed"
        )
        
        await cache.store_result("merge_123", merge_result)
        
        mock_cache.set.assert_called_once()
        
        # Test retrieval
        mock_cache.get.return_value = merge_result.__dict__
        cached = await cache.get_result("merge_123")
        
        assert cached is not None
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, mock_cache):
        """Test cache invalidation"""
        cache = MergeCache(cache_client=mock_cache)
        
        await cache.invalidate_document_merges("doc_123")
        
        mock_cache.delete.assert_called()


# Helper function tests
class TestHelperFunctions:
    """Test helper functions"""
    
    @pytest.mark.asyncio
    async def test_merge_documents_helper(self, mock_storage, sample_documents):
        """Test merge_documents helper function"""
        mock_storage.get_document.side_effect = [
            sample_documents["doc1"],
            sample_documents["doc2"]
        ]
        
        result = await merge_documents(
            document_ids=["doc1", "doc2"],
            config=MergeConfig(),
            storage=mock_storage
        )
        
        assert result.status == "completed"
        assert result.merged_content is not None
    
    @pytest.mark.asyncio
    async def test_merge_templates_helper(self):
        """Test merge_templates helper function"""
        templates = [
            {"content": "Template 1", "type": "contract"},
            {"content": "Template 2", "type": "addendum"}
        ]
        
        result = await merge_templates(templates)
        
        assert result.template_type is not None
        assert len(result.merged_clauses) >= 0
    
    @pytest.mark.asyncio
    async def test_resolve_conflicts_helper(self):
        """Test resolve_conflicts helper function"""
        conflicts = [
            MergeConflict(
                section_name="payment",
                type="content_conflict",
                content_options=["15 days", "30 days"]
            )
        ]
        
        resolutions = await resolve_conflicts(conflicts)
        
        assert len(resolutions) == len(conflicts)
        assert resolutions[0].resolution_type is not None
    
    @pytest.mark.asyncio
    async def test_validate_merge_helper(self):
        """Test validate_merge helper function"""
        merge_result = MergeResult(
            id=str(uuid4()),
            title="Test Validation",
            merged_content="Valid content",
            sections=[],
            status="completed"
        )
        
        validation = await validate_merge(merge_result)
        
        assert validation.is_valid is not None
        assert validation.completeness_score >= 0


# Integration Tests
class TestMergeIntegration:
    """Test merge service integration"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_document_merge(self, mock_storage, sample_documents):
        """Test complete document merge workflow"""
        service = DocumentMergeService(storage=mock_storage)
        
        # Setup storage mocks
        mock_storage.get_document.side_effect = [
            sample_documents["doc1"],
            sample_documents["doc2"],
            sample_documents["doc3"]
        ]
        
        # Configure merge
        config = MergeConfig(
            strategy=MergeStrategy.APPEND,
            handle_conflicts=True,
            auto_resolve_conflicts=True
        )
        
        # Execute merge
        result = await service.merge_documents(
            document_ids=list(sample_documents.keys()),
            config=config,
            title="Complete Contract"
        )
        
        # Validate result
        assert result.status == "completed"
        assert result.title == "Complete Contract"
        assert len(result.sections) >= 3
        assert result.merged_content is not None
        
        # Check all expected sections are present
        expected_sections = ["PARTIES", "SERVICES", "PAYMENT", "TERMINATION", "LIABILITY"]
        for section in expected_sections:
            assert any(section in s.name for s in result.sections)
    
    @pytest.mark.asyncio
    async def test_multi_format_merge(self, mock_storage):
        """Test merging documents of different formats"""
        service = DocumentMergeService(storage=mock_storage)
        
        mixed_documents = [
            {"id": "pdf_doc", "type": "pdf", "content": b"%PDF content"},
            {"id": "word_doc", "type": "docx", "content": b"PK\x03\x04"},
            {"id": "text_doc", "type": "txt", "content": "Plain text content"}
        ]
        
        mock_storage.get_document.side_effect = mixed_documents
        
        config = MergeConfig(normalize_format="html")
        
        result = await service.merge_documents(
            document_ids=["pdf_doc", "word_doc", "text_doc"],
            config=config
        )
        
        assert result.status == "completed"
        assert result.output_format == "html"
    
    @pytest.mark.asyncio
    async def test_large_document_merge_performance(self, mock_storage):
        """Test performance with large document merges"""
        service = DocumentMergeService(storage=mock_storage)
        
        # Create large document content
        large_content = "Large document content. " * 10000
        large_documents = [
            {"id": f"large_doc_{i}", "content": large_content}
            for i in range(5)
        ]
        
        mock_storage.get_document.side_effect = large_documents
        
        start_time = datetime.utcnow()
        
        result = await service.merge_documents(
            document_ids=[doc["id"] for doc in large_documents],
            config=MergeConfig()
        )
        
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        assert result.status == "completed"
        assert processing_time < 30  # Should complete within 30 seconds
        assert result.performance_metrics["processing_time"] == processing_time