"""
Graph Analytics Engine
Provides graph algorithms, centrality measures, and pattern detection
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum
from dataclasses import dataclass, field
import logging
import networkx as nx
import numpy as np
from collections import defaultdict
from sklearn.cluster import KMeans, DBSCAN, SpectralClustering
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)


class GraphType(str, Enum):
    """Graph types"""
    DIRECTED = "directed"
    UNDIRECTED = "undirected"
    WEIGHTED = "weighted"
    TEMPORAL = "temporal"


class CentralityMeasure(str, Enum):
    """Centrality measures"""
    DEGREE = "degree"
    BETWEENNESS = "betweenness"
    CLOSENESS = "closeness"
    EIGENVECTOR = "eigenvector"
    PAGERANK = "pagerank"


@dataclass
class AnalysisConfig:
    """Analysis configuration"""
    enable_caching: bool = True
    parallel_processing: bool = True
    max_iterations: int = 1000
    convergence_threshold: float = 0.001


@dataclass
class GraphNode:
    """Graph node representation"""
    id: str
    type: str
    properties: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None


@dataclass
class GraphEdge:
    """Graph edge representation"""
    source: str
    target: str
    type: str = "connected"
    weight: float = 1.0
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphMetrics:
    """Graph metrics"""
    num_nodes: int
    num_edges: int
    density: float
    avg_degree: float
    diameter: int = 0
    avg_clustering: float = 0.0


@dataclass
class Community:
    """Community in graph"""
    id: int
    node_ids: Set[str]
    size: int
    modularity: float = 0.0
    density: float = 0.0


@dataclass
class PathResult:
    """Path finding result"""
    source: str
    target: str
    path: List[str]
    length: float
    edges: List[Tuple[str, str]] = field(default_factory=list)


@dataclass
class ClusterResult:
    """Clustering result"""
    cluster_id: int
    node_ids: Set[str]
    centroid: Optional[Dict[str, float]] = None
    size: int = 0


@dataclass
class AnomalyResult:
    """Anomaly detection result"""
    node_id: str
    anomaly_score: float
    is_anomaly: bool
    reason: str = ""


@dataclass
class PatternMatch:
    """Pattern match result"""
    pattern_id: str
    matching_nodes: List[str]
    matching_edges: List[Tuple[str, str]]
    frequency: float = 0.0
    confidence: float = 0.0


@dataclass
class TrendAnalysis:
    """Trend analysis result"""
    growth_rate: float
    trend_direction: str  # increasing, decreasing, stable
    seasonality: Optional[Dict[str, Any]] = None
    forecast: Optional[List[float]] = None


@dataclass
class PredictionResult:
    """Prediction result"""
    source: str
    target: str
    prediction_type: str
    probability: float
    confidence: float = 0.0


@dataclass
class RiskPropagation:
    """Risk propagation result"""
    risk_scores: Dict[str, float]
    propagation_path: List[str]
    total_risk: float
    iterations: int = 0


@dataclass
class ImpactAnalysis:
    """Impact analysis result"""
    affected_nodes: Set[str]
    connectivity_impact: float
    path_length_increase: float
    component_changes: int = 0


@dataclass
class GraphStatistics:
    """Graph statistics"""
    num_nodes: int
    num_edges: int
    avg_degree: float
    density: float
    clustering_coefficient: float = 0.0
    assortativity: float = 0.0
    diameter: int = 0


@dataclass
class NodeImportance:
    """Node importance score"""
    node_id: str
    score: float
    rank: int
    components: Dict[str, float] = field(default_factory=dict)


class GraphAnalyticsEngine:
    """Engine for graph analytics and algorithms"""
    
    def __init__(self, config: Optional[AnalysisConfig] = None):
        self.config = config or AnalysisConfig()
        self.cache = {}
        
    def _build_networkx_graph(self, nodes: List[GraphNode], 
                             edges: List[GraphEdge], 
                             directed: bool = True) -> nx.Graph:
        """Build NetworkX graph from nodes and edges"""
        G = nx.DiGraph() if directed else nx.Graph()
        
        for node in nodes:
            G.add_node(node.id, **node.properties, type=node.type)
        
        for edge in edges:
            G.add_edge(edge.source, edge.target, weight=edge.weight, type=edge.type)
        
        return G
    
    async def calculate_centrality(self, nodes: List[GraphNode], 
                                  edges: List[GraphEdge],
                                  measure: CentralityMeasure) -> Dict[str, float]:
        """Calculate centrality measures"""
        G = self._build_networkx_graph(nodes, edges)
        
        if measure == CentralityMeasure.DEGREE:
            centrality = dict(G.degree())
            # Normalize
            max_degree = max(centrality.values()) if centrality else 1
            return {k: v/max_degree for k, v in centrality.items()}
        
        elif measure == CentralityMeasure.BETWEENNESS:
            return nx.betweenness_centrality(G)
        
        elif measure == CentralityMeasure.CLOSENESS:
            return nx.closeness_centrality(G)
        
        elif measure == CentralityMeasure.EIGENVECTOR:
            try:
                return nx.eigenvector_centrality(G, max_iter=self.config.max_iterations)
            except:
                # Fallback for convergence issues
                return {node.id: 0.1 for node in nodes}
        
        return {}
    
    async def calculate_pagerank(self, nodes: List[GraphNode], 
                                edges: List[GraphEdge],
                                damping_factor: float = 0.85) -> Dict[str, float]:
        """Calculate PageRank scores"""
        G = self._build_networkx_graph(nodes, edges)
        return nx.pagerank(G, alpha=damping_factor)
    
    async def detect_communities(self, nodes: List[GraphNode], 
                                edges: List[GraphEdge],
                                algorithm: str = "louvain") -> List[Community]:
        """Detect communities in graph"""
        G = self._build_networkx_graph(nodes, edges, directed=False)
        communities = []
        
        if algorithm == "louvain":
            import community as community_louvain
            partition = community_louvain.best_partition(G)
            
            # Group nodes by community
            comm_dict = defaultdict(set)
            for node, comm_id in partition.items():
                comm_dict[comm_id].add(node)
            
            for comm_id, node_set in comm_dict.items():
                communities.append(Community(
                    id=comm_id,
                    node_ids=node_set,
                    size=len(node_set)
                ))
        
        elif algorithm == "label_propagation":
            from networkx.algorithms.community import label_propagation_communities
            comm_gen = label_propagation_communities(G)
            
            for i, node_set in enumerate(comm_gen):
                communities.append(Community(
                    id=i,
                    node_ids=node_set,
                    size=len(node_set)
                ))
        
        return communities
    
    async def calculate_modularity(self, nodes: List[GraphNode], 
                                  edges: List[GraphEdge],
                                  communities: List[Community]) -> float:
        """Calculate modularity score"""
        G = self._build_networkx_graph(nodes, edges, directed=False)
        
        # Convert communities to partition format
        partition = []
        for community in communities:
            partition.append(community.node_ids)
        
        return nx.algorithms.community.modularity(G, partition)
    
    async def detect_overlapping_communities(self, nodes: List[GraphNode], 
                                           edges: List[GraphEdge],
                                           min_size: int = 2) -> List[Community]:
        """Detect overlapping communities"""
        G = self._build_networkx_graph(nodes, edges, directed=False)
        
        # Use k-clique communities for overlapping detection
        from networkx.algorithms.community import k_clique_communities
        
        communities = []
        for i, nodes_set in enumerate(k_clique_communities(G, min_size)):
            communities.append(Community(
                id=i,
                node_ids=nodes_set,
                size=len(nodes_set)
            ))
        
        return communities
    
    async def hierarchical_clustering(self, nodes: List[GraphNode], 
                                     edges: List[GraphEdge],
                                     levels: int = 2) -> Dict[str, List[Community]]:
        """Perform hierarchical clustering"""
        G = self._build_networkx_graph(nodes, edges, directed=False)
        
        hierarchy = {}
        current_partition = {node: i for i, node in enumerate(G.nodes())}
        
        for level in range(levels):
            # Detect communities at this level
            communities = await self.detect_communities(nodes, edges, "louvain")
            hierarchy[f"level_{level}"] = communities
            
            # Merge nodes for next level (simplified)
            if level < levels - 1:
                # Create coarsened graph for next level
                pass
        
        return hierarchy
    
    async def find_shortest_path(self, nodes: List[GraphNode], 
                                edges: List[GraphEdge],
                                source: str, target: str) -> PathResult:
        """Find shortest path between nodes"""
        G = self._build_networkx_graph(nodes, edges)
        
        try:
            path = nx.shortest_path(G, source, target, weight='weight')
            length = nx.shortest_path_length(G, source, target, weight='weight')
            
            edges_list = [(path[i], path[i+1]) for i in range(len(path)-1)]
            
            return PathResult(
                source=source,
                target=target,
                path=path,
                length=length,
                edges=edges_list
            )
        except nx.NetworkXNoPath:
            return PathResult(source=source, target=target, path=[], length=float('inf'))
    
    async def find_all_shortest_paths(self, nodes: List[GraphNode], 
                                     edges: List[GraphEdge],
                                     source: str, target: str) -> List[PathResult]:
        """Find all shortest paths"""
        G = self._build_networkx_graph(nodes, edges)
        
        paths = []
        try:
            for path in nx.all_shortest_paths(G, source, target, weight='weight'):
                length = nx.shortest_path_length(G, source, target, weight='weight')
                edges_list = [(path[i], path[i+1]) for i in range(len(path)-1)]
                
                paths.append(PathResult(
                    source=source,
                    target=target,
                    path=path,
                    length=length,
                    edges=edges_list
                ))
        except nx.NetworkXNoPath:
            pass
        
        return paths
    
    async def find_k_shortest_paths(self, nodes: List[GraphNode], 
                                   edges: List[GraphEdge],
                                   source: str, target: str, k: int = 3) -> List[PathResult]:
        """Find k shortest paths"""
        G = self._build_networkx_graph(nodes, edges)
        
        paths = []
        try:
            # Use simple shortest paths for now
            all_paths = list(nx.all_simple_paths(G, source, target))
            all_paths.sort(key=lambda p: sum(G[p[i]][p[i+1]]['weight'] 
                                            for i in range(len(p)-1)))
            
            for path in all_paths[:k]:
                length = sum(G[path[i]][path[i+1]]['weight'] 
                           for i in range(len(path)-1))
                edges_list = [(path[i], path[i+1]) for i in range(len(path)-1)]
                
                paths.append(PathResult(
                    source=source,
                    target=target,
                    path=path,
                    length=length,
                    edges=edges_list
                ))
        except:
            pass
        
        return paths
    
    async def find_connected_components(self, nodes: List[GraphNode], 
                                       edges: List[GraphEdge]) -> List[Set[str]]:
        """Find connected components"""
        G = self._build_networkx_graph(nodes, edges, directed=False)
        return list(nx.connected_components(G))
    
    async def find_strongly_connected_components(self, nodes: List[GraphNode], 
                                                edges: List[GraphEdge]) -> List[Set[str]]:
        """Find strongly connected components"""
        G = self._build_networkx_graph(nodes, edges, directed=True)
        return list(nx.strongly_connected_components(G))
    
    async def cluster_nodes(self, nodes: List[GraphNode], 
                          edges: List[GraphEdge],
                          algorithm: str = "kmeans",
                          **kwargs) -> List[ClusterResult]:
        """Cluster nodes using various algorithms"""
        # Create feature matrix from node properties
        feature_matrix = []
        node_ids = []
        
        for node in nodes:
            features = [float(node.properties.get('value', 0)),
                       float(node.properties.get('risk', 0))]
            feature_matrix.append(features)
            node_ids.append(node.id)
        
        X = np.array(feature_matrix)
        
        if algorithm == "kmeans":
            n_clusters = kwargs.get('n_clusters', 3)
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            labels = kmeans.fit_predict(X)
            
        elif algorithm == "dbscan":
            eps = kwargs.get('eps', 0.5)
            min_samples = kwargs.get('min_samples', 2)
            dbscan = DBSCAN(eps=eps, min_samples=min_samples)
            labels = dbscan.fit_predict(X)
            
        elif algorithm == "spectral":
            n_clusters = kwargs.get('n_clusters', 2)
            spectral = SpectralClustering(n_clusters=n_clusters, random_state=42)
            labels = spectral.fit_predict(X)
        
        else:
            labels = [0] * len(nodes)
        
        # Group nodes by cluster
        clusters = defaultdict(set)
        for node_id, label in zip(node_ids, labels):
            clusters[label].add(node_id)
        
        results = []
        for cluster_id, node_set in clusters.items():
            results.append(ClusterResult(
                cluster_id=cluster_id,
                node_ids=node_set,
                size=len(node_set)
            ))
        
        return results
    
    async def calculate_clustering_coefficient(self, nodes: List[GraphNode], 
                                              edges: List[GraphEdge]) -> Dict[str, float]:
        """Calculate clustering coefficient"""
        G = self._build_networkx_graph(nodes, edges, directed=False)
        return nx.clustering(G)
    
    async def calculate_density(self, nodes: List[GraphNode], 
                              edges: List[GraphEdge]) -> float:
        """Calculate graph density"""
        G = self._build_networkx_graph(nodes, edges)
        return nx.density(G)
    
    async def detect_anomalies(self, nodes: List[GraphNode], 
                              edges: List[GraphEdge],
                              method: str = "isolation_forest") -> List[AnomalyResult]:
        """Detect anomalies in graph"""
        # Create feature matrix
        feature_matrix = []
        node_ids = []
        
        G = self._build_networkx_graph(nodes, edges)
        degree_centrality = dict(G.degree())
        
        for node in nodes:
            features = [
                degree_centrality.get(node.id, 0),
                float(node.properties.get('value', 0)),
                float(node.properties.get('risk', 0))
            ]
            feature_matrix.append(features)
            node_ids.append(node.id)
        
        X = np.array(feature_matrix)
        
        if method == "isolation_forest":
            clf = IsolationForest(contamination=0.1, random_state=42)
            predictions = clf.fit_predict(X)
            scores = clf.score_samples(X)
        else:
            predictions = [1] * len(nodes)
            scores = [0] * len(nodes)
        
        anomalies = []
        for node_id, pred, score in zip(node_ids, predictions, scores):
            if pred == -1:  # Anomaly
                anomalies.append(AnomalyResult(
                    node_id=node_id,
                    anomaly_score=-score,  # Convert to positive
                    is_anomaly=True,
                    reason="Statistical outlier"
                ))
        
        return anomalies
    
    async def detect_structural_anomalies(self, nodes: List[GraphNode], 
                                         edges: List[GraphEdge]) -> List[AnomalyResult]:
        """Detect structural anomalies"""
        anomalies = []
        
        # Check for unusually weighted edges
        weights = [e.weight for e in edges]
        if weights:
            mean_weight = np.mean(weights)
            std_weight = np.std(weights)
            
            for edge in edges:
                if abs(edge.weight - mean_weight) > 3 * std_weight:
                    anomalies.append(AnomalyResult(
                        node_id=f"{edge.source}-{edge.target}",
                        anomaly_score=abs(edge.weight - mean_weight) / std_weight,
                        is_anomaly=True,
                        reason="Anomalous edge weight"
                    ))
        
        return anomalies
    
    async def detect_temporal_anomalies(self, temporal_graphs: List[Dict]) -> List[AnomalyResult]:
        """Detect temporal anomalies"""
        anomalies = []
        
        # Track graph metrics over time
        metrics_over_time = []
        
        for tg in temporal_graphs:
            num_nodes = len(tg['nodes'])
            num_edges = len(tg['edges'])
            metrics_over_time.append({'nodes': num_nodes, 'edges': num_edges})
        
        # Detect sudden changes
        for i in range(1, len(metrics_over_time)):
            prev = metrics_over_time[i-1]
            curr = metrics_over_time[i]
            
            node_change = abs(curr['nodes'] - prev['nodes']) / max(prev['nodes'], 1)
            edge_change = abs(curr['edges'] - prev['edges']) / max(prev['edges'], 1)
            
            if node_change > 0.5 or edge_change > 0.5:
                anomalies.append(AnomalyResult(
                    node_id=f"time_{i}",
                    anomaly_score=max(node_change, edge_change),
                    is_anomaly=True,
                    reason="Sudden structural change"
                ))
        
        return anomalies
    
    async def detect_attribute_anomalies(self, nodes: List[GraphNode], 
                                        attribute: str) -> List[AnomalyResult]:
        """Detect anomalies in node attributes"""
        anomalies = []
        
        values = [node.properties.get(attribute, 0) for node in nodes]
        if values:
            mean_val = np.mean(values)
            std_val = np.std(values)
            
            for node in nodes:
                val = node.properties.get(attribute, 0)
                if std_val > 0 and abs(val - mean_val) > 3 * std_val:
                    anomalies.append(AnomalyResult(
                        node_id=node.id,
                        anomaly_score=abs(val - mean_val) / std_val,
                        is_anomaly=True,
                        reason=f"Anomalous {attribute} value"
                    ))
        
        return anomalies
    
    async def detect_motifs(self, nodes: List[GraphNode], 
                          edges: List[GraphEdge],
                          motif_size: int = 3) -> List[PatternMatch]:
        """Detect network motifs"""
        G = self._build_networkx_graph(nodes, edges)
        patterns = []
        
        # Find all subgraphs of given size
        from itertools import combinations
        
        for node_subset in combinations(G.nodes(), motif_size):
            subgraph = G.subgraph(node_subset)
            if subgraph.number_of_edges() >= motif_size - 1:
                patterns.append(PatternMatch(
                    pattern_id=f"motif_{len(patterns)}",
                    matching_nodes=list(node_subset),
                    matching_edges=list(subgraph.edges()),
                    frequency=1.0
                ))
        
        return patterns
    
    async def find_subgraph_matches(self, graph_nodes: List[GraphNode], 
                                   graph_edges: List[GraphEdge],
                                   pattern_nodes: List[GraphNode],
                                   pattern_edges: List[GraphEdge]) -> List[PatternMatch]:
        """Find subgraph pattern matches"""
        matches = []
        
        # Simple pattern matching based on node types
        for i, node in enumerate(graph_nodes[:-1]):
            if node.type == pattern_nodes[0].type:
                # Check if next node matches pattern
                for j, next_node in enumerate(graph_nodes[i+1:], i+1):
                    if next_node.type == pattern_nodes[1].type:
                        # Check if edge exists
                        edge_exists = any(
                            (e.source == node.id and e.target == next_node.id) or
                            (e.source == next_node.id and e.target == node.id)
                            for e in graph_edges
                        )
                        if edge_exists:
                            matches.append(PatternMatch(
                                pattern_id=f"match_{len(matches)}",
                                matching_nodes=[node.id, next_node.id],
                                matching_edges=[(node.id, next_node.id)],
                                confidence=0.9
                            ))
        
        return matches
    
    async def mine_frequent_patterns(self, nodes: List[GraphNode], 
                                    edges: List[GraphEdge],
                                    min_support: float = 0.1) -> List[PatternMatch]:
        """Mine frequent patterns"""
        patterns = []
        
        # Count edge type frequencies
        edge_types = defaultdict(int)
        for edge in edges:
            edge_types[edge.type] += 1
        
        total_edges = len(edges)
        
        for edge_type, count in edge_types.items():
            support = count / total_edges
            if support >= min_support:
                matching_edges = [(e.source, e.target) for e in edges 
                                if e.type == edge_type]
                patterns.append(PatternMatch(
                    pattern_id=f"frequent_{edge_type}",
                    matching_nodes=[],
                    matching_edges=matching_edges,
                    frequency=support
                ))
        
        return patterns
    
    async def extract_association_rules(self, nodes: List[GraphNode], 
                                       edges: List[GraphEdge],
                                       min_confidence: float = 0.5) -> List[PatternMatch]:
        """Extract association rules"""
        rules = []
        
        # Simple rule: if node has type A and connects to type B
        node_types = {node.id: node.type for node in nodes}
        
        type_connections = defaultdict(lambda: defaultdict(int))
        type_counts = defaultdict(int)
        
        for edge in edges:
            source_type = node_types.get(edge.source, "unknown")
            target_type = node_types.get(edge.target, "unknown")
            type_connections[source_type][target_type] += 1
            type_counts[source_type] += 1
        
        for source_type, targets in type_connections.items():
            for target_type, count in targets.items():
                confidence = count / type_counts[source_type]
                if confidence >= min_confidence:
                    rules.append(PatternMatch(
                        pattern_id=f"rule_{source_type}_to_{target_type}",
                        matching_nodes=[],
                        matching_edges=[],
                        frequency=count,
                        confidence=confidence
                    ))
        
        return rules
    
    async def identify_trends(self, temporal_data: List[Dict]) -> TrendAnalysis:
        """Identify trends in temporal graph data"""
        sizes = [len(tg['nodes']) for tg in temporal_data]
        
        # Calculate growth rate
        if len(sizes) > 1:
            growth_rate = (sizes[-1] - sizes[0]) / (sizes[0] if sizes[0] > 0 else 1)
        else:
            growth_rate = 0
        
        # Determine trend direction
        if growth_rate > 0.1:
            trend_direction = "increasing"
        elif growth_rate < -0.1:
            trend_direction = "decreasing"
        else:
            trend_direction = "stable"
        
        return TrendAnalysis(
            growth_rate=growth_rate,
            trend_direction=trend_direction
        )
    
    async def detect_seasonal_patterns(self, temporal_data: List[Dict]) -> Dict[str, Any]:
        """Detect seasonal patterns"""
        sizes = [len(tg['nodes']) for tg in temporal_data]
        
        # Simple seasonality detection
        if len(sizes) >= 12:
            # Check for monthly patterns
            monthly_avg = []
            for month in range(12):
                month_values = [sizes[i] for i in range(month, len(sizes), 12)]
                monthly_avg.append(np.mean(month_values))
            
            # Find peak months
            peak_month = np.argmax(monthly_avg)
            
            return {
                "seasonal_period": 12,
                "peak_period": peak_month,
                "seasonal_amplitude": max(monthly_avg) - min(monthly_avg)
            }
        
        return {"seasonal_period": None}
    
    async def detect_change_points(self, temporal_data: List[Dict]) -> List[Dict]:
        """Detect change points in temporal data"""
        change_points = []
        sizes = [len(tg['nodes']) for tg in temporal_data]
        
        # Simple change point detection
        for i in range(1, len(sizes)):
            if abs(sizes[i] - sizes[i-1]) > 0.5 * sizes[i-1]:
                change_points.append({
                    "index": i,
                    "timestamp": temporal_data[i]['timestamp'],
                    "change_magnitude": sizes[i] - sizes[i-1]
                })
        
        return change_points
    
    async def predict_links(self, nodes: List[GraphNode], 
                          edges: List[GraphEdge],
                          top_k: int = 5) -> List[PredictionResult]:
        """Predict potential new links"""
        G = self._build_networkx_graph(nodes, edges)
        predictions = []
        
        # Use common neighbors for link prediction
        non_edges = list(nx.non_edges(G))[:top_k*2]  # Get more candidates
        
        scored_pairs = []
        for u, v in non_edges:
            common = len(list(nx.common_neighbors(G, u, v)))
            total = G.degree(u) + G.degree(v)
            score = common / total if total > 0 else 0
            scored_pairs.append((u, v, score))
        
        scored_pairs.sort(key=lambda x: x[2], reverse=True)
        
        for u, v, score in scored_pairs[:top_k]:
            predictions.append(PredictionResult(
                source=u,
                target=v,
                prediction_type="link",
                probability=min(score, 1.0),
                confidence=0.7
            ))
        
        return predictions
    
    async def classify_nodes(self, nodes: List[GraphNode], 
                           edges: List[GraphEdge],
                           labeled_nodes: List[GraphNode],
                           unlabeled_nodes: List[GraphNode]) -> Dict[str, str]:
        """Classify unlabeled nodes"""
        G = self._build_networkx_graph(nodes, edges)
        classifications = {}
        
        # Simple label propagation
        labels = {node.id: node.properties.get('label') for node in labeled_nodes}
        
        for node in unlabeled_nodes:
            # Find most common label among neighbors
            neighbors = list(G.neighbors(node.id))
            neighbor_labels = [labels.get(n) for n in neighbors if n in labels]
            
            if neighbor_labels:
                from collections import Counter
                most_common = Counter(neighbor_labels).most_common(1)[0][0]
                classifications[node.id] = most_common
            else:
                classifications[node.id] = "unknown"
        
        return classifications
    
    async def predict_node_values(self, nodes: List[GraphNode], 
                                edges: List[GraphEdge],
                                target_attribute: str) -> Dict[str, float]:
        """Predict node attribute values"""
        G = self._build_networkx_graph(nodes, edges)
        predictions = {}
        
        # Get nodes with known values
        known_values = {}
        unknown_nodes = []
        
        for node in nodes:
            if target_attribute in node.properties:
                known_values[node.id] = float(node.properties[target_attribute])
            else:
                unknown_nodes.append(node.id)
        
        # Predict using neighbor averaging
        for node_id in unknown_nodes:
            neighbors = list(G.neighbors(node_id))
            neighbor_values = [known_values[n] for n in neighbors if n in known_values]
            
            if neighbor_values:
                predictions[node_id] = np.mean(neighbor_values)
            else:
                predictions[node_id] = 0.0
        
        return predictions
    
    async def forecast_graph_structure(self, historical_graphs: List[Dict], 
                                      periods_ahead: int = 3) -> List[Dict]:
        """Forecast future graph structure"""
        forecast = []
        
        # Extract historical metrics
        sizes = [len(hg['nodes']) for hg in historical_graphs]
        
        # Simple linear extrapolation
        if len(sizes) > 1:
            growth = (sizes[-1] - sizes[-2])
            
            for period in range(1, periods_ahead + 1):
                predicted_size = sizes[-1] + growth * period
                forecast.append({
                    "period": period,
                    "predicted_nodes": int(predicted_size),
                    "confidence": 0.8 - 0.1 * period
                })
        
        return forecast
    
    async def propagate_risk(self, nodes: List[GraphNode], 
                           edges: List[GraphEdge],
                           risk_sources: Dict[str, float],
                           decay_factor: float = 0.7) -> RiskPropagation:
        """Propagate risk through graph"""
        G = self._build_networkx_graph(nodes, edges)
        
        risk_scores = risk_sources.copy()
        propagation_path = list(risk_sources.keys())
        
        # Iterative risk propagation
        for _ in range(5):  # Fixed iterations
            new_scores = risk_scores.copy()
            
            for node in G.nodes():
                if node not in risk_sources:
                    neighbors = list(G.neighbors(node))
                    neighbor_risks = [risk_scores.get(n, 0) for n in neighbors]
                    
                    if neighbor_risks:
                        new_scores[node] = max(neighbor_risks) * decay_factor
                        if node not in propagation_path and new_scores[node] > 0:
                            propagation_path.append(node)
            
            risk_scores = new_scores
        
        return RiskPropagation(
            risk_scores=risk_scores,
            propagation_path=propagation_path,
            total_risk=sum(risk_scores.values()),
            iterations=5
        )
    
    async def analyze_cascading_failure(self, nodes: List[GraphNode], 
                                       edges: List[GraphEdge],
                                       failed_nodes: List[str]) -> Dict[str, Any]:
        """Analyze cascading failure impact"""
        G = self._build_networkx_graph(nodes, edges)
        
        affected = set(failed_nodes)
        
        # Find nodes that depend on failed nodes
        for failed in failed_nodes:
            if failed in G:
                # Add all neighbors
                affected.update(G.neighbors(failed))
        
        return {
            "affected_nodes": list(affected),
            "cascade_size": len(affected),
            "impact_ratio": len(affected) / len(nodes)
        }
    
    async def model_contagion(self, nodes: List[GraphNode], 
                            edges: List[GraphEdge],
                            initial_infected: Dict[str, float],
                            transmission_rate: float = 0.3,
                            recovery_rate: float = 0.1,
                            time_steps: int = 10) -> List[Dict]:
        """Model contagion spread"""
        G = self._build_networkx_graph(nodes, edges)
        
        infected = initial_infected.copy()
        recovered = {}
        results = []
        
        for step in range(time_steps):
            new_infected = infected.copy()
            
            # Spread infection
            for node in infected:
                if node in G:
                    for neighbor in G.neighbors(node):
                        if neighbor not in infected and neighbor not in recovered:
                            if np.random.random() < transmission_rate:
                                new_infected[neighbor] = 1.0
            
            # Recovery
            for node in list(infected.keys()):
                if np.random.random() < recovery_rate:
                    recovered[node] = 1.0
                    del new_infected[node]
            
            infected = new_infected
            
            results.append({
                "time_step": step,
                "infected_count": len(infected),
                "recovered_count": len(recovered)
            })
        
        return results
    
    async def assess_vulnerabilities(self, nodes: List[GraphNode], 
                                   edges: List[GraphEdge]) -> Dict[str, float]:
        """Assess node vulnerabilities"""
        G = self._build_networkx_graph(nodes, edges)
        vulnerabilities = {}
        
        for node in G.nodes():
            # Vulnerability based on centrality and connectivity
            degree = G.degree(node)
            max_degree = max(dict(G.degree()).values())
            
            vulnerability = 1.0 - (degree / max_degree if max_degree > 0 else 0)
            vulnerabilities[node] = vulnerability
        
        return vulnerabilities
    
    async def analyze_node_removal_impact(self, nodes: List[GraphNode], 
                                         edges: List[GraphEdge],
                                         node_to_remove: str) -> ImpactAnalysis:
        """Analyze impact of removing a node"""
        G = self._build_networkx_graph(nodes, edges)
        
        # Get affected nodes (neighbors)
        affected = set(G.neighbors(node_to_remove)) if node_to_remove in G else set()
        
        # Calculate connectivity impact
        original_components = nx.number_connected_components(G.to_undirected())
        G_removed = G.copy()
        G_removed.remove_node(node_to_remove)
        new_components = nx.number_connected_components(G_removed.to_undirected())
        
        return ImpactAnalysis(
            affected_nodes=affected,
            connectivity_impact=new_components - original_components,
            path_length_increase=0.1,  # Simplified
            component_changes=new_components - original_components
        )
    
    async def analyze_edge_removal_impact(self, nodes: List[GraphNode], 
                                         edges: List[GraphEdge],
                                         edge_to_remove: GraphEdge) -> ImpactAnalysis:
        """Analyze impact of removing an edge"""
        G = self._build_networkx_graph(nodes, edges)
        
        affected = {edge_to_remove.source, edge_to_remove.target}
        
        # Calculate path length increase
        G_removed = G.copy()
        if G_removed.has_edge(edge_to_remove.source, edge_to_remove.target):
            G_removed.remove_edge(edge_to_remove.source, edge_to_remove.target)
        
        return ImpactAnalysis(
            affected_nodes=affected,
            connectivity_impact=0,
            path_length_increase=0.1,  # Simplified
            component_changes=0
        )
    
    async def analyze_scenarios(self, nodes: List[GraphNode], 
                              edges: List[GraphEdge],
                              scenarios: List[Dict]) -> List[Dict]:
        """Analyze what-if scenarios"""
        results = []
        
        for scenario in scenarios:
            if scenario['action'] == 'remove_node':
                impact = await self.analyze_node_removal_impact(
                    nodes, edges, scenario['target']
                )
                results.append({
                    "scenario": scenario,
                    "impact": impact.connectivity_impact
                })
            else:
                results.append({
                    "scenario": scenario,
                    "impact": 0
                })
        
        return results
    
    async def calculate_resilience(self, nodes: List[GraphNode], 
                                 edges: List[GraphEdge]) -> Dict[str, float]:
        """Calculate graph resilience metrics"""
        G = self._build_networkx_graph(nodes, edges)
        
        # Robustness: based on connectivity
        robustness = nx.node_connectivity(G) / len(nodes) if len(nodes) > 0 else 0
        
        # Redundancy: based on alternative paths
        redundancy = len(edges) / (len(nodes) * (len(nodes) - 1) / 2) if len(nodes) > 1 else 0
        
        return {
            "robustness": min(robustness, 1.0),
            "redundancy": min(redundancy, 1.0)
        }
    
    async def calculate_statistics(self, nodes: List[GraphNode], 
                                 edges: List[GraphEdge]) -> GraphStatistics:
        """Calculate graph statistics"""
        G = self._build_networkx_graph(nodes, edges)
        
        degrees = dict(G.degree())
        avg_degree = np.mean(list(degrees.values())) if degrees else 0
        
        return GraphStatistics(
            num_nodes=len(nodes),
            num_edges=len(edges),
            avg_degree=avg_degree,
            density=nx.density(G),
            clustering_coefficient=nx.average_clustering(G.to_undirected())
        )
    
    async def calculate_degree_distribution(self, nodes: List[GraphNode], 
                                           edges: List[GraphEdge]) -> Dict[int, int]:
        """Calculate degree distribution"""
        G = self._build_networkx_graph(nodes, edges)
        
        distribution = defaultdict(int)
        for node, degree in G.degree():
            distribution[degree] += 1
        
        return dict(distribution)
    
    async def calculate_assortativity(self, nodes: List[GraphNode], 
                                     edges: List[GraphEdge]) -> float:
        """Calculate assortativity coefficient"""
        G = self._build_networkx_graph(nodes, edges)
        return nx.degree_assortativity_coefficient(G)
    
    async def calculate_diameter(self, nodes: List[GraphNode], 
                                edges: List[GraphEdge]) -> int:
        """Calculate graph diameter"""
        G = self._build_networkx_graph(nodes, edges, directed=False)
        
        if nx.is_connected(G):
            return nx.diameter(G)
        else:
            # Return diameter of largest component
            largest = max(nx.connected_components(G), key=len)
            return nx.diameter(G.subgraph(largest))
    
    async def calculate_node_importance(self, nodes: List[GraphNode], 
                                       edges: List[GraphEdge],
                                       weights: Dict[str, float]) -> Dict[str, NodeImportance]:
        """Calculate composite node importance"""
        importance = {}
        
        # Calculate different centrality measures
        degree_cent = await self.calculate_centrality(nodes, edges, CentralityMeasure.DEGREE)
        between_cent = await self.calculate_centrality(nodes, edges, CentralityMeasure.BETWEENNESS)
        pagerank = await self.calculate_pagerank(nodes, edges)
        
        for node in nodes:
            components = {
                "degree": degree_cent.get(node.id, 0),
                "betweenness": between_cent.get(node.id, 0),
                "pagerank": pagerank.get(node.id, 0)
            }
            
            # Weighted combination
            score = sum(components[k] * weights.get(k, 0) for k in components)
            
            importance[node.id] = NodeImportance(
                node_id=node.id,
                score=score,
                rank=0,  # Will be set after sorting
                components=components
            )
        
        # Assign ranks
        sorted_nodes = sorted(importance.values(), key=lambda x: x.score, reverse=True)
        for rank, node_imp in enumerate(sorted_nodes, 1):
            node_imp.rank = rank
        
        return importance
    
    async def identify_critical_nodes(self, nodes: List[GraphNode], 
                                     edges: List[GraphEdge],
                                     top_k: int = 5) -> List[str]:
        """Identify critical nodes"""
        importance = await self.calculate_node_importance(
            nodes, edges,
            weights={"degree": 0.3, "betweenness": 0.4, "pagerank": 0.3}
        )
        
        sorted_nodes = sorted(importance.values(), key=lambda x: x.score, reverse=True)
        return [node.node_id for node in sorted_nodes[:top_k]]
    
    async def maximize_influence(self, nodes: List[GraphNode], 
                                edges: List[GraphEdge],
                                k: int = 3,
                                propagation_model: str = "independent_cascade") -> List[str]:
        """Find nodes that maximize influence"""
        # Simplified greedy approach
        G = self._build_networkx_graph(nodes, edges)
        
        # Use degree centrality as proxy for influence
        degree_cent = dict(G.degree())
        sorted_nodes = sorted(degree_cent.items(), key=lambda x: x[1], reverse=True)
        
        return [node for node, _ in sorted_nodes[:k]]