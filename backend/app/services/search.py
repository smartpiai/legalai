"""
Search and retrieval service for the Legal AI Platform.
Provides full-text search, filtering, faceting, ranking, and search management.
"""
import re
import json
import csv
import io
from typing import List, Dict, Any, Optional, Set, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
from collections import Counter
import difflib

from sqlalchemy import select, and_, or_, func, text, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contract import Contract
from app.models.document import Document
from app.models.search import SearchHistory, SavedSearch


class SearchOperator(str, Enum):
    """Search filter operators."""
    EQUALS = "eq"
    NOT_EQUALS = "ne"
    GREATER_THAN = "gt"
    GREATER_THAN_OR_EQUAL = "gte"
    LESS_THAN = "lt"
    LESS_THAN_OR_EQUAL = "lte"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    IN = "in"
    NOT_IN = "not_in"


@dataclass
class SearchFilter:
    """Search filter definition."""
    field: str
    operator: str
    value: Any


@dataclass
class SearchFacet:
    """Search facet with values and counts."""
    field: str
    values: List[Dict[str, Any]]  # [{"value": "active", "count": 10}, ...]


@dataclass
class SearchResult:
    """Individual search result."""
    id: int
    title: str
    content: Optional[str] = None
    entity_type: str = "contract"
    score: float = 0.0
    highlights: List[str] = None
    metadata: Dict[str, Any] = None
    created_at: Optional[datetime] = None
    
    # Additional fields for contracts
    name: Optional[str] = None
    status: Optional[str] = None
    value: Optional[float] = None
    contract_type: Optional[str] = None


@dataclass
class SearchQuery:
    """Search query parameters."""
    query: str
    entity_type: str = "contract"
    filters: List[SearchFilter] = None
    facet_fields: List[str] = None
    sort_by: str = "relevance"
    page: int = 1
    page_size: int = 20
    
    def __post_init__(self):
        if self.filters is None:
            self.filters = []
        if self.facet_fields is None:
            self.facet_fields = []


@dataclass
class SearchResponse:
    """Search response with results and metadata."""
    items: List[SearchResult]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    facets: List[SearchFacet] = None
    query_time_ms: float = 0
    suggestions: List[str] = None


class FullTextSearchEngine:
    """Full-text search engine for contracts and documents."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize search engine."""
        self.db = db_session
        self.stop_words = {
            "the", "is", "at", "which", "on", "and", "a", "an", "as", "are",
            "was", "were", "for", "with", "to", "of", "in", "by", "from"
        }
    
    async def search(
        self,
        query: str,
        entity_type: str,
        tenant_id: int,
        use_wildcards: bool = False,
        use_phrase: bool = False,
        remove_stop_words: bool = False,
        limit: int = 100
    ) -> List[SearchResult]:
        """Perform full-text search."""
        # Process query
        processed_query = self._process_query(
            query, use_wildcards, use_phrase, remove_stop_words
        )
        
        results = []
        
        if entity_type == "contract":
            results = await self._search_contracts(
                processed_query, tenant_id, limit
            )
        elif entity_type == "document":
            results = await self._search_documents(
                processed_query, tenant_id, limit
            )
        
        return results
    
    def _process_query(
        self,
        query: str,
        use_wildcards: bool,
        use_phrase: bool,
        remove_stop_words: bool
    ) -> str:
        """Process search query."""
        # Handle phrase search
        if use_phrase:
            # Remove quotes for processing
            query = query.strip('"')
            return query
        
        # Remove stop words if requested
        if remove_stop_words:
            words = query.lower().split()
            words = [w for w in words if w not in self.stop_words]
            query = " ".join(words)
        
        # Handle wildcards
        if use_wildcards:
            # PostgreSQL uses % for wildcards
            query = query.replace("*", "%")
        
        return query
    
    async def _search_contracts(
        self,
        query: str,
        tenant_id: int,
        limit: int
    ) -> List[SearchResult]:
        """Search contracts."""
        # Use PostgreSQL full-text search or ILIKE for simplicity
        stmt = select(Contract).where(
            and_(
                Contract.tenant_id == tenant_id,
                or_(
                    Contract.name.ilike(f"%{query}%"),
                    Contract.content.ilike(f"%{query}%") if hasattr(Contract, 'content') else False
                )
            )
        ).limit(limit)
        
        result = await self.db.execute(stmt)
        contracts = result.scalars().all()
        
        search_results = []
        for contract in contracts:
            search_results.append(
                SearchResult(
                    id=contract.id,
                    title=contract.name,
                    content=getattr(contract, 'content', ''),
                    entity_type="contract",
                    score=self._calculate_relevance(query, contract.name, getattr(contract, 'content', '')),
                    created_at=contract.created_at,
                    name=contract.name,
                    status=getattr(contract, 'status', None),
                    value=getattr(contract, 'value', None),
                    contract_type=getattr(contract, 'contract_type', None)
                )
            )
        
        return search_results
    
    async def _search_documents(
        self,
        query: str,
        tenant_id: int,
        limit: int
    ) -> List[SearchResult]:
        """Search documents."""
        stmt = select(Document).where(
            and_(
                Document.tenant_id == tenant_id,
                or_(
                    Document.name.ilike(f"%{query}%"),
                    Document.extracted_text.ilike(f"%{query}%") if hasattr(Document, 'extracted_text') else False
                )
            )
        ).limit(limit)
        
        result = await self.db.execute(stmt)
        documents = result.scalars().all()
        
        search_results = []
        for doc in documents:
            search_results.append(
                SearchResult(
                    id=doc.id,
                    title=doc.name,
                    content=getattr(doc, 'extracted_text', ''),
                    entity_type="document",
                    score=self._calculate_relevance(query, doc.name, getattr(doc, 'extracted_text', '')),
                    created_at=doc.created_at
                )
            )
        
        return search_results
    
    def _calculate_relevance(self, query: str, title: str, content: str) -> float:
        """Calculate relevance score."""
        score = 0.0
        query_lower = query.lower()
        
        # Title match (higher weight)
        if title and query_lower in title.lower():
            score += 10.0
            # Exact title match
            if query_lower == title.lower():
                score += 5.0
        
        # Content match
        if content:
            content_lower = content.lower()
            # Count occurrences
            occurrences = content_lower.count(query_lower)
            score += occurrences * 1.0
        
        return score


class FilterEngine:
    """Advanced filtering engine for search."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize filter engine."""
        self.db = db_session
    
    async def apply_filters(
        self,
        entity_type: str,
        tenant_id: int,
        filters: List[SearchFilter]
    ) -> List[Any]:
        """Apply filters to search."""
        if entity_type == "contract":
            return await self._filter_contracts(tenant_id, filters)
        elif entity_type == "document":
            return await self._filter_documents(tenant_id, filters)
        
        return []
    
    async def _filter_contracts(
        self,
        tenant_id: int,
        filters: List[SearchFilter]
    ) -> List[Contract]:
        """Filter contracts."""
        stmt = select(Contract).where(Contract.tenant_id == tenant_id)
        
        for filter_item in filters:
            stmt = self._apply_filter_condition(stmt, Contract, filter_item)
        
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def _filter_documents(
        self,
        tenant_id: int,
        filters: List[SearchFilter]
    ) -> List[Document]:
        """Filter documents."""
        stmt = select(Document).where(Document.tenant_id == tenant_id)
        
        for filter_item in filters:
            stmt = self._apply_filter_condition(stmt, Document, filter_item)
        
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    def _apply_filter_condition(self, stmt, model, filter_item: SearchFilter):
        """Apply a single filter condition."""
        field = getattr(model, filter_item.field, None)
        if not field:
            return stmt
        
        if filter_item.operator == "eq":
            stmt = stmt.where(field == filter_item.value)
        elif filter_item.operator == "ne":
            stmt = stmt.where(field != filter_item.value)
        elif filter_item.operator == "gt":
            stmt = stmt.where(field > filter_item.value)
        elif filter_item.operator == "gte":
            # Handle datetime strings
            if isinstance(filter_item.value, str):
                try:
                    value = datetime.fromisoformat(filter_item.value)
                except:
                    value = filter_item.value
            else:
                value = filter_item.value
            stmt = stmt.where(field >= value)
        elif filter_item.operator == "lt":
            stmt = stmt.where(field < filter_item.value)
        elif filter_item.operator == "lte":
            stmt = stmt.where(field <= filter_item.value)
        elif filter_item.operator == "contains":
            stmt = stmt.where(field.ilike(f"%{filter_item.value}%"))
        elif filter_item.operator == "in":
            stmt = stmt.where(field.in_(filter_item.value))
        
        return stmt


class FacetedSearchEngine:
    """Faceted search engine for generating and applying facets."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize faceted search engine."""
        self.db = db_session
    
    async def generate_facets(
        self,
        entity_type: str,
        tenant_id: int,
        fields: List[str]
    ) -> List[SearchFacet]:
        """Generate facets for search results."""
        facets = []
        
        if entity_type == "contract":
            model = Contract
        elif entity_type == "document":
            model = Document
        else:
            return facets
        
        for field_name in fields:
            field = getattr(model, field_name, None)
            if not field:
                continue
            
            # Get distinct values with counts
            stmt = (
                select(field, func.count(model.id))
                .where(model.tenant_id == tenant_id)
                .group_by(field)
            )
            
            result = await self.db.execute(stmt)
            values = result.all()
            
            facet_values = [
                {"value": value, "count": count}
                for value, count in values
                if value is not None
            ]
            
            facets.append(
                SearchFacet(field=field_name, values=facet_values)
            )
        
        return facets
    
    async def search_with_facets(
        self,
        query: str,
        entity_type: str,
        tenant_id: int,
        selected_facets: Dict[str, List[Any]]
    ) -> Any:
        """Search with facet selection."""
        # Build filters from selected facets
        filters = []
        for field, values in selected_facets.items():
            if len(values) == 1:
                filters.append(SearchFilter(field=field, operator="eq", value=values[0]))
            else:
                filters.append(SearchFilter(field=field, operator="in", value=values))
        
        # Apply filters
        filter_engine = FilterEngine(self.db)
        results = await filter_engine.apply_filters(entity_type, tenant_id, filters)
        
        # Generate updated facets
        facet_fields = list(selected_facets.keys())
        facets = await self.generate_facets(entity_type, tenant_id, facet_fields)
        
        # Convert to SearchResult format
        search_results = []
        for item in results:
            search_results.append(
                SearchResult(
                    id=item.id,
                    title=item.name,
                    entity_type=entity_type,
                    name=item.name,
                    status=getattr(item, 'status', None)
                )
            )
        
        return type('SearchResponse', (), {
            'items': search_results,
            'facets': facets
        })()


class SearchRanker:
    """Search result ranking engine."""
    
    async def rank_results(
        self,
        results: List[SearchResult],
        query: str,
        ranking_algorithm: str = "relevance",
        relevance_weight: float = 0.7,
        recency_weight: float = 0.3
    ) -> List[SearchResult]:
        """Rank search results."""
        if ranking_algorithm == "relevance":
            return self._rank_by_relevance(results, query)
        elif ranking_algorithm == "recency":
            return self._rank_by_recency(results)
        elif ranking_algorithm == "combined":
            return self._rank_combined(results, query, relevance_weight, recency_weight)
        
        return results
    
    def _rank_by_relevance(self, results: List[SearchResult], query: str) -> List[SearchResult]:
        """Rank by relevance to query."""
        query_lower = query.lower()
        
        for result in results:
            score = 0.0
            
            # Title match (highest weight)
            if result.title and query_lower in result.title.lower():
                score += 10.0
                # Boost for exact match
                if query_lower == result.title.lower():
                    score += 5.0
            
            # Content match
            if result.content:
                # Count occurrences
                occurrences = result.content.lower().count(query_lower)
                score += occurrences * 1.0
            
            result.score = score
        
        # Sort by score descending
        return sorted(results, key=lambda x: x.score, reverse=True)
    
    def _rank_by_recency(self, results: List[SearchResult]) -> List[SearchResult]:
        """Rank by recency (newest first)."""
        # Sort by created_at descending
        return sorted(
            results,
            key=lambda x: x.created_at if x.created_at else datetime.min,
            reverse=True
        )
    
    def _rank_combined(
        self,
        results: List[SearchResult],
        query: str,
        relevance_weight: float,
        recency_weight: float
    ) -> List[SearchResult]:
        """Combined ranking by relevance and recency."""
        # Calculate relevance scores
        results = self._rank_by_relevance(results, query)
        max_relevance = max((r.score for r in results), default=1.0)
        
        # Calculate recency scores
        now = datetime.utcnow()
        for result in results:
            if result.created_at:
                days_old = (now - result.created_at).days
                recency_score = max(0, 100 - days_old)  # Newer = higher score
            else:
                recency_score = 0
            
            # Normalize and combine scores
            if max_relevance > 0:
                relevance_normalized = result.score / max_relevance
            else:
                relevance_normalized = 0
            
            recency_normalized = recency_score / 100.0
            
            result.score = (
                relevance_normalized * relevance_weight +
                recency_normalized * recency_weight
            )
        
        return sorted(results, key=lambda x: x.score, reverse=True)


class QuerySuggester:
    """Query suggestion and correction service."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize query suggester."""
        self.db = db_session
        self.common_terms = {
            "agreement", "contract", "license", "service", "software",
            "nda", "confidential", "payment", "terms", "conditions",
            "party", "parties", "clause", "amendment", "renewal"
        }
    
    async def get_suggestions(
        self,
        prefix: str,
        tenant_id: int,
        limit: int = 5
    ) -> List[str]:
        """Get autocomplete suggestions."""
        prefix_lower = prefix.lower()
        
        # Get from search history
        stmt = (
            select(SearchHistory.query)
            .where(
                and_(
                    SearchHistory.tenant_id == tenant_id,
                    SearchHistory.query.ilike(f"{prefix}%")
                )
            )
            .distinct()
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        suggestions = [row[0] for row in result.all()]
        
        return suggestions
    
    async def correct_spelling(self, query: str) -> str:
        """Correct spelling in query."""
        # Simple spell correction using difflib
        words = query.lower().split()
        corrected_words = []
        
        for word in words:
            # Find closest match
            matches = difflib.get_close_matches(
                word, self.common_terms, n=1, cutoff=0.7
            )
            if matches:
                corrected_words.append(matches[0])
            else:
                corrected_words.append(word)
        
        return " ".join(corrected_words)
    
    async def get_related_terms(
        self,
        query: str,
        tenant_id: int
    ) -> List[str]:
        """Get related search terms."""
        related = []
        
        # Simple related terms mapping
        term_map = {
            "contract": ["agreement", "document", "deal"],
            "agreement": ["contract", "document", "terms"],
            "license": ["software", "agreement", "terms"],
            "nda": ["confidential", "non-disclosure", "agreement"],
            "payment": ["invoice", "billing", "terms"]
        }
        
        query_lower = query.lower()
        for term, related_terms in term_map.items():
            if term in query_lower:
                related.extend(related_terms)
        
        # Add generic related terms
        if not related:
            related = ["agreement", "document", "contract", "terms"]
        
        return list(set(related))[:10]


class SearchHistoryManager:
    """Manage search history."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize search history manager."""
        self.db = db_session
    
    async def save_search(
        self,
        query: str,
        filters: Dict[str, Any],
        result_count: int,
        user_id: int,
        tenant_id: int
    ) -> None:
        """Save search to history."""
        history = SearchHistory(
            query=query,
            filters=filters,
            result_count=result_count,
            user_id=user_id,
            tenant_id=tenant_id,
            created_at=datetime.utcnow()
        )
        
        self.db.add(history)
        await self.db.commit()
    
    async def get_user_history(
        self,
        user_id: int,
        tenant_id: int,
        limit: int = 20
    ) -> List[SearchHistory]:
        """Get user's search history."""
        stmt = (
            select(SearchHistory)
            .where(
                and_(
                    SearchHistory.user_id == user_id,
                    SearchHistory.tenant_id == tenant_id
                )
            )
            .order_by(SearchHistory.created_at.desc())
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_popular_searches(
        self,
        tenant_id: int,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get popular searches."""
        stmt = (
            select(
                SearchHistory.query,
                func.count(SearchHistory.id).label('count')
            )
            .where(SearchHistory.tenant_id == tenant_id)
            .group_by(SearchHistory.query)
            .order_by(func.count(SearchHistory.id).desc())
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        
        popular = []
        for row in result.all():
            popular.append({
                "query": row.query,
                "count": row.count
            })
        
        return popular
    
    async def clear_old_history(self, days: int) -> int:
        """Clear search history older than specified days."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        stmt = (
            select(SearchHistory)
            .where(SearchHistory.created_at < cutoff_date)
        )
        
        result = await self.db.execute(stmt)
        old_searches = result.scalars().all()
        
        count = len(old_searches)
        for search in old_searches:
            await self.db.delete(search)
        
        await self.db.commit()
        return count


class SavedSearchManager:
    """Manage saved searches."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize saved search manager."""
        self.db = db_session
    
    async def save_search(
        self,
        name: str,
        query: str,
        filters: Dict[str, Any],
        user_id: int,
        tenant_id: int,
        notify_on_new: bool = False
    ) -> SavedSearch:
        """Save a search for later use."""
        saved = SavedSearch(
            name=name,
            query=query,
            filters=filters,
            user_id=user_id,
            tenant_id=tenant_id,
            notify_on_new=notify_on_new,
            created_at=datetime.utcnow()
        )
        
        self.db.add(saved)
        await self.db.commit()
        await self.db.refresh(saved)
        
        return saved
    
    async def execute_saved_search(
        self,
        saved_search_id: int,
        user_id: int,
        tenant_id: int
    ) -> List[Any]:
        """Execute a saved search."""
        # Get saved search
        stmt = select(SavedSearch).where(
            and_(
                SavedSearch.id == saved_search_id,
                SavedSearch.user_id == user_id,
                SavedSearch.tenant_id == tenant_id
            )
        )
        
        result = await self.db.execute(stmt)
        saved = result.scalar_one_or_none()
        
        if not saved:
            return []
        
        # Apply filters
        filter_engine = FilterEngine(self.db)
        filters = []
        for field, value in saved.filters.items():
            filters.append(SearchFilter(field=field, operator="eq", value=value))
        
        results = await filter_engine.apply_filters("contract", tenant_id, filters)
        return results
    
    async def update_saved_search(
        self,
        saved_search_id: int,
        name: Optional[str],
        query: Optional[str],
        user_id: int
    ) -> SavedSearch:
        """Update a saved search."""
        stmt = select(SavedSearch).where(
            and_(
                SavedSearch.id == saved_search_id,
                SavedSearch.user_id == user_id
            )
        )
        
        result = await self.db.execute(stmt)
        saved = result.scalar_one_or_none()
        
        if saved:
            if name:
                saved.name = name
            if query:
                saved.query = query
            
            await self.db.commit()
            await self.db.refresh(saved)
        
        return saved
    
    async def delete_saved_search(
        self,
        saved_search_id: int,
        user_id: int
    ) -> bool:
        """Delete a saved search."""
        stmt = select(SavedSearch).where(
            and_(
                SavedSearch.id == saved_search_id,
                SavedSearch.user_id == user_id
            )
        )
        
        result = await self.db.execute(stmt)
        saved = result.scalar_one_or_none()
        
        if saved:
            await self.db.delete(saved)
            await self.db.commit()
            return True
        
        return False
    
    async def get_user_saved_searches(
        self,
        user_id: int,
        tenant_id: int
    ) -> List[SavedSearch]:
        """Get user's saved searches."""
        stmt = select(SavedSearch).where(
            and_(
                SavedSearch.user_id == user_id,
                SavedSearch.tenant_id == tenant_id
            )
        )
        
        result = await self.db.execute(stmt)
        return result.scalars().all()


class SearchService:
    """Complete search service integrating all components."""
    
    def __init__(self, db_session: AsyncSession):
        """Initialize search service."""
        self.db = db_session
        self.full_text = FullTextSearchEngine(db_session)
        self.filter_engine = FilterEngine(db_session)
        self.facet_engine = FacetedSearchEngine(db_session)
        self.ranker = SearchRanker()
        self.suggester = QuerySuggester(db_session)
        self.history_manager = SearchHistoryManager(db_session)
        self.saved_manager = SavedSearchManager(db_session)
    
    async def search(
        self,
        search_query: SearchQuery,
        user_id: int,
        tenant_id: int
    ) -> SearchResponse:
        """Perform comprehensive search."""
        start_time = datetime.utcnow()
        
        # Full-text search
        text_results = await self.full_text.search(
            query=search_query.query,
            entity_type=search_query.entity_type,
            tenant_id=tenant_id
        )
        
        # Apply filters
        if search_query.filters:
            filtered_items = await self.filter_engine.apply_filters(
                entity_type=search_query.entity_type,
                tenant_id=tenant_id,
                filters=search_query.filters
            )
            
            # Intersect text results with filtered results
            filtered_ids = {item.id for item in filtered_items}
            text_results = [r for r in text_results if r.id in filtered_ids]
        
        # Rank results
        ranked_results = await self.ranker.rank_results(
            results=text_results,
            query=search_query.query,
            ranking_algorithm=search_query.sort_by
        )
        
        # Generate facets
        facets = []
        if search_query.facet_fields:
            facets = await self.facet_engine.generate_facets(
                entity_type=search_query.entity_type,
                tenant_id=tenant_id,
                fields=search_query.facet_fields
            )
        
        # Pagination
        total_count = len(ranked_results)
        start_idx = (search_query.page - 1) * search_query.page_size
        end_idx = start_idx + search_query.page_size
        paginated_results = ranked_results[start_idx:end_idx]
        
        # Calculate total pages
        total_pages = (total_count + search_query.page_size - 1) // search_query.page_size
        
        # Save to history
        await self.history_manager.save_search(
            query=search_query.query,
            filters={f.field: f.value for f in search_query.filters},
            result_count=total_count,
            user_id=user_id,
            tenant_id=tenant_id
        )
        
        # Calculate query time
        query_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        return SearchResponse(
            items=paginated_results,
            total_count=total_count,
            page=search_query.page,
            page_size=search_query.page_size,
            total_pages=total_pages,
            facets=facets,
            query_time_ms=query_time_ms
        )
    
    async def get_search_history(
        self,
        user_id: int,
        tenant_id: int
    ) -> List[SearchHistory]:
        """Get user's search history."""
        return await self.history_manager.get_user_history(user_id, tenant_id)
    
    async def export_results(
        self,
        search_query: SearchQuery,
        format: str,
        user_id: int,
        tenant_id: int
    ) -> str:
        """Export search results."""
        # Get all results (no pagination)
        results = await self.full_text.search(
            query=search_query.query,
            entity_type=search_query.entity_type,
            tenant_id=tenant_id
        )
        
        if format == "csv":
            return self._export_as_csv(results)
        elif format == "json":
            return self._export_as_json(results)
        
        return ""
    
    def _export_as_csv(self, results: List[SearchResult]) -> str:
        """Export results as CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["ID", "Title", "Type", "Score"])
        
        # Data
        for result in results:
            writer.writerow([
                result.id,
                result.title,
                result.entity_type,
                result.score
            ])
        
        return output.getvalue()
    
    def _export_as_json(self, results: List[SearchResult]) -> str:
        """Export results as JSON."""
        data = {
            "results": [
                {
                    "id": r.id,
                    "title": r.title,
                    "type": r.entity_type,
                    "score": r.score
                }
                for r in results
            ]
        }
        
        return json.dumps(data, indent=2)