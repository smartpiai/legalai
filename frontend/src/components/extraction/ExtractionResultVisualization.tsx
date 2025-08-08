import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

interface ExtractedField {
  id: string;
  name: string;
  type: 'text' | 'date' | 'number' | 'boolean' | 'list' | 'entity';
  value: any;
  confidence: number;
  source: {
    page: number;
    coordinates: { x: number; y: number; width: number; height: number };
    originalText: string;
  };
  suggestions?: string[];
  category: string;
  required: boolean;
}

interface ExtractionEntity {
  id: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'clause';
  text: string;
  confidence: number;
  source: {
    page: number;
    coordinates: { x: number; y: number; width: number; height: number };
  };
  metadata?: Record<string, any>;
}

interface ExtractionResult {
  id: string;
  documentId: string;
  documentName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'manual_review';
  extractedFields: ExtractedField[];
  entities: ExtractionEntity[];
  confidence: number;
  processingTime: number;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  errors?: string[];
  warnings?: string[];
}

interface ExtractionResultVisualizationProps {
  extractionResult: ExtractionResult;
  onFieldUpdate?: (fieldId: string, newValue: any) => void;
  onApprove?: (fieldIds: string[]) => void;
  onReject?: (fieldIds: string[]) => void;
  onExport?: (format: string, data: ExtractionResult) => void;
  onNavigateToSource?: (source: { page: number; coordinates: any }) => void;
}

type ViewMode = 'list' | 'grid';
type CardSize = 'small' | 'medium' | 'large';
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

export const ExtractionResultVisualization: React.FC<ExtractionResultVisualizationProps> = ({
  extractionResult,
  onFieldUpdate,
  onApprove,
  onReject,
  onExport,
  onNavigateToSource,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [cardSize, setCardSize] = useState<CardSize>('medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  
  const editInputRef = useRef<HTMLInputElement>(null);

  const { status, extractedFields, entities, confidence, processingTime, errors, warnings } = extractionResult;

  // Group fields by category
  const fieldsByCategory = useMemo(() => {
    return extractedFields.reduce((acc, field) => {
      const category = field.category || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(field);
      return acc;
    }, {} as Record<string, ExtractedField[]>);
  }, [extractedFields]);

  // Group entities by type
  const entitiesByType = useMemo(() => {
    return entities.reduce((acc, entity) => {
      const type = entity.type;
      const typeName = type.charAt(0).toUpperCase() + type.slice(1) + 's';
      if (!acc[typeName]) acc[typeName] = [];
      acc[typeName].push(entity);
      return acc;
    }, {} as Record<string, ExtractionEntity[]>);
  }, [entities]);

  // Filter and search fields
  const filteredFields = useMemo(() => {
    return extractedFields.filter(field => {
      // Search filter
      if (searchQuery && !field.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !field.value?.toString().toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Confidence filter
      if (confidenceFilter !== 'all') {
        const confidenceLevel = field.confidence >= 0.9 ? 'high' : field.confidence >= 0.7 ? 'medium' : 'low';
        if (confidenceLevel !== confidenceFilter) return false;
      }
      
      // Category filter
      if (categoryFilter !== 'all' && field.category !== categoryFilter) {
        return false;
      }
      
      // Required filter
      if (showOnlyRequired && !field.required) {
        return false;
      }
      
      return true;
    });
  }, [extractedFields, searchQuery, confidenceFilter, categoryFilter, showOnlyRequired]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(extractedFields.map(f => f.category))];
    return cats.sort();
  }, [extractedFields]);

  // Initialize expanded categories
  useEffect(() => {
    if (expandedCategories.size === 0) {
      setExpandedCategories(new Set(categories));
    }
  }, [categories]);

  const getStatusColor = (status: ExtractionResult['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'pending': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      case 'manual_review': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  };

  const handleFieldSelect = (fieldId: string, selected: boolean) => {
    const newSelection = new Set(selectedFields);
    if (selected) {
      newSelection.add(fieldId);
    } else {
      newSelection.delete(fieldId);
    }
    setSelectedFields(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedFields.size === filteredFields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(filteredFields.map(f => f.id)));
    }
  };

  const handleEditField = (field: ExtractedField) => {
    setEditingField(field.id);
    setEditValue(field.value?.toString() || '');
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const handleSaveEdit = (fieldId: string) => {
    const field = extractedFields.find(f => f.id === fieldId);
    if (field && onFieldUpdate) {
      let parsedValue = editValue;
      
      // Validate and parse based on field type
      if (field.type === 'number') {
        const num = parseFloat(editValue);
        if (isNaN(num)) {
          alert('Invalid number format');
          return;
        }
        parsedValue = num;
      } else if (field.type === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(editValue)) {
          alert('Invalid date format. Use YYYY-MM-DD');
          return;
        }
      }
      
      onFieldUpdate(fieldId, parsedValue);
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, fieldId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(fieldId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = filteredFields.findIndex(f => f.id === fieldId);
      if (currentIndex !== -1) {
        const nextIndex = e.key === 'ArrowDown' 
          ? Math.min(currentIndex + 1, filteredFields.length - 1)
          : Math.max(currentIndex - 1, 0);
        const nextField = document.getElementById(`field-${filteredFields[nextIndex].id}`);
        nextField?.focus();
      }
    }
  };

  const handleUseSuggestion = (fieldId: string, suggestion: string) => {
    if (onFieldUpdate) {
      onFieldUpdate(fieldId, suggestion);
    }
    setShowSuggestions(null);
  };

  const handleApproveSelected = () => {
    if (onApprove && selectedFields.size > 0) {
      onApprove(Array.from(selectedFields));
      setSelectedFields(new Set());
    }
  };

  const handleRejectSelected = () => {
    if (onReject && selectedFields.size > 0) {
      onReject(Array.from(selectedFields));
      setSelectedFields(new Set());
    }
  };

  const handleExport = (format: string) => {
    if (onExport) {
      onExport(format, extractionResult);
    }
    setShowExportMenu(false);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setConfidenceFilter('all');
    setCategoryFilter('all');
    setShowOnlyRequired(false);
  };

  const getCardSizeClasses = () => {
    switch (cardSize) {
      case 'small': return 'p-2 text-sm';
      case 'large': return 'p-6 text-lg';
      default: return 'p-4';
    }
  };

  if (status === 'processing') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ClockIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Processing extraction...</p>
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Extraction results" className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900 mr-4">{extractionResult.documentName}</h1>
            <div
              data-testid="status-indicator"
              className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}
              title={status}
            />
            <span className="ml-2 text-sm text-gray-600 capitalize">{status}</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Overall Confidence: <span className={getConfidenceColor(confidence)}>{Math.round(confidence * 100)}%</span>
            </span>
            <span className="text-sm text-gray-600">
              Processing Time: {processingTime}s
            </span>
            <span className="text-sm text-gray-600">
              {filteredFields.length} fields extracted
            </span>
          </div>
        </div>

        {/* Warnings and Errors */}
        {warnings && warnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
              <span className="text-sm font-medium text-yellow-800">
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="mt-2 text-sm text-yellow-700">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {errors && errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400">
            <div className="flex items-center">
              <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-sm font-medium text-red-800">
                {errors.length} error{errors.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="mt-2 text-sm text-red-700">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-50 border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fields..."
                aria-label="Search fields"
                role="searchbox"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
              aria-label="Filter by confidence"
              role="combobox"
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Confidence</option>
              <option value="high">High (90%+)</option>
              <option value="medium">Medium (70-89%)</option>
              <option value="low">Low (&lt;70%)</option>
            </select>

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

            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showOnlyRequired}
                onChange={(e) => setShowOnlyRequired(e.target.checked)}
                aria-label="Show only required"
                className="mr-2"
              />
              Show only required
            </label>

            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
              aria-label="Clear filters"
            >
              Clear filters
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode */}
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              aria-label="List view"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              aria-label="Grid view"
            >
              <Squares2X2Icon className="h-5 w-5" />
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

        {/* Bulk Actions */}
        {selectedFields.size > 0 && (
          <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
            <span className="text-sm text-blue-800">
              {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              {onApprove && (
                <button
                  onClick={handleApproveSelected}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  aria-label="Approve selected"
                >
                  Approve Selected
                </button>
              )}
              {onReject && (
                <button
                  onClick={handleRejectSelected}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  aria-label="Reject selected"
                >
                  Reject Selected
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
            aria-label="Select all"
          >
            {selectedFields.size === filteredFields.length ? 'Deselect All' : 'Select All'}
          </button>

          <div className="flex items-center space-x-2">
            {onExport && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                  aria-label="Export results"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 inline mr-1" />
                  Export Results
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
                    <button
                      onClick={() => handleExport('json')}
                      role="menuitem"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      role="menuitem"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      role="menuitem"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                    >
                      Export as Excel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex space-x-6">
          {/* Extracted Fields */}
          <div role="group" aria-label="Extracted fields" className="flex-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Extracted Fields</h2>
            
            {Object.entries(fieldsByCategory).map(([category, fields]) => {
              const categoryFields = fields.filter(field => filteredFields.includes(field));
              if (categoryFields.length === 0) return null;
              
              const isExpanded = expandedCategories.has(category);
              
              return (
                <div key={category} className="mb-6">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center w-full text-left mb-3 font-medium text-gray-700 hover:text-gray-900"
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="h-5 w-5 mr-2" />
                    ) : (
                      <ChevronUpIcon className="h-5 w-5 mr-2" />
                    )}
                    {category} ({categoryFields.length})
                  </button>
                  
                  {isExpanded && (
                    <div
                      data-testid={viewMode === 'grid' ? 'fields-grid' : 'fields-list'}
                      className={
                        viewMode === 'grid'
                          ? 'grid grid-cols-3 gap-4'
                          : 'space-y-2'
                      }
                    >
                      {categoryFields.map(field => (
                        <div
                          key={field.id}
                          id={`field-${field.id}`}
                          data-testid={`field-${field.id}`}
                          tabIndex={0}
                          onKeyDown={(e) => handleKeyDown(e, field.id)}
                          onMouseEnter={() => setHoveredField(field.id)}
                          onMouseLeave={() => setHoveredField(null)}
                          className={`border rounded-lg ${getCardSizeClasses()} hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 relative`}
                          aria-label={`${field.name}, ${field.value}, ${Math.round(field.confidence * 100)}% confidence${field.required ? ', required' : ''}`}
                          aria-describedby={field.required ? `${field.id}-required` : undefined}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-1">
                                <input
                                  type="checkbox"
                                  checked={selectedFields.has(field.id)}
                                  onChange={(e) => handleFieldSelect(field.id, e.target.checked)}
                                  aria-label="Select field"
                                  className="mr-2"
                                />
                                <span className="font-medium text-gray-900">
                                  {field.name}
                                  {field.required && <span className="text-red-500 ml-1">*</span>}
                                </span>
                                <span className="ml-2 px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                  {field.type}
                                </span>
                              </div>
                              
                              {editingField === field.id ? (
                                <div className="flex items-center space-x-2 mt-2">
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, field.id)}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  />
                                  <button
                                    onClick={() => handleSaveEdit(field.id)}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    aria-label="Save"
                                  >
                                    <CheckIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="text-gray-700 mt-1">
                                  {field.value?.toString() || 'N/A'}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-1 ml-2">
                              <span
                                data-testid={`confidence-${field.id}`}
                                className={`text-sm font-medium ${getConfidenceColor(field.confidence)}`}
                              >
                                {Math.round(field.confidence * 100)}%
                              </span>
                              
                              {field.suggestions && field.suggestions.length > 0 && (
                                <div className="relative">
                                  <button
                                    onClick={() => setShowSuggestions(showSuggestions === field.id ? null : field.id)}
                                    className="text-blue-600 hover:text-blue-700 text-xs"
                                    aria-label="View suggestions"
                                  >
                                    suggestions available
                                  </button>
                                  {showSuggestions === field.id && (
                                    <div className="absolute right-0 top-6 bg-white border rounded shadow-lg z-10 min-w-48">
                                      <div className="p-2 text-xs text-gray-600 border-b">Suggestions:</div>
                                      {field.suggestions.map((suggestion, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => handleUseSuggestion(field.id, suggestion)}
                                          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                          aria-label={`Use suggestion: ${suggestion}`}
                                        >
                                          {suggestion}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <button
                                onClick={() => handleEditField(field)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                aria-label="Edit field"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              
                              {onNavigateToSource && (
                                <button
                                  onClick={() => onNavigateToSource({
                                    page: field.source.page,
                                    coordinates: field.source.coordinates,
                                  })}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  aria-label="Go to source"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Tooltip */}
                          {hoveredField === field.id && (
                            <div className="absolute bottom-full left-0 mb-2 p-2 bg-black text-white text-xs rounded shadow-lg z-20 whitespace-nowrap">
                              Page {field.source.page} • Coordinates: {field.source.coordinates.x}, {field.source.coordinates.y}
                              <br />
                              Original: {field.source.originalText}
                            </div>
                          )}
                          
                          {field.required && (
                            <div id={`${field.id}-required`} className="sr-only">This field is required</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Entities */}
          <div role="group" aria-label="Entities" className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Entities</h2>
            
            {Object.entries(entitiesByType).map(([type, typeEntities]) => (
              <div key={type} className="mb-4">
                <h3 className="text-md font-medium text-gray-700 mb-2">{type}</h3>
                <div className="space-y-2">
                  {typeEntities.map(entity => (
                    <div
                      key={entity.id}
                      data-testid={`entity-${entity.id}`}
                      className="p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{entity.text}</span>
                        <span className="text-sm text-gray-600">
                          {Math.round(entity.confidence * 100)}%
                        </span>
                      </div>
                      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
                        <div className="mt-1 text-sm text-gray-600">
                          {Object.entries(entity.metadata).map(([key, value]) => (
                            <span key={key} className="mr-2">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};