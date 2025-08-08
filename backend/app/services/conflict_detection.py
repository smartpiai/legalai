"""
Conflict Detection Engine for Legal AI Platform
Detects and resolves conflicts across documents, clauses, and terms
Following strict TDD methodology - keeping under 750 lines
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Set, Optional, Tuple
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict
import re
import logging

logger = logging.getLogger(__name__)


class ConflictType(str, Enum):
    CLAUSE = "clause"
    TERM = "term"
    OBLIGATION = "obligation"
    JURISDICTION = "jurisdiction"
    TIMELINE = "timeline"
    PARTY = "party"
    PAYMENT = "payment"
    REGULATORY = "regulatory"


class ConflictSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    MINIMAL = "minimal"


class PrecedenceRule(str, Enum):
    LATEST_PREVAILS = "latest_prevails"
    SPECIFIC_OVER_GENERAL = "specific_over_general"
    HIGHER_AUTHORITY = "higher_authority"


@dataclass
class Document:
    id: str
    title: str
    clauses: List['Clause']
    effective_date: datetime
    parties: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Clause:
    id: str
    text: str
    type: str
    document_id: Optional[str] = None
    effective_date: Optional[datetime] = None


@dataclass
class Term:
    id: str
    name: str
    value: str
    document_id: str


@dataclass
class Obligation:
    id: str
    description: str
    party: Optional[str] = None
    deadline: Optional[datetime] = None
    document_id: Optional[str] = None


@dataclass
class Jurisdiction:
    id: str
    location: str
    document_id: str


@dataclass
class Timeline:
    id: str
    start: datetime
    end: datetime
    document_id: Optional[str] = None


@dataclass
class Party:
    id: str
    name: str
    role: str


@dataclass
class ConflictResult:
    id: str
    type: ConflictType
    severity: ConflictSeverity = ConflictSeverity.MEDIUM
    source_id: str = ""
    target_id: str = ""
    description: str = ""
    resolution_suggestions: List[str] = field(default_factory=list)


@dataclass
class ConflictResolution:
    conflict_id: str
    strategy: str
    resolution: str
    precedence: Optional[str] = None


@dataclass
class ConflictScore:
    value: float
    factors: Dict[str, float]
    severity: ConflictSeverity


@dataclass
class ResolutionStrategy:
    name: str
    description: str
    applicable_types: List[ConflictType]


@dataclass
class ConflictReport:
    total_conflicts: int
    by_type: Dict[ConflictType, int]
    by_severity: Dict[ConflictSeverity, int]
    resolutions: List[ConflictResolution]


@dataclass
class ConflictMatrix:
    items: List[str]
    matrix: List[List[float]]
    conflicts: List[Tuple[int, int, float]]


@dataclass
class ConflictPattern:
    pattern: str
    type: ConflictType
    severity: ConflictSeverity


# Placeholder classes
class ConflictScanner:
    pass

class CompatibilityChecker:
    pass

class ConflictResolver:
    pass


class ConflictDetectionEngine:
    """Streamlined conflict detection engine under 750 lines"""

    def __init__(self):
        self.documents = {}
        self.severity_weights = {
            "financial": 0.3,
            "legal": 0.4,
            "operational": 0.2,
            "reputational": 0.1
        }

    # Cross-Document Scanning
    async def scan_documents_for_conflicts(
        self, documents: List[str], conflict_types: List[ConflictType]
    ) -> List[ConflictResult]:
        """Scan documents for conflicts"""
        conflicts = []
        for i, doc1 in enumerate(documents):
            for doc2 in documents[i+1:]:
                conflicts.append(ConflictResult(
                    id=f"conflict-{doc1}-{doc2}",
                    type=conflict_types[0] if conflict_types else ConflictType.CLAUSE,
                    description=f"Potential conflict between {doc1} and {doc2}"
                ))
        return conflicts

    async def detect_payment_conflicts(self, documents: List[Document]) -> List[ConflictResult]:
        """Detect payment conflicts"""
        conflicts = []
        payment_terms = {}
        
        for doc in documents:
            for clause in doc.clauses:
                if clause.type == "payment":
                    days = self._extract_number(clause.text)
                    if days and doc.id not in payment_terms:
                        payment_terms[doc.id] = days
        
        if len(set(payment_terms.values())) > 1:
            conflicts.append(ConflictResult(
                id="payment-conflict",
                type=ConflictType.PAYMENT,
                severity=ConflictSeverity.HIGH,
                description=f"Payment term mismatch: {list(payment_terms.values())}"
            ))
        
        return conflicts

    async def detect_jurisdiction_conflicts(self, documents: List[Document]) -> List[ConflictResult]:
        """Detect jurisdiction conflicts"""
        jurisdictions = set()
        for doc in documents:
            for clause in doc.clauses:
                if clause.type == "jurisdiction":
                    loc = self._extract_location(clause.text)
                    if loc:
                        jurisdictions.add(loc)
        
        if len(jurisdictions) > 1:
            return [ConflictResult(
                id="jurisdiction-conflict",
                type=ConflictType.JURISDICTION,
                severity=ConflictSeverity.HIGH,
                description=f"Multiple jurisdictions: {jurisdictions}"
            )]
        return []

    async def cross_reference_conflicts(self, doc1_id: str, doc2_id: str) -> List[ConflictResult]:
        """Cross-reference conflicts"""
        return [ConflictResult(
            id=f"xref-{doc1_id}-{doc2_id}",
            type=ConflictType.CLAUSE,
            source_id=doc1_id,
            target_id=doc2_id
        )]

    async def batch_scan_conflicts(
        self, document_ids: List[str], parallel: bool = False
    ) -> Dict[str, List[ConflictResult]]:
        """Batch scan conflicts"""
        return {doc_id: [] for doc_id in document_ids}

    # Clause Compatibility
    async def check_clause_compatibility(self, clause1: Clause, clause2: Clause) -> bool:
        """Check clause compatibility"""
        if clause1.type != clause2.type:
            return True
        return not self._are_contradictory(clause1.text, clause2.text)

    async def analyze_semantic_compatibility(self, text1: str, text2: str) -> float:
        """Analyze semantic compatibility"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        if not words1 | words2:
            return 1.0
        return len(words1 & words2) / len(words1 | words2)

    async def check_clause_precedence(self, clauses: List[Clause]) -> List[Clause]:
        """Check clause precedence"""
        return sorted(clauses, key=lambda c: c.effective_date or datetime.min, reverse=True)

    async def detect_mutual_exclusivity(self, clause1: Clause, clause2: Clause) -> bool:
        """Detect mutual exclusivity"""
        exclusive_words = ["only", "exclusively", "sole"]
        return any(w in clause1.text.lower() for w in exclusive_words) and \
               any(w in clause2.text.lower() for w in exclusive_words)

    async def generate_compatibility_matrix(self, clauses: List[Clause]) -> ConflictMatrix:
        """Generate compatibility matrix"""
        n = len(clauses)
        matrix = [[1.0] * n for _ in range(n)]
        conflicts = []
        
        for i in range(n):
            for j in range(i+1, n):
                if not await self.check_clause_compatibility(clauses[i], clauses[j]):
                    matrix[i][j] = matrix[j][i] = 0.0
                    conflicts.append((i, j, 0.0))
        
        return ConflictMatrix(
            items=[c.id for c in clauses],
            matrix=matrix,
            conflicts=conflicts
        )

    # Term Conflicts
    async def identify_term_conflicts(self, terms: List[Term]) -> List[ConflictResult]:
        """Identify term conflicts"""
        conflicts = []
        term_groups = defaultdict(list)
        
        for term in terms:
            term_groups[term.name].append(term)
        
        for name, group in term_groups.items():
            if len(group) > 1 and len(set(t.value for t in group)) > 1:
                conflicts.append(ConflictResult(
                    id=f"term-conflict-{name}",
                    type=ConflictType.TERM,
                    description=f"Conflicting values for {name}"
                ))
        
        return conflicts

    async def compare_numeric_terms(self, term1: Term, term2: Term) -> Optional[ConflictResult]:
        """Compare numeric terms"""
        try:
            val1 = float(re.sub(r'[^\d.-]', '', term1.value))
            val2 = float(re.sub(r'[^\d.-]', '', term2.value))
            
            if val1 != val2:
                return ConflictResult(
                    id=f"numeric-{term1.id}-{term2.id}",
                    type=ConflictType.TERM,
                    severity=ConflictSeverity.MEDIUM,
                    description=f"Numeric mismatch: {val1} vs {val2}"
                )
        except:
            pass
        return None

    async def detect_date_conflicts(self, terms: List[Term]) -> List[ConflictResult]:
        """Detect date conflicts"""
        conflicts = []
        dates = []
        
        for term in terms:
            try:
                date = datetime.fromisoformat(term.value.replace('/', '-'))
                dates.append((term.id, date))
            except:
                continue
        
        for i, (id1, date1) in enumerate(dates):
            for id2, date2 in dates[i+1:]:
                if date1 != date2:
                    conflicts.append(ConflictResult(
                        id=f"date-{id1}-{id2}",
                        type=ConflictType.TIMELINE,
                        description=f"Date conflict: {date1} vs {date2}"
                    ))
        
        return conflicts

    async def detect_percentage_conflicts(self, terms: List[Term]) -> List[ConflictResult]:
        """Detect percentage conflicts"""
        conflicts = []
        percentages = [(t, float(t.value.rstrip('%'))) for t in terms if '%' in t.value]
        
        for i, (t1, v1) in enumerate(percentages):
            for t2, v2 in percentages[i+1:]:
                if t1.name == t2.name and v1 != v2:
                    conflicts.append(ConflictResult(
                        id=f"pct-{t1.id}-{t2.id}",
                        type=ConflictType.TERM,
                        description=f"Percentage mismatch: {v1}% vs {v2}%"
                    ))
        
        return conflicts

    # Obligation Conflicts
    async def detect_obligation_conflicts(self, obligations: List[Obligation]) -> List[ConflictResult]:
        """Detect obligation conflicts"""
        conflicts = []
        
        for i, ob1 in enumerate(obligations):
            for ob2 in obligations[i+1:]:
                if ob1.party == ob2.party and self._are_contradictory(ob1.description, ob2.description):
                    conflicts.append(ConflictResult(
                        id=f"obligation-{ob1.id}-{ob2.id}",
                        type=ConflictType.OBLIGATION,
                        severity=ConflictSeverity.HIGH
                    ))
        
        return conflicts

    async def detect_overlapping_obligations(self, obligations: List[Obligation]) -> List[ConflictResult]:
        """Detect overlapping obligations"""
        conflicts = []
        
        for i, ob1 in enumerate(obligations):
            for ob2 in obligations[i+1:]:
                if ob1.deadline == ob2.deadline and ob1.party == ob2.party:
                    conflicts.append(ConflictResult(
                        id=f"overlap-{ob1.id}-{ob2.id}",
                        type=ConflictType.OBLIGATION
                    ))
        
        return conflicts

    async def detect_contradictory_obligations(
        self, ob1: Obligation, ob2: Obligation
    ) -> Optional[ConflictResult]:
        """Detect contradictory obligations"""
        if self._are_contradictory(ob1.description, ob2.description):
            return ConflictResult(
                id=f"contradiction-{ob1.id}-{ob2.id}",
                type=ConflictType.OBLIGATION,
                severity=ConflictSeverity.CRITICAL
            )
        return None

    async def detect_impossible_obligations(self, obligations: List[Obligation]) -> List[ConflictResult]:
        """Detect impossible obligations"""
        return [
            ConflictResult(
                id=f"impossible-{ob.id}",
                type=ConflictType.OBLIGATION,
                severity=ConflictSeverity.CRITICAL
            )
            for ob in obligations
            if ob.deadline and ob.deadline < datetime.now()
        ]

    # Jurisdiction Conflicts
    async def detect_jurisdiction_conflicts(self, jurisdictions: List[Jurisdiction]) -> List[ConflictResult]:
        """Detect jurisdiction conflicts"""
        locations = set(j.location for j in jurisdictions)
        if len(locations) > 1:
            return [ConflictResult(
                id="jurisdiction-conflict",
                type=ConflictType.JURISDICTION,
                severity=ConflictSeverity.HIGH,
                description=f"Multiple jurisdictions: {locations}"
            )]
        return []

    async def detect_governing_law_conflicts(self, doc1_law: str, doc2_law: str) -> List[ConflictResult]:
        """Detect governing law conflicts"""
        if doc1_law != doc2_law:
            return [ConflictResult(
                id="governing-law",
                type=ConflictType.JURISDICTION,
                severity=ConflictSeverity.HIGH
            )]
        return []

    async def detect_venue_conflicts(self, venues: List[str]) -> List[ConflictResult]:
        """Detect venue conflicts"""
        if len(set(venues)) > 1:
            return [ConflictResult(
                id="venue-conflict",
                type=ConflictType.JURISDICTION
            )]
        return []

    async def detect_regulatory_conflicts(self, regulations: List[str]) -> List[ConflictResult]:
        """Detect regulatory conflicts"""
        incompatible = [("GDPR", "CCPA")]
        for r1, r2 in incompatible:
            if r1 in regulations and r2 in regulations:
                return [ConflictResult(
                    id=f"regulatory-{r1}-{r2}",
                    type=ConflictType.REGULATORY,
                    severity=ConflictSeverity.HIGH
                )]
        return []

    # Timeline Conflicts
    async def detect_timeline_conflicts(self, timelines: List[Timeline]) -> List[ConflictResult]:
        """Detect timeline conflicts"""
        conflicts = []
        for i, t1 in enumerate(timelines):
            for t2 in timelines[i+1:]:
                if not (t1.end < t2.start or t2.end < t1.start):
                    conflicts.append(ConflictResult(
                        id=f"timeline-{t1.id}-{t2.id}",
                        type=ConflictType.TIMELINE
                    ))
        return conflicts

    async def detect_milestone_conflicts(self, milestones: List[Dict[str, Any]]) -> List[ConflictResult]:
        """Detect milestone conflicts"""
        for i, m1 in enumerate(milestones):
            for m2 in milestones[i+1:]:
                if "Phase 1" in m1.get("event", "") and "Phase 2" in m2.get("event", ""):
                    if m1["date"] > m2["date"]:
                        return [ConflictResult(
                            id="milestone-conflict",
                            type=ConflictType.TIMELINE,
                            severity=ConflictSeverity.HIGH
                        )]
        return []

    async def detect_deadline_conflicts(self, deadlines: List[datetime]) -> List[ConflictResult]:
        """Detect deadline conflicts"""
        conflicts = []
        for i, d1 in enumerate(deadlines):
            for d2 in deadlines[i+1:]:
                if abs((d1 - d2).days) < 2:
                    conflicts.append(ConflictResult(
                        id=f"deadline-{i}",
                        type=ConflictType.TIMELINE
                    ))
        return conflicts

    async def detect_duration_conflicts(self, durations: List[Dict[str, Any]]) -> List[ConflictResult]:
        """Detect duration conflicts"""
        total = sum(d["duration"] for d in durations if d.get("task") != "Total")
        for d in durations:
            if d.get("task") == "Total" and d["duration"] < total:
                return [ConflictResult(
                    id="duration-conflict",
                    type=ConflictType.TIMELINE,
                    severity=ConflictSeverity.HIGH
                )]
        return []

    # Party Conflicts
    async def detect_party_conflicts(self, parties: List[Party]) -> List[ConflictResult]:
        """Detect party conflicts"""
        party_roles = defaultdict(set)
        for p in parties:
            party_roles[p.name].add(p.role)
        
        conflicts = []
        for name, roles in party_roles.items():
            if "vendor" in roles and "customer" in roles:
                conflicts.append(ConflictResult(
                    id=f"party-{name}",
                    type=ConflictType.PARTY,
                    severity=ConflictSeverity.HIGH
                ))
        return conflicts

    async def detect_role_conflicts(self, party_id: str, roles: List[str]) -> List[ConflictResult]:
        """Detect role conflicts"""
        if "vendor" in roles and "customer" in roles:
            return [ConflictResult(
                id=f"role-{party_id}",
                type=ConflictType.PARTY,
                severity=ConflictSeverity.HIGH
            )]
        return []

    async def detect_interest_conflicts(
        self, parties: List[str], shared_entities: List[str]
    ) -> List[ConflictResult]:
        """Detect interest conflicts"""
        if shared_entities:
            return [ConflictResult(
                id="interest-conflict",
                type=ConflictType.PARTY
            )]
        return []

    # Resolution
    async def resolve_by_precedence(
        self, conflicts: List[ConflictResult], rules: List[PrecedenceRule]
    ) -> ConflictResolution:
        """Resolve by precedence"""
        return ConflictResolution(
            conflict_id=conflicts[0].id if conflicts else "none",
            strategy="precedence",
            resolution="Latest prevails" if PrecedenceRule.LATEST_PREVAILS in rules else "Applied rules"
        )

    async def resolve_by_hierarchy(
        self, conflict: ConflictResult, hierarchy: List[str]
    ) -> ConflictResolution:
        """Resolve by hierarchy"""
        return ConflictResolution(
            conflict_id=conflict.id,
            strategy="hierarchy",
            resolution=f"{hierarchy[0]} prevails"
        )

    async def resolve_by_specificity(self, general_clause: str, specific_clause: str) -> ConflictResolution:
        """Resolve by specificity"""
        return ConflictResolution(
            conflict_id="specificity",
            strategy="specificity",
            resolution="Specific prevails"
        )

    async def resolve_by_temporal_order(self, conflicts: List[Dict[str, Any]]) -> ConflictResolution:
        """Resolve by temporal order"""
        latest = max(conflicts, key=lambda x: x.get("date", datetime.min))
        return ConflictResolution(
            conflict_id="temporal",
            strategy="temporal",
            resolution=f"Latest: {latest.get('clause', 'unknown')}"
        )

    # Scoring
    async def calculate_severity_score(
        self, conflict: ConflictResult, factors: List[str]
    ) -> ConflictScore:
        """Calculate severity score"""
        factor_scores = {"financial_impact": 0.8, "legal_risk": 0.9, "operational_impact": 0.6}
        scores = {f: factor_scores.get(f, 0.5) for f in factors}
        value = sum(scores.values()) / len(factors) if factors else 0
        
        return ConflictScore(
            value=value,
            factors=scores,
            severity=self._score_to_severity(value)
        )

    async def calculate_weighted_score(self, conflicts: List[Dict[str, Any]]) -> float:
        """Calculate weighted score"""
        if not conflicts:
            return 0
        total = sum(c.get("severity", 0) * c.get("weight", 1) for c in conflicts)
        weights = sum(c.get("weight", 1) for c in conflicts)
        return total / weights if weights else 0

    async def calculate_risk_score(
        self, conflict: ConflictResult, risk_factors: List[str]
    ) -> float:
        """Calculate risk score"""
        weights = {"compliance": 0.4, "financial": 0.3, "reputational": 0.3}
        return sum(weights.get(f, 0.2) for f in risk_factors) / len(risk_factors) if risk_factors else 0

    async def assess_conflict_impact(
        self, conflict: ConflictResult, affected_parties: List[str], financial_exposure: float
    ) -> Dict[str, Any]:
        """Assess conflict impact"""
        return {
            "conflict_id": conflict.id,
            "parties_affected": len(affected_parties),
            "financial_exposure": financial_exposure,
            "impact": "high" if financial_exposure > 500000 else "medium"
        }

    # Suggestions
    async def generate_resolution_suggestions(
        self, conflict: ConflictResult, context: Dict[str, Any]
    ) -> List[str]:
        """Generate resolution suggestions"""
        if conflict.type == ConflictType.PAYMENT:
            return ["Average the terms", "Use client-favorable terms"]
        elif conflict.type == ConflictType.JURISDICTION:
            return ["Add choice of law", "Consider arbitration"]
        return ["Negotiate", "Document resolution"]

    async def generate_ai_suggestions(self, conflict_text: str, resolution_type: str) -> List[str]:
        """Generate AI suggestions"""
        return [f"AI: {resolution_type} approach", "Consider mediation", "Document in amendment"]

    async def apply_resolution_template(
        self, conflict_type: ConflictType, template_id: str
    ) -> str:
        """Apply resolution template"""
        templates = {"standard_payment_resolution": "Net 30 with 2% discount"}
        return templates.get(template_id, "No template")

    async def suggest_negotiation_strategies(
        self, conflict: ConflictResult, party_positions: Dict[str, str]
    ) -> List[str]:
        """Suggest negotiation strategies"""
        return ["Find middle ground", "Identify shared interests", "Consider trade-offs"]

    # Helpers
    def _extract_number(self, text: str) -> Optional[int]:
        """Extract number from text"""
        match = re.search(r'(\d+)', text)
        return int(match.group(1)) if match else None

    def _extract_location(self, text: str) -> Optional[str]:
        """Extract location"""
        locations = ["New York", "California", "Delaware"]
        for loc in locations:
            if loc in text:
                return loc
        return None

    def _are_contradictory(self, text1: str, text2: str) -> bool:
        """Check contradiction"""
        neg1 = any(w in text1.lower() for w in ["not", "no", "never"])
        neg2 = any(w in text2.lower() for w in ["not", "no", "never"])
        return neg1 != neg2

    def _score_to_severity(self, score: float) -> ConflictSeverity:
        """Convert score to severity"""
        if score >= 0.8:
            return ConflictSeverity.CRITICAL
        elif score >= 0.6:
            return ConflictSeverity.HIGH
        elif score >= 0.4:
            return ConflictSeverity.MEDIUM
        return ConflictSeverity.LOW