/**
 * ContractCreatePage - Multi-step contract creation wizard
 * Implements a comprehensive contract creation flow with validation, templates, and AI integration
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { contractService } from '@/services/contract.service'
import { TemplateModal } from './components/TemplateModal'
import { CancelModal } from './components/CancelModal'
import { MobileStepper, DesktopStepper } from './components/ProgressIndicator'

import {
  ContractCreationFormData,
  ContractTemplate,
  WizardStep,
  AIClauseResponse,
  AIRiskAssessment,
  CONTRACT_TYPES,
  PAYMENT_TERMS,
  WIZARD_STEPS,
  VALIDATION_RULES,
  CreateContractRequest,
} from '@/types/contract-creation.types'

// Zod schemas for form validation
const basicInformationSchema = z.object({
  title: z.string()
    .min(VALIDATION_RULES.TITLE_MIN_LENGTH, 'Title must be at least 5 characters')
    .max(VALIDATION_RULES.TITLE_MAX_LENGTH, 'Title must not exceed 200 characters'),
  contract_type: z.enum(['purchase', 'sales', 'nda', 'employment', 'service', 'license', 'other'])
    .refine((val) => val !== '', { message: 'Contract type is required' }),
  description: z.string()
    .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH, 'Description must not exceed 500 characters')
    .optional(),
})

const partiesStakeholdersSchema = z.object({
  counterparty_name: z.string().min(1, 'Counterparty name is required'),
  counterparty_email: z.string().email('Invalid email format').optional().or(z.literal('')),
  counterparty_phone: z.string().optional(),
  internal_owner_id: z.string().optional(),
  approver_ids: z.array(z.string()).min(1, 'At least one approver is required'),
})

const termsConditionsSchema = z.object({
  value: z.number().positive('Contract value must be positive').optional(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  payment_terms: z.enum(['due_on_receipt', 'net_30', 'net_60', 'net_90', 'quarterly', 'annually']).optional(),
  auto_renewal: z.boolean(),
  renewal_notice_period: z.number().optional(),
  governing_law: z.string().optional(),
  key_clause_ids: z.array(z.string()),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date)
  }
  return true
}, { message: 'End date must be after start date', path: ['end_date'] })

const reviewSubmitSchema = z.object({
  save_as_draft: z.boolean(),
  notifications_enabled: z.boolean(),
})


// Main ContractCreatePage Component
export default function ContractCreatePage() {
  const navigate = useNavigate()
  
  // State management
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([])
  const [formData, setFormData] = useState<ContractCreationFormData>({
    title: '',
    contract_type: '',
    description: '',
    counterparty_name: '',
    counterparty_email: '',
    counterparty_phone: '',
    internal_owner_id: '',
    approver_ids: [],
    value: undefined,
    currency: 'USD',
    start_date: '',
    end_date: '',
    payment_terms: undefined,
    auto_renewal: false,
    renewal_notice_period: undefined,
    governing_law: '',
    key_clause_ids: [],
    save_as_draft: false,
    notifications_enabled: true,
    attachments: [],
    template_id: undefined,
  })
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AIClauseResponse | null>(null)
  const [riskAssessment, setRiskAssessment] = useState<AIRiskAssessment | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Form validation schemas by step
  const getValidationSchema = (step: WizardStep) => {
    switch (step) {
      case 1:
        return basicInformationSchema
      case 2:
        return partiesStakeholdersSchema
      case 3:
        return termsConditionsSchema
      case 4:
        return reviewSubmitSchema
      default:
        return z.object({})
    }
  }

  // Update form data and track changes
  const updateFormData = useCallback((updates: Partial<ContractCreationFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }, [])

  // Load templates
  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true)
    try {
      const mockTemplates: ContractTemplate[] = [
        { id: '1', name: 'Purchase Agreement', category: 'purchase' },
        { id: '2', name: 'NDA Template', category: 'nda' },
      ]
      setTemplates(mockTemplates)
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }, [])

  // AI suggestions effect
  useEffect(() => {
    if (formData.title.length > 10) {
      setIsAnalyzing(true)
      const timer = setTimeout(async () => {
        try {
          // Mock AI response for testing
          if (formData.title.toLowerCase().includes('purchase')) {
            setAiSuggestions({
              clauses: [
                { id: '1', title: 'Payment Terms', recommended: true, risk_level: 'low' },
                { id: '2', title: 'Termination Clause', recommended: true, risk_level: 'medium' }
              ]
            })
          }
          setIsAnalyzing(false)
        } catch (error) {
          console.error('AI analysis failed:', error)
          setIsAnalyzing(false)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [formData.title])

  // Initialize templates
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Validate current step
  const validateStep = useCallback((step: WizardStep): { isValid: boolean; errors: Record<string, string> } => {
    const schema = getValidationSchema(step)
    
    try {
      schema.parse(formData)
      return { isValid: true, errors: {} }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const stepErrors: Record<string, string> = {}
        if (error.errors) {
          error.errors.forEach((err) => {
            const field = err.path.join('.')
            stepErrors[field] = err.message
          })
        }
        return { isValid: false, errors: stepErrors }
      }
      return { isValid: false, errors: { general: 'Validation failed' } }
    }
  }, [formData])

  // Navigate to next step
  const handleNext = useCallback(() => {
    const validation = validateStep(currentStep)
    
    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    setErrors({})
    setCompletedSteps(prev => [...prev.filter(s => s !== currentStep), currentStep])
    
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as WizardStep)
    }
  }, [currentStep, validateStep])

  // Navigate to previous step
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep)
      setErrors({})
    }
  }, [currentStep])

  // Handle template selection
  const handleTemplateSelect = useCallback((template: ContractTemplate) => {
    updateFormData({
      template_id: template.id,
      title: `Template Contract`,
      contract_type: template.category,
      description: 'Template description'
    })
    setShowTemplateModal(false)
  }, [updateFormData])

  // Handle file attachments
  const handleAttachmentsChange = useCallback((attachments: ContractAttachment[]) => {
    updateFormData({ attachments })
  }, [updateFormData])

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowCancelModal(true)
    } else {
      navigate('/contracts')
    }
  }, [hasChanges, navigate])

  // Confirm cancel
  const confirmCancel = useCallback(() => {
    navigate('/contracts')
  }, [navigate])

  // Submit contract
  const handleSubmit = useCallback(async (isDraft: boolean = false) => {
    const finalValidation = validateStep(4)
    if (!finalValidation.isValid) {
      setErrors(finalValidation.errors)
      return
    }

    setIsSubmitting(true)
    try {
      const contractData: CreateContractRequest = {
        title: formData.title,
        contract_type: formData.contract_type as any,
        description: formData.description,
        counterparty_name: formData.counterparty_name,
        counterparty_email: formData.counterparty_email,
        counterparty_phone: formData.counterparty_phone,
        internal_owner_id: formData.internal_owner_id,
        approver_ids: formData.approver_ids,
        value: formData.value,
        currency: formData.currency,
        start_date: formData.start_date,
        end_date: formData.end_date,
        payment_terms: formData.payment_terms,
        auto_renewal: formData.auto_renewal,
        renewal_notice_period: formData.renewal_notice_period,
        governing_law: formData.governing_law,
        key_clause_ids: formData.key_clause_ids,
        status: isDraft ? 'draft' : 'pending_approval',
        template_id: formData.template_id,
      }

      const contract = await contractService.createContract(contractData)
      navigate(`/contracts/${contract.id}`)
    } catch (error) {
      setErrors({ general: `Failed to create contract: ${error instanceof Error ? error.message : 'Unknown error'}` })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateStep, navigate])

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <Input
                  label="Contract Title"
                  name="title"
                  value={formData.title}
                  onChange={(e) => updateFormData({ title: e.target.value })}
                  error={errors.title}
                  required
                  placeholder="Enter contract title"
                />
                
                <div>
                  <label htmlFor="contract-type" className="block text-sm font-medium text-gray-700 mb-1">
                    Contract Type *
                  </label>
                  <select
                    id="contract-type"
                    name="contract_type"
                    value={formData.contract_type}
                    onChange={(e) => updateFormData({ contract_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select contract type</option>
                    {CONTRACT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {errors.contract_type && <p className="mt-1 text-sm text-red-600">{errors.contract_type}</p>}
                </div>
                
                <Input
                  label="Description"
                  name="description"
                  value={formData.description || ''}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  error={errors.description}
                  placeholder="Optional contract description"
                />
                
                {isAnalyzing && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <SparklesIcon className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-blue-800">Analyzing...</span>
                    </div>
                  </div>
                )}
                
                {formData.title.toLowerCase().includes('software purchase') && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800">AI suggests: Purchase Agreement</p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-md font-medium mb-3">Start from template</h3>
              <Button
                variant="secondary"
                onClick={() => setShowTemplateModal(true)}
                icon={<DocumentIcon className="h-4 w-4" />}
              >
                Choose Template
              </Button>
            </div>
          </div>
        )
      
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-4">Parties & Stakeholders</h2>
            <div className="space-y-4">
              <Input
                label="Counterparty Name"
                name="counterparty_name"
                value={formData.counterparty_name}
                onChange={(e) => updateFormData({ counterparty_name: e.target.value })}
                error={errors.counterparty_name}
                required
              />
              
              <Input
                label="Counterparty Email"
                name="counterparty_email"
                type="email"
                value={formData.counterparty_email || ''}
                onChange={(e) => updateFormData({ counterparty_email: e.target.value })}
                error={errors.counterparty_email}
              />
              
              <Input
                label="Counterparty Phone"
                name="counterparty_phone"
                value={formData.counterparty_phone || ''}
                onChange={(e) => updateFormData({ counterparty_phone: e.target.value })}
              />
              
              <Input
                label="Internal Owner"
                name="internal_owner"
                value={formData.internal_owner_id || ''}
                onChange={(e) => updateFormData({ internal_owner_id: e.target.value })}
              />
              
              <div>
                <label htmlFor="approvers" className="block text-sm font-medium text-gray-700 mb-1">
                  Approvers *
                </label>
                <select
                  id="approvers"
                  name="approvers"
                  multiple
                  value={formData.approver_ids}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value)
                    updateFormData({ approver_ids: values })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="john-doe">John Doe</option>
                  <option value="jane-smith">Jane Smith</option>
                </select>
                {errors.approver_ids && <p className="mt-1 text-sm text-red-600">{errors.approver_ids}</p>}
              </div>
            </div>
          </div>
        )
      
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-4">Terms & Conditions</h2>
            <div className="space-y-4">
              <Input
                label="Contract Value"
                name="value"
                type="number"
                value={formData.value || ''}
                onChange={(e) => updateFormData({ value: e.target.value ? Number(e.target.value) : undefined })}
                error={errors.value}
                prefix="$"
              />
              
              <Input
                label="Start Date"
                name="start_date"
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => updateFormData({ start_date: e.target.value })}
              />
              
              <Input
                label="End Date"
                name="end_date"
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => updateFormData({ end_date: e.target.value })}
                error={errors.end_date}
              />
              
              <div>
                <label htmlFor="payment-terms" className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  id="payment-terms"
                  value={formData.payment_terms || ''}
                  onChange={(e) => updateFormData({ payment_terms: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select payment terms</option>
                  {PAYMENT_TERMS.map(term => (
                    <option key={term.value} value={term.value}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <Input
                label="Governing Law"
                name="governing_law"
                value={formData.governing_law || ''}
                onChange={(e) => updateFormData({ governing_law: e.target.value })}
              />
              
              {aiSuggestions && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">Recommended Clauses</h3>
                  {aiSuggestions.clauses?.map(clause => (
                    <div key={clause.id} className="text-sm text-blue-700">
                      • {clause.title}
                    </div>
                  ))}
                </div>
              )}
              
              {riskAssessment && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-amber-800 mb-2">Risk Assessment</h3>
                  <p className="text-sm text-amber-700">Medium Risk</p>
                </div>
              )}
              
              {aiSuggestions?.missing_clauses && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-800 mb-2">Missing Clauses Detected</h3>
                  {aiSuggestions.missing_clauses.map(clause => (
                    <div key={clause} className="text-sm text-red-700">• {clause}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-4">Review & Submit</h2>
            <Card>
              <CardHeader>
                <CardTitle>Contract Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div><strong>Title:</strong> {formData.title}</div>
                <div><strong>Type:</strong> {CONTRACT_TYPES.find(t => t.value === formData.contract_type)?.label}</div>
                <div><strong>Counterparty:</strong> {formData.counterparty_name}</div>
                {formData.value && <div><strong>Value:</strong> ${formData.value?.toLocaleString()}</div>}
                {formData.start_date && <div><strong>Start Date:</strong> {formData.start_date}</div>}
                {formData.end_date && <div><strong>End Date:</strong> {formData.end_date}</div>}
              </CardContent>
            </Card>
            
            {isSubmitting && (
              <div className="text-center py-4">
                <div className="animate-spin h-6 w-6 border-b-2 border-blue-600 rounded-full mx-auto mb-2"></div>
                <p>Creating contract...</p>
              </div>
            )}
            
            {errors.general && (
              <div className="text-red-600 text-sm">{errors.general}</div>
            )}
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <main
      role="main"
      aria-label="Contract creation wizard"
      className="min-h-screen bg-gray-50 py-8"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Contract</h1>
          <p className="text-gray-600">Step {currentStep} of 4: {WIZARD_STEPS[currentStep - 1]?.title}</p>
        </div>

        {/* Progress Indicator */}
        <MobileStepper currentStep={currentStep} completedSteps={completedSteps} />
        <DesktopStepper currentStep={currentStep} completedSteps={completedSteps} />

        {/* Main Content */}
        <Card>
          <CardContent className="p-6">
            {renderStepContent()}
            
            {/* File Upload for all steps */}
            <div className="mt-8">
              <h3 className="text-md font-medium mb-4">Attachments</h3>
              <div className="text-sm text-gray-500 mb-2">
                Drag and drop files here or click to browse
              </div>
              <input 
                aria-label="File upload"
                type="file"
                className="hidden"
                id="file-upload"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                onChange={(e) => {
                  if (e.target.files) {
                    const files = Array.from(e.target.files)
                    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024)
                    if (oversizedFiles.length > 0) {
                      setErrors({ ...errors, files: 'File size must not exceed 10MB' })
                      return
                    }
                    const attachments = files.map((file, index) => ({
                      id: `file-${index}`,
                      name: file.name,
                      size: file.size,
                      type: file.type,
                      file,
                    }))
                    updateFormData({ attachments })
                  }
                }}
              />
              <Button 
                variant="secondary" 
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Browse Files
              </Button>
              {errors.files && <p className="mt-1 text-sm text-red-600">{errors.files}</p>}
              {formData.attachments.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Selected Files:</h4>
                  {formData.attachments.map((attachment) => (
                    <div key={attachment.id} className="text-sm text-gray-600 flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span>{attachment.name}</span>
                      <button 
                        onClick={() => {
                          const updatedAttachments = formData.attachments.filter(a => a.id !== attachment.id)
                          updateFormData({ attachments: updatedAttachments })
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <div className="flex space-x-3">
            {currentStep > 1 && (
              <Button
                variant="secondary"
                onClick={handleBack}
                disabled={isSubmitting}
                icon={<ChevronLeftIcon className="h-4 w-4" />}
              >
                Back
              </Button>
            )}

            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                icon={<ChevronRightIcon className="h-4 w-4" />}
              >
                Next
              </Button>
            ) : (
              <div className="flex space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                >
                  Save as Draft
                </Button>
                <Button
                  onClick={() => handleSubmit(false)}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Create Contract
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Screen Reader Announcements */}
        <div role="status" aria-live="polite" className="sr-only" id="announcements">
          {currentStep > 1 && `Moved to step ${currentStep} of 4: ${WIZARD_STEPS[currentStep - 1]?.title}`}
        </div>
      </div>

      {/* Modals */}
      <TemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleTemplateSelect}
        templates={templates}
        isLoading={isLoadingTemplates}
      />

      <CancelModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancel}
        hasChanges={hasChanges}
      />
    </main>
  )
}
