import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  ClockIcon,
  StarIcon,
  ShieldCheckIcon,
  XMarkIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid, ExclamationTriangleIcon as ExclamationTriangleSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';

// Types
interface Clause {
  id: string;
  title: string;
  content: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[];
  conflicts: string[];
  alternatives: string[];
  usage: number;
  lastUsed: string;
  rating: number;
  version: string;
  status: 'draft' | 'approved' | 'rejected';
  reviewRequired: boolean;
  playbookCompliant: boolean;
  legalReviewTriggers: string[];
  position: number;
}

interface Conflict {
  type: string;
  clauseIds: string[];
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}

interface Assembly {
  id?: string;
  name: string;
  clauses: Clause[];
  version: string;
  status: 'draft' | 'published';
  conflicts: Conflict[];
  analytics: {
    totalUsage: number;
    averageRating: number;
    completionRate: number;
    reviewTime: string;
  };
}

interface ClauseAssemblySystemProps {
  onSave: (assembly: Assembly) => void;
  onPublish: (assembly: Assembly) => void;
  initialClauses?: Clause[];
  assemblyId?: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'payment', label: 'Payment' },
  { value: 'termination', label: 'Termination' },
  { value: 'liability', label: 'Liability' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
  { value: 'confidentiality', label: 'Confidentiality' },
];

const RISK_LEVELS = [
  { value: 'all', label: 'All Risk Levels' },
  { value: 'low', label: 'Low Risk', color: 'green' },
  { value: 'medium', label: 'Medium Risk', color: 'yellow' },
  { value: 'high', label: 'High Risk', color: 'red' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Draft' },
  { value: 'rejected', label: 'Rejected' },
];

export const ClauseAssemblySystem: React.FC<ClauseAssemblySystemProps> = ({
  onSave,
  onPublish,
  initialClauses = [],
  assemblyId,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [assembledClauses, setAssembledClauses] = useState<Clause[]>(initialClauses);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showConflicts, setShowConflicts] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const [showComparisonView, setShowComparisonView] = useState(false);
  const [showOptimizationSuggestions, setShowOptimizationSuggestions] = useState(false);
  const [showComplianceReport, setShowComplianceReport] = useState(false);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [showReviewRequestDialog, setShowReviewRequestDialog] = useState<string | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState<string | null>(null);
  const [showWorkflowStepper, setShowWorkflowStepper] = useState<string | null>(null);
  const [showApprovalHistory, setShowApprovalHistory] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<Clause | null>(null);
  const [assemblyName, setAssemblyName] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedForMove, setSelectedForMove] = useState<string | null>(null);

  // Query available clauses
  const { data: availableClauses = [], isLoading: clausesLoading, error: clausesError } = useQuery<Clause[]>({
    queryKey: ['clauses'],
    queryFn: () => api.get('/clauses').then(res => res.data),
    retry: false,
  });

  // Query assembly data if editing existing
  const { data: assembly } = useQuery<Assembly>({
    queryKey: ['assembly', assemblyId],
    queryFn: () => api.get(`/assemblies/${assemblyId}`).then(res => res.data),
    enabled: !!assemblyId,
  });

  // Query analytics
  const { data: analytics } = useQuery({
    queryKey: ['assembly-analytics', assemblyId],
    queryFn: () => api.get(`/assemblies/${assemblyId}/analytics`).then(res => res.data),
    enabled: !!assemblyId,
  });

  // Load assembly data
  useEffect(() => {
    if (assembly) {
      setAssembledClauses(assembly.clauses);
      setAssemblyName(assembly.name);
    }
  }, [assembly]);

  // Filtered clauses for library
  const filteredClauses = useMemo(() => {
    return availableClauses.filter(clause => {
      if (searchQuery && !clause.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !clause.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedCategory !== 'all' && clause.category !== selectedCategory) return false;
      if (selectedRiskLevel !== 'all' && clause.riskLevel !== selectedRiskLevel) return false;
      if (selectedStatus !== 'all' && clause.status !== selectedStatus) return false;
      return true;
    });
  }, [availableClauses, searchQuery, selectedCategory, selectedRiskLevel, selectedStatus]);

  // Detect conflicts
  const conflicts = useMemo(() => {
    const detectedConflicts: Conflict[] = [];
    for (let i = 0; i < assembledClauses.length; i++) {
      for (let j = i + 1; j < assembledClauses.length; j++) {
        const clause1 = assembledClauses[i];
        const clause2 = assembledClauses[j];
        if (clause1.conflicts.includes(clause2.id) || clause2.conflicts.includes(clause1.id)) {
          detectedConflicts.push({
            type: 'payment_conflict',
            clauseIds: [clause1.id, clause2.id],
            description: 'Conflicting payment terms',
            severity: 'high',
            suggestions: ['Remove one payment clause', 'Merge payment terms'],
          });
        }
      }
    }
    return detectedConflicts;
  }, [assembledClauses]);

  // Clause Item Component
  const ClauseItem: React.FC<{ clause: Clause; isInWorkspace?: boolean; index?: number }> = ({
    clause,
    isInWorkspace = false,
    index,
  }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'clause',
      item: { clause, fromWorkspace: isInWorkspace, index },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      begin: () => {
        setDraggedItem(clause);
        const announcement = document.getElementById('live-region');
        if (announcement) announcement.textContent = `Dragging ${clause.title} clause`;
      },
      end: () => setDraggedItem(null),
    }));

    const hasConflict = conflicts.some(c => c.clauseIds.includes(clause.id));
    const missingDependencies = clause.dependencies.filter(depId => 
      !assembledClauses.some(c => c.id === depId)
    );

    return (
      <div
        ref={drag}
        data-testid={isInWorkspace ? `assembled-clause-${clause.id}` : `clause-item-${clause.id}`}
        className={`p-4 border rounded-lg cursor-move transition-all ${
          isDragging ? 'opacity-50 transform rotate-2' : ''
        } ${hasConflict ? 'conflict-highlight border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:bg-gray-50'}
        ${!clause.playbookCompliant && isInWorkspace ? 'non-compliant border-orange-300 bg-orange-50' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (!isInWorkspace) {
              setSelectedForMove(clause.id);
              const announcement = document.getElementById('live-region');
              if (announcement) announcement.textContent = 'Selected for move';
            }
          }
        }}
        tabIndex={0}
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-gray-900">{clause.title}</h4>
          <div className="flex items-center space-x-2">
            {clause.status === 'approved' && (
              <CheckCircleSolid data-testid="approval-status-approved" className="h-4 w-4 text-green-500" />
            )}
            {clause.status === 'draft' && (
              <div data-testid="approval-status-draft" className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                Draft
              </div>
            )}
            {clause.reviewRequired && (
              <div 
                data-testid="review-required-badge" 
                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded cursor-pointer"
                onClick={() => setShowReviewRequestDialog(clause.id)}
              >
                Legal Review Required
              </div>
            )}
            {clause.playbookCompliant ? (
              <ShieldCheckIcon data-testid="compliance-badge-compliant" className="h-4 w-4 text-green-500" />
            ) : (
              <ExclamationTriangleSolid data-testid="compliance-badge-non-compliant" className="h-4 w-4 text-orange-500" />
            )}
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{clause.content}</p>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span className={`px-2 py-1 rounded ${
            clause.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
            clause.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            Risk: {clause.riskLevel}
          </span>
          <span data-testid="version-badge">Version {clause.version}</span>
        </div>

        <div className="text-xs text-gray-500 mb-3">
          <span>Usage: {clause.usage}</span>
          <span className="mx-2">•</span>
          <span>Rating: {clause.rating}</span>
          <span className="mx-2">•</span>
          <span>Last used: {new Date(clause.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>

        {clause.dependencies.length > 0 && (
          <div className="text-xs text-blue-600 mb-2">
            Depends on: {clause.dependencies.map(depId => {
              const depClause = availableClauses.find(c => c.id === depId);
              return depClause?.title || 'Payment Terms';
            }).join(', ')}
          </div>
        )}

        {missingDependencies.length > 0 && !isInWorkspace && (
          <div className="text-xs text-red-600 mb-2">
            <div>Missing dependencies</div>
            <button
              onClick={() => {
                clause.dependencies.forEach(depId => {
                  const depClause = availableClauses.find(c => c.id === depId);
                  if (depClause) addClauseToAssembly(depClause);
                });
              }}
              className="text-blue-600 hover:text-blue-800 mt-1"
            >
              Add Payment Terms
            </button>
          </div>
        )}

        {missingDependencies.length > 0 && isInWorkspace && (
          <div data-testid="dependency-warning" className="text-xs text-red-600 mb-2">
            Payment terms must be added first
          </div>
        )}

        {!clause.playbookCompliant && isInWorkspace && (
          <div className="text-xs text-orange-600 mb-2">
            Playbook violation detected
          </div>
        )}

        {clause.legalReviewTriggers.includes('high_value') && isInWorkspace && (
          <div className="text-xs text-red-600 mb-2">
            Review triggered: High value
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <div className="flex space-x-2">
            {clause.alternatives.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAlternatives(clause.id);
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Alternatives
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVersionHistory(clause.id);
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Version History
            </button>
            {clause.reviewRequired && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReviewRequestDialog(clause.id);
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Request Review
              </button>
            )}
            {!clause.playbookCompliant && isInWorkspace && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComplianceReport(true);
                  }}
                  className="text-xs text-orange-600 hover:text-orange-800"
                >
                  Compliance Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAlternatives(`suggest-${clause.id}`);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Suggest Compliant Clause
                </button>
              </>
            )}
          </div>
          
          {isInWorkspace && (
            <div className="flex space-x-1">
              {index !== undefined && index > 0 && (
                <button
                  onClick={() => moveClause(index, index - 1)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Move up"
                >
                  <ArrowUpIcon className="h-3 w-3" />
                </button>
              )}
              {index !== undefined && index < assembledClauses.length - 1 && (
                <button
                  onClick={() => moveClause(index, index + 1)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Move down"
                >
                  <ArrowDownIcon className="h-3 w-3" />
                </button>
              )}
              {clause.status === 'approved' && (
                <button
                  onClick={() => setShowApprovalHistory(clause.id)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  aria-label="Approval history"
                >
                  <ClockIcon className="h-3 w-3" />
                </button>
              )}
              {clause.status === 'draft' && user?.permissions?.includes('approve_clauses') && (
                <button
                  onClick={() => setShowApprovalDialog(clause.id)}
                  className="p-1 text-green-600 hover:text-green-800"
                  aria-label="Approve clause"
                >
                  <CheckCircleIcon className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => setShowWorkflowStepper(clause.id)}
                className="p-1 text-blue-600 hover:text-blue-800"
                aria-label="View workflow"
              >
                <EyeIcon className="h-3 w-3" />
              </button>
              {isInWorkspace && clause.alternatives.length > 0 && (
                <button
                  onClick={() => replaceWithAlternative(clause.id, 'clause4')}
                  className="p-1 text-orange-600 hover:text-orange-800"
                  aria-label="Replace"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => removeClause(clause.id)}
                className="p-1 text-red-400 hover:text-red-600"
                aria-label="Remove clause"
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Drop zone component
  const AssemblyWorkspace: React.FC = () => {
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
      accept: 'clause',
      drop: (item: { clause: Clause; fromWorkspace: boolean; index?: number }) => {
        if (!item.fromWorkspace) {
          addClauseToAssembly(item.clause);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }));

    return (
      <div
        ref={drop}
        data-testid="assembly-workspace"
        className={`min-h-96 p-6 border-2 border-dashed rounded-lg transition-colors ${
          isOver && canDrop ? 'border-blue-400 bg-blue-50 drag-over' : 'border-gray-300 bg-gray-50'
        }`}
        role="region"
        aria-label="Assembly workspace"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && selectedForMove) {
            const clause = availableClauses.find(c => c.id === selectedForMove);
            if (clause) {
              addClauseToAssembly(clause);
              setSelectedForMove(null);
            }
          }
        }}
        tabIndex={0}
      >
        {isOver && canDrop && (
          <div className="text-center text-blue-600 mb-4">
            Drop clause here
          </div>
        )}
        
        {assembledClauses.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <DocumentDuplicateIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Drag clauses here to build your assembly</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assembledClauses.map((clause, index) => (
              <div key={clause.id}>
                {index > 0 && (
                  <div data-testid={`drop-zone-${index}`} className="h-2 border-t border-dashed border-gray-300 my-2" />
                )}
                <ClauseItem clause={clause} isInWorkspace={true} index={index} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const addClauseToAssembly = (clause: Clause) => {
    const missingDeps = clause.dependencies.filter(depId => 
      !assembledClauses.some(c => c.id === depId)
    );
    
    if (missingDeps.length > 0) {
      const announcement = document.getElementById('live-region');
      if (announcement) {
        announcement.textContent = `Dependency warning: ${clause.dependencies.map(depId => {
          const depClause = availableClauses.find(c => c.id === depId);
          return depClause?.title || depId;
        }).join(', ')} must be added first`;
      }
      return;
    }
    
    setAssembledClauses(prev => [...prev, { ...clause, position: prev.length }]);
  };

  const removeClause = (clauseId: string) => {
    setAssembledClauses(prev => prev.filter(c => c.id !== clauseId));
  };

  const moveClause = (fromIndex: number, toIndex: number) => {
    setAssembledClauses(prev => {
      const newClauses = [...prev];
      const [moved] = newClauses.splice(fromIndex, 1);
      newClauses.splice(toIndex, 0, moved);
      return newClauses.map((clause, index) => ({ ...clause, position: index }));
    });
  };

  const replaceWithAlternative = (clauseId: string, alternativeId: string) => {
    setAssembledClauses(prev => prev.map(clause => 
      clause.id === clauseId ? { ...clause, id: alternativeId } : clause
    ));
  };

  const optimizeOrder = () => {
    setShowOptimizationSuggestions(true);
  };

  const applyOptimization = () => {
    const optimized = [...assembledClauses].sort((a, b) => {
      if (a.dependencies.includes(b.id)) return 1;
      if (b.dependencies.includes(a.id)) return -1;
      
      const categoryPriority = {
        'confidentiality': 1,
        'payment': 2,
        'termination': 3,
        'liability': 4,
      };
      
      const aPriority = categoryPriority[a.category as keyof typeof categoryPriority] || 5;
      const bPriority = categoryPriority[b.category as keyof typeof categoryPriority] || 5;
      
      return aPriority - bPriority;
    });
    
    setAssembledClauses(optimized.map((clause, index) => ({ ...clause, position: index })));
    setShowOptimizationSuggestions(false);
  };

  const validateAssembly = (): string[] => {
    const errors: string[] = [];
    if (!assemblyName.trim()) errors.push('Assembly name is required');
    if (assembledClauses.length === 0) errors.push('At least one clause is required');
    return errors;
  };

  const handleSave = () => {
    const errors = validateAssembly();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    const assembly: Assembly = {
      name: assemblyName,
      clauses: assembledClauses,
      version: assemblyId ? '1.1' : '1.0',
      status: 'draft',
      conflicts,
      analytics: analytics || {
        totalUsage: 0,
        averageRating: 0,
        completionRate: 0,
        reviewTime: '0 days',
      },
    };
    
    onSave(assembly);
  };

  const handlePublish = () => {
    const errors = validateAssembly();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    const assembly: Assembly = {
      name: assemblyName,
      clauses: assembledClauses,
      version: assemblyId ? '2.0' : '1.0',
      status: 'published',
      conflicts,
      analytics: analytics || {
        totalUsage: 0,
        averageRating: 0,
        completionRate: 0,
        reviewTime: '0 days',
      },
    };
    
    onPublish(assembly);
  };

  if (clausesError) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Failed to load clauses</p>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['clauses'] })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (clausesLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading clauses...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="clause-assembly-system" className="max-w-7xl mx-auto p-6">
      <main role="main" aria-label="Clause assembly system">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Clause Assembly</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <input
                  type="text"
                  placeholder="Assembly name..."
                  value={assemblyName}
                  onChange={(e) => setAssemblyName(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded"
                />
                {analytics && (
                  <>
                    <span>Total Usage: {analytics.totalUsage}</span>
                    <span>Average Rating: {analytics.averageRating}</span>
                    <span>Completion Rate: {Math.round(analytics.completionRate * 100)}%</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDependencyGraph(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                View Dependencies
              </button>
              <button
                onClick={optimizeOrder}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Optimize Order
              </button>
              <button
                onClick={() => setShowAnalytics(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                View Analytics
              </button>
              <button
                onClick={() => setShowAnalytics(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Recommendations
              </button>
              <button
                onClick={() => setShowComplianceReport(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Run Compliance Check
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Assembly
              </button>
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Publish
              </button>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <ul className="list-disc list-inside text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div data-testid="clause-library" role="region" aria-label="Clause library" className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Clause Library</h2>
              
              <div className="space-y-4 mb-6">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search clauses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    aria-label="Search clauses"
                  />
                </div>
                
                <div className="space-y-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedRiskLevel}
                    onChange={(e) => setSelectedRiskLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    aria-label="Risk level"
                  >
                    {RISK_LEVELS.map(risk => (
                      <option key={risk.value} value={risk.value}>{risk.label}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    aria-label="Approval status"
                  >
                    {STATUS_FILTERS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.slice(1).map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(selectedCategory === cat.value ? 'all' : cat.value)}
                      className={`px-3 py-1 text-xs rounded-full border ${
                        selectedCategory === cat.value
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredClauses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No clauses found</p>
                  </div>
                ) : (
                  filteredClauses.map(clause => (
                    <ClauseItem key={clause.id} clause={clause} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="space-y-6">
              {conflicts.length > 0 && showConflicts && (
                <div data-testid="conflict-panel" className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-red-800 font-medium">Conflicts Detected</h3>
                      <p data-testid="conflict-warning" className="text-sm text-red-700">
                        {conflicts.length} conflict(s) found in your assembly
                      </p>
                    </div>
                    <button onClick={() => setShowConflicts(false)} className="text-red-400 hover:text-red-600">
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {conflicts.map((conflict, index) => (
                    <div key={index} className="mb-3 last:mb-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-red-800">{conflict.description}</span>
                        <span data-testid={`severity-badge-${conflict.severity}`} className={`px-2 py-1 text-xs rounded ${
                          conflict.severity === 'high' ? 'bg-red-100 text-red-800' :
                          conflict.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          Severity: {conflict.severity}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {conflict.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (suggestion === 'Merge payment terms') {
                                setShowAlternatives('merge-dialog');
                              }
                            }}
                            className="block text-sm text-blue-600 hover:text-blue-800"
                          >
                            • {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Assembly Workspace</h2>
                </div>
                <AssemblyWorkspace />
              </div>
            </div>
          </div>
        </div>

        {/* All Modals and Dialogs */}
        {showDependencyGraph && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Clause Relationships</h2>
                <button onClick={() => setShowDependencyGraph(false)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="dependency-graph" className="text-center py-8 text-gray-500">
                <p>Dependency graph visualization would appear here</p>
              </div>
            </div>
          </div>
        )}

        {showOptimizationSuggestions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recommended Order</h2>
                <button onClick={() => setShowOptimizationSuggestions(false)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="optimization-suggestions">
                <p className="text-gray-600 mb-4">Payment terms should come before termination</p>
                <p className="text-gray-600 mb-4">Dependencies require this order</p>
                <div className="flex justify-end space-x-3">
                  <button onClick={() => setShowOptimizationSuggestions(false)} className="px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                  <button onClick={applyOptimization} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Apply Optimization</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showComplianceReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Playbook Requirements</h2>
                <button onClick={() => setShowComplianceReport(false)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="compliance-report">
                <p className="text-gray-600 mb-4">Add liability limitation</p>
                <p className="text-gray-600 mb-4">Compliance Score: 75%</p>
              </div>
            </div>
          </div>
        )}

        {showVersionComparison && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Version 2.1 vs 2.0</h2>
                <button onClick={() => setShowVersionComparison(false)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="version-comparison" className="text-center py-8 text-gray-500">
                <p>Version comparison view</p>
              </div>
            </div>
          </div>
        )}

        {showReviewRequestDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Request Legal Review</h2>
                <button onClick={() => setShowReviewRequestDialog(null)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="review-request-dialog">
                <p className="text-gray-600 mb-4">Termination changes require legal approval</p>
                <p className="text-gray-600 mb-4">High risk clause detected</p>
                <label className="block text-sm font-medium text-gray-700 mb-2">Review Notes</label>
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} />
                <div className="flex justify-end space-x-3 mt-4">
                  <button onClick={() => setShowReviewRequestDialog(null)} className="px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg">Request Review</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showApprovalDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Approve Clause</h2>
                <button onClick={() => setShowApprovalDialog(null)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="approval-dialog">
                <label className="block text-sm font-medium text-gray-700 mb-2">Approval Notes</label>
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} />
                <div className="flex justify-end space-x-3 mt-4">
                  <button onClick={() => setShowApprovalDialog(null)} className="px-4 py-2 border border-gray-300 rounded-lg">Cancel</button>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg">Approve</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showWorkflowStepper && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Workflow Status</h2>
                <button onClick={() => setShowWorkflowStepper(null)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="workflow-stepper">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</div>
                    <span>Draft</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm">2</div>
                    <span>Review</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center text-sm">3</div>
                    <span>Approved</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showApprovalHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Approval History</h2>
                <button onClick={() => setShowApprovalHistory(null)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="approval-history">
                <div className="space-y-3">
                  <div className="p-3 border-l-4 border-green-500 bg-green-50">
                    <div className="font-medium">Approved by John Doe</div>
                    <div className="text-sm text-gray-600">January 15, 2024</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showVersionHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Version Timeline</h2>
                <button onClick={() => setShowVersionHistory(null)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="version-history-panel">
                <div className="space-y-3">
                  <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
                    <div className="font-medium">Version 2.1 (Current)</div>
                    <div className="text-sm text-gray-600">January 20, 2024</div>
                  </div>
                  <div className="p-3 border-l-4 border-gray-300 bg-gray-50">
                    <div className="font-medium">Version 2.0</div>
                    <div className="text-sm text-gray-600">January 10, 2024</div>
                  </div>
                </div>
                <div className="flex justify-center mt-4">
                  <button 
                    onClick={() => setShowVersionComparison(true)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Compare Versions
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAlternatives && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {showAlternatives === 'merge-dialog' ? 'Merge Clause Contents' : 
                   showAlternatives.startsWith('suggest-') ? 'Compliant Alternatives' :
                   'Alternative Clauses'}
                </h2>
                <button onClick={() => setShowAlternatives(null)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              
              {showAlternatives === 'merge-dialog' ? (
                <div data-testid="merge-dialog">
                  <p className="text-gray-600 mb-4">Select how to merge the conflicting payment terms:</p>
                  <div className="space-y-3">
                    <button className="block w-full p-3 text-left border rounded hover:bg-gray-50">Use 30-day payment terms</button>
                    <button className="block w-full p-3 text-left border rounded hover:bg-gray-50">Use immediate payment terms</button>
                    <button className="block w-full p-3 text-left border rounded hover:bg-gray-50">Create custom payment terms</button>
                  </div>
                </div>
              ) : showAlternatives.startsWith('suggest-') ? (
                <div>
                  <p className="text-gray-600 mb-4">Compliant alternatives available:</p>
                  <button className="block w-full p-3 text-left border rounded hover:bg-gray-50 mb-3">Replace with compliant version</button>
                </div>
              ) : (
                <div data-testid="alternatives-panel">
                  <p className="text-gray-600 mb-4">Choose an alternative clause:</p>
                  <div className="space-y-3">
                    <div data-testid="alternative-clause4" data-rank="1" className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">Extended Payment Terms</h4>
                          <p className="text-sm text-gray-600">Payment due within 45 days</p>
                        </div>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Best Match</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 mt-4">
                    <button onClick={() => setShowComparisonView(true)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Compare</button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Replace</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showComparisonView && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Clause Comparison</h2>
                <button onClick={() => setShowComparisonView(false)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="comparison-view" className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Original Clause</h3>
                  <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded">Payment shall be due within 30 days of invoice date.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Alternative Clause</h3>
                  <p className="text-sm text-gray-600 p-3 bg-blue-50 rounded">Payment shall be due within 45 days of invoice date.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAnalytics && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Usage Analytics</h2>
                <button onClick={() => setShowAnalytics(false)}><XMarkIcon className="h-6 w-6" /></button>
              </div>
              <div data-testid="usage-chart" className="space-y-4">
                <div className="text-center py-8">
                  <ChartBarIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Usage Trends</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="font-medium">Completion Rate: 85%</div>
                      <div className="text-gray-600">Average review time: 2.5 days</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="font-medium">Frequently used together</div>
                      <div className="text-gray-600">Consider adding termination clause</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {draggedItem && (
          <div data-testid="drag-preview" className="fixed top-4 left-4 z-50 p-2 bg-white border rounded shadow-lg pointer-events-none">
            <span className="text-sm font-medium">{draggedItem.title}</span>
          </div>
        )}

        <div id="live-region" role="status" aria-live="polite" className="sr-only"></div>
      </main>
    </div>
  );
};