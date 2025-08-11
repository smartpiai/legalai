/**
 * ContractEditPage - Contract editing interface with version control and change tracking
 * Implements comprehensive contract editing with real-time validation, auto-save, and version management
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import {
  ChevronLeftIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { contractService } from '@/services/contract.service'
import {
  ContractCreationFormData,
  CONTRACT_TYPES,
  PAYMENT_TERMS,
  CURRENCIES,
  VALIDATION_RULES,
} from '@/types/contract-creation.types'

// Contract interface from service
interface Contract {
  id: string;
  title: string;
  contract_number?: string;
  contract_type?: string;
  status: string;
  description?: string;
  value?: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  counterparty_name?: string;
  counterparty_email?: string;
  counterparty_phone?: string;
  internal_owner_id?: string;
  approver_ids?: string[];
  payment_terms?: string;
  auto_renewal?: boolean;
  renewal_notice_period?: number;
  governing_law?: string;
  key_clause_ids?: string[];
  parties?: string[];
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

interface ContractVersion {
  id: string;
  version_number: number;
  created_at: string;
  created_by: string;
  changes: string;
}

interface ContractDocument {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  uploaded_by?: string;
}

// Form validation schemas
const contractEditSchema = z.object({
  title: z.string()
    .min(VALIDATION_RULES.TITLE_MIN_LENGTH, 'Title is required')
    .max(VALIDATION_RULES.TITLE_MAX_LENGTH, 'Title must not exceed 200 characters'),
  contract_type: z.enum(['purchase', 'sales', 'nda', 'employment', 'service', 'license', 'other'])
    .optional(),
  description: z.string()
    .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH, 'Description must not exceed 500 characters')
    .optional(),
  counterparty_name: z.string().min(1, 'Counterparty name is required').optional(),
  counterparty_email: z.string().email('Invalid email format').optional().or(z.literal('')),
  counterparty_phone: z.string().optional(),
  internal_owner_id: z.string().optional(),
  approver_ids: z.array(z.string()).optional(),
  value: z.number().positive('Contract value must be positive').optional(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  payment_terms: z.enum(['due_on_receipt', 'net_30', 'net_60', 'net_90', 'quarterly', 'annually']).optional(),
  auto_renewal: z.boolean().optional(),
  renewal_notice_period: z.number().optional(),
  governing_law: z.string().optional(),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date)
  }
  return true
}, { message: 'End date must be after start date', path: ['end_date'] })

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function ContractEditPage() {
  const { id: contractId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Core state
  const [contract, setContract] = useState<Contract | null>(null)
  const [originalData, setOriginalData] = useState<Partial<ContractCreationFormData> | null>(null)
  const [formData, setFormData] = useState<Partial<ContractCreationFormData>>({})
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [documents, setDocuments] = useState<ContractDocument[]>([])

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [versionComment, setVersionComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [documentToRemove, setDocumentToRemove] = useState<string | null>(null)
  const [versionToRevert, setVersionToRevert] = useState<ContractVersion | null>(null)

  // Refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()
  const isFirstLoadRef = useRef(true)

  // Check if contract can be edited
  const canEdit = contract ? !['executed', 'cancelled'].includes(contract.status) : false
  const isFieldLocked = useCallback((fieldName: string) => {
    if (!contract) return false
    if (contract.status === 'executed' || contract.status === 'cancelled') return true
    if (contract.status === 'active' && ['value', 'start_date', 'end_date'].includes(fieldName)) return true
    return false
  }, [contract])

  // Load contract data
  const loadContractData = useCallback(async () => {
    if (!contractId) return

    try {
      setIsLoading(true)
      setError(null)
      
      const [contractData, versionsData, documentsData] = await Promise.all([
        contractService.getContract(contractId),
        contractService.getVersions(contractId),
        contractService.getDocuments(contractId)
      ])

      setContract(contractData)
      setVersions(versionsData)
      setDocuments(documentsData)

      // Convert contract data to form data format
      const initialFormData: Partial<ContractCreationFormData> = {
        title: contractData.title || '',
        contract_type: contractData.contract_type as any || '',
        description: contractData.description || '',
        counterparty_name: contractData.counterparty_name || '',
        counterparty_email: contractData.counterparty_email || '',
        counterparty_phone: contractData.counterparty_phone || '',
        internal_owner_id: contractData.internal_owner_id || '',
        approver_ids: contractData.approver_ids || [],
        value: contractData.value,
        currency: (contractData.currency as any) || 'USD',
        start_date: contractData.start_date || '',
        end_date: contractData.end_date || '',
        payment_terms: contractData.payment_terms as any,
        auto_renewal: contractData.auto_renewal || false,
        renewal_notice_period: contractData.renewal_notice_period,
        governing_law: contractData.governing_law || '',
        key_clause_ids: contractData.key_clause_ids || [],
        attachments: []
      }

      setFormData(initialFormData)
      setOriginalData(initialFormData)
      setRetryCount(0)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contract'
      setError(errorMessage)
      console.error('Failed to load contract data:', err)
    } finally {
      setIsLoading(false)
      isFirstLoadRef.current = false
    }
  }, [contractId])

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1)
    loadContractData()
  }, [loadContractData])

  // Track field changes
  const updateFormData = useCallback((updates: Partial<ContractCreationFormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates }
      
      // Track modified fields
      const newModifiedFields = new Set<string>()
      Object.keys(updates).forEach(key => {
        const originalValue = originalData?.[key as keyof ContractCreationFormData]
        const newValue = newData[key as keyof ContractCreationFormData]
        
        if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
          newModifiedFields.add(key)
        }
      })
      
      setModifiedFields(prev => {
        const combined = new Set([...prev, ...newModifiedFields])
        // Remove fields that are back to original
        Object.keys(updates).forEach(key => {
          const originalValue = originalData?.[key as keyof ContractCreationFormData]
          const newValue = newData[key as keyof ContractCreationFormData]
          
          if (JSON.stringify(originalValue) === JSON.stringify(newValue)) {
            combined.delete(key)
          }
        })
        return combined
      })

      const hasAnyChanges = Object.keys(newData).some(key => {
        const originalValue = originalData?.[key as keyof ContractCreationFormData]
        const newValue = newData[key as keyof ContractCreationFormData]
        return JSON.stringify(originalValue) !== JSON.stringify(newValue)
      })
      
      setHasChanges(hasAnyChanges)

      // Schedule auto-save
      if (hasAnyChanges && !isFirstLoadRef.current) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current)
        }
        setAutoSaveStatus('saving')
        autoSaveTimeoutRef.current = setTimeout(() => {
          handleAutoSave(newData)
        }, 30000)
      }

      return newData
    })
  }, [originalData])

  // Auto-save functionality
  const handleAutoSave = useCallback(async (dataToSave: Partial<ContractCreationFormData>) => {
    if (!contractId || !canEdit) return

    try {
      setAutoSaveStatus('saving')
      await contractService.updateContract(contractId, dataToSave as any)
      setAutoSaveStatus('saved')
      setLastSavedAt(new Date())
    } catch (error) {
      setAutoSaveStatus('error')
      console.error('Auto-save failed:', error)
    }
  }, [contractId, canEdit])

  // Validate form
  const validateForm = useCallback(() => {
    try {
      contractEditSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.errors.forEach((err) => {
          const field = err.path.join('.')
          newErrors[field] = err.message
        })
        setErrors(newErrors)
      }
      return false
    }
  }, [formData])

  // Handle save with version comment
  const handleSave = useCallback(async () => {
    if (!contractId || !validateForm()) return

    if (hasChanges && !versionComment.trim()) {
      setShowVersionModal(true)
      return
    }

    try {
      setIsSaving(true)
      
      // Clear auto-save timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      // Update contract
      await contractService.updateContract(contractId, formData as any)

      // Create version if changes were made
      if (hasChanges && versionComment.trim()) {
        await contractService.createVersion(contractId, {
          changes: versionComment,
          content: JSON.stringify(formData)
        })
      }

      // Navigate back to contract details
      navigate(`/contracts/${contractId}`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes'
      setErrors({ general: errorMessage })
      console.error('Save failed:', error)
    } finally {
      setIsSaving(false)
      setShowVersionModal(false)
      setVersionComment('')
    }
  }, [contractId, formData, hasChanges, versionComment, validateForm, navigate])

  // Handle cancel with unsaved changes check
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowCancelModal(true)
    } else {
      navigate(`/contracts/${contractId}`)
    }
  }, [hasChanges, navigate, contractId])

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!contractId || !files.length) return

    try {
      const uploadPromises = Array.from(files).map(file => 
        contractService.uploadDocument(contractId, file)
      )
      
      const newDocuments = await Promise.all(uploadPromises)
      setDocuments(prev => [...prev, ...newDocuments])
      
    } catch (error) {
      setErrors({ files: 'Failed to upload file' })
      console.error('File upload failed:', error)
    }
  }, [contractId])

  // Handle file removal
  const handleFileRemove = useCallback((documentId: string) => {
    setDocumentToRemove(documentId)
  }, [])

  // Confirm file removal
  const confirmFileRemove = useCallback(() => {
    if (documentToRemove) {
      setDocuments(prev => prev.filter(doc => doc.id !== documentToRemove))
      setDocumentToRemove(null)
    }
  }, [documentToRemove])

  // Compare versions
  const handleCompareVersions = useCallback(async (version1: string, version2: string) => {
    if (!contractId) return

    try {
      setIsComparing(true)
      const comparison = await contractService.compareVersions(contractId, version1, version2)
      setComparisonData(comparison)
    } catch (error) {
      console.error('Version comparison failed:', error)
    } finally {
      setIsComparing(false)
    }
  }, [contractId])

  // Handle revert to version
  const handleRevertToVersion = useCallback((version: ContractVersion) => {
    setVersionToRevert(version)
  }, [])

  // Confirm revert to version
  const confirmRevertToVersion = useCallback(async () => {
    if (!contractId || !versionToRevert) return

    try {
      setIsSaving(true)
      await contractService.updateContract(contractId, { 
        ...formData,
        metadata: { reverted_from_version: versionToRevert.id }
      } as any)
      
      // Show success message
      alert(`Reverted to version ${versionToRevert.version_number}`)
      
      // Reload data
      await loadContractData()
      
      setVersionToRevert(null)
    } catch (error) {
      console.error('Revert failed:', error)
      setErrors({ general: 'Failed to revert to previous version' })
    } finally {
      setIsSaving(false)
    }
  }, [contractId, versionToRevert, formData, loadContractData])

  // Get field status
  const getFieldStatus = useCallback((fieldName: string) => {
    if (isFieldLocked(fieldName)) return 'locked'
    if (modifiedFields.has(fieldName)) return 'modified'
    return 'normal'
  }, [isFieldLocked, modifiedFields])

  // Get original vs modified display
  const getFieldComparison = useCallback((fieldName: string) => {
    if (!modifiedFields.has(fieldName) || !originalData) return null

    const original = originalData[fieldName as keyof ContractCreationFormData]
    const modified = formData[fieldName as keyof ContractCreationFormData]

    if (fieldName === 'value' && typeof original === 'number' && typeof modified === 'number') {
      return {
        original: `$${original.toLocaleString()}`,
        modified: `$${modified.toLocaleString()}`
      }
    }

    return {
      original: String(original || ''),
      modified: String(modified || '')
    }
  }, [modifiedFields, originalData, formData])

  // Check for significant changes
  const hasSignificantChanges = useCallback(() => {
    if (!originalData) return false

    // Check value change > 25%
    if (originalData.value && formData.value) {
      const change = Math.abs(formData.value - originalData.value) / originalData.value
      if (change > 0.25) return true
    }

    // Check date changes
    if (originalData.end_date !== formData.end_date) return true

    return false
  }, [originalData, formData])

  // Initialize component
  useEffect(() => {
    loadContractData()
  }, [loadContractData])

  // Cleanup auto-save timeout
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <main role="main" aria-label="Edit contract" className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div
                className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"
                role="progressbar"
                aria-label="Loading"
              />
              <p className="text-gray-600">Loading contract...</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Error state
  if (error) {
    return (
      <main role="main" aria-label="Edit contract" className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error.includes('not found') ? 'Contract not found' : 'Failed to load contract'}
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-x-3">
              {error.includes('not found') ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate('/contracts')}
                  aria-label="Go back to contracts list"
                >
                  Go back
                </Button>
              ) : (
                <Button
                  onClick={handleRetry}
                  disabled={isLoading}
                  aria-label="Retry loading contract"
                >
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!contract) return null

  return (
    <main role="main" aria-label="Edit contract" className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 mobile-layout lg:mobile-layout-false">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Edit Contract {contract.contract_number}
                  </h1>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      contract.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      contract.status === 'active' ? 'bg-green-100 text-green-800' :
                      contract.status === 'executed' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {contract.status === null ? 'Unknown status' : contract.status}
                    </span>
                    {hasChanges && (
                      <span className="text-amber-600 text-sm">Unsaved changes</span>
                    )}
                    {autoSaveStatus === 'saved' && lastSavedAt && (
                      <span className="text-green-600 text-sm">
                        Draft saved at {lastSavedAt.toLocaleTimeString()}
                      </span>
                    )}
                    {autoSaveStatus === 'saving' && (
                      <span className="text-blue-600 text-sm">Saving...</span>
                    )}
                    {autoSaveStatus === 'error' && (
                      <div className="flex items-center space-x-2">
                        <span className="text-red-600 text-sm">Auto-save failed</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAutoSave(formData)}
                          aria-label="Retry save"
                        >
                          Retry save
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status warnings */}
              {!canEdit && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-3" />
                    <p className="text-red-800">
                      Contract is {contract.status} and cannot be edited.
                    </p>
                  </div>
                </div>
              )}

              {hasSignificantChanges() && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mr-3" />
                    <div>
                      <p className="text-amber-800 font-medium">Significant changes detected</p>
                      <p className="text-amber-700 text-sm">These changes may require re-approval.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Form */}
            <form
              role="form"
              aria-label="Contract edit form"
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault()
                handleSave()
              }}
            >
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`field-container ${getFieldStatus('title') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="Contract Title"
                      name="title"
                      value={formData.title || ''}
                      onChange={(e) => updateFormData({ title: e.target.value })}
                      error={errors.title}
                      disabled={!canEdit || isFieldLocked('title')}
                      required
                      aria-describedby="title-help"
                    />
                    {getFieldComparison('title') && (
                      <div className="mt-1 text-xs text-gray-500">
                        <span>Original: {getFieldComparison('title')?.original}</span>
                        <br />
                        <span>Modified: {getFieldComparison('title')?.modified}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contract-type" className="block text-sm font-medium text-gray-700 mb-1">
                      Contract Type
                    </label>
                    <select
                      id="contract-type"
                      name="contract_type"
                      value={formData.contract_type || ''}
                      onChange={(e) => updateFormData({ contract_type: e.target.value as any })}
                      disabled={!canEdit || isFieldLocked('contract_type')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      role="combobox"
                      aria-label="Contract type"
                    >
                      <option value="">Select contract type</option>
                      {CONTRACT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`field-container ${getFieldStatus('description') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="Description"
                      name="description"
                      value={formData.description || ''}
                      onChange={(e) => updateFormData({ description: e.target.value })}
                      error={errors.description}
                      disabled={!canEdit || isFieldLocked('description')}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Parties & Stakeholders */}
              <Card>
                <CardHeader>
                  <CardTitle>Parties & Stakeholders</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`field-container ${getFieldStatus('counterparty_name') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="Counterparty Name"
                      name="counterparty_name"
                      value={formData.counterparty_name || ''}
                      onChange={(e) => updateFormData({ counterparty_name: e.target.value })}
                      error={errors.counterparty_name}
                      disabled={!canEdit || isFieldLocked('counterparty_name')}
                    />
                  </div>

                  <div className={`field-container ${getFieldStatus('counterparty_email') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="Counterparty Email"
                      name="counterparty_email"
                      type="email"
                      value={formData.counterparty_email || ''}
                      onChange={(e) => updateFormData({ counterparty_email: e.target.value })}
                      error={errors.counterparty_email}
                      disabled={!canEdit || isFieldLocked('counterparty_email')}
                    />
                  </div>

                  <div className={`field-container ${getFieldStatus('counterparty_phone') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="Counterparty Phone"
                      name="counterparty_phone"
                      value={formData.counterparty_phone || ''}
                      onChange={(e) => updateFormData({ counterparty_phone: e.target.value })}
                      disabled={!canEdit || isFieldLocked('counterparty_phone')}
                    />
                  </div>

                  <div>
                    <Input
                      label="Internal Owner"
                      name="internal_owner"
                      value={formData.internal_owner_id || ''}
                      onChange={(e) => updateFormData({ internal_owner_id: e.target.value })}
                      disabled={!canEdit}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Terms & Conditions */}
              <Card>
                <CardHeader>
                  <CardTitle>Terms & Conditions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`field-container ${getFieldStatus('value') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="Contract Value"
                      name="value"
                      type="number"
                      value={formData.value || ''}
                      onChange={(e) => updateFormData({ value: e.target.value ? Number(e.target.value) : undefined })}
                      error={errors.value}
                      disabled={!canEdit || isFieldLocked('value')}
                      prefix="$"
                    />
                    {isFieldLocked('value') && (
                      <p className="mt-1 text-xs text-gray-500">
                        Value cannot be changed on active contracts
                      </p>
                    )}
                    {getFieldComparison('value') && (
                      <div className="mt-1 text-xs text-gray-500">
                        <span>Original: {getFieldComparison('value')?.original}</span>
                        <br />
                        <span>Modified: {getFieldComparison('value')?.modified}</span>
                      </div>
                    )}
                  </div>

                  <div className={`field-container ${getFieldStatus('start_date') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="Start Date"
                      name="start_date"
                      type="date"
                      value={formData.start_date || ''}
                      onChange={(e) => updateFormData({ start_date: e.target.value })}
                      disabled={!canEdit || isFieldLocked('start_date')}
                    />
                  </div>

                  <div className={`field-container ${getFieldStatus('end_date') === 'modified' ? 'field-modified' : ''}`}>
                    <Input
                      label="End Date"
                      name="end_date"
                      type="date"
                      value={formData.end_date || ''}
                      onChange={(e) => updateFormData({ end_date: e.target.value })}
                      error={errors.end_date}
                      disabled={!canEdit || isFieldLocked('end_date')}
                    />
                  </div>

                  <div>
                    <label htmlFor="payment-terms" className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Terms
                    </label>
                    <select
                      id="payment-terms"
                      value={formData.payment_terms || ''}
                      onChange={(e) => updateFormData({ payment_terms: e.target.value as any })}
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">Select payment terms</option>
                      {PAYMENT_TERMS.map(term => (
                        <option key={term.value} value={term.value}>
                          {term.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Input
                      label="Governing Law"
                      name="governing_law"
                      value={formData.governing_law || ''}
                      onChange={(e) => updateFormData({ governing_law: e.target.value })}
                      disabled={!canEdit}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle>Attachments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {documents.length > 0 ? (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                            <div className="flex items-center space-x-3">
                              <DocumentIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-sm text-gray-900">{doc.filename}</span>
                              <span className="text-xs text-gray-500">
                                {(doc.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                aria-label={`Download ${doc.filename}`}
                              >
                                Download
                              </Button>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleFileRemove(doc.id)}
                                  aria-label={`Remove ${doc.filename}`}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No attachments</p>
                    )}

                    {canEdit && (
                      <div>
                        <input
                          type="file"
                          id="file-upload"
                          multiple
                          accept=".pdf,.docx,.doc,.txt"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                          className="hidden"
                          aria-label="Add attachment"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => document.getElementById('file-upload')?.click()}
                        >
                          Add Attachment
                        </Button>
                        {errors.files && (
                          <div className="mt-1">
                            <p className="text-sm text-red-600">{errors.files}</p>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setErrors({ ...errors, files: '' })}
                              className="mt-2"
                              aria-label="Retry upload"
                            >
                              Retry upload
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={isSaving}
                  aria-label="Cancel editing"
                >
                  Cancel
                </Button>

                <div className="flex items-center space-x-3">
                  {canEdit && (
                    <Button
                      type="submit"
                      loading={isSaving}
                      disabled={!hasChanges || isSaving}
                      aria-label="Save changes"
                    >
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>

              {errors.general && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-800 font-medium">Failed to save changes</p>
                      <p className="text-red-600 text-sm">{errors.general}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setErrors({ ...errors, general: '' })
                        handleSave()
                      }}
                      aria-label="Retry save"
                    >
                      Retry save
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Version History Sidebar */}
          <div className="lg:w-80 mobile-sidebar lg:mobile-sidebar-false">
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent>
                {versions.length > 0 ? (
                  <div className="space-y-3">
                    {versions.map((version, index) => (
                      <div key={version.id} className="border-b border-gray-200 pb-3 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">v{version.version_number}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(version.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {index === 0 ? `v${version.version_number} - ${version.changes}` : `v${version.version_number} - ${version.changes}`}
                        </p>
                        <div className="flex space-x-2 mt-2">
                          {index > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCompareVersions(versions[index].id, versions[index - 1].id)}
                              disabled={isComparing}
                              aria-label="Compare versions"
                            >
                              Compare
                            </Button>
                          )}
                          {index > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRevertToVersion(version)}
                              aria-label={`Revert to v${version.version_number}`}
                            >
                              Revert
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No version history</p>
                )}

                {comparisonData && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-sm mb-3">Version Comparison</h4>
                    <div className="space-y-2">
                      {comparisonData.differences?.map((diff: any, index: number) => (
                        <div key={index} className="text-xs">
                          <span className="font-medium">{diff.path}:</span>
                          <span className="text-gray-600">
                            {' '}
                            {diff.old_value} → {diff.new_value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Version Comment Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">Describe Your Changes</h3>
            <p className="text-sm text-gray-600 mb-4">
              Version comment is required for tracking changes.
            </p>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              value={versionComment}
              onChange={(e) => setVersionComment(e.target.value)}
              placeholder="Describe what you changed..."
              aria-label="Describe your changes"
              role="textbox"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <Button
                variant="secondary"
                onClick={() => setShowVersionModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!versionComment.trim() || isSaving}
                loading={isSaving}
                aria-label="Save with comment"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">Unsaved Changes</h3>
            <p className="text-sm text-gray-600 mb-4">
              You have unsaved changes. What would you like to do?
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => setShowCancelModal(false)}
                aria-label="Keep editing"
              >
                Keep Editing
              </Button>
              <Button
                variant="danger"
                onClick={() => navigate(`/contracts/${contractId}`)}
                aria-label="Discard changes"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Version Revert Confirmation Modal */}
      {versionToRevert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">Revert to Previous Version</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to revert to version {versionToRevert.version_number}? 
              This will overwrite your current changes.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => setVersionToRevert(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmRevertToVersion}
                loading={isSaving}
                aria-label="Confirm revert"
              >
                Revert
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* File Removal Confirmation Modal */}
      {documentToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">Remove Attachment</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to remove this attachment? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => setDocumentToRemove(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmFileRemove}
                aria-label="Confirm remove"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Live Region for Screen Reader Announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-label="live-region"
        className="sr-only"
      >
        {modifiedFields.size > 0 && `${modifiedFields.size} field${modifiedFields.size > 1 ? 's' : ''} modified`}
        {autoSaveStatus === 'saved' && 'Changes saved automatically'}
        {autoSaveStatus === 'error' && 'Auto-save failed'}
      </div>
    </main>
  )
}