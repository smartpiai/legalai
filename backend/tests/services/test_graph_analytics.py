"""
Test suite for Graph Analytics Engine
Tests graph algorithms, centrality measures, and pattern detection
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from unittest.mock import Mock, patch, AsyncMock
import asyncio
import networkx as nx

from app.services.graph_analytics import (
    GraphAnalyticsEngine,
    GraphNode,
    GraphEdge,
    GraphMetrics,
    CentralityMeasure,
    Community,
    PathResult,
    ClusterResult,
    AnomalyResult,
    PatternMatch,
    TrendAnalysis,
    PredictionResult,
    RiskPropagation,
    ImpactAnalysis,
    GraphType,
    AnalysisConfig,
    GraphStatistics,
    NodeImportance
)


@pytest.fixture
def analytics_engine():
    """Create graph analytics engine instance"""
    config = AnalysisConfig(
        enable_caching=True,
        parallel_processing=True,
        max_iterations=1000,
        convergence_threshold=0.001
    )
    return GraphAnalyticsEngine(config)


@pytest.fixture
def sample_graph():
    """Create sample graph for testing"""
    nodes = [
        GraphNode(id="n1", type="company", properties={"name": "Acme Corp", "value": 1000000}),
        GraphNode(id="n2", type="company", properties={"name": "Beta LLC", "value": 500000}),
        GraphNode(id="n3", type="contract", properties={"title": "Service Agreement", "value": 100000}),
        GraphNode(id="n4", type="person", properties={"name": "John Doe", "role": "CEO"}),
        GraphNode(id="n5", type="company", properties={"name": "Gamma Inc", "value": 750000})
    ]
    
    edges = [
        GraphEdge(source="n1", target="n3", type="party_to", weight=1.0),
        GraphEdge(source="n2", target="n3", type="party_to", weight=1.0),
        GraphEdge(source="n4", target="n1", type="works_for", weight=0.8),
        GraphEdge(source="n1", target="n5", type="subsidiary_of", weight=0.9),
        GraphEdge(source="n2", target="n5", type="partner", weight=0.7)
    ]
    
    return {"nodes": nodes, "edges": edges}


@pytest.fixture
def large_graph():
    """Create larger graph for complex testing"""
    nodes = []
    edges = []
    
    # Create 20 nodes
    for i in range(20):
        nodes.append(GraphNode(
            id=f"node_{i}",
            type="entity" if i % 2 == 0 else "document",
            properties={"value": i * 100, "risk": i % 5}
        ))
    
    # Create edges with varying weights
    for i in range(19):
        edges.append(GraphEdge(
            source=f"node_{i}",
            target=f"node_{i+1}",
            type="connected",
            weight=0.5 + (i % 3) * 0.2
        ))
    
    # Add some cross-connections for complexity
    edges.extend([
        GraphEdge(source="node_0", target="node_10", type="related", weight=0.6),
        GraphEdge(source="node_5", target="node_15", type="related", weight=0.7),
        GraphEdge(source="node_3", target="node_17", type="related", weight=0.4)
    ])
    
    return {"nodes": nodes, "edges": edges}


class TestCentralityCalculations:
    """Test centrality measure calculations"""

    @pytest.mark.asyncio
    async def test_degree_centrality(self, analytics_engine, sample_graph):
        """Test degree centrality calculation"""
        result = await analytics_engine.calculate_centrality(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            measure=CentralityMeasure.DEGREE
        )
        
        assert isinstance(result, dict)
        assert "n1" in result  # Node n1 should have high degree
        assert result["n1"] > result["n4"]  # n1 more connected than n4

    @pytest.mark.asyncio
    async def test_betweenness_centrality(self, analytics_engine, sample_graph):
        """Test betweenness centrality calculation"""
        result = await analytics_engine.calculate_centrality(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            measure=CentralityMeasure.BETWEENNESS
        )
        
        assert isinstance(result, dict)
        assert all(0 <= score <= 1 for score in result.values())

    @pytest.mark.asyncio
    async def test_closeness_centrality(self, analytics_engine, sample_graph):
        """Test closeness centrality calculation"""
        result = await analytics_engine.calculate_centrality(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            measure=CentralityMeasure.CLOSENESS
        )
        
        assert isinstance(result, dict)
        assert len(result) == len(sample_graph["nodes"])

    @pytest.mark.asyncio
    async def test_eigenvector_centrality(self, analytics_engine, sample_graph):
        """Test eigenvector centrality calculation"""
        result = await analytics_engine.calculate_centrality(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            measure=CentralityMeasure.EIGENVECTOR
        )
        
        assert isinstance(result, dict)
        # Connected nodes should have non-zero eigenvector centrality
        assert result["n1"] > 0

    @pytest.mark.asyncio
    async def test_pagerank_calculation(self, analytics_engine, sample_graph):
        """Test PageRank calculation"""
        result = await analytics_engine.calculate_pagerank(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            damping_factor=0.85
        )
        
        assert isinstance(result, dict)
        assert sum(result.values()) > 0.99  # PageRank scores should sum close to 1


class TestCommunityDetection:
    """Test community detection algorithms"""

    @pytest.mark.asyncio
    async def test_louvain_community_detection(self, analytics_engine, large_graph):
        """Test Louvain community detection"""
        communities = await analytics_engine.detect_communities(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            algorithm="louvain"
        )
        
        assert isinstance(communities, list)
        assert all(isinstance(c, Community) for c in communities)
        assert len(communities) > 1  # Should detect multiple communities

    @pytest.mark.asyncio
    async def test_label_propagation(self, analytics_engine, large_graph):
        """Test label propagation community detection"""
        communities = await analytics_engine.detect_communities(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            algorithm="label_propagation"
        )
        
        assert isinstance(communities, list)
        # Each node should belong to exactly one community
        all_nodes = set()
        for community in communities:
            all_nodes.update(community.node_ids)
        assert len(all_nodes) == len(large_graph["nodes"])

    @pytest.mark.asyncio
    async def test_modularity_calculation(self, analytics_engine, large_graph):
        """Test modularity score calculation"""
        communities = await analytics_engine.detect_communities(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            algorithm="louvain"
        )
        
        modularity = await analytics_engine.calculate_modularity(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            communities=communities
        )
        
        assert -1 <= modularity <= 1  # Modularity should be between -1 and 1

    @pytest.mark.asyncio
    async def test_community_overlap_detection(self, analytics_engine, large_graph):
        """Test overlapping community detection"""
        communities = await analytics_engine.detect_overlapping_communities(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            min_size=2
        )
        
        assert isinstance(communities, list)
        # Some nodes may belong to multiple communities
        assert any(len(c.node_ids) >= 2 for c in communities)

    @pytest.mark.asyncio
    async def test_hierarchical_clustering(self, analytics_engine, sample_graph):
        """Test hierarchical community detection"""
        hierarchy = await analytics_engine.hierarchical_clustering(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            levels=2
        )
        
        assert isinstance(hierarchy, dict)
        assert "level_0" in hierarchy
        assert "level_1" in hierarchy


class TestPathFinding:
    """Test path finding algorithms"""

    @pytest.mark.asyncio
    async def test_shortest_path(self, analytics_engine, sample_graph):
        """Test shortest path finding"""
        path = await analytics_engine.find_shortest_path(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            source="n1",
            target="n2"
        )
        
        assert isinstance(path, PathResult)
        assert path.source == "n1"
        assert path.target == "n2"
        assert len(path.path) >= 2  # At least source and target

    @pytest.mark.asyncio
    async def test_all_shortest_paths(self, analytics_engine, large_graph):
        """Test finding all shortest paths"""
        paths = await analytics_engine.find_all_shortest_paths(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            source="node_0",
            target="node_10"
        )
        
        assert isinstance(paths, list)
        assert all(isinstance(p, PathResult) for p in paths)
        assert all(p.source == "node_0" and p.target == "node_10" for p in paths)

    @pytest.mark.asyncio
    async def test_k_shortest_paths(self, analytics_engine, large_graph):
        """Test finding k shortest paths"""
        paths = await analytics_engine.find_k_shortest_paths(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            source="node_0",
            target="node_19",
            k=3
        )
        
        assert isinstance(paths, list)
        assert len(paths) <= 3
        # Paths should be ordered by length
        if len(paths) > 1:
            assert paths[0].length <= paths[1].length

    @pytest.mark.asyncio
    async def test_connected_components(self, analytics_engine, sample_graph):
        """Test connected components detection"""
        components = await analytics_engine.find_connected_components(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"]
        )
        
        assert isinstance(components, list)
        assert len(components) >= 1
        # All nodes should be in some component
        all_nodes = set()
        for component in components:
            all_nodes.update(component)
        assert len(all_nodes) == len(sample_graph["nodes"])

    @pytest.mark.asyncio
    async def test_strongly_connected_components(self, analytics_engine, sample_graph):
        """Test strongly connected components in directed graph"""
        components = await analytics_engine.find_strongly_connected_components(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"]
        )
        
        assert isinstance(components, list)
        assert all(isinstance(c, set) for c in components)


class TestClusteringAnalysis:
    """Test clustering algorithms"""

    @pytest.mark.asyncio
    async def test_kmeans_clustering(self, analytics_engine, large_graph):
        """Test k-means clustering"""
        clusters = await analytics_engine.cluster_nodes(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            algorithm="kmeans",
            n_clusters=3
        )
        
        assert isinstance(clusters, list)
        assert len(clusters) == 3
        assert all(isinstance(c, ClusterResult) for c in clusters)

    @pytest.mark.asyncio
    async def test_dbscan_clustering(self, analytics_engine, large_graph):
        """Test DBSCAN clustering"""
        clusters = await analytics_engine.cluster_nodes(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            algorithm="dbscan",
            eps=0.5,
            min_samples=2
        )
        
        assert isinstance(clusters, list)
        # DBSCAN may identify noise points
        assert any(c.cluster_id != -1 for c in clusters)

    @pytest.mark.asyncio
    async def test_spectral_clustering(self, analytics_engine, sample_graph):
        """Test spectral clustering"""
        clusters = await analytics_engine.cluster_nodes(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            algorithm="spectral",
            n_clusters=2
        )
        
        assert isinstance(clusters, list)
        assert len(clusters) <= 2

    @pytest.mark.asyncio
    async def test_clustering_coefficient(self, analytics_engine, sample_graph):
        """Test clustering coefficient calculation"""
        coefficient = await analytics_engine.calculate_clustering_coefficient(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"]
        )
        
        assert isinstance(coefficient, dict)
        assert all(0 <= c <= 1 for c in coefficient.values())

    @pytest.mark.asyncio
    async def test_graph_density(self, analytics_engine, sample_graph):
        """Test graph density calculation"""
        density = await analytics_engine.calculate_density(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"]
        )
        
        assert 0 <= density <= 1


class TestAnomalyDetection:
    """Test anomaly detection in graphs"""

    @pytest.mark.asyncio
    async def test_outlier_detection(self, analytics_engine, large_graph):
        """Test outlier node detection"""
        anomalies = await analytics_engine.detect_anomalies(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            method="isolation_forest"
        )
        
        assert isinstance(anomalies, list)
        assert all(isinstance(a, AnomalyResult) for a in anomalies)

    @pytest.mark.asyncio
    async def test_structural_anomalies(self, analytics_engine, large_graph):
        """Test structural anomaly detection"""
        # Add an anomalous edge
        anomalous_edges = large_graph["edges"].copy()
        anomalous_edges.append(
            GraphEdge(source="node_0", target="node_19", type="anomaly", weight=10.0)
        )
        
        anomalies = await analytics_engine.detect_structural_anomalies(
            nodes=large_graph["nodes"],
            edges=anomalous_edges
        )
        
        assert isinstance(anomalies, list)
        assert len(anomalies) > 0  # Should detect the anomalous edge

    @pytest.mark.asyncio
    async def test_temporal_anomalies(self, analytics_engine):
        """Test temporal anomaly detection"""
        temporal_graphs = []
        for t in range(5):
            nodes = [GraphNode(id=f"n{i}", type="entity") for i in range(5)]
            edges = [GraphEdge(source=f"n{i}", target=f"n{i+1}", weight=1.0) 
                    for i in range(4)]
            temporal_graphs.append({
                "timestamp": datetime.now() - timedelta(days=5-t),
                "nodes": nodes,
                "edges": edges
            })
        
        # Add anomaly in last graph
        temporal_graphs[-1]["edges"].append(
            GraphEdge(source="n0", target="n4", weight=5.0)
        )
        
        anomalies = await analytics_engine.detect_temporal_anomalies(temporal_graphs)
        
        assert isinstance(anomalies, list)
        assert len(anomalies) > 0

    @pytest.mark.asyncio
    async def test_node_attribute_anomalies(self, analytics_engine, large_graph):
        """Test node attribute anomaly detection"""
        # Modify one node to have anomalous properties
        large_graph["nodes"][5].properties["value"] = 100000  # Outlier value
        
        anomalies = await analytics_engine.detect_attribute_anomalies(
            nodes=large_graph["nodes"],
            attribute="value"
        )
        
        assert isinstance(anomalies, list)
        assert any(a.node_id == "node_5" for a in anomalies)


class TestPatternRecognition:
    """Test pattern recognition in graphs"""

    @pytest.mark.asyncio
    async def test_motif_detection(self, analytics_engine, large_graph):
        """Test motif/pattern detection"""
        patterns = await analytics_engine.detect_motifs(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            motif_size=3
        )
        
        assert isinstance(patterns, list)
        assert all(isinstance(p, PatternMatch) for p in patterns)

    @pytest.mark.asyncio
    async def test_subgraph_matching(self, analytics_engine, large_graph):
        """Test subgraph pattern matching"""
        # Define pattern to search for
        pattern_nodes = [
            GraphNode(id="p1", type="entity"),
            GraphNode(id="p2", type="document")
        ]
        pattern_edges = [
            GraphEdge(source="p1", target="p2", type="connected")
        ]
        
        matches = await analytics_engine.find_subgraph_matches(
            graph_nodes=large_graph["nodes"],
            graph_edges=large_graph["edges"],
            pattern_nodes=pattern_nodes,
            pattern_edges=pattern_edges
        )
        
        assert isinstance(matches, list)
        assert len(matches) > 0  # Should find entity-document connections

    @pytest.mark.asyncio
    async def test_frequent_patterns(self, analytics_engine, large_graph):
        """Test frequent pattern mining"""
        patterns = await analytics_engine.mine_frequent_patterns(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            min_support=0.1
        )
        
        assert isinstance(patterns, list)
        assert all(p.frequency > 0 for p in patterns)

    @pytest.mark.asyncio
    async def test_rule_extraction(self, analytics_engine, large_graph):
        """Test association rule extraction"""
        rules = await analytics_engine.extract_association_rules(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            min_confidence=0.5
        )
        
        assert isinstance(rules, list)
        assert all(0.5 <= r.confidence <= 1.0 for r in rules)


class TestTrendIdentification:
    """Test trend identification in temporal graphs"""

    @pytest.mark.asyncio
    async def test_growth_trend_detection(self, analytics_engine):
        """Test growth trend detection"""
        temporal_data = []
        for t in range(10):
            size = 5 + t  # Growing graph
            nodes = [GraphNode(id=f"n{i}", type="entity") for i in range(size)]
            edges = [GraphEdge(source=f"n{i}", target=f"n{i+1}", weight=1.0) 
                    for i in range(size-1)]
            temporal_data.append({
                "timestamp": datetime.now() - timedelta(days=10-t),
                "nodes": nodes,
                "edges": edges
            })
        
        trends = await analytics_engine.identify_trends(temporal_data)
        
        assert isinstance(trends, TrendAnalysis)
        assert trends.growth_rate > 0  # Should detect growth

    @pytest.mark.asyncio
    async def test_seasonal_patterns(self, analytics_engine):
        """Test seasonal pattern detection"""
        temporal_data = []
        for month in range(24):  # 2 years of data
            # Create seasonal pattern
            size = 10 + 5 * (1 if month % 12 in [11, 0, 1] else 0)  # Peak in winter
            nodes = [GraphNode(id=f"n{i}", type="entity") for i in range(size)]
            edges = [GraphEdge(source=f"n{i}", target=f"n{i+1}", weight=1.0) 
                    for i in range(size-1)]
            temporal_data.append({
                "timestamp": datetime.now() - timedelta(days=30*(24-month)),
                "nodes": nodes,
                "edges": edges
            })
        
        patterns = await analytics_engine.detect_seasonal_patterns(temporal_data)
        
        assert isinstance(patterns, dict)
        assert "seasonal_period" in patterns

    @pytest.mark.asyncio
    async def test_change_point_detection(self, analytics_engine):
        """Test change point detection"""
        temporal_data = []
        for t in range(20):
            # Create change at t=10
            size = 5 if t < 10 else 15
            nodes = [GraphNode(id=f"n{i}", type="entity") for i in range(size)]
            edges = [GraphEdge(source=f"n{i}", target=f"n{i+1}", weight=1.0) 
                    for i in range(size-1)]
            temporal_data.append({
                "timestamp": datetime.now() - timedelta(days=20-t),
                "nodes": nodes,
                "edges": edges
            })
        
        change_points = await analytics_engine.detect_change_points(temporal_data)
        
        assert isinstance(change_points, list)
        assert len(change_points) > 0  # Should detect the change


class TestPredictiveModeling:
    """Test predictive modeling on graphs"""

    @pytest.mark.asyncio
    async def test_link_prediction(self, analytics_engine, sample_graph):
        """Test link prediction"""
        predictions = await analytics_engine.predict_links(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            top_k=5
        )
        
        assert isinstance(predictions, list)
        assert all(isinstance(p, PredictionResult) for p in predictions)
        assert all(0 <= p.probability <= 1 for p in predictions)

    @pytest.mark.asyncio
    async def test_node_classification(self, analytics_engine, large_graph):
        """Test node classification"""
        # Mark some nodes for training
        for i in range(10):
            large_graph["nodes"][i].properties["label"] = "class_A" if i % 2 == 0 else "class_B"
        
        predictions = await analytics_engine.classify_nodes(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            labeled_nodes=large_graph["nodes"][:10],
            unlabeled_nodes=large_graph["nodes"][10:]
        )
        
        assert isinstance(predictions, dict)
        assert len(predictions) == 10  # Should classify remaining nodes

    @pytest.mark.asyncio
    async def test_graph_regression(self, analytics_engine, large_graph):
        """Test graph-based regression"""
        # Add target values to some nodes
        for node in large_graph["nodes"][:15]:
            node.properties["target"] = float(node.properties.get("value", 0))
        
        predictions = await analytics_engine.predict_node_values(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            target_attribute="target"
        )
        
        assert isinstance(predictions, dict)
        assert all(isinstance(v, float) for v in predictions.values())

    @pytest.mark.asyncio
    async def test_graph_forecasting(self, analytics_engine):
        """Test graph structure forecasting"""
        historical_graphs = []
        for t in range(10):
            size = 5 + t
            nodes = [GraphNode(id=f"n{i}", type="entity") for i in range(size)]
            edges = [GraphEdge(source=f"n{i}", target=f"n{i+1}", weight=1.0) 
                    for i in range(size-1)]
            historical_graphs.append({
                "timestamp": datetime.now() - timedelta(days=10-t),
                "nodes": nodes,
                "edges": edges
            })
        
        forecast = await analytics_engine.forecast_graph_structure(
            historical_graphs=historical_graphs,
            periods_ahead=3
        )
        
        assert isinstance(forecast, list)
        assert len(forecast) == 3


class TestRiskPropagation:
    """Test risk propagation analysis"""

    @pytest.mark.asyncio
    async def test_risk_spreading(self, analytics_engine, sample_graph):
        """Test risk propagation through graph"""
        # Set initial risk on one node
        risk_sources = {"n2": 0.8}  # Beta LLC has high risk
        
        propagation = await analytics_engine.propagate_risk(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            risk_sources=risk_sources,
            decay_factor=0.7
        )
        
        assert isinstance(propagation, RiskPropagation)
        assert "n3" in propagation.risk_scores  # Contract should be affected
        assert propagation.risk_scores["n3"] > 0  # Should have some risk

    @pytest.mark.asyncio
    async def test_cascading_failure(self, analytics_engine, large_graph):
        """Test cascading failure analysis"""
        # Simulate node failure
        failed_nodes = ["node_5", "node_10"]
        
        cascade = await analytics_engine.analyze_cascading_failure(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            failed_nodes=failed_nodes
        )
        
        assert isinstance(cascade, dict)
        assert "affected_nodes" in cascade
        assert len(cascade["affected_nodes"]) >= len(failed_nodes)

    @pytest.mark.asyncio
    async def test_contagion_model(self, analytics_engine, large_graph):
        """Test contagion spread modeling"""
        # Set initial infected nodes
        infected = {"node_0": 1.0}
        
        contagion = await analytics_engine.model_contagion(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            initial_infected=infected,
            transmission_rate=0.3,
            recovery_rate=0.1,
            time_steps=10
        )
        
        assert isinstance(contagion, list)
        assert len(contagion) == 10  # One result per time step
        assert all("infected_count" in step for step in contagion)

    @pytest.mark.asyncio
    async def test_vulnerability_assessment(self, analytics_engine, sample_graph):
        """Test node vulnerability assessment"""
        vulnerabilities = await analytics_engine.assess_vulnerabilities(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"]
        )
        
        assert isinstance(vulnerabilities, dict)
        assert all(0 <= v <= 1 for v in vulnerabilities.values())


class TestImpactAnalysis:
    """Test impact analysis capabilities"""

    @pytest.mark.asyncio
    async def test_node_removal_impact(self, analytics_engine, sample_graph):
        """Test impact of node removal"""
        impact = await analytics_engine.analyze_node_removal_impact(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            node_to_remove="n3"  # Remove contract
        )
        
        assert isinstance(impact, ImpactAnalysis)
        assert impact.connectivity_impact >= 0
        assert "n1" in impact.affected_nodes
        assert "n2" in impact.affected_nodes

    @pytest.mark.asyncio
    async def test_edge_removal_impact(self, analytics_engine, large_graph):
        """Test impact of edge removal"""
        critical_edge = GraphEdge(source="node_10", target="node_11", type="connected")
        
        impact = await analytics_engine.analyze_edge_removal_impact(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            edge_to_remove=critical_edge
        )
        
        assert isinstance(impact, ImpactAnalysis)
        assert impact.path_length_increase >= 0

    @pytest.mark.asyncio
    async def test_what_if_scenarios(self, analytics_engine, sample_graph):
        """Test what-if scenario analysis"""
        scenarios = [
            {"action": "remove_node", "target": "n1"},
            {"action": "add_edge", "source": "n4", "target": "n2"},
            {"action": "modify_weight", "edge": ("n1", "n3"), "new_weight": 0.5}
        ]
        
        results = await analytics_engine.analyze_scenarios(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            scenarios=scenarios
        )
        
        assert isinstance(results, list)
        assert len(results) == len(scenarios)

    @pytest.mark.asyncio
    async def test_resilience_metrics(self, analytics_engine, large_graph):
        """Test graph resilience metrics"""
        resilience = await analytics_engine.calculate_resilience(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"]
        )
        
        assert isinstance(resilience, dict)
        assert "robustness" in resilience
        assert "redundancy" in resilience
        assert 0 <= resilience["robustness"] <= 1


class TestGraphStatistics:
    """Test graph statistics calculations"""

    @pytest.mark.asyncio
    async def test_basic_statistics(self, analytics_engine, sample_graph):
        """Test basic graph statistics"""
        stats = await analytics_engine.calculate_statistics(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"]
        )
        
        assert isinstance(stats, GraphStatistics)
        assert stats.num_nodes == len(sample_graph["nodes"])
        assert stats.num_edges == len(sample_graph["edges"])
        assert stats.avg_degree > 0

    @pytest.mark.asyncio
    async def test_degree_distribution(self, analytics_engine, large_graph):
        """Test degree distribution calculation"""
        distribution = await analytics_engine.calculate_degree_distribution(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"]
        )
        
        assert isinstance(distribution, dict)
        assert sum(distribution.values()) == len(large_graph["nodes"])

    @pytest.mark.asyncio
    async def test_assortativity(self, analytics_engine, large_graph):
        """Test assortativity coefficient"""
        assortativity = await analytics_engine.calculate_assortativity(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"]
        )
        
        assert -1 <= assortativity <= 1

    @pytest.mark.asyncio
    async def test_diameter_calculation(self, analytics_engine, sample_graph):
        """Test graph diameter calculation"""
        diameter = await analytics_engine.calculate_diameter(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"]
        )
        
        assert isinstance(diameter, int)
        assert diameter > 0


class TestNodeImportance:
    """Test node importance scoring"""

    @pytest.mark.asyncio
    async def test_composite_importance_score(self, analytics_engine, sample_graph):
        """Test composite node importance scoring"""
        importance = await analytics_engine.calculate_node_importance(
            nodes=sample_graph["nodes"],
            edges=sample_graph["edges"],
            weights={
                "degree": 0.3,
                "betweenness": 0.3,
                "pagerank": 0.4
            }
        )
        
        assert isinstance(importance, dict)
        assert all(isinstance(i, NodeImportance) for i in importance.values())
        assert all(0 <= i.score <= 1 for i in importance.values())

    @pytest.mark.asyncio
    async def test_critical_nodes_identification(self, analytics_engine, large_graph):
        """Test identification of critical nodes"""
        critical_nodes = await analytics_engine.identify_critical_nodes(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            top_k=5
        )
        
        assert isinstance(critical_nodes, list)
        assert len(critical_nodes) <= 5
        assert all(node_id in [n.id for n in large_graph["nodes"]] 
                  for node_id in critical_nodes)

    @pytest.mark.asyncio
    async def test_influence_maximization(self, analytics_engine, large_graph):
        """Test influence maximization"""
        seed_nodes = await analytics_engine.maximize_influence(
            nodes=large_graph["nodes"],
            edges=large_graph["edges"],
            k=3,
            propagation_model="independent_cascade"
        )
        
        assert isinstance(seed_nodes, list)
        assert len(seed_nodes) == 3
        assert all(node_id in [n.id for n in large_graph["nodes"]] 
                  for node_id in seed_nodes)