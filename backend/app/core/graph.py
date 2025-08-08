"""
Neo4j graph database implementation for relationship management.
"""
import os
from typing import Dict, List, Any, Optional, Union
from neo4j import AsyncGraphDatabase, AsyncDriver, AsyncSession
from app.core.config import settings


class Neo4jConnection:
    """Neo4j async connection manager."""
    
    def __init__(self, uri: Optional[str] = None, user: Optional[str] = None, password: Optional[str] = None):
        """Initialize Neo4j connection parameters."""
        self.uri = uri or settings.NEO4J_URI
        self.user = user or settings.NEO4J_USER
        self.password = password or settings.NEO4J_PASSWORD
        self.driver: Optional[AsyncDriver] = None
    
    async def connect(self) -> None:
        """Establish connection to Neo4j."""
        if not self.driver:
            self.driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password)
            )
    
    async def close(self) -> None:
        """Close Neo4j connection."""
        if self.driver:
            await self.driver.close()
    
    async def execute(self, query: str, parameters: Optional[Dict] = None) -> List[Dict]:
        """Execute a Cypher query."""
        async with self.driver.session() as session:
            result = await session.run(query, parameters or {})
            return [record.data() async for record in result]
    
    async def execute_write(self, query: str, parameters: Optional[Dict] = None) -> List[Dict]:
        """Execute a write transaction."""
        async def work(tx):
            result = await tx.run(query, parameters or {})
            return [record.data() async for record in result]
        
        async with self.driver.session() as session:
            return await session.execute_write(work)
    
    async def execute_read(self, query: str, parameters: Optional[Dict] = None) -> List[Dict]:
        """Execute a read transaction."""
        async def work(tx):
            result = await tx.run(query, parameters or {})
            return [record.data() async for record in result]
        
        async with self.driver.session() as session:
            return await session.execute_read(work)


_neo4j_client: Optional[Neo4jConnection] = None


async def get_neo4j_client() -> Neo4jConnection:
    """Get Neo4j client singleton."""
    global _neo4j_client
    if not _neo4j_client:
        _neo4j_client = Neo4jConnection()
        await _neo4j_client.connect()
    return _neo4j_client


async def create_node(
    client: Neo4jConnection,
    label: str,
    properties: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create a node in Neo4j.
    
    Args:
        client: Neo4j connection
        label: Node label(s), can be multiple separated by colon
        properties: Node properties
        
    Returns:
        Created node data
    """
    query = f"""
    CREATE (n:{label} $properties)
    RETURN n
    """
    result = await client.execute_write(query, {"properties": properties})
    return result[0]["n"] if result else {}


async def create_relationship(
    client: Neo4jConnection,
    from_node_id: str,
    to_node_id: str,
    relationship_type: str,
    properties: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a relationship between two nodes.
    
    Args:
        client: Neo4j connection
        from_node_id: Source node ID
        to_node_id: Target node ID
        relationship_type: Type of relationship
        properties: Relationship properties
        
    Returns:
        Created relationship data
    """
    query = f"""
    MATCH (a {{id: $from_id}})
    MATCH (b {{id: $to_id}})
    CREATE (a)-[r:{relationship_type} $properties]->(b)
    RETURN type(r) as type, properties(r) as properties
    """
    params = {
        "from_id": from_node_id,
        "to_id": to_node_id,
        "properties": properties or {}
    }
    result = await client.execute_write(query, params)
    return result[0] if result else {}


async def find_node(
    client: Neo4jConnection,
    label: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Find nodes by label and/or properties.
    
    Args:
        client: Neo4j connection
        label: Optional node label filter
        properties: Optional property filters
        
    Returns:
        List of matching nodes
    """
    label_clause = f":{label}" if label else ""
    where_clauses = []
    
    if properties:
        for key, value in properties.items():
            where_clauses.append(f"n.{key} = ${key}")
    
    where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    
    query = f"""
    MATCH (n{label_clause})
    {where_clause}
    RETURN n
    """
    
    result = await client.execute_read(query, properties or {})
    return [record["n"] for record in result]


async def find_relationships(
    client: Neo4jConnection,
    from_node_id: Optional[str] = None,
    to_node_id: Optional[str] = None,
    relationship_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Find relationships between nodes.
    
    Args:
        client: Neo4j connection
        from_node_id: Optional source node ID
        to_node_id: Optional target node ID
        relationship_type: Optional relationship type filter
        
    Returns:
        List of relationships with connected nodes
    """
    rel_type = f":{relationship_type}" if relationship_type else ""
    where_clauses = []
    params = {}
    
    if from_node_id:
        where_clauses.append("a.id = $from_id")
        params["from_id"] = from_node_id
    
    if to_node_id:
        where_clauses.append("b.id = $to_id")
        params["to_id"] = to_node_id
    
    where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    
    query = f"""
    MATCH (a)-[r{rel_type}]->(b)
    {where_clause}
    RETURN a as from_node, type(r) as type, properties(r) as properties, b as to_node
    """
    
    result = await client.execute_read(query, params)
    return result


async def update_node(
    client: Neo4jConnection,
    node_id: str,
    properties: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Update node properties.
    
    Args:
        client: Neo4j connection
        node_id: Node ID to update
        properties: Properties to update
        
    Returns:
        Updated node data
    """
    set_clauses = [f"n.{key} = ${key}" for key in properties.keys()]
    set_clause = ", ".join(set_clauses)
    
    query = f"""
    MATCH (n {{id: $node_id}})
    SET {set_clause}
    RETURN n
    """
    
    params = {"node_id": node_id, **properties}
    result = await client.execute_write(query, params)
    return result[0]["n"] if result else {}


async def delete_node(
    client: Neo4jConnection,
    node_id: str
) -> bool:
    """
    Delete a node and its relationships.
    
    Args:
        client: Neo4j connection
        node_id: Node ID to delete
        
    Returns:
        True if deleted successfully
    """
    query = """
    MATCH (n {id: $node_id})
    DETACH DELETE n
    RETURN count(n) as deleted
    """
    
    result = await client.execute_write(query, {"node_id": node_id})
    return result[0]["deleted"] > 0 if result else False


async def execute_cypher(
    client: Neo4jConnection,
    query: str,
    parameters: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Execute arbitrary Cypher query.
    
    Args:
        client: Neo4j connection
        query: Cypher query
        parameters: Query parameters
        
    Returns:
        Query results
    """
    return await client.execute(query, parameters)


async def get_node_neighbors(
    client: Neo4jConnection,
    node_id: str,
    relationship_type: Optional[str] = None,
    direction: str = "both"
) -> List[Dict[str, Any]]:
    """
    Get neighboring nodes.
    
    Args:
        client: Neo4j connection
        node_id: Center node ID
        relationship_type: Optional relationship type filter
        direction: Relationship direction (in, out, both)
        
    Returns:
        List of neighboring nodes
    """
    rel_type = f":{relationship_type}" if relationship_type else ""
    
    if direction == "in":
        pattern = f"(n)<-[r{rel_type}]-(neighbor)"
    elif direction == "out":
        pattern = f"(n)-[r{rel_type}]->(neighbor)"
    else:
        pattern = f"(n)-[r{rel_type}]-(neighbor)"
    
    query = f"""
    MATCH {pattern}
    WHERE n.id = $node_id
    RETURN DISTINCT neighbor
    """
    
    result = await client.execute_read(query, {"node_id": node_id})
    return [record["neighbor"] for record in result]


async def find_shortest_path(
    client: Neo4jConnection,
    start_node_id: str,
    end_node_id: str,
    max_length: int = 10
) -> List[Dict[str, Any]]:
    """
    Find shortest path between two nodes.
    
    Args:
        client: Neo4j connection
        start_node_id: Starting node ID
        end_node_id: Ending node ID
        max_length: Maximum path length
        
    Returns:
        List of nodes in the shortest path
    """
    query = """
    MATCH (start {id: $start_id}), (end {id: $end_id})
    MATCH path = shortestPath((start)-[*..%d]-(end))
    RETURN [node in nodes(path) | node] as path
    """ % max_length
    
    params = {"start_id": start_node_id, "end_id": end_node_id}
    result = await client.execute_read(query, params)
    return result[0]["path"] if result else []


async def create_contract_graph(
    client: Neo4jConnection,
    contract_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create a complete contract graph structure.
    
    Args:
        client: Neo4j connection
        contract_data: Contract data including parties, clauses, metadata
        
    Returns:
        Created graph structure
    """
    graph = {"contract": {}, "parties": [], "clauses": [], "metadata": {}}
    
    # Create contract node
    contract_props = {
        "id": contract_data["id"],
        "title": contract_data.get("title", ""),
        **contract_data.get("metadata", {})
    }
    graph["contract"] = await create_node(client, "Contract", contract_props)
    graph["metadata"] = contract_data.get("metadata", {})
    
    # Create party nodes and relationships
    for party in contract_data.get("parties", []):
        party_node = await create_node(client, "Party", party)
        graph["parties"].append(party_node)
        
        await create_relationship(
            client,
            from_node_id=contract_data["id"],
            to_node_id=party["id"],
            relationship_type="HAS_PARTY",
            properties={"role": party.get("role", "party")}
        )
    
    # Create clause nodes and relationships
    for idx, clause in enumerate(contract_data.get("clauses", [])):
        clause_node = await create_node(client, "Clause", clause)
        graph["clauses"].append(clause_node)
        
        await create_relationship(
            client,
            from_node_id=contract_data["id"],
            to_node_id=clause["id"],
            relationship_type="CONTAINS",
            properties={"order": idx + 1}
        )
    
    return graph


async def find_related_contracts(
    client: Neo4jConnection,
    contract_id: str,
    relationship_types: List[str] = ["HAS_PARTY", "CONTAINS"]
) -> List[Dict[str, Any]]:
    """
    Find contracts related through shared entities.
    
    Args:
        client: Neo4j connection
        contract_id: Source contract ID
        relationship_types: Types of relationships to follow
        
    Returns:
        List of related contracts
    """
    rel_pattern = "|".join(relationship_types)
    
    query = f"""
    MATCH (c1:Contract {{id: $contract_id}})-[:{rel_pattern}]-(shared)-[:{rel_pattern}]-(c2:Contract)
    WHERE c1 <> c2
    RETURN DISTINCT c2
    """
    
    result = await client.execute_read(query, {"contract_id": contract_id})
    return [record["c2"] for record in result]


async def find_clause_patterns(
    client: Neo4jConnection,
    clause_type: str,
    min_occurrences: int = 2
) -> List[Dict[str, Any]]:
    """
    Find common clause patterns across contracts.
    
    Args:
        client: Neo4j connection
        clause_type: Type of clause to analyze
        min_occurrences: Minimum number of occurrences
        
    Returns:
        List of clause patterns with statistics
    """
    query = """
    MATCH (c:Contract)-[:CONTAINS]->(clause:Clause {type: $clause_type})
    WITH clause.text as text, clause.type as type, count(DISTINCT c) as count
    WHERE count >= $min_count
    RETURN type, text, count
    ORDER BY count DESC
    """
    
    params = {"clause_type": clause_type, "min_count": min_occurrences}
    result = await client.execute_read(query, params)
    return result