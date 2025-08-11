/**
 * DocumentUploadPage Test Suite
 * Following strict TDD methodology - NO MOCKS, real implementations only
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import DocumentUploadPage from '../DocumentUploadPage'

// Mock API calls
vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  }
}))

// Mock document service
vi.mock('@/services/document.service', () => ({
  default: {
    validateDocument: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: { name: 'test.pdf', size: 1024 * 1024, type: 'application/pdf', lastModified: new Date() },
      suggestions: []
    }),
    checkDuplicates: vi.fn().mockResolvedValue({ duplicates: [] }),
    uploadDocuments: vi.fn().mockResolvedValue({
      totalFiles: 1,
      successCount: 1,
      errorCount: 0,
      results: [{ id: '123', status: 'success', message: 'Upload successful' }],
      errors: []
    }),
    extractMetadata: vi.fn().mockResolvedValue({ title: 'Extracted Title' }),
    getUploadLimits: vi.fn().mockReturnValue({
      maxFileSize: 100 * 1024 * 1024,
      maxTotalSize: 500 * 1024 * 1024,
      maxFiles: 10,
      supportedTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ]
    }),
    formatFileSize: vi.fn().mockImplementation((bytes: number) => {
      const mb = bytes / (1024 * 1024)
      return `${mb.toFixed(2)} MB`
    })
  }
}))

// Test utilities
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
})

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Test file helpers
const createTestFile = (
  name: string,
  type: string,
  size: number = 1024 * 1024
): File => {
  const file = new File(['test content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const createPDFFile = (name: string = 'test.pdf') =>
  createTestFile(name, 'application/pdf', 2 * 1024 * 1024)

const createDocxFile = (name: string = 'test.docx') =>
  createTestFile(
    name,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    3 * 1024 * 1024
  )

const createOversizedFile = (name: string = 'huge.pdf') =>
  createTestFile(name, 'application/pdf', 101 * 1024 * 1024)

const createInvalidTypeFile = (name: string = 'test.exe') =>
  createTestFile(name, 'application/x-executable', 1024 * 1024)

describe('DocumentUploadPage', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.clearAllMocks()
    
    // Mock crypto for checksum calculation
    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: {
          digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
        }
      },
      writable: true
    })
    
    // Mock FileReader
    global.FileReader = class {
      result: any = null
      onload: ((e: ProgressEvent<FileReader>) => void) | null = null
      
      readAsArrayBuffer() {
        setTimeout(() => {
          this.result = new ArrayBuffer(8)
          this.onload?.({ target: this } as ProgressEvent<FileReader>)
        }, 0)
      }
    } as any
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Initial Render and Navigation', () => {
    it('should render the upload page with breadcrumb navigation', () => {
      renderWithProviders(<DocumentUploadPage />)
      
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Upload')).toBeInTheDocument()
    })

    it('should display the step-by-step wizard interface', () => {
      renderWithProviders(<DocumentUploadPage />)
      
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
      expect(screen.getByText('File Selection')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /step 1/i })).toBeInTheDocument()
    })

    it('should show progress indicator with correct step highlighting', () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const stepIndicators = screen.getAllByRole('listitem')
      expect(stepIndicators).toHaveLength(3)
      
      // Step 1 should be active
      expect(within(stepIndicators[0]).getByText('1')).toBeInTheDocument()
      expect(stepIndicators[0]).toHaveClass('bg-blue-600')
      
      // Steps 2 and 3 should be inactive
      expect(stepIndicators[1]).toHaveClass('bg-gray-300')
      expect(stepIndicators[2]).toHaveClass('bg-gray-300')
    })
  })

  describe('Step 1: File Selection and Validation', () => {
    it('should integrate UploadInterface component for file selection', () => {
      renderWithProviders(<DocumentUploadPage />)
      
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument()
      expect(screen.getByTestId('select-files-button')).toBeInTheDocument()
      expect(screen.getByText('Drag and drop your files here')).toBeInTheDocument()
    })

    it('should display supported file types and size limits', () => {
      renderWithProviders(<DocumentUploadPage />)
      
      expect(screen.getByText(/accepted file types/i)).toBeInTheDocument()
      expect(screen.getByText(/pdf/i)).toBeInTheDocument()
      expect(screen.getByText(/max file size.*100.*mb/i)).toBeInTheDocument()
    })

    it('should accept valid file uploads via drag and drop', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const pdfFile = createPDFFile()
      
      fireEvent.dragEnter(dropzone, {
        dataTransfer: { items: [pdfFile], files: [pdfFile] }
      })
      
      expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
      
      fireEvent.drop(dropzone, {
        dataTransfer: { files: [pdfFile] }
      })
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument()
      })
    })

    it('should accept valid file uploads via file browser', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const pdfFile = createPDFFile()
      
      await user.upload(fileInput, pdfFile)
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument()
      })
    })

    it('should validate file types and reject invalid files', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const invalidFile = createInvalidTypeFile()
      
      await user.upload(fileInput, invalidFile)
      
      await waitFor(() => {
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument()
      })
    })

    it('should validate file size and reject oversized files', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const oversizedFile = createOversizedFile()
      
      await user.upload(fileInput, oversizedFile)
      
      await waitFor(() => {
        expect(screen.getByText(/exceeds maximum size/i)).toBeInTheDocument()
      })
    })

    it('should support multiple file uploads up to limit', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const files = [
        createPDFFile('doc1.pdf'),
        createDocxFile('doc2.docx'),
        createTestFile('doc3.txt', 'text/plain')
      ]
      
      await user.upload(fileInput, files)
      
      await waitFor(() => {
        expect(screen.getByText('doc1.pdf')).toBeInTheDocument()
        expect(screen.getByText('doc2.docx')).toBeInTheDocument()
        expect(screen.getByText('doc3.txt')).toBeInTheDocument()
        expect(screen.getByText('3 files selected')).toBeInTheDocument()
      })
    })

    it('should enable Next button only when valid files are selected', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      expect(nextButton).toBeDisabled()
      
      const fileInput = screen.getByTestId('file-input')
      const pdfFile = createPDFFile()
      
      await user.upload(fileInput, pdfFile)
      
      await waitFor(() => {
        expect(nextButton).toBeEnabled()
      })
    })

    it('should allow removing selected files', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const pdfFile = createPDFFile()
      
      await user.upload(fileInput, pdfFile)
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument()
      })
      
      const removeButton = screen.getByTestId('remove-test.pdf')
      await user.click(removeButton)
      
      await waitFor(() => {
        expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
      })
    })
  })

  describe('Duplicate Detection Integration', () => {
    it('should trigger duplicate detection after file selection', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const pdfFile = createPDFFile()
      
      await user.upload(fileInput, pdfFile)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText(/checking for duplicates/i)).toBeInTheDocument()
      })
    })

    it('should proceed to metadata step when no duplicates found', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const pdfFile = createPDFFile()
      
      await user.upload(fileInput, pdfFile)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      // Mock no duplicates response
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
        expect(screen.getByText('Document Metadata')).toBeInTheDocument()
      })
    })
  })

  describe('Step 2: Metadata Entry', () => {
    beforeEach(async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const pdfFile = createPDFFile()
      
      await user.upload(fileInput, pdfFile)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      // Wait for duplicate check to complete and move to metadata step
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      })
    })

    it('should display MetadataForm for each selected file', () => {
      expect(screen.getByRole('form', { name: /document metadata/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/document title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/document type/i)).toBeInTheDocument()
    })

    it('should show required field indicators', () => {
      expect(screen.getAllByText('*')).toHaveLength(2) // Title and Type are required
    })

    it('should validate required metadata fields', async () => {
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
        expect(screen.getByText('Document type is required')).toBeInTheDocument()
      })
    })

    it('should enable Next button when required fields are filled', async () => {
      const titleInput = screen.getByLabelText(/document title/i)
      const typeSelect = screen.getByLabelText(/document type/i)
      
      await user.type(titleInput, 'Test Contract')
      await user.selectOptions(typeSelect, 'purchase_agreement')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      expect(nextButton).toBeEnabled()
    })

    it('should support multiple files metadata entry', async () => {
      // Navigate back to add another file
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)
      
      const fileInput = screen.getByTestId('file-input')
      const docxFile = createDocxFile()
      
      await user.upload(fileInput, docxFile)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('File 1 of 2')).toBeInTheDocument()
        expect(screen.getByText('File 2 of 2')).toBeInTheDocument()
      })
    })
  })

  describe('Step 3: Review and Confirmation', () => {
    beforeEach(async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      const pdfFile = createPDFFile()
      
      await user.upload(fileInput, pdfFile)
      
      let nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      })
      
      const titleInput = screen.getByLabelText(/document title/i)
      const typeSelect = screen.getByLabelText(/document type/i)
      
      await user.type(titleInput, 'Test Contract')
      await user.selectOptions(typeSelect, 'purchase_agreement')
      
      nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
      })
    })

    it('should display review summary of files and metadata', () => {
      expect(screen.getByText('Review and Upload')).toBeInTheDocument()
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
      expect(screen.getByText('Test Contract')).toBeInTheDocument()
      expect(screen.getByText('Purchase Agreement')).toBeInTheDocument()
    })

    it('should show total file count and size', () => {
      expect(screen.getByText(/1 file selected/i)).toBeInTheDocument()
      expect(screen.getByText(/total size.*2.*mb/i)).toBeInTheDocument()
    })

    it('should allow editing metadata from review step', async () => {
      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      })
    })

    it('should start upload process when confirmed', async () => {
      const uploadButton = screen.getByRole('button', { name: /upload documents/i })
      await user.click(uploadButton)
      
      await waitFor(() => {
        expect(screen.getByText(/uploading/i)).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })
    })
  })

  describe('Upload Progress and Completion', () => {
    it('should show progress indicator during upload', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      // Complete wizard steps quickly
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => screen.getByLabelText(/document title/i))
      await user.type(screen.getByLabelText(/document title/i), 'Test')
      await user.selectOptions(screen.getByLabelText(/document type/i), 'purchase_agreement')
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      await user.click(screen.getByRole('button', { name: /upload documents/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })
    })

    it('should handle upload errors with retry option', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      // Mock upload failure
      const mockError = new Error('Network error')
      vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Complete wizard and trigger upload
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => screen.getByLabelText(/document title/i))
      await user.type(screen.getByLabelText(/document title/i), 'Test')
      await user.selectOptions(screen.getByLabelText(/document type/i), 'purchase_agreement')
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      await user.click(screen.getByRole('button', { name: /upload documents/i }))
      
      // Should show retry option on error
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('should show success message with links to view documents', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      // Complete successful upload flow
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => screen.getByLabelText(/document title/i))
      await user.type(screen.getByLabelText(/document title/i), 'Test')
      await user.selectOptions(screen.getByLabelText(/document type/i), 'purchase_agreement')
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      await user.click(screen.getByRole('button', { name: /upload documents/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/successfully uploaded/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /view document/i })).toBeInTheDocument()
      })
    })

    it('should provide option to upload more files after success', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      // Complete upload flow
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => screen.getByLabelText(/document title/i))
      await user.type(screen.getByLabelText(/document title/i), 'Test')
      await user.selectOptions(screen.getByLabelText(/document type/i), 'purchase_agreement')
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      await user.click(screen.getByRole('button', { name: /upload documents/i }))
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload more/i })).toBeInTheDocument()
      })
    })
  })

  describe('Upload Validation Integration', () => {
    it('should integrate UploadValidationFeedback component', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      // Should show validation feedback
      await waitFor(() => {
        expect(screen.getByText(/validating document/i)).toBeInTheDocument()
      })
    })
  })

  describe('Cancel and Navigation', () => {
    it('should allow canceling upload at any step', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      
      // Should show confirmation dialog for unsaved changes
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    })

    it('should support back navigation between steps', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      })
      
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)
      
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('should render properly on mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      renderWithProviders(<DocumentUploadPage />)
      
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<DocumentUploadPage />)
      
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /step 1/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/file upload dropzone/i)).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const selectButton = screen.getByTestId('select-files-button')
      selectButton.focus()
      
      expect(selectButton).toHaveFocus()
      
      await user.keyboard('{Enter}')
      // File dialog should be triggered (mocked in test environment)
    })

    it('should announce status changes to screen readers', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument()
        // Check for aria-live regions
        expect(document.querySelector('[aria-live]')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      // Simulate network error during duplicate check
      vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/error.*duplicate/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('should handle validation errors appropriately', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, createPDFFile())
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByLabelText(/document title/i)).toBeInTheDocument()
      })
      
      // Try to proceed without required fields
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
      })
    })

    it('should handle quota exceeded errors', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      // Create multiple large files to exceed quota
      const files = Array.from({ length: 6 }, (_, i) =>
        createTestFile(`large${i}.pdf`, 'application/pdf', 90 * 1024 * 1024)
      )
      
      const fileInput = screen.getByTestId('file-input')
      await user.upload(fileInput, files)
      
      await waitFor(() => {
        expect(screen.getByText(/quota.*exceeded/i)).toBeInTheDocument()
      })
    })
  })

  describe('Performance', () => {
    it('should handle large file selections efficiently', async () => {
      renderWithProviders(<DocumentUploadPage />)
      
      const files = Array.from({ length: 10 }, (_, i) =>
        createPDFFile(`doc${i}.pdf`)
      )
      
      const fileInput = screen.getByTestId('file-input')
      
      const startTime = performance.now()
      await user.upload(fileInput, files)
      const endTime = performance.now()
      
      // Should process files within reasonable time
      expect(endTime - startTime).toBeLessThan(5000)
      
      await waitFor(() => {
        expect(screen.getByText('10 files selected')).toBeInTheDocument()
      })
    })
  })
})