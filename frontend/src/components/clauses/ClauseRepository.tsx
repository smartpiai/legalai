import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  FolderIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TagIcon,
  ChartBarIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

interface Clause {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  version: string;
  status: 'draft' | 'review' | 'approved' | 'deprecated';
  approvalStatus: {
    approvedBy?: string;
    approvedAt?: string;
    reviewNotes?: string;
  };
  riskLevel: 'low' | 'medium' | 'high';
  jurisdiction?: string;
  language: string;
  usageCount: number;
  lastUsed?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  parentClauseId?: string;
  metadata?: {
    industry?: string[];
    contractTypes?: string[];
    effectiveDate?: string;
    expirationDate?: string;
    customFields?: Record<string, any>;
  };
}

interface ClauseRepositoryProps {
  clauses?: Clause[];
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onCreateClause?: (clause: Omit<Clause, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateClause?: (clauseId: string, updates: Partial<Clause>) => Promise<void>;
  onDeleteClause?: (clauseId: string) => Promise<void>;
  onApproveClause?: (clauseId: string, notes?: string) => Promise<void>;
  onDeprecateClause?: (clauseId: string, reason: string) => Promise<void>;
  onCloneClause?: (clauseId: string) => Promise<void>;
  onExportClauses?: (clauseIds: string[], format: 'json' | 'csv' | 'docx') => Promise<void>;
  onImportClauses?: (file: File) => Promise<void>;
  onTagClause?: (clauseId: string, tags: string[]) => Promise<void>;
  onViewHistory?: (clauseId: string) => void;
  onCompareVersions?: (clauseId1: string, clauseId2: string) => void;
}

type ViewMode = 'grid' | 'list';
type TabType = 'repository' | 'analytics';
type SortBy = 'title' | 'created' | 'updated' | 'usage' | 'category';

export const ClauseRepository: React.FC<ClauseRepositoryProps> = ({
  clauses = [],
  isLoading = false,
  currentUser,
  onCreateClause,
  onUpdateClause,
  onDeleteClause,
  onApproveClause,
  onDeprecateClause,
  onCloneClause,
  onExportClauses,
  onImportClauses,
  onTagClause,
  onViewHistory,
  onCompareVersions,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('repository');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('created');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedClauses, setSelectedClauses] = useState<Set<string>>(new Set());
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [showClauseForm, setShowClauseForm] = useState(false);
  const [editingClause, setEditingClause] = useState<Clause | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showDeprecateModal, setShowDeprecateModal] = useState<string | null>(null);
  const [deprecationReason, setDeprecationReason] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTags, setNewTags] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate statistics
  const stats = useMemo(() => {
    const approved = clauses.filter(c => c.status === 'approved').length;
    const draft = clauses.filter(c => c.status === 'draft').length;
    const deprecated = clauses.filter(c => c.status === 'deprecated').length;
    const mostUsed = [...clauses].sort((a, b) => b.usageCount - a.usageCount)[0];
    
    return {
      total: clauses.length,
      approved,
      draft,
      deprecated,
      review: clauses.filter(c => c.status === 'review').length,
      mostUsed,
    };
  }, [clauses]);

  // Get unique values for filters
  const categories = useMemo(() => {
    return [...new Set(clauses.map(c => c.category))].sort();
  }, [clauses]);

  const allTags = useMemo(() => {
    return [...new Set(clauses.flatMap(c => c.tags))].sort();
  }, [clauses]);

  // Filter and sort clauses
  const filteredClauses = useMemo(() => {
    let filtered = [...clauses];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.content.toLowerCase().includes(query) ||
        c.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(c => c.status === selectedStatus);
    }

    // Risk level filter
    if (selectedRiskLevel !== 'all') {
      filtered = filtered.filter(c => c.riskLevel === selectedRiskLevel);
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(c =>
        selectedTags.some(tag => c.tags.includes(tag))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
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
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [clauses, searchQuery, selectedCategory, selectedStatus, selectedRiskLevel, selectedTags, sortBy, sortDirection]);

  // Paginate
  const paginatedClauses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClauses.slice(start, start + itemsPerPage);
  }, [filteredClauses, currentPage]);

  const totalPages = Math.ceil(filteredClauses.length / itemsPerPage);

  // Permissions
  const canCreate = currentUser.permissions.includes('create_clauses');
  const canEdit = currentUser.permissions.includes('edit_clauses');
  const canDelete = currentUser.permissions.includes('delete_clauses');
  const canApprove = currentUser.permissions.includes('approve_clauses');

  // Handlers
  const handleSelectClause = (clauseId: string) => {
    setSelectedClauses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clauseId)) {
        newSet.delete(clauseId);
      } else {
        newSet.add(clauseId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedClauses.size === filteredClauses.length) {
      setSelectedClauses(new Set());
    } else {
      setSelectedClauses(new Set(filteredClauses.map(c => c.id)));
    }
  };

  const handleCompareSelect = (clauseId: string) => {
    setCompareSelection(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clauseId)) {
        newSet.delete(clauseId);
      } else {
        if (newSet.size >= 2) {
          const first = Array.from(newSet)[0];
          newSet.delete(first);
        }
        newSet.add(clauseId);
      }
      return newSet;
    });
  };

  const handleCompare = () => {
    if (compareSelection.size === 2) {
      const [id1, id2] = Array.from(compareSelection);
      onCompareVersions?.(id1, id2);
      setCompareSelection(new Set());
    }
  };

  const handleCreateClause = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    try {
      await onCreateClause?.({
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        category: formData.get('category') as string,
        tags: (formData.get('tags') as string).split(',').map(t => t.trim()),
        version: '1.0',
        status: 'draft',
        approvalStatus: {},
        riskLevel: formData.get('riskLevel') as 'low' | 'medium' | 'high',
        language: 'en',
        usageCount: 0,
        createdBy: currentUser.name,
      });
      setShowClauseForm(false);
      setSuccessMessage('Clause created successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to create clause');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleUpdateClause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClause) return;
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    try {
      await onUpdateClause?.(editingClause.id, {
        content: formData.get('content') as string,
      });
      setEditingClause(null);
      setSuccessMessage('Clause updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to update clause');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeleteClause = async (clauseId: string) => {
    try {
      await onDeleteClause?.(clauseId);
      setShowDeleteConfirm(null);
      setSuccessMessage('Clause deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to delete clause');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const clauseId of selectedClauses) {
        await onDeleteClause?.(clauseId);
      }
      setSelectedClauses(new Set());
      setShowBulkDeleteConfirm(false);
      setSuccessMessage('Clauses deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to delete clauses');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleApprove = async () => {
    if (!showApprovalModal) return;
    
    try {
      await onApproveClause?.(showApprovalModal, approvalNotes);
      setShowApprovalModal(null);
      setApprovalNotes('');
      setSuccessMessage('Clause approved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to approve clause');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeprecate = async () => {
    if (!showDeprecateModal) return;
    
    try {
      await onDeprecateClause?.(showDeprecateModal, deprecationReason);
      setShowDeprecateModal(null);
      setDeprecationReason('');
      setSuccessMessage('Clause deprecated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to deprecate clause');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleBulkTag = async () => {
    const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
    
    try {
      for (const clauseId of selectedClauses) {
        await onTagClause?.(clauseId, tags);
      }
      setShowTagModal(false);
      setNewTags('');
      setSelectedClauses(new Set());
      setSuccessMessage('Tags applied successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to apply tags');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'docx') => {
    const clauseIds = selectedClauses.size > 0
      ? Array.from(selectedClauses)
      : filteredClauses.map(c => c.id);
    
    try {
      await onExportClauses?.(clauseIds, format);
      setShowExportMenu(false);
      setSuccessMessage('Export completed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to export clauses');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    try {
      await onImportClauses?.(importFile);
      setShowImportModal(false);
      setImportFile(null);
      setSuccessMessage('Import completed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to import clauses');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleTagClick = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedRiskLevel('all');
    setSelectedTags([]);
  };

  const toggleExpanded = (clauseId: string) => {
    setExpandedClauses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clauseId)) {
        newSet.delete(clauseId);
      } else {
        newSet.add(clauseId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: Clause['status']) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'deprecated': return 'bg-red-100 text-red-800';
    }
  };

  const getRiskIcon = (level: Clause['riskLevel']) => {
    switch (level) {
      case 'low': return <ShieldCheckIcon className="h-4 w-4 text-green-600" />;
      case 'medium': return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />;
      case 'high': return <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading clauses...</p>
        </div>
      </div>
    );
  }

  if (clauses.length === 0) {
    return (
      <div className="text-center py-12">
        <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No clauses found</h3>
        <p className="text-gray-600 mb-4">Create your first clause to get started.</p>
        {canCreate && (
          <button
            onClick={() => setShowClauseForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Clause
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="region" aria-label="Clause repository" className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Clause Repository</h1>
          <div className="flex items-center space-x-2">
            {canCreate && (
              <button
                onClick={() => setShowClauseForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Clause
              </button>
            )}
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center"
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
              Import Clauses
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {selectedClauses.size > 0 ? 'Export Selected' : 'Export All'}
                <ChevronDownIcon className="h-4 w-4 ml-1" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
                  <button
                    role="menuitem"
                    onClick={() => handleExport('json')}
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Export as JSON
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => handleExport('csv')}
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Export as CSV
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => handleExport('docx')}
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Export as DOCX
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-6 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Total Clauses</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="text-xl font-bold text-green-600">{stats.approved}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Draft</div>
            <div className="text-xl font-bold text-gray-600">{stats.draft}</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded">
            <div className="text-sm text-gray-600">In Review</div>
            <div className="text-xl font-bold text-yellow-600">{stats.review}</div>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <div className="text-sm text-gray-600">Deprecated</div>
            <div className="text-xl font-bold text-red-600">{stats.deprecated}</div>
          </div>
          {stats.mostUsed && (
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-sm text-gray-600">Most Used</div>
              <div className="text-sm font-bold text-blue-600 truncate">{stats.mostUsed.title}</div>
              <div className="text-xs text-gray-600">{stats.mostUsed.usageCount} uses</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex space-x-1 border-b">
          <button
            role="tab"
            aria-selected={activeTab === 'repository'}
            onClick={() => setActiveTab('repository')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'repository'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Repository
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'analytics'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'repository' && (
        <>
          {/* Filters */}
          <nav aria-label="Clause filters" className="border-b p-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1" role="search">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search clauses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded w-full"
                />
              </div>

              <select
                aria-label="Filter by category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border rounded"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                aria-label="Filter by status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border rounded"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="draft">Draft</option>
                <option value="review">In Review</option>
                <option value="deprecated">Deprecated</option>
              </select>

              <select
                aria-label="Filter by risk level"
                value={selectedRiskLevel}
                onChange={(e) => setSelectedRiskLevel(e.target.value)}
                className="px-3 py-2 border rounded"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>

              <select
                aria-label="Sort by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2 border rounded"
              >
                <option value="created">Created Date</option>
                <option value="updated">Updated Date</option>
                <option value="title">Title</option>
                <option value="usage">Usage Count</option>
                <option value="category">Category</option>
              </select>

              <button
                onClick={clearFilters}
                className="px-3 py-2 text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>

              <div className="flex items-center space-x-2">
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
              </div>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="mt-3 flex items-center flex-wrap gap-2">
                <span className="text-sm text-gray-600">Tags:</span>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    role="button"
                    aria-label={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`px-2 py-1 text-xs rounded ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Bulk Actions */}
            {selectedClauses.size > 0 && (
              <div className="mt-3 flex items-center space-x-2">
                <span className="text-sm text-gray-600">{selectedClauses.size} clauses selected</span>
                <button
                  onClick={() => setShowTagModal(true)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  Add Tags
                </button>
                {canDelete && (
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                  >
                    Delete Selected
                  </button>
                )}
              </div>
            )}

            {compareSelection.size === 2 && (
              <div className="mt-3">
                <button
                  onClick={handleCompare}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Compare Selected
                </button>
              </div>
            )}
          </nav>

          {/* Clause List */}
          <div className="flex-1 overflow-auto p-4">
            <div className="mb-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selectedClauses.size === filteredClauses.length && filteredClauses.length > 0}
                  onChange={handleSelectAll}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600">Select All</span>
              </label>
            </div>

            <div
              data-testid={viewMode === 'grid' ? 'grid-view' : 'list-view'}
              className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}
            >
              {paginatedClauses.map((clause) => (
                <article
                  key={clause.id}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setShowPreview(clause.id);
                  }}
                  className="border rounded p-4 hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        aria-label="Select clause"
                        checked={selectedClauses.has(clause.id)}
                        onChange={() => handleSelectClause(clause.id)}
                        className="mr-3"
                      />
                      <input
                        type="checkbox"
                        aria-label="Select for comparison"
                        checked={compareSelection.has(clause.id)}
                        onChange={() => handleCompareSelect(clause.id)}
                        className="mr-3"
                      />
                      <div>
                        <h3 data-testid="clause-title" className="font-semibold text-gray-900">
                          {clause.title}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-sm text-gray-600">{clause.category}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(clause.status)}`}>
                            {clause.status}
                          </span>
                          <span className="text-sm text-gray-600">v{clause.version}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getRiskIcon(clause.riskLevel)}
                      <span className="text-sm text-gray-600">
                        {clause.riskLevel === 'low' ? 'Low' : clause.riskLevel === 'medium' ? 'Medium' : 'High'} Risk
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    {clause.usageCount} uses
                    {clause.lastUsed && ` • Last used: ${new Date(clause.lastUsed).toLocaleDateString()}`}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {clause.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowPreview(clause.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => toggleExpanded(clause.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                      >
                        {expandedClauses.has(clause.id) ? (
                          <>
                            <ChevronDownIcon className="h-4 w-4 mr-1" />
                            Hide details
                          </>
                        ) : (
                          <>
                            <ChevronRightIcon className="h-4 w-4 mr-1" />
                            Expand details
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => onViewHistory?.(clause.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        View History
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      {canEdit && (
                        <button
                          onClick={() => setEditingClause(clause)}
                          className="p-1 text-gray-600 hover:text-gray-900"
                          aria-label="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onCloneClause?.(clause.id)}
                        className="p-1 text-gray-600 hover:text-gray-900"
                        aria-label="Clone"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" />
                      </button>
                      {canApprove && clause.status === 'draft' && (
                        <button
                          onClick={() => setShowApprovalModal(clause.id)}
                          className="p-1 text-green-600 hover:text-green-700"
                          aria-label="Approve"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit && clause.status === 'approved' && (
                        <button
                          onClick={() => setShowDeprecateModal(clause.id)}
                          className="p-1 text-yellow-600 hover:text-yellow-700"
                          aria-label="Deprecate"
                        >
                          <ClockIcon className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setShowDeleteConfirm(clause.id)}
                          className="p-1 text-red-600 hover:text-red-700"
                          aria-label="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedClauses.has(clause.id) && clause.metadata && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      {clause.metadata.industry && (
                        <div>
                          <span className="font-medium">Industry:</span> {clause.metadata.industry.join(', ')}
                        </div>
                      )}
                      {clause.metadata.contractTypes && (
                        <div>
                          <span className="font-medium">Contract Types:</span> {clause.metadata.contractTypes.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-3">Usage Trend</h3>
              <div data-testid="usage-chart" className="h-48 bg-gray-50 rounded flex items-center justify-center text-gray-500">
                Usage Chart
              </div>
            </div>
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-3">Category Distribution</h3>
              <div data-testid="category-chart" className="h-48 bg-gray-50 rounded flex items-center justify-center text-gray-500">
                Category Distribution Chart
              </div>
            </div>
            <div className="border rounded p-4">
              <h3 className="font-semibold mb-3">Deprecation Timeline</h3>
              <div data-testid="deprecation-timeline" className="h-48 bg-gray-50 rounded flex items-center justify-center text-gray-500">
                Deprecation Timeline
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {(showClauseForm || editingClause) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editingClause ? 'Edit Clause' : 'Create New Clause'}
            </h2>
            <form onSubmit={editingClause ? handleUpdateClause : handleCreateClause}>
              {!editingClause && (
                <>
                  <div className="mb-4">
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Clause title
                    </label>
                    <input
                      id="title"
                      name="title"
                      type="text"
                      required
                      className="mt-1 block w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <input
                      id="category"
                      name="category"
                      type="text"
                      required
                      className="mt-1 block w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="riskLevel" className="block text-sm font-medium text-gray-700">
                      Risk Level
                    </label>
                    <select
                      id="riskLevel"
                      name="riskLevel"
                      className="mt-1 block w-full border rounded px-3 py-2"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                      Tags (comma-separated)
                    </label>
                    <input
                      id="tags"
                      name="tags"
                      type="text"
                      className="mt-1 block w-full border rounded px-3 py-2"
                    />
                  </div>
                </>
              )}
              <div className="mb-4">
                <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                  Clause content
                </label>
                <textarea
                  id="content"
                  name="content"
                  rows={8}
                  required
                  defaultValue={editingClause?.content}
                  className="mt-1 block w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowClauseForm(false);
                    setEditingClause(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingClause ? 'Save Changes' : 'Save Clause'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-lg font-semibold mb-4">Clause Preview</h2>
            <div data-testid="clause-preview" className="prose max-w-none">
              {clauses.find(c => c.id === showPreview)?.content}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPreview(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Delete Clause?</h3>
            <p className="mb-4">This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClause(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Delete Selected Clauses?</h3>
            <p className="mb-4">This will delete {selectedClauses.size} clauses. This action cannot be undone.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm Bulk Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Approve Clause</h3>
            <div className="mb-4">
              <label htmlFor="approval-notes" className="block text-sm font-medium text-gray-700">
                Approval notes
              </label>
              <textarea
                id="approval-notes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowApprovalModal(null);
                  setApprovalNotes('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deprecation Modal */}
      {showDeprecateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Deprecate Clause</h3>
            <div className="mb-4">
              <label htmlFor="deprecation-reason" className="block text-sm font-medium text-gray-700">
                Deprecation reason
              </label>
              <textarea
                id="deprecation-reason"
                value={deprecationReason}
                onChange={(e) => setDeprecationReason(e.target.value)}
                required
                className="mt-1 block w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowDeprecateModal(null);
                  setDeprecationReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeprecate}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Confirm Deprecation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Tags</h3>
            <div className="mb-4">
              <label htmlFor="new-tags" className="block text-sm font-medium text-gray-700">
                Tags (comma-separated)
              </label>
              <input
                id="new-tags"
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowTagModal(false);
                  setNewTags('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkTag}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Apply Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Import Clauses</h3>
            <div className="mb-4">
              <label htmlFor="import-file" className="block text-sm font-medium text-gray-700">
                Select file
              </label>
              <input
                id="import-file"
                type="file"
                accept=".json,.csv,.xlsx"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {errorMessage && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded shadow-lg">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div role="status" className="fixed bottom-4 right-4 bg-green-100 text-green-700 px-4 py-2 rounded shadow-lg">
          {successMessage}
        </div>
      )}
    </div>
  );
};