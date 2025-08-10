"""
Document Comparison Service Tests
Following TDD - RED phase: Comprehensive test suite for document comparison and diff tracking
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import Dict, List, Any, Optional, Tuple
from uuid import uuid4

from app.services.document_comparison import (
    DocumentComparisonService,
    ComparisonResult,
    ComparisonType,
    DiffType,
    DiffEntry,
    ComparisonConfig,
    TextComparator,
    PDFComparator,
    WordComparator,
    VersionComparator,
    SemanticComparator,
    LegalComparator,
    DiffAnalyzer,
    ChangeDetector,
    ComparisonReport,
    ComparisonMetrics,
    SideBySideComparator,
    UnifiedDiffComparator,
    VisualDiffGenerator,
    ChangeHighlighter,
    ComparisonCache,
    compare_documents,
    compare_versions,
    generate_diff_report,
    highlight_changes
)


@pytest.fixture
def mock_storage():
    """Mock storage service"""
    storage_mock = AsyncMock()
    storage_mock.get_document = AsyncMock()
    storage_mock.get_text_content = AsyncMock()
    return storage_mock


@pytest.fixture
def sample_documents():
    """Sample documents for comparison"""
    return {
        "doc1": {
            "id": str(uuid4()),
            "content": "This is the original document content. It has multiple sentences.",
            "type": "text/plain",
            "title": "Original Contract",
            "version": 1
        },
        "doc2": {
            "id": str(uuid4()),
            "content": "This is the modified document content. It has multiple paragraphs now.",
            "type": "text/plain",
            "title": "Modified Contract",
            "version": 2
        }
    }


@pytest.fixture
def comparison_config():
    """Default comparison configuration"""
    return ComparisonConfig(
        comparison_type=ComparisonType.TEXT,
        ignore_whitespace=True,
        ignore_case=False,
        word_level=True,
        character_level=False,
        semantic_analysis=False,
        track_moves=True,
        context_lines=3
    )


class TestDocumentComparisonService:
    """Test document comparison functionality"""
    
    @pytest.mark.asyncio
    async def test_compare_text_documents(self, mock_storage, sample_documents, comparison_config):
        """Test comparing two text documents"""
        service = DocumentComparisonService(storage=mock_storage)
        
        mock_storage.get_text_content.side_effect = [
            sample_documents["doc1"]["content"],
            sample_documents["doc2"]["content"]
        ]
        
        result = await service.compare_documents(
            document1_id=sample_documents["doc1"]["id"],
            document2_id=sample_documents["doc2"]["id"],
            config=comparison_config
        )
        
        assert result.document1_id == sample_documents["doc1"]["id"]
        assert result.document2_id == sample_documents["doc2"]["id"]
        assert result.similarity_score >= 0.0 and result.similarity_score <= 1.0
        assert len(result.differences) > 0
        assert result.status == "completed"
    
    @pytest.mark.asyncio
    async def test_word_level_comparison(self, mock_storage, comparison_config):
        """Test word-level document comparison"""
        service = DocumentComparisonService(storage=mock_storage)
        
        text1 = "The quick brown fox jumps over the lazy dog."
        text2 = "The quick red fox jumps over the sleepy dog."
        
        mock_storage.get_text_content.side_effect = [text1, text2]
        
        config = comparison_config
        config.word_level = True
        
        result = await service.compare_documents("doc1", "doc2", config)
        
        # Should detect word-level changes
        word_changes = [d for d in result.differences if d.type == DiffType.MODIFIED]
        assert len(word_changes) >= 2  # "brown" -> "red", "lazy" -> "sleepy"
    
    @pytest.mark.asyncio
    async def test_character_level_comparison(self, mock_storage, comparison_config):
        """Test character-level document comparison"""
        service = DocumentComparisonService(storage=mock_storage)
        
        text1 = "Hello World"
        text2 = "Hello World!"
        
        mock_storage.get_text_content.side_effect = [text1, text2]
        
        config = comparison_config
        config.character_level = True
        
        result = await service.compare_documents("doc1", "doc2", config)
        
        # Should detect character addition
        additions = [d for d in result.differences if d.type == DiffType.ADDED]
        assert len(additions) == 1
        assert "!" in additions[0].content
    
    @pytest.mark.asyncio
    async def test_ignore_whitespace_option(self, mock_storage, comparison_config):
        """Test ignoring whitespace in comparison"""
        service = DocumentComparisonService(storage=mock_storage)
        
        text1 = "Hello    World"
        text2 = "Hello World"
        
        mock_storage.get_text_content.side_effect = [text1, text2]
        
        config = comparison_config
        config.ignore_whitespace = True
        
        result = await service.compare_documents("doc1", "doc2", config)
        
        # Should have no differences when ignoring whitespace
        assert len(result.differences) == 0
        assert result.similarity_score == 1.0
    
    @pytest.mark.asyncio
    async def test_track_moved_content(self, mock_storage, comparison_config):
        """Test tracking moved content between documents"""
        service = DocumentComparisonService(storage=mock_storage)
        
        text1 = "Paragraph 1. Paragraph 2. Paragraph 3."
        text2 = "Paragraph 3. Paragraph 1. Paragraph 2."
        
        mock_storage.get_text_content.side_effect = [text1, text2]
        
        config = comparison_config
        config.track_moves = True
        
        result = await service.compare_documents("doc1", "doc2", config)
        
        # Should detect moved content
        moves = [d for d in result.differences if d.type == DiffType.MOVED]
        assert len(moves) > 0


class TestTextComparator:
    """Test text-specific comparison functionality"""
    
    @pytest.mark.asyncio
    async def test_line_by_line_comparison(self):
        """Test line-by-line text comparison"""
        comparator = TextComparator()
        
        text1 = "Line 1\nLine 2\nLine 3"
        text2 = "Line 1\nModified Line 2\nLine 3\nLine 4"
        
        diffs = await comparator.compare_lines(text1, text2)
        
        assert len(diffs) >= 2  # One modification, one addition
        modified_diffs = [d for d in diffs if d.type == DiffType.MODIFIED]
        added_diffs = [d for d in diffs if d.type == DiffType.ADDED]
        
        assert len(modified_diffs) == 1
        assert len(added_diffs) == 1
        assert "Modified Line 2" in modified_diffs[0].content
        assert "Line 4" in added_diffs[0].content
    
    @pytest.mark.asyncio
    async def test_word_tokenization(self):
        """Test word-level tokenization for comparison"""
        comparator = TextComparator()
        
        text = "The quick, brown fox!"
        tokens = await comparator.tokenize_words(text)
        
        assert "The" in tokens
        assert "quick" in tokens
        assert "brown" in tokens
        assert "fox" in tokens
        # Punctuation should be handled appropriately
    
    @pytest.mark.asyncio
    async def test_similarity_calculation(self):
        """Test text similarity calculation"""
        comparator = TextComparator()
        
        text1 = "The quick brown fox"
        text2 = "The quick red fox"
        
        similarity = await comparator.calculate_similarity(text1, text2)
        
        assert 0.0 <= similarity <= 1.0
        assert similarity > 0.7  # Should be quite similar
    
    @pytest.mark.asyncio
    async def test_fuzzy_matching(self):
        """Test fuzzy string matching for similar content"""
        comparator = TextComparator()
        
        text1 = "Implementation"
        text2 = "Implementatoin"  # Typo
        
        match_score = await comparator.fuzzy_match(text1, text2)
        
        assert match_score > 0.8  # Should detect as very similar despite typo


class TestPDFComparator:
    """Test PDF document comparison"""
    
    @pytest.mark.asyncio
    async def test_pdf_text_extraction_comparison(self):
        """Test comparing PDFs by extracting and comparing text"""
        comparator = PDFComparator()
        
        # Mock PDF content
        pdf1_content = b"%PDF-1.4 ... mock content 1"
        pdf2_content = b"%PDF-1.4 ... mock content 2"
        
        result = await comparator.compare_pdfs(pdf1_content, pdf2_content)
        
        assert result.similarity_score is not None
        assert isinstance(result.differences, list)
    
    @pytest.mark.asyncio
    async def test_pdf_page_by_page_comparison(self):
        """Test comparing PDFs page by page"""
        comparator = PDFComparator()
        
        pdf_content = b"%PDF-1.4 ... mock content"
        
        pages1 = await comparator.extract_pages(pdf_content)
        pages2 = await comparator.extract_pages(pdf_content)
        
        page_diffs = await comparator.compare_pages(pages1, pages2)
        
        assert isinstance(page_diffs, list)
    
    @pytest.mark.asyncio
    async def test_pdf_visual_comparison(self):
        """Test visual comparison of PDF pages"""
        comparator = PDFComparator()
        
        page1_image = b"mock_page_image_1"
        page2_image = b"mock_page_image_2"
        
        visual_diff = await comparator.compare_visual(page1_image, page2_image)
        
        assert "difference_score" in visual_diff
        assert "highlighted_areas" in visual_diff


class TestVersionComparator:
    """Test version comparison functionality"""
    
    @pytest.mark.asyncio
    async def test_version_chain_comparison(self):
        """Test comparing versions in a document chain"""
        comparator = VersionComparator()
        
        versions = [
            {"id": "v1", "content": "Version 1 content", "timestamp": datetime(2023, 1, 1)},
            {"id": "v2", "content": "Version 2 content modified", "timestamp": datetime(2023, 1, 2)},
            {"id": "v3", "content": "Version 3 content further modified", "timestamp": datetime(2023, 1, 3)}
        ]
        
        chain_diff = await comparator.compare_version_chain(versions)
        
        assert len(chain_diff) == 2  # Two transitions
        assert chain_diff[0]["from_version"] == "v1"
        assert chain_diff[0]["to_version"] == "v2"
    
    @pytest.mark.asyncio
    async def test_change_attribution(self):
        """Test attributing changes to specific versions"""
        comparator = VersionComparator()
        
        version_data = {
            "author": "user123",
            "timestamp": datetime.utcnow(),
            "changes": ["Added clause 5.1", "Modified section 3.2"]
        }
        
        attribution = await comparator.attribute_changes(version_data)
        
        assert attribution["author"] == "user123"
        assert len(attribution["changes"]) == 2


class TestSemanticComparator:
    """Test semantic comparison functionality"""
    
    @pytest.mark.asyncio
    async def test_semantic_similarity(self):
        """Test semantic similarity analysis"""
        comparator = SemanticComparator()
        
        text1 = "The contract will expire on December 31st."
        text2 = "The agreement ends on the last day of December."
        
        semantic_score = await comparator.calculate_semantic_similarity(text1, text2)
        
        assert 0.0 <= semantic_score <= 1.0
        assert semantic_score > 0.6  # Should detect semantic similarity
    
    @pytest.mark.asyncio
    async def test_concept_extraction(self):
        """Test extracting key concepts for comparison"""
        comparator = SemanticComparator()
        
        text = "The contractor shall deliver the software by the deadline specified in Exhibit A."
        
        concepts = await comparator.extract_concepts(text)
        
        assert "contractor" in [c.lower() for c in concepts]
        assert "software" in [c.lower() for c in concepts]
        assert "deadline" in [c.lower() for c in concepts]
    
    @pytest.mark.asyncio
    async def test_intent_comparison(self):
        """Test comparing document intent/meaning"""
        comparator = SemanticComparator()
        
        clause1 = "Payment is due within 30 days of invoice date."
        clause2 = "Invoice must be paid no later than 30 days after receipt."
        
        intent_similarity = await comparator.compare_intent(clause1, clause2)
        
        assert intent_similarity > 0.8  # Similar intent despite different wording


class TestLegalComparator:
    """Test legal document specific comparison"""
    
    @pytest.mark.asyncio
    async def test_clause_comparison(self):
        """Test comparing legal clauses"""
        comparator = LegalComparator()
        
        clause1 = "The Contractor agrees to indemnify and hold harmless the Client."
        clause2 = "Contractor shall indemnify Client against all claims and damages."
        
        clause_diff = await comparator.compare_clauses(clause1, clause2)
        
        assert clause_diff["legal_equivalence"] is not None
        assert "differences" in clause_diff
        assert "risk_implications" in clause_diff
    
    @pytest.mark.asyncio
    async def test_term_definition_comparison(self):
        """Test comparing term definitions"""
        comparator = LegalComparator()
        
        term1 = '"Confidential Information" means any proprietary data or information.'
        term2 = '"Confidential Information" shall mean proprietary data and information.'
        
        term_diff = await comparator.compare_definitions(term1, term2)
        
        assert term_diff["term"] == "Confidential Information"
        assert term_diff["substantially_similar"] is True
    
    @pytest.mark.asyncio
    async def test_legal_risk_analysis(self):
        """Test analyzing legal risk implications of changes"""
        comparator = LegalComparator()
        
        old_clause = "Liability is limited to $10,000."
        new_clause = "Liability is limited to $100,000."
        
        risk_analysis = await comparator.analyze_risk_change(old_clause, new_clause)
        
        assert risk_analysis["risk_level"] == "high"
        assert "liability increase" in risk_analysis["description"].lower()


class TestDiffAnalyzer:
    """Test diff analysis functionality"""
    
    @pytest.mark.asyncio
    async def test_categorize_changes(self):
        """Test categorizing different types of changes"""
        analyzer = DiffAnalyzer()
        
        diffs = [
            DiffEntry(type=DiffType.ADDED, content="New paragraph", position=10),
            DiffEntry(type=DiffType.DELETED, content="Old paragraph", position=5),
            DiffEntry(type=DiffType.MODIFIED, content="Changed word", position=15)
        ]
        
        categories = await analyzer.categorize_changes(diffs)
        
        assert "additions" in categories
        assert "deletions" in categories
        assert "modifications" in categories
        assert len(categories["additions"]) == 1
        assert len(categories["deletions"]) == 1
        assert len(categories["modifications"]) == 1
    
    @pytest.mark.asyncio
    async def test_impact_assessment(self):
        """Test assessing the impact of changes"""
        analyzer = DiffAnalyzer()
        
        diffs = [
            DiffEntry(type=DiffType.MODIFIED, content="payment terms", position=100),
            DiffEntry(type=DiffType.ADDED, content="new clause", position=200)
        ]
        
        impact = await analyzer.assess_impact(diffs)
        
        assert "high_impact_changes" in impact
        assert "medium_impact_changes" in impact
        assert "low_impact_changes" in impact
    
    @pytest.mark.asyncio
    async def test_change_statistics(self):
        """Test calculating change statistics"""
        analyzer = DiffAnalyzer()
        
        diffs = [
            DiffEntry(type=DiffType.ADDED, content="word1", position=1),
            DiffEntry(type=DiffType.ADDED, content="word2", position=2),
            DiffEntry(type=DiffType.DELETED, content="word3", position=3),
            DiffEntry(type=DiffType.MODIFIED, content="word4", position=4)
        ]
        
        stats = await analyzer.calculate_statistics(diffs)
        
        assert stats["total_changes"] == 4
        assert stats["additions"] == 2
        assert stats["deletions"] == 1
        assert stats["modifications"] == 1
        assert stats["change_density"] > 0


class TestChangeDetector:
    """Test change detection functionality"""
    
    @pytest.mark.asyncio
    async def test_detect_structural_changes(self):
        """Test detecting structural changes in documents"""
        detector = ChangeDetector()
        
        doc1_structure = {
            "sections": ["Introduction", "Terms", "Conclusion"],
            "subsections": {"Terms": ["Payment", "Delivery"]},
            "paragraphs": 15
        }
        
        doc2_structure = {
            "sections": ["Introduction", "Terms", "Warranties", "Conclusion"],
            "subsections": {"Terms": ["Payment", "Delivery", "Penalties"]},
            "paragraphs": 18
        }
        
        changes = await detector.detect_structural_changes(doc1_structure, doc2_structure)
        
        assert "sections_added" in changes
        assert "subsections_added" in changes
        assert "Warranties" in changes["sections_added"]
        assert "Penalties" in changes["subsections_added"]["Terms"]
    
    @pytest.mark.asyncio
    async def test_detect_formatting_changes(self):
        """Test detecting formatting changes"""
        detector = ChangeDetector()
        
        format1 = {"font": "Arial", "size": 12, "bold_headings": True}
        format2 = {"font": "Times", "size": 12, "bold_headings": True, "italic_emphasis": True}
        
        format_changes = await detector.detect_formatting_changes(format1, format2)
        
        assert "font_changed" in format_changes
        assert "properties_added" in format_changes
        assert format_changes["font_changed"]["from"] == "Arial"
        assert format_changes["font_changed"]["to"] == "Times"
    
    @pytest.mark.asyncio
    async def test_detect_content_moves(self):
        """Test detecting moved content"""
        detector = ChangeDetector()
        
        content1 = ["Para A", "Para B", "Para C", "Para D"]
        content2 = ["Para A", "Para C", "Para B", "Para D"]
        
        moves = await detector.detect_moves(content1, content2)
        
        assert len(moves) > 0
        assert moves[0]["content"] in ["Para B", "Para C"]
        assert "from_position" in moves[0]
        assert "to_position" in moves[0]


class TestComparisonReport:
    """Test comparison report generation"""
    
    @pytest.mark.asyncio
    async def test_generate_summary_report(self):
        """Test generating comparison summary report"""
        reporter = ComparisonReport()
        
        result = ComparisonResult(
            document1_id="doc1",
            document2_id="doc2",
            similarity_score=0.85,
            differences=[
                DiffEntry(type=DiffType.ADDED, content="new text", position=10),
                DiffEntry(type=DiffType.MODIFIED, content="changed text", position=20)
            ],
            status="completed"
        )
        
        report = await reporter.generate_summary(result)
        
        assert "Document Comparison Summary" in report
        assert "Similarity Score: 85%" in report
        assert "Total Changes: 2" in report
    
    @pytest.mark.asyncio
    async def test_generate_detailed_report(self):
        """Test generating detailed comparison report"""
        reporter = ComparisonReport()
        
        result = ComparisonResult(
            document1_id="doc1",
            document2_id="doc2",
            similarity_score=0.75,
            differences=[
                DiffEntry(type=DiffType.ADDED, content="Addition", position=5),
                DiffEntry(type=DiffType.DELETED, content="Deletion", position=15)
            ]
        )
        
        detailed_report = await reporter.generate_detailed(result)
        
        assert "Detailed Comparison Report" in detailed_report
        assert "Additions:" in detailed_report
        assert "Deletions:" in detailed_report
        assert "Addition" in detailed_report
        assert "Deletion" in detailed_report
    
    @pytest.mark.asyncio
    async def test_export_comparison_data(self):
        """Test exporting comparison data"""
        reporter = ComparisonReport()
        
        result = ComparisonResult(
            document1_id="doc1",
            document2_id="doc2",
            similarity_score=0.90,
            differences=[]
        )
        
        # Export as JSON
        json_export = await reporter.export_json(result)
        assert "document1_id" in json_export
        assert "similarity_score" in json_export
        
        # Export as CSV
        csv_export = await reporter.export_csv(result)
        assert "Type,Content,Position" in csv_export


class TestSideBySideComparator:
    """Test side-by-side comparison display"""
    
    @pytest.mark.asyncio
    async def test_side_by_side_layout(self):
        """Test generating side-by-side comparison layout"""
        comparator = SideBySideComparator()
        
        text1 = "Original text content"
        text2 = "Modified text content"
        
        layout = await comparator.generate_layout(text1, text2)
        
        assert "left_column" in layout
        assert "right_column" in layout
        assert layout["left_column"] == text1
        assert layout["right_column"] == text2
    
    @pytest.mark.asyncio
    async def test_synchronized_scrolling(self):
        """Test synchronized scrolling markers"""
        comparator = SideBySideComparator()
        
        diffs = [
            DiffEntry(type=DiffType.MODIFIED, content="change", position=10)
        ]
        
        scroll_points = await comparator.generate_sync_points(diffs)
        
        assert len(scroll_points) > 0
        assert "left_position" in scroll_points[0]
        assert "right_position" in scroll_points[0]


class TestVisualDiffGenerator:
    """Test visual diff generation"""
    
    @pytest.mark.asyncio
    async def test_generate_html_diff(self):
        """Test generating HTML diff visualization"""
        generator = VisualDiffGenerator()
        
        text1 = "The original document"
        text2 = "The modified document"
        
        html_diff = await generator.generate_html_diff(text1, text2)
        
        assert "<span" in html_diff
        assert "class=" in html_diff
        assert "original" in html_diff
        assert "modified" in html_diff
    
    @pytest.mark.asyncio
    async def test_generate_pdf_diff(self):
        """Test generating PDF diff visualization"""
        generator = VisualDiffGenerator()
        
        content1 = "Original content"
        content2 = "Modified content"
        
        pdf_diff = await generator.generate_pdf_diff(content1, content2)
        
        assert pdf_diff is not None
        assert len(pdf_diff) > 0


class TestComparisonCache:
    """Test comparison result caching"""
    
    @pytest.mark.asyncio
    async def test_cache_comparison_result(self):
        """Test caching comparison results"""
        cache = ComparisonCache()
        
        result = ComparisonResult(
            document1_id="doc1",
            document2_id="doc2",
            similarity_score=0.8,
            differences=[]
        )
        
        cache_key = await cache.generate_key("doc1", "doc2")
        await cache.store(cache_key, result)
        
        cached_result = await cache.retrieve(cache_key)
        assert cached_result is not None
        assert cached_result.similarity_score == 0.8
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self):
        """Test cache invalidation when documents change"""
        cache = ComparisonCache()
        
        await cache.invalidate_document("doc1")
        
        # Should clear all comparisons involving doc1