"""
Integration tests for Neo4j graph database operations.
Following TDD methodology - tests written before implementation.
"""
import asyncio
import pytest
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.core.graph import (
    Neo4jConnection,
    get_neo4j_client,
    create_node,
    create_relationship,
    find_node,
    find_relationships,
    update_node,
    delete_node,
    execute_cypher,
    get_node_neighbors,
    find_shortest_path,
    create_contract_graph,
    find_related_contracts,
    find_clause_patterns
)


@pytest.fixture
async def neo4j_client():
    """Create a Neo4j client for testing."""
    client = Neo4jConnection()
    await client.connect()
    
    # Clean test data
    await client.execute("MATCH (n:Test) DETACH DELETE n")
    
    yield client
    
    # Cleanup
    await client.execute("MATCH (n:Test) DETACH DELETE n")
    await client.close()


class TestNeo4jConnection:
    """Test Neo4j connection and basic operations."""
    
    @pytest.mark.asyncio
    async def test_neo4j_connection(self, neo4j_client: Neo4jConnection):
        """Test that we can connect to Neo4j."""
        result = await neo4j_client.execute("RETURN 1 as value")
        assert result[0]["value"] == 1
    
    @pytest.mark.asyncio
    async def test_create_node(self, neo4j_client: Neo4jConnection):
        """Test creating a node in Neo4j."""
        node_data = {
            "id": "test-1",
            "name": "Test Contract",
            "type": "contract",
            "created_at": datetime.utcnow().isoformat()
        }
        
        node = await create_node(
            neo4j_client,
            label="Test:Contract",
            properties=node_data
        )
        
        assert node["id"] == "test-1"
        assert node["name"] == "Test Contract"
        assert "created_at" in node
    
    @pytest.mark.asyncio
    async def test_create_relationship(self, neo4j_client: Neo4jConnection):
        """Test creating relationships between nodes."""
        # Create two nodes
        contract = await create_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "contract-1", "title": "Main Contract"}
        )
        
        clause = await create_node(
            neo4j_client,
            label="Test:Clause",
            properties={"id": "clause-1", "text": "Payment terms"}
        )
        
        # Create relationship
        rel = await create_relationship(
            neo4j_client,
            from_node_id="contract-1",
            to_node_id="clause-1",
            relationship_type="CONTAINS",
            properties={"order": 1}
        )
        
        assert rel["type"] == "CONTAINS"
        assert rel["properties"]["order"] == 1
    
    @pytest.mark.asyncio
    async def test_find_node(self, neo4j_client: Neo4jConnection):
        """Test finding nodes by properties."""
        # Create test nodes
        await create_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "find-1", "status": "active"}
        )
        await create_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "find-2", "status": "draft"}
        )
        
        # Find by status
        nodes = await find_node(
            neo4j_client,
            label="Test:Contract",
            properties={"status": "active"}
        )
        
        assert len(nodes) == 1
        assert nodes[0]["id"] == "find-1"
    
    @pytest.mark.asyncio
    async def test_update_node(self, neo4j_client: Neo4jConnection):
        """Test updating node properties."""
        # Create node
        await create_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "update-1", "status": "draft"}
        )
        
        # Update node
        updated = await update_node(
            neo4j_client,
            node_id="update-1",
            properties={"status": "active", "updated_at": datetime.utcnow().isoformat()}
        )
        
        assert updated["status"] == "active"
        assert "updated_at" in updated
    
    @pytest.mark.asyncio
    async def test_delete_node(self, neo4j_client: Neo4jConnection):
        """Test deleting nodes and relationships."""
        # Create node
        await create_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "delete-1"}
        )
        
        # Delete node
        result = await delete_node(neo4j_client, node_id="delete-1")
        assert result is True
        
        # Verify deletion
        nodes = await find_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "delete-1"}
        )
        assert len(nodes) == 0


class TestNeo4jGraphOperations:
    """Test complex graph operations."""
    
    @pytest.mark.asyncio
    async def test_find_relationships(self, neo4j_client: Neo4jConnection):
        """Test finding relationships between nodes."""
        # Create nodes and relationships
        contract = await create_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "rel-contract-1"}
        )
        
        party1 = await create_node(
            neo4j_client,
            label="Test:Party",
            properties={"id": "party-1", "name": "Company A"}
        )
        
        party2 = await create_node(
            neo4j_client,
            label="Test:Party",
            properties={"id": "party-2", "name": "Company B"}
        )
        
        await create_relationship(
            neo4j_client,
            from_node_id="rel-contract-1",
            to_node_id="party-1",
            relationship_type="HAS_PARTY"
        )
        
        await create_relationship(
            neo4j_client,
            from_node_id="rel-contract-1",
            to_node_id="party-2",
            relationship_type="HAS_PARTY"
        )
        
        # Find relationships
        relationships = await find_relationships(
            neo4j_client,
            from_node_id="rel-contract-1",
            relationship_type="HAS_PARTY"
        )
        
        assert len(relationships) == 2
        party_names = {r["to_node"]["name"] for r in relationships}
        assert party_names == {"Company A", "Company B"}
    
    @pytest.mark.asyncio
    async def test_get_node_neighbors(self, neo4j_client: Neo4jConnection):
        """Test getting neighboring nodes."""
        # Create a graph structure
        center = await create_node(
            neo4j_client,
            label="Test:Contract",
            properties={"id": "center-1"}
        )
        
        for i in range(3):
            neighbor = await create_node(
                neo4j_client,
                label="Test:Related",
                properties={"id": f"neighbor-{i}"}
            )
            await create_relationship(
                neo4j_client,
                from_node_id="center-1",
                to_node_id=f"neighbor-{i}",
                relationship_type="RELATED_TO"
            )
        
        # Get neighbors
        neighbors = await get_node_neighbors(
            neo4j_client,
            node_id="center-1",
            relationship_type="RELATED_TO"
        )
        
        assert len(neighbors) == 3
        neighbor_ids = {n["id"] for n in neighbors}
        assert neighbor_ids == {"neighbor-0", "neighbor-1", "neighbor-2"}
    
    @pytest.mark.asyncio
    async def test_find_shortest_path(self, neo4j_client: Neo4jConnection):
        """Test finding shortest path between nodes."""
        # Create a chain of nodes
        nodes = []
        for i in range(4):
            node = await create_node(
                neo4j_client,
                label="Test:Node",
                properties={"id": f"path-{i}"}
            )
            nodes.append(node)
        
        # Create chain relationships
        for i in range(3):
            await create_relationship(
                neo4j_client,
                from_node_id=f"path-{i}",
                to_node_id=f"path-{i+1}",
                relationship_type="CONNECTS"
            )
        
        # Find shortest path
        path = await find_shortest_path(
            neo4j_client,
            start_node_id="path-0",
            end_node_id="path-3"
        )
        
        assert len(path) == 4
        path_ids = [n["id"] for n in path]
        assert path_ids == ["path-0", "path-1", "path-2", "path-3"]


class TestNeo4jContractGraph:
    """Test contract-specific graph operations."""
    
    @pytest.mark.asyncio
    async def test_create_contract_graph(self, neo4j_client: Neo4jConnection):
        """Test creating a contract graph structure."""
        contract_data = {
            "id": "contract-graph-1",
            "title": "Service Agreement",
            "parties": [
                {"id": "party-a", "name": "Provider Inc", "role": "provider"},
                {"id": "party-b", "name": "Client Corp", "role": "client"}
            ],
            "clauses": [
                {"id": "clause-1", "type": "payment", "text": "Payment terms..."},
                {"id": "clause-2", "type": "liability", "text": "Liability limits..."}
            ],
            "metadata": {
                "created_date": "2024-01-01",
                "jurisdiction": "California"
            }
        }
        
        graph = await create_contract_graph(neo4j_client, contract_data)
        
        assert graph["contract"]["id"] == "contract-graph-1"
        assert len(graph["parties"]) == 2
        assert len(graph["clauses"]) == 2
        assert graph["metadata"]["jurisdiction"] == "California"
    
    @pytest.mark.asyncio
    async def test_find_related_contracts(self, neo4j_client: Neo4jConnection):
        """Test finding contracts related by parties or clauses."""
        # Create multiple contracts with shared parties
        contract1_data = {
            "id": "related-1",
            "title": "Contract 1",
            "parties": [{"id": "shared-party", "name": "Shared Corp"}]
        }
        contract2_data = {
            "id": "related-2",
            "title": "Contract 2",
            "parties": [{"id": "shared-party", "name": "Shared Corp"}]
        }
        
        await create_contract_graph(neo4j_client, contract1_data)
        await create_contract_graph(neo4j_client, contract2_data)
        
        # Find related contracts
        related = await find_related_contracts(
            neo4j_client,
            contract_id="related-1",
            relationship_types=["HAS_PARTY"]
        )
        
        assert len(related) >= 1
        related_ids = {c["id"] for c in related}
        assert "related-2" in related_ids
    
    @pytest.mark.asyncio
    async def test_find_clause_patterns(self, neo4j_client: Neo4jConnection):
        """Test finding common clause patterns across contracts."""
        # Create contracts with similar clauses
        for i in range(3):
            contract_data = {
                "id": f"pattern-contract-{i}",
                "title": f"Contract {i}",
                "clauses": [
                    {"id": f"payment-{i}", "type": "payment", "text": "Standard payment"},
                    {"id": f"term-{i}", "type": "termination", "text": "Standard termination"}
                ]
            }
            await create_contract_graph(neo4j_client, contract_data)
        
        # Find clause patterns
        patterns = await find_clause_patterns(
            neo4j_client,
            clause_type="payment",
            min_occurrences=2
        )
        
        assert len(patterns) > 0
        assert patterns[0]["type"] == "payment"
        assert patterns[0]["count"] >= 2


class TestNeo4jMultiTenancy:
    """Test multi-tenant graph isolation."""
    
    @pytest.mark.asyncio
    async def test_tenant_graph_isolation(self, neo4j_client: Neo4jConnection):
        """Test that tenant data is isolated in graph."""
        # Create nodes for different tenants
        tenant1_node = await create_node(
            neo4j_client,
            label="Test:Contract:Tenant1",
            properties={"id": "t1-contract-1", "tenant_id": 1}
        )
        
        tenant2_node = await create_node(
            neo4j_client,
            label="Test:Contract:Tenant2",
            properties={"id": "t2-contract-1", "tenant_id": 2}
        )
        
        # Query tenant 1 data
        tenant1_contracts = await find_node(
            neo4j_client,
            label="Test:Contract:Tenant1",
            properties={"tenant_id": 1}
        )
        
        assert len(tenant1_contracts) == 1
        assert tenant1_contracts[0]["id"] == "t1-contract-1"
        
        # Verify isolation
        all_test_contracts = await neo4j_client.execute(
            "MATCH (n:Test:Contract:Tenant1) RETURN n"
        )
        assert all(n["n"]["tenant_id"] == 1 for n in all_test_contracts)