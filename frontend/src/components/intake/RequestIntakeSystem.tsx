import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PaperClipIcon,
  ClockIcon,
  UserGroupIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

// Types and schemas
const requestSchema = z.object({
  type: z.enum(['contract_review', 'new_contract', 'amendment', 'legal_advice']),
  urgent: z.boolean().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  contractValue: z.number().optional(),
  counterparty: z.string().optional(),
  industry: z.string().optional(),
  requiresCfoApproval: z.boolean().optional(),
  hipaaCompliance: z.boolean().optional(),
  template: z.string().optional(),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    uploadProgress: z.number().optional(),
  })).optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestIntakeSystemProps {
  onSubmit: (data: RequestFormData & { status: string; id?: string }) => void;
  onSave: (data: RequestFormData & { status: string }) => void;
  initialData?: Partial<RequestFormData>;
}

interface Template {
  id: string;
  name: string;
  type: string;
  defaultValues: Partial<RequestFormData>;
}

interface RoutingInfo {
  assignedTo: string;
  estimatedCompletion: string;
  priority: string;
  sla: string;
}

interface SimilarRequest {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

const REQUEST_TYPES = [
  { value: 'contract_review', label: 'Contract Review', icon: DocumentIcon },
  { value: 'new_contract', label: 'New Contract', icon: PaperClipIcon },
  { value: 'amendment', label: 'Amendment', icon: ClockIcon },
  { value: 'legal_advice', label: 'Legal Advice', icon: InformationCircleIcon },
];

const INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low Priority', color: 'green' },
  { value: 'medium', label: 'Medium Priority', color: 'yellow' },
  { value: 'high', label: 'High Priority', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' },
];

export const RequestIntakeSystem: React.FC<RequestIntakeSystemProps> = ({
  onSubmit,
  onSave,
  initialData = {},
}) => {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [similarRequests, setSimilarRequests] = useState<SimilarRequest[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [routingInfo, setRoutingInfo] = useState<RoutingInfo | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{ id: string } | null>(null);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    trigger,
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: initialData,
    mode: 'onChange',
  });

  const watchedValues = watch();
  const watchedType = watch('type');
  const watchedUrgent = watch('urgent');
  const watchedContractValue = watch('contractValue');
  const watchedIndustry = watch('industry');
  const watchedTitle = watch('title');

  // Query for templates
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['templates', watchedType],
    queryFn: () => api.get(`/templates?type=${watchedType}`).then(res => res.data),
    enabled: !!watchedType,
  });

  // Check for similar requests
  useEffect(() => {
    const checkSimilarRequests = async () => {
      if (watchedTitle && watchedTitle.length > 10) {
        try {
          const response = await api.get(`/requests/similar?title=${encodeURIComponent(watchedTitle)}`);
          const similar = response.data;
          if (similar.length > 0) {
            setSimilarRequests(similar);
            setShowDuplicateWarning(true);
          } else {
            setShowDuplicateWarning(false);
          }
        } catch (error) {
          // Handle API error
          console.error('Failed to check similar requests:', error);
        }
      }
    };

    const timer = setTimeout(checkSimilarRequests, 500);
    return () => clearTimeout(timer);
  }, [watchedTitle]);

  // Calculate routing information
  useEffect(() => {
    if (currentStep === 4 && watchedValues.type) {
      const routing = calculateRouting(watchedValues);
      setRoutingInfo(routing);
    }
  }, [currentStep, watchedValues]);

  const calculateRouting = (data: RequestFormData): RoutingInfo => {
    let assignedTo = 'Legal Team';
    let sla = '5 business days';
    let priority = 'medium';

    // High-value contracts go to senior lawyers
    if (data.contractValue && data.contractValue > 1000000) {
      assignedTo = 'Senior Legal Counsel';
      priority = 'high';
    }

    // Urgent requests have shorter SLA
    if (data.urgent) {
      sla = '24 hours';
      priority = 'urgent';
    }

    // Industry-specific routing
    if (data.industry === 'healthcare') {
      assignedTo = 'Healthcare Legal Specialist';
    }

    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + (data.urgent ? 1 : 5));

    return {
      assignedTo,
      estimatedCompletion: estimatedCompletion.toLocaleDateString(),
      priority,
      sla,
    };
  };

  const nextStep = useCallback(async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isStepValid = await trigger(fieldsToValidate);
    
    if (isStepValid) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      
      // Announce step change for screen readers
      const announcement = document.getElementById('live-region');
      if (announcement) {
        announcement.textContent = `Step ${Math.min(currentStep + 1, 4)} of 4: ${getStepTitle(Math.min(currentStep + 1, 4))}`;
      }
    }
  }, [currentStep, trigger]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const getFieldsForStep = (step: number): (keyof RequestFormData)[] => {
    switch (step) {
      case 1:
        return ['type'];
      case 2:
        return ['title', 'description'];
      case 3:
        return [];
      case 4:
        return [];
      default:
        return [];
    }
  };

  const getStepTitle = (step: number): string => {
    switch (step) {
      case 1:
        return 'Request Type';
      case 2:
        return 'Request Details';
      case 3:
        return 'File Attachments';
      case 4:
        return 'Review & Submit';
      default:
        return '';
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      Object.entries(template.defaultValues).forEach(([key, value]) => {
        setValue(key as keyof RequestFormData, value);
      });
    }
  };

  const handleSaveDraft = () => {
    const formData = watchedValues;
    onSave({ ...formData, status: 'draft' });
  };

  const handleFinalSubmit = async (data: RequestFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const submissionData = {
        ...data,
        status: 'submitted',
        submittedBy: user?.id,
        submittedAt: new Date().toISOString(),
        routing: routingInfo,
      };
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      const requestId = `REQ-${Date.now()}`;
      setSubmissionResult({ id: requestId });
      onSubmit({ ...submissionData, id: requestId });
    } catch (error) {
      setSubmitError('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setSubmitError(null);
    handleSubmit(handleFinalSubmit)();
  };

  const dismissDuplicateWarning = () => {
    setShowDuplicateWarning(false);
  };

  const progress = (currentStep / 4) * 100;

  if (submissionResult) {
    return (
      <div data-testid="request-intake-system" className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted Successfully</h1>
          <p className="text-gray-600 mb-4">
            Your request has been submitted and assigned ID: <strong>{submissionResult.id}</strong>
          </p>
          <p className="text-sm text-gray-500">
            You will receive email updates on the progress of your request.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="request-intake-system" className="max-w-4xl mx-auto p-6">
      <main role="main" aria-label="Request intake form">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">New Request</h1>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span data-testid="step-indicator" className="text-sm font-medium text-gray-700">
                Step {currentStep} of 4
              </span>
              <span className="text-sm text-gray-500">{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Form progress"
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Step Navigation */}
          <div className="flex justify-between mb-8">
            {[1, 2, 3, 4].map((step) => (
              <button
                key={step}
                onClick={() => goToStep(step)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg mx-1 ${
                  step === currentStep
                    ? 'bg-blue-600 text-white'
                    : step < currentStep
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-500'
                }`}
                disabled={step > currentStep}
              >
                {getStepTitle(step)}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFinalSubmit)}>
          {/* Step 1: Request Type */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Request Type</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUEST_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`relative flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                      watchedType === type.value ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      {...register('type')}
                      className="sr-only"
                    />
                    <type.icon className="h-6 w-6 text-gray-600 mr-3" />
                    <span className="font-medium text-gray-900">{type.label}</span>
                    {watchedType === type.value && (
                      <CheckCircleIcon className="h-5 w-5 text-blue-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>

              {/* Template selection for new contracts */}
              {watchedType === 'new_contract' && templates.length > 0 && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Use Template (Optional)
                  </label>
                  <select
                    {...register('template')}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Select template"
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Urgent toggle */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="urgent"
                  {...register('urgent')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="urgent" className="ml-2 text-sm font-medium text-gray-700">
                  Urgent Request
                </label>
              </div>

              {/* Priority selection for urgent requests */}
              {watchedUrgent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_LEVELS.slice(2).map((priority) => ( // Only high and urgent for urgent requests
                      <label
                        key={priority.value}
                        className={`flex items-center p-2 border rounded cursor-pointer ${
                          watchedValues.priority === priority.value
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          value={priority.value}
                          {...register('priority')}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">{priority.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Request Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Request Details</h2>
              
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Request Title *
                </label>
                <input
                  type="text"
                  id="title"
                  {...register('title')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brief description of your request"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  id="description"
                  {...register('description')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Detailed description of what you need"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Contract-specific fields */}
              {(watchedType === 'contract_review' || watchedType === 'new_contract') && (
                <>
                  <div>
                    <label htmlFor="contractValue" className="block text-sm font-medium text-gray-700 mb-1">
                      Contract Value (USD)
                    </label>
                    <input
                      type="number"
                      id="contractValue"
                      {...register('contractValue', { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label htmlFor="counterparty" className="block text-sm font-medium text-gray-700 mb-1">
                      Counterparty
                    </label>
                    <input
                      type="text"
                      id="counterparty"
                      {...register('counterparty')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Company or individual name"
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <select
                  id="industry"
                  {...register('industry')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry.value} value={industry.value}>
                      {industry.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* High-value contract approval */}
              {watchedContractValue && watchedContractValue > 500000 && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="requiresCfoApproval"
                    {...register('requiresCfoApproval')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="requiresCfoApproval" className="ml-2 text-sm font-medium text-gray-700">
                    Requires CFO Approval
                  </label>
                </div>
              )}

              {/* Healthcare-specific compliance */}
              {watchedIndustry === 'healthcare' && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="hipaaCompliance"
                    {...register('hipaaCompliance')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hipaaCompliance" className="ml-2 text-sm font-medium text-gray-700">
                    HIPAA Compliance Required
                  </label>
                </div>
              )}

              {/* Duplicate warning */}
              {showDuplicateWarning && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-yellow-800 mb-2">
                        Similar Request Found
                      </h3>
                      <p className="text-sm text-yellow-700 mb-3">
                        We found a similar request that might be relevant:
                      </p>
                      <div className="space-y-2">
                        {similarRequests.slice(0, 1).map((request) => (
                          <div key={request.id} className="bg-white p-2 rounded border">
                            <a
                              href={`/requests/${request.id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Similar Request: {request.title}
                            </a>
                            <p className="text-xs text-gray-500 mt-1">
                              Status: {request.status} • Created: {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end space-x-2 mt-3">
                        <button
                          type="button"
                          onClick={dismissDuplicateWarning}
                          className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200"
                        >
                          Proceed Anyway
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={dismissDuplicateWarning}
                      className="text-yellow-400 hover:text-yellow-600"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Save Draft
                </button>
              </div>
            </div>
          )}

          {/* Step 3: File Attachments */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">File Attachments</h2>
              
              <div
                data-testid="file-upload-zone"
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
              >
                <DocumentIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drag and drop files here
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  or click to browse (PDF, DOC, DOCX, XLS, XLSX up to 50MB each)
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach((file) => {
                      // Validate file type and size
                      const validTypes = ['application/pdf', 'application/msword', 
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
                      
                      if (!validTypes.includes(file.type)) {
                        setSubmitError('Invalid file type. Please upload PDF, DOC, DOCX, XLS, or XLSX files only.');
                        return;
                      }
                      
                      if (file.size > 50 * 1024 * 1024) { // 50MB limit
                        setSubmitError('File too large. Maximum file size is 50MB.');
                        return;
                      }
                      
                      // Simulate successful upload
                      console.log('File uploaded:', file.name);
                    });
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Review & Submit</h2>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Request Summary</h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {REQUEST_TYPES.find(t => t.value === watchedType)?.label}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Priority</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {watchedUrgent ? 'Urgent' : 'Normal'}
                    </dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Title</dt>
                    <dd className="mt-1 text-sm text-gray-900">{watchedTitle}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-sm text-gray-900">{watchedValues.description}</dd>
                  </div>
                  {watchedContractValue && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Contract Value</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        ${watchedContractValue.toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Routing Information */}
              {routingInfo && (
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Details</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Assigned To</dt>
                      <dd className="mt-1 text-sm text-gray-900 flex items-center">
                        <UserGroupIcon className="h-4 w-4 mr-2" />
                        {routingInfo.assignedTo}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Estimated Completion</dt>
                      <dd className="mt-1 text-sm text-gray-900 flex items-center">
                        <ClockIcon className="h-4 w-4 mr-2" />
                        {routingInfo.estimatedCompletion}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Priority</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          routingInfo.priority === 'urgent' 
                            ? 'bg-red-100 text-red-800'
                            : routingInfo.priority === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {routingInfo.priority}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">SLA</dt>
                      <dd className="mt-1 text-sm text-gray-900">{routingInfo.sla}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Edit buttons */}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Edit Attachments
                </button>
              </div>

              {/* Submit error */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-3" />
                    <div className="flex-1">
                      <p className="text-sm text-red-700">{submitError}</p>
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="mt-2 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-2" />
              Previous
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={currentStep === 1 && !watchedType}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRightIcon className="h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="flex items-center px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            )}
          </div>
        </form>

        {/* Live Region for Screen Reader Announcements */}
        <div id="live-region" role="status" aria-live="polite" className="sr-only"></div>
      </main>
    </div>
  );
};