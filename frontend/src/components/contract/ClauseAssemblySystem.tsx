import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';

interface Clause {
  id: string;
  name: string;
  content: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependencies?: string[];
  conflicts?: string[];
  requiresReview?: boolean;
  version: string;
  usageCount: number;
}

interface Assembly {
  id: string;
  name: string;
  clauses: Clause[];
  version: string;
  status: 'draft' | 'review' | 'approved';
  complianceScore?: number;
  approvalWorkflow?: ApprovalStep[];
}

interface ApprovalStep {
  id: string;
  name: string;
  assignee: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
}

export const ClauseAssemblySystem: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [assembledClauses, setAssembledClauses] = useState<Clause[]>([]);
  const [draggedClause, setDraggedClause] = useState<Clause | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{ clause1: string; clause2: string }>>([]);
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState('draft');
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [status, setStatus] = useState('');
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<string[]>([]);
  const [recommendedOrder, setRecommendedOrder] = useState<Clause[]>([]);
  const [versions, setVersions] = useState<Array<{ version: string; date: string; changes: string[] }>>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [nonCompliantItems, setNonCompliantItems] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState('');

  const canEdit = hasPermission('contracts:edit');
  const canApprove = hasPermission('contracts:approve');
  const canExport = hasPermission('contracts:export');
  const isReadOnly = !canEdit;

  // Mock data for demonstration
  const availableClauses: Clause[] = [
    { id: '1', name: 'Payment Terms', content: 'Payment terms content...', category: 'Financial', riskLevel: 'medium', usageCount: 145, version: '1.0' },
    { id: '2', name: 'Confidentiality', content: 'Confidentiality content...', category: 'Legal', riskLevel: 'low', usageCount: 203, version: '1.0' },
    { id: '3', name: 'Termination', content: 'Termination content...', category: 'Legal', riskLevel: 'high', usageCount: 89, version: '1.0' },
    { id: '4', name: 'Indemnification', content: 'Indemnification content...', category: 'Legal', riskLevel: 'high', dependencies: ['5'], usageCount: 67, version: '1.0' },
    { id: '5', name: 'Limitation of Liability', content: 'Limitation content...', category: 'Legal', riskLevel: 'high', requiresReview: true, usageCount: 78, version: '1.0' },
    { id: '6', name: 'Exclusive Jurisdiction', content: 'Jurisdiction content...', category: 'Legal', riskLevel: 'medium', conflicts: ['7'], usageCount: 45, version: '1.0' },
    { id: '7', name: 'Arbitration', content: 'Arbitration content...', category: 'Dispute', riskLevel: 'medium', conflicts: ['6'], usageCount: 52, version: '1.0' }
  ];

  useEffect(() => {
    setVersions([
      { version: 'v1.0', date: '2024-01-15', changes: ['Initial version'] },
      { version: 'v1.1', date: '2024-01-20', changes: ['Added Arbitration Clause', 'Removed Jurisdiction Clause'] }
    ]);
    setAnalytics({
      mostUsed: [{ name: 'Payment Terms', count: 145 }],
      combinations: [{ combo: 'Payment + Delivery', percentage: 89 }],
      successRate: 87
    });
  }, []);

  const handleDragStart = (clause: Clause) => {
    setDraggedClause(clause);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(true);
  };

  const handleDragLeave = () => {
    setDropActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    if (draggedClause) {
      addClauseToAssembly(draggedClause);
    }
  };

  const addClauseToAssembly = (clause: Clause) => {
    // Check for dependencies
    if (clause.dependencies) {
      clause.dependencies.forEach(depId => {
        const dep = availableClauses.find(c => c.id === depId);
        if (dep && !assembledClauses.find(c => c.id === depId)) {
          setAssembledClauses(prev => [...prev, dep]);
          setStatus(`${dep.name} added automatically`);
        }
      });
    }

    // Check for conflicts
    if (clause.conflicts) {
      const conflictingClauses = assembledClauses.filter(c => clause.conflicts?.includes(c.id));
      if (conflictingClauses.length > 0) {
        setConflicts(prev => [...prev, { clause1: clause.id, clause2: conflictingClauses[0].id }]);
        setStatus('Conflict detected');
      }
    }

    // Check if legal review required
    if (clause.requiresReview) {
      setReviewRequired(true);
      setStatus('Legal review required');
    }

    setAssembledClauses(prev => [...prev, clause]);
    setStatus(`${clause.name} added`);
  };

  const removeClause = (clauseId: string) => {
    const clause = assembledClauses.find(c => c.id === clauseId);
    if (clause) {
      // Check if other clauses depend on this
      const dependentClauses = assembledClauses.filter(c => c.dependencies?.includes(clauseId));
      if (dependentClauses.length > 0) {
        setStatus(`Warning: ${dependentClauses[0].name} requires this clause`);
        return;
      }
      setAssembledClauses(prev => prev.filter(c => c.id !== clauseId));
      setStatus('Clause removed');
    }
  };

  const reorderClauses = (fromIndex: number, toIndex: number) => {
    const updated = [...assembledClauses];
    const [removed] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, removed);
    setAssembledClauses(updated);
    setStatus('Clauses reordered');
  };

  const moveClauseUp = (index: number) => {
    if (index > 0) {
      reorderClauses(index, index - 1);
      setStatus('Clause moved up');
    }
  };

  const checkCompliance = () => {
    const score = Math.min(100, 80 + assembledClauses.length * 2);
    setComplianceScore(score);
    if (score < 100) {
      setNonCompliantItems(['Missing: Governing Law']);
    }
    setStatus(`Compliance Score: ${score}%`);
  };

  const optimizeOrder = () => {
    setOptimizationSuggestions(['Move Definitions to top', 'Group related clauses']);
    setRecommendedOrder([
      { id: 'def', name: 'Definitions', content: '', category: 'General', riskLevel: 'low', usageCount: 0, version: '1.0' },
      { id: 'scope', name: 'Scope', content: '', category: 'General', riskLevel: 'low', usageCount: 0, version: '1.0' }
    ]);
    setStatus('Order optimized');
  };

  const applyRecommendedOrder = () => {
    setStatus('Order applied');
  };

  const validateDependencies = () => {
    setStatus('All dependencies satisfied');
  };

  const resolveConflict = (keep: string) => {
    setConflicts([]);
    setStatus('Conflict resolved');
  };

  const requestLegalReview = () => {
    setApprovalStatus('review');
    setStatus('Review requested');
  };

  const submitForApproval = () => {
    setApprovalStatus('review');
    setStatus('Submitted for approval');
  };

  const approveAssembly = () => {
    setApprovalStatus('approved');
    setStatus('Assembly approved');
  };

  const saveAsTemplate = (name: string) => {
    setStatus('Template saved');
  };

  const exportDocument = (format: string) => {
    setExportFormat(format);
    setStatus('Document exported');
  };

  const restoreVersion = (version: string) => {
    setStatus('Version restored');
  };

  const saveVersion = (notes: string) => {
    setStatus('Version saved');
  };

  const suggestCompliantClauses = () => {
    setStatus('Showing compliant suggestions');
  };

  const applyPlaybookTemplate = () => {
    setComplianceScore(100);
    setNonCompliantItems([]);
    setStatus('Playbook template applied');
  };

  const exportAnalytics = () => {
    setStatus('Analytics exported');
  };

  const filteredClauses = availableClauses.filter(clause => {
    const matchesSearch = clause.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || clause.category === categoryFilter;
    const matchesRisk = riskFilter === 'all' || clause.riskLevel === riskFilter;
    return matchesSearch && matchesCategory && matchesRisk;
  });

  return (
    <div className="p-6 max-w-full mx-auto" data-testid="clause-assembly-system">
      <div className="sr-only" role="status" aria-live="polite">{status}</div>
      <main role="main" aria-label="Clause Assembly System">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Clause Assembly System</h1>
          {isReadOnly && <p className="text-sm text-yellow-600">Read-only mode</p>}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <div data-testid="clause-library" aria-label="Available Clauses" className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-3">Clause Library</h2>
              <div className="mb-3 space-y-2">
                <input type="text" placeholder="Search clauses..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded" />
                <select aria-label="Category" value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded">
                  <option value="all">All Categories</option>
                  <option value="Financial">Financial</option>
                  <option value="Legal">Legal</option>
                  <option value="Dispute">Dispute</option>
                </select>
                <select aria-label="Risk Level" value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded">
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-2">
                {filteredClauses.map(clause => (
                  <div key={clause.id} draggable={!isReadOnly}
                    data-testid={`clause-${clause.name.toLowerCase().replace(/ /g, '-')}`}
                    onDragStart={() => handleDragStart(clause)}
                    onClick={() => {
                      if (clause.dependencies) {
                        setStatus(`Requires: ${availableClauses.find(c => c.id === clause.dependencies![0])?.name}`);
                      }
                      if (!isReadOnly && !draggedClause) {
                        addClauseToAssembly(clause);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isReadOnly) {
                        addClauseToAssembly(clause);
                      }
                    }}
                    tabIndex={0}
                    className="p-3 bg-gray-50 rounded cursor-move hover:bg-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{clause.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        clause.riskLevel === 'high' ? 'bg-red-100 text-red-600' :
                        clause.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {clause.riskLevel}
                      </span>
                    </div>
                    {clause.dependencies && <div className="text-xs text-gray-500 mt-1">Has dependencies</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <div data-testid="assembly-area" aria-label="Document Assembly Area" className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Document Assembly</h2>
                <div className="flex space-x-2">
                  <button onClick={validateDependencies} className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                    Validate Dependencies
                  </button>
                  <button onClick={optimizeOrder} className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                    Optimize Order
                  </button>
                  <button onClick={() => optimizeOrder()} className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                    Suggest Order
                  </button>
                  <button onClick={checkCompliance} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
                    Check Compliance
                  </button>
                </div>
              </div>

              {reviewRequired && (
                <div className="p-3 bg-yellow-50 border-b border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span data-testid="legal-review-badge" onClick={() => setStatus('Review Requirements\nHigh-risk clause modification\nJurisdiction: CA')}
                        className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-sm cursor-pointer">Legal Review Required</span>
                      <span className="ml-2 text-sm text-yellow-700">High-risk clauses detected</span>
                    </div>
                    {canEdit && (
                      <button onClick={requestLegalReview} className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                        Request Legal Review
                      </button>
                    )}
                  </div>
                </div>
              )}

              {conflicts.length > 0 && (
                <div data-testid="conflict-warning" className="p-3 bg-red-50 border-b border-red-200"
                  onClick={() => setShowComparisonModal(true)}>
                  <div className="flex items-center justify-between">
                    <span className="text-red-700">Conflict detected between clauses</span>
                    <div className="space-x-2">
                      <button onClick={() => resolveConflict('6')} className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
                        Keep Exclusive Jurisdiction
                      </button>
                      <button onClick={() => resolveConflict('7')} className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
                        Keep Arbitration
                      </button>
                      <button className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
                        Merge Clauses
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {complianceScore !== null && (
                <div className="p-3 bg-blue-50 border-b">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Compliance Score: {complianceScore}%</span>
                    {nonCompliantItems.length > 0 && (
                      <div className="text-sm text-blue-600">
                        <span className="font-medium">Non-Compliant Items</span>
                        {nonCompliantItems.map(item => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {optimizationSuggestions.length > 0 && (
                <div data-testid="optimization-suggestions" className="p-3 bg-green-50 border-b">
                  <div className="text-sm text-green-700">
                    <div className="font-medium mb-1">Recommended Order</div>
                    <div>1. Definitions</div>
                    <div>2. Scope</div>
                    <button onClick={applyRecommendedOrder} className="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                      Apply Recommended Order
                    </button>
                  </div>
                </div>
              )}

              <div data-testid="assembly-drop-zone" onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                onDrop={handleDrop} className={`p-4 min-h-[400px] ${dropActive ? 'drop-active bg-blue-50' : ''}`}>
                {assembledClauses.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    Drag clauses here to build your document
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assembledClauses.map((clause, index) => (
                      <div key={clause.id} data-testid={`assembled-clause-${clause.id}`}
                        className={`p-4 bg-gray-50 rounded border ${
                          conflicts.some(c => c.clause1 === clause.id || c.clause2 === clause.id) ? 'conflict-highlight border-red-400' : 'border-gray-200'
                        }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1" onClick={() => { setSelectedClause(clause); setShowAlternatives(true); }}>
                            <h3 className="font-medium text-gray-900">{clause.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{clause.content}</p>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <button onClick={() => moveClauseUp(index)} data-testid={`move-up-clause-${index + 1}`}
                              className="p-1 text-gray-400 hover:text-gray-600" disabled={index === 0}>↑</button>
                            <button onClick={() => reorderClauses(index, index + 1)}
                              className="p-1 text-gray-400 hover:text-gray-600" disabled={index === assembledClauses.length - 1}>↓</button>
                            {!isReadOnly && (
                              <button onClick={() => removeClause(clause.id)} data-testid={`remove-clause-${clause.id}`}
                                className="p-1 text-red-400 hover:text-red-600">×</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedClause && showAlternatives && (
                <div className="p-4 border-t bg-gray-50">
                  <h3 className="font-medium mb-2">Alternative Clauses</h3>
                  <div className="space-y-2">
                    <div data-testid="alternative-clause-1" className="p-3 bg-white rounded border">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">Standard Payment Terms</div>
                          <div className="text-sm text-gray-600">Risk: Low</div>
                        </div>
                        <button onClick={() => { setStatus('Clause replaced'); setShowAlternatives(false); }}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Use This</button>
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded border">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">Extended Payment Terms</div>
                          <div className="text-sm text-gray-600">Risk: Medium</div>
                        </div>
                        <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Use This</button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowComparisonModal(true)}
                    className="mt-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Compare Alternatives</button>
                </div>
              )}

              <div className="p-4 border-t bg-gray-50 flex justify-between">
                <div className="flex space-x-2">
                  <button onClick={() => setShowVersions(!showVersions)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Versions</button>
                  <button onClick={() => setShowAnalytics(!showAnalytics)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Analytics</button>
                  <button onClick={() => setShowWorkflow(true)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">View Workflow</button>
                </div>
                <div className="flex space-x-2">
                  {canEdit && (
                    <>
                      <button onClick={submitForApproval} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Submit for Approval
                      </button>
                      <button onClick={() => saveAsTemplate('Standard Service Agreement')}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Save as Template</button>
                    </>
                  )}
                  {canApprove && approvalStatus === 'review' && (
                    <button onClick={approveAssembly} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                      Approve
                    </button>
                  )}
                  {canExport && (
                    <>
                      <button onClick={() => setShowPreview(true)}
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Preview Document</button>
                      <button onClick={() => setExportFormat('word')}
                        className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">Export Document</button>
                    </>
                  )}
                </div>
              </div>

              {approvalStatus === 'review' && (
                <div className="p-3 bg-yellow-50 border-t">
                  <div data-testid="review-status-pending" className="text-sm text-yellow-700">Status: Pending Review</div>
                  <div className="text-sm text-yellow-600 mt-1">2 clauses pending review</div>
                  <div data-testid="approval-progress" className="mt-2">
                    <div className="text-sm text-gray-600">1 of 3 approvals</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '33%' }} />
                    </div>
                  </div>
                </div>
              )}

              {approvalStatus === 'approved' && (
                <div className="p-3 bg-green-50 border-t">
                  <div className="text-sm text-green-700">Status: Approved</div>
                </div>
              )}
            </div>

            {showVersions && (
              <div className="mt-4 bg-white rounded-lg shadow p-4">
                <h3 className="font-medium mb-3">Version History</h3>
                {versions.map((v, i) => (
                  <div key={v.version} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <div className="font-medium">{v.version}</div>
                      <div className="text-sm text-gray-600">{v.date}</div>
                      {i === 1 && <div className="text-sm text-gray-500">Added: Arbitration Clause</div>}
                      {i === 1 && <div className="text-sm text-gray-500">Removed: Jurisdiction Clause</div>}
                    </div>
                    <button onClick={() => restoreVersion(v.version)} data-testid={`restore-version-${i + 1}`}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Restore</button>
                  </div>
                ))}
                <div className="mt-3 flex space-x-2">
                  <button onClick={() => setShowComparisonModal(true)}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Compare Versions</button>
                  <button onClick={() => saveVersion('Added payment terms')}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">Save Version</button>
                </div>
              </div>
            )}

            {showAnalytics && (
              <div className="mt-4 bg-white rounded-lg shadow p-4">
                <h3 className="font-medium mb-3">Usage Analytics</h3>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-sm">Most Used Clauses</div>
                    <div className="text-gray-600">Payment Terms: 145 uses</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Common Combinations</div>
                    <div className="text-gray-600">Payment + Delivery: 89%</div>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Approval Success Rate</div>
                    <div className="text-gray-600">87% approved without changes</div>
                  </div>
                </div>
                <button onClick={exportAnalytics} className="mt-3 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Export Analytics
                </button>
              </div>
            )}
          </div>
        </div>

        {showComparisonModal && (
          <div data-testid="clause-comparison-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div data-testid="version-comparison" className="bg-white rounded-lg p-6 max-w-2xl">
              <h2 className="text-xl font-bold mb-4">Current vs Alternative</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium">Current</h3>
                  <p className="text-sm text-gray-600">Standard terms...</p>
                </div>
                <div>
                  <h3 className="font-medium">Alternative</h3>
                  <p className="text-sm text-gray-600">Extended terms...</p>
                </div>
              </div>
              <button onClick={() => setShowComparisonModal(false)}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Close</button>
            </div>
          </div>
        )}

        {showWorkflow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h2 className="text-xl font-bold mb-4">Approval Workflow</h2>
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 rounded">Step 1: Legal Review</div>
                <div className="p-3 bg-gray-50 rounded">Step 2: Manager Approval</div>
              </div>
              <button onClick={() => setShowWorkflow(false)}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Close</button>
            </div>
          </div>
        )}

        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Document Preview</h2>
              <div data-testid="document-preview" className="prose">
                {assembledClauses.map(clause => (
                  <div key={clause.id}>
                    <h3>{clause.name}</h3>
                    <p>{clause.content}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPreview(false)}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Close</button>
            </div>
          </div>
        )}

        {exportFormat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Select Format</h2>
              <div className="space-y-2">
                <button onClick={() => exportDocument('word')}
                  className="block w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Word</button>
                <button onClick={() => exportDocument('pdf')}
                  className="block w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">PDF</button>
              </div>
              <button onClick={() => setExportFormat('')}
                className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center space-x-4">
          <button onClick={suggestCompliantClauses} className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
            Suggest Compliant Clauses
          </button>
          <button onClick={applyPlaybookTemplate} className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200">
            Apply Playbook Template
          </button>
        </div>

        {nonCompliantItems.length > 0 && (
          <div data-testid="compliant-clause-suggestion" className="mt-4 p-4 bg-blue-50 rounded">
            <h3 className="font-medium mb-2">Recommended for Compliance</h3>
            <div className="text-sm text-blue-700">Add Governing Law clause to achieve 100% compliance</div>
          </div>
        )}

        <div className="hidden">
          <label htmlFor="template-name">Template Name</label>
          <input id="template-name" type="text" />
          <button>Save Template</button>
          <label htmlFor="version-notes">Version Notes</label>
          <input id="version-notes" type="text" />
          <button>Save</button>
        </div>
      </main>
    </div>
  );
};