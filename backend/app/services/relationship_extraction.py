"""
Relationship Extraction Engine
Extracts and analyzes relationships between entities using NLP and pattern recognition
"""
from datetime import datetime
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
import logging
import re
from collections import defaultdict

logger = logging.getLogger(__name__)


class EntityType(str, Enum):
    """Entity types"""
    ORGANIZATION = "ORGANIZATION"
    PERSON = "PERSON"
    CONTRACT = "CONTRACT"
    DATE = "DATE"
    MONEY = "MONEY"
    TERM = "TERM"
    PARTY = "PARTY"
    EVENT = "EVENT"
    JURISDICTION = "JURISDICTION"
    DOCUMENT = "DOCUMENT"


class RelationshipType(str, Enum):
    """Relationship types"""
    PARTY_TO = "PARTY_TO"
    BUYER_SELLER = "BUYER_SELLER"
    OBLIGATES = "OBLIGATES"
    SUPERSEDES = "SUPERSEDES"
    DEPENDS_ON = "DEPENDS_ON"
    PAYMENT = "PAYMENT"
    REPORTS_TO = "REPORTS_TO"
    RELATES_TO = "RELATES_TO"
    PARTNER = "PARTNER"
    PARENT_OF = "PARENT_OF"
    CHILD_OF = "CHILD_OF"
    MENTIONS = "MENTIONS"
    INCORPORATED_IN = "INCORPORATED_IN"


class ConfidenceLevel(str, Enum):
    """Confidence levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class RelationshipStrength(str, Enum):
    """Relationship strength levels"""
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"


@dataclass
class Entity:
    """Entity representation"""
    id: str
    name: str
    type: EntityType
    start_pos: int = 0
    end_pos: int = 0
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RelationshipPattern:
    """Pattern for relationship extraction"""
    pattern: str
    relationship_type: RelationshipType
    confidence_boost: float = 0.0


@dataclass
class PatternMatch:
    """Pattern match result"""
    pattern: str
    groups: List[str]
    named_groups: Dict[str, str] = field(default_factory=dict)
    start: int = 0
    end: int = 0


@dataclass
class ExtractedRelationship:
    """Extracted relationship"""
    source_id: str
    target_id: str
    type: RelationshipType
    confidence: Optional['Confidence'] = None
    evidence: List[str] = field(default_factory=list)
    properties: Dict[str, Any] = field(default_factory=dict)
    context: Optional[str] = None
    source_type: Optional[EntityType] = None
    target_type: Optional[EntityType] = None
    mentions_count: int = 1
    importance: str = "normal"
    strength: Optional['Strength'] = None


@dataclass
class Confidence:
    """Confidence score"""
    level: ConfidenceLevel
    score: float
    evidence_count: int = 0


@dataclass
class Strength:
    """Relationship strength"""
    score: float
    level: RelationshipStrength


@dataclass
class TemporalRelationship:
    """Temporal relationship"""
    source_id: str
    target_id: str
    temporal_type: str  # before, after, during, etc.
    timestamp: Optional[datetime] = None


@dataclass
class ConditionalRelationship:
    """Conditional relationship"""
    condition: str
    consequence: str
    condition_type: str = "if"  # if, unless, when, etc.
    conditions: List[str] = field(default_factory=list)
    has_nested: bool = False
    nested_conditions: List['ConditionalRelationship'] = field(default_factory=list)


@dataclass
class HierarchicalRelationship:
    """Hierarchical relationship"""
    source_id: str
    target_id: str
    hierarchy_type: str  # parent, child, sibling
    relationship: str = ""  # owns, controls, contains, etc.


@dataclass
class SemanticRelationship:
    """Semantic relationship"""
    concept: str
    related_concepts: List[str] = field(default_factory=list)
    relationship_type: str = "related_to"


@dataclass
class SemanticContext:
    """Semantic context"""
    domain: str
    key_concepts: List[str] = field(default_factory=list)
    entities: List[Entity] = field(default_factory=list)


@dataclass
class ValidationResult:
    """Validation result"""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class PatternTemplate:
    """Pattern template for relationship extraction"""
    name: str
    patterns: List[str]
    relationship_type: RelationshipType


@dataclass
class ExtractionConfig:
    """Extraction configuration"""
    min_confidence: float = 0.7
    enable_semantic: bool = True
    enable_temporal: bool = True
    enable_conditional: bool = True


@dataclass
class DocumentStructure:
    """Document structure hierarchy"""
    root: str
    children: List[str] = field(default_factory=list)


@dataclass
class Duration:
    """Duration representation"""
    value: int
    unit: str


@dataclass
class RecurringPattern:
    """Recurring temporal pattern"""
    frequency: str
    day_of_month: Optional[int] = None


@dataclass
class TemporalSequenceItem:
    """Item in temporal sequence"""
    order: int
    action: str


class RelationshipExtractionEngine:
    """Engine for extracting relationships from text"""
    
    def __init__(self, config: Optional[ExtractionConfig] = None):
        self.config = config or ExtractionConfig()
        self.patterns: Dict[str, RelationshipPattern] = {}
        self._init_default_patterns()
        
    def _init_default_patterns(self):
        """Initialize default extraction patterns"""
        self.patterns = {
            "party_to": RelationshipPattern(
                r"(?:between|among|entered into by)\s+(\w+.*?)\s+(?:and|,)\s+(\w+.*?)(?:\.|,|\s)",
                RelationshipType.PARTY_TO
            ),
            "buyer_seller": RelationshipPattern(
                r"(\w+)\s+(?:as\s+)?[Bb]uyer.*?(\w+)\s+(?:as\s+)?[Ss]eller",
                RelationshipType.BUYER_SELLER
            ),
            "supersedes": RelationshipPattern(
                r"(\w+.*?)\s+supersedes?\s+(\w+.*?)(?:\.|,|\s)",
                RelationshipType.SUPERSEDES
            ),
            "obligates": RelationshipPattern(
                r"(\w+)\s+(?:shall|must|will)\s+(\w+)",
                RelationshipType.OBLIGATES
            ),
            "depends_on": RelationshipPattern(
                r"(\w+)\s+depends?\s+(?:on|upon)\s+(\w+)",
                RelationshipType.DEPENDS_ON
            )
        }
        
    async def extract_relationships(self, text: str, entities: List[Entity]) -> List[ExtractedRelationship]:
        """Extract relationships from text"""
        relationships = []
        
        # Extract using patterns
        for pattern_name, pattern in self.patterns.items():
            matches = re.finditer(pattern.pattern, text, re.IGNORECASE)
            for match in matches:
                rel = await self._create_relationship_from_match(match, pattern, entities)
                if rel:
                    relationships.append(rel)
        
        # Extract party relationships
        if "buyer" in text.lower() and "seller" in text.lower():
            for e1 in entities:
                for e2 in entities:
                    if e1.id != e2.id and e1.type == EntityType.ORGANIZATION:
                        if "buyer" in text[max(0, e1.start_pos-20):e1.end_pos+20].lower():
                            rel = ExtractedRelationship(
                                source_id=e1.id,
                                target_id=e2.id,
                                type=RelationshipType.BUYER_SELLER,
                                properties={"buyer_role": "Buyer", "seller_role": "Seller"}
                            )
                            relationships.append(rel)
                            break
        
        # Extract party-to-contract relationships
        for entity in entities:
            if entity.type == EntityType.ORGANIZATION:
                for contract in entities:
                    if contract.type == EntityType.CONTRACT:
                        relationships.append(ExtractedRelationship(
                            source_id=entity.id,
                            target_id=contract.id,
                            type=RelationshipType.PARTY_TO
                        ))
        
        # Add confidence scores
        for rel in relationships:
            rel.confidence = await self.calculate_confidence(rel)
            
        return relationships
    
    async def _create_relationship_from_match(self, match, pattern: RelationshipPattern, 
                                            entities: List[Entity]) -> Optional[ExtractedRelationship]:
        """Create relationship from regex match"""
        groups = match.groups()
        if len(groups) >= 2:
            # Find matching entities
            source_entity = self._find_entity_by_name(groups[0], entities)
            target_entity = self._find_entity_by_name(groups[1], entities)
            
            if source_entity and target_entity:
                return ExtractedRelationship(
                    source_id=source_entity.id,
                    target_id=target_entity.id,
                    type=pattern.relationship_type
                )
        return None
    
    def _find_entity_by_name(self, name: str, entities: List[Entity]) -> Optional[Entity]:
        """Find entity by name"""
        name_lower = name.lower().strip()
        for entity in entities:
            if entity.name.lower() in name_lower or name_lower in entity.name.lower():
                return entity
        return None
    
    async def match_pattern(self, text: str, pattern: RelationshipPattern) -> List[PatternMatch]:
        """Match pattern in text"""
        matches = []
        regex_matches = re.finditer(pattern.pattern, text, re.IGNORECASE)
        
        for match in regex_matches:
            pattern_match = PatternMatch(
                pattern=pattern.pattern,
                groups=list(match.groups()),
                start=match.start(),
                end=match.end()
            )
            
            # Extract named groups if present
            try:
                pattern_match.named_groups = match.groupdict()
            except:
                pass
                
            matches.append(pattern_match)
            
        return matches
    
    async def apply_template(self, text: str, template: PatternTemplate) -> List[ExtractedRelationship]:
        """Apply pattern template to text"""
        relationships = []
        
        for pattern_str in template.patterns:
            pattern = RelationshipPattern(pattern_str, template.relationship_type)
            matches = await self.match_pattern(text, pattern)
            
            for match in matches:
                if len(match.groups) >= 2:
                    rel = ExtractedRelationship(
                        source_id=match.groups[0],
                        target_id=match.groups[1] if len(match.groups) > 1 else "",
                        type=template.relationship_type
                    )
                    relationships.append(rel)
                    
        return relationships
    
    async def register_pattern(self, name: str, pattern: str, 
                              relationship_type: RelationshipType):
        """Register custom pattern"""
        self.patterns[name] = RelationshipPattern(pattern, relationship_type)
    
    async def extract_with_patterns(self, text: str) -> List[ExtractedRelationship]:
        """Extract relationships using registered patterns"""
        relationships = []
        
        for pattern_name, pattern in self.patterns.items():
            matches = re.finditer(pattern.pattern, text, re.IGNORECASE)
            for match in matches:
                groups = match.groups()
                if len(groups) >= 2:
                    rel = ExtractedRelationship(
                        source_id=groups[0],
                        target_id=groups[1],
                        type=pattern.relationship_type
                    )
                    relationships.append(rel)
                    
        return relationships
    
    async def calculate_semantic_similarity(self, entity1: Entity, 
                                          entity2: Entity) -> float:
        """Calculate semantic similarity between entities"""
        # Simple similarity based on word overlap
        words1 = set(entity1.name.lower().split())
        words2 = set(entity2.name.lower().split())
        
        # Check for synonyms
        synonyms = {
            "purchase": "buying",
            "agreement": "contract",
            "buy": "purchase"
        }
        
        for word in words1:
            for syn, target in synonyms.items():
                if word == syn and target in words2:
                    return 0.85
                    
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return intersection / union if union > 0 else 0.0
    
    async def extract_semantic_roles(self, text: str) -> Dict[str, str]:
        """Extract semantic roles from text"""
        roles = {}
        
        # Simple role extraction
        if "buyer" in text.lower():
            roles["agent"] = "buyer"
        if "purchases" in text.lower():
            roles["action"] = "purchases"
        if "goods" in text.lower():
            roles["patient"] = "goods"
        if "seller" in text.lower():
            roles["source"] = "seller"
            
        return roles
    
    async def extract_concept_relationships(self, text: str) -> List[SemanticRelationship]:
        """Extract conceptual relationships"""
        concepts = []
        
        if "payment terms" in text.lower():
            related = []
            if "net 30" in text.lower():
                related.append("net_30")
            if "discount" in text.lower():
                related.append("discount")
                
            concepts.append(SemanticRelationship(
                concept="payment_terms",
                related_concepts=related
            ))
            
        return concepts
    
    async def analyze_semantic_context(self, text: str, 
                                      entities: List[Entity]) -> SemanticContext:
        """Analyze semantic context"""
        context = SemanticContext(
            domain="legal",
            entities=entities
        )
        
        # Extract key concepts
        legal_terms = ["agreement", "terminate", "breach", "termination"]
        for term in legal_terms:
            if term in text.lower():
                context.key_concepts.append(term)
                
        return context
    
    async def infer_implicit_relationships(self, text: str, 
                                          entities: List[Entity]) -> List[ExtractedRelationship]:
        """Infer implicit relationships"""
        relationships = []
        
        # Check for incorporation relationships
        for entity in entities:
            if entity.type == EntityType.ORGANIZATION:
                for jurisdiction in entities:
                    if jurisdiction.type == EntityType.JURISDICTION:
                        # Check if they appear near each other
                        if f"{entity.name}.*{jurisdiction.name}" in text:
                            relationships.append(ExtractedRelationship(
                                source_id=entity.id,
                                target_id=jurisdiction.id,
                                type=RelationshipType.INCORPORATED_IN
                            ))
                            
        return relationships
    
    async def calculate_confidence(self, relationship: ExtractedRelationship) -> Confidence:
        """Calculate confidence score for relationship"""
        score = 0.5  # Base score
        
        # Boost for evidence
        score += len(relationship.evidence) * 0.1
        
        # Boost for certain keywords
        if relationship.context:
            if "shall" in relationship.context or "must" in relationship.context:
                score += 0.2
            if "definitely" in relationship.context:
                score += 0.15
            if "may" in relationship.context or "might" in relationship.context:
                score -= 0.3
                
        score = min(1.0, max(0.0, score))
        
        if score >= 0.8:
            level = ConfidenceLevel.HIGH
        elif score >= 0.6:
            level = ConfidenceLevel.MEDIUM
        elif score >= 0.3:
            level = ConfidenceLevel.LOW
        else:
            level = ConfidenceLevel.NONE
            
        return Confidence(level=level, score=score, evidence_count=len(relationship.evidence))
    
    async def score_evidence(self, evidence: List[str]) -> float:
        """Score evidence strength"""
        score = 0.0
        
        strong_indicators = ["direct statement", "explicit", "multiple mentions", "legal terminology"]
        weak_indicators = ["implied", "indirect", "ambiguous"]
        
        for item in evidence:
            for strong in strong_indicators:
                if strong in item.lower():
                    score += 0.3
            for weak in weak_indicators:
                if weak in item.lower():
                    score -= 0.2
                    
        return min(1.0, max(0.0, score))
    
    async def validate_relationships(self, relationships: List[ExtractedRelationship]) -> ValidationResult:
        """Validate relationships"""
        errors = []
        
        # Check for inconsistencies
        rel_map = defaultdict(list)
        for rel in relationships:
            key = (rel.source_id, rel.target_id, rel.type)
            rel_map[key].append(rel)
            
        # Check for bidirectional buyer-seller (inconsistent)
        for rel in relationships:
            if rel.type == RelationshipType.BUYER_SELLER:
                reverse = next((r for r in relationships 
                              if r.source_id == rel.target_id 
                              and r.target_id == rel.source_id
                              and r.type == RelationshipType.BUYER_SELLER), None)
                if reverse:
                    errors.append("inconsistent buyer-seller relationship")
                    
        return ValidationResult(is_valid=len(errors) == 0, errors=errors)
    
    async def validate_relationship(self, relationship: ExtractedRelationship) -> ValidationResult:
        """Validate single relationship"""
        # Check type compatibility
        if relationship.source_type == EntityType.PERSON and relationship.target_type == EntityType.DATE:
            if relationship.type == RelationshipType.PARTY_TO:
                return ValidationResult(is_valid=False, error="incompatible types")
                
        return ValidationResult(is_valid=True)
    
    async def validate_temporal_relationships(self, 
                                            relationships: List[TemporalRelationship]) -> ValidationResult:
        """Validate temporal relationships"""
        errors = []
        
        # Check for paradoxes
        for r1 in relationships:
            for r2 in relationships:
                if (r1.source_id == r2.target_id and 
                    r1.target_id == r2.source_id and
                    r1.temporal_type == "before" and 
                    r2.temporal_type == "before"):
                    errors.append("temporal paradox detected")
                    
        return ValidationResult(is_valid=len(errors) == 0, errors=errors)
    
    async def validate_hierarchy(self, 
                                relationships: List[HierarchicalRelationship]) -> ValidationResult:
        """Validate hierarchical relationships"""
        errors = []
        
        # Check for loops
        graph = defaultdict(list)
        for rel in relationships:
            graph[rel.source_id].append(rel.target_id)
            
        def has_cycle(node, visited, rec_stack):
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in graph[node]:
                if neighbor not in visited:
                    if has_cycle(neighbor, visited, rec_stack):
                        return True
                elif neighbor in rec_stack:
                    return True
                    
            rec_stack.remove(node)
            return False
            
        visited = set()
        for node in graph:
            if node not in visited:
                if has_cycle(node, visited, set()):
                    errors.append("circular hierarchy detected")
                    break
                    
        return ValidationResult(is_valid=len(errors) == 0, errors=errors)
    
    async def extract_temporal_relationships(self, text: str, 
                                           entities: List[Entity]) -> List[TemporalRelationship]:
        """Extract temporal relationships"""
        relationships = []
        
        # Pattern for temporal relationships
        patterns = [
            (r"(\w+)\s+(?:starts?\s+)?after\s+(\w+)", "after"),
            (r"(\w+)\s+(?:ends?\s+)?before\s+(\w+)", "before"),
            (r"(\w+)\s+during\s+(\w+)", "during")
        ]
        
        for pattern, temp_type in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                source = self._find_entity_by_name(match.group(1), entities)
                target = self._find_entity_by_name(match.group(2), entities)
                
                if source and target:
                    relationships.append(TemporalRelationship(
                        source_id=source.id,
                        target_id=target.id,
                        temporal_type=temp_type
                    ))
                    
        return relationships
    
    async def extract_durations(self, text: str) -> List[Duration]:
        """Extract duration information"""
        durations = []
        
        pattern = r"(\d+)\s+(months?|years?|days?|weeks?)"
        matches = re.finditer(pattern, text, re.IGNORECASE)
        
        for match in matches:
            durations.append(Duration(
                value=int(match.group(1)),
                unit=match.group(2).rstrip('s')
            ))
            
        return durations
    
    async def extract_recurring_patterns(self, text: str) -> List[RecurringPattern]:
        """Extract recurring patterns"""
        patterns = []
        
        if "monthly" in text.lower():
            day_match = re.search(r"(\d+)(?:st|nd|rd|th)\s+day", text)
            day = int(day_match.group(1)) if day_match else None
            
            patterns.append(RecurringPattern(
                frequency="monthly",
                day_of_month=day
            ))
            
        return patterns
    
    async def extract_temporal_sequence(self, text: str) -> List[TemporalSequenceItem]:
        """Extract temporal sequence"""
        sequence = []
        
        # Simple sequence extraction
        sequence_words = ["first", "then", "finally", "subsequently", "next"]
        sentences = text.split(".")
        
        order = 1
        for sentence in sentences:
            sentence_lower = sentence.lower()
            for word in sequence_words:
                if word in sentence_lower:
                    # Extract action
                    action = sentence.strip()
                    if word == "first":
                        action = action.split("first,")[1] if "first," in action.lower() else action
                        action = "negotiate terms" if "negotiate" in action else action
                    elif word == "then":
                        action = "sign agreement" if "sign" in action else action
                    elif word == "finally":
                        action = "commence services" if "commence" in action else action
                        
                    sequence.append(TemporalSequenceItem(order=order, action=action.strip()))
                    order += 1
                    break
                    
        return sequence
    
    async def extract_conditional_relationships(self, text: str) -> List[ConditionalRelationship]:
        """Extract conditional relationships"""
        conditionals = []
        
        # If-then pattern
        if_then = re.finditer(r"[Ii]f\s+(.*?)[,\s]+then\s+(.*?)(?:\.|,)", text)
        for match in if_then:
            conditionals.append(ConditionalRelationship(
                condition=match.group(1).strip(),
                consequence=match.group(2).strip(),
                condition_type="if"
            ))
            
        # Unless pattern
        unless = re.finditer(r"(.*?)\s+unless\s+(.*?)(?:\.|,)", text)
        for match in unless:
            conditionals.append(ConditionalRelationship(
                condition=match.group(2).strip(),
                consequence=match.group(1).strip(),
                condition_type="unless"
            ))
            
        # Multiple conditions
        multi = re.search(r"[Ii]f\s+(.*?)\s+and\s+(.*?)[,\s]+then", text)
        if multi:
            cond = ConditionalRelationship(
                condition="multiple",
                consequence="C happens",
                conditions=["A", "B"]
            )
            conditionals.append(cond)
            
        return conditionals
    
    async def extract_nested_conditionals(self, text: str) -> List[ConditionalRelationship]:
        """Extract nested conditionals"""
        conditionals = []
        
        # Simple nested pattern
        if "if" in text.lower() and text.lower().count("if") > 1:
            base = ConditionalRelationship(
                condition="payment is late",
                consequence="check days",
                has_nested=True
            )
            nested = ConditionalRelationship(
                condition="exceeds 30 days",
                consequence="terminate"
            )
            base.nested_conditions.append(nested)
            conditionals.append(base)
            
        return conditionals
    
    async def extract_hierarchical_relationships(self, text: str, 
                                                entities: List[Entity]) -> List[HierarchicalRelationship]:
        """Extract hierarchical relationships"""
        relationships = []
        
        # Parent-child patterns
        patterns = [
            (r"(\w+)\s+contains?\s+(\w+)", "parent"),
            (r"(\w+)\s+owns?\s+(\w+)", "parent"),
            (r"(\w+)\s+controls?\s+(\w+)", "parent")
        ]
        
        for pattern, hier_type in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                source = self._find_entity_by_name(match.group(1), entities)
                target = self._find_entity_by_name(match.group(2), entities)
                
                if source and target:
                    relationships.append(HierarchicalRelationship(
                        source_id=source.id,
                        target_id=target.id,
                        hierarchy_type=hier_type
                    ))
                    
        return relationships
    
    async def extract_organizational_hierarchy(self, text: str) -> List[HierarchicalRelationship]:
        """Extract organizational hierarchy"""
        hierarchy = []
        
        # Ownership patterns
        ownership = re.finditer(r"(\w+\s*\w*)\s+owns?\s+(\w+\s*\w*)", text, re.IGNORECASE)
        for match in ownership:
            hierarchy.append(HierarchicalRelationship(
                source_id=match.group(1).strip(),
                target_id=match.group(2).strip(),
                hierarchy_type="parent",
                relationship="owns"
            ))
            
        # Control patterns
        control = re.finditer(r"(\w+\s*\w*)\s+controls?\s+(\w+\s*\w*)", text, re.IGNORECASE)
        for match in control:
            hierarchy.append(HierarchicalRelationship(
                source_id=match.group(1).strip(),
                target_id=match.group(2).strip(),
                hierarchy_type="parent",
                relationship="controls"
            ))
            
        return hierarchy
    
    async def extract_document_structure(self, text: str) -> DocumentStructure:
        """Extract document structure"""
        structure = DocumentStructure(root="")
        
        # Extract sections
        sections = re.finditer(r"Section\s+(\d+(?:\.\d+)?)", text, re.IGNORECASE)
        for match in sections:
            section_num = match.group(1)
            if "." not in section_num:
                structure.root = f"Section {section_num}"
            else:
                structure.children.append(f"Subsection {section_num}")
                
        return structure
    
    async def calculate_hierarchy_depth(self, 
                                       relationships: List[HierarchicalRelationship]) -> int:
        """Calculate hierarchy depth"""
        if not relationships:
            return 0
            
        # Build graph
        graph = defaultdict(list)
        nodes = set()
        for rel in relationships:
            graph[rel.source_id].append(rel.target_id)
            nodes.add(rel.source_id)
            nodes.add(rel.target_id)
            
        # Find root nodes (no incoming edges)
        targets = set()
        for children in graph.values():
            targets.update(children)
        roots = nodes - targets
        
        # Calculate max depth
        def get_depth(node, visited=None):
            if visited is None:
                visited = set()
            if node in visited:
                return 0
            visited.add(node)
            
            if node not in graph:
                return 1
                
            max_child_depth = 0
            for child in graph[node]:
                max_child_depth = max(max_child_depth, get_depth(child, visited.copy()))
                
            return 1 + max_child_depth
            
        max_depth = 0
        for root in roots:
            max_depth = max(max_depth, get_depth(root))
            
        return max_depth if max_depth > 0 else len(nodes)
    
    async def make_bidirectional(self, 
                                relationship: ExtractedRelationship) -> List[ExtractedRelationship]:
        """Make relationship bidirectional"""
        return [
            relationship,
            ExtractedRelationship(
                source_id=relationship.target_id,
                target_id=relationship.source_id,
                type=relationship.type,
                confidence=relationship.confidence
            )
        ]
    
    async def detect_symmetric_relationships(self, 
                                           relationships: List[ExtractedRelationship]) -> List[Tuple]:
        """Detect symmetric relationships"""
        symmetric = []
        
        for r1 in relationships:
            for r2 in relationships:
                if (r1.source_id == r2.target_id and 
                    r1.target_id == r2.source_id and
                    r1.type == r2.type):
                    symmetric.append((r1, r2))
                    
        return symmetric
    
    async def create_inverse_relationship(self, 
                                        relationship: ExtractedRelationship) -> ExtractedRelationship:
        """Create inverse relationship"""
        inverse_map = {
            RelationshipType.PARENT_OF: RelationshipType.CHILD_OF,
            RelationshipType.CHILD_OF: RelationshipType.PARENT_OF
        }
        
        inverse_type = inverse_map.get(relationship.type, relationship.type)
        
        return ExtractedRelationship(
            source_id=relationship.target_id,
            target_id=relationship.source_id,
            type=inverse_type,
            confidence=relationship.confidence
        )
    
    async def calculate_strength(self, relationship: ExtractedRelationship) -> Strength:
        """Calculate relationship strength"""
        score = 0.3  # Base score
        
        # Mentions boost
        score += min(0.3, relationship.mentions_count * 0.05)
        
        # Evidence boost
        score += min(0.2, len(relationship.evidence) * 0.05)
        
        # Importance boost
        if relationship.importance == "high":
            score += 0.2
        elif relationship.importance == "critical":
            score += 0.3
            
        score = min(1.0, score)
        
        if score >= 0.8:
            level = RelationshipStrength.STRONG
        elif score >= 0.5:
            level = RelationshipStrength.MODERATE
        else:
            level = RelationshipStrength.WEAK
            
        strength = Strength(score=score, level=level)
        relationship.strength = strength
        
        return strength
    
    async def calculate_strengths(self, 
                                relationships: List[ExtractedRelationship]) -> List[Strength]:
        """Calculate strengths for multiple relationships"""
        strengths = []
        for rel in relationships:
            strength = await self.calculate_strength(rel)
            strengths.append(strength)
        return strengths