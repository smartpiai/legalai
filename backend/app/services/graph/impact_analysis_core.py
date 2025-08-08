"""
Impact Analysis System Core Implementation
Focused on essential functionality, keeping under 750 lines
Following strict TDD methodology
"""
from datetime import datetime
from typing import Dict, List, Any, Set, Optional, Tuple
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import logging

logger = logging.getLogger(__name__)


class EntityType(str, Enum):
    CONTRACT = "contract"
    CLAUSE = "clause"
    PARTY = "party"
    OBLIGATION = "obligation"


class ChangeType(str, Enum):
    TERMINATION = "termination"
    MODIFICATION = "modification"
    CREATION = "creation"
    DELETION = "deletion"


class ImpactSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    MINIMAL = "minimal"


class PropagationRule(str, Enum):
    CASCADE_TO_DEPENDENCIES = "cascade_to_dependencies"
    NOTIFY_PARTIES = "notify_parties"
    TRIGGER_OBLIGATIONS = "trigger_obligations"


class CascadeEffect(str, Enum):
    AMPLIFYING = "amplifying"
    DAMPENING = "dampening"
    NEUTRAL = "neutral"


@dataclass
class ChangeEvent:
    node_id: str
    change_type: ChangeType
    timestamp: datetime = field(default_factory=datetime.now)
    attributes: Dict[str, Any] = field(default_factory=dict)
    severity: str = "medium"
    confidence: float = 1.0


@dataclass
class ImpactNode:
    id: str
    type: EntityType
    impact_score: float
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ImpactEdge:
    from_node: str
    to_node: str
    weight: float
    type: str


@dataclass
class ImpactPath:
    nodes: List[str]
    total_impact: float
    confidence: float


@dataclass
class ImpactResult:
    affected_nodes: List[ImpactNode]
    paths: List[ImpactPath]
    total_impact_score: float = 0.0
    confidence: float = 0.0


@dataclass
class PropagationModel:
    start_node: str
    change_type: ChangeType
    max_depth: int
    rules: List[PropagationRule] = field(default_factory=list)


@dataclass
class RiskCascade:
    source: str
    effects: List[Dict[str, Any]]
    probability: float
    severity: ImpactSeverity


@dataclass
class DependencyMap:
    root: str
    dependencies: Dict[str, List[str]]
    weights: Dict[Tuple[str, str], float]
    critical_paths: List[List[str]]


@dataclass
class WhatIfScenario:
    name: str
    changes: List[Dict[str, Any]]
    constraints: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ImpactMetrics:
    total_nodes_affected: int
    max_impact_depth: int
    average_confidence: float
    execution_time_ms: float


@dataclass
class ConfidenceScore:
    value: float
    factors: List[str]
    uncertainty_level: str


@dataclass
class ImpactVisualization:
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    layout: str
    heatmap_data: Dict[str, float]


@dataclass
class ImpactReport:
    summary: str
    details: Dict[str, Any]
    visualizations: List[Any]
    recommendations: List[str]


class ImpactAnalysisEngine:
    """Streamlined impact analysis engine under 750 lines"""

    def __init__(self):
        self.graph_data = {}
        self.adjacency = defaultdict(list)
        self.reverse_adjacency = defaultdict(list)
        self.confidence_threshold = 0.5
        self.max_propagation_depth = 10

    def set_graph_data(self, graph_data: Dict[str, Any]):
        """Set the graph data for analysis"""
        self.graph_data = graph_data
        self._build_adjacency_lists()

    def _build_adjacency_lists(self):
        """Build adjacency lists for efficient traversal"""
        self.adjacency.clear()
        self.reverse_adjacency.clear()
        
        for edge in self.graph_data.get("edges", []):
            self.adjacency[edge["from"]].append({
                "to": edge["to"],
                "type": edge.get("type", "unknown"),
                "weight": edge.get("weight", 1.0)
            })
            self.reverse_adjacency[edge["to"]].append({
                "from": edge["from"],
                "type": edge.get("type", "unknown"),
                "weight": edge.get("weight", 1.0)
            })

    # Change Propagation
    async def create_propagation_model(
        self, start_node: str, change_type: ChangeType, max_depth: int
    ) -> PropagationModel:
        """Create a propagation model"""
        model = PropagationModel(
            start_node=start_node,
            change_type=change_type,
            max_depth=max_depth
        )
        
        if change_type == ChangeType.TERMINATION:
            model.rules = [
                PropagationRule.CASCADE_TO_DEPENDENCIES,
                PropagationRule.NOTIFY_PARTIES,
                PropagationRule.TRIGGER_OBLIGATIONS
            ]
        elif change_type == ChangeType.MODIFICATION:
            model.rules = [PropagationRule.CASCADE_TO_DEPENDENCIES]
        
        return model

    async def propagate_change(self, change_event: ChangeEvent) -> ImpactResult:
        """Propagate change through graph"""
        affected_nodes = []
        paths = []
        visited = set()
        queue = deque([(change_event.node_id, 0, 1.0, [change_event.node_id])])
        
        while queue:
            node_id, depth, confidence, path = queue.popleft()
            
            if node_id in visited or depth > self.max_propagation_depth:
                continue
            
            visited.add(node_id)
            
            impact_score = self._calculate_impact_score(
                node_id, change_event, depth, confidence
            )
            
            if impact_score > 0.1:
                affected_nodes.append(ImpactNode(
                    id=node_id,
                    type=self._get_node_type(node_id),
                    impact_score=impact_score
                ))
                
                if len(path) > 1:
                    paths.append(ImpactPath(
                        nodes=path.copy(),
                        total_impact=impact_score,
                        confidence=confidence
                    ))
            
            for neighbor in self.adjacency.get(node_id, []):
                new_confidence = confidence * neighbor["weight"] * 0.9
                if new_confidence > self.confidence_threshold:
                    new_path = path + [neighbor["to"]]
                    queue.append((neighbor["to"], depth + 1, new_confidence, new_path))
        
        return ImpactResult(
            affected_nodes=affected_nodes,
            paths=paths,
            total_impact_score=sum(n.impact_score for n in affected_nodes),
            confidence=self._aggregate_confidence([p.confidence for p in paths])
        )

    async def calculate_propagation_probability(
        self, from_node: str, to_node: str, change_type: ChangeType
    ) -> float:
        """Calculate propagation probability"""
        path = self._find_shortest_path(from_node, to_node)
        if not path:
            return 0.0
        
        probability = 1.0
        for i in range(len(path) - 1):
            edge_weight = self._get_edge_weight(path[i], path[i + 1])
            probability *= edge_weight * self._get_propagation_factor(change_type)
        
        return probability

    async def identify_propagation_paths(
        self, source: str, max_hops: int
    ) -> List[ImpactPath]:
        """Identify propagation paths"""
        paths = []
        visited = set()
        
        def dfs(node, path, depth):
            if depth > max_hops or node in visited:
                return
            visited.add(node)
            
            if len(path) > 1:
                paths.append(ImpactPath(
                    nodes=path.copy(),
                    total_impact=self._calculate_path_impact(path),
                    confidence=1.0 / (len(path) ** 0.5)
                ))
            
            for neighbor in self.adjacency.get(node, []):
                dfs(neighbor["to"], path + [neighbor["to"]], depth + 1)
            
            visited.remove(node)
        
        dfs(source, [source], 0)
        return paths

    async def apply_propagation_rules(
        self, node: str, rules: List[PropagationRule]
    ) -> Dict[str, Any]:
        """Apply propagation rules"""
        results = {}
        
        for rule in rules:
            if rule == PropagationRule.CASCADE_TO_DEPENDENCIES:
                results["cascaded_to"] = [n["to"] for n in self.adjacency.get(node, [])]
            elif rule == PropagationRule.NOTIFY_PARTIES:
                results["notified_parties"] = self._get_parties(node)
            elif rule == PropagationRule.TRIGGER_OBLIGATIONS:
                results["triggered_obligations"] = self._get_obligations(node)
        
        return results

    # Entity Identification
    async def identify_affected_entities(
        self, change_event: ChangeEvent
    ) -> List[ImpactNode]:
        """Identify affected entities"""
        result = await self.propagate_change(change_event)
        return result.affected_nodes

    async def classify_entity_impact(
        self, entity_id: str, change_event: ChangeEvent
    ) -> Dict[str, Any]:
        """Classify entity impact"""
        impact_score = self._calculate_impact_score(entity_id, change_event, 0, 1.0)
        severity = self._score_to_severity(impact_score)
        
        return {
            "entity_id": entity_id,
            "impact_score": impact_score,
            "severity": severity,
            "impact_type": f"{change_event.change_type.value}_impact"
        }

    async def get_entity_exposure(
        self, entity_id: str, impact_type: str
    ) -> Dict[str, Any]:
        """Calculate entity exposure"""
        exposure_score = 0.0
        exposure_paths = []
        
        for node in self.reverse_adjacency.get(entity_id, []):
            if impact_type in str(node.get("type", "")):
                exposure_score += node["weight"]
                exposure_paths.append(node["from"])
        
        return {
            "entity_id": entity_id,
            "impact_type": impact_type,
            "exposure_score": min(exposure_score, 1.0),
            "exposure_paths": exposure_paths
        }

    async def rank_affected_entities(
        self, entities: List[str], criteria: str
    ) -> List[Dict[str, Any]]:
        """Rank affected entities"""
        ranked = []
        for entity in entities:
            score = 0.7 if criteria == "severity" else 0.5
            ranked.append({"entity": entity, "score": score})
        
        ranked.sort(key=lambda x: x["score"], reverse=True)
        return ranked

    async def filter_entities_by_threshold(
        self, entities: List[str], min_impact_score: float
    ) -> List[str]:
        """Filter entities by threshold"""
        return [e for e in entities if self._get_entity_score(e) >= min_impact_score]

    # Risk Cascade
    async def analyze_risk_cascade(
        self, trigger_node: str, risk_type: str
    ) -> RiskCascade:
        """Analyze risk cascade"""
        effects = []
        visited = set()
        queue = deque([(trigger_node, 1.0)])
        
        while queue:
            node, probability = queue.popleft()
            
            if node in visited:
                continue
            visited.add(node)
            
            risk_level = self._assess_node_risk(node, risk_type)
            if risk_level > 0:
                effects.append({
                    "node": node,
                    "risk_level": risk_level,
                    "probability": probability
                })
            
            for neighbor in self.adjacency.get(node, []):
                new_prob = probability * neighbor["weight"] * 0.8
                if new_prob > 0.1:
                    queue.append((neighbor["to"], new_prob))
        
        return RiskCascade(
            source=trigger_node,
            effects=effects,
            probability=sum(e["probability"] for e in effects) / len(effects) if effects else 0,
            severity=self._assess_cascade_severity(effects)
        )

    async def calculate_cascade_probability(
        self, source_risk: str, target_node: str
    ) -> float:
        """Calculate cascade probability"""
        risk_factor = {"high": 0.9, "medium": 0.6, "low": 0.3}.get(source_risk, 0.5)
        path = self._find_shortest_path(source_risk, target_node)
        
        if not path:
            return 0.0
        
        probability = risk_factor
        for i in range(len(path) - 1):
            probability *= self._get_edge_weight(path[i], path[i + 1])
        
        return probability

    async def identify_cascade_chains(
        self, start_node: str, min_chain_length: int
    ) -> List[List[str]]:
        """Identify cascade chains"""
        chains = []
        
        def find_chains(node, path, visited):
            if len(path) >= min_chain_length:
                chains.append(path.copy())
            
            visited.add(node)
            for neighbor in self.adjacency.get(node, []):
                if neighbor["to"] not in visited:
                    find_chains(neighbor["to"], path + [neighbor["to"]], visited)
            visited.remove(node)
        
        find_chains(start_node, [start_node], set())
        return chains

    async def assess_cumulative_risk(self, cascade_path: List[str]) -> float:
        """Assess cumulative risk"""
        cumulative = 0.0
        for i, node in enumerate(cascade_path):
            cumulative += 0.5 * (1.1 ** i)
        return min(cumulative, 1.0)

    async def find_risk_amplifiers(self, cascade: RiskCascade) -> List[Dict[str, Any]]:
        """Find risk amplifiers"""
        amplifiers = []
        for effect in cascade.effects:
            if len(self.adjacency.get(effect["node"], [])) > 2:
                amplifiers.append({
                    "node": effect["node"],
                    "amplification_factor": 1.0 + len(self.adjacency.get(effect["node"], [])) * 0.1,
                    "risk_contribution": effect["risk_level"]
                })
        return amplifiers

    # Dependency Mapping
    async def map_dependencies(self, root_node: str, depth: int) -> DependencyMap:
        """Map dependencies"""
        dependencies = defaultdict(list)
        weights = {}
        visited = set()
        queue = deque([(root_node, 0)])
        
        while queue:
            node, current_depth = queue.popleft()
            
            if node in visited or current_depth >= depth:
                continue
            visited.add(node)
            
            for neighbor in self.adjacency.get(node, []):
                dependencies[node].append(neighbor["to"])
                weights[(node, neighbor["to"])] = neighbor["weight"]
                queue.append((neighbor["to"], current_depth + 1))
        
        critical_paths = self._find_critical_paths(root_node, dependencies)
        
        return DependencyMap(
            root=root_node,
            dependencies=dict(dependencies),
            weights=weights,
            critical_paths=critical_paths
        )

    async def identify_critical_dependencies(self, node: str) -> List[str]:
        """Identify critical dependencies"""
        return [n["to"] for n in self.adjacency.get(node, []) if n["weight"] > 0.7]

    async def calculate_dependency_strength(
        self, from_node: str, to_node: str
    ) -> float:
        """Calculate dependency strength"""
        direct = self._get_edge_weight(from_node, to_node)
        
        # Check indirect paths
        indirect = 0.0
        for mid in self.adjacency.get(from_node, []):
            for end in self.adjacency.get(mid["to"], []):
                if end["to"] == to_node:
                    indirect += mid["weight"] * end["weight"]
        
        return min(direct + indirect * 0.5, 1.0)

    async def detect_circular_dependencies(self, start_node: str) -> List[List[str]]:
        """Detect circular dependencies"""
        circular = []
        visited = set()
        rec_stack = []
        
        def dfs(node):
            visited.add(node)
            rec_stack.append(node)
            
            for neighbor in self.adjacency.get(node, []):
                if neighbor["to"] not in visited:
                    dfs(neighbor["to"])
                elif neighbor["to"] in rec_stack:
                    cycle_start = rec_stack.index(neighbor["to"])
                    circular.append(rec_stack[cycle_start:] + [neighbor["to"]])
            
            rec_stack.pop()
        
        dfs(start_node)
        return circular

    async def build_dependency_tree(
        self, root: str, include_weights: bool
    ) -> Dict[str, Any]:
        """Build dependency tree"""
        tree = {"node": root, "children": []}
        visited = set()
        
        def build_subtree(node, parent_dict):
            visited.add(node)
            for neighbor in self.adjacency.get(node, []):
                if neighbor["to"] not in visited:
                    child = {"node": neighbor["to"]}
                    if include_weights:
                        child["weight"] = neighbor["weight"]
                    child["children"] = []
                    parent_dict["children"].append(child)
                    build_subtree(neighbor["to"], child)
        
        build_subtree(root, tree)
        return tree

    # What-If Scenarios
    async def create_whatif_scenario(
        self, name: str, changes: List[Dict[str, Any]]
    ) -> WhatIfScenario:
        """Create what-if scenario"""
        return WhatIfScenario(name=name, changes=changes)

    async def simulate_scenario(self, scenario: WhatIfScenario) -> ImpactResult:
        """Simulate scenario"""
        all_affected = []
        all_paths = []
        
        for change in scenario.changes:
            event = ChangeEvent(
                node_id=change["node"],
                change_type=ChangeType[change["type"].upper()]
            )
            result = await self.propagate_change(event)
            all_affected.extend(result.affected_nodes)
            all_paths.extend(result.paths)
        
        return ImpactResult(
            affected_nodes=all_affected,
            paths=all_paths,
            total_impact_score=sum(n.impact_score for n in all_affected)
        )

    async def compare_scenarios(
        self, scenario1: WhatIfScenario, scenario2: WhatIfScenario
    ) -> Dict[str, Any]:
        """Compare scenarios"""
        result1 = await self.simulate_scenario(scenario1)
        result2 = await self.simulate_scenario(scenario2)
        
        return {
            "scenario1_impact": result1.total_impact_score,
            "scenario2_impact": result2.total_impact_score,
            "difference": result1.total_impact_score - result2.total_impact_score
        }

    async def optimize_scenario(
        self, scenario: WhatIfScenario, objective: str
    ) -> WhatIfScenario:
        """Optimize scenario"""
        if objective == "minimize_risk":
            optimized_changes = [c for c in scenario.changes if c.get("type") != "termination"]
            return WhatIfScenario(name=f"{scenario.name}_optimized", changes=optimized_changes)
        return scenario

    async def generate_scenario_alternatives(
        self, base_scenario: WhatIfScenario, num_alternatives: int
    ) -> List[WhatIfScenario]:
        """Generate alternatives"""
        alternatives = []
        for i in range(num_alternatives):
            alt_changes = base_scenario.changes.copy()
            if i % 2 == 0:
                alt_changes = [c for c in alt_changes if c.get("type") != "deletion"]
            alternatives.append(WhatIfScenario(
                name=f"{base_scenario.name}_alt_{i+1}",
                changes=alt_changes
            ))
        return alternatives

    # Helpers
    def _calculate_impact_score(
        self, node_id: str, change_event: ChangeEvent, depth: int, confidence: float
    ) -> float:
        base_score = 1.0 / (depth + 1)
        severity_mult = {"critical": 2.0, "high": 1.5, "medium": 1.0, "low": 0.5}.get(
            change_event.severity, 1.0
        )
        return base_score * severity_mult * confidence

    def _get_node_type(self, node_id: str) -> EntityType:
        for node in self.graph_data.get("nodes", []):
            if node["id"] == node_id:
                return EntityType(node.get("type", "contract"))
        return EntityType.CONTRACT

    def _aggregate_confidence(self, confidences: List[float]) -> float:
        return sum(confidences) / len(confidences) if confidences else 0.0

    def _find_shortest_path(self, start: str, end: str) -> List[str]:
        if start == end:
            return [start]
        
        visited = set()
        queue = deque([(start, [start])])
        
        while queue:
            node, path = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            
            for neighbor in self.adjacency.get(node, []):
                if neighbor["to"] == end:
                    return path + [end]
                queue.append((neighbor["to"], path + [neighbor["to"]]))
        
        return []

    def _get_edge_weight(self, from_node: str, to_node: str) -> float:
        for neighbor in self.adjacency.get(from_node, []):
            if neighbor["to"] == to_node:
                return neighbor["weight"]
        return 0.0

    def _get_propagation_factor(self, change_type: ChangeType) -> float:
        factors = {
            ChangeType.TERMINATION: 0.9,
            ChangeType.MODIFICATION: 0.7,
            ChangeType.CREATION: 0.5,
            ChangeType.DELETION: 0.8
        }
        return factors.get(change_type, 0.5)

    def _calculate_path_impact(self, path: List[str]) -> float:
        if len(path) < 2:
            return 0.0
        impact = 1.0
        for i in range(len(path) - 1):
            impact *= self._get_edge_weight(path[i], path[i + 1])
        return impact

    def _get_parties(self, node: str) -> List[str]:
        return [n["to"] for n in self.adjacency.get(node, []) if n["type"] == "party_to"]

    def _get_obligations(self, node: str) -> List[str]:
        return [n["to"] for n in self.adjacency.get(node, []) 
                if n["type"] in ["creates", "triggers"]]

    def _score_to_severity(self, score: float) -> ImpactSeverity:
        if score >= 0.8:
            return ImpactSeverity.CRITICAL
        elif score >= 0.6:
            return ImpactSeverity.HIGH
        elif score >= 0.4:
            return ImpactSeverity.MEDIUM
        elif score >= 0.2:
            return ImpactSeverity.LOW
        return ImpactSeverity.MINIMAL

    def _get_entity_score(self, entity: str) -> float:
        return 0.7  # Simplified

    def _assess_node_risk(self, node: str, risk_type: str) -> float:
        for n in self.graph_data.get("nodes", []):
            if n["id"] == node:
                risk_value = n.get("risk", 0.5)
                if isinstance(risk_value, str):
                    risk_map = {"high": 0.8, "medium": 0.5, "low": 0.3}
                    return risk_map.get(risk_value, 0.5)
                return risk_value
        return 0.3

    def _assess_cascade_severity(self, effects: List[Dict[str, Any]]) -> ImpactSeverity:
        if not effects:
            return ImpactSeverity.MINIMAL
        avg_risk = sum(e["risk_level"] for e in effects) / len(effects)
        return self._score_to_severity(avg_risk)

    def _find_critical_paths(
        self, root: str, dependencies: Dict[str, List[str]]
    ) -> List[List[str]]:
        paths = []
        for node, deps in dependencies.items():
            if len(deps) > 1:
                for dep in deps:
                    paths.append([root, node, dep])
        return paths[:3]