"""
Negotiation Strategy Engine and Real-time Negotiation Assistant
Implements strategic negotiation planning and real-time assistance
Following strict TDD methodology - keeping under 750 lines
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict
import asyncio
import logging

logger = logging.getLogger(__name__)

@dataclass
class NegotiationConfig:
    max_concessions: int = 5
    min_acceptable_value: float = 0.6
    confidence_threshold: float = 0.8
    cultural_weight: float = 0.2
    game_theory_enabled: bool = True

@dataclass
class AssistantConfig:
    suggestion_frequency: int = 30
    risk_alert_threshold: float = 0.7
    emotional_analysis_enabled: bool = True
    trust_tracking: bool = True
    script_generation: bool = True

@dataclass
class OpeningPosition:
    initial_offer: float
    aspiration_level: float
    reservation_point: float
    confidence: float
    justification: str

@dataclass
class BATNAAnalysis:
    best_alternative: str
    alternative_value: float
    probability_of_success: float
    alternatives_ranked: List[Dict[str, Any]]
    recommendation: str

@dataclass
class ConcessionPlan:
    issues: List[str]
    concession_sequence: List[Dict[str, Any]]
    minimum_values: Dict[str, float]
    maximum_rounds: int
    contingency_plans: List[str]

@dataclass
class TradeoffAnalysis:
    viable_trades: List[Dict[str, Any]]
    value_impact: Dict[str, float]
    risk_assessment: Dict[str, float]
    recommendations: List[str]

@dataclass
class MultiIssueNegotiation:
    issue_priorities: Dict[str, float]
    bundling_opportunities: List[Dict[str, Any]]
    sequencing_strategy: str
    integrative_potential: float

@dataclass
class CoalitionStrategy:
    potential_coalitions: List[Dict[str, Any]]
    coalition_values: Dict[str, float]
    stability_analysis: Dict[str, float]
    recommended_approach: str

@dataclass
class TimingOptimization:
    optimal_schedule: Dict[str, datetime]
    urgency_factors: Dict[str, float]
    deadline_management: str
    pacing_strategy: str

@dataclass
class CulturalFactors:
    communication_style: str
    relationship_importance: float
    hierarchy_sensitivity: float
    adaptation_recommendations: List[str]

@dataclass
class PsychologicalProfile:
    personality_traits: Dict[str, float]
    negotiation_style: str
    emotional_triggers: List[str]
    influence_strategies: List[str]

@dataclass
class GameTheoryApplication:
    game_type: str
    equilibrium_strategy: str
    expected_outcomes: Dict[str, float]
    strategic_recommendations: List[str]

@dataclass
class LiveSuggestion:
    suggestion: str
    urgency: str
    confidence: float
    rationale: str
    timing: datetime

@dataclass
class CounterOfferAnalysis:
    offer_evaluation: Dict[str, float]
    acceptance_recommendation: str
    counter_proposal: Dict[str, Any]
    risk_factors: List[str]

@dataclass
class RiskAssessment:
    risk_level: str
    risk_factors: List[str]
    mitigation_strategies: List[str]
    impact_analysis: Dict[str, float]

@dataclass
class AlternativeProposal:
    proposals: List[Dict[str, Any]]
    value_preservation: float
    creativity_score: float
    implementation_difficulty: str

@dataclass
class DeadlockResolution:
    resolution_strategies: List[str]
    intervention_timing: str
    success_probability: float
    escalation_options: List[str]

@dataclass
class EmotionalAnalysis:
    emotional_state: str
    sentiment_trend: str
    stress_indicators: List[str]
    relationship_impact: str

@dataclass
class PowerDynamics:
    power_balance: Dict[str, float]
    leverage_points: List[str]
    dependency_analysis: Dict[str, float]
    strategic_implications: List[str]

@dataclass
class TrustRecommendation:
    trust_level: float
    building_strategies: List[str]
    trust_barriers: List[str]
    monitoring_metrics: List[str]

@dataclass
class NegotiationScript:
    script_content: str
    key_phrases: List[str]
    cultural_adaptations: List[str]
    timing_cues: List[str]

@dataclass
class SuccessProbability:
    current_probability: float
    trend_direction: str
    critical_factors: List[str]
    improvement_recommendations: List[str]


class NegotiationException(Exception):
    """Negotiation strategy exception"""
    pass


class AssistantException(Exception):
    """Assistant exception"""
    pass


class NegotiationStrategyEngine:
    """Strategic negotiation planning engine"""
    
    def __init__(self, config: NegotiationConfig):
        self.config = config
        self.negotiation_history = []
        self.cultural_adaptations = {}
        self.game_models = {}
    
    async def calculate_opening_position(self, target_value: float, minimum_acceptable: float,
                                        market_conditions: Dict, counterpart_profile: Dict,
                                        historical_data: Dict) -> OpeningPosition:
        """Calculate optimal opening position"""
        market_factor = 1.1 if market_conditions.get("favorable") else 0.95
        experience_factor = 0.9 if counterpart_profile.get("experience") == "high" else 1.0
        aspiration = target_value * market_factor * experience_factor
        opening_multiplier = 1.2 if counterpart_profile.get("style") == "competitive" else 1.15
        initial_offer = aspiration * opening_multiplier
        confidence = 0.8 if market_conditions.get("favorable") else 0.7
        
        return OpeningPosition(
            initial_offer=initial_offer,
            aspiration_level=aspiration,
            reservation_point=minimum_acceptable,
            confidence=confidence,
            justification=f"Market conditions: {'favorable' if market_conditions.get('favorable') else 'challenging'}"
        )
    
    async def determine_batna(self, alternatives: List[Dict], current_deal_terms: Dict,
                             risk_factors: Dict) -> BATNAAnalysis:
        """Determine Best Alternative to Negotiated Agreement"""
        evaluated_alternatives = []
        
        for alt in alternatives:
            expected_value = alt["value"] * alt["probability"]
            risk_adjusted_value = expected_value * (1 - sum(risk_factors.values()) / len(risk_factors))
            evaluated_alternatives.append({**alt, "expected_value": expected_value, "risk_adjusted_value": risk_adjusted_value})
        
        evaluated_alternatives.sort(key=lambda x: x["risk_adjusted_value"], reverse=True)
        best_alternative = evaluated_alternatives[0]
        
        return BATNAAnalysis(
            best_alternative=best_alternative["option"],
            alternative_value=best_alternative["risk_adjusted_value"],
            probability_of_success=best_alternative["probability"],
            alternatives_ranked=evaluated_alternatives,
            recommendation="Proceed with negotiation" if current_deal_terms["value"] > best_alternative["risk_adjusted_value"] else "Consider BATNA"
        )
    
    async def plan_concessions(self, issues: List[str], priorities: Dict[str, float],
                              concession_limits: Dict[str, float], negotiation_rounds: int) -> ConcessionPlan:
        """Plan concession strategy across negotiation rounds"""
        sorted_issues = sorted(issues, key=lambda x: priorities.get(x, 0))
        concession_sequence = []
        round_size = len(sorted_issues) // min(negotiation_rounds, len(sorted_issues))
        
        for round_num in range(min(negotiation_rounds, len(sorted_issues))):
            start_idx = round_num * round_size
            end_idx = start_idx + round_size if round_num < negotiation_rounds - 1 else len(sorted_issues)
            round_issues = sorted_issues[start_idx:end_idx]
            concession_sequence.append({
                "round": round_num + 1,
                "issues": round_issues,
                "concession_percentage": 0.1 + (round_num * 0.05)
            })
        
        return ConcessionPlan(
            issues=issues,
            concession_sequence=concession_sequence,
            minimum_values={issue: priorities[issue] * (1 - concession_limits.get(issue, 0.1)) for issue in issues},
            maximum_rounds=negotiation_rounds,
            contingency_plans=["Escalate to management", "Request deadline extension"]
        )
    
    async def analyze_tradeoffs(self, issue_combinations: List[Dict], value_weights: Dict[str, float],
                               counterpart_preferences: Dict) -> TradeoffAnalysis:
        """Analyze potential trade-offs between issues"""
        viable_trades = []
        
        for combo in issue_combinations:
            give_value = self._calculate_issue_value(combo["give"], value_weights)
            get_value = self._calculate_issue_value(combo["get"], value_weights)
            counterpart_factor = self._get_counterpart_factor(combo["get"], counterpart_preferences)
            adjusted_get_value = get_value * counterpart_factor
            
            if adjusted_get_value > give_value:
                viable_trades.append({
                    "trade": combo,
                    "our_cost": give_value,
                    "our_benefit": adjusted_get_value,
                    "net_value": adjusted_get_value - give_value,
                    "feasibility": "high" if counterpart_factor > 1.2 else "medium"
                })
        
        viable_trades.sort(key=lambda x: x["net_value"], reverse=True)
        
        return TradeoffAnalysis(
            viable_trades=viable_trades,
            value_impact={t["trade"]["give"]: -t["our_cost"] for t in viable_trades},
            risk_assessment={t["trade"]["give"]: 0.3 if t["feasibility"] == "high" else 0.5 for t in viable_trades},
            recommendations=[f"Prioritize {t['trade']['give']} for {t['trade']['get']}" for t in viable_trades[:3]]
        )
    
    async def handle_multi_issue_negotiation(self, issues: List[Dict], dependencies: Dict[str, str],
                                           negotiation_style: str) -> MultiIssueNegotiation:
        """Handle multi-issue negotiation strategy"""
        priorities = {issue["name"]: issue["weight"] for issue in issues}
        bundling_opportunities = []
        
        for dep, relationship in dependencies.items():
            issue1, issue2 = dep.split("-")
            if relationship in ["positive", "inverse"]:
                bundling_opportunities.append({
                    "issues": [issue1, issue2],
                    "relationship": relationship,
                    "synergy_potential": 0.8 if relationship == "positive" else 0.6
                })
        
        sequencing = "simultaneous_discussion" if negotiation_style == "integrative" else "sequential_by_priority"
        integrative_potential = len(bundling_opportunities) / max(1, len(issues) - 1) * 0.8
        
        return MultiIssueNegotiation(
            issue_priorities=priorities,
            bundling_opportunities=bundling_opportunities,
            sequencing_strategy=sequencing,
            integrative_potential=min(1.0, integrative_potential)
        )
    
    async def form_coalitions(self, stakeholders: List[Dict], negotiation_issues: List[str],
                             coalition_strategies: List[str]) -> CoalitionStrategy:
        """Form internal coalitions for negotiation"""
        potential_coalitions = []
        
        for i, stakeholder1 in enumerate(stakeholders):
            for j, stakeholder2 in enumerate(stakeholders[i+1:], i+1):
                shared_interests = set(stakeholder1["interests"]) & set(stakeholder2["interests"])
                if shared_interests:
                    coalition_power = (stakeholder1["influence"] + stakeholder2["influence"]) / 2
                    potential_coalitions.append({
                        "members": [stakeholder1["name"], stakeholder2["name"]],
                        "shared_interests": list(shared_interests),
                        "combined_influence": coalition_power,
                        "stability": 0.8 if len(shared_interests) > 1 else 0.6
                    })
        
        potential_coalitions.sort(key=lambda x: x["combined_influence"], reverse=True)
        coalition_values = {f"{c['members'][0]}-{c['members'][1]}": c["combined_influence"] for c in potential_coalitions}
        stability_analysis = {f"{c['members'][0]}-{c['members'][1]}": c["stability"] for c in potential_coalitions}
        
        return CoalitionStrategy(
            potential_coalitions=potential_coalitions,
            coalition_values=coalition_values,
            stability_analysis=stability_analysis,
            recommended_approach="Form strongest coalition first" if potential_coalitions else "Individual approach"
        )
    
    async def optimize_timing(self, negotiation_phases: List[str], market_conditions: Dict,
                             counterpart_schedule: Dict, internal_constraints: Dict) -> TimingOptimization:
        """Optimize negotiation timing"""
        current_time = datetime.now()
        phase_durations = {"preparation": 3, "opening": 2, "bargaining": 5, "closing": 2}
        optimal_schedule = {}
        cumulative_days = 0
        
        for phase in negotiation_phases:
            base_duration = phase_durations.get(phase, 2)
            urgency_factor = 0.7 if market_conditions.get("urgency") == "high" else 1.0
            adjusted_duration = base_duration * urgency_factor
            optimal_schedule[phase] = current_time + timedelta(days=cumulative_days)
            cumulative_days += adjusted_duration
        
        urgency_factors = {
            "market_timing": 0.8 if market_conditions.get("seasonality") == "favorable" else 0.5,
            "counterpart_availability": 0.9 if counterpart_schedule.get("availability") == "high" else 0.6,
            "internal_readiness": 0.8 if internal_constraints.get("decision_makers") == "available" else 0.5
        }
        
        return TimingOptimization(
            optimal_schedule=optimal_schedule,
            urgency_factors=urgency_factors,
            deadline_management="Flexible approach" if sum(urgency_factors.values()) > 2.0 else "Strict timeline",
            pacing_strategy="Accelerated" if market_conditions.get("urgency") == "high" else "Standard"
        )
    
    async def consider_cultural_factors(self, counterpart_culture: str, negotiation_location: str,
                                       communication_style: str, business_practices: Dict,
                                       cultural_sensitivities: List[str]) -> CulturalFactors:
        """Consider cultural factors in negotiation approach"""
        cultural_mappings = {
            "japanese": {"hierarchy": 0.9, "relationship": 0.9, "formality": 0.8},
            "american": {"hierarchy": 0.4, "relationship": 0.6, "formality": 0.5},
            "german": {"hierarchy": 0.6, "relationship": 0.5, "formality": 0.7}
        }
        
        culture_profile = cultural_mappings.get(counterpart_culture.lower(), 
                                              {"hierarchy": 0.5, "relationship": 0.5, "formality": 0.5})
        
        adaptation_recommendations = []
        if culture_profile["hierarchy"] > 0.7:
            adaptation_recommendations.append("Address senior stakeholders first")
        if culture_profile["relationship"] > 0.7:
            adaptation_recommendations.append("Invest time in relationship building")
        if culture_profile["formality"] > 0.7:
            adaptation_recommendations.append("Use formal communication protocols")
        
        return CulturalFactors(
            communication_style=communication_style,
            relationship_importance=culture_profile["relationship"],
            hierarchy_sensitivity=culture_profile["hierarchy"],
            adaptation_recommendations=adaptation_recommendations
        )
    
    async def build_psychological_profile(self, behavioral_indicators: List[str], communication_patterns: Dict,
                                         decision_making_style: str, risk_tolerance: str,
                                         past_negotiations: List[Dict]) -> PsychologicalProfile:
        """Build psychological profile of counterpart"""
        trait_mapping = {
            "aggressive": {"dominance": 0.8, "competitiveness": 0.9},
            "detail_oriented": {"conscientiousness": 0.8, "analytical": 0.7},
            "relationship_focused": {"agreeableness": 0.8, "collaboration": 0.7}
        }
        
        personality_traits = defaultdict(float)
        for indicator in behavioral_indicators:
            if indicator in trait_mapping:
                for trait, value in trait_mapping[indicator].items():
                    personality_traits[trait] = max(personality_traits[trait], value)
        
        if personality_traits.get("competitiveness", 0) > 0.7:
            neg_style = "competitive"
        elif personality_traits.get("collaboration", 0) > 0.7:
            neg_style = "collaborative"
        else:
            neg_style = "accommodating"
        
        triggers = []
        if "aggressive" in behavioral_indicators:
            triggers.append("time_pressure")
        if communication_patterns.get("emotional", 0) > 0.6:
            triggers.append("relationship_threats")
        
        return PsychologicalProfile(
            personality_traits=dict(personality_traits),
            negotiation_style=neg_style,
            emotional_triggers=triggers,
            influence_strategies=["logical_arguments"] if decision_making_style == "analytical" else ["emotional_appeals"]
        )
    
    async def apply_game_theory(self, game_type: str, players: List[str], payoff_matrix: Dict,
                               equilibrium_strategy: str) -> GameTheoryApplication:
        """Apply game theory to negotiation strategy"""
        if equilibrium_strategy == "nash":
            best_outcomes = {}
            for strategy_combo, payoffs in payoff_matrix.items():
                our_payoff = payoffs[0] if len(payoffs) > 0 else 0
                best_outcomes[strategy_combo] = our_payoff
            
            optimal_strategy = max(best_outcomes.items(), key=lambda x: x[1])
            
            recommendations = []
            if game_type == "cooperative":
                recommendations.extend(["Seek win-win solutions", "Share information strategically"])
            else:
                recommendations.extend(["Maintain strategic advantage", "Prepare for competitive responses"])
        
        return GameTheoryApplication(
            game_type=game_type,
            equilibrium_strategy=equilibrium_strategy,
            expected_outcomes=best_outcomes,
            strategic_recommendations=recommendations
        )
    
    async def integrate_with_assistant(self, strategic_plan: Dict, real_time_context: Dict,
                                      assistant) -> Dict[str, Any]:
        """Integrate strategic planning with real-time assistance"""
        return {
            "strategic_plan": strategic_plan,
            "real_time_adjustments": real_time_context,
            "integrated_recommendation": "Adjust opening based on counterpart mood"
        }
    
    async def adaptive_negotiation(self, initial_strategy: Dict, real_time_feedback: Dict,
                                  adaptation_triggers: List[str], assistant) -> Dict[str, Any]:
        """Adapt negotiation strategy based on real-time feedback"""
        adaptations = {}
        
        if "counterpart_reaction" in adaptation_triggers and real_time_feedback.get("effectiveness") == "low":
            adaptations["style_change"] = "More collaborative approach"
        
        if "time_pressure" in adaptation_triggers:
            adaptations["pacing"] = "Accelerate concessions"
        
        return {
            "original_strategy": initial_strategy,
            "adaptations": adaptations,
            "new_strategy": {**initial_strategy, **adaptations}
        }
    
    def _calculate_issue_value(self, issue: str, weights: Dict[str, float]) -> float:
        """Calculate value of an issue based on weights"""
        base_values = {"price_reduction": 0.8, "faster_delivery": 0.6, "extended_warranty": 0.4}
        return base_values.get(issue, 0.5) * weights.get("cost", 0.5)
    
    def _get_counterpart_factor(self, issue: str, preferences: Dict) -> float:
        """Get counterpart preference factor for issue"""
        preference_mapping = {"faster_delivery": "speed", "bulk_discount": "cost"}
        preference_key = preference_mapping.get(issue, "default")
        preference_value = preferences.get(preference_key, "medium")
        
        return 1.3 if preference_value == "high" else 1.0 if preference_value == "medium" else 0.8


class RealtimeNegotiationAssistant:
    """Real-time negotiation assistance system"""
    
    def __init__(self, config: AssistantConfig):
        self.config = config
        self.suggestion_history = []
        self.emotional_tracking = {}
        self.trust_metrics = {}
    
    async def generate_live_suggestions(self, current_context: Dict, negotiation_history: List[Dict],
                                       strategic_goals: List[str]) -> List[LiveSuggestion]:
        """Generate real-time suggestions during negotiation"""
        suggestions = []
        
        phase = current_context.get("phase", "bargaining")
        last_offer = current_context.get("last_offer", {})
        mood = current_context.get("counterpart_mood", "neutral")
        
        if phase == "bargaining" and mood == "frustrated":
            suggestions.append(LiveSuggestion(
                suggestion="Consider taking a break or switching to relationship building",
                urgency="high",
                confidence=0.8,
                rationale="Counterpart frustration may lead to deadlock",
                timing=datetime.now()
            ))
        
        if "minimize_cost" in strategic_goals and last_offer.get("price", 0) > 900000:
            suggestions.append(LiveSuggestion(
                suggestion="Counter with non-price concessions (timeline, warranty)",
                urgency="medium",
                confidence=0.7,
                rationale="Preserve price while offering value",
                timing=datetime.now()
            ))
        
        return suggestions
    
    async def analyze_counter_offer(self, counter_offer: Dict, original_offer: Dict,
                                   market_benchmarks: Dict) -> CounterOfferAnalysis:
        """Analyze incoming counter-offer"""
        offer_evaluation = {}
        
        for key, value in counter_offer.items():
            if key in original_offer:
                original_value = original_offer[key]
                if isinstance(value, (int, float)) and isinstance(original_value, (int, float)):
                    change_pct = (value - original_value) / original_value
                    offer_evaluation[key] = change_pct
            
            if key in market_benchmarks:
                benchmark = market_benchmarks[key]
                if isinstance(value, (int, float)) and isinstance(benchmark, (int, float)):
                    offer_evaluation[f"{key}_vs_market"] = (value - benchmark) / benchmark
        
        overall_value_change = offer_evaluation.get("price", 0)
        if overall_value_change < -0.1:
            recommendation = "accept"
        elif overall_value_change > 0.1:
            recommendation = "reject"
        else:
            recommendation = "counter"
        
        return CounterOfferAnalysis(
            offer_evaluation=offer_evaluation,
            acceptance_recommendation=recommendation,
            counter_proposal={"price": counter_offer.get("price", 0) * 1.05},
            risk_factors=["timeline_risk"] if counter_offer.get("timeline", 0) > 90 else []
        )
    
    async def assess_clause_risk(self, clause_text: str, clause_type: str,
                                industry_standards: Dict, precedent_outcomes: List[Dict]) -> RiskAssessment:
        """Assess risk of specific contract clause"""
        risk_indicators = {
            "limitation_of_liability": {"high_risk": ["unlimited", "no_limit"], "low_risk": ["capped", "limited"]},
            "warranty": {"high_risk": ["no_warranty", "as_is"], "low_risk": ["full_warranty", "comprehensive"]}
        }
        
        clause_risks = risk_indicators.get(clause_type, {})
        risk_level = "medium"
        
        for term in clause_risks.get("high_risk", []):
            if term.lower() in clause_text.lower():
                risk_level = "high"
                break
        
        for term in clause_risks.get("low_risk", []):
            if term.lower() in clause_text.lower():
                risk_level = "low"
                break
        
        return RiskAssessment(
            risk_level=risk_level,
            risk_factors=["liability_exposure"] if risk_level == "high" else [],
            mitigation_strategies=["Add liability cap", "Include indemnification"],
            impact_analysis={"financial": 0.8 if risk_level == "high" else 0.3}
        )
    
    async def generate_alternatives(self, sticking_point: str, current_positions: Dict,
                                   creative_options: bool, value_preservation_priority: str) -> AlternativeProposal:
        """Generate alternative proposals for sticking points"""
        proposals = []
        
        if sticking_point == "payment_terms":
            proposals.extend([
                {"option": "net-45", "rationale": "Compromise position"},
                {"option": "2% discount for net-30", "rationale": "Incentivize early payment"},
                {"option": "Progressive payments", "rationale": "Milestone-based approach"}
            ])
        
        if creative_options:
            proposals.append({"option": "Performance-based adjustment", "rationale": "Link terms to delivery performance"})
        
        return AlternativeProposal(
            proposals=proposals,
            value_preservation=0.8 if value_preservation_priority == "high" else 0.6,
            creativity_score=0.9 if creative_options else 0.5,
            implementation_difficulty="medium"
        )
    
    async def resolve_deadlocks(self, deadlock_issues: List[str], positions_summary: Dict,
                               available_strategies: List[str]) -> DeadlockResolution:
        """Resolve negotiation deadlocks"""
        resolution_strategies = []
        
        for issue in deadlock_issues:
            issue_info = positions_summary.get(issue, {})
            if issue_info.get("flexibility") == "low":
                resolution_strategies.append(f"Explore creative restructuring for {issue}")
            if issue_info.get("complexity") == "high":
                resolution_strategies.append(f"Consider expert mediation for {issue}")
        
        if "mediation" in available_strategies:
            resolution_strategies.append("Engage neutral third-party mediator")
        
        return DeadlockResolution(
            resolution_strategies=resolution_strategies,
            intervention_timing="immediate" if len(deadlock_issues) > 2 else "next_round",
            success_probability=0.7,
            escalation_options=["Management involvement", "Arbitration clause"]
        )
    
    async def analyze_emotional_tone(self, communication_samples: List[str], communication_channel: str,
                                    historical_tone_baseline: str, cultural_context: str) -> EmotionalAnalysis:
        """Analyze emotional tone of communications"""
        negative_indicators = ["disappointed", "final", "unacceptable"]
        positive_indicators = ["pleased", "value", "partnership", "excited"]
        
        sentiment_scores = []
        for sample in communication_samples:
            score = 0
            for indicator in negative_indicators:
                if indicator.lower() in sample.lower():
                    score -= 1
            for indicator in positive_indicators:
                if indicator.lower() in sample.lower():
                    score += 1
            sentiment_scores.append(score)
        
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
        
        if avg_sentiment < -0.5:
            emotional_state = "negative"
        elif avg_sentiment > 0.5:
            emotional_state = "positive"
        else:
            emotional_state = "neutral"
        
        return EmotionalAnalysis(
            emotional_state=emotional_state,
            sentiment_trend="declining" if avg_sentiment < 0 else "stable",
            stress_indicators=["final offer language"] if "final" in str(communication_samples) else [],
            relationship_impact="concerning" if emotional_state == "negative" else "stable"
        )
    
    async def assess_power_dynamics(self, party_attributes: Dict, leverage_factors: List[str],
                                   dependency_analysis: Dict) -> PowerDynamics:
        """Assess power dynamics between negotiating parties"""
        us, them = party_attributes.get("us", {}), party_attributes.get("them", {})
        our_power = (3 if us.get("market_position") == "strong" else 0) + us.get("alternatives", 0) + (2 if us.get("urgency") == "low" else 0)
        their_power = (3 if them.get("market_position") == "strong" else 0) + them.get("alternatives", 0) + (2 if them.get("urgency") == "low" else 0)
        total_power = our_power + their_power
        our_power_pct = our_power / total_power if total_power > 0 else 0.5
        
        return PowerDynamics(
            {"us": our_power_pct, "them": 1 - our_power_pct}, leverage_factors,
            {"mutual_dependency": 0.5, "our_dependency": 0.3, "their_dependency": 0.7},
            ["Leverage time pressure"] if our_power_pct > 0.6 else ["Build alternatives"]
        )
    
    async def recommend_trust_building(self, relationship_history: Dict, current_trust_level: str,
                                      trust_barriers: List[str], trust_building_opportunities: List[str]) -> TrustRecommendation:
        """Recommend trust building strategies"""
        trust_mapping = {"low": 0.3, "medium": 0.6, "high": 0.8}
        trust_score = trust_mapping.get(current_trust_level, 0.5)
        
        building_strategies = []
        if "transparency" in trust_building_opportunities:
            building_strategies.append("Share relevant information proactively")
        if "small_commitments" in trust_building_opportunities:
            building_strategies.append("Make and honor small commitments")
        if "communication_gaps" in trust_barriers:
            building_strategies.append("Establish regular communication cadence")
        
        return TrustRecommendation(trust_score, building_strategies, trust_barriers, 
                                  ["Response timeliness", "Commitment follow-through"])
    
    async def generate_negotiation_script(self, negotiation_phase: str, key_messages: List[str],
                                         counterpart_profile: Dict, cultural_adaptation: str) -> NegotiationScript:
        """Generate negotiation script for specific phase"""
        script_parts = ["Thank you for taking the time to meet with us today."]
        
        if "value_proposition" in key_messages:
            script_parts.append("We believe this partnership offers significant mutual value.")
        if counterpart_profile.get("style") == "analytical":
            script_parts.append("Let's review the data that supports our proposal.")
        if cultural_adaptation == "formal_japanese":
            script_parts.insert(0, "We are honored by this opportunity to work together.")
        
        return NegotiationScript(
            script_content=" ".join(script_parts),
            key_phrases=["mutual value", "partnership", "opportunity"],
            cultural_adaptations=["Formal honorifics", "Consensus building language"],
            timing_cues=["Pause for questions", "Allow processing time"]
        )
    
    async def track_success_probability(self, negotiation_progress: Dict, success_factors: List[str],
                                       risk_factors: List[str]) -> SuccessProbability:
        """Track probability of successful negotiation"""
        base_probability = 0.7
        issues_resolved = negotiation_progress.get("issues_resolved", 0)
        issues_remaining = negotiation_progress.get("issues_remaining", 1)
        progress_factor = issues_resolved / (issues_resolved + issues_remaining)
        satisfaction = negotiation_progress.get("satisfaction_level", "medium")
        satisfaction_factors = {"high": 0.1, "medium": 0, "low": -0.2}
        
        adjusted_probability = (base_probability + (progress_factor * 0.3) + 
                               satisfaction_factors.get(satisfaction, 0) +
                               len(success_factors) * 0.05 - len(risk_factors) * 0.05)
        final_probability = max(0.1, min(0.95, adjusted_probability))
        
        return SuccessProbability(
            current_probability=final_probability,
            trend_direction="positive" if final_probability > 0.7 else "stable",
            critical_factors=success_factors[:3],
            improvement_recommendations=["Address remaining risk factors", "Accelerate issue resolution"]
        )
    
    async def provide_strategy_feedback(self, real_time_insights: Dict, strategy_adjustments: List[str],
                                       strategy_engine) -> Dict[str, Any]:
        """Provide feedback to strategy engine"""
        return {"insights": real_time_insights, "recommended_adjustments": strategy_adjustments,
                "urgency": "high" if "time_pressure" in real_time_insights else "medium"}