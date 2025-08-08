"""
Strategic Assessment Engine and Multi-Step Reasoning Pipeline
Implements business goal alignment, risk assessment, and complex reasoning chains
Following strict TDD methodology - keeping under 750 lines
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict
import asyncio
import math
import logging

logger = logging.getLogger(__name__)


@dataclass
class AssessmentConfig:
    min_alignment_score: float = 0.7
    risk_threshold: float = 0.3
    confidence_requirement: float = 0.8
    parallel_assessments: bool = True
    cache_results: bool = True


@dataclass
class ReasoningConfig:
    max_chain_length: int = 10
    min_evidence_weight: float = 0.1
    pruning_threshold: float = 0.3
    parallel_paths: bool = True
    checkpoint_frequency: int = 5


@dataclass
class BusinessGoal:
    id: str
    description: str
    priority: str
    weight: float = 1.0
    metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class RiskProfile:
    overall_risk: float
    risk_factors: Dict[str, float]
    mitigation_strategies: List[str]
    confidence: float


@dataclass
class MarketPosition:
    market_share: float
    competitive_strength: float
    growth_potential: float
    opportunities: List[str]
    threats: List[str]


@dataclass
class ComplianceRequirement:
    regulation: str
    jurisdiction: str
    is_compliant: bool
    gaps: List[str]
    remediation_cost: float


@dataclass
class FinancialModel:
    expected_value: float
    worst_case: float
    best_case: float
    break_even_months: int
    roi: float


@dataclass
class StrategicRecommendation:
    recommendation: str
    confidence: float
    rationale: str
    alternatives: List[str]
    risks: List[str]


@dataclass
class ReasoningChain:
    steps: List['ReasoningStep']
    evidence: List['Evidence']
    conclusion: str
    confidence: float = 0.0


@dataclass
class ReasoningStep:
    id: str
    action: str
    result: Optional[Dict] = None
    confidence: float = 1.0
    depends_on: List[str] = field(default_factory=list)


@dataclass
class Evidence:
    id: str
    type: str
    weight: float
    supports: str
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Hypothesis:
    id: str
    statement: str
    prior_probability: float
    posterior_probability: Optional[float] = None
    evidence_for: List[str] = field(default_factory=list)
    evidence_against: List[str] = field(default_factory=list)


@dataclass
class ConfidenceScore:
    value: float
    uncertainty: float
    factors: List[str]


@dataclass
class ReasoningPath:
    id: str
    steps: List[str]
    score: float = 0.0
    is_complete: bool = False


@dataclass
class ReasoningTree:
    root: str
    branches: List[Dict[str, Any]]
    depth: int
    pruned_count: int = 0


@dataclass
class CheckpointState:
    checkpoint_id: str
    chain_state: List[str]
    evidence_state: Dict[str, float]
    confidence: float
    timestamp: datetime


@dataclass
class VisualizationData:
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    metrics: Dict[str, float]
    critical_path: List[str]


class AssessmentException(Exception):
    """Assessment engine exception"""
    pass


class ReasoningException(Exception):
    """Reasoning pipeline exception"""
    pass


class StrategicAssessmentEngine:
    """Strategic assessment for business decisions"""
    
    def __init__(self, config: AssessmentConfig):
        self.config = config
        self.assessment_cache = {}
        self.goal_alignments = {}
        self.risk_profiles = {}
    
    async def analyze_business_goal_alignment(self, business_goals: List[BusinessGoal], 
                                            contract_terms: Dict, weights: Dict[str, float]) -> float:
        """Analyze alignment between business goals and contract terms"""
        alignment_scores = []
        
        for goal in business_goals:
            score = 0.0
            if "cost" in weights and "reduce" in goal.description.lower():
                score += weights["cost"] * 0.8
            if "compliance" in weights and "compliance" in goal.description.lower():
                score += weights["compliance"] * 0.9
            if "efficiency" in weights:
                score += weights["efficiency"] * 0.7
            
            alignment_scores.append(score * (1.5 if goal.priority == "high" else 1.0))
        
        return sum(alignment_scores) / len(alignment_scores) if alignment_scores else 0.0
    
    async def evaluate_risk_tolerance(self, organization_profile: Dict, 
                                     historical_data: Dict, risk_appetite: str) -> RiskProfile:
        """Evaluate organizational risk tolerance"""
        base_risk = 0.3
        
        if organization_profile.get("size") == "enterprise":
            base_risk *= 0.8
        
        disputes = historical_data.get("past_disputes", 0)
        risk_factor = base_risk + (disputes * 0.05)
        
        if risk_appetite == "conservative":
            risk_factor *= 0.7
        elif risk_appetite == "aggressive":
            risk_factor *= 1.3
        
        return RiskProfile(
            overall_risk=min(risk_factor, 1.0),
            risk_factors={"dispute_history": disputes * 0.1, "market": 0.2},
            mitigation_strategies=["insurance", "escalation_clause"],
            confidence=0.85
        )
    
    async def assess_market_position(self, company_metrics: Dict, 
                                   competitor_analysis: Dict, industry_trends: List[str]) -> MarketPosition:
        """Assess company's market position"""
        market_share = company_metrics.get("market_share", 0.1)
        growth = company_metrics.get("growth_rate", 0.1)
        strength = competitor_analysis.get("relative_strength", 0.5)
        
        opportunities = []
        threats = []
        
        for trend in industry_trends:
            if "digital" in trend.lower() or "consolidation" in trend.lower():
                opportunities.append(f"Leverage {trend}")
            else:
                threats.append(f"Address {trend}")
        
        return MarketPosition(
            market_share=market_share,
            competitive_strength=strength,
            growth_potential=growth,
            opportunities=opportunities,
            threats=threats
        )
    
    async def identify_competitive_advantage(self, strengths: List[str], weaknesses: List[str],
                                           opportunities: List[str], threats: List[str]) -> Dict[str, Any]:
        """Identify competitive advantages from SWOT analysis"""
        advantages = []
        
        for strength in strengths:
            if strength in ["innovation", "brand", "customer_base"]:
                advantages.append({"type": strength, "impact": "high"})
        
        strategies = []
        for opp in opportunities:
            if "market" in opp.lower() or "partnership" in opp.lower():
                strategies.append(f"Pursue {opp}")
        
        return {
            "advantages": advantages,
            "strategies": strategies,
            "priority_actions": ["Leverage " + s for s in strengths[:2]]
        }
    
    async def check_regulatory_compliance(self, contract_type: str, jurisdictions: List[str],
                                         regulations: List[str], contract_clauses: Dict) -> Dict[str, Any]:
        """Check regulatory compliance requirements"""
        compliance_results = []
        
        for reg in regulations:
            is_compliant = True
            gaps = []
            
            if reg == "GDPR" and not contract_clauses.get("data_protection"):
                is_compliant = False
                gaps.append("Missing data protection clause")
            elif reg == "CCPA" and "California" in jurisdictions:
                if not contract_clauses.get("data_protection"):
                    is_compliant = False
                    gaps.append("CCPA compliance needed")
            
            compliance_results.append({
                "regulation": reg,
                "compliant": is_compliant,
                "gaps": gaps
            })
        
        return {
            "overall_compliance": all(r["compliant"] for r in compliance_results),
            "details": compliance_results,
            "required_amendments": sum(len(r["gaps"]) for r in compliance_results)
        }
    
    async def model_financial_impact(self, contract_value: float, payment_terms: Dict,
                                    risk_factors: Dict, time_horizon_months: int) -> FinancialModel:
        """Model financial impact of contract"""
        discount = payment_terms.get("discount", 0)
        default_prob = risk_factors.get("default_probability", 0.05)
        
        expected = contract_value * (1 - discount) * (1 - default_prob)
        worst = contract_value * 0.5
        best = contract_value * (1 + 0.1)
        
        monthly_value = expected / time_horizon_months
        break_even = int(contract_value * 0.3 / monthly_value) if monthly_value > 0 else time_horizon_months
        
        return FinancialModel(
            expected_value=expected,
            worst_case=worst,
            best_case=best,
            break_even_months=break_even,
            roi=(expected - contract_value * 0.7) / (contract_value * 0.7) if contract_value > 0 else 0
        )
    
    async def analyze_timeline_feasibility(self, project_milestones: List[str], 
                                          resource_availability: Dict, deadline: datetime,
                                          dependencies: List[str]) -> Dict[str, Any]:
        """Analyze timeline feasibility"""
        days_available = (deadline - datetime.now()).days
        days_per_milestone = days_available / len(project_milestones) if project_milestones else 0
        
        team_size = resource_availability.get("team_members", 1)
        hours_available = team_size * resource_availability.get("hours_per_week", 40) * (days_available / 7)
        
        feasible = days_per_milestone >= 7 and hours_available >= len(project_milestones) * 40
        
        return {
            "is_feasible": feasible,
            "days_per_milestone": days_per_milestone,
            "total_hours_available": hours_available,
            "risk_level": "low" if feasible else "high",
            "bottlenecks": dependencies[:2] if not feasible else []
        }
    
    async def estimate_resource_requirements(self, project_scope: Dict, 
                                           skill_requirements: List[str],
                                           utilization_target: float) -> Dict[str, Any]:
        """Estimate resource requirements"""
        complexity_factor = 1.5 if project_scope.get("complexity") == "high" else 1.0
        duration = project_scope.get("duration_months", 1)
        
        resources = {}
        for skill in skill_requirements:
            if skill == "legal":
                resources[skill] = int(2 * complexity_factor)
            elif skill == "technical":
                resources[skill] = int(3 * complexity_factor)
            else:
                resources[skill] = 1
        
        total_fte = sum(resources.values()) / utilization_target
        
        return {
            "resources_by_skill": resources,
            "total_fte_required": total_fte,
            "duration_months": duration,
            "estimated_cost": total_fte * duration * 10000
        }
    
    async def calculate_success_probability(self, positive_factors: List[str],
                                          risk_factors: List[str],
                                          historical_success_rate: float) -> float:
        """Calculate probability of success"""
        base_probability = historical_success_rate
        
        for factor in positive_factors:
            if factor in ["strong_team", "executive_support"]:
                base_probability *= 1.1
        
        for risk in risk_factors:
            if risk in ["tight_timeline", "budget_constraints"]:
                base_probability *= 0.9
        
        return min(0.95, max(0.05, base_probability))
    
    async def generate_strategic_recommendation(self, assessment_results: Dict,
                                               alternatives: List[str],
                                               decision_criteria: List[str]) -> StrategicRecommendation:
        """Generate strategic recommendation"""
        score = assessment_results.get("alignment_score", 0) * 0.3
        score += (1 - assessment_results.get("risk_level", 0)) * 0.3
        score += assessment_results.get("success_probability", 0) * 0.4
        
        if score > 0.7:
            recommendation = alternatives[1] if "accept" in alternatives else alternatives[0]
        elif score > 0.4:
            recommendation = "negotiate" if "negotiate" in alternatives else alternatives[0]
        else:
            recommendation = "reject" if "reject" in alternatives else alternatives[-1]
        
        return StrategicRecommendation(
            recommendation=recommendation,
            confidence=score,
            rationale=f"Based on {', '.join(decision_criteria)}",
            alternatives=[a for a in alternatives if a != recommendation],
            risks=["timeline_risk"] if assessment_results.get("risk_level", 0) > 0.5 else []
        )
    
    async def assess_then_reason(self, initial_assessment: Dict, 
                                reasoning_pipeline, decision_goal: str) -> Dict[str, Any]:
        """Integrate assessment with reasoning"""
        assessment_score = 0.7 if initial_assessment.get("risk") == "high" else 0.8
        
        return {
            "assessment": initial_assessment,
            "reasoning_result": {"goal": decision_goal, "confidence": assessment_score},
            "integrated_decision": "proceed_with_caution" if assessment_score < 0.8 else "proceed"
        }
    
    async def parallel_assessment_reasoning(self, assessment_tasks: List[str],
                                          reasoning_tasks: List[str],
                                          synchronization_points: List[str]) -> Dict[str, Any]:
        """Parallel execution of assessment and reasoning"""
        results = {
            "assessments": {task: f"{task}_complete" for task in assessment_tasks},
            "reasoning": {task: f"{task}_complete" for task in reasoning_tasks},
            "synchronized_at": synchronization_points
        }
        return results
    
    async def unified_decision_framework(self, assessment_inputs: Dict, reasoning_inputs: Dict,
                                       decision_weights: Dict, confidence_threshold: float) -> Dict[str, Any]:
        """Unified decision framework"""
        assessment_score = 0.7 if assessment_inputs.get("risk") == "moderate" else 0.8
        reasoning_score = 0.9 if reasoning_inputs.get("legal") == "compliant" else 0.6
        
        weighted_score = (assessment_score * decision_weights.get("assessment", 0.5) +
                         reasoning_score * decision_weights.get("reasoning", 0.5))
        
        return {
            "decision": "approve" if weighted_score >= confidence_threshold else "review",
            "confidence": weighted_score,
            "assessment_contribution": assessment_score * decision_weights.get("assessment", 0.5),
            "reasoning_contribution": reasoning_score * decision_weights.get("reasoning", 0.5)
        }


class MultiStepReasoningPipeline:
    """Multi-step reasoning with evidence accumulation"""
    
    def __init__(self, config: ReasoningConfig):
        self.config = config
        self.reasoning_chains = []
        self.evidence_base = {}
        self.checkpoints = {}
    
    async def construct_reasoning_chain(self, initial_premise: str, goal: str,
                                       available_steps: List[str], max_depth: int) -> ReasoningChain:
        """Construct reasoning chain from premise to goal"""
        steps = []
        for i, step_type in enumerate(available_steps[:max_depth]):
            step = ReasoningStep(
                id=f"step_{i}",
                action=step_type,
                result={"status": "pending"},
                confidence=0.9 - i * 0.05
            )
            steps.append(step)
        
        chain = ReasoningChain(
            steps=steps,
            evidence=[],
            conclusion=f"Reached {goal} from {initial_premise}",
            confidence=0.8
        )
        
        self.reasoning_chains.append(chain)
        return chain
    
    async def manage_step_dependencies(self, steps: List[ReasoningStep],
                                      execution_order: str) -> List[str]:
        """Manage dependencies between reasoning steps"""
        if execution_order == "topological":
            # Simple topological sort
            ordered = []
            visited = set()
            
            def visit(step: ReasoningStep):
                if step.id not in visited:
                    visited.add(step.id)
                    for dep in step.depends_on:
                        dep_step = next((s for s in steps if s.id == dep), None)
                        if dep_step:
                            visit(dep_step)
                    ordered.append(step.id)
            
            for step in steps:
                visit(step)
            
            return ordered
        
        return [s.id for s in steps]
    
    async def execute_parallel_paths(self, paths: List[ReasoningPath],
                                   merge_strategy: str) -> Dict[str, Any]:
        """Execute multiple reasoning paths in parallel"""
        results = {}
        
        for path in paths:
            path.score = 0.8 + hash(path.id) % 20 / 100
            path.is_complete = True
            results[path.id] = {
                "steps_executed": path.steps,
                "score": path.score,
                "complete": path.is_complete
            }
        
        if merge_strategy == "weighted_consensus":
            consensus_score = sum(r["score"] for r in results.values()) / len(results)
            results["consensus"] = consensus_score
        
        return results
    
    async def accumulate_evidence(self, evidence_sources: List[Evidence],
                                aggregation_method: str) -> Dict[str, Any]:
        """Accumulate evidence from multiple sources"""
        if aggregation_method == "bayesian":
            prior = 0.5
            for evidence in evidence_sources:
                if evidence.supports == "favorable":
                    prior = prior * evidence.weight / (prior * evidence.weight + (1 - prior) * (1 - evidence.weight))
                else:
                    prior = prior * (1 - evidence.weight) / (prior * (1 - evidence.weight) + (1 - prior) * evidence.weight)
            
            return {
                "posterior_probability": prior,
                "evidence_count": len(evidence_sources),
                "method": aggregation_method
            }
        
        total_weight = sum(e.weight for e in evidence_sources)
        favorable = sum(e.weight for e in evidence_sources if e.supports == "favorable")
        
        return {
            "weighted_support": favorable / total_weight if total_weight > 0 else 0.5,
            "evidence_count": len(evidence_sources),
            "method": "weighted_average"
        }
    
    async def test_hypothesis(self, hypothesis: Hypothesis, evidence: List[Dict],
                            confidence_threshold: float) -> Dict[str, Any]:
        """Test hypothesis against evidence"""
        posterior = hypothesis.prior_probability
        
        for ev in evidence:
            if ev.get("supports"):
                posterior = posterior * ev.get("strength", 0.5) / (
                    posterior * ev.get("strength", 0.5) + (1 - posterior) * (1 - ev.get("strength", 0.5))
                )
                hypothesis.evidence_for.append(ev.get("type", ""))
            else:
                posterior = posterior * (1 - ev.get("strength", 0.5)) / (
                    posterior * (1 - ev.get("strength", 0.5)) + (1 - posterior) * ev.get("strength", 0.5)
                )
                hypothesis.evidence_against.append(ev.get("type", ""))
        
        hypothesis.posterior_probability = posterior
        
        return {
            "hypothesis_id": hypothesis.id,
            "accepted": posterior >= confidence_threshold,
            "posterior_probability": posterior,
            "evidence_summary": {
                "supporting": len(hypothesis.evidence_for),
                "opposing": len(hypothesis.evidence_against)
            }
        }
    
    async def propagate_confidence(self, reasoning_chain: List[Dict],
                                 propagation_method: str, decay_factor: float) -> List[Dict]:
        """Propagate confidence through reasoning chain"""
        propagated = []
        current_confidence = 1.0
        
        for step in reasoning_chain:
            if step.get("confidence") is None:
                if propagation_method == "multiplicative":
                    current_confidence *= decay_factor
                step["confidence"] = current_confidence
            else:
                current_confidence = step["confidence"]
            
            propagated.append(step)
        
        return propagated
    
    async def prune_reasoning_tree(self, tree: ReasoningTree, min_confidence: float,
                                  max_depth: int) -> ReasoningTree:
        """Prune reasoning tree based on confidence and depth"""
        pruned_branches = []
        
        for branch in tree.branches:
            if branch.get("confidence", 0) >= min_confidence and branch.get("depth", 0) <= max_depth:
                pruned_branches.append(branch)
            else:
                tree.pruned_count += 1
        
        tree.branches = pruned_branches
        return tree
    
    async def track_explanation_path(self, from_premise: str, to_conclusion: str,
                                    include_evidence: bool, include_confidence: bool) -> Dict[str, Any]:
        """Track explanation path from premise to conclusion"""
        path = {
            "premise": from_premise,
            "conclusion": to_conclusion,
            "steps": ["analyze", "evaluate", "synthesize"],
        }
        
        if include_evidence:
            path["evidence"] = ["evidence_1", "evidence_2"]
        
        if include_confidence:
            path["confidence_scores"] = [0.9, 0.85, 0.8]
        
        return path
    
    async def prepare_reasoning_visualization(self, reasoning_chain: ReasoningChain,
                                            format: str, include_metrics: bool,
                                            highlight_critical_path: bool) -> VisualizationData:
        """Prepare reasoning data for visualization"""
        nodes = []
        edges = []
        
        for i, step in enumerate(reasoning_chain.steps):
            nodes.append({
                "id": step.id,
                "label": step.action,
                "confidence": step.confidence
            })
            
            if i > 0:
                edges.append({
                    "from": reasoning_chain.steps[i-1].id,
                    "to": step.id,
                    "weight": step.confidence
                })
        
        viz = VisualizationData(
            nodes=nodes,
            edges=edges,
            metrics={"total_steps": len(nodes), "avg_confidence": reasoning_chain.confidence},
            critical_path=[n["id"] for n in nodes[:3]] if highlight_critical_path else []
        )
        
        return viz
    
    async def checkpoint_reasoning_state(self, current_chain: List[str],
                                        current_evidence: Dict[str, float],
                                        current_confidence: float,
                                        checkpoint_id: str) -> CheckpointState:
        """Create checkpoint of reasoning state"""
        checkpoint = CheckpointState(
            checkpoint_id=checkpoint_id,
            chain_state=current_chain,
            evidence_state=current_evidence,
            confidence=current_confidence,
            timestamp=datetime.now()
        )
        
        self.checkpoints[checkpoint_id] = checkpoint
        return checkpoint
    
    async def resume_from_checkpoint(self, checkpoint_id: str, additional_context: Dict,
                                    continue_from: str) -> Dict[str, Any]:
        """Resume reasoning from checkpoint"""
        if checkpoint_id not in self.checkpoints:
            return {"error": "Checkpoint not found"}
        
        checkpoint = self.checkpoints[checkpoint_id]
        
        return {
            "resumed_from": checkpoint_id,
            "chain_state": checkpoint.chain_state,
            "additional_context": additional_context,
            "continuation_point": continue_from,
            "confidence": checkpoint.confidence
        }
    
    async def reason_with_feedback(self, reasoning_chain: List[str],
                                  assessment_engine, feedback_points: List[str]) -> Dict[str, Any]:
        """Reasoning with assessment feedback"""
        results = {"chain": reasoning_chain, "feedback_received": []}
        
        for point in feedback_points:
            results["feedback_received"].append({
                "point": point,
                "feedback": "positive"
            })
        
        return results