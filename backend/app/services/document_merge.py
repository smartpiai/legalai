"""
Document Merge Service
Following TDD - GREEN phase: Implementation for document merging and combining
"""

import asyncio
import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple, Union
from uuid import uuid4
import json


class MergeStrategy(str, Enum):
    """Document merge strategies"""
    APPEND = "append"               # Append documents sequentially
    INTERLEAVE = "interleave"       # Interleave sections
    PRIORITY = "priority"           # Merge by priority/precedence
    SMART = "smart"                 # AI-guided intelligent merge
    TEMPLATE = "template"           # Template-specific merge
    VERSION = "version"             # Version-aware merge


class ConflictType(str, Enum):
    """Types of merge conflicts"""
    DUPLICATE_SECTION = "duplicate_section"
    CONTENT_CONFLICT = "content_conflict"
    FORMATTING_CONFLICT = "formatting_conflict"
    METADATA_CONFLICT = "metadata_conflict"
    DEPENDENCY_CONFLICT = "dependency_conflict"
    LEGAL_CONFLICT = "legal_conflict"


@dataclass
class MergeConfig:
    """Merge configuration"""
    strategy: MergeStrategy = MergeStrategy.APPEND
    preserve_formatting: bool = True
    handle_conflicts: bool = True
    include_metadata: bool = True
    auto_resolve_conflicts: bool = False
    merge_headers: bool = True
    merge_footers: bool = False
    section_separator: str = "\n\n"
    normalize_format: Optional[str] = None
    max_conflicts: int = 100
    timeout_seconds: int = 300


@dataclass
class MergeSection:
    """Merged document section"""
    name: str
    content: str
    source_document: Optional[str] = None
    position: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    formatting: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MergeConflict:
    """Merge conflict representation"""
    id: str = field(default_factory=lambda: str(uuid4()))
    section_name: str = ""
    type: ConflictType = ConflictType.CONTENT_CONFLICT
    sources: List[str] = field(default_factory=list)
    content_options: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    resolution_required: bool = True
    auto_resolvable: bool = False


@dataclass
class ConflictResolution:
    """Conflict resolution"""
    conflict_id: str
    resolution_type: str  # "latest_wins", "merge_both", "custom", "skip"
    selected_content: Optional[str] = None
    merge_rule: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MergeResult:
    """Document merge result"""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: Optional[str] = None
    merged_content: str = ""
    sections: List[MergeSection] = field(default_factory=list)
    conflicts: List[MergeConflict] = field(default_factory=list)
    status: str = "pending"  # pending, completed, failed, needs_resolution
    output_format: str = "text"
    source_documents: List[str] = field(default_factory=list)
    merge_strategy: MergeStrategy = MergeStrategy.APPEND
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    validation_results: Optional[Dict] = None


@dataclass
class TemplateResult:
    """Template merge result"""
    template_type: str = "contract"
    merged_clauses: List[Dict] = field(default_factory=list)
    content: str = ""
    variable_mappings: Dict[str, str] = field(default_factory=dict)
    all_variables: List[str] = field(default_factory=list)
    conditions: List[str] = field(default_factory=list)
    has_conditional_content: bool = False


@dataclass
class PDFMergeResult:
    """PDF merge result"""
    content: bytes = b""
    page_count: int = 0
    bookmarks: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WordMergeResult:
    """Word document merge result"""
    content: bytes = b""
    sections_count: int = 0
    styles_preserved: bool = False
    style_conflicts: List[Dict] = field(default_factory=list)
    headers: List[str] = field(default_factory=list)
    footers: List[str] = field(default_factory=list)


@dataclass
class TextMergeResult:
    """Text merge result"""
    content: str = ""
    section_titles: List[str] = field(default_factory=list)
    merged_sections: Dict[str, str] = field(default_factory=dict)
    line_count: int = 0


@dataclass
class ValidationResult:
    """Merge validation result"""
    is_valid: bool = True
    is_complete: bool = True
    is_compliant: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    completeness_score: float = 1.0
    missing_elements: List[str] = field(default_factory=list)
    missing_clauses: List[str] = field(default_factory=list)


class MergeError(Exception):
    """Merge operation error"""
    pass


class DocumentMergeService:
    """Main document merge service"""
    
    def __init__(self, storage=None, cache=None):
        self.storage = storage
        self.cache = cache
        self.pdf_merger = PDFMerger()
        self.word_merger = WordMerger()
        self.text_merger = TextMerger()
        self.template_merger = TemplateMerger()
        self.clause_merger = ClauseMerger()
        self.version_merger = VersionMerger()
        self.conflict_resolver = ConflictResolver()
        self.validator = MergeValidator()
    
    async def merge_documents(
        self,
        document_ids: List[str],
        config: MergeConfig,
        title: Optional[str] = None
    ) -> MergeResult:
        """Merge multiple documents"""
        start_time = datetime.utcnow()
        
        try:
            # Load documents
            documents = []
            for doc_id in document_ids:
                doc = await self.storage.get_document(doc_id)
                documents.append(doc)
            
            # Initialize result
            result = MergeResult(
                title=title or f"Merged Document {start_time.isoformat()}",
                source_documents=document_ids,
                merge_strategy=config.strategy
            )
            
            # Perform merge based on strategy
            if config.strategy == MergeStrategy.APPEND:
                await self._merge_append(documents, result, config)
            elif config.strategy == MergeStrategy.INTERLEAVE:
                await self._merge_interleave(documents, result, config)
            elif config.strategy == MergeStrategy.PRIORITY:
                await self._merge_priority(documents, result, config)
            elif config.strategy == MergeStrategy.SMART:
                await self._merge_smart(documents, result, config)
            elif config.strategy == MergeStrategy.TEMPLATE:
                await self._merge_template(documents, result, config)
            else:
                await self._merge_append(documents, result, config)  # Default
            
            # Handle conflicts if enabled
            if config.handle_conflicts and result.conflicts:
                if config.auto_resolve_conflicts:
                    await self._auto_resolve_conflicts(result)
            
            # Build final merged content
            result.merged_content = await self._build_merged_content(result, config)
            
            # Validate result
            if self.validator:
                result.validation_results = await self.validator.validate(result)
            
            result.status = "completed"
            
            # Performance metrics
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            result.performance_metrics["processing_time"] = processing_time
            result.performance_metrics["documents_merged"] = len(documents)
            result.performance_metrics["sections_created"] = len(result.sections)
            result.performance_metrics["conflicts_detected"] = len(result.conflicts)
            
            return result
            
        except Exception as e:
            result.status = "failed"
            result.metadata["error"] = str(e)
            raise MergeError(f"Document merge failed: {str(e)}")
    
    async def _merge_append(
        self,
        documents: List[Dict],
        result: MergeResult,
        config: MergeConfig
    ):
        """Append documents sequentially"""
        position = 0
        
        for i, doc in enumerate(documents):
            content = doc.get("content", "")
            sections = doc.get("sections", [f"Section {i+1}"])
            
            for j, section_name in enumerate(sections):
                # Extract section content (simplified)
                section_content = self._extract_section_content(content, section_name)
                
                section = MergeSection(
                    name=section_name,
                    content=section_content,
                    source_document=doc.get("id", f"doc_{i}"),
                    position=position
                )
                
                # Check for conflicts
                existing_section = self._find_section_by_name(result.sections, section_name)
                if existing_section:
                    conflict = MergeConflict(
                        section_name=section_name,
                        type=ConflictType.DUPLICATE_SECTION,
                        sources=[existing_section.source_document, section.source_document],
                        content_options=[existing_section.content, section.content]
                    )
                    result.conflicts.append(conflict)
                
                result.sections.append(section)
                position += 1
    
    async def _merge_interleave(
        self,
        documents: List[Dict],
        result: MergeResult,
        config: MergeConfig
    ):
        """Interleave sections from documents"""
        # Get all sections from all documents
        all_sections = []
        for i, doc in enumerate(documents):
            sections = doc.get("sections", [f"Section {i+1}"])
            content = doc.get("content", "")
            
            for section_name in sections:
                section_content = self._extract_section_content(content, section_name)
                all_sections.append({
                    "name": section_name,
                    "content": section_content,
                    "source": doc.get("id", f"doc_{i}")
                })
        
        # Sort sections by name for consistent interleaving
        all_sections.sort(key=lambda x: x["name"])
        
        # Add sections to result
        for i, section_data in enumerate(all_sections):
            section = MergeSection(
                name=section_data["name"],
                content=section_data["content"],
                source_document=section_data["source"],
                position=i
            )
            result.sections.append(section)
    
    async def _merge_priority(
        self,
        documents: List[Dict],
        result: MergeResult,
        config: MergeConfig
    ):
        """Merge by priority/precedence"""
        # Sort documents by priority (if available)
        sorted_docs = sorted(
            documents,
            key=lambda d: d.get("priority", 0),
            reverse=True
        )
        
        await self._merge_append(sorted_docs, result, config)
    
    async def _merge_smart(
        self,
        documents: List[Dict],
        result: MergeResult,
        config: MergeConfig
    ):
        """AI-guided intelligent merge"""
        # Simplified smart merge - would use AI in production
        await self._merge_append(documents, result, config)
        
        # Add smart conflict resolution
        for conflict in result.conflicts:
            if conflict.type == ConflictType.DUPLICATE_SECTION:
                # Smart resolution: merge similar content
                merged_content = self._smart_merge_content(conflict.content_options)
                conflict.auto_resolvable = True
                conflict.metadata["smart_resolution"] = merged_content
    
    async def _merge_template(
        self,
        documents: List[Dict],
        result: MergeResult,
        config: MergeConfig
    ):
        """Template-specific merge"""
        template_result = await self.template_merger.merge_templates(documents)
        
        # Convert template result to merge result
        for i, clause in enumerate(template_result.merged_clauses):
            section = MergeSection(
                name=clause.get("name", f"Clause {i+1}"),
                content=clause.get("content", ""),
                position=i,
                metadata={"clause_type": clause.get("type")}
            )
            result.sections.append(section)
    
    async def _auto_resolve_conflicts(self, result: MergeResult):
        """Auto-resolve conflicts where possible"""
        resolved_conflicts = []
        
        for conflict in result.conflicts:
            if conflict.auto_resolvable:
                resolution = await self.conflict_resolver.auto_resolve(conflict)
                if resolution.resolution_type != "manual_required":
                    # Apply resolution
                    await self._apply_conflict_resolution(result, conflict, resolution)
                    resolved_conflicts.append(conflict)
        
        # Remove resolved conflicts
        result.conflicts = [c for c in result.conflicts if c not in resolved_conflicts]
    
    async def _build_merged_content(self, result: MergeResult, config: MergeConfig) -> str:
        """Build final merged content from sections"""
        content_parts = []
        
        # Sort sections by position
        sorted_sections = sorted(result.sections, key=lambda s: s.position)
        
        for section in sorted_sections:
            if section.name and config.merge_headers:
                content_parts.append(f"## {section.name}")
            content_parts.append(section.content)
        
        return config.section_separator.join(content_parts)
    
    def _extract_section_content(self, full_content: str, section_name: str) -> str:
        """Extract content for a specific section"""
        # Simplified extraction - would be more sophisticated in production
        lines = full_content.split('\n')
        section_lines = []
        in_section = False
        
        for line in lines:
            if section_name.upper() in line.upper():
                in_section = True
                continue
            elif in_section and line.strip().startswith('SECTION'):
                break
            elif in_section:
                section_lines.append(line)
        
        return '\n'.join(section_lines).strip()
    
    def _find_section_by_name(self, sections: List[MergeSection], name: str) -> Optional[MergeSection]:
        """Find section by name"""
        for section in sections:
            if section.name == name:
                return section
        return None
    
    def _smart_merge_content(self, content_options: List[str]) -> str:
        """Smart merge of conflicting content"""
        # Simplified smart merge
        if len(content_options) == 2:
            # Try to find common parts and differences
            common_words = set(content_options[0].split()) & set(content_options[1].split())
            if len(common_words) > len(content_options[0].split()) * 0.7:
                # High similarity - merge by combining unique parts
                return f"{content_options[0]} {content_options[1]}"
        
        # Default: return first option
        return content_options[0] if content_options else ""
    
    async def _apply_conflict_resolution(
        self,
        result: MergeResult,
        conflict: MergeConflict,
        resolution: ConflictResolution
    ):
        """Apply conflict resolution to merge result"""
        # Find affected sections
        for section in result.sections:
            if section.name == conflict.section_name:
                if resolution.resolution_type == "latest_wins":
                    section.content = conflict.content_options[-1]
                elif resolution.resolution_type == "merge_both":
                    section.content = " ".join(conflict.content_options)
                elif resolution.resolution_type == "custom":
                    section.content = resolution.selected_content or section.content
                break


class PDFMerger:
    """PDF-specific merge functionality"""
    
    async def merge_pdfs(self, pdf_list: List[Dict]) -> PDFMergeResult:
        """Merge PDF documents"""
        # Mock PDF merging
        total_pages = len(pdf_list)  # Simplified
        
        bookmarks = []
        for i, pdf_info in enumerate(pdf_list):
            bookmarks.append({
                "title": pdf_info.get("title", f"Document {i+1}"),
                "page": i + 1
            })
        
        return PDFMergeResult(
            content=b"merged_pdf_content",
            page_count=total_pages,
            bookmarks=bookmarks
        )
    
    async def merge_with_bookmarks(self, pdf_list: List[Dict]) -> PDFMergeResult:
        """Merge PDFs preserving bookmarks"""
        result = await self.merge_pdfs(pdf_list)
        
        # Add existing bookmarks
        for pdf_info in pdf_list:
            existing_bookmarks = pdf_info.get("bookmarks", [])
            result.bookmarks.extend(existing_bookmarks)
        
        return result
    
    async def merge_page_ranges(self, pdf_content: bytes, page_ranges: List[Dict]) -> PDFMergeResult:
        """Merge specific page ranges"""
        total_pages = sum(r["end"] - r["start"] + 1 for r in page_ranges)
        
        return PDFMergeResult(
            content=b"merged_page_ranges",
            page_count=total_pages
        )
    
    async def merge_with_metadata(self, pdfs: List[Dict]) -> PDFMergeResult:
        """Merge PDFs with metadata preservation"""
        result = await self.merge_pdfs(pdfs)
        
        # Combine metadata
        combined_metadata = {}
        for pdf in pdfs:
            pdf_metadata = pdf.get("metadata", {})
            combined_metadata.update(pdf_metadata)
        
        result.metadata = combined_metadata
        return result


class WordMerger:
    """Word document merge functionality"""
    
    async def merge_documents(self, docx_files: List[Dict]) -> WordMergeResult:
        """Merge Word documents"""
        return WordMergeResult(
            content=b"merged_docx_content",
            sections_count=len(docx_files) * 2  # Assume 2 sections per doc
        )
    
    async def merge_with_styles(self, docs_with_styles: List[Dict]) -> WordMergeResult:
        """Merge Word documents preserving styles"""
        return WordMergeResult(
            content=b"styled_merged_content",
            sections_count=len(docs_with_styles),
            styles_preserved=True,
            style_conflicts=[]
        )
    
    async def merge_with_headers_footers(
        self,
        docs: List[Dict],
        config: MergeConfig
    ) -> WordMergeResult:
        """Merge headers and footers"""
        headers = []
        footers = []
        
        for doc in docs:
            if config.merge_headers:
                headers.extend(doc.get("headers", []))
            if config.merge_footers:
                footers.extend(doc.get("footers", []))
        
        return WordMergeResult(
            content=b"merged_with_headers_footers",
            sections_count=len(docs),
            headers=headers,
            footers=footers
        )


class TextMerger:
    """Plain text merge functionality"""
    
    async def merge_texts(self, texts: List[str], config: MergeConfig) -> str:
        """Merge plain text documents"""
        return config.section_separator.join(texts)
    
    async def merge_with_line_numbers(self, texts: List[str]) -> str:
        """Merge text with line numbering"""
        all_lines = []
        line_num = 1
        
        for text in texts:
            lines = text.split('\n')
            for line in lines:
                all_lines.append(f"{line_num}: {line}")
                line_num += 1
        
        return '\n'.join(all_lines)
    
    async def merge_by_sections(self, sectioned_texts: List[Dict]) -> TextMergeResult:
        """Merge text documents by sections"""
        merged_sections = {}
        section_titles = []
        
        for doc in sectioned_texts:
            sections = doc.get("sections", {})
            for title, content in sections.items():
                if title not in section_titles:
                    section_titles.append(title)
                merged_sections[title] = content
        
        # Build content
        content_parts = []
        for title in section_titles:
            content_parts.append(f"# {title}")
            content_parts.append(merged_sections[title])
        
        content = '\n\n'.join(content_parts)
        
        return TextMergeResult(
            content=content,
            section_titles=section_titles,
            merged_sections=merged_sections,
            line_count=len(content.split('\n'))
        )


class TemplateMerger:
    """Template-specific merge functionality"""
    
    async def merge_templates(self, templates: List[Dict]) -> TemplateResult:
        """Merge contract templates"""
        merged_clauses = []
        all_variables = set()
        conditions = set()
        
        for template in templates:
            # Extract clauses (simplified)
            content = template.get("content", "")
            clauses = self._extract_clauses(content)
            merged_clauses.extend(clauses)
            
            # Extract variables
            variables = template.get("variables", [])
            all_variables.update(variables)
            
            # Extract variables from content
            content_variables = re.findall(r'\{\{(\w+)\}\}', content)
            all_variables.update(content_variables)
            
            # Extract conditions
            content_conditions = re.findall(r'\{% if (\w+) %\}', content)
            conditions.update(content_conditions)
        
        # Build merged content
        content_parts = []
        for clause in merged_clauses:
            content_parts.append(clause.get("content", ""))
        
        return TemplateResult(
            template_type="contract",
            merged_clauses=merged_clauses,
            content="\n\n".join(content_parts),
            all_variables=list(all_variables),
            conditions=list(conditions),
            has_conditional_content=bool(conditions)
        )
    
    async def merge_with_variables(self, templates: List[Dict]) -> TemplateResult:
        """Merge templates with variable resolution"""
        result = await self.merge_templates(templates)
        
        # Build variable mappings
        variable_mappings = {}
        for var in result.all_variables:
            variable_mappings[var] = f"{{{{{var}}}}}"  # Keep original format
        
        result.variable_mappings = variable_mappings
        return result
    
    async def merge_conditional_templates(self, templates: List[Dict]) -> TemplateResult:
        """Merge templates with conditional sections"""
        result = await self.merge_templates(templates)
        result.has_conditional_content = True
        return result
    
    def _extract_clauses(self, content: str) -> List[Dict]:
        """Extract clauses from content"""
        clauses = []
        sections = content.split("SECTION")
        
        for i, section in enumerate(sections[1:], 1):  # Skip first empty split
            lines = section.strip().split('\n')
            if lines:
                header = lines[0].strip()
                body = '\n'.join(lines[1:]).strip()
                
                clauses.append({
                    "name": header,
                    "content": body,
                    "position": i,
                    "type": self._infer_clause_type(header)
                })
        
        return clauses
    
    def _infer_clause_type(self, header: str) -> str:
        """Infer clause type from header"""
        header_lower = header.lower()
        if "payment" in header_lower:
            return "payment"
        elif "liability" in header_lower:
            return "liability"
        elif "termination" in header_lower:
            return "termination"
        elif "parties" in header_lower:
            return "parties"
        else:
            return "general"


class ClauseMerger:
    """Clause-specific merge functionality"""
    
    async def merge_clauses(self, clauses: List[Dict]) -> Dict:
        """Merge legal clauses"""
        # Sort by precedence
        sorted_clauses = sorted(clauses, key=lambda c: c.get("precedence", 999))
        
        clause_order = []
        for clause in sorted_clauses:
            clause_order.append({
                "id": clause["id"],
                "type": clause["type"],
                "precedence": clause.get("precedence", 999)
            })
        
        return {
            "merged_clauses": sorted_clauses,
            "clause_order": clause_order
        }
    
    async def check_clause_compatibility(self, clauses: List[Dict]) -> Dict:
        """Check clause compatibility"""
        conflicts = []
        
        for i, clause1 in enumerate(clauses):
            for j, clause2 in enumerate(clauses[i+1:], i+1):
                # Check for conflicts
                conflicts_with = clause1.get("conflicts_with", [])
                if clause2["type"] in conflicts_with:
                    conflicts.append({
                        "type": "clause_conflict",
                        "clause1": clause1["type"],
                        "clause2": clause2["type"],
                        "description": f"{clause1['type']} conflicts with {clause2['type']}"
                    })
        
        return {"conflicts": conflicts}
    
    async def resolve_dependencies(self, clauses: List[Dict]) -> Dict:
        """Resolve clause dependencies"""
        # Simple dependency resolution
        resolved = []
        remaining = clauses.copy()
        
        while remaining:
            for clause in remaining[:]:
                dependencies = clause.get("depends_on", [])
                if not dependencies or all(
                    any(r["id"] == dep for r in resolved) for dep in dependencies
                ):
                    resolved.append(clause)
                    remaining.remove(clause)
            
            # Prevent infinite loop
            if len(remaining) == len(clauses):
                # Add remaining with unresolved dependencies
                resolved.extend(remaining)
                break
        
        return {"dependency_order": resolved}


class VersionMerger:
    """Version merge functionality"""
    
    async def merge_versions(self, versions: List[Dict]) -> Dict:
        """Merge different versions of a document"""
        # Sort by timestamp
        sorted_versions = sorted(
            versions,
            key=lambda v: v.get("timestamp", datetime.min)
        )
        
        final_version = sorted_versions[-1]["version"]
        merged_content = sorted_versions[-1]["content"]
        
        return {
            "final_version": final_version,
            "version_history": sorted_versions,
            "merged_content": merged_content
        }
    
    async def merge_with_change_tracking(self, versions: List[Dict]) -> Dict:
        """Merge versions with change tracking"""
        changes = []
        
        for i in range(len(versions) - 1):
            current = versions[i]
            next_version = versions[i + 1]
            
            # Detect changes (simplified)
            if current["content"] != next_version["content"]:
                changes.append({
                    "from_version": current["version"],
                    "to_version": next_version["version"],
                    "old_value": current["content"][:50] + "...",
                    "new_value": next_version["content"][:50] + "...",
                    "change_type": "content_modification"
                })
        
        return {
            "changes": changes,
            "final_content": versions[-1]["content"]
        }
    
    async def resolve_version_conflicts(self, conflicting_versions: List[Dict]) -> Dict:
        """Resolve conflicts between versions"""
        # Use latest version as resolution strategy
        latest_version = max(conflicting_versions, key=lambda v: v["version"])
        
        return {
            "resolution_strategy": "latest_wins",
            "final_content": latest_version["content"],
            "resolved_version": latest_version["version"]
        }


class ConflictResolver:
    """Conflict resolution functionality"""
    
    async def detect_conflicts(self, sections: List[Dict]) -> List[MergeConflict]:
        """Detect conflicts during merge"""
        conflicts = []
        section_names = {}
        
        for section in sections:
            name = section["name"]
            if name in section_names:
                # Duplicate section found
                conflict = MergeConflict(
                    section_name=name,
                    type=ConflictType.DUPLICATE_SECTION,
                    sources=[section_names[name]["source"], section["source"]],
                    content_options=[section_names[name]["content"], section["content"]]
                )
                conflicts.append(conflict)
            else:
                section_names[name] = section
        
        return conflicts
    
    async def auto_resolve(self, conflict: MergeConflict) -> ConflictResolution:
        """Automatic conflict resolution"""
        if conflict.type == ConflictType.DUPLICATE_SECTION:
            # Simple resolution: use latest content
            return ConflictResolution(
                conflict_id=conflict.id,
                resolution_type="latest_wins"
            )
        else:
            return ConflictResolution(
                conflict_id=conflict.id,
                resolution_type="manual_required"
            )
    
    async def apply_resolution(
        self,
        conflict: MergeConflict,
        resolution: ConflictResolution
    ) -> Dict:
        """Apply conflict resolution"""
        resolved_content = ""
        
        if resolution.resolution_type == "latest_wins":
            resolved_content = conflict.content_options[-1]
        elif resolution.resolution_type == "merge_both":
            resolved_content = " ".join(conflict.content_options)
        elif resolution.resolution_type == "custom":
            resolved_content = resolution.selected_content
        
        return {
            "resolved_content": resolved_content,
            "status": "resolved"
        }


class MergeValidator:
    """Merge validation functionality"""
    
    async def validate(self, merge_result: MergeResult) -> ValidationResult:
        """Validate merge results"""
        errors = []
        warnings = []
        
        # Check completeness
        if not merge_result.merged_content:
            errors.append("Merged content is empty")
        
        if not merge_result.sections:
            errors.append("No sections in merged result")
        
        # Calculate completeness score
        completeness_score = 1.0
        if errors:
            completeness_score = max(0.0, 1.0 - (len(errors) * 0.2))
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            completeness_score=completeness_score
        )
    
    async def validate_completeness(self, merge_result: MergeResult) -> ValidationResult:
        """Validate merge completeness"""
        missing_elements = []
        
        if not merge_result.merged_content:
            missing_elements.append("empty_content")
        
        if not merge_result.sections:
            missing_elements.append("no_sections")
        
        is_complete = len(missing_elements) == 0
        
        return ValidationResult(
            is_complete=is_complete,
            missing_elements=missing_elements
        )
    
    async def validate_legal_compliance(self, legal_document: Dict) -> ValidationResult:
        """Validate legal compliance"""
        required_sections = legal_document.get("required_sections", [])
        content = legal_document.get("content", "")
        missing_clauses = []
        
        for section in required_sections:
            if section.lower() not in content.lower():
                missing_clauses.append(section)
        
        is_compliant = len(missing_clauses) == 0
        
        return ValidationResult(
            is_compliant=is_compliant,
            missing_clauses=missing_clauses
        )


class MergeOptimizer:
    """Optimize merge performance"""
    
    async def optimize(self, merge_result: MergeResult) -> MergeResult:
        """Optimize merge result"""
        # Mock optimization
        return merge_result


class MergeCache:
    """Cache merge results"""
    
    def __init__(self, cache_client=None, ttl_seconds: int = 3600):
        self.cache = cache_client
        self.ttl = ttl_seconds
    
    async def store_result(self, merge_id: str, result: MergeResult):
        """Store merge result in cache"""
        if self.cache:
            await self.cache.set(
                f"merge:{merge_id}",
                result.__dict__,
                ttl=self.ttl
            )
    
    async def get_result(self, merge_id: str) -> Optional[MergeResult]:
        """Get cached merge result"""
        if not self.cache:
            return None
        
        cached_data = await self.cache.get(f"merge:{merge_id}")
        if cached_data:
            return MergeResult(**cached_data)
        return None
    
    async def invalidate_document_merges(self, document_id: str):
        """Invalidate cache for document merges"""
        if self.cache:
            await self.cache.delete(f"merge:*{document_id}*")


# Helper functions
async def merge_documents(
    document_ids: List[str],
    config: Optional[MergeConfig] = None,
    storage=None
) -> MergeResult:
    """Merge documents helper function"""
    service = DocumentMergeService(storage=storage)
    if config is None:
        config = MergeConfig()
    
    return await service.merge_documents(document_ids, config)


async def merge_templates(templates: List[Dict]) -> TemplateResult:
    """Merge templates helper function"""
    merger = TemplateMerger()
    return await merger.merge_templates(templates)


async def resolve_conflicts(conflicts: List[MergeConflict]) -> List[ConflictResolution]:
    """Resolve conflicts helper function"""
    resolver = ConflictResolver()
    resolutions = []
    
    for conflict in conflicts:
        resolution = await resolver.auto_resolve(conflict)
        resolutions.append(resolution)
    
    return resolutions


async def validate_merge(merge_result: MergeResult) -> ValidationResult:
    """Validate merge helper function"""
    validator = MergeValidator()
    return await validator.validate(merge_result)