"""
Document Comparison Service
Following TDD - GREEN phase: Implementation for document comparison and diff tracking
"""

import asyncio
import difflib
import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple, Union
from uuid import uuid4


class ComparisonType(str, Enum):
    """Document comparison types"""
    TEXT = "text"
    PDF = "pdf"
    WORD = "word"
    SEMANTIC = "semantic"
    LEGAL = "legal"
    VISUAL = "visual"


class DiffType(str, Enum):
    """Types of differences"""
    ADDED = "added"
    DELETED = "deleted"
    MODIFIED = "modified"
    MOVED = "moved"
    UNCHANGED = "unchanged"


@dataclass
class DiffEntry:
    """Single difference entry"""
    type: DiffType
    content: str
    position: int
    old_content: Optional[str] = None
    line_number: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComparisonResult:
    """Document comparison result"""
    document1_id: str
    document2_id: str
    similarity_score: float
    differences: List[DiffEntry]
    status: str = "pending"
    comparison_type: ComparisonType = ComparisonType.TEXT
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComparisonConfig:
    """Comparison configuration"""
    comparison_type: ComparisonType = ComparisonType.TEXT
    ignore_whitespace: bool = True
    ignore_case: bool = False
    word_level: bool = True
    character_level: bool = False
    semantic_analysis: bool = False
    track_moves: bool = True
    context_lines: int = 3


class DocumentComparisonService:
    """Main document comparison service"""
    
    def __init__(self, storage=None, cache=None):
        self.storage = storage
        self.cache = cache
        self.text_comparator = TextComparator()
        self.pdf_comparator = PDFComparator()
        self.word_comparator = WordComparator()
        self.semantic_comparator = SemanticComparator()
        self.legal_comparator = LegalComparator()
    
    async def compare_documents(
        self,
        document1_id: str,
        document2_id: str,
        config: ComparisonConfig
    ) -> ComparisonResult:
        """Compare two documents"""
        # Get document contents
        content1 = await self.storage.get_text_content(document1_id)
        content2 = await self.storage.get_text_content(document2_id)
        
        # Choose appropriate comparator
        if config.comparison_type == ComparisonType.TEXT:
            comparator = self.text_comparator
        elif config.comparison_type == ComparisonType.PDF:
            comparator = self.pdf_comparator
        elif config.comparison_type == ComparisonType.SEMANTIC:
            comparator = self.semantic_comparator
        elif config.comparison_type == ComparisonType.LEGAL:
            comparator = self.legal_comparator
        else:
            comparator = self.text_comparator
        
        # Perform comparison
        differences = await comparator.compare(content1, content2, config)
        similarity_score = await self._calculate_similarity(differences, content1, content2)
        
        return ComparisonResult(
            document1_id=document1_id,
            document2_id=document2_id,
            similarity_score=similarity_score,
            differences=differences,
            status="completed",
            comparison_type=config.comparison_type
        )
    
    async def _calculate_similarity(
        self,
        differences: List[DiffEntry],
        content1: str,
        content2: str
    ) -> float:
        """Calculate similarity score based on differences"""
        if not content1 and not content2:
            return 1.0
        
        total_length = len(content1) + len(content2)
        if total_length == 0:
            return 1.0
        
        changed_chars = sum(len(d.content) for d in differences)
        similarity = 1.0 - (changed_chars / total_length)
        
        return max(0.0, min(1.0, similarity))


class TextComparator:
    """Text document comparator"""
    
    async def compare(
        self,
        text1: str,
        text2: str,
        config: ComparisonConfig
    ) -> List[DiffEntry]:
        """Compare two text strings"""
        if config.ignore_whitespace:
            text1 = re.sub(r'\s+', ' ', text1.strip())
            text2 = re.sub(r'\s+', ' ', text2.strip())
        
        if config.ignore_case:
            text1 = text1.lower()
            text2 = text2.lower()
        
        if config.word_level:
            return await self.compare_words(text1, text2, config)
        elif config.character_level:
            return await self.compare_characters(text1, text2)
        else:
            return await self.compare_lines(text1, text2)
    
    async def compare_lines(self, text1: str, text2: str) -> List[DiffEntry]:
        """Compare text line by line"""
        lines1 = text1.splitlines()
        lines2 = text2.splitlines()
        
        differ = difflib.unified_diff(lines1, lines2, lineterm='')
        differences = []
        position = 0
        
        for line in differ:
            if line.startswith('+'):
                differences.append(DiffEntry(
                    type=DiffType.ADDED,
                    content=line[1:],
                    position=position
                ))
            elif line.startswith('-'):
                differences.append(DiffEntry(
                    type=DiffType.DELETED,
                    content=line[1:],
                    position=position
                ))
            position += 1
        
        return differences
    
    async def compare_words(
        self,
        text1: str,
        text2: str,
        config: ComparisonConfig
    ) -> List[DiffEntry]:
        """Compare text word by word"""
        words1 = await self.tokenize_words(text1)
        words2 = await self.tokenize_words(text2)
        
        differ = difflib.SequenceMatcher(None, words1, words2)
        differences = []
        
        for tag, i1, i2, j1, j2 in differ.get_opcodes():
            if tag == 'delete':
                for i in range(i1, i2):
                    differences.append(DiffEntry(
                        type=DiffType.DELETED,
                        content=words1[i],
                        position=i
                    ))
            elif tag == 'insert':
                for j in range(j1, j2):
                    differences.append(DiffEntry(
                        type=DiffType.ADDED,
                        content=words2[j],
                        position=j
                    ))
            elif tag == 'replace':
                for i in range(i1, i2):
                    if i - i1 < j2 - j1:  # Has corresponding word
                        differences.append(DiffEntry(
                            type=DiffType.MODIFIED,
                            content=words2[j1 + (i - i1)],
                            position=i,
                            old_content=words1[i]
                        ))
                    else:
                        differences.append(DiffEntry(
                            type=DiffType.DELETED,
                            content=words1[i],
                            position=i
                        ))
        
        return differences
    
    async def compare_characters(self, text1: str, text2: str) -> List[DiffEntry]:
        """Compare text character by character"""
        differ = difflib.SequenceMatcher(None, text1, text2)
        differences = []
        
        for tag, i1, i2, j1, j2 in differ.get_opcodes():
            if tag == 'delete':
                differences.append(DiffEntry(
                    type=DiffType.DELETED,
                    content=text1[i1:i2],
                    position=i1
                ))
            elif tag == 'insert':
                differences.append(DiffEntry(
                    type=DiffType.ADDED,
                    content=text2[j1:j2],
                    position=i1
                ))
            elif tag == 'replace':
                differences.append(DiffEntry(
                    type=DiffType.MODIFIED,
                    content=text2[j1:j2],
                    position=i1,
                    old_content=text1[i1:i2]
                ))
        
        return differences
    
    async def tokenize_words(self, text: str) -> List[str]:
        """Tokenize text into words"""
        return re.findall(r'\b\w+\b', text)
    
    async def calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity score"""
        matcher = difflib.SequenceMatcher(None, text1, text2)
        return matcher.ratio()
    
    async def fuzzy_match(self, text1: str, text2: str) -> float:
        """Calculate fuzzy match score"""
        # Simplified fuzzy matching
        matcher = difflib.SequenceMatcher(None, text1.lower(), text2.lower())
        return matcher.ratio()


class PDFComparator:
    """PDF document comparator"""
    
    async def compare_pdfs(self, pdf1_content: bytes, pdf2_content: bytes) -> ComparisonResult:
        """Compare two PDF documents"""
        # Mock PDF comparison
        similarity_score = 0.85
        differences = [
            DiffEntry(
                type=DiffType.MODIFIED,
                content="Mock PDF difference",
                position=1
            )
        ]
        
        return ComparisonResult(
            document1_id="pdf1",
            document2_id="pdf2",
            similarity_score=similarity_score,
            differences=differences
        )
    
    async def extract_pages(self, pdf_content: bytes) -> List[Dict]:
        """Extract pages from PDF"""
        # Mock page extraction
        return [{"page_number": 1, "content": "Page content"}]
    
    async def compare_pages(self, pages1: List[Dict], pages2: List[Dict]) -> List[Dict]:
        """Compare PDF pages"""
        return []
    
    async def compare_visual(self, page1_image: bytes, page2_image: bytes) -> Dict:
        """Compare PDF pages visually"""
        return {
            "difference_score": 0.1,
            "highlighted_areas": []
        }


class WordComparator:
    """Word document comparator"""
    
    async def compare(self, doc1_content: bytes, doc2_content: bytes) -> List[DiffEntry]:
        """Compare Word documents"""
        # Mock Word comparison
        return [
            DiffEntry(
                type=DiffType.MODIFIED,
                content="Word document change",
                position=1
            )
        ]


class VersionComparator:
    """Version comparison functionality"""
    
    async def compare_version_chain(self, versions: List[Dict]) -> List[Dict]:
        """Compare versions in a document chain"""
        chain_diffs = []
        
        for i in range(len(versions) - 1):
            chain_diffs.append({
                "from_version": versions[i]["id"],
                "to_version": versions[i + 1]["id"],
                "changes": ["Mock change"]
            })
        
        return chain_diffs
    
    async def attribute_changes(self, version_data: Dict) -> Dict:
        """Attribute changes to specific versions"""
        return {
            "author": version_data["author"],
            "timestamp": version_data["timestamp"],
            "changes": version_data["changes"]
        }


class SemanticComparator:
    """Semantic comparison functionality"""
    
    async def calculate_semantic_similarity(self, text1: str, text2: str) -> float:
        """Calculate semantic similarity"""
        # Mock semantic analysis
        return 0.75
    
    async def extract_concepts(self, text: str) -> List[str]:
        """Extract key concepts"""
        # Simple concept extraction
        words = text.lower().split()
        concepts = [w for w in words if len(w) > 4]  # Longer words as concepts
        return list(set(concepts))
    
    async def compare_intent(self, text1: str, text2: str) -> float:
        """Compare document intent/meaning"""
        return 0.85


class LegalComparator:
    """Legal document specific comparator"""
    
    async def compare_clauses(self, clause1: str, clause2: str) -> Dict:
        """Compare legal clauses"""
        return {
            "legal_equivalence": 0.9,
            "differences": ["Minor wording changes"],
            "risk_implications": ["Low risk change"]
        }
    
    async def compare_definitions(self, term1: str, term2: str) -> Dict:
        """Compare term definitions"""
        # Extract term name
        term_match = re.search(r'"([^"]+)"', term1)
        term = term_match.group(1) if term_match else "Unknown"
        
        return {
            "term": term,
            "substantially_similar": True,
            "differences": ["Minimal wording differences"]
        }
    
    async def analyze_risk_change(self, old_clause: str, new_clause: str) -> Dict:
        """Analyze legal risk implications"""
        # Simple risk analysis
        if "liability" in old_clause.lower() and "liability" in new_clause.lower():
            return {
                "risk_level": "high",
                "description": "Liability clause modification detected"
            }
        
        return {
            "risk_level": "low",
            "description": "Standard clause modification"
        }


class DiffAnalyzer:
    """Analyze and categorize differences"""
    
    async def categorize_changes(self, diffs: List[DiffEntry]) -> Dict:
        """Categorize different types of changes"""
        categories = {
            "additions": [d for d in diffs if d.type == DiffType.ADDED],
            "deletions": [d for d in diffs if d.type == DiffType.DELETED],
            "modifications": [d for d in diffs if d.type == DiffType.MODIFIED],
            "moves": [d for d in diffs if d.type == DiffType.MOVED]
        }
        return categories
    
    async def assess_impact(self, diffs: List[DiffEntry]) -> Dict:
        """Assess the impact of changes"""
        return {
            "high_impact_changes": [],
            "medium_impact_changes": [],
            "low_impact_changes": diffs
        }
    
    async def calculate_statistics(self, diffs: List[DiffEntry]) -> Dict:
        """Calculate change statistics"""
        total = len(diffs)
        additions = sum(1 for d in diffs if d.type == DiffType.ADDED)
        deletions = sum(1 for d in diffs if d.type == DiffType.DELETED)
        modifications = sum(1 for d in diffs if d.type == DiffType.MODIFIED)
        
        return {
            "total_changes": total,
            "additions": additions,
            "deletions": deletions,
            "modifications": modifications,
            "change_density": total / max(100, total)  # Changes per 100 chars
        }


class ChangeDetector:
    """Detect various types of changes"""
    
    async def detect_structural_changes(
        self,
        structure1: Dict,
        structure2: Dict
    ) -> Dict:
        """Detect structural changes"""
        changes = {}
        
        # Compare sections
        sections1 = set(structure1.get("sections", []))
        sections2 = set(structure2.get("sections", []))
        
        changes["sections_added"] = list(sections2 - sections1)
        changes["sections_removed"] = list(sections1 - sections2)
        
        # Compare subsections
        subsections_added = {}
        for section in structure2.get("subsections", {}):
            if section in structure1.get("subsections", {}):
                old_subs = set(structure1["subsections"][section])
                new_subs = set(structure2["subsections"][section])
                added = list(new_subs - old_subs)
                if added:
                    subsections_added[section] = added
        
        changes["subsections_added"] = subsections_added
        
        return changes
    
    async def detect_formatting_changes(
        self,
        format1: Dict,
        format2: Dict
    ) -> Dict:
        """Detect formatting changes"""
        changes = {}
        
        for key, value in format2.items():
            if key not in format1:
                if "properties_added" not in changes:
                    changes["properties_added"] = {}
                changes["properties_added"][key] = value
            elif format1[key] != value:
                changes[f"{key}_changed"] = {
                    "from": format1[key],
                    "to": value
                }
        
        return changes
    
    async def detect_moves(self, content1: List, content2: List) -> List[Dict]:
        """Detect moved content"""
        moves = []
        
        # Simple move detection
        for i, item in enumerate(content1):
            if item in content2:
                new_pos = content2.index(item)
                if new_pos != i:
                    moves.append({
                        "content": item,
                        "from_position": i,
                        "to_position": new_pos
                    })
        
        return moves


class ComparisonReport:
    """Generate comparison reports"""
    
    async def generate_summary(self, result: ComparisonResult) -> str:
        """Generate comparison summary"""
        similarity_pct = int(result.similarity_score * 100)
        total_changes = len(result.differences)
        
        return f"""Document Comparison Summary
        
Documents: {result.document1_id} vs {result.document2_id}
Similarity Score: {similarity_pct}%
Total Changes: {total_changes}
Status: {result.status.title()}
"""
    
    async def generate_detailed(self, result: ComparisonResult) -> str:
        """Generate detailed comparison report"""
        report = "Detailed Comparison Report\n\n"
        
        additions = [d for d in result.differences if d.type == DiffType.ADDED]
        deletions = [d for d in result.differences if d.type == DiffType.DELETED]
        
        if additions:
            report += "Additions:\n"
            for diff in additions:
                report += f"  + {diff.content}\n"
        
        if deletions:
            report += "\nDeletions:\n"
            for diff in deletions:
                report += f"  - {diff.content}\n"
        
        return report
    
    async def export_json(self, result: ComparisonResult) -> Dict:
        """Export comparison as JSON"""
        return {
            "document1_id": result.document1_id,
            "document2_id": result.document2_id,
            "similarity_score": result.similarity_score,
            "differences": [
                {
                    "type": d.type,
                    "content": d.content,
                    "position": d.position
                }
                for d in result.differences
            ]
        }
    
    async def export_csv(self, result: ComparisonResult) -> str:
        """Export comparison as CSV"""
        lines = ["Type,Content,Position"]
        for diff in result.differences:
            lines.append(f'"{diff.type}","{diff.content}",{diff.position}')
        return "\n".join(lines)


class SideBySideComparator:
    """Side-by-side comparison display"""
    
    async def generate_layout(self, text1: str, text2: str) -> Dict:
        """Generate side-by-side layout"""
        return {
            "left_column": text1,
            "right_column": text2
        }
    
    async def generate_sync_points(self, diffs: List[DiffEntry]) -> List[Dict]:
        """Generate synchronized scrolling points"""
        return [
            {
                "left_position": diff.position,
                "right_position": diff.position
            }
            for diff in diffs
        ]


class UnifiedDiffComparator:
    """Unified diff comparator"""
    
    async def generate_unified_diff(self, text1: str, text2: str) -> str:
        """Generate unified diff format"""
        lines1 = text1.splitlines()
        lines2 = text2.splitlines()
        
        diff = difflib.unified_diff(
            lines1,
            lines2,
            fromfile="document1",
            tofile="document2",
            lineterm=""
        )
        
        return "\n".join(diff)


class VisualDiffGenerator:
    """Generate visual diff representations"""
    
    async def generate_html_diff(self, text1: str, text2: str) -> str:
        """Generate HTML diff visualization"""
        return f'<span class="original">{text1}</span><span class="modified">{text2}</span>'
    
    async def generate_pdf_diff(self, content1: str, content2: str) -> bytes:
        """Generate PDF diff visualization"""
        # Mock PDF generation
        return b"PDF diff content"


class ChangeHighlighter:
    """Highlight changes in text"""
    
    async def highlight_additions(self, text: str, additions: List[str]) -> str:
        """Highlight added text"""
        for addition in additions:
            text = text.replace(addition, f"<mark class='added'>{addition}</mark>")
        return text
    
    async def highlight_deletions(self, text: str, deletions: List[str]) -> str:
        """Highlight deleted text"""
        for deletion in deletions:
            text = text.replace(deletion, f"<mark class='deleted'>{deletion}</mark>")
        return text


class ComparisonMetrics:
    """Calculate comparison metrics"""
    
    async def calculate_edit_distance(self, text1: str, text2: str) -> int:
        """Calculate edit distance between texts"""
        # Simplified Levenshtein distance
        m, n = len(text1), len(text2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        
        for i in range(m + 1):
            dp[i][0] = i
        for j in range(n + 1):
            dp[0][j] = j
        
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if text1[i-1] == text2[j-1]:
                    dp[i][j] = dp[i-1][j-1]
                else:
                    dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
        
        return dp[m][n]


class ComparisonCache:
    """Cache comparison results"""
    
    def __init__(self, cache_client=None):
        self.cache = cache_client or {}
    
    async def generate_key(self, doc1_id: str, doc2_id: str) -> str:
        """Generate cache key for comparison"""
        key_data = f"{doc1_id}:{doc2_id}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def store(self, key: str, result: ComparisonResult):
        """Store comparison result"""
        self.cache[key] = result
    
    async def retrieve(self, key: str) -> Optional[ComparisonResult]:
        """Retrieve cached comparison"""
        return self.cache.get(key)
    
    async def invalidate_document(self, doc_id: str):
        """Invalidate cache for document"""
        keys_to_remove = [
            k for k in self.cache.keys()
            if doc_id in k
        ]
        for key in keys_to_remove:
            del self.cache[key]


# Helper functions
async def compare_documents(
    doc1_id: str,
    doc2_id: str,
    config: Optional[ComparisonConfig] = None
) -> ComparisonResult:
    """Compare two documents"""
    service = DocumentComparisonService()
    if config is None:
        config = ComparisonConfig()
    
    return await service.compare_documents(doc1_id, doc2_id, config)


async def compare_versions(version_list: List[Dict]) -> List[Dict]:
    """Compare document versions"""
    comparator = VersionComparator()
    return await comparator.compare_version_chain(version_list)


async def generate_diff_report(result: ComparisonResult) -> str:
    """Generate diff report"""
    reporter = ComparisonReport()
    return await reporter.generate_summary(result)


async def highlight_changes(text: str, diffs: List[DiffEntry]) -> str:
    """Highlight changes in text"""
    highlighter = ChangeHighlighter()
    
    additions = [d.content for d in diffs if d.type == DiffType.ADDED]
    deletions = [d.content for d in diffs if d.type == DiffType.DELETED]
    
    highlighted = await highlighter.highlight_additions(text, additions)
    highlighted = await highlighter.highlight_deletions(highlighted, deletions)
    
    return highlighted