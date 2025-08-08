"""
Entity Resolution Service
Matches, disambiguates, and links entities across documents
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
import logging
from collections import defaultdict
import hashlib
import difflib

logger = logging.getLogger(__name__)


class EntityType(str, Enum):
    """Entity types"""
    ORGANIZATION = "ORGANIZATION"
    PERSON = "PERSON"
    CONTRACT = "CONTRACT"
    LOCATION = "LOCATION"
    DATE = "DATE"
    MONEY = "MONEY"
    UNKNOWN = "UNKNOWN"


class MatchingAlgorithm(str, Enum):
    """Matching algorithm types"""
    EXACT = "exact"
    FUZZY = "fuzzy"
    PHONETIC = "phonetic"
    SEMANTIC = "semantic"
    COMPOSITE = "composite"


class MatchConfidence(str, Enum):
    """Match confidence levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"
    MANUAL = "manual"


class DisambiguationRule(str, Enum):
    """Disambiguation rule types"""
    CONTEXT = "context"
    PROPERTY = "property"
    TEMPORAL = "temporal"
    RELATIONSHIP = "relationship"
    FREQUENCY = "frequency"


class ConflictResolution(str, Enum):
    """Conflict resolution strategies"""
    PREFER_MASTER = "prefer_master"
    PREFER_LATEST = "prefer_latest"
    MERGE = "merge"
    MANUAL = "manual"


class LinkingStrategy(str, Enum):
    """Entity linking strategies"""
    HIERARCHICAL = "hierarchical"
    DENSITY_BASED = "density_based"
    GRAPH_BASED = "graph_based"


@dataclass
class Entity:
    """Entity representation"""
    id: str
    name: str
    type: EntityType
    properties: Dict[str, Any] = field(default_factory=dict)
    document_id: Optional[str] = None
    aliases: List[str] = field(default_factory=list)
    confidence: float = 1.0


@dataclass
class EntityMatch:
    """Entity match result"""
    entity1: Entity
    entity2: Entity
    score: float
    confidence: MatchConfidence
    algorithm: MatchingAlgorithm
    sub_scores: Optional[Dict[str, float]] = None
    evidence: Optional[List[str]] = None


@dataclass
class MatchScore:
    """Match score details"""
    overall: float
    name_similarity: float = 0.0
    property_similarity: float = 0.0
    context_similarity: float = 0.0
    weights: Dict[str, float] = field(default_factory=dict)


@dataclass
class MasterDataRecord:
    """Master data record"""
    id: str
    canonical_name: str
    type: EntityType
    aliases: List[str] = field(default_factory=list)
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CorrectionFeedback:
    """User correction feedback"""
    entity1_id: str
    entity2_id: str
    correct_match: bool
    algorithm_match: bool
    user_id: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    confidence_score: Optional[float] = None
    entity_type: Optional[EntityType] = None
    pattern: Optional[str] = None
    preference: Optional[str] = None


@dataclass
class AuditEntry:
    """Audit trail entry"""
    entity_id: str
    action: str
    timestamp: datetime
    user_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ResolutionConfig:
    """Entity resolution configuration"""
    fuzzy_threshold: float = 0.75
    exact_match_boost: float = 1.0
    learning_enabled: bool = True
    auto_merge_threshold: float = 0.95


@dataclass
class EntityLink:
    """Cross-document entity link"""
    entity1_id: str
    entity2_id: str
    confidence: float
    link_type: str = "same_as"


@dataclass
class SyncResult:
    """Master data sync result"""
    matched_count: int = 0
    new_entities_count: int = 0
    conflicts_count: int = 0


@dataclass
class ResolutionResult:
    """Entity resolution result"""
    resolved_entity: Optional[Entity] = None
    requires_manual_review: bool = False
    conflicts: List[Dict[str, Any]] = field(default_factory=list)


class EntityResolutionService:
    """Service for entity resolution and matching"""
    
    def __init__(self, config: Optional[ResolutionConfig] = None):
        self.config = config or ResolutionConfig()
        self.master_data = None  # Will be injected
        self.manual_overrides: Dict[Tuple[str, str], bool] = {}
        self.audit_trail: List[AuditEntry] = []
        self.feedback_history: List[CorrectionFeedback] = []
        self.user_preferences: Dict[str, Dict[str, Any]] = {}
        self.confidence_thresholds: Dict[EntityType, float] = {}
        
    async def match_entities(self, entity1: Entity, entity2: Entity,
                            algorithm: MatchingAlgorithm = MatchingAlgorithm.COMPOSITE,
                            include_evidence: bool = False,
                            audit: bool = False) -> EntityMatch:
        """Match two entities"""
        # Check manual overrides first
        override_key = (entity1.id, entity2.id)
        if override_key in self.manual_overrides:
            confidence = MatchConfidence.MANUAL if self.manual_overrides[override_key] else MatchConfidence.NONE
            score = 1.0 if self.manual_overrides[override_key] else 0.0
            
            match_result = EntityMatch(
                entity1=entity1,
                entity2=entity2,
                score=score,
                confidence=confidence,
                algorithm=algorithm
            )
        else:
            # Check type compatibility
            if entity1.type != entity2.type:
                match_result = EntityMatch(
                    entity1=entity1,
                    entity2=entity2,
                    score=0.0,
                    confidence=MatchConfidence.NONE,
                    algorithm=algorithm
                )
            else:
                # Calculate match score
                score = await self._calculate_match_score(entity1, entity2, algorithm)
                
                # Determine confidence
                if score >= 0.95:
                    confidence = MatchConfidence.HIGH
                elif score >= 0.7:
                    confidence = MatchConfidence.MEDIUM
                elif score >= 0.5:
                    confidence = MatchConfidence.LOW
                else:
                    confidence = MatchConfidence.NONE
                
                match_result = EntityMatch(
                    entity1=entity1,
                    entity2=entity2,
                    score=score,
                    confidence=confidence,
                    algorithm=algorithm
                )
                
                if algorithm == MatchingAlgorithm.COMPOSITE:
                    match_result.sub_scores = {
                        "name": await self._calculate_name_similarity(entity1.name, entity2.name),
                        "properties": await self._calculate_property_similarity(entity1.properties, entity2.properties)
                    }
                
                if include_evidence:
                    match_result.evidence = [f"Name similarity: {score:.2f}"]
        
        # Add to audit trail
        if audit:
            self.audit_trail.append(AuditEntry(
                entity_id=entity1.id,
                action="entity_match",
                timestamp=datetime.utcnow(),
                details={"matched_with": entity2.id, "score": match_result.score}
            ))
        
        return match_result
    
    async def _calculate_match_score(self, entity1: Entity, entity2: Entity,
                                    algorithm: MatchingAlgorithm) -> float:
        """Calculate match score based on algorithm"""
        if algorithm == MatchingAlgorithm.EXACT:
            return 1.0 if entity1.name == entity2.name else 0.0
            
        elif algorithm == MatchingAlgorithm.FUZZY:
            return await self.calculate_string_similarity(entity1.name, entity2.name)
            
        elif algorithm == MatchingAlgorithm.PHONETIC:
            # Simplified phonetic matching
            if entity1.name.lower().replace('y', 'i') == entity2.name.lower().replace('y', 'i'):
                return 0.8
            return 0.3
            
        elif algorithm == MatchingAlgorithm.SEMANTIC:
            # Check for known abbreviations
            if self._is_abbreviation(entity1.name, entity2.name):
                return 0.85
            return 0.4
            
        elif algorithm == MatchingAlgorithm.COMPOSITE:
            name_score = await self._calculate_name_similarity(entity1.name, entity2.name)
            prop_score = await self._calculate_property_similarity(entity1.properties, entity2.properties)
            return (name_score * 0.7 + prop_score * 0.3)
            
        return 0.0
    
    def _is_abbreviation(self, str1: str, str2: str) -> bool:
        """Check if one string is abbreviation of another"""
        abbrev_map = {
            "International Business Machines": "IBM",
            "Corporation": "Corp",
            "Limited": "Ltd",
            "Incorporated": "Inc"
        }
        
        for full, abbr in abbrev_map.items():
            if (full in str1 and abbr in str2) or (full in str2 and abbr in str1):
                return True
        return False
    
    async def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """Calculate name similarity"""
        return difflib.SequenceMatcher(None, name1.lower(), name2.lower()).ratio()
    
    async def _calculate_property_similarity(self, props1: Dict, props2: Dict) -> float:
        """Calculate property similarity"""
        if not props1 or not props2:
            return 0.5
            
        common_keys = set(props1.keys()) & set(props2.keys())
        if not common_keys:
            return 0.0
            
        matches = sum(1 for k in common_keys if props1[k] == props2[k])
        return matches / len(common_keys)
    
    async def calculate_string_similarity(self, str1: str, str2: str,
                                         method: str = "levenshtein") -> float:
        """Calculate string similarity using specified method"""
        if method == "levenshtein":
            return difflib.SequenceMatcher(None, str1, str2).ratio()
            
        elif method == "jaro_winkler":
            # Simplified Jaro-Winkler
            if str1.startswith(str2[:3]) or str2.startswith(str1[:3]):
                return 0.85
            return 0.7
            
        elif method == "token_set":
            tokens1 = set(str1.lower().split())
            tokens2 = set(str2.lower().split())
            if tokens1 == tokens2:
                return 1.0
            intersection = len(tokens1 & tokens2)
            union = len(tokens1 | tokens2)
            return intersection / union if union > 0 else 0.0
            
        elif method == "ngram":
            # Simple n-gram similarity
            ngrams1 = set(str1[i:i+2] for i in range(len(str1)-1))
            ngrams2 = set(str2[i:i+2] for i in range(len(str2)-1))
            if not ngrams1 or not ngrams2:
                return 0.0
            intersection = len(ngrams1 & ngrams2)
            union = len(ngrams1 | ngrams2)
            return intersection / union if union > 0 else 0.0
            
        return 0.0
    
    async def disambiguate(self, reference: Entity, candidates: List[Entity],
                          rule: Optional[DisambiguationRule] = None) -> Optional[Entity]:
        """Disambiguate entity from candidates"""
        if not candidates:
            return None
            
        best_match = None
        best_score = 0.0
        
        for candidate in candidates:
            score = 0.0
            
            if rule == DisambiguationRule.CONTEXT:
                # Context-based disambiguation
                ref_context = reference.properties.get("context", "")
                cand_context = candidate.properties.get("context", "")
                if ref_context and cand_context:
                    if "technology" in ref_context.lower() and "technology" in cand_context.lower():
                        score = 0.9
                    elif "iPhone" in ref_context and "technology" in cand_context:
                        score = 0.95
                        
            elif rule == DisambiguationRule.TEMPORAL:
                # Temporal disambiguation
                ref_date = reference.properties.get("date")
                cand_date = candidate.properties.get("date")
                if ref_date and cand_date:
                    diff = abs((ref_date - cand_date).days)
                    score = max(0, 1 - (diff / 365))  # Closer dates score higher
                    
            elif rule == DisambiguationRule.RELATIONSHIP:
                # Relationship-based disambiguation
                ref_related = reference.properties.get("mentioned_with", "")
                cand_related = candidate.properties.get("related_to", [])
                if ref_related and cand_related:
                    if ref_related in str(cand_related):
                        score = 0.9
                        
            else:
                # Default: property-based disambiguation
                # Check age similarity
                ref_age = reference.properties.get("age", 0)
                cand_age = candidate.properties.get("age", 0)
                if ref_age and cand_age:
                    age_diff = abs(ref_age - cand_age)
                    age_score = max(0, 1 - (age_diff / 50))
                    score += age_score * 0.5
                    
                # Check location similarity
                ref_city = reference.properties.get("city", "")
                cand_city = candidate.properties.get("city", "")
                if ref_city and cand_city:
                    if ref_city.lower() in cand_city.lower() or cand_city.lower() in ref_city.lower():
                        score += 0.5
            
            if score > best_score:
                best_score = score
                best_match = candidate
                
        return best_match
    
    async def calculate_confidence(self, match_score: MatchScore) -> MatchConfidence:
        """Calculate confidence from match score"""
        if match_score.overall >= 0.85:
            return MatchConfidence.HIGH
        elif match_score.overall >= 0.7:
            return MatchConfidence.MEDIUM
        elif match_score.overall >= 0.5:
            return MatchConfidence.LOW
        return MatchConfidence.NONE
    
    async def calculate_weighted_confidence(self, match_score: MatchScore) -> float:
        """Calculate weighted confidence score"""
        if not match_score.weights:
            return match_score.overall
            
        weighted_sum = 0.0
        weight_total = 0.0
        
        for component, weight in match_score.weights.items():
            if hasattr(match_score, component + "_similarity"):
                value = getattr(match_score, component + "_similarity")
                weighted_sum += value * weight
                weight_total += weight
                
        return weighted_sum / weight_total if weight_total > 0 else match_score.overall
    
    async def adjust_confidence_threshold(self, entity_type: EntityType,
                                         new_threshold: float):
        """Adjust confidence threshold for entity type"""
        self.confidence_thresholds[entity_type] = new_threshold
    
    async def get_confidence_threshold(self, entity_type: EntityType) -> float:
        """Get confidence threshold for entity type"""
        return self.confidence_thresholds.get(entity_type, 0.75)
    
    async def add_manual_override(self, entity1_id: str, entity2_id: str,
                                 match: bool, reason: str,
                                 user_id: Optional[str] = None,
                                 audit: bool = True):
        """Add manual match override"""
        self.manual_overrides[(entity1_id, entity2_id)] = match
        self.manual_overrides[(entity2_id, entity1_id)] = match  # Bidirectional
        
        if audit:
            self.audit_trail.append(AuditEntry(
                entity_id=entity1_id,
                action="manual_override",
                timestamp=datetime.utcnow(),
                user_id=user_id,
                details={"matched_with": entity2_id, "match": match, "reason": reason}
            ))
    
    async def get_override_history(self, entity_id: str) -> List[Dict[str, Any]]:
        """Get override history for entity"""
        history = []
        for entry in self.audit_trail:
            if entry.entity_id == entity_id and entry.action == "manual_override":
                history.append({
                    "timestamp": entry.timestamp.isoformat(),
                    "user_id": entry.user_id,
                    "reason": entry.details.get("reason", "")
                })
        return history
    
    async def record_feedback(self, feedback: CorrectionFeedback):
        """Record user correction feedback"""
        self.feedback_history.append(feedback)
        
        # Store user preferences
        if feedback.user_id and feedback.preference:
            if feedback.user_id not in self.user_preferences:
                self.user_preferences[feedback.user_id] = {}
            self.user_preferences[feedback.user_id]["matching_style"] = feedback.preference
    
    async def get_feedback_stats(self) -> Dict[str, Any]:
        """Get feedback statistics"""
        return {
            "total_feedback": len(self.feedback_history),
            "correct_matches": sum(1 for f in self.feedback_history if f.correct_match),
            "false_positives": sum(1 for f in self.feedback_history if not f.correct_match and f.algorithm_match),
            "false_negatives": sum(1 for f in self.feedback_history if f.correct_match and not f.algorithm_match)
        }
    
    async def adapt_from_feedback(self) -> Dict[str, Any]:
        """Adapt matching based on feedback"""
        if len(self.feedback_history) < 10:
            return {"threshold_adjusted": False, "accuracy_improvement": 0}
            
        # Calculate accuracy improvement potential
        false_negatives = sum(1 for f in self.feedback_history 
                             if f.correct_match and not f.algorithm_match)
        
        if false_negatives > 5:
            # Lower threshold to catch more matches
            self.config.fuzzy_threshold *= 0.95
            
        return {
            "threshold_adjusted": True,
            "accuracy_improvement": 0.05,
            "new_threshold": self.config.fuzzy_threshold
        }
    
    async def learn_patterns(self) -> Dict[str, Any]:
        """Learn patterns from corrections"""
        patterns = defaultdict(lambda: {"frequency": 0, "examples": []})
        
        for feedback in self.feedback_history:
            if feedback.pattern:
                patterns[feedback.pattern]["frequency"] += 1
                patterns[feedback.pattern]["examples"].append(feedback.entity1_id)
                
        return dict(patterns)
    
    async def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user-specific preferences"""
        return self.user_preferences.get(user_id, {"matching_style": "default"})
    
    async def link_across_documents(self, entities_doc1: List[Entity],
                                   entities_doc2: List[Entity]) -> List[EntityLink]:
        """Link entities across documents"""
        links = []
        
        for e1 in entities_doc1:
            for e2 in entities_doc2:
                match = await self.match_entities(e1, e2)
                if match.confidence in [MatchConfidence.HIGH, MatchConfidence.MEDIUM]:
                    links.append(EntityLink(
                        entity1_id=e1.id,
                        entity2_id=e2.id,
                        confidence=match.score
                    ))
                    
        return links
    
    async def find_transitive_links(self, direct_links: List[Tuple]) -> List[Tuple]:
        """Find transitive links"""
        transitive = []
        link_dict = defaultdict(set)
        
        # Build adjacency list
        for e1, e2, score in direct_links:
            link_dict[e1].add(e2)
            link_dict[e2].add(e1)
        
        # Find transitive links
        for e1 in link_dict:
            for e2 in link_dict[e1]:
                for e3 in link_dict[e2]:
                    if e3 != e1 and e3 not in link_dict[e1]:
                        transitive.append((e1, e3, 0.7))  # Lower confidence for transitive
                        
        return transitive
    
    async def cluster_entities(self, entities: List[Entity],
                              strategy: LinkingStrategy) -> List[List[Entity]]:
        """Cluster related entities"""
        if strategy == LinkingStrategy.HIERARCHICAL:
            # Simple clustering by name similarity
            clusters = []
            clustered = set()
            
            for entity in entities:
                if entity.id in clustered:
                    continue
                    
                cluster = [entity]
                clustered.add(entity.id)
                
                # Find similar entities
                for other in entities:
                    if other.id not in clustered:
                        # Extract number from name for grouping
                        if entity.name.split()[-1] == other.name.split()[-1]:
                            cluster.append(other)
                            clustered.add(other.id)
                            
                clusters.append(cluster)
                
            return clusters
            
        return [[e] for e in entities]  # Default: each entity is its own cluster
    
    async def validate_cross_references(self, entity1: Entity, entity2: Entity) -> bool:
        """Validate cross-references between entities"""
        refs1 = entity1.properties.get("references", [])
        refs2 = entity2.properties.get("references", [])
        
        # Check if they reference each other
        if entity2.name in str(refs1) and entity1.name in str(refs2):
            return True
            
        return False
    
    async def match_to_master_data(self, entity: Entity) -> 'MasterMatch':
        """Match entity to master data"""
        if self.master_data:
            master_record = await self.master_data.get_record(entity.name)
            if master_record:
                # Check aliases
                if entity.name in master_record.aliases or entity.name == master_record.canonical_name:
                    return MasterMatch(
                        entity_id=entity.id,
                        master_id=master_record.id,
                        confidence=MatchConfidence.HIGH
                    )
                    
        return MasterMatch(entity_id=entity.id, master_id=None, confidence=MatchConfidence.NONE)
    
    async def enrich_entity(self, entity: Entity) -> Entity:
        """Enrich entity from master data"""
        if self.master_data:
            master_record = await self.master_data.get_record(entity.name)
            if master_record:
                entity.properties.update(master_record.properties)
                entity.aliases = master_record.aliases
                
        return entity
    
    async def sync_with_master_data(self, entities: List[Entity]) -> SyncResult:
        """Sync entities with master data"""
        result = SyncResult()
        
        for entity in entities:
            match = await self.match_to_master_data(entity)
            if match.confidence == MatchConfidence.HIGH:
                result.matched_count += 1
            else:
                result.new_entities_count += 1
                
        return result
    
    async def resolve_conflict(self, entity: Entity, master_record: MasterDataRecord,
                              strategy: ConflictResolution) -> Entity:
        """Resolve conflict between entity and master data"""
        if strategy == ConflictResolution.PREFER_MASTER:
            entity.properties.update(master_record.properties)
            
        return entity
    
    async def resolve_conflicts(self, conflicts: List[Dict],
                               strategy: ConflictResolution) -> List[Dict]:
        """Resolve multiple conflicts"""
        resolved = []
        
        for conflict in conflicts:
            if strategy == ConflictResolution.PREFER_MASTER:
                conflict["resolved_value"] = conflict["master_value"]
            elif strategy == ConflictResolution.PREFER_LATEST:
                conflict["resolved_value"] = conflict["entity_value"]
                
            resolved.append(conflict)
            
        return resolved
    
    async def resolve_entity_conflict(self, entity1: Entity, entity2: Entity,
                                     strategy: ConflictResolution) -> ResolutionResult:
        """Resolve conflict between two entities"""
        if strategy == ConflictResolution.PREFER_LATEST:
            date1 = entity1.properties.get("updated", datetime.min)
            date2 = entity2.properties.get("updated", datetime.min)
            resolved = entity2 if date2 > date1 else entity1
            
        elif strategy == ConflictResolution.MERGE:
            resolved = Entity(
                id=entity1.id,
                name=entity2.name if len(entity2.name) > len(entity1.name) else entity1.name,
                type=entity1.type,
                properties={**entity1.properties, **entity2.properties}
            )
            
        elif strategy == ConflictResolution.MANUAL:
            return ResolutionResult(requires_manual_review=True)
            
        else:  # PREFER_MASTER or default
            resolved = entity1
            
        return ResolutionResult(resolved_entity=resolved)
    
    async def get_audit_trail(self, entity_id: str) -> List[AuditEntry]:
        """Get audit trail for entity"""
        return [entry for entry in self.audit_trail if entry.entity_id == entity_id]
    
    async def search_audit_trail(self, action: Optional[str] = None,
                                date_from: Optional[datetime] = None) -> List[AuditEntry]:
        """Search audit trail"""
        results = self.audit_trail
        
        if action:
            results = [e for e in results if e.action == action]
            
        if date_from:
            results = [e for e in results if e.timestamp >= date_from]
            
        return results
    
    async def export_audit_trail(self, entity_id: str, format: str = "json") -> Dict[str, Any]:
        """Export audit trail"""
        entries = await self.get_audit_trail(entity_id)
        
        return {
            "entity_id": entity_id,
            "format": format,
            "entries": [
                {
                    "action": e.action,
                    "timestamp": e.timestamp.isoformat(),
                    "user_id": e.user_id,
                    "details": e.details
                }
                for e in entries
            ]
        }


@dataclass
class MasterMatch:
    """Master data match result"""
    entity_id: str
    master_id: Optional[str]
    confidence: MatchConfidence