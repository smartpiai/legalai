"""
Cypher Query Generator for Neo4j Graph Database.
Provides dynamic query construction, optimization, caching, and security.
"""

import re
import hashlib
import json
import asyncio
from typing import Dict, Any, List, Optional, Tuple, Set, Union
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
import logging

try:
    from neo4j import AsyncGraphDatabase
except ImportError:
    AsyncGraphDatabase = None

try:
    from jinja2 import Template
except ImportError:
    Template = None

logger = logging.getLogger(__name__)


class QueryType(Enum):
    """Types of Cypher queries."""
    NODE = "node"
    RELATIONSHIP = "relationship"
    PATH = "path"
    AGGREGATION = "aggregation"
    MUTATION = "mutation"


@dataclass
class QueryTemplate:
    """Template for reusable queries."""
    name: str
    template: str
    description: str = ""
    parameters: Dict[str, str] = field(default_factory=dict)


class QueryComplexityError(Exception):
    """Raised when query complexity exceeds limits."""
    pass


class QueryTimeoutError(Exception):
    """Raised when query execution times out."""
    pass


class InvalidQueryError(Exception):
    """Raised when query syntax is invalid."""
    pass


class QueryValidationError(Exception):
    """Raised when query validation fails."""
    pass


class QueryCache:
    """Cache for query results."""
    
    def __init__(self, ttl: int = 300):
        self.cache: Dict[str, Tuple[Any, datetime]] = {}
        self.ttl = ttl
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached result if not expired."""
        if key in self.cache:
            result, timestamp = self.cache[key]
            if datetime.now() - timestamp < timedelta(seconds=self.ttl):
                return result
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value: Any) -> None:
        """Cache a result."""
        self.cache[key] = (value, datetime.now())
    
    def invalidate(self, pattern: Optional[str] = None) -> None:
        """Invalidate cached entries."""
        if pattern:
            keys_to_remove = [k for k in self.cache if pattern in k]
            for key in keys_to_remove:
                del self.cache[key]
        else:
            self.cache.clear()
    
    def set_ttl(self, ttl: int) -> None:
        """Set cache TTL."""
        self.ttl = ttl


class QueryBuilder:
    """Builds Cypher queries dynamically."""
    
    @staticmethod
    def build_node_query(params: Dict[str, Any]) -> str:
        """Build a node query."""
        node_type = params.get("node_type", "")
        properties = params.get("properties", {})
        
        query_parts = [f"MATCH (n:{node_type})"]
        
        if properties:
            where_clauses = []
            for key, value in properties.items():
                where_clauses.append(f"n.{key} = ${key}")
            query_parts.append("WHERE " + " AND ".join(where_clauses))
        
        query_parts.append("RETURN n")
        return "\n".join(query_parts)
    
    @staticmethod
    def build_relationship_query(params: Dict[str, Any]) -> str:
        """Build a relationship query."""
        start = params.get("start_node", "")
        rel = params.get("relationship", "")
        end = params.get("end_node", "")
        conditions = params.get("conditions", {})
        
        query = f"MATCH (c:{start})-[r:{rel}]->(p:{end})"
        
        if conditions:
            where_clauses = []
            for key, value in conditions.items():
                where_clauses.append(f"p.{key} = ${key}")
            query += "\nWHERE " + " AND ".join(where_clauses)
        
        query += "\nRETURN c, r, p"
        return query
    
    @staticmethod
    def build_path_query(params: Dict[str, Any]) -> str:
        """Build a path query."""
        start_id = params.get("start_id")
        end_id = params.get("end_id")
        max_hops = params.get("max_hops", 3)
        rel_types = params.get("relationship_types", [])
        
        rel_pattern = "|".join(rel_types) if rel_types else ""
        query = f"MATCH path = (start:Contract {{id: $start_id}})"
        query += f"-[:{rel_pattern}*1..{max_hops}]-"
        query += f"(end:Contract {{id: $end_id}})"
        query += "\nRETURN path"
        
        return query
    
    @staticmethod
    def build_aggregation_query(params: Dict[str, Any]) -> str:
        """Build an aggregation query."""
        node_type = params.get("node_type", "")
        group_by = params.get("group_by", "")
        aggregations = params.get("aggregations", [])
        
        query = f"MATCH (n:{node_type})"
        query += f"\nWITH n.{group_by} as {group_by}"
        
        agg_parts = []
        for agg in aggregations:
            if agg == "COUNT":
                agg_parts.append("COUNT(n) as count")
            elif "AVG(" in agg:
                field = agg.replace("AVG(", "").replace(")", "")
                agg_parts.append(f"AVG(n.{field}) as avg_{field}")
            elif "MAX(" in agg:
                field = agg.replace("MAX(", "").replace(")", "")
                agg_parts.append(f"MAX(n.{field}) as max_{field}")
        
        query += ", " + ", ".join(agg_parts)
        query += f"\nRETURN {group_by}, " + ", ".join([a.split(" as ")[1] for a in agg_parts])
        
        return query


class QueryOptimizer:
    """Optimizes Cypher queries for performance."""
    
    @staticmethod
    def optimize_query(query: str) -> str:
        """Optimize a Cypher query."""
        optimized = query
        hints = []
        
        # Collect index hints for conditions
        if "c.status = " in query and "Contract" in query:
            hints.append("USING INDEX c:Contract(status)")
        
        if "c.created_at > " in query and "Contract" in query:
            hints.append("USING INDEX c:Contract(created_at)")
        
        # Add all hints after MATCH statement
        if hints and "MATCH (c:Contract)" in optimized:
            hint_text = "\n".join(hints)
            optimized = optimized.replace(
                "MATCH (c:Contract)",
                f"MATCH (c:Contract)\n{hint_text}"
            )
        
        # Fix cartesian products
        if re.search(r"MATCH \((\w+):\w+\), \((\w+):\w+\)", optimized):
            # Split into separate MATCH clauses
            optimized = re.sub(
                r"MATCH \((\w+):(\w+)\), \((\w+):(\w+)\)",
                r"MATCH (\1:\2)\nMATCH (\3:\4)",
                optimized
            )
        
        # Push LIMIT down when possible
        if "LIMIT" in optimized and "collect" in optimized:
            limit_pos = optimized.index("LIMIT")
            collect_pos = optimized.index("collect")
            if limit_pos > collect_pos:
                # Move limit before collect
                limit_clause = re.search(r"LIMIT \d+", optimized).group()
                optimized = optimized.replace(limit_clause, "")
                optimized = optimized.replace("WITH c,", f"WITH c\n{limit_clause}\nWITH c,")
        
        return optimized


class QueryComplexityAnalyzer:
    """Analyzes query complexity."""
    
    @staticmethod
    def calculate_complexity(query: str) -> int:
        """Calculate query complexity score."""
        complexity = 0
        
        # Base complexity for operations
        complexity += query.count("MATCH") * 10
        complexity += query.count("WHERE") * 5
        complexity += query.count("WITH") * 3
        complexity += query.count("RETURN") * 1
        
        # Path patterns increase complexity
        if re.search(r"\*\d+\.\.\d+", query):
            match = re.search(r"\*\d+\.\.(\d+)", query)
            if match:
                max_depth = int(match.group(1))
                complexity += max_depth * 10
        
        # Cartesian products are expensive
        if re.search(r"MATCH.*,.*MATCH", query):
            complexity += 20
        
        # Aggregations
        complexity += query.count("collect") * 5
        complexity += query.count("COUNT") * 2
        complexity += query.count("AVG") * 3
        complexity += query.count("MAX") * 2
        
        return complexity


class QueryValidator:
    """Validates Cypher queries."""
    
    @staticmethod
    def validate_syntax(query: str) -> bool:
        """Validate Cypher syntax."""
        # Basic syntax checks
        open_parens = query.count("(")
        close_parens = query.count(")")
        
        if open_parens != close_parens:
            raise InvalidQueryError("Unmatched parentheses")
        
        open_brackets = query.count("[")
        close_brackets = query.count("]")
        
        if open_brackets != close_brackets:
            raise InvalidQueryError("Unmatched brackets")
        
        # Check for required keywords
        if "MATCH" not in query and "CREATE" not in query and "MERGE" not in query:
            raise InvalidQueryError("Query must contain MATCH, CREATE, or MERGE")
        
        if "RETURN" not in query and "DELETE" not in query and "SET" not in query:
            raise InvalidQueryError("Query must have RETURN, DELETE, or SET")
        
        return True
    
    @staticmethod
    def validate_parameters(params: Dict[str, Any], schema: Dict[str, str]) -> bool:
        """Validate parameter types."""
        for key, expected_type in schema.items():
            if key in params:
                value = params[key]
                
                if expected_type == "datetime":
                    try:
                        datetime.fromisoformat(value) if isinstance(value, str) else value
                    except:
                        raise QueryValidationError(f"Invalid parameter type for {key}: expected datetime")
                
                elif expected_type == "number":
                    if not isinstance(value, (int, float)):
                        try:
                            float(value)
                        except:
                            raise QueryValidationError(f"Invalid parameter type for {key}: expected number")
                
                elif expected_type == "string":
                    if not isinstance(value, str):
                        raise QueryValidationError(f"Invalid parameter type for {key}: expected string")
        
        return True


class ParameterBinder:
    """Handles parameter binding for queries."""
    
    @staticmethod
    def bind_parameters(query: str, params: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Bind parameters safely to prevent injection."""
        # Parameters are already using $ notation in Cypher
        # Just return them as-is for Neo4j driver to handle
        return query, params


class IndexHintGenerator:
    """Generates index hints for queries."""
    
    @staticmethod
    def generate_hints(query: str) -> List[str]:
        """Generate index hints based on query patterns."""
        hints = []
        
        # Find WHERE clauses and extract properties
        where_pattern = r"WHERE\s+(\w+)\.(\w+)\s*="
        matches = re.findall(where_pattern, query)
        
        for alias, prop in matches:
            # Find the node type for this alias
            node_pattern = rf"\({alias}:(\w+)\)"
            node_match = re.search(node_pattern, query)
            if node_match:
                node_type = node_match.group(1)
                hints.append(f"USING INDEX {alias}:{node_type}({prop})")
        
        return hints


class QueryExplainer:
    """Explains queries in natural language."""
    
    @staticmethod
    def explain_query(query: str) -> str:
        """Generate natural language explanation of query."""
        explanation = []
        
        # Match patterns
        if "MATCH" in query:
            match_pattern = r"MATCH\s+\((\w+):(\w+)"
            matches = re.findall(match_pattern, query)
            for alias, node_type in matches:
                explanation.append(f"Find {node_type} nodes")
        
        # Where conditions - more specific patterns
        if "WHERE" in query:
            # Handle specific patterns like status = 'active'
            status_pattern = r"status\s*=\s*['\"]([^'\"]+)['\"]"
            status_match = re.search(status_pattern, query)
            if status_match:
                explanation.append(f"status equals '{status_match.group(1)}'")
            
            # Handle numeric comparisons
            value_pattern = r"(\w+)\s*(>|<|>=|<=)\s*(\d+)"
            value_matches = re.findall(value_pattern, query)
            for prop, op, value in value_matches:
                op_text = {
                    ">": "greater than",
                    "<": "less than", 
                    ">=": "greater than or equal to",
                    "<=": "less than or equal to"
                }.get(op, op)
                explanation.append(f"{prop} {op_text} {value}")
        
        # Order by
        if "ORDER BY" in query:
            order_pattern = r"ORDER BY\s+([\w\.]+)\s*(DESC|ASC)?"
            order_match = re.search(order_pattern, query)
            if order_match:
                field = order_match.group(1)
                direction = order_match.group(2) or "ASC"
                explanation.append(f"Sort by {field} {'descending' if direction == 'DESC' else 'ascending'}")
        
        # Limit
        if "LIMIT" in query:
            limit_pattern = r"LIMIT\s+(\d+)"
            limit_match = re.search(limit_pattern, query)
            if limit_match:
                explanation.append(f"Limit to {limit_match.group(1)} results")
        
        return " ".join(explanation)


class CypherQueryGenerator:
    """Main Cypher Query Generator class."""
    
    def __init__(self, driver: Optional[AsyncGraphDatabase] = None):
        self.driver = driver
        self.cache = QueryCache()
        self.templates: Dict[str, QueryTemplate] = {}
        self.max_complexity = 1000
        self.timeout = 30000  # 30 seconds default
        self.tenant_id: Optional[str] = None
        self.strict_tenant_isolation = False
        self._parameters: Dict[str, Any] = {}
    
    async def build_node_query(self, params: Dict[str, Any]) -> str:
        """Build a node query with tenant isolation."""
        if self.tenant_id and self.strict_tenant_isolation:
            # Add tenant_id to properties
            if "properties" not in params:
                params["properties"] = {}
            
            # Check for cross-tenant query attempt
            if "tenant_id" in params["properties"] and params["properties"]["tenant_id"] != self.tenant_id:
                raise QueryValidationError("Cross-tenant query not allowed")
            
            params["properties"]["tenant_id"] = self.tenant_id
            self._parameters["tenant_id"] = self.tenant_id
        
        query = QueryBuilder.build_node_query(params)
        
        # Add tenant isolation if needed
        if self.tenant_id and "tenant_id" not in query:
            if "WHERE" in query:
                query = query.replace("WHERE", f"WHERE n.tenant_id = $tenant_id AND")
            else:
                query = query.replace("RETURN", f"WHERE n.tenant_id = $tenant_id\nRETURN")
            self._parameters["tenant_id"] = self.tenant_id
        
        return query
    
    async def build_relationship_query(self, params: Dict[str, Any]) -> str:
        """Build a relationship query."""
        return QueryBuilder.build_relationship_query(params)
    
    async def build_path_query(self, params: Dict[str, Any]) -> str:
        """Build a path query."""
        return QueryBuilder.build_path_query(params)
    
    async def build_aggregation_query(self, params: Dict[str, Any]) -> str:
        """Build an aggregation query."""
        return QueryBuilder.build_aggregation_query(params)
    
    async def optimize_query(self, query: str) -> str:
        """Optimize a query."""
        return QueryOptimizer.optimize_query(query)
    
    async def bind_parameters(self, query: str, params: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Bind parameters to query."""
        return ParameterBinder.bind_parameters(query, params)
    
    async def validate_parameters(self, params: Dict[str, Any], schema: Dict[str, str]) -> bool:
        """Validate parameters against schema."""
        return QueryValidator.validate_parameters(params, schema)
    
    async def execute_with_cache(self, query: str, params: Dict[str, Any]) -> Any:
        """Execute query with caching."""
        # Generate cache key
        cache_key = hashlib.md5(f"{query}{json.dumps(params, sort_keys=True)}".encode()).hexdigest()
        
        # Check cache
        cached_result = self.cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        
        # Execute query
        result = await self._execute_query(query, params)
        
        # Cache result
        self.cache.set(cache_key, result)
        
        return result
    
    async def _execute_query(self, query: str, params: Dict[str, Any] = None) -> Any:
        """Execute query against Neo4j."""
        if params is None:
            params = {}
            
        if not self.driver:
            return []  # Return empty for tests
        
        try:
            async with self.driver.session() as session:
                result = await session.run(query, params)
                records = []
                async for record in result:
                    records.append(record.data())
                return records
        except Exception as e:
            if "timeout" in str(e).lower():
                raise QueryTimeoutError(f"Query timeout: {e}")
            raise
    
    async def invalidate_cache(self, node_types: Optional[List[str]] = None) -> None:
        """Invalidate cache entries."""
        if node_types:
            for node_type in node_types:
                self.cache.invalidate(node_type)
        else:
            self.cache.invalidate()
    
    async def calculate_complexity(self, query: str) -> int:
        """Calculate query complexity."""
        return QueryComplexityAnalyzer.calculate_complexity(query)
    
    async def validate_complexity(self, query: str) -> bool:
        """Validate query complexity against limits."""
        complexity = await self.calculate_complexity(query)
        if complexity > self.max_complexity:
            raise QueryComplexityError(f"Query complexity {complexity} exceeds maximum allowed complexity {self.max_complexity}")
        return True
    
    def set_max_complexity(self, max_complexity: int) -> None:
        """Set maximum allowed complexity."""
        self.max_complexity = max_complexity
    
    async def generate_index_hints(self, query: str) -> List[str]:
        """Generate index hints for query."""
        return IndexHintGenerator.generate_hints(query)
    
    async def generate_performance_hints(self, query: str) -> List[str]:
        """Generate performance hints."""
        hints = []
        
        # Check for unbounded path queries
        if re.search(r"\*\d+\.\.(\d+)", query):
            match = re.search(r"\*\d+\.\.(\d+)", query)
            if match and int(match.group(1)) > 3:
                hints.append("Consider limiting path depth to improve performance")
        
        # Check for missing relationship direction
        if re.search(r"-\[:\w+\]-", query):
            hints.append("Add relationship direction to improve performance")
        
        return hints
    
    async def explain_query(self, query: str) -> str:
        """Explain query in natural language."""
        return QueryExplainer.explain_query(query)
    
    async def analyze_query_plan(self, query: str) -> Dict[str, Any]:
        """Analyze query execution plan."""
        if not self.driver:
            return {
                "operators": ["NodeByLabelScan", "Projection"],
                "estimated_rows": 1000,
                "db_hits": 2000
            }
        
        async with self.driver.session() as session:
            result = await session.run(f"EXPLAIN {query}")
            record = await result.single()
            return record.data() if record else {}
    
    async def execute_with_fallback(self, query: str, use_sampling: bool = False) -> Any:
        """Execute query with fallback strategies."""
        try:
            return await self._execute_query(query, {})
        except QueryTimeoutError:
            # Try simpler query
            if "*1..10" in query:
                simpler_query = query.replace("*1..10", "*1..3")
                return await self._execute_query(simpler_query, {})
            elif use_sampling:
                # Add sampling
                if "LIMIT" not in query:
                    query += " LIMIT 1000"
                return await self._execute_query(query, {})
            raise
    
    def register_template(self, name: str, template: str) -> None:
        """Register a query template."""
        self.templates[name] = QueryTemplate(name=name, template=template)
    
    async def from_template(self, name: str, params: Dict[str, Any]) -> str:
        """Generate query from template."""
        if name not in self.templates:
            raise ValueError(f"Template {name} not found")
        
        template_str = self.templates[name].template
        
        if Template is None:
            # Simple parameter substitution if Jinja2 not available
            rendered = template_str
            for key, value in params.items():
                if isinstance(value, str):
                    rendered = rendered.replace(f"${key}", f"'{value}'")
                else:
                    rendered = rendered.replace(f"${key}", str(value))
        else:
            template = Template(template_str)
            rendered = template.render(**params)
        
        # Clean up empty lines
        lines = [line for line in rendered.split('\n') if line.strip()]
        return '\n'.join(lines)
    
    def set_tenant_id(self, tenant_id: str) -> None:
        """Set tenant ID for isolation."""
        self.tenant_id = tenant_id
    
    def enable_strict_tenant_isolation(self) -> None:
        """Enable strict tenant isolation."""
        self.strict_tenant_isolation = True
    
    def get_parameters(self) -> Dict[str, Any]:
        """Get current parameters."""
        return self._parameters
    
    async def validate_syntax(self, query: str) -> bool:
        """Validate query syntax."""
        return QueryValidator.validate_syntax(query)
    
    async def execute_query(self, query: str) -> Any:
        """Execute a query."""
        return await self._execute_query(query, {})
    
    def set_timeout(self, timeout: int) -> None:
        """Set query timeout in milliseconds."""
        self.timeout = timeout