"""
Test suite for Cypher Query Generator Service.
Tests dynamic query construction, optimization, caching, and security.
Following TDD - RED phase: Writing comprehensive failing tests first.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
import json
import asyncio
from typing import Dict, Any, List

from app.services.graph.cypher_query_generator import (
    CypherQueryGenerator,
    QueryType,
    QueryBuilder,
    QueryOptimizer,
    QueryCache,
    QueryTemplate,
    QueryComplexityAnalyzer,
    QueryValidator,
    QueryExplainer,
    ParameterBinder,
    IndexHintGenerator
)
from app.services.graph.cypher_query_generator import (
    InvalidQueryError,
    QueryComplexityError,
    QueryTimeoutError,
    QueryValidationError
)


class TestCypherQueryGenerator:
    """Test suite for the Cypher Query Generator."""
    
    @pytest.fixture
    def generator(self):
        """Create a CypherQueryGenerator instance for testing."""
        return CypherQueryGenerator()
    
    @pytest.fixture
    def mock_neo4j_driver(self):
        """Mock Neo4j driver for testing."""
        driver = Mock()
        driver.session = AsyncMock()
        return driver
    
    # Dynamic Query Construction Tests
    
    @pytest.mark.asyncio
    async def test_simple_node_query_construction(self, generator):
        """Test construction of simple node queries."""
        params = {
            "node_type": "Contract",
            "properties": {"status": "active", "tenant_id": "tenant-123"}
        }
        
        query = await generator.build_node_query(params)
        
        assert "MATCH (n:Contract)" in query
        assert "WHERE n.status = $status" in query
        assert "AND n.tenant_id = $tenant_id" in query
        assert "RETURN n" in query
    
    @pytest.mark.asyncio
    async def test_relationship_query_construction(self, generator):
        """Test construction of relationship queries."""
        params = {
            "start_node": "Contract",
            "relationship": "PARTY_TO",
            "end_node": "Party",
            "conditions": {"party_type": "vendor"}
        }
        
        query = await generator.build_relationship_query(params)
        
        assert "MATCH (c:Contract)-[r:PARTY_TO]->(p:Party)" in query
        assert "WHERE p.party_type = $party_type" in query
        assert "RETURN c, r, p" in query
    
    @pytest.mark.asyncio
    async def test_path_query_construction(self, generator):
        """Test construction of path queries."""
        params = {
            "start_id": "contract-123",
            "end_id": "contract-456",
            "max_hops": 3,
            "relationship_types": ["REFERENCES", "AMENDS", "SUPERSEDES"]
        }
        
        query = await generator.build_path_query(params)
        
        assert "MATCH path = (start:Contract {id: $start_id})" in query
        assert "-[:REFERENCES|AMENDS|SUPERSEDES*1..3]-" in query
        assert "(end:Contract {id: $end_id})" in query
        assert "RETURN path" in query
    
    @pytest.mark.asyncio
    async def test_aggregation_query_construction(self, generator):
        """Test construction of aggregation queries."""
        params = {
            "node_type": "Contract",
            "group_by": "status",
            "aggregations": ["COUNT", "AVG(value)", "MAX(end_date)"]
        }
        
        query = await generator.build_aggregation_query(params)
        
        assert "MATCH (n:Contract)" in query
        assert "WITH n.status as status" in query
        assert "COUNT(n) as count" in query
        assert "AVG(n.value) as avg_value" in query
        assert "MAX(n.end_date) as max_end_date" in query
        assert "RETURN status" in query
    
    # Query Optimization Tests
    
    @pytest.mark.asyncio
    async def test_query_optimization_with_indexes(self, generator):
        """Test query optimization using indexes."""
        unoptimized = """
        MATCH (c:Contract)
        WHERE c.created_at > $date AND c.status = 'active'
        RETURN c
        """
        
        optimized = await generator.optimize_query(unoptimized)
        
        # Should add index hints
        assert "USING INDEX c:Contract(status)" in optimized
        assert "USING INDEX c:Contract(created_at)" in optimized
    
    @pytest.mark.asyncio
    async def test_query_optimization_removes_cartesian_products(self, generator):
        """Test that optimization removes cartesian products."""
        unoptimized = """
        MATCH (c:Contract), (p:Party)
        WHERE c.party_id = p.id
        RETURN c, p
        """
        
        optimized = await generator.optimize_query(unoptimized)
        
        # Should rewrite to avoid cartesian product
        assert "MATCH (c:Contract)" in optimized
        assert "MATCH (p:Party)" in optimized
        assert "WHERE c.party_id = p.id" in optimized
    
    @pytest.mark.asyncio
    async def test_query_optimization_with_limit_pushdown(self, generator):
        """Test optimization pushes LIMIT down when possible."""
        unoptimized = """
        MATCH (c:Contract)-[:PARTY_TO]->(p:Party)
        WITH c, collect(p) as parties
        RETURN c, parties
        LIMIT 10
        """
        
        optimized = await generator.optimize_query(unoptimized)
        
        # Should push limit earlier in query
        assert optimized.index("LIMIT") < optimized.index("collect")
    
    # Parameter Binding Tests
    
    @pytest.mark.asyncio
    async def test_parameter_binding_prevents_injection(self, generator):
        """Test parameter binding prevents SQL injection."""
        malicious_input = "'; DROP DATABASE neo4j; --"
        params = {"status": malicious_input}
        
        query, bound_params = await generator.bind_parameters(
            "MATCH (c:Contract) WHERE c.status = $status RETURN c",
            params
        )
        
        assert "$status" in query  # Parameter placeholder remains
        assert bound_params["status"] == malicious_input  # Value is bound, not concatenated
    
    @pytest.mark.asyncio
    async def test_parameter_type_validation(self, generator):
        """Test parameter type validation."""
        params = {
            "date": "not-a-date",
            "value": "not-a-number",
            "status": "active"
        }
        
        with pytest.raises(QueryValidationError) as exc_info:
            await generator.validate_parameters(params, {
                "date": "datetime",
                "value": "number",
                "status": "string"
            })
        
        assert "Invalid parameter type" in str(exc_info.value)
    
    # Query Caching Tests
    
    @pytest.mark.asyncio
    async def test_query_caching_hit(self, generator):
        """Test query cache hit for identical queries."""
        query = "MATCH (c:Contract) WHERE c.status = 'active' RETURN c"
        params = {"status": "active"}
        
        # First execution
        result1 = await generator.execute_with_cache(query, params)
        
        # Second execution should hit cache
        with patch.object(generator, '_execute_query') as mock_execute:
            result2 = await generator.execute_with_cache(query, params)
            mock_execute.assert_not_called()
        
        assert result1 == result2
    
    @pytest.mark.asyncio
    async def test_query_cache_invalidation(self, generator):
        """Test query cache invalidation on data changes."""
        query = "MATCH (c:Contract) RETURN count(c)"
        
        # Cache result
        await generator.execute_with_cache(query, {})
        
        # Trigger invalidation
        await generator.invalidate_cache(node_types=["Contract"])
        
        # Next execution should not hit cache
        with patch.object(generator, '_execute_query') as mock_execute:
            mock_execute.return_value = {"count": 100}
            await generator.execute_with_cache(query, {})
            mock_execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cache_ttl_expiration(self, generator):
        """Test cache TTL expiration."""
        query = "MATCH (c:Contract) RETURN c LIMIT 10"
        
        # Set short TTL
        generator.cache.set_ttl(1)  # 1 second
        
        await generator.execute_with_cache(query, {})
        
        # Wait for expiration
        await asyncio.sleep(1.1)
        
        with patch.object(generator, '_execute_query') as mock_execute:
            mock_execute.return_value = []
            await generator.execute_with_cache(query, {})
            mock_execute.assert_called_once()
    
    # Query Complexity Analysis Tests
    
    @pytest.mark.asyncio
    async def test_query_complexity_calculation(self, generator):
        """Test query complexity calculation."""
        simple_query = "MATCH (c:Contract) RETURN c LIMIT 10"
        complex_query = """
        MATCH (c:Contract)-[:PARTY_TO]->(p:Party)
        WITH c, collect(p) as parties
        MATCH (c)-[:CONTAINS]->(cl:Clause)
        WHERE cl.risk_level = 'high'
        WITH c, parties, collect(cl) as clauses
        UNWIND clauses as clause
        MATCH (clause)-[:REFERENCES]->(prec:Precedent)
        RETURN c, parties, clauses, collect(prec) as precedents
        """
        
        simple_complexity = await generator.calculate_complexity(simple_query)
        complex_complexity = await generator.calculate_complexity(complex_query)
        
        assert simple_complexity < 10
        assert complex_complexity > 50
        assert complex_complexity > simple_complexity
    
    @pytest.mark.asyncio
    async def test_query_complexity_limit_enforcement(self, generator):
        """Test enforcement of query complexity limits."""
        generator.set_max_complexity(100)
        
        expensive_query = """
        MATCH (c:Contract)
        MATCH (p:Party)
        MATCH (cl:Clause)
        WITH c, p, cl
        MATCH path = (c)-[*1..10]-(p)
        RETURN path
        """
        
        with pytest.raises(QueryComplexityError) as exc_info:
            await generator.validate_complexity(expensive_query)
        
        assert "exceeds maximum allowed complexity" in str(exc_info.value)
    
    # Performance Hints Tests
    
    @pytest.mark.asyncio
    async def test_index_hint_generation(self, generator):
        """Test generation of index hints."""
        query = """
        MATCH (c:Contract)
        WHERE c.status = 'active' AND c.created_at > $date
        RETURN c
        """
        
        hints = await generator.generate_index_hints(query)
        
        assert len(hints) == 2
        assert any("Contract(status)" in hint for hint in hints)
        assert any("Contract(created_at)" in hint for hint in hints)
    
    @pytest.mark.asyncio
    async def test_performance_hints_for_pattern_matching(self, generator):
        """Test performance hints for pattern matching."""
        query = """
        MATCH (c:Contract)-[:PARTY_TO*1..5]->(p:Party)
        RETURN c, p
        """
        
        hints = await generator.generate_performance_hints(query)
        
        assert any("Consider limiting path depth" in hint for hint in hints)
        assert any("Add relationship direction" in hint for hint in hints)
    
    # Query Explanation Tests
    
    @pytest.mark.asyncio
    async def test_query_explanation_generation(self, generator):
        """Test query explanation generation."""
        query = """
        MATCH (c:Contract {status: 'active'})
        WHERE c.value > 1000000
        RETURN c.title, c.value
        ORDER BY c.value DESC
        LIMIT 10
        """
        
        explanation = await generator.explain_query(query)
        
        assert "Find Contract nodes" in explanation
        assert "status equals 'active'" in explanation
        assert "value greater than 1000000" in explanation
        assert "Sort by value descending" in explanation
        assert "Limit to 10 results" in explanation
    
    @pytest.mark.asyncio
    async def test_query_plan_analysis(self, generator, mock_neo4j_driver):
        """Test query execution plan analysis."""
        generator.driver = mock_neo4j_driver
        
        query = "MATCH (c:Contract) RETURN c"
        
        # Mock execution plan
        mock_plan = {
            "operators": ["NodeByLabelScan", "Projection"],
            "estimated_rows": 1000,
            "db_hits": 2000
        }
        mock_neo4j_driver.session().run.return_value.single.return_value = mock_plan
        
        plan = await generator.analyze_query_plan(query)
        
        assert plan["estimated_rows"] == 1000
        assert plan["db_hits"] == 2000
        assert "NodeByLabelScan" in plan["operators"]
    
    # Fallback Strategy Tests
    
    @pytest.mark.asyncio
    async def test_fallback_to_simpler_query(self, generator):
        """Test fallback to simpler query on timeout."""
        complex_query = """
        MATCH path = (c:Contract)-[*1..10]-(related)
        RETURN path
        """
        
        # Simulate timeout
        with patch.object(generator, '_execute_query') as mock_execute:
            mock_execute.side_effect = QueryTimeoutError("Query timeout")
            
            result = await generator.execute_with_fallback(complex_query)
            
            # Should fall back to simpler query
            assert mock_execute.call_count == 2
            simpler_query = mock_execute.call_args_list[1][0][0]
            assert "*1..3" in simpler_query  # Reduced depth
    
    @pytest.mark.asyncio
    async def test_fallback_with_sampling(self, generator):
        """Test fallback strategy using sampling."""
        query = "MATCH (c:Contract) RETURN c"
        
        # Simulate large result set
        with patch.object(generator, '_execute_query') as mock_execute:
            mock_execute.side_effect = [
                QueryTimeoutError("Too many results"),
                [{"id": f"contract-{i}"} for i in range(100)]
            ]
            
            result = await generator.execute_with_fallback(query, use_sampling=True)
            
            # Should add sampling
            sampled_query = mock_execute.call_args_list[1][0][0]
            assert "LIMIT" in sampled_query or "rand()" in sampled_query
    
    # Query Template Tests
    
    @pytest.mark.asyncio
    async def test_query_template_registration(self, generator):
        """Test registration and use of query templates."""
        template = """
        MATCH (c:Contract {tenant_id: $tenant_id})
        WHERE c.status = $status
        RETURN c
        """
        
        generator.register_template("active_contracts", template)
        
        query = await generator.from_template("active_contracts", {
            "tenant_id": "tenant-123",
            "status": "active"
        })
        
        assert "tenant-123" in str(query)
        assert "active" in str(query)
    
    @pytest.mark.asyncio
    async def test_template_with_conditional_clauses(self, generator):
        """Test templates with conditional clauses."""
        template = """
        MATCH (c:Contract)
        WHERE c.tenant_id = $tenant_id
        {% if status %}
        AND c.status = $status
        {% endif %}
        {% if min_value %}
        AND c.value >= $min_value
        {% endif %}
        RETURN c
        """
        
        generator.register_template("filtered_contracts", template)
        
        # With all conditions
        query1 = await generator.from_template("filtered_contracts", {
            "tenant_id": "tenant-123",
            "status": "active",
            "min_value": 100000
        })
        
        assert "c.status = $status" in query1
        assert "c.value >= $min_value" in query1
        
        # With partial conditions
        query2 = await generator.from_template("filtered_contracts", {
            "tenant_id": "tenant-123"
        })
        
        assert "c.status" not in query2
        assert "c.value" not in query2
    
    # Multi-tenant Support Tests
    
    @pytest.mark.asyncio
    async def test_tenant_isolation_in_queries(self, generator):
        """Test automatic tenant isolation in queries."""
        generator.set_tenant_id("tenant-123")
        
        query = await generator.build_node_query({
            "node_type": "Contract",
            "properties": {"status": "active"}
        })
        
        assert "tenant_id = $tenant_id" in query
        assert generator.get_parameters()["tenant_id"] == "tenant-123"
    
    @pytest.mark.asyncio
    async def test_cross_tenant_query_prevention(self, generator):
        """Test prevention of cross-tenant queries."""
        generator.set_tenant_id("tenant-123")
        generator.enable_strict_tenant_isolation()
        
        # Try to query with different tenant_id
        with pytest.raises(QueryValidationError) as exc_info:
            await generator.build_node_query({
                "node_type": "Contract",
                "properties": {"tenant_id": "tenant-456"}
            })
        
        assert "Cross-tenant query not allowed" in str(exc_info.value)
    
    # Error Handling Tests
    
    @pytest.mark.asyncio
    async def test_invalid_cypher_syntax_detection(self, generator):
        """Test detection of invalid Cypher syntax."""
        invalid_query = "MATCH (c:Contract WHERE c.status = 'active' RETURN c"
        
        with pytest.raises(InvalidQueryError) as exc_info:
            await generator.validate_syntax(invalid_query)
        
        assert "Invalid Cypher syntax" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_query_timeout_handling(self, generator, mock_neo4j_driver):
        """Test handling of query timeouts."""
        generator.driver = mock_neo4j_driver
        generator.set_timeout(5000)  # 5 seconds
        
        mock_neo4j_driver.session().run.side_effect = Exception("Query timeout")
        
        with pytest.raises(QueryTimeoutError):
            await generator.execute_query("MATCH (n) RETURN n")
    
    @pytest.mark.asyncio
    async def test_connection_error_handling(self, generator, mock_neo4j_driver):
        """Test handling of connection errors."""
        generator.driver = mock_neo4j_driver
        
        mock_neo4j_driver.session.side_effect = Exception("Connection refused")
        
        with pytest.raises(Exception) as exc_info:
            await generator.execute_query("MATCH (n) RETURN n")
        
        assert "Connection refused" in str(exc_info.value)


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])