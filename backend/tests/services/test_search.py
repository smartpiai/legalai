"""
Tests for search and retrieval service.
Following TDD methodology - tests written before implementation.
"""
import pytest
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json

from app.services.search import (
    SearchService,
    FullTextSearchEngine,
    FilterEngine,
    FacetedSearchEngine,
    SearchRanker,
    QuerySuggester,
    SearchHistoryManager,
    SavedSearchManager,
    SearchResult,
    SearchFilter,
    SearchFacet,
    SearchQuery
)
from app.models.contract import Contract
from app.models.document import Document
from app.models.search import SearchHistory, SavedSearch


class TestFullTextSearchEngine:
    """Test full-text search functionality."""
    
    @pytest.mark.asyncio
    async def test_search_contracts_by_text(self, test_db_session):
        """Test searching contracts by text content."""
        # Create test contracts
        contract1 = Contract(
            name="Service Agreement",
            content="This is a professional services agreement for software development.",
            tenant_id=1,
            created_by=1
        )
        contract2 = Contract(
            name="License Agreement", 
            content="This is a software license agreement for commercial use.",
            tenant_id=1,
            created_by=1
        )
        contract3 = Contract(
            name="NDA",
            content="This is a non-disclosure agreement for confidential information.",
            tenant_id=1,
            created_by=1
        )
        
        test_db_session.add_all([contract1, contract2, contract3])
        await test_db_session.commit()
        
        # Initialize search engine
        engine = FullTextSearchEngine(test_db_session)
        
        # Search for "software"
        results = await engine.search(
            query="software",
            entity_type="contract",
            tenant_id=1
        )
        
        assert len(results) == 2
        assert any("Service Agreement" in r.title for r in results)
        assert any("License Agreement" in r.title for r in results)
    
    @pytest.mark.asyncio
    async def test_search_documents_by_content(self, test_db_session):
        """Test searching documents by extracted text."""
        # Create test documents
        doc1 = Document(
            name="contract_2024.pdf",
            extracted_text="This document contains terms about payment schedules and deliverables.",
            tenant_id=1,
            uploaded_by=1
        )
        doc2 = Document(
            name="invoice.pdf",
            extracted_text="Invoice for services rendered with payment due in 30 days.",
            tenant_id=1,
            uploaded_by=1
        )
        
        test_db_session.add_all([doc1, doc2])
        await test_db_session.commit()
        
        engine = FullTextSearchEngine(test_db_session)
        
        # Search for "payment"
        results = await engine.search(
            query="payment",
            entity_type="document",
            tenant_id=1
        )
        
        assert len(results) == 2
        assert all(r.entity_type == "document" for r in results)
    
    @pytest.mark.asyncio
    async def test_search_with_wildcards(self, test_db_session):
        """Test wildcard search patterns."""
        contract = Contract(
            name="International Agreement",
            content="This international cooperation agreement covers multiple jurisdictions.",
            tenant_id=1,
            created_by=1
        )
        test_db_session.add(contract)
        await test_db_session.commit()
        
        engine = FullTextSearchEngine(test_db_session)
        
        # Search with wildcards
        results = await engine.search(
            query="inter*",
            entity_type="contract",
            tenant_id=1,
            use_wildcards=True
        )
        
        assert len(results) == 1
        assert "International" in results[0].title
    
    @pytest.mark.asyncio
    async def test_phrase_search(self, test_db_session):
        """Test exact phrase searching."""
        contract = Contract(
            name="Master Service Agreement",
            content="The master service agreement shall govern all work orders.",
            tenant_id=1,
            created_by=1
        )
        test_db_session.add(contract)
        await test_db_session.commit()
        
        engine = FullTextSearchEngine(test_db_session)
        
        # Search for exact phrase
        results = await engine.search(
            query='"master service agreement"',
            entity_type="contract",
            tenant_id=1,
            use_phrase=True
        )
        
        assert len(results) == 1
        assert results[0].title == "Master Service Agreement"
    
    @pytest.mark.asyncio
    async def test_search_with_stop_words(self, test_db_session):
        """Test that stop words are handled correctly."""
        contract = Contract(
            name="Agreement",
            content="The agreement is for the provision of services.",
            tenant_id=1,
            created_by=1
        )
        test_db_session.add(contract)
        await test_db_session.commit()
        
        engine = FullTextSearchEngine(test_db_session)
        
        # Search with stop words
        results = await engine.search(
            query="the agreement for services",
            entity_type="contract",
            tenant_id=1,
            remove_stop_words=True
        )
        
        assert len(results) == 1
        # Should find result even with stop words removed
    
    @pytest.mark.asyncio
    async def test_multi_tenant_isolation(self, test_db_session):
        """Test that search respects tenant boundaries."""
        # Create contracts for different tenants
        contract_t1 = Contract(
            name="Tenant 1 Contract",
            content="Confidential agreement for tenant 1",
            tenant_id=1,
            created_by=1
        )
        contract_t2 = Contract(
            name="Tenant 2 Contract", 
            content="Confidential agreement for tenant 2",
            tenant_id=2,
            created_by=2
        )
        
        test_db_session.add_all([contract_t1, contract_t2])
        await test_db_session.commit()
        
        engine = FullTextSearchEngine(test_db_session)
        
        # Search as tenant 1
        results = await engine.search(
            query="confidential",
            entity_type="contract",
            tenant_id=1
        )
        
        assert len(results) == 1
        assert results[0].title == "Tenant 1 Contract"


class TestFilterEngine:
    """Test advanced filtering functionality."""
    
    @pytest.mark.asyncio
    async def test_filter_by_date_range(self, test_db_session):
        """Test filtering by date range."""
        # Create contracts with different dates
        contract1 = Contract(
            name="Old Contract",
            created_at=datetime.utcnow() - timedelta(days=90),
            tenant_id=1,
            created_by=1
        )
        contract2 = Contract(
            name="Recent Contract",
            created_at=datetime.utcnow() - timedelta(days=10),
            tenant_id=1,
            created_by=1
        )
        
        test_db_session.add_all([contract1, contract2])
        await test_db_session.commit()
        
        filter_engine = FilterEngine(test_db_session)
        
        # Filter for last 30 days
        filters = [
            SearchFilter(
                field="created_at",
                operator="gte",
                value=(datetime.utcnow() - timedelta(days=30)).isoformat()
            )
        ]
        
        results = await filter_engine.apply_filters(
            entity_type="contract",
            tenant_id=1,
            filters=filters
        )
        
        assert len(results) == 1
        assert results[0].name == "Recent Contract"
    
    @pytest.mark.asyncio
    async def test_filter_by_status(self, test_db_session):
        """Test filtering by contract status."""
        contract1 = Contract(
            name="Active Contract",
            status="active",
            tenant_id=1,
            created_by=1
        )
        contract2 = Contract(
            name="Draft Contract",
            status="draft",
            tenant_id=1,
            created_by=1
        )
        
        test_db_session.add_all([contract1, contract2])
        await test_db_session.commit()
        
        filter_engine = FilterEngine(test_db_session)
        
        filters = [
            SearchFilter(field="status", operator="eq", value="active")
        ]
        
        results = await filter_engine.apply_filters(
            entity_type="contract",
            tenant_id=1,
            filters=filters
        )
        
        assert len(results) == 1
        assert results[0].status == "active"
    
    @pytest.mark.asyncio
    async def test_filter_by_value_range(self, test_db_session):
        """Test filtering by numeric value range."""
        contract1 = Contract(
            name="Small Contract",
            value=10000,
            tenant_id=1,
            created_by=1
        )
        contract2 = Contract(
            name="Large Contract",
            value=100000,
            tenant_id=1,
            created_by=1
        )
        
        test_db_session.add_all([contract1, contract2])
        await test_db_session.commit()
        
        filter_engine = FilterEngine(test_db_session)
        
        # Filter for contracts > 50000
        filters = [
            SearchFilter(field="value", operator="gt", value=50000)
        ]
        
        results = await filter_engine.apply_filters(
            entity_type="contract",
            tenant_id=1,
            filters=filters
        )
        
        assert len(results) == 1
        assert results[0].value == 100000
    
    @pytest.mark.asyncio
    async def test_multiple_filters(self, test_db_session):
        """Test combining multiple filters."""
        contracts = [
            Contract(name="Contract A", status="active", value=50000, tenant_id=1, created_by=1),
            Contract(name="Contract B", status="draft", value=75000, tenant_id=1, created_by=1),
            Contract(name="Contract C", status="active", value=100000, tenant_id=1, created_by=1),
        ]
        
        test_db_session.add_all(contracts)
        await test_db_session.commit()
        
        filter_engine = FilterEngine(test_db_session)
        
        # Active contracts with value > 60000
        filters = [
            SearchFilter(field="status", operator="eq", value="active"),
            SearchFilter(field="value", operator="gt", value=60000)
        ]
        
        results = await filter_engine.apply_filters(
            entity_type="contract",
            tenant_id=1,
            filters=filters
        )
        
        assert len(results) == 1
        assert results[0].name == "Contract C"


class TestFacetedSearchEngine:
    """Test faceted search functionality."""
    
    @pytest.mark.asyncio
    async def test_generate_facets(self, test_db_session):
        """Test facet generation for search results."""
        # Create contracts with various attributes
        contracts = [
            Contract(name="C1", status="active", contract_type="service", tenant_id=1, created_by=1),
            Contract(name="C2", status="active", contract_type="license", tenant_id=1, created_by=1),
            Contract(name="C3", status="draft", contract_type="service", tenant_id=1, created_by=1),
            Contract(name="C4", status="expired", contract_type="nda", tenant_id=1, created_by=1),
        ]
        
        test_db_session.add_all(contracts)
        await test_db_session.commit()
        
        facet_engine = FacetedSearchEngine(test_db_session)
        
        # Generate facets
        facets = await facet_engine.generate_facets(
            entity_type="contract",
            tenant_id=1,
            fields=["status", "contract_type"]
        )
        
        # Check status facet
        status_facet = next(f for f in facets if f.field == "status")
        assert len(status_facet.values) == 3
        assert {"value": "active", "count": 2} in status_facet.values
        assert {"value": "draft", "count": 1} in status_facet.values
        
        # Check contract_type facet
        type_facet = next(f for f in facets if f.field == "contract_type")
        assert len(type_facet.values) == 3
        assert {"value": "service", "count": 2} in type_facet.values
    
    @pytest.mark.asyncio
    async def test_faceted_search_with_selection(self, test_db_session):
        """Test search with facet selection."""
        contracts = [
            Contract(name="Service 1", contract_type="service", status="active", tenant_id=1, created_by=1),
            Contract(name="Service 2", contract_type="service", status="draft", tenant_id=1, created_by=1),
            Contract(name="License 1", contract_type="license", status="active", tenant_id=1, created_by=1),
        ]
        
        test_db_session.add_all(contracts)
        await test_db_session.commit()
        
        facet_engine = FacetedSearchEngine(test_db_session)
        
        # Search with facet selection
        results = await facet_engine.search_with_facets(
            query="",
            entity_type="contract",
            tenant_id=1,
            selected_facets={
                "contract_type": ["service"],
                "status": ["active"]
            }
        )
        
        assert len(results.items) == 1
        assert results.items[0].name == "Service 1"
        
        # Check updated facet counts
        assert len(results.facets) == 2


class TestSearchRanker:
    """Test search result ranking."""
    
    @pytest.mark.asyncio
    async def test_relevance_scoring(self, test_db_session):
        """Test relevance-based scoring."""
        ranker = SearchRanker()
        
        # Create mock search results
        results = [
            SearchResult(
                id=1,
                title="Exact Match Contract",
                content="This contract contains the exact search term multiple times.",
                entity_type="contract",
                score=0
            ),
            SearchResult(
                id=2,
                title="Partial Match",
                content="This has the term once.",
                entity_type="contract",
                score=0
            ),
            SearchResult(
                id=3,
                title="Title Match Contract",
                content="Different content here.",
                entity_type="contract",
                score=0
            )
        ]
        
        # Rank by relevance for query "contract"
        ranked = await ranker.rank_results(
            results=results,
            query="contract",
            ranking_algorithm="relevance"
        )
        
        # Title matches should rank higher
        assert ranked[0].id == 3  # Title match
        assert ranked[1].id == 1  # Multiple content matches
        assert ranked[2].id == 2  # Single content match
    
    @pytest.mark.asyncio
    async def test_recency_ranking(self, test_db_session):
        """Test ranking by recency."""
        ranker = SearchRanker()
        
        results = [
            SearchResult(
                id=1,
                title="Old Contract",
                created_at=datetime.utcnow() - timedelta(days=365),
                entity_type="contract",
                score=0
            ),
            SearchResult(
                id=2,
                title="Recent Contract",
                created_at=datetime.utcnow() - timedelta(days=1),
                entity_type="contract",
                score=0
            ),
            SearchResult(
                id=3,
                title="Medium Contract",
                created_at=datetime.utcnow() - timedelta(days=30),
                entity_type="contract",
                score=0
            )
        ]
        
        ranked = await ranker.rank_results(
            results=results,
            query="",
            ranking_algorithm="recency"
        )
        
        assert ranked[0].id == 2  # Most recent
        assert ranked[1].id == 3  # Medium
        assert ranked[2].id == 1  # Oldest
    
    @pytest.mark.asyncio
    async def test_combined_ranking(self, test_db_session):
        """Test combined relevance and recency ranking."""
        ranker = SearchRanker()
        
        results = [
            SearchResult(
                id=1,
                title="Contract Management",
                content="Old but highly relevant contract management system.",
                created_at=datetime.utcnow() - timedelta(days=100),
                entity_type="contract",
                score=0
            ),
            SearchResult(
                id=2,
                title="Recent Document",
                content="New but less relevant.",
                created_at=datetime.utcnow() - timedelta(days=1),
                entity_type="contract",
                score=0
            )
        ]
        
        ranked = await ranker.rank_results(
            results=results,
            query="contract management",
            ranking_algorithm="combined",
            relevance_weight=0.7,
            recency_weight=0.3
        )
        
        # Should balance relevance and recency
        assert len(ranked) == 2
        assert ranked[0].score > 0


class TestQuerySuggester:
    """Test query suggestion functionality."""
    
    @pytest.mark.asyncio
    async def test_autocomplete_suggestions(self, test_db_session):
        """Test autocomplete suggestions based on existing data."""
        # Add search history
        history = [
            SearchHistory(query="service agreement", user_id=1, tenant_id=1, result_count=5),
            SearchHistory(query="service contract", user_id=1, tenant_id=1, result_count=3),
            SearchHistory(query="software license", user_id=1, tenant_id=1, result_count=2),
        ]
        
        test_db_session.add_all(history)
        await test_db_session.commit()
        
        suggester = QuerySuggester(test_db_session)
        
        # Get suggestions for "serv"
        suggestions = await suggester.get_suggestions(
            prefix="serv",
            tenant_id=1,
            limit=5
        )
        
        assert len(suggestions) == 2
        assert "service agreement" in suggestions
        assert "service contract" in suggestions
    
    @pytest.mark.asyncio
    async def test_spelling_correction(self, test_db_session):
        """Test query spelling correction."""
        suggester = QuerySuggester(test_db_session)
        
        # Test common misspellings
        corrected = await suggester.correct_spelling("agrement")
        assert corrected == "agreement"
        
        corrected = await suggester.correct_spelling("contracat")
        assert corrected == "contract"
    
    @pytest.mark.asyncio
    async def test_related_terms(self, test_db_session):
        """Test related term suggestions."""
        suggester = QuerySuggester(test_db_session)
        
        # Get related terms
        related = await suggester.get_related_terms(
            query="contract",
            tenant_id=1
        )
        
        assert "agreement" in related
        assert "document" in related
        assert len(related) <= 10


class TestSearchHistoryManager:
    """Test search history management."""
    
    @pytest.mark.asyncio
    async def test_save_search_history(self, test_db_session):
        """Test saving search history."""
        manager = SearchHistoryManager(test_db_session)
        
        # Save search
        await manager.save_search(
            query="test query",
            filters={"status": "active"},
            result_count=10,
            user_id=1,
            tenant_id=1
        )
        
        # Verify saved
        history = await manager.get_user_history(user_id=1, tenant_id=1)
        assert len(history) == 1
        assert history[0].query == "test query"
        assert history[0].result_count == 10
    
    @pytest.mark.asyncio
    async def test_get_popular_searches(self, test_db_session):
        """Test getting popular searches."""
        manager = SearchHistoryManager(test_db_session)
        
        # Add search history with different frequencies
        for i in range(5):
            await manager.save_search("popular query", {}, 10, 1, 1)
        for i in range(2):
            await manager.save_search("less popular", {}, 5, 1, 1)
        await manager.save_search("rare query", {}, 1, 1, 1)
        
        # Get popular searches
        popular = await manager.get_popular_searches(tenant_id=1, limit=2)
        
        assert len(popular) == 2
        assert popular[0]["query"] == "popular query"
        assert popular[0]["count"] == 5
        assert popular[1]["query"] == "less popular"
    
    @pytest.mark.asyncio
    async def test_clear_old_history(self, test_db_session):
        """Test clearing old search history."""
        manager = SearchHistoryManager(test_db_session)
        
        # Add old and new searches
        old_search = SearchHistory(
            query="old search",
            user_id=1,
            tenant_id=1,
            created_at=datetime.utcnow() - timedelta(days=100)
        )
        new_search = SearchHistory(
            query="new search",
            user_id=1,
            tenant_id=1,
            created_at=datetime.utcnow()
        )
        
        test_db_session.add_all([old_search, new_search])
        await test_db_session.commit()
        
        # Clear history older than 90 days
        deleted = await manager.clear_old_history(days=90)
        
        assert deleted == 1
        
        # Verify only new search remains
        history = await manager.get_user_history(user_id=1, tenant_id=1)
        assert len(history) == 1
        assert history[0].query == "new search"


class TestSavedSearchManager:
    """Test saved search functionality."""
    
    @pytest.mark.asyncio
    async def test_save_search(self, test_db_session):
        """Test saving a search for later use."""
        manager = SavedSearchManager(test_db_session)
        
        # Save search
        saved = await manager.save_search(
            name="Active Contracts",
            query="status:active",
            filters={"status": "active"},
            user_id=1,
            tenant_id=1,
            notify_on_new=True
        )
        
        assert saved.id is not None
        assert saved.name == "Active Contracts"
        assert saved.notify_on_new is True
    
    @pytest.mark.asyncio
    async def test_execute_saved_search(self, test_db_session):
        """Test executing a saved search."""
        # Create test data
        contract1 = Contract(name="Active 1", status="active", tenant_id=1, created_by=1)
        contract2 = Contract(name="Draft 1", status="draft", tenant_id=1, created_by=1)
        
        test_db_session.add_all([contract1, contract2])
        await test_db_session.commit()
        
        manager = SavedSearchManager(test_db_session)
        
        # Save and execute search
        saved = await manager.save_search(
            name="Active Only",
            query="",
            filters={"status": "active"},
            user_id=1,
            tenant_id=1
        )
        
        results = await manager.execute_saved_search(
            saved_search_id=saved.id,
            user_id=1,
            tenant_id=1
        )
        
        assert len(results) == 1
        assert results[0].name == "Active 1"
    
    @pytest.mark.asyncio
    async def test_update_saved_search(self, test_db_session):
        """Test updating a saved search."""
        manager = SavedSearchManager(test_db_session)
        
        # Create saved search
        saved = await manager.save_search(
            name="Original Name",
            query="test",
            filters={},
            user_id=1,
            tenant_id=1
        )
        
        # Update it
        updated = await manager.update_saved_search(
            saved_search_id=saved.id,
            name="Updated Name",
            query="updated query",
            user_id=1
        )
        
        assert updated.name == "Updated Name"
        assert updated.query == "updated query"
    
    @pytest.mark.asyncio
    async def test_delete_saved_search(self, test_db_session):
        """Test deleting a saved search."""
        manager = SavedSearchManager(test_db_session)
        
        # Create and delete
        saved = await manager.save_search(
            name="To Delete",
            query="test",
            filters={},
            user_id=1,
            tenant_id=1
        )
        
        deleted = await manager.delete_saved_search(
            saved_search_id=saved.id,
            user_id=1
        )
        
        assert deleted is True
        
        # Verify deleted
        all_saved = await manager.get_user_saved_searches(user_id=1, tenant_id=1)
        assert len(all_saved) == 0


class TestSearchService:
    """Test complete search service integration."""
    
    @pytest.mark.asyncio
    async def test_comprehensive_search(self, test_db_session):
        """Test comprehensive search with all features."""
        # Create test data
        contracts = [
            Contract(
                name="Service Agreement 2024",
                content="Professional services for software development.",
                status="active",
                value=100000,
                contract_type="service",
                tenant_id=1,
                created_by=1,
                created_at=datetime.utcnow() - timedelta(days=10)
            ),
            Contract(
                name="License Agreement",
                content="Software licensing terms.",
                status="active", 
                value=50000,
                contract_type="license",
                tenant_id=1,
                created_by=1,
                created_at=datetime.utcnow() - timedelta(days=20)
            ),
            Contract(
                name="Old Service Contract",
                content="Expired service contract.",
                status="expired",
                value=75000,
                contract_type="service",
                tenant_id=1,
                created_by=1,
                created_at=datetime.utcnow() - timedelta(days=400)
            )
        ]
        
        test_db_session.add_all(contracts)
        await test_db_session.commit()
        
        service = SearchService(test_db_session)
        
        # Perform comprehensive search
        search_query = SearchQuery(
            query="service",
            entity_type="contract",
            filters=[
                SearchFilter(field="status", operator="eq", value="active")
            ],
            facet_fields=["contract_type", "status"],
            sort_by="relevance",
            page=1,
            page_size=10
        )
        
        results = await service.search(
            search_query=search_query,
            user_id=1,
            tenant_id=1
        )
        
        assert results.total_count == 1
        assert len(results.items) == 1
        assert results.items[0].name == "Service Agreement 2024"
        
        # Check facets
        assert len(results.facets) == 2
        
        # Verify search was saved to history
        history = await service.get_search_history(user_id=1, tenant_id=1)
        assert len(history) > 0
    
    @pytest.mark.asyncio
    async def test_search_with_pagination(self, test_db_session):
        """Test search with pagination."""
        # Create many contracts
        contracts = []
        for i in range(25):
            contracts.append(
                Contract(
                    name=f"Contract {i:02d}",
                    content="Standard contract content.",
                    tenant_id=1,
                    created_by=1
                )
            )
        
        test_db_session.add_all(contracts)
        await test_db_session.commit()
        
        service = SearchService(test_db_session)
        
        # First page
        query = SearchQuery(
            query="contract",
            entity_type="contract",
            page=1,
            page_size=10
        )
        
        page1 = await service.search(query, user_id=1, tenant_id=1)
        
        assert page1.total_count == 25
        assert len(page1.items) == 10
        assert page1.page == 1
        assert page1.total_pages == 3
        
        # Second page
        query.page = 2
        page2 = await service.search(query, user_id=1, tenant_id=1)
        
        assert len(page2.items) == 10
        assert page2.page == 2
        
        # Last page
        query.page = 3
        page3 = await service.search(query, user_id=1, tenant_id=1)
        
        assert len(page3.items) == 5
        assert page3.page == 3
    
    @pytest.mark.asyncio
    async def test_export_search_results(self, test_db_session):
        """Test exporting search results."""
        # Create test data
        contracts = [
            Contract(name=f"Contract {i}", tenant_id=1, created_by=1)
            for i in range(5)
        ]
        
        test_db_session.add_all(contracts)
        await test_db_session.commit()
        
        service = SearchService(test_db_session)
        
        # Search and export
        query = SearchQuery(query="contract", entity_type="contract")
        
        # Export as CSV
        csv_data = await service.export_results(
            search_query=query,
            format="csv",
            user_id=1,
            tenant_id=1
        )
        
        assert csv_data is not None
        assert "Contract 0" in csv_data
        
        # Export as JSON
        json_data = await service.export_results(
            search_query=query,
            format="json",
            user_id=1,
            tenant_id=1
        )
        
        parsed = json.loads(json_data)
        assert len(parsed["results"]) == 5