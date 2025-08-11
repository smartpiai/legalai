/**
 * TemplatesListPage - Contract Template Management Interface
 * Comprehensive template listing with search, filter, sort, and bulk operations
 * Following existing patterns from DocumentsListPage with template-specific features
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { templateService } from '../../services/template.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  EllipsisVerticalIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  ShareIcon,
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  ArchiveBoxIcon,
  ArchiveBoxArrowDownIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  TagIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

// Template interface (from service)
interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  variables?: Record<string, any>;
  version?: string;
  is_active?: boolean;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

interface TemplateStats {
  total: number;
  active: number;
  archived: number;
  byCategory: Record<string, number>;
  recentlyCreated: number;
}

interface Filters {
  search: string;
  category: string;
  status: 'all' | 'active' | 'archived';
  dateFrom: string;
  dateTo: string;
  version: string;
}

export default function TemplatesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // State management
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    return (localStorage.getItem('templates-view-mode') as 'table' | 'grid') || 'table';
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: '',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    version: '',
  });
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(filters.search);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.search]);

  // Data fetching
  const {
    data: templatesResponse,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['templates', { 
      search: searchDebounce,
      ...filters,
      sortBy,
      sortOrder,
      page: currentPage,
      limit: itemsPerPage
    }],
    queryFn: async () => {
      const queryFilters: any = {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
        search: searchDebounce
      };

      if (filters.category) queryFilters.category = filters.category;
      if (filters.status !== 'all') {
        queryFilters.is_active = filters.status === 'active';
      }

      return await templateService.getTemplates(queryFilters);
    }
  });

  const { data: categories } = useQuery({
    queryKey: ['template-categories'],
    queryFn: () => templateService.getCategories()
  });

  const templates = templatesResponse?.items || [];
  const totalTemplates = templatesResponse?.total || 0;

  // Calculate statistics
  const templateStats = useMemo((): TemplateStats => {
    const stats: TemplateStats = {
      total: totalTemplates,
      active: 0,
      archived: 0,
      byCategory: {},
      recentlyCreated: 0
    };

    templates.forEach(template => {
      if (template.is_active) {
        stats.active++;
      } else {
        stats.archived++;
      }

      stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;

      // Count templates created in last 30 days
      if (template.created_at) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (new Date(template.created_at) > thirtyDaysAgo) {
          stats.recentlyCreated++;
        }
      }
    });

    return stats;
  }, [templates, totalTemplates]);

  // Filter and sort templates locally for advanced filtering
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Apply date filters
    if (filters.dateFrom) {
      result = result.filter(template => 
        template.updated_at && template.updated_at >= filters.dateFrom
      );
    }
    if (filters.dateTo) {
      result = result.filter(template => 
        template.updated_at && template.updated_at <= filters.dateTo
      );
    }

    // Apply version filter
    if (filters.version) {
      result = result.filter(template => 
        template.version?.toLowerCase().includes(filters.version.toLowerCase())
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'category':
          aVal = a.category.toLowerCase();
          bVal = b.category.toLowerCase();
          break;
        case 'usage_count':
          aVal = a.usage_count || 0;
          bVal = b.usage_count || 0;
          break;
        case 'updated_at':
          aVal = new Date(a.updated_at || 0).getTime();
          bVal = new Date(b.updated_at || 0).getTime();
          break;
        case 'created_at':
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
          break;
        default:
          aVal = new Date(a.updated_at || 0).getTime();
          bVal = new Date(b.updated_at || 0).getTime();
      }

      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [templates, filters, sortBy, sortOrder]);

  const totalPages = Math.ceil(totalTemplates / itemsPerPage);

  // Permission checks
  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission) ?? false;
  };

  // View mode persistence
  useEffect(() => {
    localStorage.setItem('templates-view-mode', viewMode);
  }, [viewMode]);

  // Mutations
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => templateService.deleteTemplate(id),
    onSuccess: () => {
      setNotification({ type: 'success', message: 'Template deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowDeleteConfirm(null);
    },
    onError: () => {
      setNotification({ type: 'error', message: 'Failed to delete template' });
    }
  });

  const cloneTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) => 
      templateService.cloneTemplate(id, data),
    onSuccess: () => {
      setNotification({ type: 'success', message: 'Template cloned successfully' });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowCloneDialog(null);
      setCloneName('');
    },
    onError: () => {
      setNotification({ type: 'error', message: 'Failed to clone template' });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (templateIds: string[]) => templateService.bulkDelete(templateIds),
    onSuccess: (result) => {
      setNotification({ 
        type: 'success', 
        message: `${result.deleted} templates deleted successfully` 
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSelectedTemplates(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: () => {
      setNotification({ type: 'error', message: 'Bulk delete failed' });
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ templateIds, updates }: { templateIds: string[]; updates: Partial<Template> }) =>
      templateService.bulkUpdate(templateIds, updates),
    onSuccess: (result) => {
      setNotification({ 
        type: 'success', 
        message: `${result.updated} templates updated successfully` 
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSelectedTemplates(new Set());
    },
    onError: () => {
      setNotification({ type: 'error', message: 'Bulk update failed' });
    }
  });

  // Event handlers
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      version: '',
    });
    setCurrentPage(1);
  };

  const handleTemplateSelect = (templateId: string) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
    } else {
      newSelected.add(templateId);
    }
    setSelectedTemplates(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(filteredTemplates.map(template => template.id)));
    }
  };

  const handleViewTemplate = (templateId: string) => {
    navigate(`/templates/${templateId}`);
  };

  const handleEditTemplate = (templateId: string) => {
    navigate(`/templates/${templateId}/edit`);
  };

  const handleCloneTemplate = () => {
    if (showCloneDialog && cloneName.trim()) {
      cloneTemplateMutation.mutate({
        id: showCloneDialog,
        data: { name: cloneName.trim() }
      });
    }
  };

  const handleArchiveToggle = async (templateIds: string[], makeActive: boolean) => {
    bulkUpdateMutation.mutate({
      templateIds,
      updates: { is_active: makeActive }
    });
  };

  const handleExportTemplate = async (templateId: string) => {
    try {
      const result = await templateService.exportTemplate(templateId, 'json');
      const blob = new Blob([JSON.stringify(result.template, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-${result.template.name}-${templateId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotification({ type: 'success', message: 'Template exported successfully' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to export template' });
    }
  };

  const handleImportTemplate = async (file: File) => {
    try {
      const content = await file.text();
      const templateData = JSON.parse(content);
      await templateService.importTemplate(templateData);
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setNotification({ type: 'success', message: 'Template imported successfully' });
      setShowImportDialog(false);
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to import template' });
    }
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get status badge class
  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-gray-100 text-gray-800';
  };

  // Get approval status from metadata
  const getApprovalStatus = (template: Template) => {
    return template.metadata?.approval_status || 'unknown';
  };

  // Check if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Virtual scrolling for large datasets
  const isVirtualScrollingEnabled = filteredTemplates.length > 100;
  const itemHeight = viewMode === 'table' ? 60 : 280;
  const containerHeight = 600;
  const [scrollTop, setScrollTop] = useState(0);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + 1, filteredTemplates.length);
  const visibleTemplates = isVirtualScrollingEnabled 
    ? filteredTemplates.slice(startIndex, endIndex)
    : filteredTemplates;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isVirtualScrollingEnabled) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  }, [isVirtualScrollingEnabled]);

  // Performance: Memoize template row component
  const TemplateRow = memo(({ template }: { template: Template }) => (
    <tr
      key={template.id}
      data-testid={`template-row-${template.id}`}
      className="hover:bg-gray-50"
      onMouseEnter={() => setHoveredTemplate(template.id)}
      onMouseLeave={() => setHoveredTemplate(null)}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          data-testid={`select-template-${template.id}`}
          checked={selectedTemplates.has(template.id)}
          onChange={() => handleTemplateSelect(template.id)}
          aria-label={`Select ${template.name}`}
          className="rounded"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900">{template.name}</div>
            {template.description && (
              <div className="text-sm text-gray-500 truncate max-w-xs">
                {template.description}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{template.category}</td>
      <td className="px-4 py-3 text-sm">v{template.version || '1.0.0'}</td>
      <td className="px-4 py-3 text-sm">{template.usage_count || 0}</td>
      <td className="px-4 py-3 text-sm">{formatDate(template.updated_at)}</td>
      <td className="px-4 py-3">
        <span
          data-testid={template.is_active ? 'status-active' : 'status-archived'}
          className={`inline-flex px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(template.is_active || false)}`}
        >
          {template.is_active ? 'Active' : 'Archived'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-600 capitalize">
          {getApprovalStatus(template)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button
            data-testid={`view-template-${template.id}`}
            onClick={() => handleViewTemplate(template.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="View template"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            data-testid={`edit-template-${template.id}`}
            onClick={() => handleEditTemplate(template.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Edit template"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            data-testid={`clone-template-${template.id}`}
            onClick={() => {
              setShowCloneDialog(template.id);
              setCloneName(`Copy of ${template.name}`);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Duplicate template"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
          </button>
          <button
            data-testid={`archive-template-${template.id}`}
            onClick={() => handleArchiveToggle([template.id], !template.is_active)}
            className="p-1 hover:bg-gray-100 rounded"
            title={template.is_active ? "Archive template" : "Activate template"}
          >
            {template.is_active ? (
              <ArchiveBoxIcon className="h-4 w-4" />
            ) : (
              <ArchiveBoxArrowDownIcon className="h-4 w-4" />
            )}
          </button>
          <button
            data-testid={`export-template-${template.id}`}
            onClick={() => handleExportTemplate(template.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Export template"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
          </button>
          {hasPermission('templates:delete') && (
            <button
              data-testid={`delete-template-${template.id}`}
              onClick={() => setShowDeleteConfirm(template.id)}
              className="p-1 hover:bg-gray-100 rounded text-red-600"
              title="Delete template"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  ));

  // Performance: Memoize template card component
  const TemplateCard = memo(({ template }: { template: Template }) => (
    <div
      key={template.id}
      data-testid={`template-card-${template.id}`}
      className="bg-white border rounded-lg p-4 hover:shadow-lg transition-shadow"
      onMouseEnter={() => setHoveredTemplate(template.id)}
      onMouseLeave={() => setHoveredTemplate(null)}
    >
      <div className="flex items-start justify-between mb-3">
        <input
          type="checkbox"
          checked={selectedTemplates.has(template.id)}
          onChange={() => handleTemplateSelect(template.id)}
          aria-label={`Select ${template.name}`}
          className="rounded"
        />
        <span
          className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(template.is_active || false)}`}
        >
          {template.is_active ? 'Active' : 'Archived'}
        </span>
      </div>

      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{template.name}</h3>
      
      {template.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>
      )}

      <div className="text-sm text-gray-600 space-y-1 mb-3">
        <div className="flex justify-between">
          <span>Category:</span>
          <span>{template.category}</span>
        </div>
        <div className="flex justify-between">
          <span>Version:</span>
          <span>v{template.version || '1.0.0'}</span>
        </div>
        <div className="flex justify-between">
          <span>Usage:</span>
          <span>{template.usage_count || 0}</span>
        </div>
        <div className="flex justify-between">
          <span>Modified:</span>
          <span>{formatDate(template.updated_at)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500 capitalize">
          {getApprovalStatus(template)}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleViewTemplate(template.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="View template"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleEditTemplate(template.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Edit template"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setShowCloneDialog(template.id);
              setCloneName(`Copy of ${template.name}`);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Duplicate template"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  ));

  // Notification cleanup
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="templates-loading" className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded mb-6"></div>
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} data-testid="template-skeleton" className="h-16 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-4">Failed to load templates</h2>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredTemplates.length === 0 && !Object.values(filters).some(f => f && f !== 'all')) {
    return (
      <div data-testid="empty-state" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <DocumentPlusIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No templates found</h2>
          <p className="text-gray-600 mb-6">Get started by creating your first template</p>
          {hasPermission('templates:create') && (
            <Button onClick={() => navigate('/templates/create')}>Create First Template</Button>
          )}
        </div>
      </div>
    );
  }

  // No results after filtering
  if (filteredTemplates.length === 0) {
    return (
      <div data-testid="no-results" className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <FunnelIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No templates match your filters</h2>
            <p className="text-gray-600 mb-6">Try adjusting your search criteria</p>
            <Button onClick={handleClearFilters}>Clear Filters</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="templates-list-page" className={`min-h-screen bg-gray-50 ${isMobile ? 'mobile-view' : ''}`}>
      <main role="main" aria-label="Templates list" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="flex text-sm text-gray-600">
            <li><Link to="/" className="hover:text-blue-600">Home</Link></li>
            <li className="mx-2">/</li>
            <li className="text-gray-900">Templates</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <div className="flex gap-3">
            {hasPermission('templates:create') && (
              <Button onClick={() => navigate('/templates/create')}>
                <DocumentPlusIcon className="h-5 w-5 mr-2" />
                Create Template
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setShowImportDialog(true)}
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              Import Templates
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div data-testid="template-stats" className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{templateStats.total}</div>
              <div className="text-sm text-gray-600">Total Templates</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{templateStats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">{templateStats.archived}</div>
              <div className="text-sm text-gray-600">Archived</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{templateStats.recentlyCreated}</div>
              <div className="text-sm text-gray-600">Recent (30 days)</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange({ search: e.target.value })}
                  className="pl-10"
                  clearable={!!filters.search}
                />
                {filters.search && (
                  <button
                    onClick={() => handleFilterChange({ search: '' })}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Mobile controls */}
              {isMobile && (
                <div data-testid="mobile-controls" className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    <FunnelIcon className="h-5 w-5" />
                    Filters
                  </Button>
                </div>
              )}

              {/* View toggle */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'table' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  ariaLabel="Table view"
                >
                  <ListBulletIcon className="h-5 w-5" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  ariaLabel="Grid view"
                >
                  <Squares2X2Icon className="h-5 w-5" />
                </Button>
              </div>

              {/* Advanced filters toggle */}
              {!isMobile && (
                <Button
                  variant="secondary"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <FunnelIcon className="h-5 w-5 mr-2" />
                  Advanced Filters
                </Button>
              )}
            </div>

            {/* Advanced filters panel */}
            {showAdvancedFilters && (
              <div data-testid="advanced-filters" className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      id="category-filter"
                      value={filters.category}
                      onChange={(e) => handleFilterChange({ category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">All categories</option>
                      {categories?.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.name} ({category.count})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      id="status-filter"
                      value={filters.status}
                      onChange={(e) => handleFilterChange({ status: e.target.value as 'all' | 'active' | 'archived' })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="all">All status</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">
                      Date from
                    </label>
                    <input
                      id="date-from"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">
                      Date to
                    </label>
                    <input
                      id="date-to"
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bulk operations bar */}
          {selectedTemplates.size > 0 && (
            <div data-testid="bulk-operations-bar" className="p-4 bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-800">
                  {selectedTemplates.size} selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setShowBulkDeleteConfirm(true)} variant="danger">
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleArchiveToggle(Array.from(selectedTemplates), false)} 
                    variant="secondary"
                  >
                    <ArchiveBoxIcon className="h-4 w-4 mr-1" />
                    Archive Selected
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleArchiveToggle(Array.from(selectedTemplates), true)} 
                    variant="secondary"
                  >
                    <ArchiveBoxArrowDownIcon className="h-4 w-4 mr-1" />
                    Activate Selected
                  </Button>
                  <Button size="sm" onClick={() => setShowExportDialog(true)} variant="secondary">
                    <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                    Export Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Template list/grid */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto" onScroll={handleScroll} style={{ maxHeight: isVirtualScrollingEnabled ? containerHeight : 'none' }}>
              <table role="table" aria-label="Templates table" className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0}
                        onChange={handleSelectAll}
                        aria-label="Select all"
                        className="rounded"
                      />
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('name')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Name
                      {sortBy === 'name' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('category')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Category
                      {sortBy === 'category' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Version</th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('usage_count')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Usage Count
                      {sortBy === 'usage_count' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      role="columnheader"
                      onClick={() => handleSort('updated_at')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-900 cursor-pointer hover:bg-gray-100"
                    >
                      Last Modified
                      {sortBy === 'updated_at' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Approval</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody 
                  className="divide-y divide-gray-200" 
                  style={isVirtualScrollingEnabled ? {
                    height: filteredTemplates.length * itemHeight,
                    paddingTop: startIndex * itemHeight,
                  } : undefined}
                >
                  {visibleTemplates.map(template => (
                    <TemplateRow key={template.id} template={template} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-testid="templates-grid" className="p-4">
              <div 
                data-testid="virtual-scroll-container" 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                onScroll={handleScroll}
                style={{ 
                  maxHeight: isVirtualScrollingEnabled ? containerHeight : 'none',
                  overflowY: isVirtualScrollingEnabled ? 'auto' : 'visible'
                }}
              >
                {visibleTemplates.map(template => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="px-4 py-3 border-t">
            <nav role="navigation" aria-label="pagination" className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <select
                  aria-label="Items per page"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1 border rounded"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <span className="text-sm text-gray-700">
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalTemplates)} of {totalTemplates}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <input
                  type="number"
                  aria-label="Go to page"
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Number(e.target.value))}
                  onKeyPress={(e) => e.key === 'Enter' && setCurrentPage(Number((e.target as HTMLInputElement).value))}
                  className="w-16 px-2 py-1 border rounded text-center"
                  min="1"
                  max={totalPages}
                />
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* Dialogs and modals */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div role="dialog" className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Confirm Delete</h2>
              <p className="mb-4">
                Are you sure you want to delete "{templates.find(t => t.id === showDeleteConfirm)?.name}"?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="danger" 
                  loading={deleteTemplateMutation.isPending}
                  onClick={() => deleteTemplateMutation.mutate(showDeleteConfirm)}
                >
                  Confirm Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div role="dialog" className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Confirm Bulk Delete</h2>
              <p className="mb-4">
                Are you sure you want to delete {selectedTemplates.size} templates? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowBulkDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="danger" 
                  loading={bulkDeleteMutation.isPending}
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedTemplates))}
                >
                  Confirm Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {showCloneDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div role="dialog" className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Duplicate Template</h2>
              <div className="mb-4">
                <label htmlFor="clone-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Template name
                </label>
                <Input
                  id="clone-name"
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Enter template name"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowCloneDialog(null)}>
                  Cancel
                </Button>
                <Button 
                  loading={cloneTemplateMutation.isPending}
                  onClick={handleCloneTemplate}
                  disabled={!cloneName.trim()}
                >
                  Create Copy
                </Button>
              </div>
            </div>
          </div>
        )}

        {showImportDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div role="dialog" className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Import Templates</h2>
              <div className="mb-4">
                <label htmlFor="import-file" className="block text-sm font-medium text-gray-700 mb-1">
                  Select JSON file
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImportTemplate(file);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button>Import</Button>
              </div>
            </div>
          </div>
        )}

        {showExportDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div role="dialog" className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Export Templates</h2>
              <div className="mb-4">
                <label htmlFor="export-format" className="block text-sm font-medium text-gray-700 mb-1">
                  Export format
                </label>
                <select
                  id="export-format"
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="json">JSON</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowExportDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  // Handle bulk export logic here
                  setShowExportDialog(false);
                }}>
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {notification && (
          <div role="status" className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 flex items-center z-50">
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />}
            {notification.type === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />}
            {notification.message}
          </div>
        )}

        {/* Screen reader announcement for selection */}
        {selectedTemplates.size > 0 && (
          <div role="status" className="sr-only">{selectedTemplates.size} templates selected</div>
        )}
      </main>
    </div>
  );
}
