# Neo4j/GraphRAG TDD Best Practices - Legal AI Platform

## Core Principles
You are developing a graph-based knowledge system using Neo4j and GraphRAG for an enterprise legal AI platform. Follow TDD principles for all graph operations, ensuring data integrity and relationship accuracy.

## TDD Cycle for Graph Development

### 1. RED Phase - Write Failing Graph Test First
```python
# L ALWAYS START HERE - Test graph relationships
import pytest
from neo4j import AsyncGraphDatabase
from app.services.graph.contract_graph import ContractGraphService

@pytest.mark.asyncio
async def test_create_contract_relationships():
    # Arrange
    graph_service = ContractGraphService()
    contract_data = {
        "id": "contract-123",
        "title": "Master Agreement",
        "parties": ["Acme Corp", "Legal AI Inc"],
        "references": ["contract-100", "contract-101"]
    }
    
    # Act
    result = await graph_service.create_contract_node(contract_data)
    
    # Assert relationships
    relationships = await graph_service.get_relationships(contract_data["id"])
    assert len(relationships["PARTY_TO"]) == 2
    assert len(relationships["REFERENCES"]) == 2
    assert "Acme Corp" in [r["name"] for r in relationships["PARTY_TO"]]
```

### 2. GREEN Phase - Implement Graph Operations
```cypher
#  Minimal Cypher to pass test
CREATE (c:Contract {id: $contract_id, title: $title})
WITH c
UNWIND $parties AS party_name
MERGE (p:Party {name: party_name})
CREATE (c)-[:PARTY_TO]->(p)
WITH c
UNWIND $references AS ref_id
MATCH (ref:Contract {id: ref_id})
CREATE (c)-[:REFERENCES]->(ref)
RETURN c
```

### 3. REFACTOR Phase - Optimize Graph Queries
```python
# = Refactored with proper patterns and performance
class ContractGraphService:
    def __init__(self, driver: AsyncGraphDatabase):
        self.driver = driver
    
    async def create_contract_with_relationships(
        self, 
        contract_data: Dict[str, Any]
    ) -> ContractNode:
        async with self.driver.session() as session:
            result = await session.execute_write(
                self._create_contract_tx,
                contract_data
            )
            return ContractNode.from_neo4j(result)
    
    @staticmethod
    async def _create_contract_tx(tx, data):
        query = """
        // Create contract node
        CREATE (c:Contract {
            id: $id,
            title: $title,
            created_at: datetime(),
            tenant_id: $tenant_id
        })
        
        // Create party relationships
        WITH c
        UNWIND $parties AS party_data
        MERGE (p:Party {name: party_data.name})
        ON CREATE SET 
            p.type = party_data.type,
            p.jurisdiction = party_data.jurisdiction
        CREATE (c)-[:PARTY_TO {role: party_data.role}]->(p)
        
        // Create document references
        WITH c
        UNWIND $references AS ref_id
        MATCH (ref:Contract {id: ref_id})
        CREATE (c)-[:REFERENCES {
            created_at: datetime(),
            reference_type: 'citation'
        }]->(ref)
        
        // Create obligation nodes
        WITH c
        UNWIND $obligations AS obligation
        CREATE (o:Obligation {
            id: randomUUID(),
            description: obligation.description,
            due_date: date(obligation.due_date),
            responsible_party: obligation.party
        })
        CREATE (c)-[:CONTAINS_OBLIGATION]->(o)
        
        RETURN c
        """
        
        result = await tx.run(query, **data)
        return await result.single()
```

## Graph Schema Testing

### 1. Node Type Testing
```python
import pytest
from app.graph.models import ContractNode, PartyNode, ClauseNode

class TestGraphNodes:
    @pytest.mark.asyncio
    async def test_contract_node_properties(self, graph_db):
        # Test required properties
        contract = ContractNode(
            id="contract-123",
            title="Service Agreement",
            status="active",
            tenant_id="tenant-456"
        )
        
        result = await graph_db.create_node(contract)
        
        # Verify node creation
        node = await graph_db.get_node("Contract", id="contract-123")
        assert node["title"] == "Service Agreement"
        assert node["status"] == "active"
        assert "created_at" in node  # Auto-generated
    
    @pytest.mark.asyncio
    async def test_node_constraints(self, graph_db):
        # Test unique constraints
        await graph_db.create_constraint(
            "Contract", "id", "UNIQUE"
        )
        
        # First creation should succeed
        await graph_db.create_node(
            ContractNode(id="unique-123", title="Test")
        )
        
        # Duplicate should fail
        with pytest.raises(ConstraintViolation):
            await graph_db.create_node(
                ContractNode(id="unique-123", title="Duplicate")
            )
```

### 2. Relationship Testing
```python
class TestGraphRelationships:
    @pytest.mark.asyncio
    async def test_contract_amendment_chain(self, graph_db):
        # Create contract hierarchy
        master = await graph_db.create_node(
            ContractNode(id="master-1", title="Master Agreement")
        )
        
        amendment1 = await graph_db.create_node(
            ContractNode(id="amend-1", title="Amendment 1")
        )
        
        amendment2 = await graph_db.create_node(
            ContractNode(id="amend-2", title="Amendment 2")
        )
        
        # Create amendment chain
        await graph_db.create_relationship(
            amendment1, "AMENDS", master,
            properties={"amendment_date": "2024-01-01"}
        )
        
        await graph_db.create_relationship(
            amendment2, "AMENDS", amendment1,
            properties={"amendment_date": "2024-06-01"}
        )
        
        # Test traversal
        chain = await graph_db.query("""
            MATCH path = (a:Contract {id: 'amend-2'})-[:AMENDS*]->(m:Contract)
            WHERE NOT (m)-[:AMENDS]->()
            RETURN path
        """)
        
        assert len(chain) == 1
        assert chain[0]["master_id"] == "master-1"
    
    @pytest.mark.asyncio
    async def test_circular_reference_prevention(self, graph_db):
        # Create nodes
        doc1 = await graph_db.create_node(
            ContractNode(id="doc-1", title="Document 1")
        )
        doc2 = await graph_db.create_node(
            ContractNode(id="doc-2", title="Document 2")
        )
        
        # Create first reference
        await graph_db.create_relationship(doc1, "REFERENCES", doc2)
        
        # Attempt circular reference
        with pytest.raises(CircularReferenceError):
            await graph_db.create_relationship(doc2, "REFERENCES", doc1)
```

## GraphRAG Implementation Testing

### 1. Knowledge Graph Construction
```python
class TestGraphRAG:
    @pytest.fixture
    async def graph_rag_service(self, graph_db, embedding_service):
        return GraphRAGService(
            graph_db=graph_db,
            embedding_service=embedding_service
        )
    
    @pytest.mark.asyncio
    async def test_document_to_graph_conversion(self, graph_rag_service):
        # Arrange
        document = {
            "content": """
            This Agreement between Acme Corp and Beta Inc establishes 
            payment terms of $10,000 monthly starting January 1, 2024.
            """
        }
        
        # Act
        graph = await graph_rag_service.document_to_graph(document)
        
        # Assert graph structure
        assert len(graph.nodes) >= 4  # Contract, 2 parties, obligation
        assert any(n.label == "Party" and n.name == "Acme Corp" 
                  for n in graph.nodes)
        assert any(n.label == "Obligation" and "$10,000" in n.description 
                  for n in graph.nodes)
        
        # Check relationships
        party_relationships = [r for r in graph.relationships 
                              if r.type == "PARTY_TO"]
        assert len(party_relationships) == 2
    
    @pytest.mark.asyncio
    async def test_graph_enhanced_retrieval(self, graph_rag_service):
        # Build test graph
        await self._create_test_knowledge_graph(graph_rag_service)
        
        # Test retrieval with graph context
        query = "What are the payment obligations for Acme Corp?"
        
        results = await graph_rag_service.retrieve(
            query=query,
            use_graph_context=True,
            hop_limit=2
        )
        
        # Should include related contracts through graph traversal
        assert len(results) > 0
        assert any("Acme Corp" in r.content for r in results)
        assert results[0].graph_context is not None
        assert len(results[0].graph_context["related_entities"]) > 0
```

### 2. Graph Embeddings and Similarity
```python
class TestGraphEmbeddings:
    @pytest.mark.asyncio
    async def test_node_embedding_generation(self, graph_rag_service):
        # Create node with content
        node = ContractNode(
            id="test-123",
            title="Service Agreement",
            content="This agreement covers cloud services..."
        )
        
        # Generate embedding
        embedding = await graph_rag_service.generate_node_embedding(node)
        
        # Verify embedding
        assert len(embedding) == 768  # Embedding dimension
        assert -1 <= min(embedding) <= 1
        assert -1 <= max(embedding) <= 1
    
    @pytest.mark.asyncio
    async def test_graph_similarity_search(self, graph_rag_service):
        # Create test nodes with embeddings
        nodes = [
            ("contract-1", "Software licensing agreement for SaaS"),
            ("contract-2", "Hardware purchase agreement"),
            ("contract-3", "Cloud services subscription agreement")
        ]
        
        for node_id, content in nodes:
            await graph_rag_service.create_node_with_embedding(
                node_id=node_id,
                content=content
            )
        
        # Search for similar nodes
        results = await graph_rag_service.similarity_search(
            query="SaaS software agreement",
            limit=2
        )
        
        # Most similar should be software/cloud related
        assert results[0]["id"] in ["contract-1", "contract-3"]
        assert results[0]["similarity"] > 0.8
```

## Complex Graph Queries

### 1. Path Finding and Analysis
```python
class TestGraphPaths:
    @pytest.mark.asyncio
    async def test_shortest_path_between_entities(self, graph_db):
        # Setup graph with multiple paths
        await self._create_complex_graph(graph_db)
        
        # Find shortest path
        query = """
        MATCH path = shortestPath(
            (start:Party {name: $start_party})-[*]-(end:Party {name: $end_party})
        )
        RETURN path, length(path) as distance
        """
        
        result = await graph_db.query(
            query,
            start_party="Acme Corp",
            end_party="Zeta Industries"
        )
        
        assert result[0]["distance"] <= 3
    
    @pytest.mark.asyncio
    async def test_impact_analysis(self, graph_db):
        # Test finding all affected contracts
        query = """
        MATCH (c:Contract {id: $contract_id})
        CALL apoc.path.subgraphAll(c, {
            relationshipFilter: "AMENDS|SUPERSEDES|DEPENDS_ON",
            maxLevel: 5
        })
        YIELD nodes, relationships
        RETURN nodes, relationships
        """
        
        result = await graph_db.query(
            query,
            contract_id="master-agreement-1"
        )
        
        affected_contracts = [n for n in result["nodes"] 
                            if n.labels == ["Contract"]]
        assert len(affected_contracts) >= 5
```

### 2. Graph Algorithms
```python
class TestGraphAlgorithms:
    @pytest.mark.asyncio
    async def test_centrality_analysis(self, graph_db):
        # Calculate PageRank for contracts
        query = """
        CALL gds.pageRank.stream('contract-graph')
        YIELD nodeId, score
        RETURN gds.util.asNode(nodeId).id AS contract_id, score
        ORDER BY score DESC
        LIMIT 10
        """
        
        results = await graph_db.query(query)
        
        # Most referenced contracts should have higher scores
        assert results[0]["score"] > results[-1]["score"]
        assert all(r["score"] > 0 for r in results)
    
    @pytest.mark.asyncio
    async def test_community_detection(self, graph_db):
        # Detect contract communities
        query = """
        CALL gds.louvain.stream('contract-graph')
        YIELD nodeId, communityId
        RETURN 
            communityId,
            collect(gds.util.asNode(nodeId).title) as contracts
        ORDER BY size(contracts) DESC
        """
        
        communities = await graph_db.query(query)
        
        # Should identify distinct contract groups
        assert len(communities) > 1
        assert all(len(c["contracts"]) > 0 for c in communities)
```

## Transaction and Consistency Testing

### 1. ACID Compliance
```python
class TestGraphTransactions:
    @pytest.mark.asyncio
    async def test_transaction_rollback(self, graph_db):
        # Start transaction
        tx = await graph_db.begin_transaction()
        
        try:
            # Create nodes in transaction
            await tx.run(
                "CREATE (c:Contract {id: $id})",
                id="temp-123"
            )
            
            # Force error
            raise Exception("Simulated error")
            
            await tx.commit()
        except Exception:
            await tx.rollback()
        
        # Verify node was not created
        result = await graph_db.query(
            "MATCH (c:Contract {id: $id}) RETURN c",
            id="temp-123"
        )
        assert len(result) == 0
    
    @pytest.mark.asyncio
    async def test_concurrent_updates(self, graph_db):
        # Create initial node
        await graph_db.query(
            "CREATE (c:Contract {id: $id, counter: 0})",
            id="concurrent-test"
        )
        
        # Simulate concurrent updates
        async def increment_counter():
            await graph_db.query("""
                MATCH (c:Contract {id: $id})
                SET c.counter = c.counter + 1
            """, id="concurrent-test")
        
        # Run multiple concurrent updates
        tasks = [increment_counter() for _ in range(10)]
        await asyncio.gather(*tasks)
        
        # Verify final count
        result = await graph_db.query(
            "MATCH (c:Contract {id: $id}) RETURN c.counter as count",
            id="concurrent-test"
        )
        assert result[0]["count"] == 10
```

## Performance Testing

### 1. Query Performance
```python
class TestGraphPerformance:
    @pytest.mark.asyncio
    async def test_large_graph_query_performance(self, graph_db):
        # Create large graph (10,000 nodes)
        await self._create_large_test_graph(graph_db, num_nodes=10000)
        
        # Test query performance
        start_time = time.time()
        
        result = await graph_db.query("""
            MATCH (c:Contract)-[:PARTY_TO]->(p:Party)
            WHERE p.name STARTS WITH 'Acme'
            RETURN c.id, c.title
            LIMIT 100
        """)
        
        duration = time.time() - start_time
        
        # Should complete in under 100ms with proper indexing
        assert duration < 0.1
        assert len(result) <= 100
    
    @pytest.mark.asyncio
    async def test_index_usage(self, graph_db):
        # Create indexes
        await graph_db.query(
            "CREATE INDEX contract_id IF NOT EXISTS FOR (c:Contract) ON (c.id)"
        )
        await graph_db.query(
            "CREATE INDEX party_name IF NOT EXISTS FOR (p:Party) ON (p.name)"
        )
        
        # Verify index usage with EXPLAIN
        explain = await graph_db.query("""
            EXPLAIN
            MATCH (c:Contract {id: 'test-123'})
            RETURN c
        """)
        
        # Should use index seek, not scan
        assert "NodeIndexSeek" in str(explain)
```

## Graph Visualization Testing

### 1. Subgraph Extraction
```python
class TestGraphVisualization:
    @pytest.mark.asyncio
    async def test_subgraph_extraction_for_visualization(self, graph_db):
        # Extract subgraph around a node
        query = """
        MATCH (center:Contract {id: $contract_id})
        CALL apoc.path.subgraphAll(center, {
            maxLevel: 2,
            limit: 50
        })
        YIELD nodes, relationships
        RETURN 
            [n in nodes | {
                id: n.id,
                label: labels(n)[0],
                properties: properties(n)
            }] as nodes,
            [r in relationships | {
                source: startNode(r).id,
                target: endNode(r).id,
                type: type(r),
                properties: properties(r)
            }] as edges
        """
        
        result = await graph_db.query(
            query,
            contract_id="center-contract"
        )
        
        # Verify structure for visualization
        assert "nodes" in result[0]
        assert "edges" in result[0]
        assert len(result[0]["nodes"]) <= 50
        
        # All edges should connect existing nodes
        node_ids = {n["id"] for n in result[0]["nodes"]}
        for edge in result[0]["edges"]:
            assert edge["source"] in node_ids
            assert edge["target"] in node_ids
```

## Graph Maintenance Testing

### 1. Data Integrity
```python
class TestGraphMaintenance:
    @pytest.mark.asyncio
    async def test_orphaned_node_detection(self, graph_db):
        # Create orphaned nodes
        await graph_db.query("""
            CREATE (c:Contract {id: 'orphan-1', title: 'Orphaned Contract'})
            CREATE (p:Party {name: 'Orphaned Party'})
        """)
        
        # Detect orphaned nodes
        orphans = await graph_db.query("""
            MATCH (n)
            WHERE NOT (n)-[]-()
            RETURN labels(n)[0] as type, count(n) as count
        """)
        
        assert any(o["type"] == "Contract" for o in orphans)
        assert any(o["type"] == "Party" for o in orphans)
    
    @pytest.mark.asyncio
    async def test_duplicate_relationship_prevention(self, graph_db):
        # Create nodes
        await graph_db.query("""
            CREATE (c:Contract {id: 'contract-1'})
            CREATE (p:Party {name: 'Party A'})
        """)
        
        # Create first relationship
        await graph_db.query("""
            MATCH (c:Contract {id: 'contract-1'})
            MATCH (p:Party {name: 'Party A'})
            MERGE (c)-[:PARTY_TO]->(p)
        """)
        
        # Attempt duplicate (should not create)
        await graph_db.query("""
            MATCH (c:Contract {id: 'contract-1'})
            MATCH (p:Party {name: 'Party A'})
            MERGE (c)-[:PARTY_TO]->(p)
        """)
        
        # Verify only one relationship exists
        result = await graph_db.query("""
            MATCH (c:Contract {id: 'contract-1'})-[r:PARTY_TO]->(p:Party {name: 'Party A'})
            RETURN count(r) as rel_count
        """)
        
        assert result[0]["rel_count"] == 1
```

## Testing Best Practices

### Test Organization
```python
# tests/graph/
#    unit/
#       test_nodes.py
#       test_relationships.py
#       test_queries.py
#    integration/
#       test_graphrag.py
#       test_algorithms.py
#       test_transactions.py
#    performance/
#       test_query_performance.py
#    fixtures/
#        graph_fixtures.py
```

### Graph Test Fixtures
```python
# fixtures/graph_fixtures.py
import pytest
from neo4j import AsyncGraphDatabase

@pytest.fixture
async def graph_db():
    """Provide test graph database connection."""
    driver = AsyncGraphDatabase.driver(
        "bolt://localhost:7687",
        auth=("neo4j", "test_password")
    )
    
    # Clear test database
    async with driver.session() as session:
        await session.run("MATCH (n) DETACH DELETE n")
    
    yield driver
    
    # Cleanup
    async with driver.session() as session:
        await session.run("MATCH (n) DETACH DELETE n")
    
    await driver.close()

@pytest.fixture
async def sample_contract_graph(graph_db):
    """Create sample contract graph for testing."""
    async with graph_db.session() as session:
        await session.run("""
            // Create contracts
            CREATE (c1:Contract {id: 'master-1', title: 'Master Agreement'})
            CREATE (c2:Contract {id: 'amend-1', title: 'Amendment 1'})
            CREATE (c3:Contract {id: 'sow-1', title: 'Statement of Work'})
            
            // Create parties
            CREATE (p1:Party {name: 'Acme Corp', type: 'corporation'})
            CREATE (p2:Party {name: 'Beta Inc', type: 'corporation'})
            
            // Create relationships
            CREATE (c1)-[:PARTY_TO {role: 'vendor'}]->(p1)
            CREATE (c1)-[:PARTY_TO {role: 'client'}]->(p2)
            CREATE (c2)-[:AMENDS {date: date('2024-01-01')}]->(c1)
            CREATE (c3)-[:REFERENCES]->(c1)
        """)
    
    return graph_db
```

## Common Pitfalls to Avoid

1. **Never ignore relationship directions** - They matter in legal contexts
2. **Always use parameters** - Prevent Cypher injection
3. **Don't create unbounded queries** - Always use LIMIT
4. **Avoid Cartesian products** - Use proper MATCH patterns
5. **Never skip indexes** - They're crucial for performance
6. **Don't ignore transaction boundaries** - Ensure consistency
7. **Always validate graph structure** - Prevent invalid states
8. **Don't hardcode node IDs** - Use business keys

## Performance Guidelines

1. **Create indexes for frequent lookups**
```cypher
CREATE INDEX FOR (c:Contract) ON (c.id);
CREATE INDEX FOR (p:Party) ON (p.name);
CREATE INDEX FOR (c:Contract) ON (c.tenant_id);
```

2. **Use relationship indexes for large graphs**
```cypher
CREATE INDEX FOR ()-[r:PARTY_TO]-() ON (r.role);
```

3. **Profile queries before production**
```cypher
PROFILE MATCH (c:Contract)-[:PARTY_TO]->(p:Party)
WHERE p.name = 'Acme Corp'
RETURN c
```

Remember: Every graph operation should be tested for correctness, performance, and consistency.