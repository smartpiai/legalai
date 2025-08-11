/**
 * TypeScript interfaces for Contract Creation wizard
 * Defines all types used in the multi-step contract creation process
 */

export type ContractType = 
  | 'purchase' 
  | 'sales' 
  | 'nda' 
  | 'employment' 
  | 'service' 
  | 'license' 
  | 'other'

export type PaymentTerms = 
  | 'net_30' 
  | 'net_60' 
  | 'net_90' 
  | 'due_on_receipt' 
  | 'quarterly' 
  | 'annually'

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'

export type WizardStep = 1 | 2 | 3 | 4

// Form data interfaces for each step
export interface BasicInformationData {
  title: string
  contract_type: ContractType | ''
  description?: string
}

export interface PartiesStakeholdersData {
  counterparty_name: string
  counterparty_email?: string
  counterparty_phone?: string
  internal_owner_id?: string
  approver_ids: string[]
}

export interface TermsConditionsData {
  value?: number
  currency: Currency
  start_date?: string
  end_date?: string
  payment_terms?: PaymentTerms
  auto_renewal: boolean
  renewal_notice_period?: number
  governing_law?: string
  key_clause_ids: string[]
}

export interface ReviewSubmitData {
  save_as_draft: boolean
  notifications_enabled: boolean
}

// Combined form data
export interface ContractCreationFormData 
  extends BasicInformationData, 
          PartiesStakeholdersData, 
          TermsConditionsData, 
          ReviewSubmitData {
  template_id?: string
  attachments: ContractAttachment[]
}

// File upload interfaces
export interface ContractAttachment {
  id?: string
  name: string
  size: number
  type: string
  file?: File
  uploaded_at?: string
  upload_progress?: number
}

// Template interfaces
export interface ContractTemplate {
  id: string
  name: string
  description?: string
  category: ContractType
  thumbnail?: string
  variables?: TemplateVariable[]
}

export interface TemplateVariable {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  required: boolean
  default_value?: string
  options?: string[]
}

// User/Stakeholder interfaces
export interface User {
  id: string
  full_name: string
  email: string
  role: string
  department?: string
  avatar?: string
}

// Clause interfaces
export interface ContractClause {
  id: string
  title: string
  description?: string
  category: string
  content: string
  is_standard: boolean
  risk_level: 'low' | 'medium' | 'high'
}

// AI suggestion interfaces
export interface AISuggestion {
  type: 'contract_type' | 'clause' | 'risk_warning'
  suggestion: string
  confidence: number
  reasoning?: string
}

export interface AITypeResponse {
  suggested_type: ContractType
  confidence: number
  reasoning?: string
}

export interface AIClauseResponse {
  clauses: Array<{
    id: string
    title: string
    recommended: boolean
    risk_level: 'low' | 'medium' | 'high'
  }>
  missing_clauses?: string[]
  recommendations?: string[]
}

export interface AIRiskAssessment {
  overall_risk: 'low' | 'medium' | 'high'
  risk_score: number
  risk_factors: Array<{
    factor: string
    severity: 'low' | 'medium' | 'high'
    mitigation?: string
  }>
}

// Form validation interfaces
export interface ValidationError {
  field: string
  message: string
}

export interface StepValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// Wizard state interfaces
export interface WizardState {
  currentStep: WizardStep
  completedSteps: WizardStep[]
  formData: ContractCreationFormData
  isSubmitting: boolean
  isDraft: boolean
  hasChanges: boolean
  validationErrors: Record<string, string>
}

// Component props interfaces
export interface StepProps {
  formData: ContractCreationFormData
  errors: Record<string, string>
  onDataChange: (data: Partial<ContractCreationFormData>) => void
  onNext: () => void
  onBack: () => void
  isValid: boolean
  isLoading?: boolean
}

export interface ProgressIndicatorProps {
  currentStep: WizardStep
  completedSteps: WizardStep[]
  stepTitles: string[]
  className?: string
}

export interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ContractTemplate, variables?: Record<string, any>) => void
  templates: ContractTemplate[]
  isLoading?: boolean
}

export interface FileUploadProps {
  attachments: ContractAttachment[]
  onAttachmentsChange: (attachments: ContractAttachment[]) => void
  maxFileSize?: number
  acceptedTypes?: string[]
  maxFiles?: number
}

export interface CancelModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  hasChanges: boolean
}

// API response interfaces
export interface CreateContractRequest {
  title: string
  contract_type: ContractType
  description?: string
  counterparty_name: string
  counterparty_email?: string
  counterparty_phone?: string
  internal_owner_id?: string
  approver_ids: string[]
  value?: number
  currency?: Currency
  start_date?: string
  end_date?: string
  payment_terms?: PaymentTerms
  auto_renewal?: boolean
  renewal_notice_period?: number
  governing_law?: string
  key_clause_ids?: string[]
  status?: 'draft' | 'pending_approval' | 'active'
  template_id?: string
  metadata?: Record<string, any>
}

export interface CreateContractResponse {
  id: string
  title: string
  contract_number: string
  status: string
  created_at: string
  created_by: string
}

// Form step configuration
export interface StepConfig {
  id: WizardStep
  title: string
  description: string
  fields: string[]
  optional: boolean
}

// Constants and configurations
export const CONTRACT_TYPES: Array<{ value: ContractType; label: string }> = [
  { value: 'purchase', label: 'Purchase Agreement' },
  { value: 'sales', label: 'Sales Contract' },
  { value: 'nda', label: 'Non-Disclosure Agreement' },
  { value: 'employment', label: 'Employment Contract' },
  { value: 'service', label: 'Service Agreement' },
  { value: 'license', label: 'License Agreement' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_TERMS: Array<{ value: PaymentTerms; label: string }> = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_30', label: 'Net 30 Days' },
  { value: 'net_60', label: 'Net 60 Days' },
  { value: 'net_90', label: 'Net 90 Days' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

export const CURRENCIES: Array<{ value: Currency; label: string; symbol: string }> = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
]

export const WIZARD_STEPS: StepConfig[] = [
  {
    id: 1,
    title: 'Basic Information',
    description: 'Contract title, type, and description',
    fields: ['title', 'contract_type', 'description'],
    optional: false,
  },
  {
    id: 2,
    title: 'Parties & Stakeholders',
    description: 'Counterparty details and internal stakeholders',
    fields: ['counterparty_name', 'counterparty_email', 'internal_owner_id', 'approver_ids'],
    optional: false,
  },
  {
    id: 3,
    title: 'Terms & Conditions',
    description: 'Contract value, dates, and key terms',
    fields: ['value', 'start_date', 'end_date', 'payment_terms', 'governing_law'],
    optional: true,
  },
  {
    id: 4,
    title: 'Review & Submit',
    description: 'Review all information and create contract',
    fields: [],
    optional: false,
  },
]

// Validation constants
export const VALIDATION_RULES = {
  TITLE_MIN_LENGTH: 5,
  TITLE_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 500,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 5,
  ACCEPTED_FILE_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
} as const