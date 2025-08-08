"""
Data models for Advanced Automation Systems
Contains all dataclasses used by Autonomous Contract Generation and Intelligent Review Automation
"""
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field

# Configuration classes
@dataclass
class GenerationConfig:
    ai_confidence_threshold: float = 0.8
    human_review_required: bool = True
    template_selection_criteria: List[str] = field(default_factory=lambda: ["risk_level", "jurisdiction", "industry"])
    optimization_level: str = "high"
    explanation_detail: str = "comprehensive"

@dataclass
class ReviewConfig:
    issue_detection_sensitivity: float = 0.7
    risk_scoring_model: str = "comprehensive"
    compliance_frameworks: List[str] = field(default_factory=lambda: ["gdpr", "ccpa", "sox"])
    market_comparison_enabled: bool = True
    escalation_thresholds: Dict[str, float] = field(default_factory=lambda: {"high_risk": 0.8, "compliance": 0.9})

# Generation result data classes
@dataclass
class ContractRequirements:
    contract_type: str
    complexity_level: str
    key_terms: Dict[str, Any]
    risk_factors: List[str]
    compliance_needs: List[str]
    confidence: float

@dataclass
class TemplateSelection:
    selected_template_id: str
    selection_rationale: str
    compatibility_score: float
    alternative_templates: List[Dict[str, Any]]
    customization_needed: List[str]

@dataclass
class OptimizedClause:
    clause_type: str
    original_text: str
    optimized_text: str
    optimization_rationale: str
    risk_improvement: float

@dataclass
class LanguageSelection:
    clause_type: str
    selected_language: str
    risk_appropriateness: str
    alternatives: List[Dict[str, Any]]
    jurisdiction_compliance: bool

@dataclass
class JurisdictionAdaptation:
    target_jurisdiction: str
    adaptations_made: List[Dict[str, Any]]
    compliance_verified: bool
    remaining_risks: List[str]
    adaptation_confidence: float

@dataclass
class BestPracticeApplication:
    industry: str
    applied_practices: List[Dict[str, Any]]
    practice_sources: List[str]
    implementation_confidence: float
    deviation_rationale: List[str]

@dataclass
class NegotiationEmbedding:
    embedded_positions: Dict[str, Any]
    strategy_alignment: str
    leverage_integration: List[str]
    flexibility_preserved: bool
    negotiation_readiness: float

@dataclass
class AlternativeStructure:
    structure_name: str
    structure_description: str
    advantages: List[str]
    disadvantages: List[str]
    implementation_complexity: str
    suitability_score: float

@dataclass
class GenerationExplanation:
    decision_summary: str
    key_choices: List[Dict[str, Any]]
    risk_trade_offs: List[str]
    confidence_factors: Dict[str, float]
    review_recommendations: List[str]

@dataclass
class ReviewTrigger:
    trigger_type: str
    severity: str
    description: str
    required_reviewer: str
    timeline: str

# Review result data classes
@dataclass
class SpottedIssue:
    issue_type: str
    severity: str
    location: str
    description: str
    recommended_action: str
    confidence: float

@dataclass
class RiskScore:
    category: str
    score: float
    contributing_factors: List[str]
    mitigation_suggestions: List[str]
    confidence_level: float

@dataclass
class ComplianceResult:
    framework: str
    compliance_status: str
    gaps_identified: List[str]
    remediation_steps: List[str]
    compliance_confidence: float

@dataclass
class MissingClause:
    clause_type: str
    importance: str
    suggested_text: str
    placement_location: str
    rationale: str

@dataclass
class DetectedInconsistency:
    inconsistency_type: str
    conflicting_sections: List[str]
    description: str
    resolution_suggestion: str
    impact_assessment: str

@dataclass
class MarketComparison:
    term_category: str
    our_position: str
    market_standard: str
    favorability: str
    negotiation_implications: List[str]

@dataclass
class PlaybookCompliance:
    playbook_section: str
    compliance_status: str
    deviations: List[str]
    approval_needed: bool
    risk_level: str

@dataclass
class GeneratedRecommendation:
    recommendation_type: str
    priority: str
    description: str
    implementation_effort: str
    risk_reduction: float
    business_impact: str

@dataclass
class PriorityRanking:
    item: str
    priority_score: float
    urgency_level: str
    effort_required: str
    business_impact: str
    rationale: str

@dataclass
class EscalationAlert:
    alert_type: str
    urgency: str
    recipient: str
    description: str
    required_action: str
    timeline: str

# Exception classes
class GenerationException(Exception):
    """Contract generation exception"""
    pass

class ReviewException(Exception):
    """Contract review exception"""
    pass