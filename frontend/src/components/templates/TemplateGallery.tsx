import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  StarIcon,
  HeartIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronDownIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  usageCount: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  preview?: string;
  variables: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canClone: boolean;
    canUse: boolean;
  };
  isFavorite?: boolean;
  isBookmarked?: boolean;
  userRating?: number;
}

interface TemplateGalleryProps {
  templates: Template[];
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onCreateTemplate?: () => void;
  onEditTemplate?: (templateId: string) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onCloneTemplate?: (templateId: string) => void;
  onUseTemplate?: (templateId: string) => void;
  onPreviewTemplate?: (templateId: string) => void;
  onRateTemplate?: (templateId: string, rating: number) => void;
  onBookmarkTemplate?: (templateId: string, bookmarked: boolean) => void;
}

type ViewMode = 'grid' | 'list';
type CardSize = 'small' | 'medium' | 'large';
type SortBy = 'name' | 'created' | 'updated' | 'usage' | 'rating';

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  templates = [],
  isLoading = false,
  currentUser,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onCloneTemplate,
  onUseTemplate,
  onPreviewTemplate,
  onRateTemplate,
  onBookmarkTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [sortBy, setSortBy] = useState<SortBy>('created');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);

  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Get unique categories, tags, and statuses
  const categories = useMemo(() => {
    const cats = [...new Set(templates.map(t => t.category))].filter(Boolean);
    return cats.sort();
  }, [templates]);

  const allTags = useMemo(() => {
    const tags = [...new Set(templates.flatMap(t => t.tags))].filter(Boolean);
    return tags.sort();
  }, [templates]);

  const statuses = useMemo(() => {
    const statusList = [...new Set(templates.map(t => t.status))].filter(Boolean);
    return statusList.sort();
  }, [templates]);

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = templates.filter(template => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!template.name.toLowerCase().includes(query) &&
            !template.description.toLowerCase().includes(query) &&
            !template.tags.some(tag => tag.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all' && template.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && template.status !== statusFilter) {
        return false;
      }

      // Tag filter
      if (tagFilter.length > 0 && !tagFilter.some(tag => template.tags.includes(tag))) {
        return false;
      }

      // Favorites filter
      if (showFavoritesOnly && !template.isFavorite) {
        return false;
      }

      return true;
    });

    // Sort templates
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'usage':
          comparison = a.usageCount - b.usageCount;
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [templates, searchQuery, categoryFilter, statusFilter, tagFilter, showFavoritesOnly, sortBy, sortDirection]);

  // User permissions
  const canCreateTemplates = currentUser.permissions.includes('create_templates');
  const canEditTemplates = currentUser.permissions.includes('edit_templates');
  const canDeleteTemplates = currentUser.permissions.includes('delete_templates');

  // Handle actions
  const handleUseTemplate = async (templateId: string) => {
    try {
      await onUseTemplate?.(templateId);
    } catch (error) {
      setErrorMessage('Failed to use template');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handlePreviewTemplate = useCallback((templateId: string) => {
    onPreviewTemplate?.(templateId);
  }, [onPreviewTemplate]);

  const handleCloneTemplate = useCallback((templateId: string) => {
    onCloneTemplate?.(templateId);
    setShowActionsMenu(null);
  }, [onCloneTemplate]);

  const handleEditTemplate = useCallback((templateId: string) => {
    onEditTemplate?.(templateId);
    setShowActionsMenu(null);
  }, [onEditTemplate]);

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    try {
      await onDeleteTemplate?.(templateId);
      setShowDeleteConfirm(null);
    } catch (error) {
      setErrorMessage('Failed to delete template');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  }, [onDeleteTemplate]);

  const handleRateTemplate = useCallback((templateId: string, rating: number) => {
    onRateTemplate?.(templateId, rating);
  }, [onRateTemplate]);

  const handleBookmarkTemplate = useCallback((templateId: string, isCurrentlyBookmarked: boolean) => {
    onBookmarkTemplate?.(templateId, !isCurrentlyBookmarked);
  }, [onBookmarkTemplate]);

  const handleTagFilter = (tag: string) => {
    setTagFilter(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setTagFilter([]);
    setShowFavoritesOnly(false);
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleKeyDown = (e: React.KeyboardEvent, templateIndex: number) => {
    if (e.key === 'ArrowDown' && templateIndex < filteredAndSortedTemplates.length - 1) {
      e.preventDefault();
      const nextTemplate = document.getElementById(`template-${filteredAndSortedTemplates[templateIndex + 1].id}`);
      nextTemplate?.focus();
    } else if (e.key === 'ArrowUp' && templateIndex > 0) {
      e.preventDefault();
      const prevTemplate = document.getElementById(`template-${filteredAndSortedTemplates[templateIndex - 1].id}`);
      prevTemplate?.focus();
    }
  };

  const handleRetry = () => {
    setRetryLoading(true);
    setErrorMessage('');
    // Simulate retry loading
    setTimeout(() => setRetryLoading(false), 1000);
  };

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusBadgeClass = (status: Template['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'deprecated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardSizeClasses = () => {
    switch (cardSize) {
      case 'small':
        return 'p-3 text-sm small';
      case 'large':
        return 'p-6 text-lg large';
      default:
        return 'p-4 medium';
    }
  };

  const renderStarRating = (template: Template, interactive = false) => {
    const stars = [];
    const rating = interactive ? (template.userRating || 0) : template.rating;
    
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= Math.round(rating);
      stars.push(
        <button
          key={i}
          data-star={i}
          onClick={interactive ? () => handleRateTemplate(template.id, i) : undefined}
          className={`${
            isFilled ? 'text-yellow-400' : 'text-gray-300'
          } ${interactive ? 'hover:text-yellow-400 cursor-pointer' : 'cursor-default'}`}
          disabled={!interactive}
        >
          {isFilled ? (
            <StarIconSolid className="h-4 w-4" />
          ) : (
            <StarIcon className="h-4 w-4" />
          )}
        </button>
      );
    }
    
    return (
      <div className="flex items-center space-x-1">
        {stars}
        {!interactive && (
          <span className="text-sm text-gray-600 ml-2">
            {template.rating.toFixed(1)} ({template.ratingCount} reviews)
          </span>
        )}
      </div>
    );
  };

  if (isLoading || retryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (!isLoading && templates.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
        <p className="text-gray-600 mb-4">Create your first template to get started.</p>
        {canCreateTemplates && (
          <button
            onClick={onCreateTemplate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Template
          </button>
        )}
        <button
          onClick={handleRetry}
          className="ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          aria-label="Retry"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Template gallery" className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Template Gallery</h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {filteredAndSortedTemplates.length} templates found
            </span>
            {canCreateTemplates && (
              <button
                onClick={onCreateTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                aria-label="Create template"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Template
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center justify-between mb-4">
          <div role="group" aria-label="Template filters" className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                aria-label="Search templates"
                role="searchbox"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              role="combobox"
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              role="combobox"
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Status</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            {/* Favorites Toggle */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-3 py-2 rounded-md border ${
                showFavoritesOnly 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              aria-label="Show favorites only"
            >
              <HeartIcon className="h-4 w-4 inline mr-1" />
              Favorites Only
            </button>

            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
              aria-label="Clear filters"
            >
              Clear filters
            </button>
          </div>

          {/* View Controls */}
          <div className="flex items-center space-x-2">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label="Sort by"
              role="combobox"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="created">Date Created</option>
              <option value="updated">Last Updated</option>
              <option value="name">Name</option>
              <option value="usage">Usage Count</option>
              <option value="rating">Rating</option>
            </select>

            <button
              onClick={toggleSortDirection}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
              aria-label="Sort direction"
              aria-pressed={sortDirection === 'desc'}
            >
              {sortDirection === 'desc' ? (
                <ArrowDownIcon className="h-4 w-4" />
              ) : (
                <ArrowUpIcon className="h-4 w-4" />
              )}
            </button>

            {/* View Mode */}
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              aria-label="Grid view"
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              aria-label="List view"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>

            {/* Card Size */}
            <select
              value={cardSize}
              onChange={(e) => setCardSize(e.target.value as CardSize)}
              aria-label="Card size"
              role="combobox"
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div data-testid="tag-filter" className="flex items-center space-x-2 flex-wrap">
            <span className="text-sm text-gray-600">Tags:</span>
            {allTags.map(tag => (
              <button
                key={tag}
                data-tag={tag}
                onClick={() => handleTagFilter(tag)}
                className={`px-2 py-1 text-xs rounded ${
                  tagFilter.includes(tag)
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Templates Grid/List */}
      <div className="flex-1 overflow-auto p-4">
        <div
          data-testid="templates-container"
          className={`${
            viewMode === 'grid' 
              ? `grid-view grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` 
              : `list-view space-y-4`
          }`}
        >
          {filteredAndSortedTemplates.map((template, index) => (
            <div
              key={template.id}
              id={`template-${template.id}`}
              data-testid={`template-${template.id}`}
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`border rounded-lg ${getCardSizeClasses()} hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 relative bg-white`}
              aria-describedby={`${template.id}-description`}
              aria-label={`${template.name}, ${template.category}, ${template.usageCount} uses, ${template.rating} rating${template.status !== 'approved' ? ', not approved' : ''}`}
            >
              {/* Template Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                    <span className="ml-2 text-xs text-gray-500">v{template.version}</span>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm text-gray-600">{template.category || 'Unknown Category'}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(template.status)}`}>
                      {template.status}
                    </span>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="relative" ref={showActionsMenu === template.id ? actionsMenuRef : null}>
                  <button
                    onClick={() => setShowActionsMenu(showActionsMenu === template.id ? null : template.id)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Template actions"
                  >
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </button>
                  
                  {showActionsMenu === template.id && (
                    <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10 min-w-48">
                      {template.permissions.canClone && (
                        <button
                          onClick={() => handleCloneTemplate(template.id)}
                          role="menuitem"
                          className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4 inline mr-2" />
                          Clone Template
                        </button>
                      )}
                      {template.permissions.canEdit && canEditTemplates && (
                        <button
                          onClick={() => handleEditTemplate(template.id)}
                          role="menuitem"
                          className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                        >
                          <PencilIcon className="h-4 w-4 inline mr-2" />
                          Edit Template
                        </button>
                      )}
                      {template.permissions.canDelete && canDeleteTemplates && (
                        <button
                          onClick={() => setShowDeleteConfirm(template.id)}
                          role="menuitem"
                          className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left text-red-600"
                        >
                          <TrashIcon className="h-4 w-4 inline mr-2" />
                          Delete Template
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Template Description */}
              <p id={`${template.id}-description`} className="text-gray-600 text-sm mb-3 line-clamp-2">
                {template.description}
              </p>

              {/* Template Preview */}
              {template.preview && (
                <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 mb-3 line-clamp-2">
                  {template.preview}
                </div>
              )}

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Template Stats */}
              <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  <span>{template.usageCount} uses</span>
                  <span>{template.variables.length} variables</span>
                </div>
                <div className="flex items-center">
                  <UserIcon className="h-4 w-4 mr-1" />
                  <span>{template.createdBy}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                {new Date(template.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>

              {/* Rating Display */}
              <div data-testid={`rating-${template.id}`} className="mb-4">
                {renderStarRating(template, false)}
              </div>

              {/* Interactive Rating */}
              <div data-testid={`rating-input-${template.id}`} className="mb-4">
                <span className="text-sm text-gray-600 mb-1 block">Your Rating:</span>
                {renderStarRating(template, true)}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePreviewTemplate(template.id)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                    aria-label={`Preview ${template.name}`}
                  >
                    <EyeIcon className="h-4 w-4 inline mr-1" />
                    Preview
                  </button>
                  
                  <button
                    onClick={() => handleUseTemplate(template.id)}
                    disabled={!template.permissions.canUse || template.status !== 'approved'}
                    data-action="use"
                    className={`px-3 py-1 text-sm rounded ${
                      template.permissions.canUse && template.status === 'approved'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={template.status !== 'approved' ? 'Template not approved for use' : undefined}
                    aria-label={`Use ${template.name}`}
                  >
                    Use Template
                  </button>
                </div>

                <button
                  onClick={() => handleBookmarkTemplate(template.id, template.isBookmarked || false)}
                  className={`p-1 rounded ${
                    template.isBookmarked ? 'bookmarked text-red-500' : 'text-gray-400 hover:text-red-500'
                  }`}
                  aria-label={template.isBookmarked ? `Unbookmark ${template.name}` : `Bookmark ${template.name}`}
                >
                  {template.isBookmarked ? (
                    <HeartIconSolid className="h-5 w-5" />
                  ) : (
                    <HeartIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Region for Screen Readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {filteredAndSortedTemplates.length === 1 ? '1 template found' : `${filteredAndSortedTemplates.length} templates found`}
        {errorMessage && `, Error: ${errorMessage}`}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Delete Template?</h3>
            <p className="mb-4">This action cannot be undone. The template will be permanently deleted.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTemplate(showDeleteConfirm)}
                className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
                aria-label="Confirm delete"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};