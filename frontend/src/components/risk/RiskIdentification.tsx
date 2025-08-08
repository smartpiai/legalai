import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BellIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon as ExclamationTriangleSolid } from '@heroicons/react/24/solid';

interface RiskPattern {
  id: string;
  name: string;
  description: string;
  category: 'legal' | 'financial' | 'compliance' | 'operational' | 'reputational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: string;
  keywords: string[];
  active: boolean;
}

interface Risk {
  id: string;
  contractId: string;
  patternId: string;
  patternName: string;
  category: RiskPattern['category'];
  severity: RiskPattern['severity'];
  score: number;
  confidence: number;
  location: {
    page?: number;
    paragraph?: string;
    clause?: string;
    section?: string;
  };
  matchedText: string;
  context: string;
  suggestedMitigation?: string;
  status: 'new' | 'reviewed' | 'accepted' | 'mitigated' | 'false_positive';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
}

interface RiskIdentificationProps {
  contractId: string;
  contractContent?: string;
  risks?: Risk[];
  patterns?: RiskPattern[];
  isLoading?: boolean;
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  thresholds?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  onScanContract?: (contractId: string) => Promise<Risk[]>;
  onUpdateRiskStatus?: (riskId: string, status: Risk['status'], notes?: string) => Promise<void>;
  onCreatePattern?: (pattern: Omit<RiskPattern, 'id'>) => Promise<void>;
  onUpdatePattern?: (patternId: string, pattern: Partial<RiskPattern>) => Promise<void>;
  onDeletePattern?: (patternId: string) => Promise<void>;
  onUpdateThresholds?: (thresholds: RiskIdentificationProps['thresholds']) => Promise<void>;
  onExportRisks?: (format: 'json' | 'csv' | 'pdf') => Promise<void>;
  onGenerateAlert?: (risk: Risk) => Promise<void>;
}

type TabType = 'overview' | 'patterns' | 'trending' | 'settings';

export const RiskIdentification: React.FC<RiskIdentificationProps> = ({
  contractId,
  contractContent,
  risks = [],
  patterns = [],
  isLoading = false,
  currentUser,
  thresholds = { low: 30, medium: 50, high: 70, critical: 85 },
  onScanContract,
  onUpdateRiskStatus,
  onCreatePattern,
  onUpdatePattern,
  onDeletePattern,
  onUpdateThresholds,
  onExportRisks,
  onGenerateAlert,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [minScore, setMinScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [showStatusModal, setShowStatusModal] = useState<string | null>(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [newStatus, setNewStatus] = useState<Risk['status'] | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPatternForm, setShowPatternForm] = useState(false);
  const [editingPattern, setEditingPattern] = useState<RiskPattern | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [localThresholds, setLocalThresholds] = useState(thresholds);
  const [thresholdError, setThresholdError] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Calculate risk statistics
  const riskStats = useMemo(() => {
    const stats = {
      total: risks.length,
      critical: risks.filter(r => r.severity === 'critical').length,
      high: risks.filter(r => r.severity === 'high').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      low: risks.filter(r => r.severity === 'low').length,
      new: risks.filter(r => r.status === 'new').length,
      reviewed: risks.filter(r => r.status === 'reviewed').length,
    };
    return stats;
  }, [risks]);

  // Calculate category breakdown
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    risks.forEach(risk => {
      stats[risk.category] = (stats[risk.category] || 0) + 1;
    });
    return stats;
  }, [risks]);

  // Filter risks
  const filteredRisks = useMemo(() => {
    let filtered = [...risks];

    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(r => r.severity === selectedSeverity);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(r => r.status === selectedStatus);
    }

    if (minScore) {
      filtered = filtered.filter(r => r.score >= parseInt(minScore));
    }

    if (maxScore) {
      filtered = filtered.filter(r => r.score <= parseInt(maxScore));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.patternName.toLowerCase().includes(query) ||
        r.matchedText.toLowerCase().includes(query) ||
        r.context.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [risks, selectedSeverity, selectedCategory, selectedStatus, minScore, maxScore, searchQuery]);

  // Paginate risks
  const paginatedRisks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRisks.slice(start, start + itemsPerPage);
  }, [filteredRisks, currentPage]);

  const totalPages = Math.ceil(filteredRisks.length / itemsPerPage);

  // Handlers
  const handleScanContract = async () => {
    if (!onScanContract) return;
    
    setIsScanning(true);
    setScanError('');
    
    try {
      await onScanContract(contractId);
      setUpdateMessage('Contract scanned successfully');
      setTimeout(() => setUpdateMessage(''), 3000);
    } catch (error) {
      setScanError('Failed to scan contract');
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpdateStatus = async (riskId: string, status: Risk['status'], notes?: string) => {
    if (!onUpdateRiskStatus) return;
    
    try {
      await onUpdateRiskStatus(riskId, status, notes);
      setUpdateMessage('Risk status updated');
      setShowStatusModal(null);
      setStatusNotes('');
      setNewStatus(null);
      setTimeout(() => setUpdateMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleGenerateAlert = async (risk: Risk) => {
    if (!onGenerateAlert) return;
    
    try {
      await onGenerateAlert(risk);
      setUpdateMessage('Alert generated successfully');
      setTimeout(() => setUpdateMessage(''), 3000);
    } catch (error) {
      console.error('Failed to generate alert:', error);
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    if (!onExportRisks) return;
    
    try {
      await onExportRisks(format);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Failed to export risks:', error);
    }
  };

  const toggleRiskExpansion = (riskId: string) => {
    setExpandedRisks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(riskId)) {
        newSet.delete(riskId);
      } else {
        newSet.add(riskId);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setSelectedSeverity('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setMinScore('');
    setMaxScore('');
    setSearchQuery('');
  };

  const getSeverityColor = (severity: Risk['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: Risk['severity']) => {
    const className = 'h-5 w-5';
    switch (severity) {
      case 'critical':
      case 'high':
        return <ExclamationTriangleSolid className={`${className} text-red-600`} />;
      case 'medium':
        return <ExclamationTriangleIcon className={`${className} text-yellow-600`} />;
      case 'low':
        return <ShieldCheckIcon className={`${className} text-green-600`} />;
      default:
        return <InformationCircleIcon className={`${className} text-gray-600`} />;
    }
  };

  const formatLocation = (location: Risk['location']) => {
    const parts = [];
    if (location.page) parts.push(`Page ${location.page}`);
    if (location.section) parts.push(`Section ${location.section}`);
    if (location.clause) parts.push(`Clause ${location.clause}`);
    if (location.paragraph) parts.push(`Paragraph ${location.paragraph}`);
    return parts.join(', ') || 'Unknown location';
  };

  const canManagePatterns = currentUser.permissions.includes('manage_patterns');
  const canReviewRisks = currentUser.permissions.includes('review_risks');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div role="region" aria-label="Risk identification" className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Risk Identification</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleScanContract}
              disabled={isScanning}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isScanning ? (
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
              )}
              Scan Contract
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Export
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
                    onClick={() => handleExport('pdf')}
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex space-x-1 border-b">
          <button
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'patterns'}
            onClick={() => setActiveTab('patterns')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'patterns'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Patterns
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'trending'}
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'trending'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Trending
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'settings'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4">
            {/* Risk Statistics */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Risk Overview</h2>
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Total Risks</div>
                  <div className="text-2xl font-bold">{riskStats.total}</div>
                </div>
                <div className="bg-red-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Critical</div>
                  <div className="text-2xl font-bold text-red-600">{riskStats.critical}</div>
                </div>
                <div className="bg-orange-50 p-4 rounded">
                  <div className="text-sm text-gray-600">High</div>
                  <div className="text-2xl font-bold text-orange-600">{riskStats.high}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Medium</div>
                  <div className="text-2xl font-bold text-yellow-600">{riskStats.medium}</div>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-sm text-gray-600">Low</div>
                  <div className="text-2xl font-bold text-green-600">{riskStats.low}</div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border rounded p-4">
                <h3 className="font-medium mb-3">Risk Trend</h3>
                <div data-testid="risk-trend-chart" className="h-32 bg-gray-50 rounded flex items-center justify-center text-gray-500">
                  Risk Trend Chart
                </div>
              </div>
              <div className="border rounded p-4">
                <h3 className="font-medium mb-3">Category Breakdown</h3>
                <div data-testid="risk-category-chart" className="space-y-2">
                  {Object.entries(categoryStats).map(([category, count]) => (
                    <div key={category} className="text-sm">
                      {category.charAt(0).toUpperCase() + category.slice(1)}: {count}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-4 p-4 bg-gray-50 rounded">
              <div className="flex items-center space-x-4">
                <select
                  aria-label="Filter by severity"
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="px-3 py-2 border rounded"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <select
                  aria-label="Filter by category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border rounded"
                >
                  <option value="all">All Categories</option>
                  <option value="legal">Legal</option>
                  <option value="financial">Financial</option>
                  <option value="compliance">Compliance</option>
                  <option value="operational">Operational</option>
                  <option value="reputational">Reputational</option>
                </select>

                <select
                  aria-label="Filter by status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border rounded"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="accepted">Accepted</option>
                  <option value="mitigated">Mitigated</option>
                  <option value="false_positive">False Positive</option>
                </select>

                <input
                  type="number"
                  aria-label="Min score"
                  placeholder="Min score"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  className="px-3 py-2 border rounded w-24"
                />

                <input
                  type="number"
                  aria-label="Max score"
                  placeholder="Max score"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  className="px-3 py-2 border rounded w-24"
                />

                <input
                  type="search"
                  placeholder="Search risks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 border rounded flex-1"
                />

                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              </div>
            </div>

            {/* Risk List */}
            <div className="space-y-4">
              {paginatedRisks.map((risk) => (
                <article
                  key={risk.id}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') toggleRiskExpansion(risk.id);
                  }}
                  className="border rounded p-4 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        {getSeverityIcon(risk.severity)}
                        <h3 className="ml-2 font-semibold text-gray-900">{risk.patternName}</h3>
                        <span className={`ml-3 px-2 py-1 text-xs rounded-full ${getSeverityColor(risk.severity)}`}>
                          {risk.severity}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">Score: {risk.score}</span>
                        <span className="ml-2 text-sm text-gray-600">{Math.round(risk.confidence * 100)}% confidence</span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        {formatLocation(risk.location)}
                      </div>

                      <div className="flex items-center space-x-4 text-sm">
                        <span className="capitalize">{risk.status === 'false_positive' ? 'False Positive' : risk.status}</span>
                        {risk.reviewedBy && (
                          <span>Reviewed by {risk.reviewedBy}</span>
                        )}
                      </div>

                      <button
                        onClick={() => toggleRiskExpansion(risk.id)}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm flex items-center"
                      >
                        {expandedRisks.has(risk.id) ? (
                          <>
                            <ChevronDownIcon className="h-4 w-4 mr-1" />
                            Hide details
                          </>
                        ) : (
                          <>
                            <ChevronRightIcon className="h-4 w-4 mr-1" />
                            Show details
                          </>
                        )}
                      </button>

                      {expandedRisks.has(risk.id) && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <div className="text-sm font-medium text-gray-700">Matched Text:</div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{risk.matchedText}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-700">Context:</div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{risk.context}</div>
                          </div>
                          {risk.suggestedMitigation && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Suggested Mitigation:</div>
                              <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">{risk.suggestedMitigation}</div>
                            </div>
                          )}
                          {risk.notes && (
                            <div>
                              <div className="text-sm font-medium text-gray-700">Notes:</div>
                              <div className="text-sm text-gray-600">{risk.notes}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {canReviewRisks && (
                        <button
                          onClick={() => setShowStatusModal(risk.id)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Update Status
                        </button>
                      )}
                      {risk.severity === 'critical' || risk.severity === 'high' ? (
                        <button
                          onClick={() => handleGenerateAlert(risk)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Generate Alert
                        </button>
                      ) : null}
                    </div>
                  </div>
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
        )}

        {activeTab === 'patterns' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Risk Patterns</h2>
              {canManagePatterns && (
                <button
                  onClick={() => setShowPatternForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Pattern
                </button>
              )}
            </div>

            <div className="space-y-4">
              {patterns.map((pattern) => (
                <div key={pattern.id} className="border rounded p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{pattern.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{pattern.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(pattern.severity)}`}>
                          {pattern.severity}
                        </span>
                        <span className="text-sm text-gray-600 capitalize">{pattern.category}</span>
                      </div>
                    </div>
                    {canManagePatterns && (
                      <div className="flex items-center space-x-2">
                        <button
                          role="switch"
                          aria-label="Toggle pattern"
                          onClick={() => onUpdatePattern?.(pattern.id, { active: !pattern.active })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                            pattern.active ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              pattern.active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => setEditingPattern(pattern)}
                          className="p-1 text-gray-600 hover:text-gray-900"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(pattern.id)}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pattern Form Modal */}
            {(showPatternForm || editingPattern) && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingPattern ? 'Edit Pattern' : 'Add Pattern'}
                  </h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    // Handle pattern save
                    setShowPatternForm(false);
                    setEditingPattern(null);
                  }}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="pattern-name" className="block text-sm font-medium text-gray-700">
                          Pattern name
                        </label>
                        <input
                          id="pattern-name"
                          type="text"
                          defaultValue={editingPattern?.name}
                          className="mt-1 block w-full border rounded px-3 py-2"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="pattern-desc" className="block text-sm font-medium text-gray-700">
                          Description
                        </label>
                        <textarea
                          id="pattern-desc"
                          defaultValue={editingPattern?.description}
                          className="mt-1 block w-full border rounded px-3 py-2"
                          rows={3}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="pattern-keywords" className="block text-sm font-medium text-gray-700">
                          Keywords
                        </label>
                        <input
                          id="pattern-keywords"
                          type="text"
                          defaultValue={editingPattern?.keywords.join(', ')}
                          className="mt-1 block w-full border rounded px-3 py-2"
                          placeholder="Comma-separated keywords"
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPatternForm(false);
                          setEditingPattern(null);
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {editingPattern ? 'Save Changes' : 'Save Pattern'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-sm">
                  <h3 className="text-lg font-semibold mb-4">Delete Pattern?</h3>
                  <p className="mb-4">This action cannot be undone.</p>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDeletePattern?.(deleteConfirm);
                        setDeleteConfirm(null);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trending' && (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Risk Trending</h2>
            <div className="space-y-4">
              <div className="border rounded p-4">
                <h3 className="font-medium mb-3">Risk Timeline</h3>
                <div data-testid="risk-timeline" className="h-48 bg-gray-50 rounded flex items-center justify-center text-gray-500">
                  Risk Timeline Chart
                </div>
              </div>
              <div className="border rounded p-4">
                <h3 className="font-medium mb-3">Risk Heatmap</h3>
                <div data-testid="risk-heatmap" className="h-48 bg-gray-50 rounded flex items-center justify-center text-gray-500">
                  Risk Heatmap
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-4">
                  <h3 className="font-medium mb-2">vs. Previous Period</h3>
                  <div className="text-2xl font-bold text-green-600">-12%</div>
                  <div className="text-sm text-gray-600">Risk reduction</div>
                </div>
                <div className="border rounded p-4">
                  <h3 className="font-medium mb-2">vs. Average</h3>
                  <div className="text-2xl font-bold text-orange-600">+5%</div>
                  <div className="text-sm text-gray-600">Above average</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Risk Thresholds</h2>
            <div className="max-w-md">
              <div className="space-y-4">
                <div>
                  <label htmlFor="low-threshold" className="block text-sm font-medium text-gray-700">
                    Low threshold
                  </label>
                  <input
                    id="low-threshold"
                    type="number"
                    value={localThresholds.low}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 0 && val <= 100) {
                        setLocalThresholds({ ...localThresholds, low: val });
                        setThresholdError('');
                      } else {
                        setThresholdError('Value must be between 0 and 100');
                      }
                    }}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="medium-threshold" className="block text-sm font-medium text-gray-700">
                    Medium threshold
                  </label>
                  <input
                    id="medium-threshold"
                    type="number"
                    value={localThresholds.medium}
                    onChange={(e) => setLocalThresholds({ ...localThresholds, medium: parseInt(e.target.value) })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="high-threshold" className="block text-sm font-medium text-gray-700">
                    High threshold
                  </label>
                  <input
                    id="high-threshold"
                    type="number"
                    value={localThresholds.high}
                    onChange={(e) => setLocalThresholds({ ...localThresholds, high: parseInt(e.target.value) })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="critical-threshold" className="block text-sm font-medium text-gray-700">
                    Critical threshold
                  </label>
                  <input
                    id="critical-threshold"
                    type="number"
                    value={localThresholds.critical}
                    onChange={(e) => setLocalThresholds({ ...localThresholds, critical: parseInt(e.target.value) })}
                    className="mt-1 block w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              {thresholdError && (
                <p className="mt-2 text-sm text-red-600">{thresholdError}</p>
              )}
              <button
                onClick={() => onUpdateThresholds?.(localThresholds)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Thresholds
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Update Risk Status</h3>
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => handleUpdateStatus(showStatusModal, 'reviewed', statusNotes)}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-left"
                >
                  Mark as Reviewed
                </button>
                <button
                  onClick={() => handleUpdateStatus(showStatusModal, 'accepted', statusNotes)}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-left"
                >
                  Accept Risk
                </button>
                <button
                  onClick={() => handleUpdateStatus(showStatusModal, 'mitigated', statusNotes)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-left"
                >
                  Mark as Mitigated
                </button>
                <button
                  onClick={() => handleUpdateStatus(showStatusModal, 'false_positive', statusNotes)}
                  className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-left"
                >
                  False Positive
                </button>
              </div>
              <div>
                <label htmlFor="status-notes" className="block text-sm font-medium text-gray-700">
                  Review notes
                </label>
                <textarea
                  id="status-notes"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowStatusModal(null);
                  setStatusNotes('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newStatus) {
                    handleUpdateStatus(showStatusModal, newStatus, statusNotes);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {scanError && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 px-4 py-2 rounded shadow-lg">
          {scanError}
          <button
            onClick={handleScanContract}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      {updateMessage && (
        <div role="status" className="fixed bottom-4 right-4 bg-green-100 text-green-700 px-4 py-2 rounded shadow-lg">
          {updateMessage}
        </div>
      )}
    </div>
  );
};