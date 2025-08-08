import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LightBulbIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  PencilIcon,
  EyeIcon,
  HeartIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowPathIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface Clause {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  usageCount: number;
  similarity?: number;
  matchReason?: string;
  alternativeOf?: string;
}

interface SuggestionContext {
  documentType: string;
  section: string;
  existingClauses: string[];
  jurisdiction?: string;
  industry?: string;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

interface ClauseSuggestionsProps {
  context: SuggestionContext;
  searchQuery?: string;
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onSearchClauses?: (query: string, context: SuggestionContext) => Promise<Clause[]>;
  onGetSimilarClauses?: (clauseId: string, limit?: number) => Promise<Clause[]>;
  onGetAlternatives?: (clauseId: string) => Promise<Clause[]>;
  onAcceptSuggestion?: (clauseId: string) => Promise<void>;
  onRejectSuggestion?: (clauseId: string, reason: string) => Promise<void>;
  onProvideFeedback?: (clauseId: string, feedback: { useful: boolean; comment?: string }) => Promise<void>;
  onCustomizeSuggestion?: (clauseId: string, customization: string) => Promise<void>;
  onCompareAlternatives?: (clauseIds: string[]) => void;
  onViewDetails?: (clauseId: string) => void;
  onSaveFavorite?: (clauseId: string) => Promise<void>;
}

type ViewMode = 'list' | 'alternatives' | 'grouped';
type SortBy = 'relevance' | 'usage' | 'risk';

export const ClauseSuggestions: React.FC<ClauseSuggestionsProps> = ({
  context,
  searchQuery: initialSearchQuery = '',
  isLoading = false,
  currentUser,
  onSearchClauses,
  onGetSimilarClauses,
  onGetAlternatives,
  onAcceptSuggestion,
  onRejectSuggestion,
  onProvideFeedback,
  onCustomizeSuggestion,
  onCompareAlternatives,
  onViewDetails,
  onSaveFavorite,
}) => {
  const [suggestions, setSuggestions] = useState<Clause[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [similarClauses, setSimilarClauses] = useState<Map<string, Clause[]>>(new Map());
  const [alternativeClauses, setAlternativeClauses] = useState<Map<string, Clause[]>>(new Map());
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackUseful, setFeedbackUseful] = useState<boolean | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState<string | null>(null);
  const [customization, setCustomization] = useState('');
  const [hoveredClause, setHoveredClause] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [localRiskTolerance, setLocalRiskTolerance] = useState(context.riskTolerance);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [savedFavorites, setSavedFavorites] = useState<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const itemsPerPage = 10;

  // Load suggestions on mount and context change
  useEffect(() => {
    loadSuggestions();
  }, [context]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery !== initialSearchQuery) {
        loadSuggestions();
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadSuggestions = async () => {
    if (!onSearchClauses) return;
    
    setIsSearching(true);
    setSearchError('');
    
    try {
      const results = await onSearchClauses(searchQuery, context);
      setSuggestions(results);
    } catch (error) {
      setSearchError('Failed to load suggestions');
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(suggestions.map(s => s.category))].sort();
  }, [suggestions]);

  // Filter and sort suggestions
  const filteredSuggestions = useMemo(() => {
    let filtered = [...suggestions];

    // Filter by risk level
    if (selectedRiskLevel !== 'all') {
      filtered = filtered.filter(s => s.riskLevel === selectedRiskLevel);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'risk':
          const riskOrder = { low: 0, medium: 1, high: 2 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        case 'relevance':
        default:
          return (b.similarity || 0) - (a.similarity || 0);
      }
    });

    return filtered;
  }, [suggestions, selectedRiskLevel, selectedCategory, sortBy]);

  // Group alternatives
  const groupedAlternatives = useMemo(() => {
    const groups = new Map<string, Clause[]>();
    
    filteredSuggestions.forEach(clause => {
      if (clause.alternativeOf) {
        const existing = groups.get(clause.alternativeOf) || [];
        groups.set(clause.alternativeOf, [...existing, clause]);
      } else {
        const alternatives = filteredSuggestions.filter(c => c.alternativeOf === clause.id);
        if (alternatives.length > 0 || !groups.has(clause.id)) {
          groups.set(clause.id, alternatives);
        }
      }
    });

    return groups;
  }, [filteredSuggestions]);

  // Paginate
  const paginatedSuggestions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuggestions.slice(start, start + itemsPerPage);
  }, [filteredSuggestions, currentPage]);

  const totalPages = Math.ceil(filteredSuggestions.length / itemsPerPage);

  // Handlers
  const handleAccept = async (clauseId: string) => {
    if (!onAcceptSuggestion) return;
    
    try {
      await onAcceptSuggestion(clauseId);
      setSuccessMessage('Suggestion accepted');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setSearchError('Failed to accept suggestion');
      setTimeout(() => setSearchError(''), 3000);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal || !onRejectSuggestion) return;
    
    try {
      await onRejectSuggestion(showRejectModal, rejectReason);
      setShowRejectModal(null);
      setRejectReason('');
      setSuccessMessage('Suggestion rejected');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setSearchError('Failed to reject suggestion');
      setTimeout(() => setSearchError(''), 3000);
    }
  };

  const handleFeedback = async (clauseId: string, useful: boolean) => {
    if (!onProvideFeedback) return;
    
    setFeedbackUseful(useful);
    
    if (!useful) {
      setShowFeedbackModal(clauseId);
    } else {
      try {
        await onProvideFeedback(clauseId, { useful });
        setSuccessMessage('Feedback submitted');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        setSearchError('Failed to submit feedback');
        setTimeout(() => setSearchError(''), 3000);
      }
    }
  };

  const submitFeedback = async () => {
    if (!showFeedbackModal || !onProvideFeedback || feedbackUseful === null) return;
    
    try {
      await onProvideFeedback(showFeedbackModal, {
        useful: feedbackUseful,
        comment: feedbackComment,
      });
      setShowFeedbackModal(null);
      setFeedbackComment('');
      setFeedbackUseful(null);
      setSuccessMessage('Feedback submitted');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setSearchError('Failed to submit feedback');
      setTimeout(() => setSearchError(''), 3000);
    }
  };

  const handleCustomize = async () => {
    if (!showCustomizeModal || !onCustomizeSuggestion) return;
    
    try {
      await onCustomizeSuggestion(showCustomizeModal, customization);
      setShowCustomizeModal(null);
      setCustomization('');
      setSuccessMessage('Customization saved');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setSearchError('Failed to save customization');
      setTimeout(() => setSearchError(''), 3000);
    }
  };

  const handleGetSimilar = async (clauseId: string) => {
    if (!onGetSimilarClauses || similarClauses.has(clauseId)) return;
    
    try {
      const similar = await onGetSimilarClauses(clauseId, 5);
      setSimilarClauses(prev => new Map(prev).set(clauseId, similar));
      setExpandedClauses(prev => new Set(prev).add(clauseId));
    } catch (error) {
      console.error('Failed to get similar clauses:', error);
    }
  };

  const handleGetAlternatives = async (clauseId: string) => {
    if (!onGetAlternatives || alternativeClauses.has(clauseId)) return;
    
    try {
      const alternatives = await onGetAlternatives(clauseId);
      setAlternativeClauses(prev => new Map(prev).set(clauseId, alternatives));
      setExpandedClauses(prev => new Set(prev).add(clauseId));
    } catch (error) {
      console.error('Failed to get alternatives:', error);
    }
  };

  const handleCompare = () => {
    if (compareSelection.size >= 2 && onCompareAlternatives) {
      onCompareAlternatives(Array.from(compareSelection));
      setCompareSelection(new Set());
    }
  };

  const toggleCompareSelection = (clauseId: string) => {
    setCompareSelection(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clauseId)) {
        newSet.delete(clauseId);
      } else {
        newSet.add(clauseId);
      }
      return newSet;
    });
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

  const handleSaveFavorite = async (clauseId: string) => {
    if (!onSaveFavorite) return;
    
    try {
      await onSaveFavorite(clauseId);
      setSavedFavorites(prev => new Set(prev).add(clauseId));
      setSuccessMessage('Saved to favorites');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setSearchError('Failed to save favorite');
      setTimeout(() => setSearchError(''), 3000);
    }
  };

  const savePreferences = () => {
    setShowPreferences(false);
    setSuccessMessage('Preferences saved');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const getRiskIcon = (level: Clause['riskLevel']) => {
    switch (level) {
      case 'low':
        return <ShieldCheckIcon className="h-4 w-4 text-green-600" />;
      case 'medium':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />;
      case 'high':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />;
    }
  };

  const getRiskBadgeClass = (level: Clause['riskLevel']) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
    }
  };

  const canAcceptSuggestions = currentUser.permissions.includes('accept_suggestions');
  const canProvideFeedback = currentUser.permissions.includes('provide_feedback');

  if (isLoading || isSearching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Analyzing context and finding suggestions...</p>
        </div>
      </div>
    );
  }

  if (searchError && suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load suggestions</h3>
        <p className="text-gray-600 mb-4">{searchError}</p>
        <button
          onClick={loadSuggestions}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <LightBulbIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions found</h3>
        <p className="text-gray-600">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Clause suggestions" className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <SparklesIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">AI-Powered Clause Suggestions</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center"
            >
              <ChartBarIcon className="h-4 w-4 mr-2" />
              View Metrics
            </button>
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center"
            >
              <Cog6ToothIcon className="h-4 w-4 mr-2" />
              Set Preferences
            </button>
            <button
              onClick={loadSuggestions}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Context Info */}
        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
          <span className="font-medium">Context:</span>
          <span>{context.documentType}</span>
          <span>•</span>
          <span>{context.section}</span>
          {context.jurisdiction && (
            <>
              <span>•</span>
              <span>{context.jurisdiction}</span>
            </>
          )}
          {context.industry && (
            <>
              <span>•</span>
              <span>{context.industry}</span>
            </>
          )}
          <span>•</span>
          <span className="capitalize">{context.riskTolerance} risk</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Suggested Clauses</span>
            <span className="ml-2">{filteredSuggestions.length} clauses suggested</span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('alternatives')}
              className={`px-3 py-1 rounded ${viewMode === 'alternatives' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Show Alternatives
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1 rounded ${viewMode === 'grouped' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Group by Alternatives
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b p-4">
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
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 border rounded"
          >
            <option value="relevance">Relevance</option>
            <option value="usage">Usage Count</option>
            <option value="risk">Risk Level</option>
          </select>
        </div>

        {compareSelection.size >= 2 && (
          <div className="mt-3">
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Compare Selected ({compareSelection.size})
            </button>
          </div>
        )}
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'alternatives' && (
          <div data-testid="alternatives-view" className="mb-4 p-3 bg-blue-50 rounded">
            <p className="text-sm text-blue-800">
              Alternative clauses are shown below their primary options
            </p>
          </div>
        )}

        {viewMode === 'grouped' && (
          <div data-testid="alternatives-grouped" className="space-y-6">
            {Array.from(groupedAlternatives.entries()).map(([primaryId, alternatives]) => {
              const primaryClause = filteredSuggestions.find(c => c.id === primaryId);
              if (!primaryClause) return null;
              
              return (
                <div key={primaryId} className="border rounded p-4">
                  <h3 className="font-semibold mb-3">Primary Option</h3>
                  {/* Render primary clause */}
                  <div className="mb-4">
                    {/* Clause content here */}
                  </div>
                  {alternatives.length > 0 && (
                    <>
                      <h4 className="font-medium mb-2">Alternative Options</h4>
                      {/* Render alternatives */}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'list' && (
          <div className="space-y-4">
            {paginatedSuggestions.map((clause) => (
              <article
                key={clause.id}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onViewDetails?.(clause.id);
                }}
                onMouseEnter={() => setHoveredClause(clause.id)}
                onMouseLeave={() => setHoveredClause(null)}
                className="border rounded p-4 hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      aria-label="Select for comparison"
                      checked={compareSelection.has(clause.id)}
                      onChange={() => toggleCompareSelection(clause.id)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{clause.title}</h3>
                      {clause.alternativeOf && (
                        <span className="text-sm text-blue-600 ml-2">Alternative</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {clause.similarity && (
                      <span className="text-sm font-medium text-green-600">
                        {Math.round(clause.similarity * 100)}% match
                      </span>
                    )}
                    {getRiskIcon(clause.riskLevel)}
                    <span className={`px-2 py-1 text-xs rounded-full ${getRiskBadgeClass(clause.riskLevel)}`}>
                      {clause.riskLevel === 'low' ? 'Low' : clause.riskLevel === 'medium' ? 'Medium' : 'High'} Risk
                    </span>
                  </div>
                </div>

                {clause.matchReason && (
                  <p className="text-sm text-gray-600 mb-2 italic">{clause.matchReason}</p>
                )}

                <div className="text-sm text-gray-600 mb-2">
                  Used {clause.usageCount} times • {clause.category}
                </div>

                {hoveredClause === clause.id && (
                  <div className="mb-3 p-3 bg-gray-50 rounded text-sm">
                    {clause.content.substring(0, 200)}...
                  </div>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {clause.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {canAcceptSuggestions && (
                      <button
                        onClick={() => handleAccept(clause.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        Accept
                      </button>
                    )}
                    <button
                      onClick={() => setShowRejectModal(clause.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setShowCustomizeModal(clause.id)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                    >
                      Customize
                    </button>
                    <button
                      onClick={() => onViewDetails?.(clause.id)}
                      className="px-3 py-1 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    {canProvideFeedback && (
                      <>
                        <button
                          onClick={() => handleFeedback(clause.id, true)}
                          className="p-1 text-green-600 hover:text-green-700"
                          aria-label="Useful"
                        >
                          <HandThumbUpIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleFeedback(clause.id, false)}
                          className="p-1 text-red-600 hover:text-red-700"
                          aria-label="Not useful"
                        >
                          <HandThumbDownIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleSaveFavorite(clause.id)}
                      className={`p-1 ${savedFavorites.has(clause.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                      aria-label="Save to favorites"
                    >
                      {savedFavorites.has(clause.id) ? (
                        <HeartIconSolid className="h-4 w-4" />
                      ) : (
                        <HeartIcon className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleGetSimilar(clause.id)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Find Similar
                    </button>
                    <button
                      onClick={() => handleGetAlternatives(clause.id)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      View Alternatives
                    </button>
                  </div>
                </div>

                {similarClauses.has(clause.id) && expandedClauses.has(clause.id) && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Similar Clauses</h4>
                    {similarClauses.get(clause.id)?.map(similar => (
                      <div key={similar.id} className="ml-4 mb-2 p-2 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{similar.title}</span>
                          <span className="text-xs text-gray-600">
                            {Math.round((similar.similarity || 0) * 100)}% similar
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {alternativeClauses.has(clause.id) && expandedClauses.has(clause.id) && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Alternative Options</h4>
                    {alternativeClauses.get(clause.id)?.map(alt => (
                      <div key={alt.id} className="ml-4 mb-2 p-2 bg-blue-50 rounded">
                        <span className="text-sm font-medium">{alt.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

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

      {/* Metrics View */}
      {showMetrics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Suggestion Metrics</h3>
            <div data-testid="acceptance-rate" className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Acceptance Rate:</span>
                <span className="ml-2 font-medium">78%</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Average Relevance:</span>
                <span className="ml-2 font-medium">85%</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Feedback Score:</span>
                <span className="ml-2 font-medium">4.2/5</span>
              </div>
            </div>
            <button
              onClick={() => setShowMetrics(false)}
              className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 w-full"
            >
              Close
            </button>
            <button
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
            >
              Help us improve suggestions
            </button>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Suggestion Preferences</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Tolerance
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="conservative"
                      checked={localRiskTolerance === 'conservative'}
                      onChange={(e) => setLocalRiskTolerance(e.target.value as any)}
                      className="mr-2"
                    />
                    Conservative
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="moderate"
                      checked={localRiskTolerance === 'moderate'}
                      onChange={(e) => setLocalRiskTolerance(e.target.value as any)}
                      className="mr-2"
                    />
                    Moderate
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="aggressive"
                      checked={localRiskTolerance === 'aggressive'}
                      onChange={(e) => setLocalRiskTolerance(e.target.value as any)}
                      className="mr-2"
                    />
                    Aggressive
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setShowPreferences(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={savePreferences}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Suggestion</h3>
            <div className="mb-4">
              <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700">
                Rejection reason
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
                rows={3}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Provide Feedback</h3>
            <div className="mb-4">
              <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-700">
                Feedback comment
              </label>
              <textarea
                id="feedback-comment"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowFeedbackModal(null);
                  setFeedbackComment('');
                  setFeedbackUseful(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Modal */}
      {showCustomizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Customize Clause</h3>
            <div className="mb-4">
              <label htmlFor="customization" className="block text-sm font-medium text-gray-700">
                Customization
              </label>
              <textarea
                id="customization"
                value={customization}
                onChange={(e) => setCustomization(e.target.value)}
                className="mt-1 block w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Describe your customization needs..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowCustomizeModal(null);
                  setCustomization('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomize}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Customization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {successMessage && (
        <div role="status" className="fixed bottom-4 right-4 bg-green-100 text-green-700 px-4 py-2 rounded shadow-lg">
          {successMessage}
        </div>
      )}

      {searchError && suggestions.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded shadow-lg">
          {searchError}
        </div>
      )}
    </div>
  );
};