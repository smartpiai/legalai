"""
Intelligent Review Automation Engine
Implements automated contract review, issue detection, and compliance checking
Following strict TDD methodology - keeping under 750 lines
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple, Union
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict
import asyncio
import logging
import re

from .autonomous_contract_generation import (
    ReviewConfig, SpottedIssue, RiskScore, ComplianceResult, 
    MissingClause, DetectedInconsistency, MarketComparison,
    PlaybookCompliance, GeneratedRecommendation, PriorityRanking,
    EscalationAlert, ReviewException
)

logger = logging.getLogger(__name__)


class IntelligentReviewEngine:
    """Advanced intelligent contract review automation"""
    
    def __init__(self, config: ReviewConfig):
        self.config = config
        self.issue_models = {}
        self.compliance_frameworks = {}
        self.market_data = {}
    
    async def spot_issues_automatically(self, contract_text: str, issue_detection_models: List[str],
                                       detection_sensitivity: float, context: Dict[str, Any]) -> List[SpottedIssue]:
        """Automatically spot issues in contract text"""
        issues = []
        
        # Legal risk detection
        if "legal_risk" in issue_detection_models:
            # Look for unlimited liability
            if "unlimited liability" in contract_text.lower() or "liability shall not be limited" in contract_text.lower():
                issues.append(SpottedIssue(
                    issue_type="unlimited_liability",
                    severity="high",
                    location="liability_section",
                    description="Contract contains unlimited liability provisions",
                    recommended_action="Add liability caps or limitations",
                    confidence=0.9
                ))
            
            # Missing termination rights
            if "terminat" not in contract_text.lower():
                issues.append(SpottedIssue(
                    issue_type="missing_termination_clause",
                    severity="medium",
                    location="general_provisions",
                    description="No termination provisions found",
                    recommended_action="Add termination clause with appropriate notice periods",
                    confidence=0.8
                ))
        
        # Compliance risk detection
        if "compliance_risk" in issue_detection_models:
            jurisdiction = context.get("jurisdiction", "").lower()
            if jurisdiction == "california" and "personal information" in contract_text.lower():
                if "ccpa" not in contract_text.lower():
                    issues.append(SpottedIssue(
                        issue_type="ccpa_compliance_gap",
                        severity="high",
                        location="data_protection_section",
                        description="California contract handling personal information without CCPA provisions",
                        recommended_action="Add CCPA compliance clauses",
                        confidence=0.85
                    ))
        
        # Business risk detection
        if "business_risk" in issue_detection_models:
            contract_value = context.get("value", 0)
            if contract_value > 1000000 and "insurance" not in contract_text.lower():
                issues.append(SpottedIssue(
                    issue_type="missing_insurance_requirements",
                    severity="medium",
                    location="risk_management_section",
                    description="High-value contract without insurance requirements",
                    recommended_action="Add professional liability and general liability insurance requirements",
                    confidence=0.75
                ))
        
        return issues
    
    async def automate_risk_scoring(self, contract_clauses: List[Dict[str, str]], 
                                   risk_models: Dict[str, str], context_factors: Dict[str, Any]) -> List[RiskScore]:
        """Automate risk scoring for contract clauses"""
        risk_scores = []
        
        for clause in contract_clauses:
            clause_type = clause["type"]
            clause_text = clause["text"]
            
            if clause_type == "limitation_of_liability":
                # Analyze liability limitations
                if "annual fees" in clause_text.lower():
                    score = 0.3  # Low risk - reasonable cap
                    contributing_factors = ["reasonable_liability_cap", "annual_fee_limitation"]
                    mitigation_suggestions = ["Consider adding mutual liability caps"]
                elif "unlimited" in clause_text.lower():
                    score = 0.9  # High risk - unlimited liability
                    contributing_factors = ["unlimited_liability_exposure", "high_financial_risk"]
                    mitigation_suggestions = ["Add liability caps immediately", "Consider mutual limitations"]
                else:
                    score = 0.6  # Medium risk - unclear limitations
                    contributing_factors = ["unclear_liability_terms", "potential_disputes"]
                    mitigation_suggestions = ["Clarify liability limitations", "Add specific caps"]
                
                risk_scores.append(RiskScore(
                    category=clause_type,
                    score=score,
                    contributing_factors=contributing_factors,
                    mitigation_suggestions=mitigation_suggestions,
                    confidence_level=0.85
                ))
            
            elif clause_type == "intellectual_property":
                # Analyze IP clauses
                if "client" in clause_text.lower() and "owns" in clause_text.lower():
                    score = 0.2  # Low risk - clear ownership
                    contributing_factors = ["clear_ip_ownership", "client_protection"]
                    mitigation_suggestions = ["Ensure work-for-hire provisions are included"]
                elif "jointly owned" in clause_text.lower():
                    score = 0.7  # High risk - joint ownership complexity
                    contributing_factors = ["joint_ownership_complexity", "licensing_disputes"]
                    mitigation_suggestions = ["Define usage rights clearly", "Add licensing provisions"]
                else:
                    score = 0.5  # Medium risk - unclear IP terms
                    contributing_factors = ["unclear_ip_terms", "potential_ownership_disputes"]
                    mitigation_suggestions = ["Clarify IP ownership", "Add comprehensive IP clauses"]
                
                risk_scores.append(RiskScore(
                    category=clause_type,
                    score=score,
                    contributing_factors=contributing_factors,
                    mitigation_suggestions=mitigation_suggestions,
                    confidence_level=0.8
                ))
        
        return risk_scores
    
    async def check_compliance_automatically(self, contract_document: str, 
                                           compliance_frameworks: List[str],
                                           jurisdiction_requirements: Dict[str, List[str]],
                                           industry_standards: Dict[str, List[str]]) -> List[ComplianceResult]:
        """Automatically check compliance against various frameworks"""
        compliance_results = []
        
        for framework in compliance_frameworks:
            if framework.lower() == "gdpr":
                compliance_status = "partial"
                gaps_identified = []
                remediation_steps = []
                
                # Check for GDPR provisions
                if "personal data" not in contract_document.lower() and "gdpr" not in contract_document.lower():
                    gaps_identified.append("Missing GDPR personal data handling provisions")
                    remediation_steps.append("Add GDPR compliance clauses")
                
                if "data controller" not in contract_document.lower():
                    gaps_identified.append("Unclear data controller/processor responsibilities")
                    remediation_steps.append("Define data controller and processor roles")
                
                if "data breach" not in contract_document.lower():
                    gaps_identified.append("Missing data breach notification procedures")
                    remediation_steps.append("Add breach notification requirements")
                
                compliance_status = "compliant" if not gaps_identified else "non_compliant" if len(gaps_identified) > 2 else "partial"
                
                compliance_results.append(ComplianceResult(
                    framework="gdpr",
                    compliance_status=compliance_status,
                    gaps_identified=gaps_identified,
                    remediation_steps=remediation_steps,
                    compliance_confidence=0.8
                ))
            
            elif framework.lower() == "ccpa":
                compliance_status = "partial"
                gaps_identified = []
                remediation_steps = []
                
                if "california" in contract_document.lower() or "personal information" in contract_document.lower():
                    if "ccpa" not in contract_document.lower():
                        gaps_identified.append("Missing CCPA compliance provisions")
                        remediation_steps.append("Add California Consumer Privacy Act compliance")
                    
                    if "right to delete" not in contract_document.lower():
                        gaps_identified.append("Missing consumer rights provisions")
                        remediation_steps.append("Add consumer privacy rights clauses")
                
                compliance_status = "compliant" if not gaps_identified else "non_compliant"
                
                compliance_results.append(ComplianceResult(
                    framework="ccpa",
                    compliance_status=compliance_status,
                    gaps_identified=gaps_identified,
                    remediation_steps=remediation_steps,
                    compliance_confidence=0.75
                ))
        
        return compliance_results
    
    async def detect_missing_clauses(self, contract_text: str, contract_type: str,
                                   required_clauses_checklist: List[str],
                                   context: Dict[str, Any]) -> List[MissingClause]:
        """Detect missing essential clauses"""
        missing_clauses = []
        
        for required_clause in required_clauses_checklist:
            clause_found = False
            
            if required_clause == "intellectual_property_ownership":
                if "intellectual property" in contract_text.lower() or "ip" in contract_text.lower():
                    clause_found = True
                if not clause_found:
                    missing_clauses.append(MissingClause(
                        clause_type="intellectual_property_ownership",
                        importance="high",
                        suggested_text="All intellectual property created under this Agreement shall be owned by Client.",
                        placement_location="definitions_or_ownership_section",
                        rationale="Essential for protecting client's IP rights and avoiding disputes"
                    ))
            
            elif required_clause == "limitation_of_liability":
                if "liability" in contract_text.lower() and ("limited" in contract_text.lower() or "cap" in contract_text.lower()):
                    clause_found = True
                if not clause_found:
                    missing_clauses.append(MissingClause(
                        clause_type="limitation_of_liability",
                        importance="critical",
                        suggested_text="Each party's liability shall be limited to direct damages not exceeding the annual fees paid under this Agreement.",
                        placement_location="risk_allocation_section",
                        rationale="Critical for limiting financial exposure and risk management"
                    ))
            
            elif required_clause == "termination_rights":
                if "terminat" in contract_text.lower() or "end" in contract_text.lower():
                    clause_found = True
                if not clause_found:
                    missing_clauses.append(MissingClause(
                        clause_type="termination_rights",
                        importance="high",
                        suggested_text="Either party may terminate this Agreement for cause with thirty (30) days written notice.",
                        placement_location="term_and_termination_section",
                        rationale="Provides exit flexibility and protection for both parties"
                    ))
            
            elif required_clause == "data_protection":
                if "data protection" in contract_text.lower() or "confidential" in contract_text.lower():
                    clause_found = True
                if not clause_found and context.get("jurisdiction") in ["california", "eu"]:
                    missing_clauses.append(MissingClause(
                        clause_type="data_protection",
                        importance="critical",
                        suggested_text="Contractor shall implement appropriate security measures to protect personal data in accordance with applicable privacy laws.",
                        placement_location="data_handling_section",
                        rationale="Required for compliance with privacy regulations"
                    ))
            
            elif required_clause == "dispute_resolution":
                if "dispute" in contract_text.lower() or "arbitration" in contract_text.lower() or "mediation" in contract_text.lower():
                    clause_found = True
                if not clause_found:
                    missing_clauses.append(MissingClause(
                        clause_type="dispute_resolution",
                        importance="medium",
                        suggested_text="Any disputes shall be resolved through binding arbitration in accordance with applicable arbitration rules.",
                        placement_location="dispute_resolution_section",
                        rationale="Provides structured process for resolving disagreements"
                    ))
        
        return missing_clauses
    
    async def identify_inconsistencies(self, contract_sections: List[Dict[str, str]],
                                     inconsistency_types: List[str],
                                     analysis_depth: str) -> List[DetectedInconsistency]:
        """Identify inconsistencies within contract sections"""
        inconsistencies = []
        
        # Extract dates and timelines for consistency checking
        date_patterns = {}
        for section in contract_sections:
            section_name = section["section"]
            section_text = section["text"]
            
            # Look for date patterns
            date_matches = re.findall(r'(\d+)\s*days?', section_text.lower())
            if date_matches:
                date_patterns[section_name] = [int(d) for d in date_matches]
        
        # Check for conflicting dates
        if "conflicting_dates" in inconsistency_types:
            payment_days = date_patterns.get("payment_terms", [])
            late_fee_days = date_patterns.get("late_fees", [])
            
            if payment_days and late_fee_days:
                payment_period = max(payment_days) if payment_days else 0
                late_fee_period = min(late_fee_days) if late_fee_days else 0
                
                if late_fee_period < payment_period:
                    inconsistencies.append(DetectedInconsistency(
                        inconsistency_type="conflicting_dates",
                        conflicting_sections=["payment_terms", "late_fees"],
                        description=f"Late fees apply after {late_fee_period} days but payment is due in {payment_period} days",
                        resolution_suggestion="Align late fee timeline with payment due date",
                        impact_assessment="Could create confusion and disputes over payment obligations"
                    ))
        
        # Check for contradictory obligations
        if "contradictory_obligations" in inconsistency_types:
            termination_notice = date_patterns.get("termination", [])
            final_payment = date_patterns.get("final_payment", [])
            
            if termination_notice and final_payment:
                termination_days = max(termination_notice) if termination_notice else 0
                final_payment_days = max(final_payment) if final_payment else 0
                
                if final_payment_days < termination_days:
                    inconsistencies.append(DetectedInconsistency(
                        inconsistency_type="contradictory_obligations",
                        conflicting_sections=["termination", "final_payment"],
                        description=f"Final payment required in {final_payment_days} days but termination notice is {termination_days} days",
                        resolution_suggestion="Adjust final payment timeline to allow for termination notice period",
                        impact_assessment="Creates practical impossibility in contract performance"
                    ))
        
        return inconsistencies
    
    async def compare_with_market_standards(self, contract_terms: Dict[str, str], industry: str,
                                          contract_type: str, market_data_sources: List[str],
                                          comparison_criteria: List[str]) -> List[MarketComparison]:
        """Compare contract terms with market standards"""
        market_comparisons = []
        
        # Market standard data (simplified for implementation)
        market_standards = {
            "technology": {
                "payment_terms": {"standard": "net_30", "range": ["net_15", "net_45"]},
                "liability_cap": {"standard": "annual_fees", "range": ["contract_value", "direct_damages"]},
                "warranty_period": {"standard": "12_months", "range": ["6_months", "24_months"]},
                "termination_notice": {"standard": "30_days", "range": ["15_days", "60_days"]}
            }
        }
        
        industry_standards = market_standards.get(industry.lower(), market_standards["technology"])
        
        for term_category, our_position in contract_terms.items():
            if term_category in industry_standards:
                market_standard = industry_standards[term_category]["standard"]
                standard_range = industry_standards[term_category]["range"]
                
                # Determine favorability
                if our_position == market_standard:
                    favorability = "market_standard"
                elif our_position in standard_range:
                    position_index = standard_range.index(our_position) if our_position in standard_range else 1
                    favorability = "favorable" if position_index == 0 else "less_favorable"
                else:
                    favorability = "non_standard"
                
                # Generate negotiation implications
                negotiation_implications = []
                if favorability == "favorable":
                    negotiation_implications.append("Strong negotiating position - terms favor our interests")
                elif favorability == "less_favorable":
                    negotiation_implications.append("Room for improvement - could negotiate better terms")
                elif favorability == "non_standard":
                    negotiation_implications.append("Non-standard terms may require additional justification")
                
                market_comparisons.append(MarketComparison(
                    term_category=term_category,
                    our_position=our_position,
                    market_standard=market_standard,
                    favorability=favorability,
                    negotiation_implications=negotiation_implications
                ))
        
        return market_comparisons
    
    async def verify_playbook_compliance(self, contract_content: str, 
                                       company_playbook: Dict[str, Any],
                                       compliance_strictness: str) -> List[PlaybookCompliance]:
        """Verify compliance with company playbook"""
        compliance_results = []
        
        # Check mandatory clauses
        mandatory_clauses = company_playbook.get("mandatory_clauses", [])
        for clause_type in mandatory_clauses:
            compliance_status = "compliant"
            deviations = []
            
            if clause_type == "limitation_of_liability":
                if "liability" not in contract_content.lower():
                    compliance_status = "non_compliant"
                    deviations.append("Missing required liability limitation clause")
                elif "unlimited" in contract_content.lower():
                    compliance_status = "deviation"
                    deviations.append("Unlimited liability conflicts with playbook requirement")
            
            elif clause_type == "data_protection":
                if "data protection" not in contract_content.lower() and "confidential" not in contract_content.lower():
                    compliance_status = "non_compliant"
                    deviations.append("Missing required data protection provisions")
            
            approval_needed = compliance_status in ["non_compliant", "deviation"] and compliance_strictness == "high"
            risk_level = "high" if compliance_status == "non_compliant" else "medium" if compliance_status == "deviation" else "low"
            
            compliance_results.append(PlaybookCompliance(
                playbook_section=f"mandatory_clauses.{clause_type}",
                compliance_status=compliance_status,
                deviations=deviations,
                approval_needed=approval_needed,
                risk_level=risk_level
            ))
        
        # Check prohibited terms
        prohibited_terms = company_playbook.get("prohibited_terms", [])
        for term in prohibited_terms:
            if term.replace("_", " ") in contract_content.lower():
                compliance_results.append(PlaybookCompliance(
                    playbook_section=f"prohibited_terms.{term}",
                    compliance_status="violation",
                    deviations=[f"Contract contains prohibited term: {term}"],
                    approval_needed=True,
                    risk_level="critical"
                ))
        
        return compliance_results
    
    async def generate_recommendations(self, identified_issues: List[Dict[str, Any]],
                                     risk_scores: Dict[str, float],
                                     contract_context: Dict[str, Any],
                                     recommendation_priorities: List[str]) -> List[GeneratedRecommendation]:
        """Generate actionable recommendations based on review findings"""
        recommendations = []
        
        # Process identified issues
        for issue in identified_issues:
            issue_type = issue["type"]
            severity = issue["severity"]
            
            if issue_type == "missing_clause":
                clause = issue["clause"]
                recommendations.append(GeneratedRecommendation(
                    recommendation_type="add_clause",
                    priority="high" if severity == "high" else "medium",
                    description=f"Add missing {clause} clause to contract",
                    implementation_effort="low",
                    risk_reduction=0.7,
                    business_impact="risk_mitigation"
                ))
            
            elif issue_type == "compliance_risk":
                framework = issue["framework"]
                recommendations.append(GeneratedRecommendation(
                    recommendation_type="compliance_enhancement",
                    priority="high",
                    description=f"Add {framework} compliance provisions",
                    implementation_effort="medium",
                    risk_reduction=0.8,
                    business_impact="regulatory_compliance"
                ))
            
            elif issue_type == "inconsistency":
                recommendations.append(GeneratedRecommendation(
                    recommendation_type="consistency_fix",
                    priority="low" if severity == "low" else "medium",
                    description="Resolve inconsistencies in contract sections",
                    implementation_effort="low",
                    risk_reduction=0.3,
                    business_impact="clarity_improvement"
                ))
        
        # Address high risk scores
        for category, score in risk_scores.items():
            if score > 0.7:
                recommendations.append(GeneratedRecommendation(
                    recommendation_type="risk_mitigation",
                    priority="high",
                    description=f"Address high risk in {category} (score: {score:.2f})",
                    implementation_effort="medium",
                    risk_reduction=0.6,
                    business_impact="financial_protection"
                ))
        
        # Sort by priority and risk reduction
        priority_weights = {"high": 3, "medium": 2, "low": 1}
        recommendations.sort(key=lambda x: (priority_weights.get(x.priority, 0), x.risk_reduction), reverse=True)
        
        return recommendations
    
    async def rank_priorities(self, review_findings: List[Dict[str, Any]],
                            prioritization_criteria: Dict[str, float],
                            urgency_factors: Dict[str, Any]) -> List[PriorityRanking]:
        """Rank review findings by priority"""
        priority_rankings = []
        
        for finding in review_findings:
            issue = finding["issue"]
            risk = finding["risk"]
            effort = finding["effort"]
            
            # Calculate priority score
            risk_weight = prioritization_criteria.get("risk_weight", 0.5)
            effort_weight = prioritization_criteria.get("effort_weight", 0.3)
            business_impact_weight = prioritization_criteria.get("business_impact_weight", 0.2)
            
            # Effort scoring (inverse - lower effort = higher score)
            effort_scores = {"low": 1.0, "medium": 0.6, "high": 0.3}
            effort_score = effort_scores.get(effort, 0.5)
            
            # Business impact (simplified)
            business_impact_score = 0.8 if risk > 0.7 else 0.5
            
            priority_score = (risk * risk_weight + 
                            effort_score * effort_weight + 
                            business_impact_score * business_impact_weight)
            
            # Adjust for urgency factors
            urgency_multiplier = 1.0
            if urgency_factors.get("deal_timeline") == "tight":
                urgency_multiplier += 0.2
            if urgency_factors.get("business_criticality") == "high":
                urgency_multiplier += 0.3
            
            priority_score *= urgency_multiplier
            
            # Determine urgency level
            if priority_score > 0.8:
                urgency_level = "critical"
            elif priority_score > 0.6:
                urgency_level = "high"
            elif priority_score > 0.4:
                urgency_level = "medium"
            else:
                urgency_level = "low"
            
            priority_rankings.append(PriorityRanking(
                item=issue,
                priority_score=priority_score,
                urgency_level=urgency_level,
                effort_required=effort,
                business_impact="high" if risk > 0.7 else "medium",
                rationale=f"Risk: {risk:.2f}, Effort: {effort}, Urgency factors applied"
            ))
        
        # Sort by priority score
        priority_rankings.sort(key=lambda x: x.priority_score, reverse=True)
        
        return priority_rankings
    
    async def trigger_escalations(self, final_risk_assessment: Dict[str, float],
                                critical_issues: List[str], escalation_policies: Dict[str, Dict[str, Any]],
                                contract_metadata: Dict[str, Any]) -> List[EscalationAlert]:
        """Trigger escalations based on risk assessment and policies"""
        escalation_alerts = []
        
        overall_risk = final_risk_assessment.get("overall_risk", 0.0)
        
        # Check escalation policies
        for role, policy in escalation_policies.items():
            risk_threshold = policy.get("risk_threshold", 0.8)
            relevant_issues = policy.get("issues", [])
            
            # Check if escalation is needed
            escalation_needed = False
            trigger_reasons = []
            
            if overall_risk >= risk_threshold:
                escalation_needed = True
                trigger_reasons.append(f"Overall risk ({overall_risk:.2f}) exceeds threshold ({risk_threshold})")
            
            # Check for specific issue types
            for issue_category in relevant_issues:
                if any(issue_category in issue.lower() for issue in critical_issues):
                    escalation_needed = True
                    trigger_reasons.append(f"Critical {issue_category} issue detected")
            
            # Check for high-value contracts
            contract_value = contract_metadata.get("value", 0)
            strategic_importance = contract_metadata.get("strategic_importance", "medium")
            
            if role == "business_leader" and contract_value > 5000000:
                escalation_needed = True
                trigger_reasons.append("High-value contract requires business leadership review")
            
            if role == "external_counsel" and strategic_importance == "high":
                escalation_needed = True
                trigger_reasons.append("Strategic contract requires external legal counsel")
            
            if escalation_needed:
                urgency = "critical" if overall_risk > 0.9 else "high" if overall_risk > 0.8 else "medium"
                
                escalation_alerts.append(EscalationAlert(
                    alert_type=f"{role}_escalation",
                    urgency=urgency,
                    recipient=role,
                    description=f"Contract review escalation required: {', '.join(trigger_reasons)}",
                    required_action=f"Review and approve contract with risk level {overall_risk:.2f}",
                    timeline="immediate" if urgency == "critical" else "within_24_hours"
                ))
        
        return escalation_alerts
    
    # Integration methods for workflow
    async def provide_generation_feedback(self, review_results: Dict[str, Any],
                                        generation_improvements: List[str],
                                        contract_generator) -> Dict[str, Any]:
        """Provide feedback to contract generator for improvement"""
        return {
            "insights": review_results,
            "recommended_adjustments": generation_improvements,
            "feedback_confidence": 0.8,
            "improvement_priority": "high" if review_results.get("issues_found", 0) > 5 else "medium"
        }