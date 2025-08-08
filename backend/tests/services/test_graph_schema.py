"""
Test suite for Neo4j Graph Schema Service
Tests graph database schema design, node/relationship types, and operations
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict, List, Any
from unittest.mock import Mock, patch, AsyncMock

from app.services.graph_schema import (
    GraphSchemaService,
    NodeType,
    RelationshipType,
    ContractNode,
    ClauseNode,
    PartyNode,
    TermNode,
    ObligationNode,
    DocumentNode,
    UserNode,
    PrecedentNode,
    RegulationNode,
    RiskNode,
    GraphConstraint,
    GraphIndex,
    SchemaVersion,
    GraphMigration
)


@pytest.fixture
def graph_service():
    """Create graph schema service instance"""
    return GraphSchemaService()


@pytest.fixture
def mock_neo4j_driver():
    """Mock Neo4j driver"""
    driver = Mock()
    session = Mock()
    driver.session.return_value.__enter__ = Mock(return_value=session)
    driver.session.return_value.__exit__ = Mock(return_value=None)
    return driver, session


class TestNodeTypes:
    """Test node type definitions and operations"""

    def test_contract_node_creation(self, graph_service):
        """Test creating contract node"""
        contract = ContractNode(
            id="contract-123",
            title="Service Agreement",
            type="service",
            status="active",
            effective_date=datetime.now(),
            expiry_date=datetime.now() + timedelta(days=365),
            value=100000.0,
            currency="USD",
            tenant_id="tenant-1"
        )
        
        assert contract.id == "contract-123"
        assert contract.title == "Service Agreement"
        assert contract.type == "service"
        assert contract.status == "active"
        assert contract.value == 100000.0

    def test_clause_node_creation(self, graph_service):
        """Test creating clause node"""
        clause = ClauseNode(
            id="clause-456",
            text="Payment shall be made within 30 days",
            type="payment",
            risk_level="medium",
            category="financial",
            version="1.0",
            tenant_id="tenant-1"
        )
        
        assert clause.id == "clause-456"
        assert clause.type == "payment"
        assert clause.risk_level == "medium"

    def test_party_node_creation(self, graph_service):
        """Test creating party node"""
        party = PartyNode(
            id="party-789",
            name="Acme Corporation",
            type="vendor",
            jurisdiction="US-CA",
            role="supplier",
            tax_id="12-3456789",
            tenant_id="tenant-1"
        )
        
        assert party.name == "Acme Corporation"
        assert party.type == "vendor"
        assert party.jurisdiction == "US-CA"

    def test_term_node_creation(self, graph_service):
        """Test creating term node"""
        term = TermNode(
            id="term-111",
            name="Payment Term",
            value="Net 30",
            unit="days",
            conditions=["invoice_received", "goods_delivered"],
            tenant_id="tenant-1"
        )
        
        assert term.name == "Payment Term"
        assert term.value == "Net 30"
        assert len(term.conditions) == 2

    def test_obligation_node_creation(self, graph_service):
        """Test creating obligation node"""
        obligation = ObligationNode(
            id="obligation-222",
            description="Deliver quarterly reports",
            deadline=datetime.now() + timedelta(days=90),
            responsible_party="party-789",
            status="pending",
            recurring=True,
            frequency="quarterly",
            tenant_id="tenant-1"
        )
        
        assert obligation.description == "Deliver quarterly reports"
        assert obligation.recurring is True
        assert obligation.frequency == "quarterly"

    def test_document_node_creation(self, graph_service):
        """Test creating document node"""
        document = DocumentNode(
            id="doc-333",
            type="pdf",
            version="2.0",
            parent_id="doc-111",
            file_path="/documents/contract.pdf",
            checksum="abc123def456",
            tenant_id="tenant-1"
        )
        
        assert document.type == "pdf"
        assert document.version == "2.0"
        assert document.parent_id == "doc-111"

    def test_user_node_creation(self, graph_service):
        """Test creating user node"""
        user = UserNode(
            id="user-444",
            email="john@example.com",
            role="legal_counsel",
            department="legal",
            permissions=["view", "edit", "approve"],
            tenant_id="tenant-1"
        )
        
        assert user.email == "john@example.com"
        assert user.role == "legal_counsel"
        assert "approve" in user.permissions

    def test_precedent_node_creation(self, graph_service):
        """Test creating precedent node"""
        precedent = PrecedentNode(
            id="precedent-555",
            case_name="Smith v. Jones",
            citation="123 F.3d 456",
            relevance=0.85,
            jurisdiction="US-NY",
            year=2023,
            tenant_id="tenant-1"
        )
        
        assert precedent.case_name == "Smith v. Jones"
        assert precedent.relevance == 0.85

    def test_regulation_node_creation(self, graph_service):
        """Test creating regulation node"""
        regulation = RegulationNode(
            id="reg-666",
            name="GDPR",
            jurisdiction="EU",
            requirements=["data_protection", "consent", "right_to_delete"],
            effective_date=datetime(2018, 5, 25),
            tenant_id="tenant-1"
        )
        
        assert regulation.name == "GDPR"
        assert len(regulation.requirements) == 3

    def test_risk_node_creation(self, graph_service):
        """Test creating risk node"""
        risk = RiskNode(
            id="risk-777",
            type="compliance",
            severity="high",
            likelihood=0.7,
            impact="financial",
            mitigation="Regular audits",
            tenant_id="tenant-1"
        )
        
        assert risk.type == "compliance"
        assert risk.severity == "high"
        assert risk.likelihood == 0.7


class TestRelationshipTypes:
    """Test relationship type definitions"""

    @pytest.mark.asyncio
    async def test_contains_relationship(self, graph_service):
        """Test CONTAINS relationship (contracts → clauses)"""
        result = await graph_service.create_relationship(
            from_node_id="contract-123",
            to_node_id="clause-456",
            relationship_type=RelationshipType.CONTAINS,
            properties={"order": 1, "mandatory": True}
        )
        
        assert result["type"] == "CONTAINS"
        assert result["properties"]["mandatory"] is True

    @pytest.mark.asyncio
    async def test_references_relationship(self, graph_service):
        """Test REFERENCES relationship (clauses → precedents)"""
        result = await graph_service.create_relationship(
            from_node_id="clause-456",
            to_node_id="precedent-555",
            relationship_type=RelationshipType.REFERENCES,
            properties={"relevance": 0.9}
        )
        
        assert result["type"] == "REFERENCES"

    @pytest.mark.asyncio
    async def test_party_to_relationship(self, graph_service):
        """Test PARTY_TO relationship (parties → contracts)"""
        result = await graph_service.create_relationship(
            from_node_id="party-789",
            to_node_id="contract-123",
            relationship_type=RelationshipType.PARTY_TO,
            properties={"role": "vendor", "signing_date": datetime.now()}
        )
        
        assert result["type"] == "PARTY_TO"

    @pytest.mark.asyncio
    async def test_supersedes_relationship(self, graph_service):
        """Test SUPERSEDES relationship (contracts → contracts)"""
        result = await graph_service.create_relationship(
            from_node_id="contract-999",
            to_node_id="contract-123",
            relationship_type=RelationshipType.SUPERSEDES,
            properties={"effective_date": datetime.now()}
        )
        
        assert result["type"] == "SUPERSEDES"

    @pytest.mark.asyncio
    async def test_depends_on_relationship(self, graph_service):
        """Test DEPENDS_ON relationship (clauses → clauses)"""
        result = await graph_service.create_relationship(
            from_node_id="clause-789",
            to_node_id="clause-456",
            relationship_type=RelationshipType.DEPENDS_ON,
            properties={"strength": "strong"}
        )
        
        assert result["type"] == "DEPENDS_ON"


class TestSchemaConstraints:
    """Test schema constraints and validation"""

    @pytest.mark.asyncio
    async def test_unique_constraint_creation(self, graph_service):
        """Test creating unique constraint"""
        constraint = await graph_service.create_constraint(
            node_type=NodeType.CONTRACT,
            property_name="id",
            constraint_type=GraphConstraint.UNIQUE
        )
        
        assert constraint["property"] == "id"
        assert constraint["type"] == "UNIQUE"

    @pytest.mark.asyncio
    async def test_exists_constraint_creation(self, graph_service):
        """Test creating exists constraint"""
        constraint = await graph_service.create_constraint(
            node_type=NodeType.PARTY,
            property_name="name",
            constraint_type=GraphConstraint.EXISTS
        )
        
        assert constraint["property"] == "name"
        assert constraint["type"] == "EXISTS"

    @pytest.mark.asyncio
    async def test_property_validation(self, graph_service):
        """Test property validation"""
        is_valid = await graph_service.validate_property(
            node_type=NodeType.CONTRACT,
            property_name="status",
            value="active"
        )
        
        assert is_valid is True
        
        is_valid = await graph_service.validate_property(
            node_type=NodeType.CONTRACT,
            property_name="status",
            value="invalid_status"
        )
        
        assert is_valid is False


class TestIndexOptimization:
    """Test index creation and optimization"""

    @pytest.mark.asyncio
    async def test_create_index(self, graph_service):
        """Test creating index"""
        index = await graph_service.create_index(
            node_type=NodeType.CONTRACT,
            properties=["title", "status"],
            index_type=GraphIndex.COMPOSITE
        )
        
        assert index["type"] == "COMPOSITE"
        assert "title" in index["properties"]

    @pytest.mark.asyncio
    async def test_fulltext_index_creation(self, graph_service):
        """Test creating fulltext index"""
        index = await graph_service.create_fulltext_index(
            node_types=[NodeType.CONTRACT, NodeType.CLAUSE],
            properties=["title", "text"],
            name="contract_search"
        )
        
        assert index["name"] == "contract_search"
        assert index["type"] == "FULLTEXT"

    @pytest.mark.asyncio
    async def test_index_optimization(self, graph_service):
        """Test index optimization recommendations"""
        recommendations = await graph_service.get_index_recommendations(
            query_patterns=["MATCH (c:Contract) WHERE c.status = 'active'"]
        )
        
        assert len(recommendations) > 0
        assert "status" in recommendations[0]["properties"]


class TestSchemaVersioning:
    """Test schema versioning and migrations"""

    @pytest.mark.asyncio
    async def test_get_current_version(self, graph_service):
        """Test getting current schema version"""
        version = await graph_service.get_schema_version()
        
        assert version.version >= "1.0.0"
        assert version.applied_at is not None

    @pytest.mark.asyncio
    async def test_apply_migration(self, graph_service):
        """Test applying schema migration"""
        migration = GraphMigration(
            version="2.0.0",
            description="Add risk assessment nodes",
            up_script="CREATE (r:RiskAssessment)",
            down_script="MATCH (r:RiskAssessment) DELETE r"
        )
        
        result = await graph_service.apply_migration(migration)
        
        assert result["version"] == "2.0.0"
        assert result["status"] == "applied"

    @pytest.mark.asyncio
    async def test_rollback_migration(self, graph_service):
        """Test rolling back migration"""
        result = await graph_service.rollback_migration("2.0.0")
        
        assert result["version"] == "2.0.0"
        assert result["status"] == "rolled_back"

    @pytest.mark.asyncio
    async def test_migration_history(self, graph_service):
        """Test getting migration history"""
        history = await graph_service.get_migration_history()
        
        assert len(history) > 0
        assert history[0]["version"] is not None


class TestPerformanceTuning:
    """Test performance tuning operations"""

    @pytest.mark.asyncio
    async def test_query_optimization(self, graph_service):
        """Test query optimization suggestions"""
        query = "MATCH (c:Contract)-[:CONTAINS]->(cl:Clause) WHERE c.status = 'active'"
        suggestions = await graph_service.optimize_query(query)
        
        assert len(suggestions) > 0
        assert "index" in suggestions[0]["type"]

    @pytest.mark.asyncio
    async def test_cache_warming(self, graph_service):
        """Test cache warming for frequently accessed nodes"""
        result = await graph_service.warm_cache(
            node_types=[NodeType.CONTRACT],
            limit=1000
        )
        
        assert result["nodes_cached"] > 0

    @pytest.mark.asyncio
    async def test_statistics_update(self, graph_service):
        """Test updating database statistics"""
        result = await graph_service.update_statistics()
        
        assert result["status"] == "updated"
        assert result["duration_ms"] > 0


class TestBackupAndRecovery:
    """Test backup and recovery procedures"""

    @pytest.mark.asyncio
    async def test_create_backup(self, graph_service):
        """Test creating database backup"""
        backup = await graph_service.create_backup(
            backup_name="daily_backup",
            include_data=True,
            include_schema=True
        )
        
        assert backup["name"] == "daily_backup"
        assert backup["status"] == "completed"

    @pytest.mark.asyncio
    async def test_restore_backup(self, graph_service):
        """Test restoring from backup"""
        result = await graph_service.restore_backup(
            backup_name="daily_backup",
            target_database="test_restore"
        )
        
        assert result["status"] == "restored"

    @pytest.mark.asyncio
    async def test_incremental_backup(self, graph_service):
        """Test incremental backup"""
        backup = await graph_service.create_incremental_backup(
            base_backup="daily_backup",
            backup_name="incremental_1"
        )
        
        assert backup["type"] == "incremental"
        assert backup["base"] == "daily_backup"


class TestShardingStrategy:
    """Test sharding and partitioning strategies"""

    @pytest.mark.asyncio
    async def test_shard_by_tenant(self, graph_service):
        """Test sharding by tenant ID"""
        result = await graph_service.create_shard(
            shard_key="tenant_id",
            shard_value="tenant-1",
            target_server="neo4j-shard-1"
        )
        
        assert result["shard_key"] == "tenant_id"
        assert result["status"] == "created"

    @pytest.mark.asyncio
    async def test_shard_rebalancing(self, graph_service):
        """Test shard rebalancing"""
        result = await graph_service.rebalance_shards(
            strategy="even_distribution"
        )
        
        assert result["shards_moved"] >= 0
        assert result["status"] == "balanced"

    @pytest.mark.asyncio
    async def test_cross_shard_query(self, graph_service):
        """Test querying across shards"""
        result = await graph_service.cross_shard_query(
            query="MATCH (c:Contract) RETURN count(c)",
            shards=["shard-1", "shard-2"]
        )
        
        assert result["total_count"] >= 0


class TestGraphAnalytics:
    """Test graph analytics operations"""

    @pytest.mark.asyncio
    async def test_degree_centrality(self, graph_service):
        """Test calculating degree centrality"""
        centrality = await graph_service.calculate_centrality(
            node_type=NodeType.PARTY,
            centrality_type="degree"
        )
        
        assert len(centrality) > 0
        assert centrality[0]["score"] >= 0

    @pytest.mark.asyncio
    async def test_community_detection(self, graph_service):
        """Test community detection algorithm"""
        communities = await graph_service.detect_communities(
            algorithm="louvain",
            min_community_size=3
        )
        
        assert len(communities) > 0
        assert communities[0]["size"] >= 3

    @pytest.mark.asyncio
    async def test_path_finding(self, graph_service):
        """Test finding paths between nodes"""
        paths = await graph_service.find_paths(
            from_node_id="party-789",
            to_node_id="regulation-666",
            max_depth=5
        )
        
        assert len(paths) >= 0
        if paths:
            assert len(paths[0]["nodes"]) <= 6  # max_depth + 1

    @pytest.mark.asyncio
    async def test_pattern_matching(self, graph_service):
        """Test complex pattern matching"""
        patterns = await graph_service.find_patterns(
            pattern="(p:Party)-[:PARTY_TO]->(c:Contract)-[:CONTAINS]->(cl:Clause)-[:REFERENCES]->(pr:Precedent)",
            limit=10
        )
        
        assert len(patterns) <= 10


class TestDataIntegrity:
    """Test data integrity and validation"""

    @pytest.mark.asyncio
    async def test_orphaned_nodes_detection(self, graph_service):
        """Test detecting orphaned nodes"""
        orphans = await graph_service.find_orphaned_nodes()
        
        assert isinstance(orphans, list)
        if orphans:
            assert "id" in orphans[0]

    @pytest.mark.asyncio
    async def test_circular_dependencies(self, graph_service):
        """Test detecting circular dependencies"""
        circles = await graph_service.detect_circular_dependencies(
            relationship_type=RelationshipType.DEPENDS_ON
        )
        
        assert isinstance(circles, list)

    @pytest.mark.asyncio
    async def test_data_consistency_check(self, graph_service):
        """Test data consistency validation"""
        report = await graph_service.check_consistency()
        
        assert "total_nodes" in report
        assert "total_relationships" in report
        assert "issues" in report

    @pytest.mark.asyncio
    async def test_duplicate_detection(self, graph_service):
        """Test detecting duplicate nodes"""
        duplicates = await graph_service.find_duplicates(
            node_type=NodeType.CONTRACT,
            property_name="title"
        )
        
        assert isinstance(duplicates, list)