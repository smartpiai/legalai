/**
 * Document Service
 * Handles document upload, validation, and management operations
 */

import apiService from './api'
import { AxiosProgressEvent } from 'axios'
// Import validation types from component
import type { ValidationResult, ValidationError, ValidationWarning, FileInfo, ValidationProgress } from '../components/upload/UploadValidationFeedback'

// Types for document operations
export interface DocumentMetadata {
  title: string
  documentType: string
  description?: string
  party1?: string
  party2?: string
  effectiveDate?: string
  expirationDate?: string
  contractValue?: number | null
  currency?: string
  department?: string
  tags?: string[]
  confidentialityLevel?: string
  autoExtract?: boolean
  notificationEmails?: string[]
  customFields?: Record<string, string>
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  id: string
  status: 'success' | 'error'
  message?: string
  documentUrl?: string
  metadata?: DocumentMetadata
}

export interface DuplicateFile {
  id: number
  name: string
  uploadedAt: string
  uploadedBy: string
  size: number
  checksum: string
  matchScore: number
  matchType: 'exact' | 'similar' | 'name'
}

export interface DuplicateCheckResult {
  duplicates: DuplicateFile[]
}

export interface DocumentUploadRequest {
  file: File
  metadata: DocumentMetadata
  onProgress?: (progress: UploadProgress) => void
  onValidation?: (result: ValidationResult) => void
  onDuplicateCheck?: (result: DuplicateCheckResult) => void
}

export interface BulkUploadRequest {
  files: Array<{
    file: File
    metadata: DocumentMetadata
  }>
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
  onFileComplete?: (fileIndex: number, result: UploadResult) => void
  onValidation?: (fileIndex: number, result: ValidationResult) => void
  onDuplicateCheck?: (fileIndex: number, result: DuplicateCheckResult) => void
}

export interface BulkUploadResult {
  totalFiles: number
  successCount: number
  errorCount: number
  results: UploadResult[]
  errors: string[]
}

class DocumentService {
  /**
   * Calculate file checksum for duplicate detection
   */
  async calculateChecksum(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const chunkSize = 1024 * 1024 // 1MB chunks
    const chunks = Math.ceil(file.size / chunkSize)
    let currentChunk = 0
    let hash = ''

    const reader = new FileReader()
    
    const readNextChunk = (): Promise<string> => {
      return new Promise((resolve) => {
        reader.onload = async (e) => {
          const buffer = e.target?.result as ArrayBuffer
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          hash += hashHex
          
          currentChunk++
          const progress = Math.round((currentChunk / chunks) * 100)
          onProgress?.(progress)
          
          if (currentChunk < chunks) {
            const start = currentChunk * chunkSize
            const end = Math.min(start + chunkSize, file.size)
            const blob = file.slice(start, end)
            reader.readAsArrayBuffer(blob)
          } else {
            resolve(hash)
          }
        }
        
        if (currentChunk === 0) {
          const start = currentChunk * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          const blob = file.slice(start, end)
          reader.readAsArrayBuffer(blob)
        }
      })
    }

    return readNextChunk()
  }

  /**
   * Check for duplicate documents
   */
  async checkDuplicates(file: File): Promise<DuplicateCheckResult> {
    const checksum = await this.calculateChecksum(file)
    
    const response = await apiService.post('/documents/check-duplicates', {
      checksum,
      filename: file.name,
      size: file.size,
    })
    
    return response.data
  }

  /**
   * Validate document before upload
   */
  async validateDocument(file: File, onProgress?: (progress: number) => void): Promise<ValidationResult> {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await apiService.post('/documents/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress?.(percentage)
          }
        }
      })
      
      return response.data
    } catch (error: any) {
      // Return validation failure result
      return {
        isValid: false,
        errors: [{
          code: 'VALIDATION_FAILED',
          message: error.response?.data?.message || 'Document validation failed',
          severity: 'error' as const
        }],
        warnings: [],
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: new Date(file.lastModified)
        },
        suggestions: ['Please try uploading a different file or contact support']
      }
    }
  }

  /**
   * Upload a single document
   */
  async uploadDocument({
    file,
    metadata,
    onProgress,
    onValidation,
    onDuplicateCheck
  }: DocumentUploadRequest): Promise<UploadResult> {
    try {
      // Step 1: Validate document
      if (onValidation) {
        const validationResult = await this.validateDocument(file, (progress) => {
          onProgress?.({ loaded: progress, total: 100, percentage: progress * 0.2 })
        })
        onValidation(validationResult)
        
        if (!validationResult.isValid) {
          return {
            id: '',
            status: 'error',
            message: 'Document validation failed'
          }
        }
      }

      // Step 2: Check for duplicates
      if (onDuplicateCheck) {
        const duplicateResult = await this.checkDuplicates(file)
        onDuplicateCheck(duplicateResult)
      }

      // Step 3: Upload document
      const formData = new FormData()
      formData.append('file', file)
      formData.append('metadata', JSON.stringify(metadata))

      const response = await apiService.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const loaded = progressEvent.loaded
            const total = progressEvent.total
            const percentage = Math.round((loaded * 100) / total)
            
            onProgress?.({
              loaded,
              total,
              percentage: 20 + (percentage * 0.8) // Account for validation progress
            })
          }
        }
      })

      return {
        id: response.data.id,
        status: 'success',
        message: 'Document uploaded successfully',
        documentUrl: response.data.url,
        metadata: response.data.metadata
      }
    } catch (error: any) {
      console.error('Document upload failed:', error)
      
      return {
        id: '',
        status: 'error',
        message: error.response?.data?.message || 'Upload failed. Please try again.'
      }
    }
  }

  /**
   * Upload multiple documents
   */
  async uploadDocuments({
    files,
    onProgress,
    onFileComplete,
    onValidation,
    onDuplicateCheck
  }: BulkUploadRequest): Promise<BulkUploadResult> {
    const results: UploadResult[] = []
    const errors: string[] = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < files.length; i++) {
      const { file, metadata } = files[i]
      
      try {
        const result = await this.uploadDocument({
          file,
          metadata,
          onProgress: (progress) => onProgress?.(i, progress),
          onValidation: (validationResult) => onValidation?.(i, validationResult),
          onDuplicateCheck: (duplicateResult) => onDuplicateCheck?.(i, duplicateResult)
        })
        
        results.push(result)
        
        if (result.status === 'success') {
          successCount++
        } else {
          errorCount++
          if (result.message) {
            errors.push(`${file.name}: ${result.message}`)
          }
        }
        
        onFileComplete?.(i, result)
      } catch (error: any) {
        errorCount++
        const errorMessage = `${file.name}: ${error.message || 'Unknown error'}`
        errors.push(errorMessage)
        
        results.push({
          id: '',
          status: 'error',
          message: error.message
        })
      }
    }

    return {
      totalFiles: files.length,
      successCount,
      errorCount,
      results,
      errors
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string) {
    const response = await apiService.get(`/documents/${id}`)
    return response.data
  }

  /**
   * Get document list with filtering
   */
  async getDocuments(params?: {
    page?: number
    limit?: number
    search?: string
    type?: string
    department?: string
    tags?: string[]
  }) {
    const response = await apiService.get('/documents', { params })
    return response.data
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string) {
    await apiService.delete(`/documents/${id}`)
  }

  /**
   * Update document metadata
   */
  async updateDocumentMetadata(id: string, metadata: Partial<DocumentMetadata>) {
    const response = await apiService.patch(`/documents/${id}/metadata`, metadata)
    return response.data
  }

  /**
   * Download document
   */
  async downloadDocument(id: string): Promise<Blob> {
    const response = await apiService.get(`/documents/${id}/download`, {
      responseType: 'blob'
    })
    return response.data
  }

  /**
   * Get upload statistics
   */
  async getUploadStats() {
    const response = await apiService.get('/documents/stats')
    return response.data
  }

  /**
   * Retry failed upload
   */
  async retryUpload(fileData: { file: File; metadata: DocumentMetadata }): Promise<UploadResult> {
    return this.uploadDocument({
      file: fileData.file,
      metadata: fileData.metadata
    })
  }

  /**
   * Cancel ongoing upload (if supported by backend)
   */
  async cancelUpload(uploadId: string) {
    await apiService.delete(`/documents/uploads/${uploadId}`)
  }

  /**
   * Extract metadata from document using AI
   */
  async extractMetadata(file: File): Promise<Partial<DocumentMetadata>> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiService.post('/documents/extract-metadata', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    return response.data
  }

  /**
   * Get supported file types and limits
   */
  getUploadLimits() {
    return {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxTotalSize: 500 * 1024 * 1024, // 500MB per session
      maxFiles: 10,
      supportedTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.ms-excel',
        'text/plain'
      ],
      supportedExtensions: ['.pdf', '.docx', '.xlsx', '.doc', '.xls', '.txt']
    }
  }

  /**
   * Validate file type and size
   */
  validateFile(file: File): { isValid: boolean; errors: string[] } {
    const limits = this.getUploadLimits()
    const errors: string[] = []

    // Check file type
    if (!limits.supportedTypes.includes(file.type)) {
      errors.push(`File type "${file.type}" is not supported`)
    }

    // Check file size
    if (file.size > limits.maxFileSize) {
      const maxSizeMB = limits.maxFileSize / (1024 * 1024)
      errors.push(`File size exceeds maximum limit of ${maxSizeMB}MB`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Generate unique upload session ID
   */
  generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default new DocumentService()