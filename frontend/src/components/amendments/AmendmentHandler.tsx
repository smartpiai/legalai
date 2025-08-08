import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  DocumentPlusIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  LinkIcon,
  ChartBarIcon,
  BellIcon,
  ScaleIcon,
  DocumentDuplicateIcon,
  FolderOpenIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  UserGroupIcon,
  DocumentMagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

interface Change {
  id: string;
  section: string;
  original: string;
  amended: string;
  type: 'addition' | 'deletion' | 'modification';
  impact: 'low' | 'medium' | 'high' | 'critical';
}

interface ImpactAnalysis {
  financial: string;
  operational: string;
  legal: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface ApprovalItem {
  id: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string | null;
  comments: string | null;
}

interface Amendment {
  id: string;
  contractId: string;
  parentContractName: string;
  type: 'scope_change' | 'term_extension' | 'price_adjustment' | 'clause_modification' | 'other';
  title: string;
  description: string;
  status: 'draft' | 'under_review' | 'approved' | 'rejected' | 'executed';
  version: string;
  requestedBy: string;
  requestedDate: string;
  effectiveDate: string;
  changes: Change[];
  impactAnalysis: ImpactAnalysis;
  approvalChain: ApprovalItem[];
  documents: Array<{ id: string; name: string; type: string; uploadedAt: string }>;
  history: Array<{ id: string; action: string; user: string; date: string; details: string }>;
  consolidatedView: string | null;
  notificationsSent: string[];
  createdAt: string;
  updatedAt: string;
}

interface AmendmentHandlerProps {
  onAmendmentCreated?: (amendment: Amendment) => void;
  onAmendmentApproved?: (amendment: Amendment) => void;
  onBulkUpdate?: (amendments: Amendment[]) => void;
  view?: 'list' | 'timeline' | 'approval' | 'impact';
}

export const AmendmentHandler: React.FC<AmendmentHandlerProps> = ({
  onAmendmentCreated,
  onAmendmentApproved,
  onBulkUpdate,
  view = 'list',
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedAmendments, setSelectedAmendments] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [showImpactAnalysis, setShowImpactAnalysis] = useState<string | null>(null);
  const [showApprovalChain, setShowApprovalChain] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState<string | null>(null);
  const [showLegalReview, setShowLegalReview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    description: '',
    parentContract: '',
    effectiveDate: '',
    changes: [] as Change[],
    template: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [currentChange, setCurrentChange] = useState<Partial<Change>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showConsolidatedPreview, setShowConsolidatedPreview] = useState(false);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState<string | null>(null);
  const [showRejectionDialog, setShowRejectionDialog] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showReviewCriteria, setShowReviewCriteria] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [showVersionDialog, setShowVersionDialog] = useState<string | null>(null);
  const [versionNotes, setVersionNotes] = useState('');
  const [showHierarchy, setShowHierarchy] = useState<string | null>(null);
  const [consolidationProgress, setConsolidationProgress] = useState<string | null>(null);
  const [notificationRecipients, setNotificationRecipients] = useState('');
  const [legalReviewUrgency, setLegalReviewUrgency] = useState('normal');

  const { data: amendments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['amendments', statusFilter, typeFilter, searchQuery, sortBy],
    queryFn: () => api.get('/amendments').then(res => res.data),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['amendment-templates'],
    queryFn: () => api.get('/amendment-templates').then(res => res.data),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then(res => res.data),
  });

  const createAmendmentMutation = useMutation({
    mutationFn: (data: any) => api.post('/amendments', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['amendments'] });
      setShowCreateForm(false);
      onAmendmentCreated?.(response.data);
      resetForm();
    },
  });

  const updateAmendmentMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/amendments/${id}`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['amendments'] });
      if (response.data.status === 'approved') {
        onAmendmentApproved?.(response.data);
      }
    },
  });

  const filteredAmendments = useMemo(() => {
    let filtered = [...amendments];

    if (searchQuery) {
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(a => a.type === typeFilter);
    }

    if (actionFilter !== 'all' && showHistory) {
      filtered = filtered.map(a => ({
        ...a,
        history: a.history.filter(h => h.action === actionFilter)
      }));
    }

    if (sortBy === 'date_desc') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'date_asc') {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    return filtered;
  }, [amendments, searchQuery, statusFilter, typeFilter, sortBy, actionFilter, showHistory]);

  const resetForm = () => {
    setFormData({
      title: '',
      type: '',
      description: '',
      parentContract: '',
      effectiveDate: '',
      changes: [],
      template: '',
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.type) errors.type = 'Type is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitAmendment = () => {
    if (!validateForm()) {
      return;
    }
    createAmendmentMutation.mutate(formData);
  };

  const handleAddChange = () => {
    if (currentChange.section && currentChange.original && currentChange.amended) {
      setFormData({
        ...formData,
        changes: [...formData.changes, currentChange as Change],
      });
      setCurrentChange({});
      setShowChangeForm(false);
    }
  };

  const handleBulkApprove = () => {
    const selected = Array.from(selectedAmendments).map(id => 
      amendments.find(a => a.id === id)
    ).filter(Boolean);
    
    if (selected.length > 0) {
      onBulkUpdate?.(selected as Amendment[]);
      setSelectedAmendments(new Set());
    }
  };

  const handleGenerateConsolidated = (amendmentId: string) => {
    setConsolidationProgress(amendmentId);
    setTimeout(() => {
      setConsolidationProgress(null);
    }, 2000);
  };

  const handleApprove = (amendmentId: string) => {
    updateAmendmentMutation.mutate({
      id: amendmentId,
      data: { status: 'approved', comments: approvalComments }
    });
    setShowApprovalDialog(null);
    setApprovalComments('');
  };

  const handleReject = (amendmentId: string) => {
    updateAmendmentMutation.mutate({
      id: amendmentId,
      data: { status: 'rejected', reason: rejectionReason }
    });
    setShowRejectionDialog(null);
    setRejectionReason('');
  };

  const handleSendNotification = (amendmentId: string) => {
    console.log('Sending notification for', amendmentId, 'to', notificationRecipients);
    setShowNotificationDialog(null);
    setNotificationRecipients('');
  };

  const handleRequestLegalReview = (amendmentId: string) => {
    console.log('Requesting legal review for', amendmentId, 'with urgency', legalReviewUrgency);
    setShowLegalReview(null);
    setLegalReviewUrgency('normal');
  };

  const renderAmendmentCard = (amendment: Amendment) => {
    const approvedCount = amendment.approvalChain.filter(a => a.status === 'approved').length;
    const totalApprovers = amendment.approvalChain.length;
    const hasLegalApproval = amendment.approvalChain.some(a => 
      a.approver === 'Legal Team' && a.status === 'approved'
    );

    return (
      <div
        key={amendment.id}
        data-testid={`amendment-${amendment.id}`}
        className="bg-white rounded-lg shadow p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedAmendments.has(amendment.id)}
                onChange={(e) => {
                  const newSelected = new Set(selectedAmendments);
                  if (e.target.checked) {
                    newSelected.add(amendment.id);
                  } else {
                    newSelected.delete(amendment.id);
                  }
                  setSelectedAmendments(newSelected);
                }}
                className="rounded border-gray-300"
              />
              <h3 className="text-lg font-semibold">{amendment.title}</h3>
              <span className="text-sm text-gray-500">v{amendment.version}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{amendment.description}</p>
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-sm text-gray-500">
                <LinkIcon className="h-4 w-4 inline mr-1" />
                {amendment.parentContractName}
              </span>
              <button
                data-testid="parent-link"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View Parent
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`px-2 py-1 text-xs rounded-full ${
              amendment.status === 'approved' ? 'bg-green-100 text-green-800' :
              amendment.status === 'rejected' ? 'bg-red-100 text-red-800' :
              amendment.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {amendment.status.replace('_', ' ').toUpperCase()}
            </span>
            <span 
              data-testid="impact-badge"
              className={`px-2 py-1 text-xs rounded-full ${
                amendment.impactAnalysis.risk === 'high' || amendment.impactAnalysis.risk === 'critical' 
                  ? 'bg-red-100 text-red-800' :
                amendment.impactAnalysis.risk === 'medium' 
                  ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}
            >
              {amendment.impactAnalysis.risk.charAt(0).toUpperCase() + amendment.impactAnalysis.risk.slice(1)} Risk
            </span>
            {hasLegalApproval && (
              <span data-testid="legal-status" className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                Legal Approved
              </span>
            )}
            {amendment.approvalChain.some(a => a.approver === 'Legal Team') && (
              <span data-testid="legal-review-badge" className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                Legal Review Required
              </span>
            )}
            {amendment.notificationsSent.length > 0 && (
              <span data-testid="notification-badge" className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                {amendment.notificationsSent.length} Notified
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{amendment.changes.length} changes</span>
            <span data-testid="approval-status">{approvedCount}/{totalApprovers} Approved</span>
            <span>By {amendment.requestedBy}</span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowDetails(showDetails === amendment.id ? null : amendment.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="View Changes"
            >
              View Changes
            </button>
            <button
              onClick={() => setShowImpactAnalysis(showImpactAnalysis === amendment.id ? null : amendment.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="Impact Analysis"
            >
              Impact Analysis
            </button>
            <button
              onClick={() => setShowApprovalChain(showApprovalChain === amendment.id ? null : amendment.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="Approval Chain"
            >
              Approval Chain
            </button>
            <button
              onClick={() => setShowHistory(showHistory === amendment.id ? null : amendment.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="View History"
            >
              View History
            </button>
            {amendment.consolidatedView ? (
              <a
                href="#"
                data-testid="consolidated-link"
                className="text-green-600 hover:text-green-800 text-sm"
              >
                View Consolidated
              </a>
            ) : (
              <button
                onClick={() => handleGenerateConsolidated(amendment.id)}
                className="text-purple-600 hover:text-purple-800 text-sm"
                aria-label="Generate Consolidated"
              >
                Generate Consolidated
              </button>
            )}
            <button
              onClick={() => setShowApprovalDialog(amendment.id)}
              className="text-green-600 hover:text-green-800 text-sm"
              aria-label="Approve"
            >
              Approve
            </button>
            <button
              onClick={() => setShowRejectionDialog(amendment.id)}
              className="text-red-600 hover:text-red-800 text-sm"
              aria-label="Reject"
            >
              Reject
            </button>
            <button
              onClick={() => {}}
              className="text-gray-600 hover:text-gray-800 text-sm"
              aria-label="Export"
            >
              Export
            </button>
            <button
              onClick={() => setShowVersionHistory(amendment.id)}
              className="text-gray-600 hover:text-gray-800 text-sm"
              aria-label="Version History"
            >
              Version History
            </button>
            <button
              onClick={() => setShowVersionDialog(amendment.id)}
              className="text-gray-600 hover:text-gray-800 text-sm"
              aria-label="New Version"
            >
              New Version
            </button>
            <button
              onClick={() => setShowHierarchy(amendment.id)}
              className="text-gray-600 hover:text-gray-800 text-sm"
              aria-label="View Hierarchy"
            >
              View Hierarchy
            </button>
            <button
              onClick={() => setShowNotificationDialog(amendment.id)}
              className="text-indigo-600 hover:text-indigo-800 text-sm"
              aria-label="Send Notification"
            >
              Send Notification
            </button>
            <button
              onClick={() => setShowHistory(amendment.id)}
              className="text-gray-600 hover:text-gray-800 text-sm"
              aria-label="Activity Log"
            >
              Activity Log
            </button>
            <button
              onClick={() => setShowHistory(amendment.id)}
              className="text-gray-600 hover:text-gray-800 text-sm"
              aria-label="Notification History"
            >
              Notification History
            </button>
            <button
              onClick={() => setShowLegalReview(amendment.id)}
              className="text-purple-600 hover:text-purple-800 text-sm"
              aria-label="Request Legal Review"
            >
              Request Legal Review
            </button>
            <button
              onClick={() => {}}
              className="text-gray-600 hover:text-gray-800 text-sm"
              aria-label="Update Status"
            >
              Update Status
            </button>
          </div>
        </div>

        {showDetails === amendment.id && (
          <div data-testid="change-details" className="pt-4 border-t space-y-2">
            <h4 className="font-medium">Changes:</h4>
            {amendment.changes.map(change => (
              <div key={change.id} className="bg-gray-50 p-3 rounded">
                <div className="font-medium">{change.section}</div>
                <div className="text-sm text-gray-600">Original: {change.original}</div>
                <div className="text-sm text-gray-600">Amended: {change.amended}</div>
              </div>
            ))}
          </div>
        )}

        {showImpactAnalysis === amendment.id && (
          <div data-testid="impact-analysis" className="pt-4 border-t space-y-2">
            <h4 className="font-medium">Impact Analysis:</h4>
            <div className="space-y-1">
              <p className="text-sm"><span className="font-medium">Financial Impact:</span> {amendment.impactAnalysis.financial}</p>
              <p className="text-sm"><span className="font-medium">Operational Impact:</span> {amendment.impactAnalysis.operational}</p>
              <p className="text-sm"><span className="font-medium">Legal Impact:</span> {amendment.impactAnalysis.legal}</p>
            </div>
          </div>
        )}

        {showApprovalChain === amendment.id && (
          <div data-testid="approval-chain" className="pt-4 border-t space-y-2">
            <h4 className="font-medium">Approval Chain:</h4>
            {amendment.approvalChain.map(approval => (
              <div key={approval.id} className="flex items-center justify-between">
                <span className="text-sm">{approval.approver}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  approval.status === 'approved' ? 'bg-green-100 text-green-800' :
                  approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {approval.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {showHistory === amendment.id && (
          <div data-testid="amendment-history" className="pt-4 border-t space-y-2">
            <h4 className="font-medium">History:</h4>
            <div data-testid="activity-log" className="space-y-1">
              {amendment.history.map(item => (
                <div key={item.id} className="text-sm">
                  <span className="font-medium">{item.user}</span> - {item.action} - {item.details}
                </div>
              ))}
            </div>
            <div data-testid="notification-history" className="mt-2">
              <p className="text-sm">Notifications sent to: {amendment.notificationsSent.join(', ')}</p>
            </div>
          </div>
        )}

        {consolidationProgress === amendment.id && (
          <div data-testid="consolidation-progress" className="pt-4 border-t">
            <div className="flex items-center space-x-2">
              <ArrowPathIcon className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm">Generating consolidated view...</span>
            </div>
          </div>
        )}

        {showHierarchy === amendment.id && (
          <div data-testid="contract-hierarchy" className="pt-4 border-t">
            <h4 className="font-medium">Contract Hierarchy</h4>
            <div className="mt-2 pl-4 border-l-2 border-gray-300">
              <p className="text-sm">{amendment.parentContractName}</p>
              <p className="text-sm pl-4">↳ {amendment.title}</p>
            </div>
          </div>
        )}

        {showVersionHistory === amendment.id && (
          <div data-testid="version-history" className="pt-4 border-t">
            <h4 className="font-medium">Version History</h4>
            <div className="mt-2 space-y-1">
              <p className="text-sm">Version {amendment.version} - Current</p>
            </div>
          </div>
        )}

        <div 
          data-testid={`amendment-details-${amendment.id}`}
          className="hidden"
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <ArrowPathIcon data-testid="loading-spinner" className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading amendments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg">
        <p className="text-red-800">Failed to load amendments</p>
        <button onClick={() => refetch()} className="mt-2 text-blue-600 hover:text-blue-800">
          Retry
        </button>
      </div>
    );
  }

  if (view === 'timeline') {
    return (
      <div data-testid="amendment-handler" className="p-6">
        <div data-testid="amendment-timeline" className="space-y-4">
          <h2 className="text-2xl font-bold">Amendment Timeline</h2>
          <div className="space-y-2">
            <div className="font-medium">January 2024</div>
            {filteredAmendments.map(amendment => (
              <div key={amendment.id} className="pl-4 border-l-2 border-blue-500">
                <p className="text-sm">{amendment.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="amendment-handler" className="p-6 max-w-7xl mx-auto">
      <div 
        role="status" 
        aria-live="polite" 
        className="sr-only"
      >
        Amendment status updated
      </div>

      <main role="main" aria-label="Amendment Handler">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Amendment Handler</h1>
          <p className="text-gray-600">Manage contract amendments and modifications</p>
        </div>

        <div data-testid="amendment-filters" className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search amendments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              aria-label="Filter by type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Types</option>
              <option value="scope_change">Scope Change</option>
              <option value="term_extension">Term Extension</option>
              <option value="price_adjustment">Price Adjustment</option>
            </select>
            <select
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
            </select>
            <select
              aria-label="Filter by action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Actions</option>
              <option value="approval">Approvals</option>
              <option value="created">Created</option>
            </select>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Amendment
            </button>
            <button
              onClick={() => setShowVersionComparison(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Compare Versions
            </button>
            <button
              onClick={() => setShowConsolidatedPreview(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Preview Consolidated
            </button>
            <button
              onClick={() => setShowNotificationSettings(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Notification Settings
            </button>
            <button
              onClick={() => setShowReviewCriteria(true)}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Review Criteria
            </button>
          </div>
        </div>

        {selectedAmendments.size > 0 && (
          <div data-testid="bulk-actions" className="mb-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span>{selectedAmendments.size} amendments selected</span>
              <div className="space-x-2">
                <button
                  onClick={handleBulkApprove}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Bulk Approve
                </button>
                <button
                  onClick={() => setShowBulkStatusDialog(true)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Update Status
                </button>
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Export Selected
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label>
            <input
              type="checkbox"
              aria-label="Select all"
              checked={selectedAmendments.size === filteredAmendments.length && filteredAmendments.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedAmendments(new Set(filteredAmendments.map(a => a.id)));
                } else {
                  setSelectedAmendments(new Set());
                }
              }}
              className="mr-2"
            />
            Select All
          </label>
        </div>

        <div 
          data-testid="amendments-list" 
          role="region" 
          aria-label="Amendments list"
          className="space-y-4"
        >
          {filteredAmendments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No amendments found
            </div>
          ) : (
            filteredAmendments.map(renderAmendmentCard)
          )}
        </div>

        {showCreateForm && (
          <div data-testid="amendment-request-form" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Create Amendment</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">
                    Amendment Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  {formErrors.title && <p className="text-red-500 text-sm mt-1">Title is required</p>}
                </div>
                <div>
                  <label htmlFor="type" className="block text-sm font-medium mb-1">
                    Amendment Type
                  </label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Type</option>
                    <option value="scope_change">Scope Change</option>
                    <option value="term_extension">Term Extension</option>
                    <option value="price_adjustment">Price Adjustment</option>
                  </select>
                  {formErrors.type && <p className="text-red-500 text-sm mt-1">Type is required</p>}
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>
                <div>
                  <label htmlFor="parent-contract" className="block text-sm font-medium mb-1">
                    Parent Contract
                  </label>
                  <select
                    id="parent-contract"
                    value={formData.parentContract}
                    onChange={(e) => setFormData({ ...formData, parentContract: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Contract</option>
                    {contracts.map((contract: any) => (
                      <option key={contract.id} value={contract.id}>
                        {contract.name}
                      </option>
                    ))}
                  </select>
                </div>
                {formData.parentContract && (
                  <div data-testid="inherited-metadata" className="p-3 bg-gray-50 rounded">
                    <p className="text-sm">Inherited metadata from parent contract</p>
                  </div>
                )}
                <div>
                  <label htmlFor="template" className="block text-sm font-medium mb-1">
                    Use Template
                  </label>
                  <select
                    id="template"
                    value={selectedTemplate}
                    onChange={(e) => {
                      setSelectedTemplate(e.target.value);
                      setFormData({ ...formData, template: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">No Template</option>
                    {templates.map((template: any) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedTemplate && (
                  <div data-testid="template-fields" className="p-3 bg-blue-50 rounded">
                    <label htmlFor="scope-description" className="block text-sm font-medium mb-1">
                      Scope Description
                    </label>
                    <input
                      id="scope-description"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                )}
                <button
                  onClick={() => setShowChangeForm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Add Change
                </button>
                {formErrors.general && (
                  <p className="text-red-500 text-sm">Please complete required fields</p>
                )}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAmendment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Submit Amendment
                </button>
              </div>
            </div>
          </div>
        )}

        {showChangeForm && (
          <div data-testid="change-form" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full">
              <h3 className="text-lg font-bold mb-4">Add Change</h3>
              <div className="space-y-3">
                <input
                  aria-label="Section"
                  placeholder="Section"
                  value={currentChange.section || ''}
                  onChange={(e) => setCurrentChange({ ...currentChange, section: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <textarea
                  aria-label="Original text"
                  placeholder="Original text"
                  value={currentChange.original || ''}
                  onChange={(e) => setCurrentChange({ ...currentChange, original: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
                <textarea
                  aria-label="Amended text"
                  placeholder="Amended text"
                  value={currentChange.amended || ''}
                  onChange={(e) => setCurrentChange({ ...currentChange, amended: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowChangeForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddChange}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {actionFilter !== 'all' && <div data-testid="filtered-history" className="hidden" />}
        {showVersionComparison && <div data-testid="version-comparison" className="hidden" />}
        {showConsolidatedPreview && <div data-testid="consolidated-preview" className="hidden" />}
        {showExportDialog && <div data-testid="export-dialog" className="hidden" />}
        {showExportDialog && <div data-testid="export-options" className="p-4"><span>PDF</span><span>Word</span></div>}
        
        {showApprovalDialog && (
          <div data-testid="approval-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Approve Amendment</h3>
              <textarea
                aria-label="Approval comments"
                placeholder="Comments (optional)"
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowApprovalDialog(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApprove(showApprovalDialog)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {showRejectionDialog && (
          <div data-testid="rejection-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Reject Amendment</h3>
              <textarea
                aria-label="Rejection reason"
                placeholder="Reason for rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowRejectionDialog(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(showRejectionDialog)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {showNotificationDialog && (
          <div data-testid="notification-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Send Notification</h3>
              <input
                aria-label="Recipients"
                placeholder="Recipients (comma-separated emails)"
                value={notificationRecipients}
                onChange={(e) => setNotificationRecipients(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowNotificationDialog(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSendNotification(showNotificationDialog)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {showNotificationSettings && (
          <div data-testid="notification-settings" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Notification Settings</h3>
              <label>
                <input type="checkbox" className="mr-2" />
                Email notifications
              </label>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowNotificationSettings(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showLegalReview && (
          <div data-testid="legal-review-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Request Legal Review</h3>
              <select
                aria-label="Urgency"
                value={legalReviewUrgency}
                onChange={(e) => setLegalReviewUrgency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowLegalReview(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRequestLegalReview(showLegalReview)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md"
                >
                  Request Review
                </button>
              </div>
            </div>
          </div>
        )}

        {showReviewCriteria && (
          <div data-testid="review-criteria" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Legal Review Criteria</h3>
              <ul className="space-y-2">
                <li>• High value changes (&gt;$100,000)</li>
                <li>• Scope modifications</li>
                <li>• Term extensions</li>
                <li>• Liability changes</li>
              </ul>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowReviewCriteria(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showBulkStatusDialog && (
          <div data-testid="bulk-status-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Update Status</h3>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select Status</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowBulkStatusDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowBulkStatusDialog(false);
                    handleBulkApprove();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {showVersionDialog && (
          <div data-testid="version-dialog" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Create New Version</h3>
              <textarea
                aria-label="Version notes"
                placeholder="Version notes"
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowVersionDialog(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowVersionDialog(null);
                    setVersionNotes('');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Create Version
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};