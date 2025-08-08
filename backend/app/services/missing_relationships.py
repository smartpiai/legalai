"""
Missing Graph Relationship Types Service
Implements AMENDS, CONFLICTS_WITH, and TRIGGERS relationships for Neo4j graph
Following strict TDD methodology and keeping under 750 lines
"""
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set
from enum import Enum
from dataclasses import dataclass, field
import logging
from neo4j import AsyncGraphDatabase, AsyncDriver

from app.core.config import settings

logger = logging.getLogger(__name__)


class RelationshipType(str, Enum):
    """Additional relationship types"""
    AMENDS = "AMENDS"
    CONFLICTS_WITH = "CONFLICTS_WITH"
    TRIGGERS = "TRIGGERS"


class NodeType(str, Enum):
    """Additional node types"""
    AMENDMENT = "Amendment"
    CONDITION = "Condition"


@dataclass
class AmendmentNode:
    """Amendment node structure"""
    id: str
    title: str
    amendment_type: str
    effective_date: datetime
    original_contract_id: str
    description: str
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConditionNode:
    """Condition node structure"""
    id: str
    description: str
    condition_type: str
    criteria: Dict[str, Any]
    tenant_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AmendmentRelationship:
    """Amendment relationship structure"""
    amendment_id: str
    contract_id: str
    effective_date: datetime
    amendment_type: str
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConflictRelationship:
    """Conflict relationship structure"""
    clause1_id: str
    clause2_id: str
    conflict_type: str
    severity: str
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TriggerRelationship:
    """Trigger relationship structure"""
    condition_id: str
    obligation_id: str
    trigger_type: str
    delay_days: int
    properties: Dict[str, Any] = field(default_factory=dict)


class MissingRelationshipsService:
    """Service for managing missing Neo4j graph relationship types"""

    def __init__(self):
        self.driver: Optional[AsyncDriver] = None
        self.uri = settings.NEO4J_URI
        self.auth = (settings.NEO4J_USER, settings.NEO4J_PASSWORD)

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

    # AMENDS Relationship Implementation
    async def create_amends_relationship(
        self,
        amendment_id: str,
        contract_id: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create AMENDS relationship between amendment and contract"""
        props = properties or {}
        async with self.driver.session() as session:
            query = """
                MATCH (a:Amendment {id: $amendment_id})
                MATCH (c:Contract {id: $contract_id})
                CREATE (a)-[r:AMENDS $props]->(c)
                RETURN r, a, c
            """
            result = await session.run(
                query,
                amendment_id=amendment_id,
                contract_id=contract_id,
                props=props
            )
            record = await result.single()
            return {
                "type": "AMENDS",
                "properties": props,
                "from": amendment_id,
                "to": contract_id
            }

    async def find_amendments_for_contract(self, contract_id: str) -> List[Dict[str, Any]]:
        """Find all amendments for a specific contract"""
        async with self.driver.session() as session:
            query = """
                MATCH (a:Amendment)-[:AMENDS]->(c:Contract {id: $contract_id})
                RETURN a.id as id, a.title as title, a.amendment_type as type,
                       a.effective_date as effective_date, a.description as description
                ORDER BY a.effective_date DESC
            """
            result = await session.run(query, contract_id=contract_id)
            amendments = []
            async for record in result:
                amendments.append({
                    "id": record["id"],
                    "title": record["title"],
                    "type": record["type"],
                    "effective_date": record["effective_date"],
                    "description": record["description"]
                })
            return amendments

    async def get_amendment_chain(self, contract_id: str) -> List[Dict[str, Any]]:
        """Get chronological chain of amendments for a contract"""
        async with self.driver.session() as session:
            query = """
                MATCH (a:Amendment)-[:AMENDS]->(c:Contract {id: $contract_id})
                RETURN a.id as id, a.effective_date as effective_date,
                       a.amendment_type as type, a.title as title
                ORDER BY a.effective_date ASC
            """
            result = await session.run(query, contract_id=contract_id)
            chain = []
            async for record in result:
                chain.append({
                    "id": record["id"],
                    "effective_date": record["effective_date"],
                    "type": record["type"],
                    "title": record["title"]
                })
            return chain

    async def validate_amendment_relationship(
        self,
        amendment_id: str,
        contract_id: str
    ) -> Dict[str, Any]:
        """Validate amendment relationship rules"""
        async with self.driver.session() as session:
            # Check if amendment already linked to contract
            check_query = """
                MATCH (a:Amendment {id: $amendment_id})-[:AMENDS]->(c:Contract {id: $contract_id})
                RETURN count(*) as exists
            """
            result = await session.run(
                check_query,
                amendment_id=amendment_id,
                contract_id=contract_id
            )
            record = await result.single()
            
            if record["exists"] > 0:
                return {"valid": False, "error": "Amendment already linked to contract"}
            
            return {"valid": True}

    # CONFLICTS_WITH Relationship Implementation
    async def create_conflicts_with_relationship(
        self,
        clause1_id: str,
        clause2_id: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create CONFLICTS_WITH relationship between clauses"""
        props = properties or {}
        async with self.driver.session() as session:
            query = """
                MATCH (c1:Clause {id: $clause1_id})
                MATCH (c2:Clause {id: $clause2_id})
                CREATE (c1)-[r:CONFLICTS_WITH $props]->(c2)
                RETURN r
            """
            result = await session.run(
                query,
                clause1_id=clause1_id,
                clause2_id=clause2_id,
                props=props
            )
            return {
                "type": "CONFLICTS_WITH",
                "properties": props,
                "from": clause1_id,
                "to": clause2_id
            }

    async def detect_clause_conflicts(self, contract_id: str) -> List[Dict[str, Any]]:
        """Detect conflicts between clauses in a contract"""
        async with self.driver.session() as session:
            query = """
                MATCH (c:Contract {id: $contract_id})-[:CONTAINS]->(cl1:Clause)
                MATCH (c)-[:CONTAINS]->(cl2:Clause)
                MATCH (cl1)-[r:CONFLICTS_WITH]->(cl2)
                RETURN cl1.id as clause1_id, cl2.id as clause2_id,
                       r.conflict_type as conflict_type, r.severity as severity
            """
            result = await session.run(query, contract_id=contract_id)
            conflicts = []
            async for record in result:
                conflicts.append({
                    "clause1_id": record["clause1_id"],
                    "clause2_id": record["clause2_id"],
                    "conflict_type": record["conflict_type"],
                    "severity": record["severity"]
                })
            return conflicts

    async def resolve_conflict(
        self,
        conflict_id: str,
        resolution: str,
        resolved_by: str
    ) -> Dict[str, Any]:
        """Resolve a conflict between clauses"""
        async with self.driver.session() as session:
            # Update conflict relationship with resolution
            query = """
                MATCH ()-[r:CONFLICTS_WITH {id: $conflict_id}]->()
                SET r.resolved = true, r.resolution = $resolution,
                    r.resolved_by = $resolved_by, r.resolved_at = datetime()
                RETURN r
            """
            result = await session.run(
                query,
                conflict_id=conflict_id,
                resolution=resolution,
                resolved_by=resolved_by
            )
            return {
                "conflict_id": conflict_id,
                "resolution": resolution,
                "resolved_by": resolved_by,
                "resolved_at": datetime.utcnow().isoformat()
            }

    async def get_conflict_severity(self, clause1_id: str, clause2_id: str) -> str:
        """Calculate conflict severity between two clauses"""
        async with self.driver.session() as session:
            query = """
                MATCH (c1:Clause {id: $clause1_id})-[r:CONFLICTS_WITH]->(c2:Clause {id: $clause2_id})
                RETURN r.severity as severity
            """
            result = await session.run(
                query,
                clause1_id=clause1_id,
                clause2_id=clause2_id
            )
            record = await result.single()
            return record["severity"] if record else "unknown"

    # TRIGGERS Relationship Implementation
    async def create_triggers_relationship(
        self,
        condition_id: str,
        obligation_id: str,
        properties: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create TRIGGERS relationship between condition and obligation"""
        props = properties or {}
        async with self.driver.session() as session:
            query = """
                MATCH (cond:Condition {id: $condition_id})
                MATCH (obl:Obligation {id: $obligation_id})
                CREATE (cond)-[r:TRIGGERS $props]->(obl)
                RETURN r
            """
            result = await session.run(
                query,
                condition_id=condition_id,
                obligation_id=obligation_id,
                props=props
            )
            return {
                "type": "TRIGGERS",
                "properties": props,
                "from": condition_id,
                "to": obligation_id
            }

    async def evaluate_condition(
        self,
        condition_id: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate if condition is met given context"""
        async with self.driver.session() as session:
            # Get condition criteria
            query = """
                MATCH (c:Condition {id: $condition_id})
                RETURN c.condition_type as type, c.criteria as criteria,
                       c.description as description
            """
            result = await session.run(query, condition_id=condition_id)
            record = await result.single()
            
            if not record:
                return {"met": False, "error": "Condition not found"}
            
            # Simple evaluation logic (can be extended)
            criteria = record["criteria"]
            condition_type = record["type"]
            
            if condition_type == "payment_default":
                days_overdue = context.get("days_overdue", 0)
                required_days = criteria.get("days_overdue", 30)
                return {"met": days_overdue >= required_days}
            
            return {"met": False, "message": "Unknown condition type"}

    async def find_triggered_obligations(self, condition_id: str) -> List[Dict[str, Any]]:
        """Find obligations triggered by a condition"""
        async with self.driver.session() as session:
            query = """
                MATCH (c:Condition {id: $condition_id})-[r:TRIGGERS]->(o:Obligation)
                RETURN o.id as id, o.description as description,
                       o.deadline as deadline, r.delay_days as delay_days
            """
            result = await session.run(query, condition_id=condition_id)
            obligations = []
            async for record in result:
                obligations.append({
                    "id": record["id"],
                    "description": record["description"],
                    "deadline": record["deadline"],
                    "delay_days": record["delay_days"]
                })
            return obligations

    async def create_conditional_obligation(
        self,
        condition_description: str,
        obligation_description: str,
        trigger_delay: int = 0
    ) -> Dict[str, Any]:
        """Create condition and obligation with trigger relationship"""
        async with self.driver.session() as session:
            # Create condition and obligation in single transaction
            query = """
                CREATE (c:Condition {
                    id: randomUUID(),
                    description: $cond_desc,
                    condition_type: 'custom',
                    criteria: {},
                    created_at: datetime()
                })
                CREATE (o:Obligation {
                    id: randomUUID(),
                    description: $obl_desc,
                    status: 'pending',
                    created_at: datetime()
                })
                CREATE (c)-[:TRIGGERS {delay_days: $delay}]->(o)
                RETURN c.id as condition_id, o.id as obligation_id
            """
            result = await session.run(
                query,
                cond_desc=condition_description,
                obl_desc=obligation_description,
                delay=trigger_delay
            )
            record = await result.single()
            return {
                "condition_id": record["condition_id"],
                "obligation_id": record["obligation_id"],
                "trigger_delay": trigger_delay
            }

    # Integration Methods
    async def find_conflicting_amendments(self, contract_id: str) -> List[Dict[str, Any]]:
        """Find amendments that have conflicting clauses"""
        async with self.driver.session() as session:
            query = """
                MATCH (c:Contract {id: $contract_id})
                MATCH (a1:Amendment)-[:AMENDS]->(c)
                MATCH (a2:Amendment)-[:AMENDS]->(c)
                MATCH (a1)-[:CONTAINS]->(cl1:Clause)
                MATCH (a2)-[:CONTAINS]->(cl2:Clause)
                MATCH (cl1)-[:CONFLICTS_WITH]->(cl2)
                WHERE a1.id <> a2.id
                RETURN a1.id as amendment1_id, a2.id as amendment2_id,
                       cl1.id as clause1_id, cl2.id as clause2_id
            """
            result = await session.run(query, contract_id=contract_id)
            conflicts = []
            async for record in result:
                conflicts.append({
                    "amendment1_id": record["amendment1_id"],
                    "amendment2_id": record["amendment2_id"],
                    "clause1_id": record["clause1_id"],
                    "clause2_id": record["clause2_id"]
                })
            return conflicts

    async def find_triggered_amendments(self, condition_id: str) -> List[Dict[str, Any]]:
        """Find amendments triggered by conditions"""
        async with self.driver.session() as session:
            query = """
                MATCH (cond:Condition {id: $condition_id})-[:TRIGGERS]->(o:Obligation)
                MATCH (a:Amendment)-[:CONTAINS]->(o)
                RETURN a.id as amendment_id, a.title as title, o.id as obligation_id
            """
            result = await session.run(query, condition_id=condition_id)
            amendments = []
            async for record in result:
                amendments.append({
                    "amendment_id": record["amendment_id"],
                    "title": record["title"],
                    "obligation_id": record["obligation_id"]
                })
            return amendments

    async def analyze_relationship_chain(
        self,
        start_node_id: str,
        target_node_type: str,
        max_depth: int = 5
    ) -> List[Dict[str, Any]]:
        """Analyze complex relationship chains"""
        async with self.driver.session() as session:
            query = f"""
                MATCH path = (start {{id: $start_id}})-[*1..{max_depth}]->(target:{target_node_type})
                RETURN [node in nodes(path) | {{id: node.id, labels: labels(node)}}] as nodes,
                       [rel in relationships(path) | type(rel)] as relationships,
                       length(path) as depth
                ORDER BY length(path)
                LIMIT 10
            """
            result = await session.run(
                query,
                start_id=start_node_id
            )
            chains = []
            async for record in result:
                chains.append({
                    "nodes": record["nodes"],
                    "relationships": record["relationships"],
                    "depth": record["depth"]
                })
            return chains

    # Validation Methods
    async def detect_amendment_cycles(self, contract_id: str) -> List[Dict[str, Any]]:
        """Detect circular amendment relationships"""
        async with self.driver.session() as session:
            query = """
                MATCH (c:Contract {id: $contract_id})
                MATCH path = (c)<-[:AMENDS*2..]-(a:Amendment)-[:AMENDS]->(c)
                RETURN [node in nodes(path) | node.id] as cycle_nodes
            """
            result = await session.run(query, contract_id=contract_id)
            cycles = []
            async for record in result:
                cycles.append({
                    "cycle_nodes": record["cycle_nodes"]
                })
            return cycles

    async def check_conflict_consistency(self, contract_id: str) -> Dict[str, Any]:
        """Check consistency of conflict relationships in contract"""
        async with self.driver.session() as session:
            # Check for bidirectional conflicts
            query = """
                MATCH (c:Contract {id: $contract_id})-[:CONTAINS]->(cl1:Clause)
                MATCH (c)-[:CONTAINS]->(cl2:Clause)
                MATCH (cl1)-[:CONFLICTS_WITH]->(cl2)
                MATCH (cl2)-[:CONFLICTS_WITH]->(cl1)
                RETURN count(*) as bidirectional_conflicts
            """
            result = await session.run(query, contract_id=contract_id)
            record = await result.single()
            
            return {
                "consistent": record["bidirectional_conflicts"] == 0,
                "bidirectional_conflicts": record["bidirectional_conflicts"]
            }

    async def detect_trigger_loops(self, condition_id: str) -> List[Dict[str, Any]]:
        """Detect infinite trigger loops"""
        async with self.driver.session() as session:
            query = """
                MATCH path = (c:Condition {id: $condition_id})-[:TRIGGERS*2..]->(c)
                RETURN [node in nodes(path) | node.id] as loop_nodes
            """
            result = await session.run(query, condition_id=condition_id)
            loops = []
            async for record in result:
                loops.append({
                    "loop_nodes": record["loop_nodes"]
                })
            return loops