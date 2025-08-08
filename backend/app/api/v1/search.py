"""
Search API endpoints for the Legal AI Platform.
Provides comprehensive search functionality with faceting, filtering, and suggestions.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.rbac import require_permission
from app.models.user import User
from app.services.search import (
    SearchService,
    SearchQuery,
    SearchFilter,
    SearchResponse,
    SearchResult,
    QuerySuggester,
    SavedSearchManager
)
from app.models.search import SearchHistory, SavedSearch


router = APIRouter(prefix="/search", tags=["search"])


# Pydantic schemas for API
class SearchFilterRequest(BaseModel):
    """Search filter request schema."""
    field: str
    operator: str
    value: Any


class SearchRequest(BaseModel):
    """Search request schema."""
    query: str = Field(..., description="Search query text")
    entity_type: str = Field(default="contract", description="Type of entity to search")
    filters: Optional[List[SearchFilterRequest]] = Field(default=None, description="Search filters")
    facet_fields: Optional[List[str]] = Field(default=None, description="Fields to generate facets for")
    sort_by: str = Field(default="relevance", description="Sort order: relevance, recency, or combined")
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Results per page")


class SavedSearchRequest(BaseModel):
    """Saved search request schema."""
    name: str = Field(..., description="Name for the saved search")
    description: Optional[str] = Field(None, description="Description of the search")
    query: str = Field(..., description="Search query")
    filters: Optional[Dict[str, Any]] = Field(default={}, description="Search filters")
    notify_on_new: bool = Field(default=False, description="Enable notifications for new matches")
    notification_frequency: Optional[str] = Field(default="daily", description="Notification frequency")


class SavedSearchUpdateRequest(BaseModel):
    """Update saved search request."""
    name: Optional[str] = None
    description: Optional[str] = None
    query: Optional[str] = None
    notify_on_new: Optional[bool] = None


class SearchHistoryResponse(BaseModel):
    """Search history response schema."""
    id: int
    query: str
    filters: Dict[str, Any]
    result_count: int
    created_at: datetime


class SavedSearchResponse(BaseModel):
    """Saved search response schema."""
    id: int
    name: str
    description: Optional[str]
    query: str
    filters: Dict[str, Any]
    notify_on_new: bool
    execution_count: int
    created_at: datetime
    updated_at: Optional[datetime]


class SuggestionResponse(BaseModel):
    """Search suggestion response."""
    suggestions: List[str]
    corrected_query: Optional[str]
    related_terms: List[str]


class PopularSearchResponse(BaseModel):
    """Popular search response."""
    query: str
    count: int


class ExportRequest(BaseModel):
    """Export request schema."""
    format: str = Field(..., description="Export format: csv or json")


@router.post("/", response_model=SearchResponse)
@require_permission("contract.read")
async def search_documents(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform comprehensive search across documents and contracts.
    
    Supports:
    - Full-text search
    - Advanced filtering
    - Faceted search
    - Result ranking
    - Search history tracking
    """
    search_service = SearchService(db)
    
    # Convert request filters to SearchFilter objects
    filters = []
    if request.filters:
        for f in request.filters:
            filters.append(SearchFilter(
                field=f.field,
                operator=f.operator,
                value=f.value
            ))
    
    # Create search query
    search_query = SearchQuery(
        query=request.query,
        entity_type=request.entity_type,
        filters=filters,
        facet_fields=request.facet_fields or [],
        sort_by=request.sort_by,
        page=request.page,
        page_size=request.page_size
    )
    
    # Execute search
    results = await search_service.search(
        search_query=search_query,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    
    return results


@router.get("/suggestions")
@require_permission("contract.read")
async def get_search_suggestions(
    q: str = Query(..., description="Query prefix for suggestions"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> SuggestionResponse:
    """
    Get search suggestions and corrections.
    
    Returns:
    - Autocomplete suggestions based on search history
    - Spelling corrections
    - Related search terms
    """
    suggester = QuerySuggester(db)
    
    # Get autocomplete suggestions
    suggestions = await suggester.get_suggestions(
        prefix=q,
        tenant_id=current_user.tenant_id,
        limit=10
    )
    
    # Get spelling correction
    corrected = await suggester.correct_spelling(q)
    corrected_query = corrected if corrected != q else None
    
    # Get related terms
    related = await suggester.get_related_terms(
        query=q,
        tenant_id=current_user.tenant_id
    )
    
    return SuggestionResponse(
        suggestions=suggestions,
        corrected_query=corrected_query,
        related_terms=related
    )


@router.get("/history", response_model=List[SearchHistoryResponse])
@require_permission("contract.read")
async def get_search_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's search history."""
    search_service = SearchService(db)
    
    history = await search_service.get_search_history(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    
    # Limit results
    history = history[:limit]
    
    return [
        SearchHistoryResponse(
            id=h.id,
            query=h.query,
            filters=h.filters or {},
            result_count=h.result_count,
            created_at=h.created_at
        )
        for h in history
    ]


@router.get("/popular", response_model=List[PopularSearchResponse])
@require_permission("contract.read")
async def get_popular_searches(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get popular searches for the tenant."""
    search_service = SearchService(db)
    
    popular = await search_service.history_manager.get_popular_searches(
        tenant_id=current_user.tenant_id,
        limit=limit
    )
    
    return [
        PopularSearchResponse(
            query=p["query"],
            count=p["count"]
        )
        for p in popular
    ]


@router.post("/saved", response_model=SavedSearchResponse)
@require_permission("contract.read")
async def save_search(
    request: SavedSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a search for later use."""
    manager = SavedSearchManager(db)
    
    saved = await manager.save_search(
        name=request.name,
        query=request.query,
        filters=request.filters or {},
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        notify_on_new=request.notify_on_new
    )
    
    return SavedSearchResponse(
        id=saved.id,
        name=saved.name,
        description=saved.description,
        query=saved.query,
        filters=saved.filters or {},
        notify_on_new=saved.notify_on_new,
        execution_count=saved.execution_count or 0,
        created_at=saved.created_at,
        updated_at=saved.updated_at
    )


@router.get("/saved", response_model=List[SavedSearchResponse])
@require_permission("contract.read")
async def get_saved_searches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's saved searches."""
    manager = SavedSearchManager(db)
    
    saved_searches = await manager.get_user_saved_searches(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    
    return [
        SavedSearchResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            query=s.query,
            filters=s.filters or {},
            notify_on_new=s.notify_on_new,
            execution_count=s.execution_count or 0,
            created_at=s.created_at,
            updated_at=s.updated_at
        )
        for s in saved_searches
    ]


@router.post("/saved/{saved_search_id}/execute")
@require_permission("contract.read")
async def execute_saved_search(
    saved_search_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a saved search."""
    manager = SavedSearchManager(db)
    
    results = await manager.execute_saved_search(
        saved_search_id=saved_search_id,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    
    if not results:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    # Convert to response format
    search_results = []
    for item in results:
        search_results.append({
            "id": item.id,
            "name": item.name,
            "status": getattr(item, "status", None),
            "created_at": item.created_at
        })
    
    return {"results": search_results}


@router.put("/saved/{saved_search_id}", response_model=SavedSearchResponse)
@require_permission("contract.read")
async def update_saved_search(
    saved_search_id: int,
    request: SavedSearchUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a saved search."""
    manager = SavedSearchManager(db)
    
    saved = await manager.update_saved_search(
        saved_search_id=saved_search_id,
        name=request.name,
        query=request.query,
        user_id=current_user.id
    )
    
    if not saved:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    return SavedSearchResponse(
        id=saved.id,
        name=saved.name,
        description=saved.description,
        query=saved.query,
        filters=saved.filters or {},
        notify_on_new=saved.notify_on_new,
        execution_count=saved.execution_count or 0,
        created_at=saved.created_at,
        updated_at=saved.updated_at
    )


@router.delete("/saved/{saved_search_id}")
@require_permission("contract.read")
async def delete_saved_search(
    saved_search_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a saved search."""
    manager = SavedSearchManager(db)
    
    deleted = await manager.delete_saved_search(
        saved_search_id=saved_search_id,
        user_id=current_user.id
    )
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    return {"message": "Saved search deleted successfully"}


@router.post("/export")
@require_permission("contract.read")
async def export_search_results(
    search_request: SearchRequest,
    export_request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export search results in specified format."""
    search_service = SearchService(db)
    
    # Convert request to SearchQuery
    filters = []
    if search_request.filters:
        for f in search_request.filters:
            filters.append(SearchFilter(
                field=f.field,
                operator=f.operator,
                value=f.value
            ))
    
    search_query = SearchQuery(
        query=search_request.query,
        entity_type=search_request.entity_type,
        filters=filters
    )
    
    # Export results
    export_data = await search_service.export_results(
        search_query=search_query,
        format=export_request.format,
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    )
    
    if export_request.format == "csv":
        return {
            "format": "csv",
            "data": export_data,
            "filename": f"search_results_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    else:
        return {
            "format": "json",
            "data": export_data,
            "filename": f"search_results_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        }


@router.delete("/history/clear")
@require_permission("admin")
async def clear_old_search_history(
    days: int = Query(default=90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear search history older than specified days (admin only)."""
    search_service = SearchService(db)
    
    deleted_count = await search_service.history_manager.clear_old_history(days=days)
    
    return {
        "message": f"Cleared {deleted_count} old search records",
        "older_than_days": days
    }