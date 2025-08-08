import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CogIcon,
  PrinterIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid, ClockIcon as ClockSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

// Types
interface WorkflowStep {
  id: string;
  name: string;
  order: number;
  type: 'approval' | 'signature' | 'review';
  assignedTo: string;
  required: boolean;
  status: 'pending' | 'waiting' | 'completed' | 'rejected';
  completedBy: string | null;
  completedAt: string | null;
  deadline: string;
  notarization?: boolean;
  witnesses?: string[];
}

interface Signature {
  id: string;
  type: 'electronic' | 'wet';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedTo: string;
  status: 'pending' | 'completed';
  notarization?: boolean;
}

interface Document {
  id: string;
  name: string;
  pages: number;
  signatures: Signature[];
}

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  type: 'sequential' | 'parallel' | 'conditional';
  status: 'active' | 'completed' | 'cancelled';
  steps: WorkflowStep[];
  document: Document;
  notifications: {
    enabled: boolean;
    reminderFrequency: number;
    escalationAfter: number;
  };
  auditTrail: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: number;
  category: string;
}

interface Certificate {
  id: string;
  workflowId: string;
  type: string;
  status: string;
  url: string;
  generatedAt: string;
  validityPeriod: string;
  signatures: Array<{
    signer: string;
    timestamp: string;
    verified: boolean;
    notarized?: boolean;
  }>;
}

interface SignatureWorkflowEngineProps {
  workflowId?: string;
  workflowType?: 'sequential' | 'parallel' | 'conditional';
  workflowStatus?: 'active' | 'completed' | 'cancelled';
  mode?: 'view' | 'create';
  documentMetadata?: Record<string, any>;
  hasLegalWarnings?: boolean;
  onComplete: (result: any) => void;
  onCancel: () => void;
}

export const SignatureWorkflowEngine: React.FC<SignatureWorkflowEngineProps> = ({
  workflowId,
  workflowType = 'sequential',
  workflowStatus = 'active',
  mode = 'view',
  documentMetadata = {},
  hasLegalWarnings = false,
  onComplete,
  onCancel,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // State
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [showNotificationConfig, setShowNotificationConfig] = useState(false);
  const [showTemplates, setShowTemplates] = useState(mode === 'create');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showCertificatePreview, setShowCertificatePreview] = useState(false);
  const [showAuditExport, setShowAuditExport] = useState(false);
  const [showConditionBuilder, setShowConditionBuilder] = useState(false);
  const [showWetSignatureUpload, setShowWetSignatureUpload] = useState(false);
  const [showNotaryForm, setShowNotaryForm] = useState(false);
  const [showWitnessForm, setShowWitnessForm] = useState(false);
  const [auditFilter, setAuditFilter] = useState('all');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [conditionForm, setConditionForm] = useState({
    field: '',
    operator: 'gt',
    value: '',
    action: '',
  });
  const [notaryForm, setNotaryForm] = useState({
    name: '',
    commission: '',
    expiration: '',
  });
  const [witnessForm, setWitnessForm] = useState({
    name: '',
    email: '',
  });

  // Queries
  const { data: workflow, isLoading: workflowLoading } = useQuery<Workflow>({
    queryKey: ['workflow', workflowId],
    queryFn: () => api.get(`/workflows/${workflowId}`).then(res => res.data),
    enabled: !!workflowId && mode === 'view',
  });

  const { data: templates } = useQuery<WorkflowTemplate[]>({
    queryKey: ['workflow-templates'],
    queryFn: () => api.get('/workflow-templates').then(res => res.data),
    enabled: mode === 'create',
  });

  const { data: certificate } = useQuery<Certificate>({
    queryKey: ['certificate', workflowId],
    queryFn: () => api.get(`/certificates?workflowId=${workflowId}`).then(res => res.data),
    enabled: !!workflowId && workflowStatus === 'completed',
  });

  // Mutations
  const completeStep = useMutation({
    mutationFn: (stepId: string) => api.post(`/workflows/${workflowId}/steps/${stepId}/complete`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      onComplete({ stepId: data.stepId, action: 'complete' });
    },
  });

  const uploadWetSignature = useMutation({
    mutationFn: (formData: FormData) => api.post('/signatures/wet-signature/upload', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      setShowWetSignatureUpload(false);
    },
  });

  const validateNotary = useMutation({
    mutationFn: (notaryData: any) => api.post('/signatures/notary/validate', notaryData),
    onSuccess: () => {
      onComplete({ type: 'notary_validation' });
    },
  });

  const notifyWitnesses = useMutation({
    mutationFn: (witnesses: string[]) => api.post('/signatures/witnesses/notify', { witnesses }),
    onSuccess: (data) => {
      onComplete({ type: 'witness_notification', witnesses: data.witnesses });
    },
  });

  // Computed values
  const currentStep = useMemo(() => {
    if (!workflow) return null;
    if (workflow.type === 'sequential') {
      return workflow.steps.find(step => step.status === 'pending');
    }
    return null;
  }, [workflow]);

  const completedSteps = useMemo(() => {
    return workflow?.steps.filter(step => step.status === 'completed').length || 0;
  }, [workflow]);

  const totalSteps = useMemo(() => {
    return workflow?.steps.length || 0;
  }, [workflow]);

  const signaturePages = useMemo(() => {
    if (!workflow?.document?.signatures) return [];
    return [...new Set(workflow.document.signatures.map(sig => sig.page))].sort();
  }, [workflow]);

  const filteredAuditEvents = useMemo(() => {
    if (!workflow?.auditTrail) return [];
    if (auditFilter === 'all') return workflow.auditTrail;
    if (auditFilter === 'user_actions') {
      return workflow.auditTrail.filter(event => event.user !== 'system');
    }
    return workflow.auditTrail.filter(event => event.action.includes(auditFilter));
  }, [workflow?.auditTrail, auditFilter]);

  const evaluateConditions = useCallback(() => {
    if (workflowType !== 'conditional' || !documentMetadata.value) return false;
    return documentMetadata.value > 100000;
  }, [workflowType, documentMetadata]);

  const requiresCFOApproval = useMemo(() => {
    return evaluateConditions();
  }, [evaluateConditions]);

  // Handlers
  const handleCompleteStep = useCallback((stepId: string) => {
    const errors: string[] = [];
    
    // Validate step completion requirements
    const step = workflow?.steps.find(s => s.id === stepId);
    if (step?.required && !step.completedBy) {
      errors.push('Please complete all required fields');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    completeStep.mutate(stepId);
  }, [workflow, completeStep]);

  const handleStepClick = useCallback((stepId: string) => {
    setSelectedStep(selectedStep === stepId ? null : stepId);
  }, [selectedStep]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workflowId', workflowId || '');

    // Simulate upload progress
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    uploadWetSignature.mutate(formData);
  }, [workflowId, uploadWetSignature]);

  const handleNotaryValidation = useCallback(() => {
    validateNotary.mutate(notaryForm);
  }, [notaryForm, validateNotary]);

  const handleWitnessNotification = useCallback(() => {
    const witnesses = workflow?.steps
      .flatMap(step => step.witnesses || [])
      .filter(Boolean) || [];
    
    notifyWitnesses.mutate(witnesses);
  }, [workflow, notifyWitnesses]);

  const handleConditionAdd = useCallback(() => {
    // Handle condition addition logic
    setShowConditionBuilder(false);
  }, []);

  const handleWorkflowCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const formatDateTime = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const getStepStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleSolid className="h-5 w-5 text-green-500" />;
      case 'pending': return <ClockSolid className="h-5 w-5 text-blue-500" />;
      case 'waiting': return <ClockIcon className="h-5 w-5 text-gray-400" />;
      case 'rejected': return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default: return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  }, []);

  const getStepStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'waiting': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  // Loading state
  if (workflowLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div data-testid="loading-spinner" className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!workflow && mode === 'view') {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Failed to load workflow</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="workflow-engine" className="max-w-7xl mx-auto p-6">
      <main role="main" aria-label="Signature Workflow Engine">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Signature Workflow Engine
              </h1>
              <p className="text-gray-600 mb-4">
                Workflow engine for managing signature processes
              </p>
              {workflow && (
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-semibold">{workflow.name}</h2>
                  <span
                    data-testid="workflow-status"
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      workflow.status === 'active' ? 'bg-green-100 text-green-800' :
                      workflow.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                  </span>
                  <span className="text-sm text-gray-600">{workflow.type.charAt(0).toUpperCase() + workflow.type.slice(1)}</span>
                </div>
              )}
              <p className="text-gray-600 mt-1">{workflow?.description}</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowNotificationConfig(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <CogIcon className="h-4 w-4 inline mr-2" />
                Notification Settings
              </button>
              <button
                onClick={handleWorkflowCancel}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel Workflow
              </button>
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legal Warnings */}
        {hasLegalWarnings && (
          <div data-testid="legal-warnings" className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Legal Notice</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Warning: Wet signature may be required in this jurisdiction
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live Region for Screen Readers */}
        <div role="status" aria-live="polite" className="sr-only">
          {completeStep.isSuccess && 'Step completed successfully'}
          {validationErrors.length > 0 && 'Validation errors found'}
        </div>

        {mode === 'create' && showTemplates ? (
          /* Template Selection Mode */
          <div data-testid="workflow-templates" className="space-y-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Choose Workflow Template
              </h2>
              
              {/* Template Categories */}
              <div data-testid="template-categories" className="mb-6">
                <div className="flex space-x-4">
                  <button className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">Basic</button>
                  <button className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg">Advanced</button>
                </div>
              </div>

              {/* Template Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {templates?.map((template) => (
                  <div
                    key={template.id}
                    data-testid={`template-${template.id}`}
                    className={`
                      border-2 rounded-lg p-4 cursor-pointer transition-all
                      ${selectedTemplate === template.id
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <h3 className="font-medium text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      {template.steps} steps • {template.category}
                    </div>
                  </div>
                ))}
              </div>

              {/* Template Actions */}
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setShowCertificatePreview(true)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={!selectedTemplate}
                >
                  Preview Template
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!selectedTemplate}
                >
                  Use Template
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Workflow Execution Mode */
          <div className="space-y-8">
            {/* Document Info */}
            {workflow?.document && (
              <div data-testid="document-info" className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{workflow.document.name}</h3>
                    <p className="text-sm text-gray-600">{workflow.document.pages} pages</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {}}
                      className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Preview Signature Pages
                    </button>
                    <button
                      onClick={() => onComplete({ type: 'extract_signature_pages', pages: signaturePages })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Extract Signature Pages
                    </button>
                  </div>
                </div>
                
                {/* Signature Pages Info */}
                {signaturePages.length > 0 && (
                  <div data-testid="signature-pages" className="mt-4 p-3 bg-blue-50 rounded">
                    <p className="text-sm text-blue-800">
                      Signature Pages: {signaturePages.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Workflow Progress */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Workflow Progress</h3>
                <div className="text-sm text-gray-600">
                  {workflowType === 'parallel' ? (
                    <span>{completedSteps} of {totalSteps} completed</span>
                  ) : (
                    <span>Step {(currentStep?.order || 0)} of {totalSteps}</span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div 
                data-testid={workflowType === 'parallel' ? 'parallel-progress-bar' : 'workflow-progress'}
                className="w-full bg-gray-200 rounded-full h-2 mb-6"
              >
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                ></div>
              </div>

              {/* Current Step Label */}
              {currentStep && workflowType !== 'parallel' && (
                <p aria-label={`Current step: ${currentStep.name}`} className="sr-only">
                  Current step: {currentStep.name}
                </p>
              )}
            </div>

            {/* Workflow Type Specific Content */}
            {workflowType === 'parallel' && (
              <div data-testid="parallel-workflow" className="bg-blue-50 rounded-lg p-4">
                <p className="text-blue-800">All steps can be completed simultaneously</p>
              </div>
            )}

            {workflowType === 'conditional' && (
              <div data-testid="conditional-workflow" className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Conditional Paths</h3>
                  
                  {/* Condition Rules */}
                  <div data-testid="condition-rules" className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-medium">IF</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Value &gt; $100,000</span>
                      <span className="font-medium">THEN</span>
                      <span className="px-2 py-1 bg-blue-100 rounded">Require CFO Approval</span>
                    </div>
                  </div>

                  {/* Add Condition Button */}
                  <button
                    onClick={() => setShowConditionBuilder(true)}
                    className="mt-4 px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Add Condition
                  </button>

                  {/* Condition Evaluation */}
                  {requiresCFOApproval && (
                    <div data-testid="condition-evaluation" className="mt-4 p-3 bg-yellow-50 rounded">
                      <p className="text-yellow-800 font-medium">CFO Approval Required</p>
                    </div>
                  )}
                </div>

                {/* CFO Approval Step (conditional) */}
                {requiresCFOApproval && (
                  <div data-testid="step-cfo-approval" className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="font-semibold text-gray-900">CFO Approval Required</h4>
                    <p className="text-sm text-gray-600">Due to contract value exceeding $100,000</p>
                  </div>
                )}
              </div>
            )}

            {/* Workflow Steps */}
            <section role="region" aria-label="Workflow Steps">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Workflow Steps</h3>
                
                <div className="space-y-4">
                  {workflow?.steps.map((step, index) => (
                    <div
                      key={step.id}
                      data-testid={`step-${step.id}`}
                      className={`
                        border rounded-lg p-4 cursor-pointer transition-all
                        ${step.status === 'pending' ? 'ring-2 ring-blue-500 border-blue-200' : 
                          step.status === 'waiting' && workflowType === 'sequential' ? 'opacity-50 border-gray-200' : 
                          'border-gray-200'}
                      `}
                      onClick={() => handleStepClick(step.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {/* Step Number */}
                          <div className="bg-blue-100 text-blue-800 w-8 h-8 rounded-full flex items-center justify-center font-medium">
                            {step.order}
                          </div>
                          
                          {/* Step Info */}
                          <div>
                            <h4 className="font-medium text-gray-900">{step.name}</h4>
                            <p className="text-sm text-gray-600">{step.assignedTo.replace(':', ': ')}</p>
                            <p className="text-xs text-gray-500">Due: {formatDateTime(step.deadline)}</p>
                          </div>

                          {/* Special Indicators */}
                          <div className="flex items-center space-x-2">
                            {step.type === 'signature' && step.notarization && (
                              <div data-testid="notarization-required" className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                Notarization Required
                              </div>
                            )}
                            {step.type === 'signature' && step.witnesses && step.witnesses.length > 0 && (
                              <div data-testid="witnesses-required" className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                                {step.witnesses.length} Witness{step.witnesses.length > 1 ? 'es' : ''} Required
                              </div>
                            )}
                            {workflow.document.signatures.some(sig => sig.type === 'wet' && sig.assignedTo === step.assignedTo) && (
                              <div data-testid="wet-signature-indicator" className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                Wet Signature
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          {/* Status */}
                          <div className="flex items-center space-x-2">
                            {getStepStatusIcon(step.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStepStatusColor(step.status)}`}>
                              {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                            </span>
                          </div>

                          {/* Actions */}
                          {step.status === 'pending' && (
                            <button
                              data-testid={`complete-step-${step.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteStep(step.id);
                              }}
                              disabled={workflowType === 'sequential' && step.id !== currentStep?.id}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Step Details */}
                      {selectedStep === step.id && (
                        <div data-testid={`step-details-${step.id}`} className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Step Details</h5>
                              <p className="text-sm text-gray-600">Type: {step.type}</p>
                              <p className="text-sm text-gray-600">Required: {step.required ? 'Yes' : 'No'}</p>
                              {step.completedBy && (
                                <>
                                  <p className="text-sm text-gray-600">Completed by: {step.completedBy}</p>
                                  <p className="text-sm text-gray-600">Completed at: {formatDateTime(step.completedAt!)}</p>
                                </>
                              )}
                            </div>
                            
                            {step.witnesses && step.witnesses.length > 0 && (
                              <div data-testid="witness-info">
                                <h5 className="font-medium text-gray-900 mb-2">Witnesses</h5>
                                {step.witnesses.map((witness, idx) => (
                                  <p key={idx} className="text-sm text-gray-600">{witness}</p>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Special Instructions */}
                          {workflow.document.signatures.some(sig => sig.type === 'wet' && sig.assignedTo === step.assignedTo) && (
                            <div data-testid="wet-signature-instructions" className="mt-4 p-3 bg-yellow-50 rounded">
                              <h6 className="font-medium text-yellow-800 mb-2">Wet Signature Instructions</h6>
                              <ol className="text-sm text-yellow-700 space-y-1">
                                <li>1. Print and sign physically</li>
                                <li>2. Scan and upload signed document</li>
                                <li>3. Ensure signatures are clear and legible</li>
                              </ol>
                              <button
                                onClick={() => setShowWetSignatureUpload(true)}
                                className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                              >
                                Upload Signed Document
                              </button>
                            </div>
                          )}

                          {step.notarization && (
                            <div data-testid="notary-instructions" className="mt-4 p-3 bg-purple-50 rounded">
                              <h6 className="font-medium text-purple-800 mb-2">Notarization Required</h6>
                              <div data-testid="notary-details" className="space-y-2">
                                <p className="text-sm text-purple-700">• Notary public must witness the signing</p>
                                <p className="text-sm text-purple-700">• Valid identification required</p>
                                <p className="text-sm text-purple-700">• Notary will add official seal and signature</p>
                              </div>
                              <button
                                onClick={() => setShowNotaryForm(true)}
                                className="mt-3 px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                              >
                                Add Notary Info
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Witness and Notary Actions */}
                <div className="mt-6 flex space-x-4">
                  <button
                    onClick={() => setShowWitnessForm(true)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <UserGroupIcon className="h-4 w-4 inline mr-2" />
                    Add Witness
                  </button>
                  <button
                    onClick={handleWitnessNotification}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Notify Witnesses
                  </button>
                  <button
                    onClick={() => {}}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Validate Witness
                  </button>
                </div>
              </div>
            </section>

            {/* Signature Field Positioning */}
            <div data-testid="signature-positioning" className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Signature Field Positioning</h3>
              <p className="text-gray-600 mb-4">Drag to position signature fields</p>
              <button
                onClick={() => {}}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Position Signatures
              </button>
            </div>

            {/* Legal Validity */}
            <div data-testid="legal-validity" className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Legal Validity Status</h3>
              
              <div className="space-y-4">
                <button
                  onClick={() => {}}
                  className="w-full text-left px-4 py-3 border border-gray-300 rounded hover:bg-gray-50"
                >
                  <div className="flex justify-between items-center">
                    <span>Verify Compliance</span>
                    <CheckCircleIcon className="h-5 w-5 text-gray-400" />
                  </div>
                </button>

                <div data-testid="compliance-check" className="p-4 bg-green-50 rounded">
                  <h4 className="font-medium text-green-800 mb-2">Compliance Status</h4>
                  <div className="space-y-1 text-sm text-green-700">
                    <p>✓ E-SIGN Act Compliant</p>
                    <p>✓ UETA Compliant</p>
                  </div>
                </div>

                <div data-testid="jurisdiction-info" className="p-4 bg-blue-50 rounded">
                  <h4 className="font-medium text-blue-800 mb-2">Jurisdiction Requirements</h4>
                  <div className="space-y-1 text-sm text-blue-700">
                    <p>Jurisdiction: California</p>
                    <p>Wet signature required for certain document types</p>
                  </div>
                </div>

                <button
                  onClick={() => {}}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Check Integrity
                </button>

                <div data-testid="integrity-status" className="p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-700">Document integrity verified</p>
                </div>
              </div>
            </div>

            {/* Certificate Section */}
            {workflowStatus === 'completed' && (
              <div data-testid="certificate-section" className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Certificate of Completion</h3>
                
                {certificate && (
                  <div data-testid="certificate-info" className="mb-4 space-y-2">
                    <p className="text-sm text-gray-600">Generated: {formatDateTime(certificate.generatedAt)}</p>
                    <p className="text-sm text-gray-600">Valid until: {certificate.validityPeriod.split(' - ')[1]}</p>
                  </div>
                )}

                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowCertificatePreview(true)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Preview Certificate
                  </button>
                  <button
                    onClick={() => onComplete({ 
                      type: 'download_certificate', 
                      url: certificate?.url || '/certificates/cert1.pdf' 
                    })}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 inline mr-2" />
                    Download Certificate
                  </button>
                  <button
                    onClick={() => {}}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    <ShieldCheckIcon className="h-4 w-4 inline mr-2" />
                    Verify Signatures
                  </button>
                  <button
                    onClick={() => onComplete({ type: 'generate_certificate' })}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Generate Certificate
                  </button>
                </div>

                <div data-testid="signature-verification" className="mt-4 p-3 bg-green-50 rounded">
                  <p className="text-green-800 font-medium">All signatures verified ✓</p>
                </div>
              </div>
            )}

            {workflowStatus === 'completed' && (
              <div data-testid="workflow-completed" className="text-center py-8">
                <CheckCircleSolid className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Workflow Completed Successfully</h3>
                <p className="text-gray-600">All signature requirements have been fulfilled</p>
              </div>
            )}

            {/* Audit Trail */}
            <section role="region" aria-label="Audit Trail">
              <div data-testid="audit-trail" className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Audit Trail</h3>
                  <div className="flex space-x-2">
                    <select
                      value={auditFilter}
                      onChange={(e) => setAuditFilter(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded"
                      aria-label="Filter audit events"
                    >
                      <option value="all">All Events</option>
                      <option value="user_actions">User Actions</option>
                      <option value="system">System Events</option>
                    </select>
                    <button
                      onClick={() => setShowAuditExport(true)}
                      className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Export Audit Trail
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredAuditEvents.map((event) => (
                    <div
                      key={event.id}
                      data-testid={`audit-event-${event.id}`}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded"
                    >
                      <div className="flex-shrink-0">
                        <DocumentCheckIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {event.action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-sm text-gray-600">{event.details}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-500">
                          {formatDateTime(event.timestamp).split(',')[1]?.trim()}
                        </p>
                        <p className="text-xs text-gray-500">{event.user}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Modals and Forms */}

        {/* Wet Signature Upload Modal */}
        {showWetSignatureUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="wet-signature-upload" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Signed Document</h3>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Drag and drop or click to upload</p>
                    <input
                      type="file"
                      data-testid="wet-signature-file-input"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div data-testid="signature-validation" className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Validating signature...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowWetSignatureUpload(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notary Form Modal */}
        {showNotaryForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="notary-form" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notary Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="notary-name" className="block text-sm font-medium text-gray-700">
                    Notary Name
                  </label>
                  <input
                    type="text"
                    id="notary-name"
                    value={notaryForm.name}
                    onChange={(e) => setNotaryForm(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label htmlFor="notary-commission" className="block text-sm font-medium text-gray-700">
                    Notary Commission Number
                  </label>
                  <input
                    type="text"
                    id="notary-commission"
                    value={notaryForm.commission}
                    onChange={(e) => setNotaryForm(prev => ({ ...prev, commission: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label htmlFor="notary-expiration" className="block text-sm font-medium text-gray-700">
                    Commission Expiration Date
                  </label>
                  <input
                    type="date"
                    id="notary-expiration"
                    value={notaryForm.expiration}
                    onChange={(e) => setNotaryForm(prev => ({ ...prev, expiration: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowNotaryForm(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNotaryValidation}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Validate Notary
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Witness Form Modal */}
        {showWitnessForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="witness-form" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Witness</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="witness-name" className="block text-sm font-medium text-gray-700">
                    Witness Name
                  </label>
                  <input
                    type="text"
                    id="witness-name"
                    value={witnessForm.name}
                    onChange={(e) => setWitnessForm(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                
                <div>
                  <label htmlFor="witness-email" className="block text-sm font-medium text-gray-700">
                    Witness Email
                  </label>
                  <input
                    type="email"
                    id="witness-email"
                    value={witnessForm.email}
                    onChange={(e) => setWitnessForm(prev => ({ ...prev, email: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowWitnessForm(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Witness
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Condition Builder Modal */}
        {showConditionBuilder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="condition-builder" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Condition</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="condition-field" className="block text-sm font-medium text-gray-700">
                    Condition Field
                  </label>
                  <select
                    id="condition-field"
                    value={conditionForm.field}
                    onChange={(e) => setConditionForm(prev => ({ ...prev, field: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select field...</option>
                    <option value="value">Contract Value</option>
                    <option value="type">Contract Type</option>
                    <option value="department">Department</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="condition-operator" className="block text-sm font-medium text-gray-700">
                    Operator
                  </label>
                  <select
                    id="condition-operator"
                    value={conditionForm.operator}
                    onChange={(e) => setConditionForm(prev => ({ ...prev, operator: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="gt">Greater Than</option>
                    <option value="lt">Less Than</option>
                    <option value="eq">Equal To</option>
                    <option value="contains">Contains</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="condition-value" className="block text-sm font-medium text-gray-700">
                    Value
                  </label>
                  <input
                    type="text"
                    id="condition-value"
                    value={conditionForm.value}
                    onChange={(e) => setConditionForm(prev => ({ ...prev, value: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowConditionBuilder(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConditionAdd}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Condition
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview and Export Modals */}
        {showCertificatePreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="certificate-preview" className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Certificate of Completion</h3>
              <div className="bg-gray-100 h-96 flex items-center justify-center">
                <p className="text-gray-500">Certificate preview would appear here</p>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowCertificatePreview(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showAuditExport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="export-options" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Export Audit Trail</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-4 py-3 border border-gray-300 rounded hover:bg-gray-50">
                  PDF
                </button>
                <button className="w-full text-left px-4 py-3 border border-gray-300 rounded hover:bg-gray-50">
                  CSV
                </button>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowAuditExport(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showNotificationConfig && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div data-testid="notification-config" className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Reminder frequency: 24 hours</p>
                <p className="text-sm text-gray-600">Escalation after: 72 hours</p>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowNotificationConfig(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Modals */}
        {showWetSignatureUpload && (
          <div data-testid="witness-validation" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="text-center py-4">
                <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600">Validating witness signatures...</p>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Confirmation */}
        <div data-testid="cancel-confirmation" className="hidden">
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cancel Workflow</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to cancel this workflow? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Keep Workflow
              </button>
              <button className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>

        {/* Preview Modals */}
        <div data-testid="signature-page-preview" className="hidden">
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Signature Pages Preview</h3>
            <div className="space-y-4">
              <div className="bg-gray-100 h-64 flex items-center justify-center">
                <p className="text-gray-500">Page 11</p>
              </div>
              <div className="bg-gray-100 h-64 flex items-center justify-center">
                <p className="text-gray-500">Page 12</p>
              </div>
            </div>
          </div>
        </div>

        <div data-testid="template-preview" className="hidden">
          <div className="bg-white rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Template Preview</h3>
            <p className="text-gray-600">Template workflow preview would appear here</p>
          </div>
        </div>
      </main>
    </div>
  );
};