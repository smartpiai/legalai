import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  CheckIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  ArrowsRightLeftIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

interface Document {
  id: string;
  name: string;
  version: string;
  content: string;
  metadata: {
    createdAt: string;
    modifiedAt: string;
    author: string;
    size: number;
    pages: number;
  };
  sections?: Section[];
}

interface Section {
  id: string;
  title: string;
  content: string;
  type: 'clause' | 'paragraph' | 'heading';
  position: number;
}

interface Difference {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  leftContent?: string;
  rightContent?: string;
  leftLine?: number;
  rightLine?: number;
  section?: string;
  significance: 'low' | 'medium' | 'high' | 'critical';
  comments?: Comment[];
}

interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

interface ComparisonViewProps {
  leftDocument: Document;
  rightDocument: Document;
  differences?: Difference[] | null;
  isCalculating?: boolean;
  initialDifference?: number;
  syncScroll?: boolean;
  enableComments?: boolean;
  onAcceptChange?: (changeId: string | string[]) => void;
  onRejectChange?: (changeId: string | string[]) => void;
  onExport?: (format: string, data: any) => void;
  onMerge?: (selectedChanges: string[]) => void;
}

type ViewMode = 'side-by-side' | 'unified' | 'inline';
type FilterType = 'all' | 'additions' | 'deletions' | 'modifications';
type SignificanceFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  leftDocument,
  rightDocument,
  differences = [],
  isCalculating = false,
  initialDifference = 1,
  syncScroll: initialSyncScroll = true,
  enableComments = false,
  onAcceptChange,
  onRejectChange,
  onExport,
  onMerge,
}) => {
  const [currentDifference, setCurrentDifference] = useState(initialDifference);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [syncScroll, setSyncScroll] = useState(initialSyncScroll);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [significanceFilter, setSignificanceFilter] = useState<SignificanceFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number>(0);
  const [currentMatch, setCurrentMatch] = useState(1);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showAcceptAllDialog, setShowAcceptAllDialog] = useState(false);
  const [showRejectAllDialog, setShowRejectAllDialog] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [newComment, setNewComment] = useState<{ diffId: string; text: string } | null>(null);
  const [localComments, setLocalComments] = useState<Record<string, Comment[]>>({});

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const differenceRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Filter differences
  const filteredDifferences = useMemo(() => {
    if (!differences) return [];
    
    return differences.filter(diff => {
      if (filterType !== 'all' && diff.type !== filterType.slice(0, -1)) return false;
      if (significanceFilter !== 'all' && diff.significance !== significanceFilter) return false;
      if (sectionFilter !== 'all' && diff.section !== sectionFilter) return false;
      if (searchQuery && !((diff.leftContent?.includes(searchQuery) || diff.rightContent?.includes(searchQuery)))) return false;
      return true;
    });
  }, [differences, filterType, significanceFilter, sectionFilter, searchQuery]);

  // Count differences by type
  const differenceCounts = useMemo(() => {
    if (!differences) return { additions: 0, deletions: 0, modifications: 0 };
    
    return differences.reduce((acc, diff) => {
      acc[diff.type + 's' as keyof typeof acc]++;
      return acc;
    }, { additions: 0, deletions: 0, modifications: 0 });
  }, [differences]);

  // Get unique sections
  const sections = useMemo(() => {
    if (!differences) return [];
    const uniqueSections = new Set(differences.map(d => d.section).filter(Boolean));
    return Array.from(uniqueSections);
  }, [differences]);

  // Handle synchronized scrolling
  useEffect(() => {
    if (!syncScroll || viewMode !== 'side-by-side') return;

    const handleScroll = (source: 'left' | 'right') => (e: Event) => {
      const target = e.target as HTMLElement;
      const other = source === 'left' ? rightPaneRef.current : leftPaneRef.current;
      
      if (other && Math.abs(other.scrollTop - target.scrollTop) > 1) {
        other.scrollTop = target.scrollTop;
      }
    };

    const leftHandler = handleScroll('left');
    const rightHandler = handleScroll('right');

    leftPaneRef.current?.addEventListener('scroll', leftHandler);
    rightPaneRef.current?.addEventListener('scroll', rightHandler);

    return () => {
      leftPaneRef.current?.removeEventListener('scroll', leftHandler);
      rightPaneRef.current?.removeEventListener('scroll', rightHandler);
    };
  }, [syncScroll, viewMode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === 'n') {
          e.preventDefault();
          navigateToNextDifference();
        } else if (e.key === 'p') {
          e.preventDefault();
          navigateToPreviousDifference();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentDifference, filteredDifferences]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery) {
      setSearchMatches(0);
      return;
    }

    const leftMatches = (leftDocument.content.match(new RegExp(searchQuery, 'gi')) || []).length;
    const rightMatches = (rightDocument.content.match(new RegExp(searchQuery, 'gi')) || []).length;
    setSearchMatches(leftMatches + rightMatches);
  }, [searchQuery, leftDocument, rightDocument]);

  const navigateToNextDifference = () => {
    if (currentDifference < filteredDifferences.length) {
      setCurrentDifference(currentDifference + 1);
      scrollToDifference(filteredDifferences[currentDifference].id);
    }
  };

  const navigateToPreviousDifference = () => {
    if (currentDifference > 1) {
      setCurrentDifference(currentDifference - 1);
      scrollToDifference(filteredDifferences[currentDifference - 2].id);
    }
  };

  const scrollToDifference = (diffId: string) => {
    const element = differenceRefs.current.get(diffId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus();
  };

  const jumpToDifference = (index: number) => {
    setCurrentDifference(index + 1);
    scrollToDifference(filteredDifferences[index].id);
  };

  const handleAcceptChange = (changeId: string) => {
    onAcceptChange?.(changeId);
  };

  const handleRejectChange = (changeId: string) => {
    onRejectChange?.(changeId);
  };

  const handleAcceptAll = () => {
    const allIds = filteredDifferences.map(d => d.id);
    onAcceptChange?.(allIds);
    setShowAcceptAllDialog(false);
  };

  const handleRejectAll = () => {
    const allIds = filteredDifferences.map(d => d.id);
    onRejectChange?.(allIds);
    setShowRejectAllDialog(false);
  };

  const handleExport = (format: string) => {
    onExport?.(format, {
      leftDocument,
      rightDocument,
      differences: filteredDifferences,
      metadata: {
        comparisonDate: new Date().toISOString(),
        totalDifferences: filteredDifferences.length,
        ...differenceCounts,
      },
    });
    setShowExportMenu(false);
  };

  const toggleMergeSelection = (diffId: string) => {
    const newSelection = new Set(selectedForMerge);
    if (newSelection.has(diffId)) {
      newSelection.delete(diffId);
    } else {
      newSelection.add(diffId);
    }
    setSelectedForMerge(newSelection);
  };

  const finishMerge = () => {
    onMerge?.(Array.from(selectedForMerge));
    setMergeMode(false);
    setSelectedForMerge(new Set());
  };

  const addComment = (diffId: string, text: string) => {
    const comment: Comment = {
      id: Date.now().toString(),
      text,
      author: 'Current User',
      timestamp: new Date().toISOString(),
    };
    
    setLocalComments(prev => ({
      ...prev,
      [diffId]: [...(prev[diffId] || []), comment],
    }));
    setNewComment(null);
  };

  const getDiffClass = (type: Difference['type']) => {
    switch (type) {
      case 'addition': return 'diff-addition bg-green-100';
      case 'deletion': return 'diff-deletion bg-red-100';
      case 'modification': return 'diff-modification bg-yellow-100';
    }
  };

  const getDiffMarkerClass = (type: Difference['type']) => {
    switch (type) {
      case 'addition': return 'bg-green-500';
      case 'deletion': return 'bg-red-500';
      case 'modification': return 'bg-yellow-500';
    }
  };

  const getSignificanceLabel = (significance: Difference['significance']) => {
    return significance.charAt(0).toUpperCase() + significance.slice(1) + ' significance';
  };

  if (isCalculating && !differences) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Calculating differences...</p>
          <div role="progressbar" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Comparison view" className="h-full flex flex-col">
      {/* Toolbar */}
      <div role="toolbar" aria-label="Comparison controls" className="bg-gray-50 border-b p-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* View Mode */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            aria-label="View mode"
            role="combobox"
            className="px-3 py-1 border rounded"
          >
            <option value="side-by-side">Side by Side</option>
            <option value="unified">Unified</option>
            <option value="inline">Inline</option>
          </select>

          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={navigateToPreviousDifference}
              disabled={currentDifference === 1 || filteredDifferences.length === 0}
              aria-label="Previous difference"
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-sm">
              {filteredDifferences.length > 0 
                ? `Difference ${currentDifference} of ${filteredDifferences.length}`
                : 'No differences'}
            </span>
            <button
              onClick={navigateToNextDifference}
              disabled={currentDifference === filteredDifferences.length || filteredDifferences.length === 0}
              aria-label="Next difference"
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Sync Scroll */}
          {viewMode === 'side-by-side' && (
            <button
              onClick={() => setSyncScroll(!syncScroll)}
              aria-label="Toggle sync scroll"
              aria-pressed={syncScroll}
              className={`p-2 rounded ${syncScroll ? 'bg-blue-100' : 'hover:bg-gray-200'}`}
            >
              <ArrowsRightLeftIcon className="h-5 w-5" />
            </button>
          )}

          {/* Filters */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            aria-label="Filter by type"
            role="combobox"
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="all">All Types</option>
            <option value="additions">Additions</option>
            <option value="deletions">Deletions</option>
            <option value="modifications">Modifications</option>
          </select>

          <select
            value={significanceFilter}
            onChange={(e) => setSignificanceFilter(e.target.value as SignificanceFilter)}
            aria-label="Filter by significance"
            role="combobox"
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="all">All Significance</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {sections.length > 0 && (
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              aria-label="Filter by section"
              role="combobox"
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="all">All Sections</option>
              {sections.map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              setFilterType('all');
              setSignificanceFilter('all');
              setSectionFilter('all');
              setSearchQuery('');
            }}
            aria-label="Clear filters"
            className="px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
          >
            Clear filters
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Search */}
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search in comparison"
              role="searchbox"
              className="pl-8 pr-2 py-1 border rounded text-sm"
            />
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-2 top-1.5 text-gray-400" />
            {searchMatches > 0 && (
              <span className="ml-2 text-sm text-gray-600">
                {searchMatches} matches found
                {currentMatch > 0 && ` (Match ${currentMatch} of ${searchMatches})`}
              </span>
            )}
            {searchMatches > 1 && (
              <>
                <button
                  aria-label="Previous match"
                  className="ml-1 p-1 hover:bg-gray-200 rounded"
                  onClick={() => setCurrentMatch(Math.max(1, currentMatch - 1))}
                >
                  ←
                </button>
                <button
                  aria-label="Next match"
                  className="p-1 hover:bg-gray-200 rounded"
                  onClick={() => setCurrentMatch(Math.min(searchMatches, currentMatch + 1))}
                >
                  →
                </button>
              </>
            )}
          </div>

          {/* Actions */}
          {onAcceptChange && (
            <button
              onClick={() => setShowAcceptAllDialog(true)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Accept All
            </button>
          )}
          {onRejectChange && (
            <button
              onClick={() => setShowRejectAllDialog(true)}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reject All
            </button>
          )}
          {onMerge && (
            <button
              onClick={() => setMergeMode(!mergeMode)}
              className={`px-3 py-1 text-sm rounded ${
                mergeMode ? 'bg-purple-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {mergeMode ? 'Finish Merge' : 'Create Merged Version'}
            </button>
          )}
          {onExport && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-2 hover:bg-gray-200 rounded"
                aria-label="Export comparison"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
                  <button
                    onClick={() => handleExport('pdf')}
                    role="menuitem"
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleExport('word')}
                    role="menuitem"
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Export as Word
                  </button>
                  <button
                    onClick={() => handleExport('html')}
                    role="menuitem"
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Export as HTML
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-blue-50 px-4 py-2 text-sm flex items-center justify-between">
        <div>
          {filteredDifferences.length === differences?.length 
            ? `${differences.length} differences found`
            : `${filteredDifferences.length} ${filteredDifferences.length === 1 ? 'difference' : 'differences'} shown`}
          {differences && differences.length > 0 && (
            <span className="ml-4">
              {differenceCounts.additions > 0 && `${differenceCounts.additions} addition${differenceCounts.additions !== 1 ? 's' : ''} `}
              {differenceCounts.deletions > 0 && `${differenceCounts.deletions} deletion${differenceCounts.deletions !== 1 ? 's' : ''} `}
              {differenceCounts.modifications > 0 && `${differenceCounts.modifications} modification${differenceCounts.modifications !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        {mergeMode && (
          <div className="flex items-center space-x-2">
            <span>Merge mode active - {selectedForMerge.size} change{selectedForMerge.size !== 1 ? 's' : ''} selected</span>
            {selectedForMerge.size > 0 && (
              <button
                onClick={finishMerge}
                className="px-3 py-1 bg-purple-600 text-white rounded text-xs"
              >
                Finish Merge
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'side-by-side' ? (
          <div className="flex h-full">
            <div
              ref={leftPaneRef}
              role="region"
              aria-label="Left document"
              data-testid="left-document-pane"
              className="flex-1 overflow-auto p-4 border-r"
            >
              <h2 className="font-semibold mb-2">{leftDocument.name} (Version {leftDocument.version})</h2>
              <div className="text-sm text-gray-600 mb-4">
                {leftDocument.metadata.author} • {leftDocument.metadata.pages} pages
              </div>
              <div className="whitespace-pre-wrap">
                {renderContentWithDifferences(leftDocument.content, filteredDifferences, 'left')}
              </div>
            </div>
            <div
              ref={rightPaneRef}
              role="region"
              aria-label="Right document"
              data-testid="right-document-pane"
              className="flex-1 overflow-auto p-4"
            >
              <h2 className="font-semibold mb-2">{rightDocument.name} (Version {rightDocument.version})</h2>
              <div className="text-sm text-gray-600 mb-4">
                {rightDocument.metadata.author} • {rightDocument.metadata.pages} pages
              </div>
              <div className="whitespace-pre-wrap">
                {renderContentWithDifferences(rightDocument.content, filteredDifferences, 'right')}
              </div>
            </div>
          </div>
        ) : viewMode === 'unified' ? (
          <div role="region" aria-label="Unified comparison" className="overflow-auto p-4">
            <h2 className="font-semibold mb-4">Unified View</h2>
            {renderUnifiedView()}
          </div>
        ) : (
          <div role="region" aria-label="Inline comparison" className="overflow-auto p-4">
            <h2 className="font-semibold mb-4">Inline View</h2>
            {renderInlineView()}
          </div>
        )}
      </div>

      {/* Difference List */}
      <nav aria-label="Difference navigation" className="border-t bg-gray-50 max-h-48 overflow-y-auto">
        <div className="p-2">
          {filteredDifferences.map((diff, index) => (
            <div
              key={diff.id}
              ref={el => el && differenceRefs.current.set(diff.id, el)}
              data-difference-id={diff.id}
              data-difference-active={index === currentDifference - 1}
              tabIndex={0}
              className={`flex items-center p-2 mb-1 rounded cursor-pointer hover:bg-gray-100 ${
                index === currentDifference - 1 ? 'bg-blue-100' : ''
              }`}
              onClick={() => jumpToDifference(index)}
            >
              <div
                data-testid={`diff-marker-${diff.id}`}
                className={`w-3 h-3 rounded-full mr-2 ${getDiffMarkerClass(diff.type)}`}
              />
              <span className="flex-1 text-sm">
                {diff.section && `${diff.section}: `}
                {diff.type === 'modification' && `${diff.leftContent} → ${diff.rightContent}`}
                {diff.type === 'addition' && diff.rightContent}
                {diff.type === 'deletion' && diff.leftContent}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                {getSignificanceLabel(diff.significance)}
              </span>
              {mergeMode && (
                <input
                  type="checkbox"
                  aria-label="Include in merge"
                  checked={selectedForMerge.has(diff.id)}
                  onChange={() => toggleMergeSelection(diff.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-2"
                />
              )}
              {onAcceptChange && !mergeMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptChange(diff.id);
                  }}
                  aria-label="Accept change"
                  className="ml-2 p-1 text-green-600 hover:bg-green-100 rounded"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
              )}
              {onRejectChange && !mergeMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectChange(diff.id);
                  }}
                  aria-label="Reject change"
                  className="ml-1 p-1 text-red-600 hover:bg-red-100 rounded"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
              {enableComments && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewComment({ diffId: diff.id, text: '' });
                  }}
                  aria-label="Add comment"
                  className="ml-1 p-1 text-gray-600 hover:bg-gray-100 rounded"
                >
                  <ChatBubbleLeftIcon className="h-4 w-4" />
                </button>
              )}
              <button
                aria-label={`Jump to difference ${index + 1}`}
                className="ml-2 text-xs text-blue-600 hover:text-blue-700"
              >
                Go →
              </button>
            </div>
          ))}
        </div>
      </nav>

      {/* Live Region for Accessibility */}
      <div role="status" aria-live="polite" className="sr-only">
        {filteredDifferences.length > 0 && 
          `Viewing difference ${currentDifference} of ${filteredDifferences.length}`}
      </div>

      {/* Dialogs */}
      {showAcceptAllDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Are you sure you want to accept all changes?</h3>
            <p className="mb-4">This will accept all {filteredDifferences.length} changes.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAcceptAllDialog(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700"
              >
                Confirm Accept All
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectAllDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Are you sure you want to reject all changes?</h3>
            <p className="mb-4">This will reject all {filteredDifferences.length} changes.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRejectAllDialog(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
              >
                Confirm Reject All
              </button>
            </div>
          </div>
        </div>
      )}

      {newComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Comment</h3>
            <textarea
              value={newComment.text}
              onChange={(e) => setNewComment({ ...newComment, text: e.target.value })}
              aria-label="Comment text"
              className="w-full p-2 border rounded mb-4"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setNewComment(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  addComment(newComment.diffId, newComment.text);
                }}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderContentWithDifferences(content: string, diffs: Difference[], side: 'left' | 'right') {
    return content.split('\n').map((line, index) => {
      const lineDiffs = diffs.filter(d => 
        (side === 'left' && d.leftLine === index + 1) ||
        (side === 'right' && d.rightLine === index + 1)
      );
      
      if (lineDiffs.length > 0) {
        return (
          <div key={index} className={getDiffClass(lineDiffs[0].type)}>
            {searchQuery && line.includes(searchQuery) ? (
              <span className="search-highlight bg-yellow-200">{line}</span>
            ) : (
              line
            )}
          </div>
        );
      }
      
      return (
        <div key={index}>
          {searchQuery && line.includes(searchQuery) ? (
            <span className="search-highlight bg-yellow-200">{line}</span>
          ) : (
            line
          )}
        </div>
      );
    });
  }

  function renderUnifiedView() {
    return filteredDifferences.map(diff => (
      <div key={diff.id} className={`mb-4 p-2 rounded ${getDiffClass(diff.type)}`}>
        <div className="flex items-center mb-2">
          <div className={`w-3 h-3 rounded-full mr-2 ${getDiffMarkerClass(diff.type)}`} />
          <span className="font-medium">{diff.type}</span>
          <span className="ml-2 text-sm text-gray-600">{diff.section}</span>
        </div>
        {diff.type === 'modification' && (
          <>
            <div className="line-through text-red-600">{diff.leftContent}</div>
            <div className="text-green-600">{diff.rightContent}</div>
          </>
        )}
        {diff.type === 'addition' && <div className="text-green-600">{diff.rightContent}</div>}
        {diff.type === 'deletion' && <div className="text-red-600 line-through">{diff.leftContent}</div>}
        {renderComments(diff)}
      </div>
    ));
  }

  function renderInlineView() {
    const lines = rightDocument.content.split('\n');
    return lines.map((line, index) => {
      const lineDiffs = filteredDifferences.filter(d => d.rightLine === index + 1);
      
      if (lineDiffs.length > 0) {
        return (
          <div key={index} className={`mb-2 p-2 rounded ${getDiffClass(lineDiffs[0].type)}`}>
            {line}
            {renderComments(lineDiffs[0])}
          </div>
        );
      }
      
      return <div key={index} className="mb-2">{line}</div>;
    });
  }

  function renderComments(diff: Difference) {
    const comments = [...(diff.comments || []), ...(localComments[diff.id] || [])];
    
    if (!enableComments || comments.length === 0) return null;
    
    return (
      <div className="mt-2 pl-4 border-l-2 border-gray-300">
        {comments.map(comment => (
          <div key={comment.id} className="mb-2 text-sm">
            <div className="font-medium">{comment.author}</div>
            <div className="text-gray-600">{comment.text}</div>
          </div>
        ))}
      </div>
    );
  }
};