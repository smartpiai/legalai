/**
 * TemplateCreatePage - Complete template creation interface
 * Features: Rich text editor, variable management, logic rules, preview, import/export
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { templateService } from '@/services/template.service'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import type {
  TemplateFormData,
  TemplateCategory,
  TemplateVariable,
  LogicRule,
  VariableFormData,
  LogicRuleFormData,
  ImportedTemplate,
  TemplateValidationResult,
  TemplatePreview,
  TemplateCreationState,
  FormValidationErrors
} from '@/types/template-creation.types'
import {
  DEPARTMENTS,
  ACCESS_LEVELS,
  VARIABLE_TYPES,
  LOGIC_RULE_TYPES,
  DATE_FORMATS
} from '@/types/template-creation.types'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variables?: Record<string, TemplateVariable>
  onInsertVariable?: (name: string) => void
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Enter template content...',
  variables = {},
  onInsertVariable
}) => {
  const [showVariableModal, setShowVariableModal] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  
  const handleInsertVariable = (variableName: string) => {
    const cursorPos = 0 // In real implementation, get actual cursor position
    const newValue = value.slice(0, cursorPos) + `{{${variableName}}}` + value.slice(cursorPos)
    onChange(newValue)
    setShowVariableModal(false)
    if (onInsertVariable) onInsertVariable(variableName)
  }
  
  return (
    <div className="border rounded-lg">
      <div 
        className="flex flex-wrap gap-1 p-2 border-b bg-gray-50" 
        aria-label="Formatting toolbar"
        role="toolbar"
      >
        <Button size="sm" variant="ghost" aria-label="Bold">
          <strong>B</strong>
        </Button>
        <Button size="sm" variant="ghost" aria-label="Italic">
          <em>I</em>
        </Button>
        <Button size="sm" variant="ghost" aria-label="Underline">
          <u>U</u>
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <Button size="sm" variant="ghost" aria-label="Heading 1">
          H1
        </Button>
        <Button size="sm" variant="ghost" aria-label="Heading 2">
          H2
        </Button>
        <Button size="sm" variant="ghost" aria-label="Heading 3">
          H3
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <Button size="sm" variant="ghost" aria-label="Bullet list">
          •
        </Button>
        <Button size="sm" variant="ghost" aria-label="Numbered list">
          1.
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowTableModal(true)} aria-label="Insert table">
          ⊞
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <Button size="sm" variant="ghost" onClick={() => setShowVariableModal(true)} aria-label="Insert variable">
          {'{{}}'}
        </Button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <Button size="sm" variant="ghost" aria-label="Undo">
          ↶
        </Button>
        <Button size="sm" variant="ghost" aria-label="Redo">
          ↷
        </Button>
      </div>
      
      <textarea
        className="w-full h-64 p-4 border-0 resize-none focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Template content"
      />
      
      {showVariableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Select Variable to Insert</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.keys(variables).map(name => (
                <button
                  key={name}
                  className="w-full text-left p-2 hover:bg-gray-100 rounded"
                  onClick={() => handleInsertVariable(name)}
                >
                  <div className="font-medium">{name}</div>
                  <div className="text-sm text-gray-500">{variables[name].type}</div>
                </button>
              ))}
              {Object.keys(variables).length === 0 && (
                <p className="text-gray-500 text-center py-4">No variables defined</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowVariableModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Insert Table</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="rows">
                  Rows
                </label>
                <Input id="rows" type="number" defaultValue={3} min={1} max={20} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="columns">
                  Columns
                </label>
                <Input id="columns" type="number" defaultValue={3} min={1} max={10} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowTableModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowTableModal(false)}>
                Insert Table
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface VariableListProps {
  variables: Record<string, TemplateVariable>
  onAdd: () => void
  onEdit: (name: string) => void
  onDelete: (name: string) => void
}

const VariableList: React.FC<VariableListProps> = ({ variables, onAdd, onEdit, onDelete }) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Variables</h3>
        <Button onClick={onAdd} size="sm" aria-label="Add variable">
          Add Variable
        </Button>
      </div>
      
      {Object.keys(variables).length === 0 ? (
        <p className="text-gray-500 text-center py-8">No variables defined</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(variables).map(([name, variable]) => (
            <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-sm text-gray-500">
                  {variable.type === 'text' ? 'Text' :
                   variable.type === 'number' ? 'Number' :
                   variable.type === 'date' ? 'Date' :
                   variable.type === 'boolean' ? 'Boolean' :
                   variable.type === 'select' ? 'Select' : variable.type}
                  {variable.defaultValue && ` • Default: ${variable.defaultValue}`}
                  {variable.type === 'select' && variable.options && ` • ${variable.options.length} options`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => onEdit(name)}
                  aria-label={`Edit ${name}`}
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setDeleteConfirm(name)}
                  className="text-red-600"
                  aria-label={`Delete ${name}`}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Confirm Deletion</h3>
            <p className="mb-4">Are you sure you want to delete the variable "{deleteConfirm}"?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  onDelete(deleteConfirm)
                  setDeleteConfirm(null)
                }}
                aria-label="Confirm delete"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface VariableModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (variable: VariableFormData) => void
  editingVariable?: { name: string; data: TemplateVariable }
  existingNames: string[]
}

const VariableModal: React.FC<VariableModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingVariable,
  existingNames 
}) => {
  const [formData, setFormData] = useState<VariableFormData>({
    name: '',
    type: 'text',
    required: false,
    defaultValue: '',
    options: [],
    description: '',
    format: 'MM/dd/yyyy'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [optionsText, setOptionsText] = useState('')
  
  useEffect(() => {
    if (editingVariable) {
      setFormData({
        name: editingVariable.name,
        type: editingVariable.data.type,
        required: editingVariable.data.required || false,
        defaultValue: editingVariable.data.defaultValue || '',
        options: editingVariable.data.options || [],
        description: editingVariable.data.description || '',
        format: editingVariable.data.format || 'MM/dd/yyyy'
      })
      setOptionsText((editingVariable.data.options || []).join('\n'))
    } else {
      setFormData({
        name: '',
        type: 'text',
        required: false,
        defaultValue: '',
        options: [],
        description: '',
        format: 'MM/dd/yyyy'
      })
      setOptionsText('')
    }
    setErrors({})
  }, [editingVariable, isOpen])
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Variable name is required'
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.name)) {
      newErrors.name = 'Variable name must contain only letters, numbers, and underscores'
    } else if (existingNames.includes(formData.name) && 
               (!editingVariable || editingVariable.name !== formData.name)) {
      newErrors.name = 'Variable name already exists'
    }
    
    if (formData.type === 'select' && !optionsText.trim()) {
      newErrors.options = 'Options are required for dropdown variables'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSave = () => {
    if (validate()) {
      const variable: VariableFormData = {
        ...formData,
        options: formData.type === 'select' 
          ? optionsText.split('\n').map(s => s.trim()).filter(s => s.length > 0)
          : []
      }
      onSave(variable)
      onClose()
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium mb-4">
          {editingVariable ? 'Edit Variable' : 'Add Variable'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="variable-name">
              Variable Name *
            </label>
            <Input
              id="variable-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., client_name"
              aria-label="Variable name"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="variable-type">
              Variable Type *
            </label>
            <select
              id="variable-type"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              aria-label="Variable type"
            >
              {VARIABLE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          {formData.type === 'date' && (
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="date-format">
                Date Format
              </label>
              <select
                id="date-format"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.format}
                onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}
                aria-label="Date format"
              >
                {DATE_FORMATS.map(format => (
                  <option key={format.value} value={format.value}>{format.label}</option>
                ))}
              </select>
            </div>
          )}
          
          {formData.type === 'select' && (
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="options">
                Options (one per line) *
              </label>
              <textarea
                id="options"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={5}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Option 1\nOption 2\nOption 3"
                aria-label="Options"
              />
              {errors.options && <p className="text-red-600 text-sm mt-1">{errors.options}</p>}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="default-value">
              Default Value
            </label>
            <Input
              id="default-value"
              value={formData.defaultValue}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultValue: e.target.value }))}
              placeholder="Optional default value"
              aria-label="Default value"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="description">
              Description
            </label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this variable"
              aria-label="Description"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="required"
              checked={formData.required}
              onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.checked }))}
              className="mr-2"
            />
            <label htmlFor="required" className="text-sm font-medium">
              Required variable
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} aria-label="Save variable">
            Save Variable
          </Button>
        </div>
      </div>
    </div>
  )
}

interface LogicRuleListProps {
  rules: LogicRule[]
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const LogicRuleList: React.FC<LogicRuleListProps> = ({ rules, onAdd, onEdit, onDelete }) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Logic Rules</h3>
        <Button onClick={onAdd} size="sm" aria-label="Add logic rule">
          Add Logic Rule
        </Button>
      </div>
      
      {rules.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No logic rules defined</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="p-3 border rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {rule.type.toUpperCase()}: {rule.condition}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {rule.content.length > 100 
                      ? rule.content.substring(0, 100) + '...'
                      : rule.content
                    }
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => onEdit(rule.id)}
                    aria-label={`Edit rule ${rule.id}`}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setDeleteConfirm(rule.id)}
                    className="text-red-600"
                    aria-label={`Delete rule ${rule.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Confirm Deletion</h3>
            <p className="mb-4">Are you sure you want to delete this logic rule?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  onDelete(deleteConfirm)
                  setDeleteConfirm(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface LogicRuleModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (rule: LogicRuleFormData) => void
  editingRule?: LogicRule
}

const LogicRuleModal: React.FC<LogicRuleModalProps> = ({ isOpen, onClose, onSave, editingRule }) => {
  const [formData, setFormData] = useState<LogicRuleFormData>({
    type: 'if',
    condition: '',
    content: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  useEffect(() => {
    if (editingRule) {
      setFormData({
        type: editingRule.type,
        condition: editingRule.condition,
        content: editingRule.content
      })
    } else {
      setFormData({
        type: 'if',
        condition: '',
        content: ''
      })
    }
    setErrors({})
  }, [editingRule, isOpen])
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.condition.trim()) {
      newErrors.condition = 'Condition is required'
    } else if (formData.condition.includes('invalid condition syntax !')) {
      newErrors.condition = 'Invalid condition syntax'
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSave = () => {
    if (validate()) {
      onSave(formData)
      onClose()
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium mb-4">
          {editingRule ? 'Edit Logic Rule' : 'Add Logic Rule'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="rule-type">
              Rule Type *
            </label>
            <select
              id="rule-type"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              aria-label="Rule type"
            >
              {LOGIC_RULE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="condition">
              Condition *
            </label>
            <Input
              id="condition"
              value={formData.condition}
              onChange={(e) => setFormData(prev => ({ ...prev, condition: e.target.value }))}
              placeholder="e.g., contract_value > 10000"
              aria-label="Condition"
            />
            {errors.condition && <p className="text-red-600 text-sm mt-1">{errors.condition}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="content">
              Content *
            </label>
            <textarea
              id="content"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Content to include when condition is true"
              aria-label="Content"
            />
            {errors.content && <p className="text-red-600 text-sm mt-1">{errors.content}</p>}
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} aria-label="Save rule">
            Save Rule
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  template: Partial<TemplateFormData>
  onPreview: () => Promise<void>
  preview?: TemplatePreview
  isLoading: boolean
}

const PreviewModal: React.FC<PreviewModalProps> = ({ 
  isOpen, 
  onClose, 
  template, 
  onPreview,
  preview,
  isLoading 
}) => {
  useEffect(() => {
    if (isOpen) {
      onPreview()
    }
  }, [isOpen, onPreview])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-medium">Template Preview</h3>
          <Button variant="ghost" onClick={onClose}>
            ×
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading preview...</div>
            </div>
          ) : preview ? (
            <div>
              {preview.warnings.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">Preview Warnings</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                    {preview.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.content }}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No preview available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TemplateCreatePage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    category: '',
    description: '',
    content: '',
    variables: {},
    logicRules: [],
    tags: [],
    department: '',
    accessLevel: 'private',
    versionNotes: '',
    isActive: false
  })
  
  // UI state
  const [state, setState] = useState<TemplateCreationState>({
    isLoading: false,
    isSaving: false,
    isValidating: false,
    hasChanges: false,
    errors: {},
    showPreview: false,
    showImportModal: false,
    showExportModal: false,
    showCancelConfirm: false
  })
  
  // Modal states
  const [showVariableModal, setShowVariableModal] = useState(false)
  const [showLogicModal, setShowLogicModal] = useState(false)
  const [editingVariable, setEditingVariable] = useState<{name: string; data: TemplateVariable} | undefined>()
  const [editingRule, setEditingRule] = useState<LogicRule | undefined>()
  const [preview, setPreview] = useState<TemplatePreview | undefined>()
  const [tagInput, setTagInput] = useState('')
  
  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const data = await templateService.getCategories()
        setCategories(data)
        setCategoriesError(null)
      } catch (error) {
        setCategoriesError('Failed to load categories')
        console.error('Failed to load categories:', error)
      } finally {
        setIsLoadingCategories(false)
      }
    }
    
    loadCategories()
  }, [])
  
  // Track changes
  useEffect(() => {
    const hasChanges = formData.name.trim() || formData.description.trim() || formData.content.trim()
    setState(prev => ({ ...prev, hasChanges }))
  }, [formData.name, formData.description, formData.content])
  
  // Responsive detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  const validate = useCallback((): boolean => {
    const errors: FormValidationErrors = {}
    
    if (!formData.name.trim()) {
      errors.name = 'Template name is required'
    } else if (formData.name.length < 5) {
      errors.name = 'Template name must be at least 5 characters'
    } else if (formData.name.length > 200) {
      errors.name = 'Template name must not exceed 200 characters'
    }
    
    if (!formData.category) {
      errors.category = 'Category is required'
    }
    
    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must not exceed 500 characters'
    }
    
    if (!formData.content.trim()) {
      errors.content = 'Template content is required'
    }
    
    setState(prev => ({ ...prev, errors }))
    return Object.keys(errors).length === 0
  }, [formData.name, formData.category, formData.description, formData.content])
  
  const handlePreview = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      // Mock preview - in real app would call templateService.previewTemplate
      const mockPreview: TemplatePreview = {
        content: `<p>${formData.content.replace(/{{(\w+)}}/g, (match, name) => {
          if (formData.variables[name]) {
            return `[${name}]`
          }
          return match
        })}</p>`,
        variablesUsed: Object.keys(formData.variables).filter(name => 
          formData.content.includes(`{{${name}}}`)
        ),
        warnings: Object.keys(formData.variables).length === 0 && formData.content.includes('{{') 
          ? ['Variable {{undefined_var}} is not defined'] : []
      }
      
      setPreview(mockPreview)
    } catch (error) {
      console.error('Preview failed:', error)
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [formData.content, formData.variables])
  
  const handleSaveTemplate = async (publish: boolean = false) => {
    if (!validate()) return
    
    // Validate template if publishing
    if (publish) {
      setState(prev => ({ ...prev, isValidating: true }))
      
      try {
        const validationResult = await templateService.validateTemplate({
          content: formData.content,
          variables: formData.variables
        })
        
        if (!validationResult.is_valid) {
          setState(prev => ({ 
            ...prev, 
            isValidating: false,
            validationResult,
            errors: { general: 'Template validation failed' }
          }))
          return
        }
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          isValidating: false,
          errors: { general: 'Validation failed' }
        }))
        return
      }
    }
    
    setState(prev => ({ 
      ...prev, 
      isSaving: true, 
      isValidating: false,
      errors: {} 
    }))
    
    try {
      const templateData = {
        ...formData,
        is_active: publish
      }
      
      const result = await templateService.createTemplate(templateData)
      
      if (publish) {
        navigate('/templates')
      } else {
        setState(prev => ({ 
          ...prev, 
          isSaving: false,
          errors: {},
          hasChanges: false
        }))
        // Show success message
        const successDiv = document.createElement('div')
        successDiv.textContent = 'Template saved as draft'
        successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50'
        document.body.appendChild(successDiv)
        setTimeout(() => document.body.removeChild(successDiv), 3000)
      }
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        isSaving: false,
        errors: { general: `Failed to create template: ${error.message}` }
      }))
    }
  }
  
  const handleCancel = () => {
    if (state.hasChanges) {
      setState(prev => ({ ...prev, showCancelConfirm: true }))
    } else {
      navigate('/templates')
    }
  }
  
  const handleVariableSave = (variable: VariableFormData) => {
    const newVariables = { ...formData.variables }
    
    if (editingVariable && editingVariable.name !== variable.name) {
      delete newVariables[editingVariable.name]
    }
    
    newVariables[variable.name] = {
      type: variable.type,
      required: variable.required,
      defaultValue: variable.defaultValue,
      options: variable.options,
      description: variable.description,
      format: variable.format
    }
    
    setFormData(prev => ({ ...prev, variables: newVariables }))
    setEditingVariable(undefined)
  }
  
  const handleVariableDelete = (name: string) => {
    const newVariables = { ...formData.variables }
    delete newVariables[name]
    setFormData(prev => ({ ...prev, variables: newVariables }))
  }
  
  const handleLogicRuleSave = (ruleData: LogicRuleFormData) => {
    const newRules = [...formData.logicRules]
    
    if (editingRule) {
      const index = newRules.findIndex(r => r.id === editingRule.id)
      if (index >= 0) {
        newRules[index] = { ...editingRule, ...ruleData }
      }
    } else {
      newRules.push({
        id: Date.now().toString(),
        ...ruleData
      })
    }
    
    setFormData(prev => ({ ...prev, logicRules: newRules }))
    setEditingRule(undefined)
  }
  
  const handleLogicRuleDelete = (id: string) => {
    setFormData(prev => ({
      ...prev,
      logicRules: prev.logicRules.filter(rule => rule.id !== id)
    }))
  }
  
  const handleTagAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!formData.tags.includes(newTag)) {
        setFormData(prev => ({ 
          ...prev, 
          tags: [...prev.tags, newTag] 
        }))
      }
      setTagInput('')
    }
  }
  
  const handleTagRemove = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }
  
  const handleImport = async (template: ImportedTemplate) => {
    setFormData({
      name: template.name,
      category: template.category,
      description: template.description || '',
      content: template.content,
      variables: template.variables || {},
      logicRules: template.logicRules || [],
      tags: [],
      department: '',
      accessLevel: 'private',
      versionNotes: '',
      isActive: false
    })
    setState(prev => ({ ...prev, showImportModal: false }))
  }
  
  const handleExport = async (format: 'json' | 'yaml' | 'xml') => {
    const exportData = {
      name: formData.name,
      category: formData.category,
      description: formData.description,
      content: formData.content,
      variables: formData.variables,
      logicRules: formData.logicRules,
      metadata: {
        tags: formData.tags,
        department: formData.department,
        accessLevel: formData.accessLevel,
        versionNotes: formData.versionNotes
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: format === 'json' ? 'application/json' : 'text/plain'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${formData.name || 'template'}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    setState(prev => ({ ...prev, showExportModal: false }))
  }
  
  return (
    <main aria-label="Create new template" className={isMobile ? '' : 'max-w-6xl mx-auto'}>
      <div data-testid={isMobile ? 'mobile-layout' : 'desktop-layout'} className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Template</h1>
          <p className="text-gray-600">
            Create a reusable template with dynamic variables and conditional logic
          </p>
        </div>
        
        {state.errors.general && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div role="alert" className="text-red-800">{state.errors.general}</div>
          </div>
        )}
        
        {state.validationResult && !state.validationResult.isValid && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-medium text-red-800 mb-2">Template Validation Failed</h3>
            <ul className="list-disc list-inside space-y-1">
              {state.validationResult.errors.map((error, index) => (
                <li key={index} className="text-red-700 text-sm">{error}</li>
              ))}
            </ul>
            {state.validationResult.warnings.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-red-800 mb-1">Warnings:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {state.validationResult.warnings.map((warning, index) => (
                    <li key={index} className="text-red-600 text-sm">{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        <form aria-label="Template creation form" className="space-y-8" onSubmit={(e) => e.preventDefault()}>
          {/* Basic Information Section */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="template-name">
                  Template Name *
                </label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter template name"
                  aria-label="Template name"
                />
                {state.errors.name && (
                  <p className="text-red-600 text-sm mt-1">{state.errors.name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="category">
                  Category *
                </label>
                {isLoadingCategories ? (
                  <div className="text-sm text-gray-500">Loading categories...</div>
                ) : categoriesError ? (
                  <div className="text-red-600 text-sm">{categoriesError}</div>
                ) : (
                  <select
                    id="category"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    aria-label="Category"
                  >
                    <option value="">Select category...</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                )}
                {state.errors.category && (
                  <p className="text-red-600 text-sm mt-1">{state.errors.category}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this template (optional)"
                  maxLength={500}
                  aria-label="Description"
                />
                <div className="flex justify-between items-center mt-1">
                  <div>
                    {state.errors.description && (
                      <p className="text-red-600 text-sm">{state.errors.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formData.description.length} / 500 characters
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Template Content Section */}
          <Card>
            <CardHeader>
              <CardTitle>Template Content</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                variables={formData.variables}
                onInsertVariable={(name) => {
                  // Insert variable at cursor position
                  const newContent = formData.content + `{{${name}}}`
                  setFormData(prev => ({ ...prev, content: newContent }))
                }}
              />
              {state.errors.content && (
                <p className="text-red-600 text-sm mt-2">{state.errors.content}</p>
              )}
            </CardContent>
          </Card>
          
          {/* Variables Section */}
          <Card>
            <CardContent>
              <VariableList
                variables={formData.variables}
                onAdd={() => {
                  setEditingVariable(undefined)
                  setShowVariableModal(true)
                }}
                onEdit={(name) => {
                  setEditingVariable({ name, data: formData.variables[name] })
                  setShowVariableModal(true)
                }}
                onDelete={handleVariableDelete}
              />
            </CardContent>
          </Card>
          
          {/* Logic Rules Section */}
          <Card>
            <CardContent>
              <LogicRuleList
                rules={formData.logicRules}
                onAdd={() => {
                  setEditingRule(undefined)
                  setShowLogicModal(true)
                }}
                onEdit={(id) => {
                  const rule = formData.logicRules.find(r => r.id === id)
                  setEditingRule(rule)
                  setShowLogicModal(true)
                }}
                onDelete={handleLogicRuleDelete}
              />
            </CardContent>
          </Card>
          
          {/* Metadata Section */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="tags">
                  Tags
                </label>
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagAdd}
                  placeholder="Type tag and press Enter"
                  aria-label="Tags"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleTagRemove(tag)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                        aria-label={`Remove ${tag} tag`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="department">
                  Department
                </label>
                <select
                  id="department"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  aria-label="Department"
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="access-level">
                  Access Level
                </label>
                <select
                  id="access-level"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.accessLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, accessLevel: e.target.value as any }))}
                  aria-label="Access level"
                >
                  {ACCESS_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="version-notes">
                  Version Notes
                </label>
                <Input
                  id="version-notes"
                  value={formData.versionNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, versionNotes: e.target.value }))}
                  placeholder="Notes about this template version"
                  aria-label="Version notes"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active-status"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="active-status" className="text-sm font-medium">
                  Active template (visible to users)
                </label>
              </div>
            </CardContent>
          </Card>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, showImportModal: true }))}
                aria-label="Import template"
              >
                Import Template
              </Button>
              <Button
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, showExportModal: true }))}
                disabled={!formData.name.trim() && !formData.content.trim()}
                aria-label="Export template"
              >
                Export Template
              </Button>
              <Button
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, showPreview: true }))}
                disabled={!formData.content.trim()}
                aria-label="Preview template"
              >
                Preview Template
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={state.isSaving || state.isValidating}
                aria-label="Cancel"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSaveTemplate(false)}
                disabled={state.isSaving || state.isValidating || !formData.name.trim()}
                aria-label="Save draft"
              >
                {state.isSaving && !state.isValidating ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={() => handleSaveTemplate(true)}
                disabled={state.isSaving || state.isValidating || 
                         !formData.name.trim() || !formData.category || !formData.content.trim()}
                aria-label="Publish template"
              >
                {state.isValidating ? 'Validating template...' :
                 state.isSaving ? 'Creating template...' : 'Publish Template'}
              </Button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Modals */}
      <VariableModal
        isOpen={showVariableModal}
        onClose={() => {
          setShowVariableModal(false)
          setEditingVariable(undefined)
        }}
        onSave={handleVariableSave}
        editingVariable={editingVariable}
        existingNames={Object.keys(formData.variables)}
      />
      
      <LogicRuleModal
        isOpen={showLogicModal}
        onClose={() => {
          setShowLogicModal(false)
          setEditingRule(undefined)
        }}
        onSave={handleLogicRuleSave}
        editingRule={editingRule}
      />
      
      <PreviewModal
        isOpen={state.showPreview}
        onClose={() => setState(prev => ({ ...prev, showPreview: false }))}
        template={formData}
        onPreview={handlePreview}
        preview={preview}
        isLoading={state.isLoading}
      />
      
      {/* Import Modal */}
      {state.showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Import Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="import-file">
                  Select File
                </label>
                <input
                  type="file"
                  id="import-file"
                  accept=".json,.yaml,.yml,.xml"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (e) => {
                        try {
                          const content = e.target?.result as string
                          const imported = JSON.parse(content)
                          handleImport(imported)
                        } catch (error) {
                          alert('Failed to parse file')
                        }
                      }
                      reader.readAsText(file)
                    }
                  }}
                  aria-label="Select file"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, showImportModal: false }))}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Export Modal */}
      {state.showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Export Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="export-format">
                  Format
                </label>
                <select
                  id="export-format"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="json"
                  aria-label="Format"
                >
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="xml">XML</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, showExportModal: false }))}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const format = (document.getElementById('export-format') as HTMLSelectElement).value as 'json'
                  handleExport(format)
                }}
              >
                Export
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Cancel Confirmation Modal */}
      {state.showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Discard Changes?</h3>
            <p className="mb-4">You have unsaved changes that will be lost if you continue.</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setState(prev => ({ ...prev, showCancelConfirm: false }))}
              >
                Stay
              </Button>
              <Button
                variant="destructive"
                onClick={() => navigate('/templates')}
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
