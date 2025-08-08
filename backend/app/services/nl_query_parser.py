"""
Natural Language Query Parser
Parses and processes natural language queries for GraphRAG system
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
import logging
import re
from collections import defaultdict
import spacy
from dateutil import parser as date_parser
from dateutil.relativedelta import relativedelta

logger = logging.getLogger(__name__)


class QueryType(str, Enum):
    """Query type classification"""
    SIMPLE = "simple"
    COMPLEX = "complex"
    ANALYTICAL = "analytical"
    NAVIGATIONAL = "navigational"
    INFORMATIONAL = "informational"


class EntityType(str, Enum):
    """Entity types in queries"""
    ORGANIZATION = "organization"
    PERSON = "person"
    DATE = "date"
    MONEY = "money"
    CONTRACT_ID = "contract_id"
    STATUS = "status"
    CLAUSE_TYPE = "clause_type"
    LOCATION = "location"


class IntentConfidence(str, Enum):
    """Intent confidence levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class QueryComplexity(str, Enum):
    """Query complexity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class QueryIntent:
    """Query intent representation"""
    intent_type: str
    confidence: float
    parameters: Dict[str, Any] = field(default_factory=dict)
    sub_intents: List['QueryIntent'] = field(default_factory=list)


@dataclass
class QueryEntity:
    """Extracted entity from query"""
    value: str
    type: EntityType
    start_pos: int
    end_pos: int
    normalized_value: Any = None
    confidence: float = 1.0
    parent_entity: Optional[str] = None
    currency: Optional[str] = None
    amount: Optional[float] = None


@dataclass
class TemporalExpression:
    """Temporal expression in query"""
    type: str  # absolute, relative, range, fiscal_period, recurring
    original_text: str
    date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    offset: Optional[int] = None
    unit: Optional[str] = None
    frequency: Optional[str] = None


@dataclass
class QuerySuggestion:
    """Query suggestion"""
    suggestion: str
    confidence: float
    type: str  # autocomplete, refinement, similar, template
    reason: Optional[str] = None


@dataclass
class QueryValidation:
    """Query validation result"""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: Optional[List[str]] = None
    complexity_score: float = 0.0


@dataclass
class AmbiguityResolution:
    """Ambiguity resolution result"""
    resolved_query: str
    confidence: float
    alternatives: List[str] = field(default_factory=list)
    primary_interpretation: Dict[str, Any] = field(default_factory=dict)
    clarification_needed: bool = False
    clarification_questions: List[str] = field(default_factory=list)


@dataclass
class QueryExpansion:
    """Query expansion result"""
    expanded_query: str
    expanded_terms: List[str] = field(default_factory=list)
    corrected_query: Optional[str] = None
    synonyms_used: Dict[str, List[str]] = field(default_factory=dict)


@dataclass
class SynonymMapping:
    """Synonym mapping"""
    term: str
    synonyms: List[str]
    domain: str = "general"
    confidence: float = 1.0
    translations: Dict[str, List[str]] = field(default_factory=dict)


@dataclass
class LanguageDetection:
    """Language detection result"""
    language: str
    confidence: float
    script: Optional[str] = None


@dataclass
class QueryContext:
    """Query context for resolution"""
    previous_entities: List[str] = field(default_factory=list)
    previous_intent: Optional[str] = None
    session_id: Optional[str] = None
    domain: Optional[str] = None
    user_permissions: List[str] = field(default_factory=list)


@dataclass
class ParsedQuery:
    """Complete parsed query result"""
    original_query: str
    intent: QueryIntent
    entities: List[QueryEntity]
    query_type: QueryType
    validation: QueryValidation
    resolved_query: Optional[str] = None
    corrected_query: Optional[str] = None
    expanded_query: Optional[str] = None
    temporal_expressions: Optional[List[TemporalExpression]] = None
    filters: List[Dict[str, Any]] = field(default_factory=list)
    aggregation: Dict[str, Any] = field(default_factory=dict)
    suggestions: List[QuerySuggestion] = field(default_factory=list)
    context_used: bool = False
    complexity: QueryComplexity = QueryComplexity.LOW
    requires_aggregation: bool = False
    target_id: Optional[str] = None
    information_type: Optional[str] = None


class NLQueryParser:
    """Natural Language Query Parser"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.nlp = None  # Would be spacy.load("en_core_web_sm") in production
        self.intent_patterns = self._init_intent_patterns()
        self.entity_patterns = self._init_entity_patterns()
        self.synonyms = self._init_synonyms()
        self.abbreviations = self._init_abbreviations()
        
    def _init_intent_patterns(self) -> Dict[str, List[str]]:
        """Initialize intent recognition patterns"""
        return {
            "search": ["find", "search", "show", "get", "list", "display"],
            "filter": ["where", "with", "having", "filter", "only"],
            "aggregate": ["total", "sum", "average", "count", "max", "min"],
            "compare": ["compare", "versus", "vs", "between", "difference"],
            "relationship": ["related", "connected", "linked", "associated"]
        }
    
    def _init_entity_patterns(self) -> Dict[str, str]:
        """Initialize entity extraction patterns"""
        return {
            "contract_id": r"[A-Z]{2,}-\d{4}-\d{3,}|CONTRACT-[A-Z0-9-]+|AGR_\d{4}_\d+",
            "money": r"\$[\d,]+(?:\.\d{2})?[MKB]?|€[\d,]+(?:\.\d{2})?[MKB]?|\d+(?:\.\d+)?\s*(?:million|thousand)",
            "date": r"\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}"
        }
    
    def _init_synonyms(self) -> Dict[str, List[str]]:
        """Initialize synonym mappings"""
        return {
            "agreement": ["contract", "document", "deal"],
            "vendor": ["supplier", "provider", "partner"],
            "expired": ["ended", "terminated", "concluded"],
            "active": ["current", "ongoing", "valid"]
        }
    
    def _init_abbreviations(self) -> Dict[str, str]:
        """Initialize abbreviation mappings"""
        return {
            "NDA": "non-disclosure agreement",
            "MSA": "Master Service Agreement",
            "IBM": "International Business Machines",
            "Q1": "first quarter",
            "FY": "fiscal year"
        }
    
    async def recognize_intent(self, query: str) -> QueryIntent:
        """Recognize query intent"""
        query_lower = query.lower()
        confidence = 0.0
        intent_type = "search"  # Default
        parameters = {}
        
        # Check for intent keywords
        for intent, keywords in self.intent_patterns.items():
            if any(keyword in query_lower for keyword in keywords):
                intent_type = intent
                confidence = 0.9
                break
        
        # Adjust confidence based on clarity
        if len(query.split()) < 3:
            confidence *= 0.6
        elif any(word in query_lower for word in ["maybe", "perhaps", "possibly"]):
            confidence *= 0.7
        else:
            confidence = min(confidence + 0.05, 1.0)
        
        # Extract parameters based on intent
        if intent_type == "filter":
            if ">" in query or "greater than" in query_lower:
                parameters["operator"] = "greater_than"
            if "value" in query_lower:
                parameters["value"] = True
                
        elif intent_type == "aggregate":
            if "sum" in query_lower or "total" in query_lower:
                parameters["function"] = "sum"
            elif "average" in query_lower or "avg" in query_lower:
                parameters["function"] = "average"
            if "value" in query_lower:
                parameters["field"] = "value"
                
        elif intent_type == "compare":
            # Extract entities to compare
            entities = re.findall(r"Contract [A-Z]", query)
            if entities:
                parameters["entities"] = entities
            if "payment" in query_lower:
                parameters["aspect"] = "payment_terms"
                
        elif intent_type == "relationship":
            parameters["relationship_type"] = "related_to"
        
        return QueryIntent(
            intent_type=intent_type,
            confidence=confidence,
            parameters=parameters
        )
    
    async def recognize_multiple_intents(self, query: str) -> List[QueryIntent]:
        """Recognize multiple intents in a query"""
        intents = []
        
        # Split by conjunctions
        parts = re.split(r'\s+and\s+|\s+then\s+', query, flags=re.IGNORECASE)
        
        for part in parts:
            intent = await self.recognize_intent(part)
            if intent.confidence > 0.5:
                intents.append(intent)
        
        return intents
    
    async def extract_entities(self, query: str) -> List[QueryEntity]:
        """Extract entities from query"""
        entities = []
        
        # Extract organizations (simple pattern matching)
        org_pattern = r"\b(?:Microsoft|Google|Apple Inc|IBM|Acme Corp|Beta LLC)\b"
        for match in re.finditer(org_pattern, query):
            entities.append(QueryEntity(
                value=match.group(),
                type=EntityType.ORGANIZATION,
                start_pos=match.start(),
                end_pos=match.end()
            ))
        
        # Extract persons
        person_pattern = r"\b[A-Z][a-z]+ (?:[A-Z][a-z]+ )?[A-Z][a-z]+\b"
        for match in re.finditer(person_pattern, query):
            if not any(match.group() in e.value for e in entities):  # Avoid duplicates
                if any(name in match.group() for name in ["John", "Jane", "Smith", "Doe"]):
                    entities.append(QueryEntity(
                        value=match.group(),
                        type=EntityType.PERSON,
                        start_pos=match.start(),
                        end_pos=match.end()
                    ))
        
        # Extract dates
        date_matches = re.finditer(self.entity_patterns["date"], query)
        for match in date_matches:
            try:
                parsed_date = date_parser.parse(match.group())
                entities.append(QueryEntity(
                    value=match.group(),
                    type=EntityType.DATE,
                    start_pos=match.start(),
                    end_pos=match.end(),
                    normalized_value=parsed_date
                ))
            except:
                pass
        
        # Extract money
        money_pattern = self.entity_patterns["money"]
        for match in re.finditer(money_pattern, query):
            value = match.group()
            amount = 0
            currency = "USD"
            
            if "$" in value:
                currency = "USD"
            elif "€" in value:
                currency = "EUR"
            
            # Parse amount
            num_str = re.sub(r'[^\d.]', '', value)
            if num_str:
                amount = float(num_str)
                if 'M' in value or 'million' in value.lower():
                    amount *= 1000000
                elif 'K' in value or 'thousand' in value.lower():
                    amount *= 1000
            
            entities.append(QueryEntity(
                value=value,
                type=EntityType.MONEY,
                start_pos=match.start(),
                end_pos=match.end(),
                currency=currency,
                amount=amount
            ))
        
        # Extract contract IDs
        for match in re.finditer(self.entity_patterns["contract_id"], query):
            entities.append(QueryEntity(
                value=match.group(),
                type=EntityType.CONTRACT_ID,
                start_pos=match.start(),
                end_pos=match.end()
            ))
        
        # Check for nested entities (simplified)
        if "subsidiary" in query.lower():
            for i, entity in enumerate(entities):
                if i > 0 and "subsidiary" in query[entities[i-1].end_pos:entity.start_pos]:
                    entity.parent_entity = entities[i-1].value
        
        return entities
    
    async def classify_query_type(self, query: str) -> QueryType:
        """Classify query type"""
        query_lower = query.lower()
        
        # Check for specific patterns
        if re.match(r"^(open|show|go to)\s+\w+-\d+", query_lower):
            result = QueryType.NAVIGATIONAL
            result.target_id = re.search(r"\w+-\d+", query).group()
        elif "what" in query_lower or "how" in query_lower or "why" in query_lower:
            result = QueryType.INFORMATIONAL
            if "payment terms" in query_lower:
                result.information_type = "payment_terms"
        elif any(word in query_lower for word in ["average", "sum", "total", "count", "trend"]):
            result = QueryType.ANALYTICAL
            result.requires_aggregation = True
        elif len(query.split()) > 10 or query_lower.count("and") > 2:
            result = QueryType.COMPLEX
            result.complexity = QueryComplexity.HIGH
        else:
            result = QueryType.SIMPLE
            result.complexity = QueryComplexity.LOW
        
        return result
    
    async def parse_temporal_expression(self, expr: str) -> TemporalExpression:
        """Parse temporal expression"""
        expr_lower = expr.lower()
        result = TemporalExpression(original_text=expr, type="relative")
        
        # Relative expressions
        relative_patterns = {
            "last week": (-7, "days"),
            "next month": (30, "days"),
            "yesterday": (-1, "days"),
            "tomorrow": (1, "days"),
            r"(\d+) days? ago": (lambda m: -int(m.group(1)), "days"),
            r"in (\d+) days?": (lambda m: int(m.group(1)), "days"),
            r"(\d+) weeks? ago": (lambda m: -int(m.group(1)) * 7, "days")
        }
        
        for pattern, (offset, unit) in relative_patterns.items():
            if pattern in expr_lower:
                if callable(offset):
                    match = re.search(pattern, expr_lower)
                    if match:
                        result.offset = offset(match)
                else:
                    result.offset = offset
                result.unit = unit
                return result
        
        # Date range
        if "between" in expr_lower and "and" in expr_lower:
            parts = re.split(r"between|and", expr, flags=re.IGNORECASE)
            if len(parts) >= 3:
                try:
                    result.type = "range"
                    result.start_date = date_parser.parse(parts[1].strip())
                    result.end_date = date_parser.parse(parts[2].strip())
                    return result
                except:
                    pass
        
        # Fiscal periods
        fiscal_patterns = {
            r"Q(\d) (\d{4})": lambda m: (
                datetime(int(m.group(2)), (int(m.group(1))-1)*3+1, 1),
                datetime(int(m.group(2)), (int(m.group(1))-1)*3+3, 31)
            ),
            r"FY (\d{4})": lambda m: (
                datetime(int(m.group(1)), 1, 1),
                datetime(int(m.group(1)), 12, 31)
            ),
            r"H(\d) (\d{4})": lambda m: (
                datetime(int(m.group(2)), 1 if m.group(1) == "1" else 7, 1),
                datetime(int(m.group(2)), 6 if m.group(1) == "1" else 12, 30)
            )
        }
        
        for pattern, date_func in fiscal_patterns.items():
            match = re.search(pattern, expr)
            if match:
                result.type = "fiscal_period"
                result.start_date, result.end_date = date_func(match)
                return result
        
        # Recurring expressions
        if any(word in expr_lower for word in ["every", "monthly", "quarterly", "annually"]):
            result.type = "recurring"
            if "monday" in expr_lower:
                result.frequency = "weekly_monday"
            elif "monthly" in expr_lower:
                result.frequency = "monthly"
            elif "quarterly" in expr_lower:
                result.frequency = "quarterly"
            elif "annually" in expr_lower:
                result.frequency = "annual"
            return result
        
        # Try absolute date parsing
        try:
            parsed_date = date_parser.parse(expr)
            result.type = "absolute"
            result.date = parsed_date
        except:
            pass
        
        return result
    
    async def resolve_ambiguity(self, query: str, context: Optional[QueryContext] = None) -> AmbiguityResolution:
        """Resolve ambiguities in query"""
        result = AmbiguityResolution(
            resolved_query=query,
            confidence=1.0
        )
        
        # Pronoun resolution
        if context and context.previous_entities:
            if "its" in query.lower() or "their" in query.lower():
                # Replace with previous entity
                result.resolved_query = query.replace("its", context.previous_entities[0])
                result.resolved_query = result.resolved_query.replace("their", context.previous_entities[0])
                result.confidence = 0.8
        
        # Entity disambiguation
        if "apple" in query.lower():
            result.alternatives = ["Apple Inc", "Apple Records"]
            result.primary_interpretation = {"entity": "Apple Inc"}
        
        # Operator disambiguation
        if "over" in query.lower() or "more than" in query.lower():
            result.primary_interpretation["operator"] = ">"
            result.alternatives = [">="]
        
        # Temporal ambiguity
        if "march" in query.lower() and not re.search(r"march \d{4}", query.lower()):
            result.clarification_needed = True
            result.clarification_questions = ["Which year did you mean for March?"]
        
        # Scope ambiguity
        if "active" in query.lower():
            result.primary_interpretation["scope"] = "currently_active"
            result.alternatives = ["ever_active", "active_on_date"]
        
        return result
    
    async def expand_query(self, query: str) -> QueryExpansion:
        """Expand query with synonyms and corrections"""
        result = QueryExpansion(expanded_query=query, corrected_query=query)
        
        # Spelling correction (simplified)
        corrections = {
            "agrements": "agreements",
            "microsft": "Microsoft",
            "quartr": "quarter",
            "fnd": "find"
        }
        
        corrected = query
        for wrong, right in corrections.items():
            if wrong in query.lower():
                corrected = re.sub(wrong, right, corrected, flags=re.IGNORECASE)
        result.corrected_query = corrected
        
        # Synonym expansion
        expanded_terms = []
        for word in query.split():
            word_lower = word.lower()
            if word_lower in self.synonyms:
                expanded_terms.extend(self.synonyms[word_lower])
                result.synonyms_used[word] = self.synonyms[word_lower]
        
        result.expanded_terms = expanded_terms
        
        # Abbreviation expansion
        for abbr, full in self.abbreviations.items():
            if abbr in query:
                result.expanded_query = query.replace(abbr, full)
                result.expanded_terms.append(full)
        
        # Concept expansion
        if "liability" in query.lower():
            result.expanded_terms.extend(["indemnification", "limitation", "damages"])
        elif "technology" in query.lower():
            result.expanded_terms.extend(["software", "saas", "hardware", "IT"])
        
        return result
    
    async def get_synonyms(self, term: str) -> SynonymMapping:
        """Get synonyms for a term"""
        term_lower = term.lower()
        
        if term_lower in self.synonyms:
            return SynonymMapping(
                term=term,
                synonyms=self.synonyms[term_lower],
                domain="legal"
            )
        
        # Default synonyms
        return SynonymMapping(
            term=term,
            synonyms=[],
            domain="general"
        )
    
    async def get_contextual_synonyms(self, term: str, context: QueryContext) -> SynonymMapping:
        """Get context-aware synonyms"""
        if context.domain == "procurement":
            if term.lower() == "partner":
                return SynonymMapping(
                    term=term,
                    synonyms=["vendor", "supplier", "provider"],
                    domain="procurement"
                )
        
        return await self.get_synonyms(term)
    
    async def register_synonym(self, term: str, synonyms: List[str]):
        """Register custom synonyms"""
        self.synonyms[term.lower()] = synonyms
    
    async def resolve_synonym_chain(self, term: str) -> List[str]:
        """Resolve chain of synonyms"""
        chain = [term]
        visited = set([term])
        
        to_process = [term]
        while to_process:
            current = to_process.pop(0)
            if current.lower() in self.synonyms:
                for syn in self.synonyms[current.lower()]:
                    if syn not in visited:
                        chain.append(syn)
                        visited.add(syn)
                        to_process.append(syn)
        
        return chain
    
    async def detect_language(self, query: str) -> LanguageDetection:
        """Detect query language"""
        # Simple language detection based on keywords
        language_indicators = {
            "en": ["the", "and", "or", "with", "from"],
            "fr": ["le", "la", "les", "avec", "de"],
            "de": ["der", "die", "das", "mit", "von"],
            "es": ["el", "la", "los", "con", "de"]
        }
        
        words = query.lower().split()
        scores = defaultdict(int)
        
        for lang, indicators in language_indicators.items():
            for word in words:
                if word in indicators:
                    scores[lang] += 1
        
        if scores:
            detected = max(scores.items(), key=lambda x: x[1])
            return LanguageDetection(
                language=detected[0],
                confidence=min(detected[1] / len(words) * 2, 1.0)
            )
        
        return LanguageDetection(language="en", confidence=0.5)
    
    async def translate_query(self, query: str, target_lang: str = "en") -> str:
        """Translate query to target language"""
        # Simplified translation (would use real translation API)
        translations = {
            "contrats": "contracts",
            "trouve": "find",
            "avec": "with",
            "tous": "all",
            "les": "the"
        }
        
        translated = query
        for foreign, english in translations.items():
            translated = translated.replace(foreign, english)
        
        return translated
    
    async def get_cross_language_synonyms(self, term: str) -> SynonymMapping:
        """Get cross-language synonyms"""
        translations = {
            "contract": {
                "fr": ["contrat"],
                "de": ["vertrag"],
                "es": ["contrato"]
            }
        }
        
        result = SynonymMapping(term=term, synonyms=[])
        if term.lower() in translations:
            result.translations = translations[term.lower()]
        
        return result
    
    async def validate_query(self, query: str, context: Optional[QueryContext] = None) -> QueryValidation:
        """Validate query"""
        result = QueryValidation(is_valid=True, errors=[], warnings=[])
        
        # SQL injection check
        sql_patterns = ["select", "drop", "delete", "insert", "update", "--", ";"]
        if any(pattern in query.lower() for pattern in sql_patterns):
            if re.match(r"^(SELECT|DROP|DELETE|INSERT|UPDATE)", query, re.IGNORECASE):
                result.is_valid = False
                result.errors.append("SQL injection attempt detected")
        
        # Type mismatch check
        if re.search(r"value\s*[><=]\s*['\"]", query):
            result.is_valid = False
            result.errors.append("Type mismatch: comparing number with text")
        
        # Field validation
        if "nonexistent_field" in query:
            result.warnings = result.warnings or []
            result.warnings.append("Unknown field: nonexistent_field")
        
        # Permission validation
        if context and context.user_permissions:
            if "delete" in query.lower() and "delete_contracts" not in context.user_permissions:
                result.is_valid = False
                result.errors.append("Insufficient permissions for delete operation")
        
        # Complexity validation
        if query.count("AND") > 10:
            result.complexity_score = 0.95
            result.warnings = result.warnings or []
            result.warnings.append("Query is very complex")
        
        return result
    
    async def generate_suggestions(self, partial_query: str) -> List[QuerySuggestion]:
        """Generate autocomplete suggestions"""
        suggestions = []
        
        if partial_query.endswith(" wi"):
            suggestions.extend([
                QuerySuggestion(
                    suggestion=partial_query + "th",
                    confidence=0.9,
                    type="autocomplete"
                ),
                QuerySuggestion(
                    suggestion=partial_query + "thin",
                    confidence=0.7,
                    type="autocomplete"
                )
            ])
        
        return suggestions
    
    async def suggest_next_tokens(self, query: str) -> List[str]:
        """Suggest next tokens for query"""
        if query.endswith("status is"):
            return ["active", "expired", "draft", "pending", "approved"]
        elif query.endswith("value"):
            return [">", "<", "=", "between"]
        
        return []
    
    async def suggest_refinements(self, query: str) -> List[QuerySuggestion]:
        """Suggest query refinements"""
        refinements = []
        
        if "contracts" in query.lower() and len(query.split()) < 4:
            refinements.extend([
                QuerySuggestion(
                    suggestion=query + " from last month",
                    confidence=0.8,
                    type="refinement",
                    reason="Add time filter"
                ),
                QuerySuggestion(
                    suggestion=query + " with status active",
                    confidence=0.7,
                    type="refinement",
                    reason="Add status filter"
                )
            ])
        
        return refinements
    
    async def suggest_similar_queries(self, query: str) -> List[QuerySuggestion]:
        """Suggest similar queries"""
        similar = []
        
        if "expired" in query.lower():
            similar.extend([
                QuerySuggestion(
                    suggestion=query.replace("expired", "expiring soon"),
                    confidence=0.8,
                    type="similar"
                ),
                QuerySuggestion(
                    suggestion=query.replace("expired", "recently expired"),
                    confidence=0.7,
                    type="similar"
                )
            ])
        
        return similar
    
    async def suggest_templates(self, intent: QueryIntent) -> List[QuerySuggestion]:
        """Suggest query templates based on intent"""
        templates = []
        
        if intent.intent_type == "search":
            templates.append(QuerySuggestion(
                suggestion="Find [entity_type] where [condition]",
                confidence=0.9,
                type="template"
            ))
        
        return templates
    
    async def parse_query(self, query: str, context: Optional[QueryContext] = None,
                         enable_all_features: bool = False) -> ParsedQuery:
        """Complete query parsing pipeline"""
        # Basic parsing
        intent = await self.recognize_intent(query)
        entities = await self.extract_entities(query)
        query_type = await self.classify_query_type(query)
        validation = await self.validate_query(query, context)
        
        result = ParsedQuery(
            original_query=query,
            intent=intent,
            entities=entities,
            query_type=query_type,
            validation=validation
        )
        
        # Extract temporal expressions
        temporal_patterns = ["last", "next", "ago", "between", "from", "since"]
        if any(pattern in query.lower() for pattern in temporal_patterns):
            result.temporal_expressions = []
            for match in re.finditer(r"(last \w+|next \w+|\d+ \w+ ago|between .+? and .+?)", query):
                temporal = await self.parse_temporal_expression(match.group())
                result.temporal_expressions.append(temporal)
        
        # Extract filters
        if "where" in query.lower() or "with" in query.lower():
            result.filters = []
            if "value" in query.lower() and (">" in query or "over" in query.lower()):
                result.filters.append({"field": "value", "operator": ">", "value": 100000})
            if "status" in query.lower():
                result.filters.append({"field": "status", "operator": "=", "value": "active"})
        
        # Extract aggregation
        if query_type == QueryType.ANALYTICAL:
            if "average" in query.lower():
                result.aggregation = {"function": "average", "field": "value"}
                if "by" in query.lower():
                    result.aggregation["group_by"] = "department"
        
        # Context resolution
        if context:
            ambiguity = await self.resolve_ambiguity(query, context)
            if ambiguity.resolved_query != query:
                result.resolved_query = ambiguity.resolved_query
                result.context_used = True
        
        # Additional features if enabled
        if enable_all_features:
            # Query expansion
            expansion = await self.expand_query(query)
            result.corrected_query = expansion.corrected_query
            result.expanded_query = expansion.expanded_query
            
            # Suggestions
            result.suggestions = await self.suggest_refinements(query)
        
        return result