/**
 * DocumentUploadPage - Multi-step upload wizard
 * Integrates file selection, validation, metadata entry, and upload
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Upload, Check, AlertTriangle, FileText, User, Eye } from 'lucide-react'
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs'
import { UploadInterface } from '@/components/upload/UploadInterface'
import { MetadataForm } from '@/components/upload/MetadataForm'
import { DuplicateDetection } from '@/components/upload/DuplicateDetection'
import { UploadValidationFeedback, ValidationResult, ValidationError, ValidationWarning, FileInfo, ValidationProgress } from '@/components/upload/UploadValidationFeedback'
import { cn } from '@/utils/cn'
import documentService, {
  DocumentMetadata,
  UploadProgress,
  UploadResult,
  DuplicateCheckResult
} from '@/services/document.service'

// Types for upload workflow
interface FileWithMetadata {
  file: File
  id: string
  metadata: DocumentMetadata
  validationResult?: ValidationResult
  duplicateCheckResult?: DuplicateCheckResult
  uploadProgress?: UploadProgress
  uploadResult?: UploadResult
}

interface WizardStep {
  id: number
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  isComplete: boolean
  isActive: boolean
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'cancelled'

export default function DocumentUploadPage() {
  const navigate = useNavigate()

  // Core state
  const [currentStep, setCurrentStep] = useState(1)
  const [files, setFiles] = useState<FileWithMetadata[]>([])
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Validation and duplicate detection states
  const [isValidating, setIsValidating] = useState(false)
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false)
  const [duplicateResolution, setDuplicateResolution] = useState<string | null>(null)

  // Upload progress states
  const [totalUploadProgress, setTotalUploadProgress] = useState(0)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [completedUploads, setCompletedUploads] = useState<UploadResult[]>([])

  // Breadcrumb configuration
  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'Documents', path: '/documents' },
    { label: 'Upload', path: '/documents/upload' }
  ]

  // Wizard steps configuration
  const wizardSteps: WizardStep[] = useMemo(() => [
    {
      id: 1,
      label: 'File Selection',
      description: 'Choose documents to upload',
      icon: FileText,
      isComplete: files.length > 0 && currentStep > 1,
      isActive: currentStep === 1
    },
    {
      id: 2,
      label: 'Document Metadata',
      description: 'Enter document information',
      icon: User,
      isComplete: files.every(f => f.metadata.title && f.metadata.documentType) && currentStep > 2,
      isActive: currentStep === 2
    },
    {
      id: 3,
      label: 'Review & Upload',
      description: 'Confirm and upload documents',
      icon: Eye,
      isComplete: uploadStatus === 'success',
      isActive: currentStep === 3
    }
  ], [files, currentStep, uploadStatus])

  // Calculate total file size
  const totalFileSize = useMemo(() => {
    return files.reduce((total, fileData) => total + fileData.file.size, 0)
  }, [files])

  // Check if current step can proceed
  const canProceedFromStep = useMemo(() => {
    switch (currentStep) {
      case 1:
        return files.length > 0
      case 2:
        return files.every(f => f.metadata.title && f.metadata.documentType)
      case 3:
        return true
      default:
        return false
    }
  }, [currentStep, files])

  // File selection handlers
  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    const newFiles: FileWithMetadata[] = selectedFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      metadata: {
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        documentType: '',
        description: '',
        confidentialityLevel: 'internal',
        autoExtract: true,
        tags: [],
        notificationEmails: [],
        customFields: {}
      }
    }))
    
    setFiles(prev => [...prev, ...newFiles])
    setHasUnsavedChanges(true)
  }, [])

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    setHasUnsavedChanges(true)
  }, [])

  // Metadata form handlers
  const handleMetadataSubmit = useCallback((metadata: DocumentMetadata) => {
    const currentFile = files[currentFileIndex]
    if (currentFile) {
      setFiles(prev => prev.map(f => 
        f.id === currentFile.id ? { ...f, metadata } : f
      ))
      setHasUnsavedChanges(true)

      // Move to next file or next step
      if (currentFileIndex < files.length - 1) {
        setCurrentFileIndex(prev => prev + 1)
      } else {
        setCurrentStep(3)
      }
    }
  }, [files, currentFileIndex])

  const handleMetadataCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowCancelDialog(true)
    } else {
      setCurrentStep(1)
    }
  }, [hasUnsavedChanges])

  // Auto-extract metadata if enabled
  const handleAutoExtract = useCallback(async (enabled: boolean, fileIndex: number) => {
    if (!enabled || !files[fileIndex]) return

    try {
      const extractedMetadata = await documentService.extractMetadata(files[fileIndex].file)
      
      setFiles(prev => prev.map((f, idx) => 
        idx === fileIndex ? {
          ...f,
          metadata: { ...f.metadata, ...extractedMetadata }
        } : f
      ))
    } catch (error) {
      console.error('Metadata extraction failed:', error)
    }
  }, [files])

  // Validation handlers
  const handleValidation = useCallback(async (file: File, fileId: string) => {
    setIsValidating(true)
    
    try {
      const validationResult = await documentService.validateDocument(file)
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, validationResult } : f
      ))
      
      return validationResult
    } catch (error) {
      console.error('Validation failed:', error)
      return null
    } finally {
      setIsValidating(false)
    }
  }, [])

  // Duplicate detection handlers
  const handleDuplicateCheck = useCallback(async (file: File, fileId: string) => {
    setIsDuplicateChecking(true)
    
    try {
      const duplicateResult = await documentService.checkDuplicates(file)
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, duplicateCheckResult: duplicateResult } : f
      ))
      
      return duplicateResult
    } catch (error) {
      console.error('Duplicate check failed:', error)
      return { duplicates: [] }
    } finally {
      setIsDuplicateChecking(false)
    }
  }, [])

  const handleDuplicateResolution = useCallback((resolution: { action: string; parentId?: number }) => {
    setDuplicateResolution(resolution.action)
    // Move to metadata step if no duplicates or resolved
    setCurrentStep(2)
  }, [])

  // Upload handlers
  const handleUploadStart = useCallback(async () => {
    setUploadStatus('uploading')
    setUploadErrors([])
    setCompletedUploads([])
    setTotalUploadProgress(0)
    
    try {
      const uploadResults = await documentService.uploadDocuments({
        files: files.map(f => ({ file: f.file, metadata: f.metadata })),
        onProgress: (fileIndex, progress) => {
          const overallProgress = ((fileIndex + (progress.percentage / 100)) / files.length) * 100
          setTotalUploadProgress(Math.round(overallProgress))
          
          setFiles(prev => prev.map((f, idx) => 
            idx === fileIndex ? { ...f, uploadProgress: progress } : f
          ))
        },
        onFileComplete: (fileIndex, result) => {
          setFiles(prev => prev.map((f, idx) => 
            idx === fileIndex ? { ...f, uploadResult: result } : f
          ))
          
          if (result.status === 'success') {
            setCompletedUploads(prev => [...prev, result])
          } else {
            setUploadErrors(prev => [...prev, result.message || 'Unknown error'])
          }
        }
      })
      
      if (uploadResults.errorCount === 0) {
        setUploadStatus('success')
        setHasUnsavedChanges(false)
      } else {
        setUploadStatus('error')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      setUploadStatus('error')
      setUploadErrors(prev => [...prev, 'Upload failed. Please try again.'])
    }
  }, [files])

  const handleRetryUpload = useCallback(() => {
    handleUploadStart()
  }, [handleUploadStart])

  const handleCancelUpload = useCallback(() => {
    setUploadStatus('cancelled')
    // Could implement actual upload cancellation here
  }, [])

  // Navigation handlers
  const handleNextStep = useCallback(async () => {
    if (!canProceedFromStep) return
    
    if (currentStep === 1) {
      // Validate and check duplicates before proceeding
      for (const fileData of files) {
        await handleValidation(fileData.file, fileData.id)
        await handleDuplicateCheck(fileData.file, fileData.id)
      }
      
      // Check if any files have duplicates
      const hasDuplicates = files.some(f => 
        f.duplicateCheckResult?.duplicates.length || 0 > 0
      )
      
      if (hasDuplicates) {
        // Show duplicate detection UI
        return
      }
      
      setCurrentStep(2)
      setCurrentFileIndex(0)
    } else if (currentStep === 2) {
      setCurrentStep(3)
    } else if (currentStep === 3) {
      await handleUploadStart()
    }
  }, [currentStep, canProceedFromStep, files, handleValidation, handleDuplicateCheck, handleUploadStart])

  const handlePreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
      if (currentStep === 2) {
        setCurrentFileIndex(Math.max(0, currentFileIndex - 1))
      }
    }
  }, [currentStep, currentFileIndex])

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowCancelDialog(true)
    } else {
      navigate('/documents')
    }
  }, [hasUnsavedChanges, navigate])

  const confirmCancel = useCallback(() => {
    setShowCancelDialog(false)
    navigate('/documents')
  }, [navigate])

  // Upload more files after success
  const handleUploadMore = useCallback(() => {
    setFiles([])
    setCurrentStep(1)
    setCurrentFileIndex(0)
    setUploadStatus('idle')
    setTotalUploadProgress(0)
    setUploadErrors([])
    setCompletedUploads([])
    setHasUnsavedChanges(false)
  }, [])

  // Navigate to document view
  const handleViewDocument = useCallback((result: UploadResult) => {
    navigate(`/documents/${result.id}`)
  }, [navigate])

  // Prevent navigation if uploading
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploadStatus === 'uploading' || hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [uploadStatus, hasUnsavedChanges])

  // Format file size helper
  const formatFileSize = (bytes: number) => documentService.formatFileSize(bytes)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumbs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumbs 
            items={breadcrumbItems}
            className="text-sm"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Upload Documents
          </h1>
          <p className="text-gray-600">
            Upload and manage your legal documents with our secure platform
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {wizardSteps.map((step, index) => {
              const StepIcon = step.icon
              return (
                <div key={step.id} className="flex items-center">
                  {/* Step indicator */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                        step.isComplete
                          ? 'bg-green-600 text-white'
                          : step.isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      )}
                    >
                      {step.isComplete ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span>{step.id}</span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <p className={cn(
                        'text-sm font-medium',
                        step.isActive ? 'text-blue-600' : 'text-gray-600'
                      )}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Connector line */}
                  {index < wizardSteps.length - 1 && (
                    <div className={cn(
                      'flex-1 h-px mx-4 transition-colors',
                      step.isComplete ? 'bg-green-600' : 'bg-gray-300'
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Step 1: File Selection */}
          {currentStep === 1 && (
            <div role="region" aria-label="Step 1: File Selection" className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Step 1 of 3: File Selection
                </h2>
                <p className="text-gray-600">
                  Choose the documents you want to upload. Supported formats: PDF, DOCX, XLSX, TXT
                </p>
              </div>

              <UploadInterface
                acceptedFileTypes={documentService.getUploadLimits().supportedTypes}
                maxFileSize={documentService.getUploadLimits().maxFileSize}
                maxFiles={documentService.getUploadLimits().maxFiles}
                showProgress={false}
                onFilesSelected={handleFilesSelected}
                onRemove={handleFileRemove}
                className="mb-6"
              />

              {files.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>{files.length} files selected</span>
                    <span>Total size: {formatFileSize(totalFileSize)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Metadata Entry */}
          {currentStep === 2 && files.length > 0 && (
            <div role="region" aria-label="Step 2: Document Metadata" className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Step 2 of 3: Document Metadata
                </h2>
                <p className="text-gray-600">
                  Provide information about your documents to make them easier to find and manage
                </p>
                
                {files.length > 1 && (
                  <div className="mt-4 text-sm text-gray-600">
                    File {currentFileIndex + 1} of {files.length}
                  </div>
                )}
              </div>

              <MetadataForm
                fileName={files[currentFileIndex]?.file.name || ''}
                fileSize={files[currentFileIndex]?.file.size || 0}
                initialValues={files[currentFileIndex]?.metadata}
                onSubmit={handleMetadataSubmit}
                onCancel={handleMetadataCancel}
                onAutoExtract={(enabled) => handleAutoExtract(enabled, currentFileIndex)}
              />
            </div>
          )}

          {/* Step 3: Review and Upload */}
          {currentStep === 3 && (
            <div role="region" aria-label="Step 3: Review and Upload" className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Step 3 of 3: Review and Upload
                </h2>
                <p className="text-gray-600">
                  Review your documents and metadata before uploading
                </p>
              </div>

              {/* Upload Status */}
              {uploadStatus === 'uploading' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Upload className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="font-medium text-blue-900">Uploading documents...</span>
                    </div>
                    <span className="text-sm text-blue-600">{totalUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      role="progressbar"
                      aria-valuenow={totalUploadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${totalUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <Check className="h-5 w-5 text-green-600 mr-2" />
                    <span className="font-medium text-green-900">
                      Successfully uploaded {completedUploads.length} documents
                    </span>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    {completedUploads.map((result, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{files[index]?.file.name}</span>
                        <button
                          onClick={() => handleViewDocument(result)}
                          className="text-blue-600 hover:text-blue-700"
                          aria-label="View document"
                        >
                          View Document
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    <span className="font-medium text-red-900">Upload failed</span>
                  </div>
                  {uploadErrors.length > 0 && (
                    <ul className="text-sm text-red-600 space-y-1">
                      {uploadErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Document Summary */}
              {uploadStatus === 'idle' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {files.map((fileData, index) => (
                      <div key={fileData.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">
                              {fileData.metadata.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {fileData.file.name} • {formatFileSize(fileData.file.size)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Type: {fileData.metadata.documentType.replace('_', ' ').split(' ').map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                              ).join(' ')}
                            </p>
                            {fileData.metadata.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {fileData.metadata.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setCurrentFileIndex(index)
                              setCurrentStep(2)
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                            aria-label="Edit metadata"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                      <span>Total size: {formatFileSize(totalFileSize)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t px-6 py-4">
            <div className="flex justify-between">
              <div>
                {currentStep > 1 && uploadStatus !== 'uploading' && uploadStatus !== 'success' && (
                  <button
                    onClick={handlePreviousStep}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </button>
                )}
              </div>

              <div className="flex space-x-3">
                {uploadStatus === 'success' ? (
                  <>
                    <button
                      onClick={() => navigate('/documents')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      View All Documents
                    </button>
                    <button
                      onClick={handleUploadMore}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      aria-label="Upload more files"
                    >
                      Upload More Files
                    </button>
                  </>
                ) : uploadStatus === 'error' ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRetryUpload}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      aria-label="Retry upload"
                    >
                      Retry Upload
                    </button>
                  </>
                ) : uploadStatus === 'uploading' ? (
                  <button
                    onClick={handleCancelUpload}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel Upload
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNextStep}
                      disabled={!canProceedFromStep}
                      className={cn(
                        'inline-flex items-center px-4 py-2 text-sm font-medium rounded-md',
                        canProceedFromStep
                          ? 'text-white bg-blue-600 hover:bg-blue-700'
                          : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                      )}
                    >
                      {currentStep === 3 ? 'Upload Documents' : 'Next'}
                      {currentStep < 3 && <ChevronRight className="h-4 w-4 ml-1" />}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Unsaved Changes</h3>
            <p className="text-gray-600 mb-6">
              You have unsaved changes. Are you sure you want to leave? Your progress will be lost.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}