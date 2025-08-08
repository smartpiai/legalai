/**
 * UploadInterface component
 * Provides drag-and-drop and file selection for document uploads
 */
import { useState, useRef, useCallback, DragEvent } from 'react'
import { 
  Upload, 
  File, 
  X, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileImage
} from 'lucide-react'
import { cn } from '@/utils/cn'

export interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

interface UploadInterfaceProps {
  acceptedFileTypes?: string[]
  maxFileSize?: number
  maxFiles?: number
  showProgress?: boolean
  disabled?: boolean
  emptyMessage?: string
  className?: string
  onFilesSelected?: (files: File[]) => void
  onUpload?: (file: File) => Promise<{ id: string; status: string }>
  onError?: (error: string) => void
  onRemove?: (fileId: string) => void
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'text/plain',
  'image/png',
  'image/jpeg'
]

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-excel': 'Excel',
  'text/plain': 'Text',
  'image/png': 'Image',
  'image/jpeg': 'Image'
}

export function UploadInterface({
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  maxFiles = 10,
  showProgress = true,
  disabled = false,
  emptyMessage = 'Drag and drop your files here',
  className,
  onFilesSelected,
  onUpload,
  onError,
  onRemove
}: UploadInterfaceProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<UploadFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.includes('spreadsheet') || type.includes('excel')) {
      return FileSpreadsheet
    }
    if (type.includes('image')) {
      return FileImage
    }
    return FileText
  }

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!acceptedFileTypes.includes(file.type)) {
      return `Invalid file type: ${file.name}`
    }
    if (file.size > maxFileSize) {
      return `File "${file.name}" exceeds maximum size of ${formatFileSize(maxFileSize)}`
    }
    return null
  }

  // Handle file selection
  const handleFiles = useCallback(async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles)
    
    // Check max files limit
    if (files.length + fileArray.length > maxFiles) {
      onError?.(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Validate files
    const validFiles: File[] = []
    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        onError?.(error)
      } else {
        validFiles.push(file)
      }
    }

    if (validFiles.length === 0) return

    // Create upload file objects
    const newUploadFiles: UploadFile[] = validFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      status: 'pending' as const,
      progress: 0
    }))

    setFiles(prev => [...prev, ...newUploadFiles])
    onFilesSelected?.(validFiles)

    // Start uploads if onUpload is provided
    if (onUpload && showProgress) {
      for (const uploadFile of newUploadFiles) {
        await uploadSingleFile(uploadFile)
      }
    }
  }, [files.length, maxFiles, acceptedFileTypes, maxFileSize, onFilesSelected, onUpload, onError, showProgress])

  // Upload single file
  const uploadSingleFile = async (uploadFile: UploadFile) => {
    if (!onUpload) return

    // Update status to uploading
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id 
        ? { ...f, status: 'uploading', progress: 50 }
        : f
    ))

    try {
      const result = await onUpload(uploadFile.file)
      
      // Update status to success
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'success', progress: 100 }
          : f
      ))
    } catch (error) {
      // Update status to error
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
          : f
      ))
      onError?.(`Upload failed: ${uploadFile.file.name}`)
    }
  }

  // Handle retry
  const handleRetry = async (fileId: string) => {
    const uploadFile = files.find(f => f.id === fileId)
    if (uploadFile) {
      await uploadSingleFile(uploadFile)
    }
  }

  // Handle remove file
  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    onRemove?.(fileId)
  }

  // Handle clear all
  const handleClearAll = () => {
    setFiles([])
  }

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    if (disabled) return

    const { files } = e.dataTransfer
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  // File input handler
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input
    e.target.value = ''
  }

  // Open file dialog
  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  // Get accepted file types label
  const getAcceptedTypesLabel = () => {
    const labels = acceptedFileTypes
      .map(type => FILE_TYPE_LABELS[type])
      .filter((label, index, arr) => arr.indexOf(label) === index)
    return labels.join(', ')
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        data-testid="upload-dropzone"
        aria-label="File upload dropzone"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer hover:border-gray-400'
        )}
        onClick={openFileDialog}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          data-testid="file-input"
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />

        {/* Drag overlay */}
        {isDragging && (
          <div 
            data-testid="drag-overlay"
            className="absolute inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center rounded-lg"
          >
            <div className="text-center">
              <Upload className="h-12 w-12 mx-auto text-blue-600 mb-2" />
              <p className="text-lg font-medium text-blue-900">Drop files here</p>
            </div>
          </div>
        )}

        {/* Default content */}
        <div className="space-y-4">
          <Upload className="h-12 w-12 mx-auto text-gray-400" />
          <div>
            <p className="text-lg font-medium text-gray-900">{emptyMessage}</p>
            <p className="text-sm text-gray-500 mt-1">or</p>
          </div>
          <button
            data-testid="select-files-button"
            type="button"
            tabIndex={0}
            aria-label="Select files to upload"
            disabled={disabled}
            className={cn(
              'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={(e) => {
              e.stopPropagation()
              openFileDialog()
            }}
          >
            Select Files
          </button>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Accepted file types: {getAcceptedTypesLabel()}</p>
            <p>Max file size: {formatFileSize(maxFileSize)}</p>
          </div>
        </div>
      </div>

      {/* File list with progress */}
      {files.length > 0 && (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">
              {files.length} {files.length === 1 ? 'file' : 'files'} selected
            </p>
            <button
              data-testid="clear-all-button"
              onClick={handleClearAll}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          </div>

          {/* File list */}
          <div 
            data-testid="upload-progress-list"
            className="space-y-2"
          >
            {files.map((uploadFile) => {
              const FileIcon = getFileIcon(uploadFile.file.type)
              
              return (
                <div
                  key={uploadFile.id}
                  className="flex items-center p-3 bg-white border border-gray-200 rounded-lg"
                >
                  {/* File info */}
                  <FileIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                    
                    {/* Progress bar */}
                    {showProgress && uploadFile.status === 'uploading' && (
                      <div 
                        data-testid={`progress-bar-${uploadFile.file.name}`}
                        className="mt-2 w-full bg-gray-200 rounded-full h-1.5"
                      >
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div 
                    data-testid={`upload-status-${uploadFile.file.name}`}
                    aria-live="polite"
                    className="ml-3"
                  >
                    {uploadFile.status === 'pending' && (
                      <div 
                        data-testid={`status-pending-${uploadFile.file.name}`}
                        className="text-gray-400"
                      >
                        <File className="h-5 w-5" />
                      </div>
                    )}
                    
                    {uploadFile.status === 'uploading' && (
                      <div 
                        data-testid={`status-uploading-${uploadFile.file.name}`}
                        className="text-blue-600"
                      >
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    )}
                    
                    {uploadFile.status === 'success' && (
                      <div 
                        data-testid={`status-success-${uploadFile.file.name}`}
                        className="text-green-600"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </div>
                    )}
                    
                    {uploadFile.status === 'error' && (
                      <div className="flex items-center space-x-2">
                        <div 
                          data-testid={`status-error-${uploadFile.file.name}`}
                          className="text-red-600"
                        >
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <button
                          data-testid={`retry-${uploadFile.file.name}`}
                          onClick={() => handleRetry(uploadFile.id)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  {uploadFile.status !== 'uploading' && (
                    <button
                      data-testid={`remove-${uploadFile.file.name}`}
                      onClick={() => handleRemoveFile(uploadFile.id)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}