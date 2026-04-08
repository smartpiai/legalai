"""
Advanced Search Service Tests
Following TDD - RED phase: Comprehensive test suite for advanced search service
"""

import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any, Optional
import json

from app.services.advanced_search import (
    AdvancedSearchService,
    SearchQuery,
    SearchFilter,
    SearchResult,
    SearchFacet,
    SearchAggregation,
    SearchSuggestion,
    SavedSearch,
    SearchHistory,
    QueryType,
    FilterOperator,
    SortOrder,
    FacetType,
    SearchScope
)
from app.models.search import Search, SearchIndex, SearchCache
from app.schemas.search import (
    SearchRequestSchema,
    SearchResponseSchema,
    FacetSchema,
    SuggestionSchema
)


class TestAdvancedSearchService:
    """Test suite for advanced search service"""

    @pytest.fixture
    def mock_elasticsearch(self):
        """Mock Elasticsearch client"""
        es = AsyncMock()
        es.search = AsyncMock()
        es.index = AsyncMock()
        es.update = AsyncMock()
        return es

    @pytest.fixture
    def mock_postgres(self):
        """Mock PostgreSQL connection"""
        db = AsyncMock()
        db.query = AsyncMock()
        db.execute = AsyncMock()
        return db

    @pytest.fixture
    def mock_qdrant(self):
        """Mock Qdrant vector database"""
        qdrant = AsyncMock()
        qdrant.search = AsyncMock()
        qdrant.upsert = AsyncMock()
        return qdrant

    @pytest.fixture
    def mock_cache_service(self):
        """Mock cache service"""
        cache = AsyncMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock()
        cache.delete = AsyncMock()
        return cache

    @pytest.fixture
    def search_service(
        self,
        mock_elasticsearch,
        mock_postgres,
        mock_qdrant,
        mock_cache_service
    ):
        """Create advanced search service instance"""
        return AdvancedSearchService(
            elasticsearch=mock_elasticsearch,
            postgres=mock_postgres,
            qdrant=mock_qdrant,
            cache_service=mock_cache_service
        )

    @pytest.fixture
    def sample_query(self):
        """Sample search query"""
        return SearchQuery(
            query_text="service agreement payment terms",
            query_type=QueryType.FULL_TEXT,
            scope=SearchScope.CONTRACTS,
            filters=[
                SearchFilter(
                    field="status",
                    operator=FilterOperator.EQUALS,
                    value="active"
                )
            ],
            sort_by="relevance",
            sort_order=SortOrder.DESC,
            page=1,
            page_size=20
        )

    # Test Basic Search

    @pytest.mark.asyncio
    async def test_basic_text_search(self, search_service):
        """Test basic full-text search"""
        results = await search_service.search(
            query="contract renewal",
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, SearchResult)
        assert results.total_count >= 0
        assert isinstance(results.items, list)
        assert results.query == "contract renewal"

    @pytest.mark.asyncio
    async def test_search_with_filters(self, search_service, sample_query):
        """Test search with filters applied"""
        results = await search_service.execute_search(
            query=sample_query,
            tenant_id="tenant-123"
        )
        
        assert results.total_count >= 0
        assert results.facets is not None
        assert results.page == 1

    @pytest.mark.asyncio
    async def test_search_with_pagination(self, search_service):
        """Test search with pagination"""
        results = await search_service.search(
            query="agreement",
            page=2,
            page_size=10,
            tenant_id="tenant-123"
        )
        
        assert results.page == 2
        assert results.page_size == 10
        assert len(results.items) <= 10

    # Test Advanced Query Types

    @pytest.mark.asyncio
    async def test_boolean_search(self, search_service):
        """Test Boolean search with AND/OR/NOT operators"""
        query = SearchQuery(
            query_text="(contract AND payment) OR (agreement NOT draft)",
            query_type=QueryType.BOOLEAN,
            scope=SearchScope.ALL
        )
        
        results = await search_service.execute_search(
            query=query,
            tenant_id="tenant-123"
        )
        
        assert results.query_type == QueryType.BOOLEAN
        assert results.total_count >= 0

    @pytest.mark.asyncio
    async def test_phrase_search(self, search_service):
        """Test exact phrase search"""
        results = await search_service.search_phrase(
            phrase="force majeure clause",
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, SearchResult)
        assert all("force majeure" in str(item).lower() for item in results.items[:5])

    @pytest.mark.asyncio
    async def test_proximity_search(self, search_service):
        """Test proximity search for terms near each other"""
        results = await search_service.search_proximity(
            term1="payment",
            term2="due",
            distance=5,
            tenant_id="tenant-123"
        )
        
        assert results.total_count >= 0
        assert results.query_type == QueryType.PROXIMITY

    @pytest.mark.asyncio
    async def test_wildcard_search(self, search_service):
        """Test wildcard pattern search"""
        results = await search_service.search_wildcard(
            pattern="agree*",
            tenant_id="tenant-123"
        )
        
        assert results.total_count >= 0
        # Results should include agreement, agreements, agreed, etc.

    @pytest.mark.asyncio
    async def test_regex_search(self, search_service):
        """Test regex pattern search"""
        results = await search_service.search_regex(
            pattern=r"SEC-\d{4}-\w+",
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, SearchResult)
        assert results.query_type == QueryType.REGEX

    # Test Semantic Search

    @pytest.mark.asyncio
    async def test_semantic_search(self, search_service):
        """Test semantic/vector search"""
        results = await search_service.semantic_search(
            query="legal obligations for data protection",
            similarity_threshold=0.7,
            tenant_id="tenant-123"
        )
        
        assert results.search_type == "semantic"
        assert all(r.similarity_score >= 0.7 for r in results.items[:5])

    @pytest.mark.asyncio
    async def test_hybrid_search(self, search_service):
        """Test hybrid search combining keyword and semantic"""
        results = await search_service.hybrid_search(
            query="termination clause",
            keyword_weight=0.6,
            semantic_weight=0.4,
            tenant_id="tenant-123"
        )
        
        assert results.search_type == "hybrid"
        assert results.total_count >= 0

    @pytest.mark.asyncio
    async def test_similar_document_search(self, search_service):
        """Test finding similar documents"""
        similar = await search_service.find_similar(
            document_id="doc-123",
            top_k=10,
            tenant_id="tenant-123"
        )
        
        assert len(similar.items) <= 10
        assert all(s.similarity_score > 0 for s in similar.items)

    # Test Faceted Search

    @pytest.mark.asyncio
    async def test_faceted_search(self, search_service):
        """Test search with facet generation"""
        results = await search_service.search_with_facets(
            query="contract",
            facets=["status", "type", "department"],
            tenant_id="tenant-123"
        )
        
        assert len(results.facets) == 3
        assert "status" in results.facets
        assert isinstance(results.facets["status"], list)

    @pytest.mark.asyncio
    async def test_date_range_facets(self, search_service):
        """Test date range faceting"""
        results = await search_service.search_with_date_facets(
            query="agreement",
            date_field="created_date",
            ranges=[
                {"key": "last_week", "from": "now-7d"},
                {"key": "last_month", "from": "now-30d"},
                {"key": "last_year", "from": "now-365d"}
            ],
            tenant_id="tenant-123"
        )
        
        assert "date_ranges" in results.facets
        assert len(results.facets["date_ranges"]) == 3

    @pytest.mark.asyncio
    async def test_numeric_range_facets(self, search_service):
        """Test numeric range faceting"""
        results = await search_service.search_with_numeric_facets(
            query="contract",
            field="value",
            ranges=[
                {"key": "small", "from": 0, "to": 10000},
                {"key": "medium", "from": 10000, "to": 100000},
                {"key": "large", "from": 100000}
            ],
            tenant_id="tenant-123"
        )
        
        assert "value_ranges" in results.facets

    # Test Aggregations

    @pytest.mark.asyncio
    async def test_search_aggregations(self, search_service):
        """Test search with aggregations"""
        aggregations = await search_service.aggregate(
            query="contract",
            agg_fields=["status", "type"],
            metrics=["count", "sum:value", "avg:value"],
            tenant_id="tenant-123"
        )
        
        assert "status" in aggregations
        assert "type" in aggregations
        assert "total_value" in aggregations

    @pytest.mark.asyncio
    async def test_time_series_aggregation(self, search_service):
        """Test time series aggregation"""
        time_series = await search_service.time_series_aggregate(
            query="contract",
            date_field="created_date",
            interval="month",
            start_date=datetime.utcnow() - timedelta(days=365),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert len(time_series) > 0
        assert all("date" in ts and "count" in ts for ts in time_series)

    # Test Search Suggestions

    @pytest.mark.asyncio
    async def test_search_suggestions(self, search_service):
        """Test search query suggestions"""
        suggestions = await search_service.get_suggestions(
            prefix="contr",
            max_suggestions=5,
            tenant_id="tenant-123"
        )
        
        assert len(suggestions) <= 5
        assert all(s.text.startswith("contr") for s in suggestions)

    @pytest.mark.asyncio
    async def test_spell_correction(self, search_service):
        """Test spell correction in search"""
        corrected = await search_service.spell_correct(
            query="contarct agrement",
            tenant_id="tenant-123"
        )
        
        assert corrected.original == "contarct agrement"
        assert corrected.corrected == "contract agreement"
        assert corrected.confidence > 0

    @pytest.mark.asyncio
    async def test_related_searches(self, search_service):
        """Test getting related search queries"""
        related = await search_service.get_related_searches(
            query="employment contract",
            max_results=5,
            tenant_id="tenant-123"
        )
        
        assert len(related) <= 5
        assert all(isinstance(r, str) for r in related)

    # Test Saved Searches

    @pytest.mark.asyncio
    async def test_save_search(self, search_service, sample_query):
        """Test saving a search query"""
        saved = await search_service.save_search(
            name="Active Service Agreements",
            query=sample_query,
            alert_enabled=True,
            user_id="user-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(saved, SavedSearch)
        assert saved.name == "Active Service Agreements"
        assert saved.alert_enabled is True

    @pytest.mark.asyncio
    async def test_execute_saved_search(self, search_service):
        """Test executing a saved search"""
        results = await search_service.execute_saved_search(
            saved_search_id="saved-123",
            tenant_id="tenant-123"
        )
        
        assert isinstance(results, SearchResult)
        assert results.from_saved_search is True

    @pytest.mark.asyncio
    async def test_update_saved_search(self, search_service):
        """Test updating a saved search"""
        updated = await search_service.update_saved_search(
            saved_search_id="saved-123",
            updates={"alert_enabled": False},
            tenant_id="tenant-123"
        )
        
        assert updated.alert_enabled is False

    @pytest.mark.asyncio
    async def test_delete_saved_search(self, search_service):
        """Test deleting a saved search"""
        result = await search_service.delete_saved_search(
            saved_search_id="saved-123",
            tenant_id="tenant-123"
        )
        
        assert result is True

    # Test Search History

    @pytest.mark.asyncio
    async def test_track_search_history(self, search_service):
        """Test tracking search history"""
        await search_service.track_search(
            query="contract renewal",
            results_count=25,
            user_id="user-123",
            tenant_id="tenant-123"
        )
        
        history = await search_service.get_search_history(
            user_id="user-123",
            tenant_id="tenant-123"
        )
        
        assert len(history) > 0
        assert history[0].query == "contract renewal"

    @pytest.mark.asyncio
    async def test_popular_searches(self, search_service):
        """Test getting popular searches"""
        popular = await search_service.get_popular_searches(
            time_range="week",
            limit=10,
            tenant_id="tenant-123"
        )
        
        assert len(popular) <= 10
        assert all(p.count > 0 for p in popular)

    @pytest.mark.asyncio
    async def test_search_analytics(self, search_service):
        """Test search analytics"""
        analytics = await search_service.get_search_analytics(
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow(),
            tenant_id="tenant-123"
        )
        
        assert analytics.total_searches > 0
        assert analytics.unique_users > 0
        assert analytics.avg_results_clicked >= 0

    # Test Advanced Features

    @pytest.mark.asyncio
    async def test_search_within_results(self, search_service):
        """Test searching within previous results"""
        # First search
        initial = await search_service.search(
            query="contract",
            tenant_id="tenant-123"
        )
        
        # Search within results
        refined = await search_service.search_within_results(
            result_ids=[r.id for r in initial.items],
            query="payment",
            tenant_id="tenant-123"
        )
        
        assert refined.total_count <= initial.total_count

    @pytest.mark.asyncio
    async def test_field_specific_search(self, search_service):
        """Test searching in specific fields"""
        results = await search_service.search_fields(
            fields=["title", "description"],
            query="service agreement",
            tenant_id="tenant-123"
        )
        
        assert results.searched_fields == ["title", "description"]

    @pytest.mark.asyncio
    async def test_search_with_highlights(self, search_service):
        """Test search with result highlighting"""
        results = await search_service.search_with_highlights(
            query="payment terms",
            highlight_fields=["content", "title"],
            tenant_id="tenant-123"
        )
        
        assert all(hasattr(r, "highlights") for r in results.items[:5])

    @pytest.mark.asyncio
    async def test_export_search_results(self, search_service):
        """Test exporting search results"""
        export = await search_service.export_results(
            query="contract",
            format="csv",
            fields=["id", "title", "status", "value"],
            tenant_id="tenant-123"
        )
        
        assert export.format == "csv"
        assert export.file_path is not None

    # Test Caching

    @pytest.mark.asyncio
    async def test_cached_search(self, search_service, mock_cache_service):
        """Test search result caching"""
        # First search (cache miss)
        mock_cache_service.get.return_value = None
        results1 = await search_service.search(
            query="contract",
            use_cache=True,
            tenant_id="tenant-123"
        )
        
        # Second search (cache hit)
        mock_cache_service.get.return_value = results1
        results2 = await search_service.search(
            query="contract",
            use_cache=True,
            tenant_id="tenant-123"
        )
        
        assert results2.from_cache is True

    # Test Multi-tenant Isolation

    @pytest.mark.asyncio
    async def test_tenant_search_isolation(self, search_service):
        """Test that search is isolated between tenants"""
        # Search in tenant A
        results_a = await search_service.search(
            query="confidential",
            tenant_id="tenant-A"
        )
        
        # Search in tenant B
        results_b = await search_service.search(
            query="confidential",
            tenant_id="tenant-B"
        )
        
        # Results should be different
        assert results_a.tenant_id == "tenant-A"
        assert results_b.tenant_id == "tenant-B"