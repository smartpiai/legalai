/**
 * TypeScript types for template creation functionality
 */

export interface TemplateFormData {
  name: string
  category: string
  description?: string
  content: string
  variables: Record<string, TemplateVariable>
  logicRules: LogicRule[]
  tags: string[]
  department?: string
  accessLevel: 'public' | 'department' | 'private'
  versionNotes?: string
  isActive: boolean
}

export interface TemplateVariable {
  type: 'text' | 'number' | 'date' | 'boolean' | 'select'
  required?: boolean
  defaultValue?: any
  options?: string[]
  validation?: string
  description?: string
  format?: string // For date variables
}

export interface LogicRule {
  id: string
  type: 'if' | 'for' | 'switch'
  condition: string
  content: string
}

export interface TemplateCategory {
  id: string
  name: string
  count: number
}

export interface TemplateValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface TemplatePreview {
  content: string
  variablesUsed: string[]
  warnings: string[]
}

export interface VariableFormData {
  name: string
  type: 'text' | 'number' | 'date' | 'boolean' | 'select'
  required: boolean
  defaultValue?: any
  options?: string[]
  description?: string
  format?: string
}

export interface LogicRuleFormData {
  type: 'if' | 'for' | 'switch'
  condition: string
  content: string
}

export interface ImportedTemplate {
  name: string
  category: string
  description?: string
  content: string
  variables?: Record<string, TemplateVariable>
  logicRules?: LogicRule[]
  metadata?: Record<string, any>
}

export interface EditorAction {
  type: 'bold' | 'italic' | 'underline' | 'header1' | 'header2' | 'header3' | 
        'bulletList' | 'numberedList' | 'table' | 'insertVariable' | 'undo' | 'redo'
  payload?: any
}

export interface TableInsertConfig {
  rows: number
  columns: number
  hasHeaders: boolean
}

// Form validation schemas
export interface FormValidationErrors {
  name?: string
  category?: string
  description?: string
  content?: string
  variables?: Record<string, string>
  logicRules?: Record<string, string>
  general?: string
}

export interface TemplateCreationState {
  isLoading: boolean
  isSaving: boolean
  isValidating: boolean
  hasChanges: boolean
  validationResult?: TemplateValidationResult
  errors: FormValidationErrors
  showPreview: boolean
  showImportModal: boolean
  showExportModal: boolean
  showCancelConfirm: boolean
}

// Rich text editor types
export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readonly?: boolean
  variables?: Record<string, TemplateVariable>
  onInsertVariable?: (variableName: string) => void
}

export interface EditorToolbarProps {
  onAction: (action: EditorAction) => void
  canUndo: boolean
  canRedo: boolean
  variables: Record<string, TemplateVariable>
}

// Variable management types
export interface VariableListProps {
  variables: Record<string, TemplateVariable>
  onAdd: (variable: VariableFormData) => void
  onEdit: (name: string, variable: VariableFormData) => void
  onDelete: (name: string) => void
  onInsert?: (name: string) => void
}

export interface VariableModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (variable: VariableFormData) => void
  editingVariable?: { name: string; data: TemplateVariable }
  existingNames: string[]
}

// Logic rules types
export interface LogicRuleListProps {
  rules: LogicRule[]
  onAdd: (rule: LogicRuleFormData) => void
  onEdit: (id: string, rule: LogicRuleFormData) => void
  onDelete: (id: string) => void
}

export interface LogicRuleModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (rule: LogicRuleFormData) => void
  editingRule?: LogicRule
}

// Import/Export types
export interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (template: ImportedTemplate) => void
}

export interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  template: Partial<TemplateFormData>
  onExport: (format: 'json' | 'yaml' | 'xml') => void
}

// Preview types
export interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  template: Partial<TemplateFormData>
  preview?: TemplatePreview
  isLoading: boolean
}

// Department and access level options
export const DEPARTMENTS = [
  'Legal',
  'HR', 
  'Finance',
  'Operations',
  'IT',
  'Sales',
  'Marketing'
] as const

export const ACCESS_LEVELS = [
  { value: 'public', label: 'Public - All users can access' },
  { value: 'department', label: 'Department - Only department members' },
  { value: 'private', label: 'Private - Only you can access' }
] as const

export const VARIABLE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean (Yes/No)' },
  { value: 'select', label: 'Dropdown' }
] as const

export const LOGIC_RULE_TYPES = [
  { value: 'if', label: 'If/Then Condition' },
  { value: 'for', label: 'Loop/Repeat' },
  { value: 'switch', label: 'Multiple Conditions' }
] as const

export const DATE_FORMATS = [
  { value: 'MM/dd/yyyy', label: 'MM/dd/yyyy' },
  { value: 'dd/MM/yyyy', label: 'dd/MM/yyyy' },
  { value: 'yyyy-MM-dd', label: 'yyyy-MM-dd' },
  { value: 'MMMM d, yyyy', label: 'Month d, yyyy' }
] as const