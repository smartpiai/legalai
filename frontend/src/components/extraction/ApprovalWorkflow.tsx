import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BellIcon,
  EllipsisVerticalIcon,
  CalendarIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface ExtractedField {
  id: string;
  name: string;
  type: 'text' | 'date' | 'number' | 'boolean' | 'list' | 'entity';
  value: any;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  reviewedBy?: string;
  reviewedAt?: string;
  category: string;
  required: boolean;
}

interface ApprovalStep {
  id: string;
  name: string;
  description: string;
  requiredRole: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
  completedBy?: string;
  comments?: string;
  order: number;
}

interface WorkflowInstance {
  id: string;
  extractionResultId: string;
  documentName: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
  currentStep: number;
  steps: ApprovalStep[];
  createdAt: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  submittedBy: string;
  totalFields: number;
  approvedFields: number;
  rejectedFields: number;
  pendingFields: number;
}

interface ApprovalWorkflowProps {
  workflowInstance: WorkflowInstance;
  extractedFields: ExtractedField[];
  currentUser: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  onApprove?: (stepId: string, comments?: string) => void;
  onReject?: (stepId: string, comments: string) => void;
  onAssignStep?: (stepId: string, userId: string) => void;
  onFieldStatusChange?: (fieldId: string, status: ExtractedField['status'], comments?: string) => void;
  onWorkflowAction?: (action: 'cancel' | 'restart' | 'escalate') => void;
  onSendNotification?: (recipientId: string, message: string) => void;
}

type FieldStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'needs_review';

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  workflowInstance,
  extractedFields,
  currentUser,
  onApprove,
  onReject,
  onAssignStep,
  onFieldStatusChange,
  onWorkflowAction,
  onSendNotification,
}) => {
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [rejectComments, setRejectComments] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [fieldStatusFilter, setFieldStatusFilter] = useState<FieldStatusFilter>('all');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [stepComments, setStepComments] = useState<Record<string, string>>({});
  const [newComment, setNewComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const { status, currentStep, steps, dueDate, priority, totalFields, approvedFields, rejectedFields, pendingFields } = workflowInstance;

  // Check if workflow is overdue
  const isOverdue = useMemo(() => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }, [dueDate]);

  // Get current active step
  const currentStepData = useMemo(() => {
    return steps.find(step => step.order === currentStep);
  }, [steps, currentStep]);

  // Filter fields by status
  const filteredFields = useMemo(() => {
    if (fieldStatusFilter === 'all') return extractedFields;
    return extractedFields.filter(field => field.status === fieldStatusFilter);
  }, [extractedFields, fieldStatusFilter]);

  // Calculate progress
  const workflowProgress = useMemo(() => {
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  }, [steps]);

  const fieldProgress = useMemo(() => {
    if (totalFields === 0) return 0;
    return Math.round((approvedFields / totalFields) * 100);
  }, [approvedFields, totalFields]);

  // Check user permissions
  const canApprove = currentUser.permissions.includes('approve_extractions');
  const canAssign = currentUser.permissions.includes('assign_tasks');
  const isAssignedToCurrentStep = currentStepData?.assignedTo === currentUser.id;
  const canPerformStepActions = canApprove && isAssignedToCurrentStep;

  // Calculate time remaining
  const timeRemaining = useMemo(() => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diff = due.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  }, [dueDate]);

  // Handle step approval
  const handleApproveStep = async (stepId: string) => {
    try {
      await onApprove?.(stepId, stepComments[stepId]);
      setStatusMessage('Step approved successfully');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      setStatusMessage('Failed to approve step');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  // Handle step rejection
  const handleRejectStep = async (stepId: string) => {
    if (!rejectComments.trim()) {
      setStatusMessage('Comments required for rejection');
      setTimeout(() => setStatusMessage(''), 3000);
      return;
    }
    
    try {
      await onReject?.(stepId, rejectComments);
      setShowRejectDialog(null);
      setRejectComments('');
      setStatusMessage('Step rejected');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      setStatusMessage('Failed to reject step');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  // Handle step assignment
  const handleAssignStep = async (stepId: string) => {
    if (!selectedUser) return;
    
    await onAssignStep?.(stepId, selectedUser);
    setShowAssignDialog(null);
    setSelectedUser('');
  };

  // Handle field status change
  const handleFieldStatusChange = async (fieldId: string, status: ExtractedField['status']) => {
    await onFieldStatusChange?.(fieldId, status);
  };

  // Handle workflow actions
  const handleWorkflowAction = async (action: 'cancel' | 'restart' | 'escalate') => {
    await onWorkflowAction?.(action);
    setShowActionsMenu(false);
  };

  // Handle notification sending
  const handleSendNotification = async () => {
    if (!notificationMessage.trim()) return;
    
    const recipient = currentStepData?.assignedTo || currentUser.id;
    await onSendNotification?.(recipient, notificationMessage);
    setShowNotificationDialog(false);
    setNotificationMessage('');
  };

  // Add comment to step
  const addStepComment = (stepId: string) => {
    if (!commentText.trim()) return;
    
    setStepComments(prev => ({
      ...prev,
      [stepId]: prev[stepId] ? `${prev[stepId]}\n${commentText}` : commentText,
    }));
    setNewComment(null);
    setCommentText('');
  };

  // Toggle step expansion
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  // Keyboard navigation for steps
  const handleStepKeyDown = (e: React.KeyboardEvent, stepIndex: number) => {
    if (e.key === 'ArrowDown' && stepIndex < steps.length - 1) {
      const nextStep = document.getElementById(`step-${steps[stepIndex + 1].id}`);
      nextStep?.focus();
    } else if (e.key === 'ArrowUp' && stepIndex > 0) {
      const prevStep = document.getElementById(`step-${steps[stepIndex - 1].id}`);
      prevStep?.focus();
    }
  };

  const getPriorityClass = (priority: WorkflowInstance['priority']) => {
    switch (priority) {
      case 'urgent': return 'urgent text-red-600 bg-red-100';
      case 'high': return 'high text-orange-600 bg-orange-100';
      case 'medium': return 'medium text-yellow-600 bg-yellow-100';
      case 'low': return 'low text-green-600 bg-green-100';
      default: return 'medium text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusClass = (status: WorkflowInstance['status']) => {
    switch (status) {
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      case 'cancelled': return 'text-gray-600';
      case 'in_progress': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStepStatusIcon = (status: ApprovalStep['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'in_progress': return <ClockIcon className="h-5 w-5 text-blue-500" />;
      case 'skipped': return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getFieldStatusClass = (status: ExtractedField['status']) => {
    switch (status) {
      case 'approved': return 'approved text-green-600 bg-green-50';
      case 'rejected': return 'rejected text-red-600 bg-red-50';
      case 'needs_review': return 'needs-review text-orange-600 bg-orange-50';
      default: return 'pending text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.9) return 'high-confidence text-green-600';
    if (confidence >= 0.7) return 'medium-confidence text-yellow-600';
    return 'low-confidence text-red-600';
  };

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser.permissions.includes('view_workflow')) {
    return (
      <div className="p-8 text-center">
        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">You don't have permission to view this workflow.</p>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="p-8 text-center">
        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No workflow steps defined.</p>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Approval workflow" className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900 mr-4">{workflowInstance.documentName}</h1>
            <div className={`px-2 py-1 rounded text-sm font-medium capitalize ${getStatusClass(status)}`}>
              {status.replace('_', ' ')}
            </div>
            <div
              data-testid="priority-indicator"
              className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getPriorityClass(priority)}`}
            >
              {priority} priority
            </div>
            {isOverdue && (
              <div data-testid="overdue-indicator" className="ml-2 px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-medium">
                Overdue
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Step {currentStep} of {steps.length}
            </span>
            {timeRemaining && (
              <span data-testid="time-remaining" className="text-sm text-gray-600">
                {timeRemaining}
              </span>
            )}
            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="p-2 hover:bg-gray-100 rounded"
                aria-label="Workflow actions"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
                  {status !== 'cancelled' && (
                    <button
                      onClick={() => handleWorkflowAction('cancel')}
                      role="menuitem"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                    >
                      Cancel Workflow
                    </button>
                  )}
                  {(status === 'rejected' || status === 'cancelled') && (
                    <button
                      onClick={() => handleWorkflowAction('restart')}
                      role="menuitem"
                      className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                    >
                      Restart Workflow
                    </button>
                  )}
                  <button
                    onClick={() => handleWorkflowAction('escalate')}
                    role="menuitem"
                    className="block px-4 py-2 text-sm hover:bg-gray-100 w-full text-left"
                  >
                    Escalate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Workflow Progress</span>
              <span>{workflowProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                role="progressbar"
                aria-valuenow={workflowProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${workflowProgress}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Field Approval</span>
              <span data-testid="field-progress">{fieldProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${fieldProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Field Statistics */}
        <div className="flex items-center space-x-6 text-sm">
          <span className="text-green-600">{approvedFields} approved</span>
          <span className="text-red-600">{rejectedFields} rejected</span>
          <span className="text-gray-600">{pendingFields} pending</span>
          <span data-testid="estimated-completion" className="text-blue-600">
            Est. completion: 2-3 days
          </span>
        </div>

        {!canApprove && (
          <div className="mt-2 text-sm text-gray-500">
            Read-only access - You cannot approve or reject items
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Workflow Steps */}
        <div role="group" aria-label="Workflow steps" className="w-1/2 border-r overflow-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Workflow Steps</h2>
            <button
              onClick={() => setShowNotificationDialog(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              aria-label="Send notification"
            >
              <BellIcon className="h-4 w-4 inline mr-1" />
              Notify
            </button>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => {
              const isCurrentStep = step.order === currentStep;
              const isExpanded = expandedSteps.has(step.id);

              return (
                <div
                  key={step.id}
                  id={`step-${step.id}`}
                  data-testid={`step-${step.id}`}
                  tabIndex={0}
                  onKeyDown={(e) => handleStepKeyDown(e, index)}
                  className={`border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isCurrentStep ? 'current-step bg-blue-50 border-blue-200' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getStepStatusIcon(step.status)}
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h3 className="font-medium text-gray-900">{step.name}</h3>
                          <span className="ml-2 text-xs text-gray-500">({step.requiredRole})</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                        
                        {step.assignedTo && (
                          <div className="flex items-center mt-2 text-sm text-gray-600">
                            <UserIcon className="h-4 w-4 mr-1" />
                            Assigned to: {step.assignedTo}
                          </div>
                        )}

                        {step.completedAt && (
                          <div className="flex items-center mt-2 text-sm text-gray-600">
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            {new Date(step.completedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                            {step.completedBy && ` by ${step.completedBy}`}
                          </div>
                        )}

                        {step.comments && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            {step.comments}
                          </div>
                        )}

                        {stepComments[step.id] && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                            {stepComments[step.id]}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {isCurrentStep && canPerformStepActions && (
                        <>
                          <button
                            onClick={() => handleApproveStep(step.id)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            aria-label={`Approve ${step.name.toLowerCase()} step`}
                          >
                            Approve Step
                          </button>
                          <button
                            onClick={() => setShowRejectDialog(step.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                            aria-label="Reject step"
                          >
                            Reject Step
                          </button>
                        </>
                      )}

                      {!step.assignedTo && canAssign && (
                        <button
                          onClick={() => setShowAssignDialog(step.id)}
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                          aria-label="Assign step"
                        >
                          Assign Step
                        </button>
                      )}

                      {isCurrentStep && (
                        <button
                          onClick={() => setNewComment(step.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          aria-label="Add comment"
                        >
                          <ChatBubbleLeftIcon className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleStepExpansion(step.id)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Step Details</h4>
                      <div className="text-sm text-gray-600">
                        <div>Required Role: {step.requiredRole}</div>
                        <div>Order: {step.order}</div>
                        <div>Status: {step.status}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div data-testid="audit-trail" className="mt-6 p-3 bg-gray-50 rounded">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Audit Trail</h3>
            <div className="text-xs text-gray-600">
              <div>Created: {new Date(workflowInstance.createdAt).toLocaleString()}</div>
              <div>Submitted by: {workflowInstance.submittedBy}</div>
              {workflowInstance.dueDate && (
                <div>Due: {new Date(workflowInstance.dueDate).toLocaleString()}</div>
              )}
            </div>
          </div>
        </div>

        {/* Field Review */}
        <div role="group" aria-label="Field review" className="w-1/2 overflow-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Field Review</h2>
            <select
              value={fieldStatusFilter}
              onChange={(e) => setFieldStatusFilter(e.target.value as FieldStatusFilter)}
              aria-label="Filter by field status"
              role="combobox"
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Fields</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_review">Needs Review</option>
            </select>
          </div>

          <div className="space-y-3">
            {filteredFields.map(field => (
              <div
                key={field.id}
                data-testid={`field-${field.id}`}
                className="border rounded-lg p-3 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <span className="font-medium text-gray-900">
                        {field.name}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      <span className="ml-2 px-1 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {field.type}
                      </span>
                    </div>
                    
                    <div className="text-gray-700 mb-2">
                      {field.value?.toString() || 'N/A'}
                    </div>

                    <div className="flex items-center space-x-4 text-sm">
                      <span
                        data-testid={`field-${field.id}-confidence`}
                        className={`font-medium ${getConfidenceClass(field.confidence)}`}
                      >
                        {Math.round(field.confidence * 100)}% confidence
                      </span>
                      
                      <div
                        data-testid={`field-${field.id}-status`}
                        className={`px-2 py-1 rounded text-xs font-medium ${getFieldStatusClass(field.status)}`}
                      >
                        {field.status.replace('_', ' ')}
                      </div>

                      {field.reviewedBy && (
                        <span className="text-gray-500">
                          by {field.reviewedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  {canPerformStepActions && (
                    <div data-testid={`field-${field.id}-actions`} className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => handleFieldStatusChange(field.id, 'approved')}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                        aria-label="Approve field"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleFieldStatusChange(field.id, 'rejected')}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        aria-label="Reject field"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleFieldStatusChange(field.id, 'needs_review')}
                        className="p-1 text-orange-600 hover:bg-orange-100 rounded"
                        aria-label="Mark for review"
                      >
                        <ExclamationTriangleIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Region for Accessibility */}
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>

      {/* Dialogs */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reject Step</h3>
            <textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              placeholder="Please provide comments for rejection..."
              aria-label="Rejection comments"
              className="w-full p-2 border rounded mb-4"
              rows={3}
              required
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowRejectDialog(null);
                  setRejectComments('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectStep(showRejectDialog)}
                className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
                aria-label="Submit rejection"
              >
                Submit Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Assign Step</h3>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              aria-label="Assign to user"
              role="combobox"
              className="w-full p-2 border rounded mb-4"
            >
              <option value="">Select user...</option>
              <option value="user1">John Doe</option>
              <option value="user2">Jane Smith</option>
              <option value="user3">Bob Johnson</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowAssignDialog(null);
                  setSelectedUser('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignStep(showAssignDialog)}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                aria-label="Confirm assignment"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotificationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Send Notification</h3>
            <textarea
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              placeholder="Enter notification message..."
              aria-label="Notification message"
              className="w-full p-2 border rounded mb-4"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowNotificationDialog(false);
                  setNotificationMessage('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNotification}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                aria-label="Send"
              >
                Send
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
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment..."
              aria-label="Add comment"
              className="w-full p-2 border rounded mb-4"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setNewComment(null);
                  setCommentText('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => addStepComment(newComment)}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
                aria-label="Save comment"
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      {showActionsMenu && (
        <>
          {/* Cancel Workflow Confirmation */}
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ display: 'none' }}>
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold mb-4">Cancel Workflow?</h3>
              <p className="mb-4">This will cancel the entire workflow. This action cannot be undone.</p>
              <div className="flex justify-end space-x-2">
                <button className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300">
                  Keep Workflow
                </button>
                <button
                  onClick={() => handleWorkflowAction('cancel')}
                  className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700"
                  aria-label="Confirm cancellation"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};