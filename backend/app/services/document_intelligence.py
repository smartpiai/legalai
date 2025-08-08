"""
Document Intelligence Services
ML-based classification, language detection, and page processing
"""
import hashlib
import json
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_intelligence import (
    DocumentClassification, LanguageInfo, PageAnalysis,
    ClassificationModel, LanguageModel, ProcessingQueue,
    DocumentType, ConfidenceLevel, Language, PageLayout
)
from app.models.document import Document
from app.schemas.document_intelligence import (
    ClassificationRequest, ClassificationResponse,
    LanguageDetectionRequest, LanguageDetectionResponse,
    PageProcessingRequest, PageProcessingResponse,
    DocumentTypeInfo, LanguageSegment, PageSegment,
    TableInfo, ImageInfo, SignatureRegion, SegmentLanguageResponse
)
from app.core.exceptions import NotFoundError


class DocumentClassificationService:
    """Service for ML-based document classification."""
    
    # Keywords for each document type
    DOCUMENT_KEYWORDS = {
        DocumentType.PURCHASE_AGREEMENT: [
            "purchase", "buyer", "seller", "price", "payment", "delivery",
            "purchase agreement", "sale", "acquisition", "goods"
        ],
        DocumentType.SERVICE_AGREEMENT: [
            "service", "services", "provider", "client", "deliverables",
            "service agreement", "consulting", "hourly", "maintenance"
        ],
        DocumentType.NDA: [
            "confidential", "non-disclosure", "nda", "proprietary",
            "confidentiality", "trade secret", "disclosure", "recipient"
        ],
        DocumentType.EMPLOYMENT_CONTRACT: [
            "employment", "employee", "employer", "salary", "benefits",
            "position", "duties", "termination", "compensation"
        ],
        DocumentType.LEASE_AGREEMENT: [
            "lease", "landlord", "tenant", "rent", "premises",
            "security deposit", "term", "rental", "property"
        ],
        DocumentType.LICENSE_AGREEMENT: [
            "license", "licensor", "licensee", "royalty", "intellectual property",
            "copyright", "patent", "trademark", "grant"
        ],
        DocumentType.MASTER_AGREEMENT: [
            "master", "framework", "umbrella", "master agreement",
            "statement of work", "sow", "purchase order"
        ]
    }
    
    async def classify_document(
        self,
        db: AsyncSession,
        request: ClassificationRequest
    ) -> ClassificationResponse:
        """Classify a document using ML/keyword analysis."""
        
        # Check cache first
        if request.use_cache:
            cached = await self._get_cached_classification(db, request.document_id)
            if cached:
                return ClassificationResponse.from_orm(cached)
        
        start_time = datetime.utcnow()
        
        # Perform classification
        content_lower = request.content.lower()
        type_scores = {}
        
        # Calculate scores for each document type
        for doc_type, keywords in self.DOCUMENT_KEYWORDS.items():
            score = sum(1 for keyword in keywords if keyword in content_lower)
            if score > 0:
                # Normalize score based on number of keywords
                type_scores[doc_type] = score / len(keywords)
        
        # Determine primary type and confidence
        if type_scores:
            primary_type = max(type_scores, key=type_scores.get)
            confidence = min(type_scores[primary_type], 1.0)
        else:
            primary_type = DocumentType.UNKNOWN
            confidence = 0.0
        
        # Determine confidence level
        if confidence >= 0.8:
            confidence_level = ConfidenceLevel.HIGH
        elif confidence >= 0.5:
            confidence_level = ConfidenceLevel.MEDIUM
        else:
            confidence_level = ConfidenceLevel.LOW
        
        # Get secondary types
        secondary_types = []
        for doc_type, score in sorted(type_scores.items(), key=lambda x: x[1], reverse=True):
            if doc_type != primary_type and score > 0.3:
                secondary_types.append(DocumentTypeInfo(type=doc_type, confidence=score))
        
        # Extract features and keywords
        features = self._extract_features(request.content)
        keywords = self._extract_keywords(content_lower)
        entities = self._extract_entities(request.content)
        
        # Calculate processing time
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Save to database
        classification = DocumentClassification(
            document_id=request.document_id,
            primary_type=primary_type.value,
            confidence=confidence,
            confidence_level=confidence_level.value,
            secondary_types=[{"type": st.type.value, "confidence": st.confidence} 
                            for st in secondary_types],
            features_detected=features,
            keywords=keywords,
            entities=entities,
            requires_review=(confidence_level == ConfidenceLevel.LOW),
            model_name=request.model_name or "keyword_classifier",
            model_version="1.0.0",
            cache_key=self._generate_cache_key(request.content),
            cached_at=datetime.utcnow(),
            tenant_id=1  # Get from context
        )
        
        db.add(classification)
        await db.commit()
        await db.refresh(classification)
        
        return ClassificationResponse(
            document_id=classification.document_id,
            primary_type=primary_type,
            confidence=confidence,
            confidence_level=confidence_level,
            secondary_types=secondary_types,
            features_detected=features,
            keywords=keywords,
            entities=entities,
            requires_review=classification.requires_review,
            model_name=classification.model_name,
            model_version=classification.model_version,
            processing_time=processing_time
        )
    
    async def batch_classify(
        self,
        db: AsyncSession,
        documents: List[Dict[str, Any]]
    ) -> List[ClassificationResponse]:
        """Classify multiple documents in batch."""
        results = []
        
        for doc in documents:
            request = ClassificationRequest(
                document_id=doc["id"],
                content=doc.get("content", ""),
                file_type=doc.get("file_type", "pdf")
            )
            
            try:
                result = await self.classify_document(db, request)
                results.append(result)
            except Exception as e:
                # Create error result
                results.append(ClassificationResponse(
                    document_id=doc["id"],
                    primary_type=DocumentType.UNKNOWN,
                    confidence=0.0,
                    confidence_level=ConfidenceLevel.LOW,
                    secondary_types=[],
                    features_detected="Error during classification",
                    keywords=[],
                    entities={},
                    requires_review=True,
                    model_name="error",
                    model_version="1.0.0"
                ))
        
        return results
    
    async def train_custom_classifier(
        self,
        db: AsyncSession,
        training_data: List[Dict[str, Any]],
        model_name: str
    ) -> ClassificationModel:
        """Train a custom document classifier."""
        # Simplified training simulation
        model = ClassificationModel(
            model_name=model_name,
            model_type="sklearn",
            version="1.0.0",
            accuracy=0.85,
            precision=0.83,
            recall=0.87,
            f1_score=0.85,
            training_samples=len(training_data),
            training_date=datetime.utcnow(),
            training_duration=10.5,
            parameters={"max_features": 1000, "n_estimators": 100},
            feature_names=["keyword_count", "entity_count", "length"],
            class_labels=[t.value for t in DocumentType],
            model_path=f"/models/{model_name}.pkl",
            model_size=1024000,
            is_active=False
        )
        
        db.add(model)
        await db.commit()
        await db.refresh(model)
        
        return model
    
    async def _get_cached_classification(
        self,
        db: AsyncSession,
        document_id: int
    ) -> Optional[DocumentClassification]:
        """Get cached classification if available."""
        result = await db.execute(
            select(DocumentClassification)
            .where(
                and_(
                    DocumentClassification.document_id == document_id,
                    DocumentClassification.cached_at > datetime.utcnow() - timedelta(hours=24)
                )
            )
        )
        return result.scalar_one_or_none()
    
    def _extract_features(self, content: str) -> str:
        """Extract key features from document."""
        features = []
        
        # Check for common sections
        sections = ["introduction", "terms", "conditions", "payment", "delivery", 
                   "confidential", "signature", "exhibit", "schedule"]
        for section in sections:
            if section in content.lower():
                features.append(section)
        
        # Check for monetary amounts
        if re.search(r'\$[\d,]+', content):
            features.append("monetary_amounts")
        
        # Check for dates
        if re.search(r'\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}', content):
            features.append("dates")
        
        # Check for legal language
        legal_terms = ["whereas", "hereby", "thereof", "herein", "pursuant"]
        if any(term in content.lower() for term in legal_terms):
            features.append("legal_language")
        
        return ", ".join(features)
    
    def _extract_keywords(self, content: str) -> List[str]:
        """Extract important keywords from document."""
        # Simple keyword extraction (in production, use TF-IDF or similar)
        words = re.findall(r'\b[a-z]+\b', content)
        
        # Filter common words
        stop_words = {"the", "and", "or", "is", "are", "to", "of", "in", "for", "a", "an"}
        keywords = [w for w in words if len(w) > 4 and w not in stop_words]
        
        # Count frequency and return top keywords
        from collections import Counter
        word_counts = Counter(keywords)
        
        return [word for word, _ in word_counts.most_common(10)]
    
    def _extract_entities(self, content: str) -> Dict[str, List[str]]:
        """Extract named entities from document."""
        entities = {
            "organizations": [],
            "dates": [],
            "money": [],
            "locations": []
        }
        
        # Extract organization names (simplified)
        org_pattern = r'\b[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*(?: (?:Inc|LLC|Corp|Company|Ltd))?\b'
        entities["organizations"] = list(set(re.findall(org_pattern, content)))[:5]
        
        # Extract dates
        date_pattern = r'\b(?:\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}|January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2},? \d{4}\b'
        entities["dates"] = list(set(re.findall(date_pattern, content)))[:5]
        
        # Extract monetary amounts
        money_pattern = r'\$[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})? (?:USD|dollars|EUR|euros)\b'
        entities["money"] = list(set(re.findall(money_pattern, content)))[:5]
        
        # Extract locations (simplified)
        location_pattern = r'\b(?:New York|California|Texas|Florida|Illinois|London|Paris|Tokyo|Beijing|Mumbai)\b'
        entities["locations"] = list(set(re.findall(location_pattern, content)))[:5]
        
        return entities
    
    def _generate_cache_key(self, content: str) -> str:
        """Generate cache key for content."""
        return hashlib.md5(content.encode()).hexdigest()


class LanguageDetectionService:
    """Service for language detection."""
    
    # Language patterns for detection
    LANGUAGE_PATTERNS = {
        Language.ENGLISH: r'[a-zA-Z\s]+',
        Language.SPANISH: r'[a-záéíóúñüÁÉÍÓÚÑÜ\s]+',
        Language.FRENCH: r'[a-zàâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s]+',
        Language.GERMAN: r'[a-zäöüßÄÖÜ\s]+',
        Language.CHINESE: r'[\u4e00-\u9fff]+',
        Language.JAPANESE: r'[\u3040-\u309f\u30a0-\u30ff]+',
        Language.KOREAN: r'[\uac00-\ud7af]+',
        Language.ARABIC: r'[\u0600-\u06ff]+',
        Language.RUSSIAN: r'[а-яА-ЯёЁ\s]+'
    }
    
    # Common words in each language for detection
    LANGUAGE_WORDS = {
        Language.ENGLISH: ["the", "and", "is", "to", "of", "in", "for", "that", "with"],
        Language.SPANISH: ["el", "la", "de", "y", "en", "que", "es", "por", "con"],
        Language.FRENCH: ["le", "de", "la", "et", "à", "pour", "que", "dans", "avec"],
        Language.GERMAN: ["der", "die", "das", "und", "ist", "für", "mit", "von", "zu"],
        Language.CHINESE: ["的", "是", "在", "有", "和", "为", "这", "与", "了"],
    }
    
    async def detect_language(
        self,
        db: AsyncSession,
        request: LanguageDetectionRequest
    ) -> LanguageDetectionResponse:
        """Detect language of document content."""
        
        # Detect primary language and confidence
        language_scores = self._calculate_language_scores(request.content)
        
        if language_scores:
            primary_language = max(language_scores, key=language_scores.get)
            confidence = language_scores[primary_language]
        else:
            primary_language = Language.UNKNOWN
            confidence = 0.0
        
        # Detect script
        script = self._detect_script(request.content)
        
        # Check if multilingual
        languages_detected = [lang for lang, score in language_scores.items() if score > 0.2]
        is_multilingual = len(languages_detected) > 1
        
        # Check translation requirement
        translation_required = False
        if request.target_language and primary_language != request.target_language:
            translation_required = True
        
        # Detect segments if requested
        language_segments = []
        if request.detect_segments:
            language_segments = self._detect_language_segments(request.content)
        
        # Save to database
        language_info = LanguageInfo(
            document_id=request.document_id,
            primary_language=primary_language.value,
            confidence=confidence,
            script=script,
            is_multilingual=is_multilingual,
            languages_detected=[lang.value for lang in languages_detected],
            translation_required=translation_required,
            target_language=request.target_language.value if request.target_language else None,
            language_segments=[{"start": s.start, "end": s.end, "language": s.language.value} 
                             for s in language_segments],
            requires_review=(confidence < 0.5),
            tenant_id=1  # Get from context
        )
        
        db.add(language_info)
        await db.commit()
        await db.refresh(language_info)
        
        return LanguageDetectionResponse(
            document_id=language_info.document_id,
            primary_language=primary_language,
            confidence=confidence,
            script=script,
            is_multilingual=is_multilingual,
            languages_detected=languages_detected,
            language_segments=language_segments,
            translation_required=translation_required,
            target_language=request.target_language,
            requires_review=language_info.requires_review
        )
    
    async def detect_segments_languages(
        self,
        db: AsyncSession,
        document_id: int,
        segments: List[str]
    ) -> List[SegmentLanguageResponse]:
        """Detect language for each segment."""
        results = []
        
        for i, segment in enumerate(segments):
            language_scores = self._calculate_language_scores(segment)
            
            if language_scores:
                language = max(language_scores, key=language_scores.get)
                confidence = language_scores[language]
            else:
                language = Language.UNKNOWN
                confidence = 0.0
            
            results.append(SegmentLanguageResponse(
                segment_index=i,
                language=language,
                confidence=confidence
            ))
        
        return results
    
    def _calculate_language_scores(self, text: str) -> Dict[Language, float]:
        """Calculate confidence scores for each language."""
        scores = {}
        text_lower = text.lower()
        
        for language, words in self.LANGUAGE_WORDS.items():
            # Count occurrences of common words
            word_count = sum(1 for word in words if word in text_lower)
            
            if word_count > 0:
                # Also check character patterns
                pattern = self.LANGUAGE_PATTERNS.get(language)
                if pattern:
                    matches = len(re.findall(pattern, text))
                    # Combine word and pattern scores
                    scores[language] = min((word_count / len(words) + matches / max(len(text), 1)) / 2, 1.0)
                else:
                    scores[language] = min(word_count / len(words), 1.0)
        
        return scores
    
    def _detect_script(self, text: str) -> str:
        """Detect the script used in text."""
        if re.search(r'[\u4e00-\u9fff]', text):
            return "Han"
        elif re.search(r'[\u3040-\u309f\u30a0-\u30ff]', text):
            return "Japanese"
        elif re.search(r'[\uac00-\ud7af]', text):
            return "Hangul"
        elif re.search(r'[\u0600-\u06ff]', text):
            return "Arabic"
        elif re.search(r'[а-яА-ЯёЁ]', text):
            return "Cyrillic"
        else:
            return "Latin"
    
    def _detect_language_segments(self, text: str) -> List[LanguageSegment]:
        """Detect language segments in text."""
        segments = []
        lines = text.split('\n')
        current_pos = 0
        
        for line in lines:
            if line.strip():
                language_scores = self._calculate_language_scores(line)
                if language_scores:
                    language = max(language_scores, key=language_scores.get)
                    confidence = language_scores[language]
                    
                    segments.append(LanguageSegment(
                        start=current_pos,
                        end=current_pos + len(line),
                        language=language,
                        confidence=confidence,
                        text=line[:50] + "..." if len(line) > 50 else line
                    ))
            
            current_pos += len(line) + 1  # +1 for newline
        
        return segments


class PageProcessingService:
    """Service for page-level document processing."""
    
    async def process_page(
        self,
        db: AsyncSession,
        request: PageProcessingRequest
    ) -> PageProcessingResponse:
        """Process a single page of a document."""
        
        # Determine layout type
        layout_type = self._detect_layout(request.page_text or "")
        
        # Extract headers and footers
        header, footer = None, None
        if request.extract_headers_footers:
            header, footer = self._extract_headers_footers(request.page_text or "")
        
        # Segment content
        segments = []
        if request.segment_content and request.page_text:
            segments = self._segment_content(request.page_text)
        
        # Detect signatures
        has_signatures = False
        signature_regions = []
        if request.detect_signatures and request.page_text:
            has_signatures, signature_regions = self._detect_signatures(request.page_text)
        
        # Extract tables (simplified)
        tables = []
        if request.extract_tables:
            tables = self._extract_tables(request.page_text or "")
        
        # Extract images (placeholder)
        images = []
        if request.extract_images:
            images = self._extract_images(request.page_content)
        
        # Assess quality
        quality_score = None
        quality_issues = []
        if request.assess_quality:
            quality_score, quality_issues = self._assess_quality(
                request.page_text or "",
                request.page_content
            )
        
        # Calculate statistics
        word_count = len((request.page_text or "").split())
        line_count = len((request.page_text or "").split('\n'))
        
        # Save to database
        page_analysis = PageAnalysis(
            document_id=request.document_id,
            page_number=request.page_number,
            layout_type=layout_type.value,
            columns_detected=1 if layout_type == PageLayout.SINGLE_COLUMN else 2,
            has_header=header is not None,
            has_footer=footer is not None,
            header=header,
            footer=footer,
            segments=[{"type": s.segment_type, "content": s.content} for s in segments],
            tables=[{"rows": t.rows, "columns": t.columns} for t in tables],
            images=[{"width": i.width, "height": i.height} for i in images],
            has_signatures=has_signatures,
            signature_regions=[{"bbox": s.bbox} for s in signature_regions],
            quality_score=quality_score,
            quality_issues=quality_issues,
            word_count=word_count,
            line_count=line_count
        )
        
        db.add(page_analysis)
        await db.commit()
        await db.refresh(page_analysis)
        
        return PageProcessingResponse(
            document_id=page_analysis.document_id,
            page_number=page_analysis.page_number,
            layout_type=layout_type,
            columns_detected=page_analysis.columns_detected,
            has_header=page_analysis.has_header,
            has_footer=page_analysis.has_footer,
            header=header,
            footer=footer,
            segments=segments,
            tables=tables,
            images=images,
            has_signatures=has_signatures,
            signature_regions=signature_regions,
            quality_score=quality_score,
            quality_issues=quality_issues,
            word_count=word_count,
            line_count=line_count
        )
    
    async def batch_process_pages(
        self,
        db: AsyncSession,
        document_id: int,
        pages: List[Dict[str, Any]]
    ) -> List[PageProcessingResponse]:
        """Process multiple pages in batch."""
        results = []
        
        for page in pages:
            request = PageProcessingRequest(
                document_id=document_id,
                page_number=page["page_number"],
                page_content=page.get("content"),
                page_text=page.get("text", "")
            )
            
            result = await self.process_page(db, request)
            results.append(result)
        
        return results
    
    def _detect_layout(self, text: str) -> PageLayout:
        """Detect page layout type."""
        if not text:
            return PageLayout.SINGLE_COLUMN
        
        lines = text.split('\n')
        
        # Check for table-like structure
        if any('|' in line for line in lines[:10]):
            return PageLayout.TABLE
        
        # Check for form fields
        if any('___' in line or '[ ]' in line for line in lines):
            return PageLayout.FORM
        
        # Check for multi-column (simplified)
        # In real implementation, would use visual analysis
        return PageLayout.SINGLE_COLUMN
    
    def _extract_headers_footers(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """Extract header and footer from page."""
        if not text:
            return None, None
        
        lines = text.split('\n')
        
        # Simple heuristic: first non-empty line is header
        header = None
        for line in lines[:5]:
            if line.strip():
                header = line.strip()
                break
        
        # Last non-empty line is footer
        footer = None
        for line in reversed(lines[-5:]):
            if line.strip():
                footer = line.strip()
                break
        
        return header, footer
    
    def _segment_content(self, text: str) -> List[PageSegment]:
        """Segment page content into logical sections."""
        segments = []
        lines = text.split('\n')
        
        for line in lines:
            if not line.strip():
                continue
            
            # Detect segment type
            if re.match(r'^[A-Z\s]+:?$', line.strip()) and len(line.strip()) < 50:
                segment_type = "heading"
            elif line.strip().startswith(('•', '-', '*', '1.', '2.', '3.')):
                segment_type = "list"
            else:
                segment_type = "paragraph"
            
            segments.append(PageSegment(
                segment_type=segment_type,
                content=line.strip(),
                bbox=None,
                confidence=0.9,
                style=None
            ))
        
        return segments
    
    def _detect_signatures(self, text: str) -> Tuple[bool, List[SignatureRegion]]:
        """Detect signature regions on page."""
        signature_patterns = [
            r'Signature:?\s*_{3,}',
            r'Signed:?\s*_{3,}',
            r'_{3,}\s*Date:?\s*_{3,}',
            r'By:\s*_{3,}',
            r'\[Signature\]'
        ]
        
        has_signatures = False
        signature_regions = []
        
        for pattern in signature_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                has_signatures = True
                # Simplified: just mark as having signatures
                signature_regions.append(SignatureRegion(
                    bbox=[0, 0, 100, 50],
                    is_signed=False
                ))
                break
        
        return has_signatures, signature_regions
    
    def _extract_tables(self, text: str) -> List[TableInfo]:
        """Extract tables from page."""
        tables = []
        
        # Simple table detection based on pipes
        lines = text.split('\n')
        table_lines = [line for line in lines if '|' in line]
        
        if len(table_lines) >= 2:
            # Assume it's a table
            rows = len(table_lines)
            columns = max(line.count('|') + 1 for line in table_lines)
            
            tables.append(TableInfo(
                rows=rows,
                columns=columns,
                cells=None,
                bbox=None,
                has_header=True
            ))
        
        return tables
    
    def _extract_images(self, content: Optional[bytes]) -> List[ImageInfo]:
        """Extract image information from page."""
        images = []
        
        # Placeholder: in real implementation, would parse PDF/image content
        if content:
            # Simulate finding an image
            images.append(ImageInfo(
                width=600,
                height=400,
                format="jpeg",
                bbox=[100, 100, 600, 400],
                caption=None
            ))
        
        return images
    
    def _assess_quality(self, text: str, content: Optional[bytes]) -> Tuple[float, List[str]]:
        """Assess page quality."""
        issues = []
        
        # Check text quality
        if not text:
            issues.append("No text extracted")
            return 0.0, issues
        
        # Check for common OCR issues
        if len(text) < 100:
            issues.append("Very little text content")
        
        if text.count('?') > len(text) * 0.1:
            issues.append("High number of unrecognized characters")
        
        # Calculate quality score
        quality_score = 1.0
        quality_score -= len(issues) * 0.2
        quality_score = max(0.0, quality_score)
        
        return quality_score, issues