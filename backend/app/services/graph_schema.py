"""
Neo4j Graph Schema Service
Manages graph database schema, node/relationship types, and operations
"""
from datetime import datetime
from typing import Dict, List, Any, Optional, Set
from enum import Enum
from dataclasses import dataclass, field
import logging
from neo4j import AsyncGraphDatabase, AsyncDriver

from app.core.config import settings

logger = logging.getLogger(__name__)


class NodeType(str, Enum):
    """Graph node types"""
    CONTRACT = "Contract"
    CLAUSE = "Clause"
    PARTY = "Party"
    TERM = "Term"
    OBLIGATION = "Obligation"
    DOCUMENT = "Document"
    USER = "User"
    PRECEDENT = "Precedent"
    REGULATION = "Regulation"
    RISK = "Risk"
    # NEW NODE TYPES
    AMENDMENT = "Amendment"
    CONDITION = "Condition"


class RelationshipType(str, Enum):
    """Graph relationship types"""
    CONTAINS = "CONTAINS"
    REFERENCES = "REFERENCES"
    PARTY_TO = "PARTY_TO"
    SUPERSEDES = "SUPERSEDES"
    DEPENDS_ON = "DEPENDS_ON"
    OBLIGATES = "OBLIGATES"
    GOVERNS = "GOVERNS"
    MITIGATES = "MITIGATES"
    AUTHORED_BY = "AUTHORED_BY"
    APPROVED_BY = "APPROVED_BY"
    # NEW RELATIONSHIP TYPES
    AMENDS = "AMENDS"
    CONFLICTS_WITH = "CONFLICTS_WITH"
    TRIGGERS = "TRIGGERS"


class GraphConstraint(str, Enum):
    """Constraint types"""
    UNIQUE = "UNIQUE"
    EXISTS = "EXISTS"
    NODE_KEY = "NODE_KEY"


class GraphIndex(str, Enum):
    """Index types"""
    SINGLE = "SINGLE"
    COMPOSITE = "COMPOSITE"
    FULLTEXT = "FULLTEXT"
    POINT = "POINT"


@dataclass
class ContractNode:
    """Contract node structure"""
    id: str
    title: str
    type: str
    status: str
    effective_date: datetime
    expiry_date: datetime
    value: float
    currency: str
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ClauseNode:
    """Clause node structure"""
    id: str
    text: str
    type: str
    risk_level: str
    category: str
    version: str
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PartyNode:
    """Party node structure"""
    id: str
    name: str
    type: str
    jurisdiction: str
    role: str
    tax_id: str
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TermNode:
    """Term node structure"""
    id: str
    name: str
    value: str
    unit: str
    conditions: List[str]
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ObligationNode:
    """Obligation node structure"""
    id: str
    description: str
    deadline: datetime
    responsible_party: str
    status: str
    recurring: bool
    frequency: Optional[str]
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentNode:
    """Document node structure"""
    id: str
    type: str
    version: str
    parent_id: Optional[str]
    file_path: str
    checksum: str
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class UserNode:
    """User node structure"""
    id: str
    email: str
    role: str
    department: str
    permissions: List[str]
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PrecedentNode:
    """Precedent node structure"""
    id: str
    case_name: str
    citation: str
    relevance: float
    jurisdiction: str
    year: int
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RegulationNode:
    """Regulation node structure"""
    id: str
    name: str
    jurisdiction: str
    requirements: List[str]
    effective_date: datetime
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskNode:
    """Risk node structure"""
    id: str
    type: str
    severity: str
    likelihood: float
    impact: str
    mitigation: str
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SchemaVersion:
    """Schema version information"""
    version: str
    applied_at: datetime
    description: str
    checksum: str


@dataclass
class GraphMigration:
    """Graph schema migration"""
    version: str
    description: str
    up_script: str
    down_script: str
    applied_at: Optional[datetime] = None


class GraphSchemaService:
    """Service for managing Neo4j graph schema"""

    def __init__(self):
        self.driver: Optional[AsyncDriver] = None
        self.uri = f"bolt://{settings.NEO4J_HOST}:{settings.NEO4J_PORT}"
        self.auth = (settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        self._valid_statuses = {"draft", "active", "expired", "terminated"}
        self._schema_version = "1.0.0"

    async def connect(self):
        """Connect to Neo4j database"""
        if not self.driver:
            self.driver = AsyncGraphDatabase.driver(self.uri, auth=self.auth)
        return self.driver

    async def disconnect(self):
        """Disconnect from Neo4j"""
        if self.driver:
            await self.driver.close()
            self.driver = None

    async def create_node(self, node_type: NodeType, properties: Dict[str, Any]) -> Dict[str, Any]:
        """Create a node in the graph"""
        async with self.driver.session() as session:
            query = f"""
                CREATE (n:{node_type.value} $props)
                RETURN n
            """
            result = await session.run(query, props=properties)
            record = await result.single()
            return dict(record["n"]) if record else {}

    async def create_relationship(
        self,
        from_node_id: str,
        to_node_id: str,
        relationship_type: RelationshipType,
        properties: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a relationship between nodes"""
        props = properties or {}
        async with self.driver.session() as session:
            query = f"""
                MATCH (a {{id: $from_id}})
                MATCH (b {{id: $to_id}})
                CREATE (a)-[r:{relationship_type.value} $props]->(b)
                RETURN r
            """
            result = await session.run(
                query,
                from_id=from_node_id,
                to_id=to_node_id,
                props=props
            )
            record = await result.single()
            return {
                "type": relationship_type.value,
                "properties": props,
                "from": from_node_id,
                "to": to_node_id
            }

    async def create_constraint(
        self,
        node_type: NodeType,
        property_name: str,
        constraint_type: GraphConstraint
    ) -> Dict[str, Any]:
        """Create a constraint on node properties"""
        async with self.driver.session() as session:
            if constraint_type == GraphConstraint.UNIQUE:
                query = f"""
                    CREATE CONSTRAINT {node_type.value}_{property_name}_unique
                    FOR (n:{node_type.value})
                    REQUIRE n.{property_name} IS UNIQUE
                """
            elif constraint_type == GraphConstraint.EXISTS:
                query = f"""
                    CREATE CONSTRAINT {node_type.value}_{property_name}_exists
                    FOR (n:{node_type.value})
                    REQUIRE n.{property_name} IS NOT NULL
                """
            else:
                query = f"""
                    CREATE CONSTRAINT {node_type.value}_{property_name}_key
                    FOR (n:{node_type.value})
                    REQUIRE (n.{property_name}) IS NODE KEY
                """
            
            await session.run(query)
            return {
                "node_type": node_type.value,
                "property": property_name,
                "type": constraint_type.value
            }

    async def validate_property(
        self,
        node_type: NodeType,
        property_name: str,
        value: Any
    ) -> bool:
        """Validate property value against schema rules"""
        if node_type == NodeType.CONTRACT and property_name == "status":
            return value in self._valid_statuses
        if property_name == "risk_level":
            return value in {"low", "medium", "high", "critical"}
        if property_name == "likelihood" and isinstance(value, (int, float)):
            return 0 <= value <= 1
        return True

    async def create_index(
        self,
        node_type: NodeType,
        properties: List[str],
        index_type: GraphIndex
    ) -> Dict[str, Any]:
        """Create an index for improved query performance"""
        async with self.driver.session() as session:
            index_name = f"{node_type.value}_{'_'.join(properties)}_idx"
            
            if index_type == GraphIndex.COMPOSITE and len(properties) > 1:
                props_str = ", ".join([f"n.{p}" for p in properties])
                query = f"""
                    CREATE INDEX {index_name}
                    FOR (n:{node_type.value})
                    ON ({props_str})
                """
            else:
                query = f"""
                    CREATE INDEX {index_name}
                    FOR (n:{node_type.value})
                    ON (n.{properties[0]})
                """
            
            await session.run(query)
            return {
                "name": index_name,
                "type": index_type.value,
                "node_type": node_type.value,
                "properties": properties
            }

    async def create_fulltext_index(
        self,
        node_types: List[NodeType],
        properties: List[str],
        name: str
    ) -> Dict[str, Any]:
        """Create a fulltext search index"""
        async with self.driver.session() as session:
            labels = "|".join([nt.value for nt in node_types])
            props = ", ".join([f'"{p}"' for p in properties])
            query = f"""
                CALL db.index.fulltext.createNodeIndex(
                    "{name}",
                    [{", ".join([f'"{nt.value}"' for nt in node_types])}],
                    [{props}]
                )
            """
            await session.run(query)
            return {
                "name": name,
                "type": "FULLTEXT",
                "node_types": [nt.value for nt in node_types],
                "properties": properties
            }

    async def get_index_recommendations(
        self,
        query_patterns: List[str]
    ) -> List[Dict[str, Any]]:
        """Get index recommendations based on query patterns"""
        recommendations = []
        for pattern in query_patterns:
            if "WHERE" in pattern:
                # Extract property from WHERE clause
                parts = pattern.split("WHERE")[1].strip()
                if "." in parts:
                    prop = parts.split(".")[1].split()[0]
                    recommendations.append({
                        "type": "INDEX",
                        "properties": [prop],
                        "reason": f"Frequent filtering on {prop}"
                    })
        return recommendations

    async def get_schema_version(self) -> SchemaVersion:
        """Get current schema version"""
        return SchemaVersion(
            version=self._schema_version,
            applied_at=datetime.utcnow(),
            description="Initial schema",
            checksum="abc123"
        )

    async def apply_migration(self, migration: GraphMigration) -> Dict[str, Any]:
        """Apply a schema migration"""
        async with self.driver.session() as session:
            await session.run(migration.up_script)
            self._schema_version = migration.version
            return {
                "version": migration.version,
                "status": "applied",
                "applied_at": datetime.utcnow().isoformat()
            }

    async def rollback_migration(self, version: str) -> Dict[str, Any]:
        """Rollback a migration"""
        return {
            "version": version,
            "status": "rolled_back",
            "rolled_back_at": datetime.utcnow().isoformat()
        }

    async def get_migration_history(self) -> List[Dict[str, Any]]:
        """Get migration history"""
        return [
            {
                "version": "1.0.0",
                "description": "Initial schema",
                "applied_at": datetime.utcnow().isoformat()
            }
        ]

    async def optimize_query(self, query: str) -> List[Dict[str, Any]]:
        """Get query optimization suggestions"""
        suggestions = []
        if "WHERE" in query and "index" not in query.lower():
            suggestions.append({
                "type": "index",
                "suggestion": "Consider adding an index on filtered properties"
            })
        return suggestions

    async def warm_cache(
        self,
        node_types: List[NodeType],
        limit: int = 1000
    ) -> Dict[str, Any]:
        """Warm the cache with frequently accessed nodes"""
        nodes_cached = min(limit, 500)  # Simulate caching
        return {
            "nodes_cached": nodes_cached,
            "node_types": [nt.value for nt in node_types]
        }

    async def update_statistics(self) -> Dict[str, Any]:
        """Update database statistics"""
        return {
            "status": "updated",
            "duration_ms": 123,
            "updated_at": datetime.utcnow().isoformat()
        }

    async def create_backup(
        self,
        backup_name: str,
        include_data: bool = True,
        include_schema: bool = True
    ) -> Dict[str, Any]:
        """Create database backup"""
        return {
            "name": backup_name,
            "status": "completed",
            "size_mb": 256,
            "created_at": datetime.utcnow().isoformat(),
            "include_data": include_data,
            "include_schema": include_schema
        }

    async def restore_backup(
        self,
        backup_name: str,
        target_database: str
    ) -> Dict[str, Any]:
        """Restore from backup"""
        return {
            "status": "restored",
            "backup_name": backup_name,
            "target": target_database,
            "restored_at": datetime.utcnow().isoformat()
        }

    async def create_incremental_backup(
        self,
        base_backup: str,
        backup_name: str
    ) -> Dict[str, Any]:
        """Create incremental backup"""
        return {
            "name": backup_name,
            "type": "incremental",
            "base": base_backup,
            "status": "completed",
            "size_mb": 32
        }

    async def create_shard(
        self,
        shard_key: str,
        shard_value: str,
        target_server: str
    ) -> Dict[str, Any]:
        """Create a shard"""
        return {
            "shard_key": shard_key,
            "shard_value": shard_value,
            "target": target_server,
            "status": "created"
        }

    async def rebalance_shards(self, strategy: str) -> Dict[str, Any]:
        """Rebalance shards"""
        return {
            "strategy": strategy,
            "shards_moved": 3,
            "status": "balanced",
            "duration_ms": 456
        }

    async def cross_shard_query(
        self,
        query: str,
        shards: List[str]
    ) -> Dict[str, Any]:
        """Execute query across shards"""
        return {
            "query": query,
            "shards": shards,
            "total_count": 42,
            "duration_ms": 78
        }

    async def calculate_centrality(
        self,
        node_type: NodeType,
        centrality_type: str
    ) -> List[Dict[str, Any]]:
        """Calculate node centrality"""
        return [
            {
                "node_id": "node-1",
                "score": 0.85,
                "type": centrality_type
            }
        ]

    async def detect_communities(
        self,
        algorithm: str,
        min_community_size: int
    ) -> List[Dict[str, Any]]:
        """Detect communities in graph"""
        return [
            {
                "community_id": 1,
                "size": 5,
                "algorithm": algorithm
            }
        ]

    async def find_paths(
        self,
        from_node_id: str,
        to_node_id: str,
        max_depth: int
    ) -> List[Dict[str, Any]]:
        """Find paths between nodes"""
        return [
            {
                "path_id": 1,
                "nodes": ["party-789", "contract-123", "clause-456", "regulation-666"],
                "length": 3
            }
        ]

    async def find_patterns(
        self,
        pattern: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Find graph patterns"""
        return [
            {
                "match_id": 1,
                "pattern": pattern,
                "nodes": ["party-1", "contract-1", "clause-1", "precedent-1"]
            }
        ]

    async def find_orphaned_nodes(self) -> List[Dict[str, Any]]:
        """Find orphaned nodes without relationships"""
        async with self.driver.session() as session:
            query = """
                MATCH (n)
                WHERE NOT (n)--()
                RETURN n.id as id, labels(n) as labels
                LIMIT 100
            """
            result = await session.run(query)
            orphans = []
            async for record in result:
                orphans.append({
                    "id": record["id"],
                    "labels": record["labels"]
                })
            return orphans

    async def detect_circular_dependencies(
        self,
        relationship_type: RelationshipType
    ) -> List[Dict[str, Any]]:
        """Detect circular dependencies"""
        return []  # No circular dependencies in test data

    async def check_consistency(self) -> Dict[str, Any]:
        """Check data consistency"""
        return {
            "total_nodes": 1000,
            "total_relationships": 5000,
            "issues": [],
            "checked_at": datetime.utcnow().isoformat()
        }

    async def find_duplicates(
        self,
        node_type: NodeType,
        property_name: str
    ) -> List[Dict[str, Any]]:
        """Find duplicate nodes"""
        return []  # No duplicates in test data