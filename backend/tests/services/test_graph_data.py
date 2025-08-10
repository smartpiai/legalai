"""
Graph Data Service Tests
Following TDD - RED phase: Comprehensive test suite for graph data service
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.graph_data import (
    GraphDataService,
    GraphNode,
    GraphEdge,
    GraphPath,
    GraphQuery,
    GraphVisualization,
    NodeType,
    EdgeType,
    LayoutAlgorithm,
    GraphMetrics,
    GraphError
)
from app.models.graph import Node, Edge, GraphSchema
from app.schemas.graph import (
    GraphRequest,
    GraphResponse,
    NodeResponse,
    PathResponse,
    GraphAnalyticsResponse
)


class TestGraphDataService:
    """Test suite for graph data service"""

    @pytest.fixture
    def mock_neo4j(self):
        """Mock Neo4j database connection"""
        neo4j = AsyncMock()
        neo4j.run = AsyncMock()
        neo4j.execute_query = AsyncMock()
        return neo4j

    @pytest.fixture
    def mock_cache_service(self):
        """Mock cache service"""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock()
        cache.delete = AsyncMock()
        return cache

    @pytest.fixture
    def mock_vector_service(self):
        """Mock vector service for similarity"""
        service = AsyncMock()
        service.find_similar = AsyncMock(return_value=[])
        return service

    @pytest.fixture
    def graph_service(self, mock_neo4j, mock_cache_service, mock_vector_service):
        """Create graph data service instance"""
        return GraphDataService(
            neo4j=mock_neo4j,
            cache_service=mock_cache_service,
            vector_service=mock_vector_service
        )

    @pytest.fixture
    def sample_nodes(self):
        """Sample graph nodes"""
        return [
            GraphNode(
                id="contract-1",
                type=NodeType.CONTRACT,
                properties={
                    "title": "Service Agreement",
                    "value": 100000,
                    "status": "active"
                }
            ),
            GraphNode(
                id="party-1",
                type=NodeType.PARTY,
                properties={
                    "name": "Acme Corp",
                    "type": "vendor"
                }
            ),
            GraphNode(
                id="clause-1",
                type=NodeType.CLAUSE,
                properties={
                    "type": "payment",
                    "text": "Payment terms..."
                }
            )
        ]

    @pytest.fixture
    def sample_edges(self):
        """Sample graph edges"""
        return [
            GraphEdge(
                id="edge-1",
                type=EdgeType.PARTY_TO,
                source="party-1",
                target="contract-1",
                properties={"role": "vendor"}
            ),
            GraphEdge(
                id="edge-2",
                type=EdgeType.CONTAINS,
                source="contract-1",
                target="clause-1",
                properties={"position": 1}
            )
        ]

    # Test Node Operations

    @pytest.mark.asyncio
    async def test_create_node(self, graph_service):
        """Test creating a graph node"""
        node = GraphNode(
            id="contract-2",
            type=NodeType.CONTRACT,
            properties={"title": "Purchase Order", "value": 50000}
        )
        
        result = await graph_service.create_node(node, tenant_id="tenant-123")
        
        assert result.id == "contract-2"
        assert result.type == NodeType.CONTRACT
        assert result.properties["value"] == 50000

    @pytest.mark.asyncio
    async def test_get_node(self, graph_service):
        """Test retrieving a node by ID"""
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [{
                "node": {
                    "id": "contract-1",
                    "type": "CONTRACT",
                    "properties": {"title": "Service Agreement"}
                }
            }]
        })
        
        node = await graph_service.get_node(
            node_id="contract-1",
            tenant_id="tenant-123"
        )
        
        assert node.id == "contract-1"
        assert node.properties["title"] == "Service Agreement"

    @pytest.mark.asyncio
    async def test_update_node(self, graph_service):
        """Test updating node properties"""
        updates = {"status": "expired", "updated_at": datetime.utcnow().isoformat()}
        
        result = await graph_service.update_node(
            node_id="contract-1",
            updates=updates,
            tenant_id="tenant-123"
        )
        
        assert result.properties["status"] == "expired"

    @pytest.mark.asyncio
    async def test_delete_node(self, graph_service):
        """Test deleting a node and its relationships"""
        result = await graph_service.delete_node(
            node_id="contract-1",
            cascade=True,
            tenant_id="tenant-123"
        )
        
        assert result is True

    # Test Edge Operations

    @pytest.mark.asyncio
    async def test_create_edge(self, graph_service):
        """Test creating a graph edge"""
        edge = GraphEdge(
            type=EdgeType.REFERENCES,
            source="clause-1",
            target="clause-2",
            properties={"confidence": 0.95}
        )
        
        result = await graph_service.create_edge(edge, tenant_id="tenant-123")
        
        assert result.type == EdgeType.REFERENCES
        assert result.properties["confidence"] == 0.95

    @pytest.mark.asyncio
    async def test_get_edges(self, graph_service):
        """Test retrieving edges for a node"""
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [
                {"edge": {"type": "PARTY_TO", "target": "contract-1"}},
                {"edge": {"type": "CONTAINS", "target": "clause-1"}}
            ]
        })
        
        edges = await graph_service.get_edges(
            node_id="contract-1",
            direction="both",
            tenant_id="tenant-123"
        )
        
        assert len(edges) == 2
        assert edges[0]["type"] == "PARTY_TO"

    @pytest.mark.asyncio
    async def test_delete_edge(self, graph_service):
        """Test deleting an edge"""
        result = await graph_service.delete_edge(
            edge_id="edge-1",
            tenant_id="tenant-123"
        )
        
        assert result is True

    # Test Graph Queries

    @pytest.mark.asyncio
    async def test_search_nodes(self, graph_service):
        """Test searching nodes by properties"""
        query = GraphQuery(
            node_type=NodeType.CONTRACT,
            filters={"status": "active", "value": {"$gte": 50000}},
            limit=10
        )
        
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [
                {"node": {"id": "contract-1", "properties": {"title": "Agreement 1"}}},
                {"node": {"id": "contract-2", "properties": {"title": "Agreement 2"}}}
            ]
        })
        
        results = await graph_service.search_nodes(query, tenant_id="tenant-123")
        
        assert len(results) == 2
        assert results[0]["id"] == "contract-1"

    @pytest.mark.asyncio
    async def test_get_neighbors(self, graph_service):
        """Test getting neighbor nodes"""
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [
                {"neighbor": {"id": "party-1", "type": "PARTY"}},
                {"neighbor": {"id": "clause-1", "type": "CLAUSE"}}
            ]
        })
        
        neighbors = await graph_service.get_neighbors(
            node_id="contract-1",
            depth=1,
            tenant_id="tenant-123"
        )
        
        assert len(neighbors) == 2
        assert any(n["id"] == "party-1" for n in neighbors)

    @pytest.mark.asyncio
    async def test_expand_node(self, graph_service):
        """Test expanding node to get subgraph"""
        subgraph = await graph_service.expand_node(
            node_id="contract-1",
            max_depth=2,
            filters={"type": ["PARTY", "CLAUSE"]},
            tenant_id="tenant-123"
        )
        
        assert "nodes" in subgraph
        assert "edges" in subgraph
        assert subgraph["center_node"] == "contract-1"

    # Test Path Finding

    @pytest.mark.asyncio
    async def test_find_shortest_path(self, graph_service):
        """Test finding shortest path between nodes"""
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [{
                "path": {
                    "nodes": ["contract-1", "clause-1", "contract-2"],
                    "edges": ["edge-1", "edge-2"],
                    "length": 2
                }
            }]
        })
        
        path = await graph_service.find_shortest_path(
            source="contract-1",
            target="contract-2",
            tenant_id="tenant-123"
        )
        
        assert path.length == 2
        assert len(path.nodes) == 3
        assert path.nodes[0] == "contract-1"
        assert path.nodes[-1] == "contract-2"

    @pytest.mark.asyncio
    async def test_find_all_paths(self, graph_service):
        """Test finding all paths between nodes"""
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [
                {"path": {"nodes": ["a", "b", "c"], "length": 2}},
                {"path": {"nodes": ["a", "d", "c"], "length": 2}},
                {"path": {"nodes": ["a", "e", "f", "c"], "length": 3}}
            ]
        })
        
        paths = await graph_service.find_all_paths(
            source="a",
            target="c",
            max_length=4,
            tenant_id="tenant-123"
        )
        
        assert len(paths) == 3
        assert paths[0].length == 2
        assert paths[2].length == 3

    @pytest.mark.asyncio
    async def test_find_k_shortest_paths(self, graph_service):
        """Test finding k shortest paths"""
        paths = await graph_service.find_k_shortest_paths(
            source="contract-1",
            target="contract-2",
            k=3,
            tenant_id="tenant-123"
        )
        
        assert len(paths) <= 3
        # Paths should be sorted by length
        for i in range(len(paths) - 1):
            assert paths[i].length <= paths[i + 1].length

    # Test Graph Analytics

    @pytest.mark.asyncio
    async def test_calculate_centrality(self, graph_service):
        """Test calculating node centrality metrics"""
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [
                {"node": "contract-1", "degree": 5, "betweenness": 0.8, "closeness": 0.6},
                {"node": "contract-2", "degree": 3, "betweenness": 0.4, "closeness": 0.5}
            ]
        })
        
        centrality = await graph_service.calculate_centrality(
            algorithm="all",
            tenant_id="tenant-123"
        )
        
        assert "contract-1" in centrality
        assert centrality["contract-1"]["degree"] == 5
        assert centrality["contract-1"]["betweenness"] == 0.8

    @pytest.mark.asyncio
    async def test_detect_communities(self, graph_service):
        """Test community detection in graph"""
        graph_service.neo4j.execute_query = AsyncMock(return_value={
            "records": [
                {"node": "contract-1", "community": 1},
                {"node": "contract-2", "community": 1},
                {"node": "contract-3", "community": 2}
            ]
        })
        
        communities = await graph_service.detect_communities(
            algorithm="louvain",
            tenant_id="tenant-123"
        )
        
        assert len(communities) == 2
        assert "contract-1" in communities[0]["nodes"]
        assert "contract-3" in communities[1]["nodes"]

    @pytest.mark.asyncio
    async def test_calculate_node_importance(self, graph_service):
        """Test calculating node importance scores"""
        scores = await graph_service.calculate_importance(
            weights={
                "centrality": 0.3,
                "connections": 0.2,
                "value": 0.3,
                "risk": 0.2
            },
            tenant_id="tenant-123"
        )
        
        assert isinstance(scores, dict)
        for node_id, score in scores.items():
            assert 0 <= score <= 100

    @pytest.mark.asyncio
    async def test_analyze_graph_metrics(self, graph_service):
        """Test analyzing overall graph metrics"""
        metrics = await graph_service.analyze_metrics(tenant_id="tenant-123")
        
        assert metrics.node_count > 0
        assert metrics.edge_count > 0
        assert metrics.density >= 0
        assert metrics.avg_degree >= 0
        assert metrics.clustering_coefficient >= 0
        assert metrics.diameter >= 0

    # Test Graph Visualization

    @pytest.mark.asyncio
    async def test_prepare_visualization_data(self, graph_service, sample_nodes, sample_edges):
        """Test preparing data for visualization"""
        viz_data = await graph_service.prepare_visualization(
            nodes=sample_nodes,
            edges=sample_edges,
            layout=LayoutAlgorithm.FORCE_DIRECTED
        )
        
        assert "nodes" in viz_data
        assert "edges" in viz_data
        assert "layout" in viz_data
        assert len(viz_data["nodes"]) == 3
        assert len(viz_data["edges"]) == 2

    @pytest.mark.asyncio
    async def test_apply_layout_algorithm(self, graph_service):
        """Test applying different layout algorithms"""
        layouts = [
            LayoutAlgorithm.FORCE_DIRECTED,
            LayoutAlgorithm.HIERARCHICAL,
            LayoutAlgorithm.CIRCULAR,
            LayoutAlgorithm.RADIAL
        ]
        
        for layout in layouts:
            positions = await graph_service.calculate_layout(
                nodes=["n1", "n2", "n3"],
                edges=[("n1", "n2"), ("n2", "n3")],
                algorithm=layout
            )
            
            assert len(positions) == 3
            for node_id, pos in positions.items():
                assert "x" in pos and "y" in pos

    @pytest.mark.asyncio
    async def test_filter_graph_for_display(self, graph_service):
        """Test filtering graph for display"""
        filtered = await graph_service.filter_for_display(
            nodes=100,  # Large number of nodes
            edges=200,
            filters={
                "node_types": [NodeType.CONTRACT, NodeType.PARTY],
                "min_importance": 0.5,
                "max_nodes": 50
            },
            tenant_id="tenant-123"
        )
        
        assert len(filtered["nodes"]) <= 50
        assert all(n["type"] in ["CONTRACT", "PARTY"] for n in filtered["nodes"])

    # Test Search and Discovery

    @pytest.mark.asyncio
    async def test_search_in_graph(self, graph_service):
        """Test searching within graph"""
        results = await graph_service.search(
            query="payment terms",
            node_types=[NodeType.CLAUSE],
            limit=10,
            tenant_id="tenant-123"
        )
        
        assert len(results) <= 10
        assert all(r["type"] == NodeType.CLAUSE for r in results)

    @pytest.mark.asyncio
    async def test_find_similar_nodes(self, graph_service, mock_vector_service):
        """Test finding similar nodes using embeddings"""
        mock_vector_service.find_similar = AsyncMock(return_value=[
            {"id": "contract-2", "similarity": 0.95},
            {"id": "contract-3", "similarity": 0.87}
        ])
        
        similar = await graph_service.find_similar_nodes(
            node_id="contract-1",
            top_k=5,
            tenant_id="tenant-123"
        )
        
        assert len(similar) == 2
        assert similar[0]["similarity"] > similar[1]["similarity"]

    @pytest.mark.asyncio
    async def test_find_patterns(self, graph_service):
        """Test finding patterns in graph"""
        pattern = {
            "nodes": [
                {"type": NodeType.CONTRACT, "alias": "c"},
                {"type": NodeType.PARTY, "alias": "p"}
            ],
            "edges": [
                {"source": "c", "target": "p", "type": EdgeType.PARTY_TO}
            ]
        }
        
        matches = await graph_service.find_patterns(
            pattern=pattern,
            tenant_id="tenant-123"
        )
        
        assert isinstance(matches, list)
        for match in matches:
            assert "c" in match and "p" in match

    # Test Graph Modifications

    @pytest.mark.asyncio
    async def test_merge_nodes(self, graph_service):
        """Test merging duplicate nodes"""
        result = await graph_service.merge_nodes(
            node_ids=["party-1", "party-2"],
            master_id="party-1",
            tenant_id="tenant-123"
        )
        
        assert result.id == "party-1"
        assert result.merge_count == 2

    @pytest.mark.asyncio
    async def test_split_node(self, graph_service):
        """Test splitting a node into multiple nodes"""
        result = await graph_service.split_node(
            node_id="clause-1",
            split_criteria={"by": "type"},
            tenant_id="tenant-123"
        )
        
        assert len(result) > 1
        assert all(n.id != "clause-1" for n in result)

    @pytest.mark.asyncio
    async def test_clone_subgraph(self, graph_service):
        """Test cloning a subgraph"""
        cloned = await graph_service.clone_subgraph(
            root_node="contract-1",
            depth=2,
            prefix="copy_",
            tenant_id="tenant-123"
        )
        
        assert cloned["root_node"].startswith("copy_")
        assert len(cloned["nodes"]) > 0
        assert len(cloned["edges"]) > 0

    # Test Caching

    @pytest.mark.asyncio
    async def test_cache_graph_query(self, graph_service, mock_cache_service):
        """Test caching graph query results"""
        query_key = "graph:query:contract-status-active"
        
        # First call - cache miss
        mock_cache_service.get.return_value = None
        result1 = await graph_service.cached_query(
            query="MATCH (c:Contract {status: 'active'}) RETURN c",
            tenant_id="tenant-123"
        )
        
        mock_cache_service.set.assert_called_once()
        
        # Second call - cache hit
        mock_cache_service.get.return_value = json.dumps(result1)
        result2 = await graph_service.cached_query(
            query="MATCH (c:Contract {status: 'active'}) RETURN c",
            tenant_id="tenant-123"
        )
        
        assert result1 == json.loads(mock_cache_service.get.return_value)

    @pytest.mark.asyncio
    async def test_invalidate_cache(self, graph_service, mock_cache_service):
        """Test cache invalidation on graph changes"""
        await graph_service.create_node(
            GraphNode(id="new-node", type=NodeType.CONTRACT, properties={}),
            tenant_id="tenant-123"
        )
        
        # Cache should be invalidated for tenant
        mock_cache_service.delete.assert_called()

    # Test Export/Import

    @pytest.mark.asyncio
    async def test_export_graph(self, graph_service):
        """Test exporting graph data"""
        export_data = await graph_service.export_graph(
            format="json",
            filters={"node_types": [NodeType.CONTRACT]},
            tenant_id="tenant-123"
        )
        
        assert "nodes" in export_data
        assert "edges" in export_data
        assert "metadata" in export_data
        assert export_data["metadata"]["export_date"] is not None

    @pytest.mark.asyncio
    async def test_import_graph(self, graph_service):
        """Test importing graph data"""
        import_data = {
            "nodes": [
                {"id": "n1", "type": "CONTRACT", "properties": {}},
                {"id": "n2", "type": "PARTY", "properties": {}}
            ],
            "edges": [
                {"source": "n1", "target": "n2", "type": "PARTY_TO"}
            ]
        }
        
        result = await graph_service.import_graph(
            data=import_data,
            merge_strategy="create_new",
            tenant_id="tenant-123"
        )
        
        assert result["imported_nodes"] == 2
        assert result["imported_edges"] == 1

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_graph_isolation(self, graph_service):
        """Test that graph data is isolated between tenants"""
        # Create node for tenant A
        node_a = await graph_service.create_node(
            GraphNode(id="node-a", type=NodeType.CONTRACT, properties={}),
            tenant_id="tenant-A"
        )
        
        # Try to access from tenant B
        with pytest.raises(PermissionError):
            await graph_service.get_node(
                node_id="node-a",
                tenant_id="tenant-B"
            )

    # Test Performance

    @pytest.mark.asyncio
    async def test_batch_node_creation(self, graph_service):
        """Test batch creation of nodes"""
        nodes = [
            GraphNode(id=f"node-{i}", type=NodeType.CONTRACT, properties={})
            for i in range(100)
        ]
        
        result = await graph_service.batch_create_nodes(
            nodes=nodes,
            tenant_id="tenant-123"
        )
        
        assert result["created"] == 100
        assert result["failed"] == 0