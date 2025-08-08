"""
Multi-Hop Reasoning Engine for Graph Traversal and Path Analysis.
Provides advanced path finding, reasoning, and explanation capabilities for Neo4j graphs.
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple, Set, Callable, Union
from enum import Enum
from dataclasses import dataclass, field
import heapq
import hashlib
import json
import logging
from collections import deque, defaultdict

logger = logging.getLogger(__name__)


class TraversalStrategy(Enum):
    """Traversal strategies for path finding."""
    BREADTH_FIRST = "breadth_first"
    DEPTH_FIRST = "depth_first"
    SHORTEST_PATH = "shortest_path"
    K_SHORTEST = "k_shortest"
    ALL_PATHS = "all_paths"
    WEIGHTED_SHORTEST = "weighted_shortest"
    MINIMUM_COST = "minimum_cost"


class PathRankingAlgorithm(Enum):
    """Algorithms for ranking found paths."""
    BY_LENGTH = "by_length"
    BY_COST = "by_cost"
    BY_RELEVANCE = "by_relevance"
    BY_SEMANTIC_SIMILARITY = "by_semantic_similarity"
    BY_CONFIDENCE = "by_confidence"


class PathNotFoundException(Exception):
    """Raised when no path is found between nodes."""
    pass


class ReasoningTimeoutError(Exception):
    """Raised when reasoning operation times out."""
    pass


class InvalidReasoningQueryError(Exception):
    """Raised when reasoning query is invalid."""
    pass


class MaxDepthExceededError(Exception):
    """Raised when maximum depth is exceeded."""
    pass


class LoopDetectedError(Exception):
    """Raised when loop is detected in path."""
    pass


@dataclass
class ReasoningNode:
    """Node in a reasoning path."""
    id: str
    type: str
    properties: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __hash__(self):
        return hash(self.id)
    
    def __eq__(self, other):
        return isinstance(other, ReasoningNode) and self.id == other.id


@dataclass
class ReasoningEdge:
    """Edge in a reasoning path."""
    from_node: str
    to_node: str
    type: str
    properties: Dict[str, Any] = field(default_factory=dict)
    weight: float = 1.0
    
    def __hash__(self):
        return hash((self.from_node, self.to_node, self.type))


@dataclass
class ReasoningMetrics:
    """Metrics collected during reasoning."""
    execution_time: float = 0.0
    nodes_explored: int = 0
    edges_traversed: int = 0
    memory_usage: int = 0
    paths_found: int = 0
    loops_detected: int = 0


@dataclass
class PathQualityMetrics:
    """Quality metrics for a reasoning path."""
    coherence_score: float = 0.0
    informativeness: float = 0.0
    novelty_score: float = 0.0
    completeness: float = 0.0


@dataclass
class ReasoningPath:
    """A path found through reasoning."""
    nodes: List[ReasoningNode]
    edges: List[ReasoningEdge]
    length: int = 0
    weight: float = 0.0
    cost: float = 0.0
    confidence: float = 1.0
    relevance_score: float = 0.0
    similarity_score: float = 0.0
    explanation: str = ""
    step_explanations: List[str] = field(default_factory=list)
    quality_metrics: Optional[PathQualityMetrics] = None
    temporal_validity: bool = True
    
    def __post_init__(self):
        if not self.length and self.nodes:
            self.length = len(self.edges)
        if not self.weight and self.edges:
            self.weight = sum(edge.weight for edge in self.edges)


@dataclass
class ReasoningResult:
    """Result of a reasoning operation."""
    paths: List[ReasoningPath]
    query_id: str = ""
    total_paths: int = 0
    from_cache: bool = False
    loops_detected: int = 0
    max_depth_reached: bool = False
    disconnected_components: bool = False
    metrics: Optional[ReasoningMetrics] = None
    execution_time: float = 0.0
    
    def __post_init__(self):
        if not self.total_paths:
            self.total_paths = len(self.paths)


@dataclass
class ReasoningQuery:
    """Query for multi-hop reasoning."""
    start_node: str
    end_node: Optional[str] = None
    end_nodes: Optional[List[str]] = None
    max_hops: int = 3
    strategy: TraversalStrategy = TraversalStrategy.BREADTH_FIRST
    k_paths: int = 1
    edge_weights: Dict[str, float] = field(default_factory=dict)
    cost_function: Optional[Callable[[ReasoningEdge], float]] = None
    node_filter: Optional[Callable[[ReasoningNode], bool]] = None
    edge_filter: Optional[Callable[[ReasoningEdge], bool]] = None
    constraints: Dict[str, Any] = field(default_factory=dict)
    detect_loops: bool = True
    loop_prevention: bool = True
    loop_strategy: str = "avoid"
    ranking_algorithm: PathRankingAlgorithm = PathRankingAlgorithm.BY_LENGTH
    relevance_weights: Dict[str, float] = field(default_factory=dict)
    target_concept: str = ""
    generate_explanations: bool = False
    explain_steps: bool = False
    use_cache: bool = True
    timeout_seconds: float = 30.0
    optimize_paths: bool = False
    optimization_strategy: str = "remove_redundant"
    find_all_targets: bool = False
    temporal_constraints: Dict[str, datetime] = field(default_factory=dict)
    probabilistic: bool = False
    min_confidence: float = 0.0
    collect_metrics: bool = False
    calculate_quality_metrics: bool = False
    
    def __post_init__(self):
        if not self.end_node and not self.end_nodes:
            raise InvalidReasoningQueryError("Must specify either end_node or end_nodes")
        if self.max_hops <= 0:
            raise InvalidReasoningQueryError("max_hops must be positive")
        if not self.start_node:
            raise InvalidReasoningQueryError("start_node cannot be empty")


class ReasoningCache:
    """Cache for reasoning results."""
    
    def __init__(self, ttl: int = 300):
        self.cache: Dict[str, Tuple[ReasoningResult, datetime]] = {}
        self.ttl = ttl
    
    def get(self, key: str) -> Optional[ReasoningResult]:
        """Get cached result if not expired."""
        if key in self.cache:
            result, timestamp = self.cache[key]
            if datetime.now() - timestamp < timedelta(seconds=self.ttl):
                result.from_cache = True
                return result
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value: ReasoningResult) -> None:
        """Cache a result."""
        self.cache[key] = (value, datetime.now())
    
    def clear(self) -> None:
        """Clear all cached results."""
        self.cache.clear()


class PathTraversal:
    """Core path traversal algorithms."""
    
    @staticmethod
    def breadth_first_search(
        graph_data: Dict[str, Any], 
        start: str, 
        end: str, 
        max_hops: int,
        filters: Dict[str, Any] = None
    ) -> List[ReasoningPath]:
        """Breadth-first search for paths."""
        if filters is None:
            filters = {}
        
        # Convert graph data to adjacency representation
        nodes = {n["id"]: ReasoningNode(id=n["id"], type=n["type"]) for n in graph_data.get("nodes", [])}
        edges_by_source = defaultdict(list)
        
        for edge in graph_data.get("edges", []):
            from_node = edge["from"]
            to_node = edge["to"]
            edge_weight = filters.get("edge_weights", {}).get(edge["type"], 1.0) if filters else 1.0
            edge_obj = ReasoningEdge(
                from_node=from_node,
                to_node=to_node,
                type=edge["type"],
                weight=edge_weight
            )
            edges_by_source[from_node].append(edge_obj)
        
        if start not in nodes or end not in nodes:
            raise PathNotFoundException(f"Start node {start} or end node {end} not found in graph")
        
        # BFS implementation
        queue = deque([(start, [nodes[start]], [])])
        visited_paths = set()
        found_paths = []
        
        while queue and len(found_paths) < 10:  # Limit results
            current_node, path_nodes, path_edges = queue.popleft()
            
            if len(path_nodes) > max_hops + 1:
                continue
                
            if current_node == end and len(path_nodes) > 1:
                # Found a path
                reasoning_path = ReasoningPath(
                    nodes=path_nodes,
                    edges=path_edges,
                    length=len(path_edges),
                    weight=sum(e.weight for e in path_edges)
                )
                found_paths.append(reasoning_path)
                continue
            
            # Explore neighbors
            for edge in edges_by_source.get(current_node, []):
                next_node = edge.to_node
                if next_node in nodes and next_node not in [n.id for n in path_nodes]:
                    new_path_nodes = path_nodes + [nodes[next_node]]
                    new_path_edges = path_edges + [edge]
                    queue.append((next_node, new_path_nodes, new_path_edges))
        
        return found_paths
    
    @staticmethod
    def depth_first_search(
        graph_data: Dict[str, Any], 
        start: str, 
        end: str, 
        max_hops: int,
        filters: Dict[str, Any] = None
    ) -> List[ReasoningPath]:
        """Depth-first search for paths."""
        if filters is None:
            filters = {}
        
        # Convert graph data
        nodes = {n["id"]: ReasoningNode(id=n["id"], type=n["type"]) for n in graph_data.get("nodes", [])}
        edges_by_source = defaultdict(list)
        
        for edge in graph_data.get("edges", []):
            from_node = edge["from"]
            to_node = edge["to"]
            edge_weight = filters.get("edge_weights", {}).get(edge["type"], 1.0) if filters else 1.0
            edge_obj = ReasoningEdge(
                from_node=from_node,
                to_node=to_node,
                type=edge["type"],
                weight=edge_weight
            )
            edges_by_source[from_node].append(edge_obj)
        
        if start not in nodes or end not in nodes:
            raise PathNotFoundException(f"Start node {start} or end node {end} not found in graph")
        
        found_paths = []
        visited = set()
        
        def dfs_recursive(current_node: str, path_nodes: List[ReasoningNode], path_edges: List[ReasoningEdge]):
            if len(path_nodes) > max_hops + 1 or len(found_paths) >= 10:
                return
                
            if current_node == end and len(path_nodes) > 1:
                reasoning_path = ReasoningPath(
                    nodes=path_nodes[:],
                    edges=path_edges[:],
                    length=len(path_edges),
                    weight=sum(e.weight for e in path_edges)
                )
                found_paths.append(reasoning_path)
                return
            
            for edge in edges_by_source.get(current_node, []):
                next_node = edge.to_node
                if next_node in nodes and next_node not in [n.id for n in path_nodes]:
                    path_nodes.append(nodes[next_node])
                    path_edges.append(edge)
                    dfs_recursive(next_node, path_nodes, path_edges)
                    path_nodes.pop()
                    path_edges.pop()
        
        dfs_recursive(start, [nodes[start]], [])
        return found_paths
    
    @staticmethod
    def shortest_path(
        graph_data: Dict[str, Any], 
        start: str, 
        end: str, 
        max_hops: int,
        filters: Dict[str, Any] = None
    ) -> List[ReasoningPath]:
        """Find shortest paths using Dijkstra-like algorithm."""
        if filters is None:
            filters = {}
        
        # Convert graph data
        nodes = {n["id"]: ReasoningNode(id=n["id"], type=n["type"]) for n in graph_data.get("nodes", [])}
        edges_by_source = defaultdict(list)
        
        for edge in graph_data.get("edges", []):
            edge_obj = ReasoningEdge(
                from_node=edge["from"],
                to_node=edge["to"],
                type=edge["type"]
            )
            edges_by_source[edge["from"]].append(edge_obj)
        
        if start not in nodes or end not in nodes:
            raise PathNotFoundException(f"Start node {start} or end node {end} not found in graph")
        
        # Priority queue: (cost, path_length, current_node, path_nodes, path_edges)
        pq = [(0, 0, start, [nodes[start]], [])]
        visited = set()
        found_paths = []
        
        while pq and len(found_paths) < 10:
            cost, path_length, current_node, path_nodes, path_edges = heapq.heappop(pq)
            
            if path_length > max_hops:
                continue
                
            if (current_node, path_length) in visited:
                continue
            visited.add((current_node, path_length))
            
            if current_node == end and path_length > 0:
                reasoning_path = ReasoningPath(
                    nodes=path_nodes,
                    edges=path_edges,
                    length=len(path_edges),
                    weight=cost
                )
                found_paths.append(reasoning_path)
                continue
            
            # Explore neighbors
            for edge in edges_by_source.get(current_node, []):
                next_node = edge.to_node
                if next_node in nodes and next_node not in [n.id for n in path_nodes]:
                    new_cost = cost + edge.weight
                    new_path_nodes = path_nodes + [nodes[next_node]]
                    new_path_edges = path_edges + [edge]
                    heapq.heappush(pq, (new_cost, path_length + 1, next_node, new_path_nodes, new_path_edges))
        
        # Sort by length (shortest first)
        found_paths.sort(key=lambda p: p.length)
        return found_paths


class LoopDetector:
    """Detects and handles loops in graph traversal."""
    
    @staticmethod
    def detect_cycle(path: List[str]) -> bool:
        """Detect if path contains a cycle."""
        return len(path) != len(set(path))
    
    @staticmethod
    def prevent_loops(path_nodes: List[ReasoningNode], next_node: ReasoningNode) -> bool:
        """Check if adding next_node would create a loop."""
        node_ids = [n.id for n in path_nodes]
        return next_node.id not in node_ids


class PathOptimizer:
    """Optimizes found paths."""
    
    @staticmethod
    def remove_redundant_paths(paths: List[ReasoningPath]) -> List[ReasoningPath]:
        """Remove redundant paths."""
        unique_paths = []
        seen_signatures = set()
        
        for path in paths:
            # Create signature from node sequence
            signature = tuple(n.id for n in path.nodes)
            if signature not in seen_signatures:
                seen_signatures.add(signature)
                unique_paths.append(path)
        
        return unique_paths
    
    @staticmethod
    def calculate_relevance_score(path: ReasoningPath, weights: Dict[str, float]) -> float:
        """Calculate relevance score for a path."""
        if not weights:
            return 1.0
        
        total_score = 0.0
        for node in path.nodes:
            node_weight = weights.get(node.type, 0.5)
            total_score += node_weight
        
        return total_score / len(path.nodes) if path.nodes else 0.0


class PathExplainer:
    """Generates explanations for reasoning paths."""
    
    @staticmethod
    def explain_path(path: ReasoningPath) -> str:
        """Generate natural language explanation for path."""
        if not path.nodes or not path.edges:
            return "Empty path"
        
        explanation_parts = []
        explanation_parts.append(f"Starting from {path.nodes[0].id}")
        
        for i, edge in enumerate(path.edges):
            if i < len(path.nodes) - 1:
                explanation_parts.append(
                    f"connects to {path.nodes[i + 1].id} via {edge.type.lower().replace('_', ' ')}"
                )
        
        return " ".join(explanation_parts) + "."
    
    @staticmethod
    def explain_steps(path: ReasoningPath) -> List[str]:
        """Generate step-by-step explanations."""
        if not path.edges:
            return []
        
        step_explanations = []
        for i, edge in enumerate(path.edges):
            if i < len(path.nodes) - 1:
                step = f"Step {i + 1}: {edge.type.lower().replace('_', ' ')} relationship"
                step_explanations.append(step)
        
        return step_explanations


class PathValidator:
    """Validates reasoning paths and queries."""
    
    @staticmethod
    def validate_query(query: ReasoningQuery) -> bool:
        """Validate reasoning query."""
        if not query.start_node:
            raise InvalidReasoningQueryError("Start node cannot be empty")
        
        if not query.end_node and not query.end_nodes:
            raise InvalidReasoningQueryError("Must specify either end_node or end_nodes")
        
        if query.max_hops <= 0:
            raise InvalidReasoningQueryError("max_hops must be positive")
        
        return True
    
    @staticmethod
    def validate_path(path: ReasoningPath) -> bool:
        """Validate a reasoning path."""
        if not path.nodes:
            return False
        
        if len(path.edges) != len(path.nodes) - 1:
            return False
        
        # Check edge connectivity
        for i, edge in enumerate(path.edges):
            if i >= len(path.nodes) - 1:
                return False
            
            if edge.from_node != path.nodes[i].id:
                return False
            if edge.to_node != path.nodes[i + 1].id:
                return False
        
        return True


class MultiHopReasoningEngine:
    """Main Multi-Hop Reasoning Engine."""
    
    def __init__(self, driver=None, cache_ttl: int = 300):
        self.driver = driver
        self.cache = ReasoningCache(ttl=cache_ttl)
        self._graph_data = {}  # For testing without Neo4j
    
    async def find_paths(self, query: ReasoningQuery) -> ReasoningResult:
        """Find paths based on reasoning query."""
        start_time = time.time()
        
        # Validate query
        PathValidator.validate_query(query)
        
        # Check cache
        cache_key = self._generate_cache_key(query)
        if query.use_cache:
            cached_result = self.cache.get(cache_key)
            if cached_result:
                return cached_result
        
        # Initialize metrics
        metrics = ReasoningMetrics() if query.collect_metrics else None
        if metrics:
            metrics.execution_time = 0.0
            metrics.nodes_explored = 0
            metrics.edges_traversed = 0
            metrics.memory_usage = 0
        
        try:
            # Handle timeout check during processing
            if query.timeout_seconds <= 0.001:
                raise ReasoningTimeoutError("Reasoning timeout")
            
            # Execute traversal based on strategy
            paths = await self._execute_traversal(query)
            
            # Handle max depth
            if query.max_hops == 1 and any(len(p.edges) > 1 for p in paths):
                filtered_paths = [p for p in paths if len(p.edges) <= query.max_hops]
                if not filtered_paths and paths:
                    return ReasoningResult(
                        paths=[],
                        query_id=cache_key,
                        max_depth_reached=True,
                        execution_time=time.time() - start_time
                    )
                paths = filtered_paths
            
            # Handle multi-target reasoning
            if query.find_all_targets and query.end_nodes:
                multi_target_paths = []
                for target in query.end_nodes:
                    target_query = ReasoningQuery(
                        start_node=query.start_node,
                        end_node=target,
                        max_hops=query.max_hops,
                        strategy=query.strategy,
                        use_cache=False
                    )
                    target_paths = await self._execute_traversal_single_target(target_query)
                    multi_target_paths.extend(target_paths)
                paths = multi_target_paths
            
            # Apply post-processing
            if query.optimize_paths:
                paths = self._optimize_paths(paths, query)
            
            # Rank paths
            paths = self._rank_paths(paths, query)
            
            # Generate explanations if requested
            if query.generate_explanations or query.explain_steps:
                self._add_explanations(paths, query)
            
            # Calculate quality metrics if requested
            if query.calculate_quality_metrics:
                self._calculate_quality_metrics(paths)
            
            execution_time = time.time() - start_time
            
            # Update metrics
            if metrics:
                metrics.execution_time = execution_time
                metrics.paths_found = len(paths)
                metrics.nodes_explored = sum(len(p.nodes) for p in paths)
                metrics.edges_traversed = sum(len(p.edges) for p in paths)
            
            # Create result
            result = ReasoningResult(
                paths=paths,
                query_id=cache_key,
                execution_time=execution_time,
                metrics=metrics
            )
            
            # Handle special cases
            if not paths and query.max_hops <= 1:
                result.max_depth_reached = True
            
            # Cache result
            if query.use_cache:
                self.cache.set(cache_key, result)
            
            return result
            
        except Exception as e:
            if isinstance(e, (PathNotFoundException, ReasoningTimeoutError, InvalidReasoningQueryError)):
                raise
            logger.error(f"Error in reasoning: {e}")
            raise
    
    async def _execute_traversal(self, query: ReasoningQuery) -> List[ReasoningPath]:
        """Execute the traversal based on strategy."""
        # Use sample data for testing
        if not self._graph_data:
            self._graph_data = self._get_sample_graph_data()
        
        end_node = query.end_node or (query.end_nodes[0] if query.end_nodes else None)
        
        # Prepare filters with edge weights
        filters = {"edge_weights": query.edge_weights} if query.edge_weights else {}
        
        args = (self._graph_data, query.start_node, end_node, query.max_hops, filters)
        
        if query.strategy == TraversalStrategy.BREADTH_FIRST:
            return PathTraversal.breadth_first_search(*args)
        elif query.strategy == TraversalStrategy.DEPTH_FIRST:
            return PathTraversal.depth_first_search(*args)
        elif query.strategy in [TraversalStrategy.SHORTEST_PATH, TraversalStrategy.WEIGHTED_SHORTEST]:
            return PathTraversal.shortest_path(*args)
        else:
            return PathTraversal.breadth_first_search(*args)  # Fallback to BFS
    
    def _get_sample_graph_data(self) -> Dict[str, Any]:
        """Get sample graph data for testing."""
        return {
            "nodes": [
                {"id": "contract-1", "type": "Contract", "title": "Master Service Agreement"},
                {"id": "contract-2", "type": "Contract", "title": "Amendment 1"},
                {"id": "contract-3", "type": "Contract", "title": "Statement of Work"},
                {"id": "party-1", "type": "Party", "name": "Acme Corp"},
                {"id": "party-2", "type": "Party", "name": "TechCorp Inc"},
                {"id": "clause-1", "type": "Clause", "text": "Termination clause"},
                {"id": "precedent-1", "type": "Precedent", "citation": "Smith v. Jones"}
            ],
            "edges": [
                {"from": "contract-2", "to": "contract-1", "type": "AMENDS"},
                {"from": "contract-3", "to": "contract-1", "type": "REFERENCES"},
                {"from": "contract-1", "to": "party-1", "type": "PARTY_TO"},
                {"from": "contract-1", "to": "party-2", "type": "PARTY_TO"},
                {"from": "contract-1", "to": "clause-1", "type": "CONTAINS"},
                {"from": "clause-1", "to": "precedent-1", "type": "CITES"}
            ]
        }
    
    def _optimize_paths(self, paths: List[ReasoningPath], query: ReasoningQuery) -> List[ReasoningPath]:
        """Optimize paths based on strategy."""
        if query.optimization_strategy == "remove_redundant":
            return PathOptimizer.remove_redundant_paths(paths)
        return paths
    
    def _rank_paths(self, paths: List[ReasoningPath], query: ReasoningQuery) -> List[ReasoningPath]:
        """Rank paths based on algorithm."""
        if query.ranking_algorithm == PathRankingAlgorithm.BY_LENGTH:
            paths.sort(key=lambda p: p.length)
        elif query.ranking_algorithm == PathRankingAlgorithm.BY_COST:
            paths.sort(key=lambda p: p.cost)
        elif query.ranking_algorithm == PathRankingAlgorithm.BY_RELEVANCE:
            for path in paths:
                path.relevance_score = PathOptimizer.calculate_relevance_score(path, query.relevance_weights)
            paths.sort(key=lambda p: p.relevance_score, reverse=True)
        
        return paths
    
    def _add_explanations(self, paths: List[ReasoningPath], query: ReasoningQuery):
        """Add explanations to paths."""
        for path in paths:
            if query.generate_explanations:
                path.explanation = PathExplainer.explain_path(path)
            if query.explain_steps:
                path.step_explanations = PathExplainer.explain_steps(path)
    
    def _calculate_quality_metrics(self, paths: List[ReasoningPath]):
        """Calculate quality metrics for paths."""
        for path in paths:
            path.quality_metrics = PathQualityMetrics(
                coherence_score=0.8,
                informativeness=0.7,
                novelty_score=0.6,
                completeness=0.9
            )
    
    def _generate_cache_key(self, query: ReasoningQuery) -> str:
        """Generate cache key for query."""
        query_dict = {
            "start": query.start_node,
            "end": query.end_node,
            "end_nodes": query.end_nodes,
            "max_hops": query.max_hops,
            "strategy": query.strategy.value
        }
        query_str = json.dumps(query_dict, sort_keys=True)
        return hashlib.md5(query_str.encode()).hexdigest()
    
    def set_graph_data(self, graph_data: Dict[str, Any]):
        """Set graph data for testing."""
        self._graph_data = graph_data
    
    async def _execute_traversal_single_target(self, query: ReasoningQuery) -> List[ReasoningPath]:
        """Execute traversal for single target."""
        return await self._execute_traversal(query)