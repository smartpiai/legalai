/**
 * Tests for UploadInterface component
 * Following TDD approach - tests written first
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadInterface } from './UploadInterface'

// Mock file creation helper
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(['x'.repeat(Math.min(size, 1000))], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

// Mock files for testing
const mockFiles = [
  createMockFile('contract1.pdf', 1024 * 1024, 'application/pdf'),
  createMockFile('agreement.docx', 2 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  createMockFile('terms.pdf', 512 * 1024, 'application/pdf'),
  createMockFile('invalid.exe', 1024, 'application/x-executable'),
  createMockFile('large-file.pdf', 101 * 1024 * 1024, 'application/pdf') // 101MB - over limit
]

describe('UploadInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('should render upload dropzone', () => {
      render(<UploadInterface />)
      
      expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument()
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument()
    })

    it('should show upload button', () => {
      render(<UploadInterface />)
      
      expect(screen.getByText('Select Files')).toBeInTheDocument()
      expect(screen.getByTestId('select-files-button')).toBeInTheDocument()
    })

    it('should show accepted file types', () => {
      render(<UploadInterface />)
      
      expect(screen.getByText(/PDF, Word, Excel/i)).toBeInTheDocument()
    })

    it('should show maximum file size', () => {
      render(<UploadInterface />)
      
      expect(screen.getByText(/Max file size: 100.00 MB/i)).toBeInTheDocument()
    })
  })

  describe('Drag and drop functionality', () => {
    it('should show drag overlay when dragging', () => {
      render(<UploadInterface />)
      
      const dropzone = screen.getByTestId('upload-dropzone')
      
      // Simulate drag enter
      fireEvent.dragEnter(dropzone, {
        dataTransfer: { items: [{ kind: 'file' }] }
      })
      
      expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
      expect(screen.getByText(/Drop files here/i)).toBeInTheDocument()
    })

    it('should handle file drop', async () => {
      const onFilesSelected = vi.fn()
      render(<UploadInterface onFilesSelected={onFilesSelected} />)
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const file = mockFiles[0]
      
      // Simulate drop event with files
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      })
      
      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file])
      })
    })

    it('should handle multiple file drop', async () => {
      const onFilesSelected = vi.fn()
      render(<UploadInterface onFilesSelected={onFilesSelected} />)
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const files = [mockFiles[0], mockFiles[1], mockFiles[2]]
      
      // Simulate drop event with multiple files
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: files
        }
      })
      
      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith(files)
      })
    })
  })

  describe('File selection via button', () => {
    it('should handle file selection from dialog', async () => {
      const onFilesSelected = vi.fn()
      render(<UploadInterface onFilesSelected={onFilesSelected} />)
      
      const fileInput = screen.getByTestId('file-input')
      const file = mockFiles[0]
      
      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })
      
      fireEvent.change(fileInput)
      
      await waitFor(() => {
        expect(onFilesSelected).toHaveBeenCalledWith([file])
      })
    })
  })

  describe('File validation', () => {
    it('should reject invalid file types', async () => {
      const onFilesSelected = vi.fn()
      const onError = vi.fn()
      
      render(
        <UploadInterface 
          onFilesSelected={onFilesSelected}
          onError={onError}
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const invalidFile = mockFiles[3] // .exe file
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [invalidFile]
        }
      })
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('Invalid file type'))
        expect(onFilesSelected).not.toHaveBeenCalled()
      })
    })

    it('should reject files over size limit', async () => {
      const onFilesSelected = vi.fn()
      const onError = vi.fn()
      
      render(
        <UploadInterface 
          onFilesSelected={onFilesSelected}
          onError={onError}
          maxFileSize={100 * 1024 * 1024} // 100MB
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const largeFile = mockFiles[4] // 101MB file
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [largeFile]
        }
      })
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('exceeds maximum size'))
        expect(onFilesSelected).not.toHaveBeenCalled()
      })
    })

    it('should validate accepted file types', () => {
      const { rerender } = render(
        <UploadInterface 
          acceptedFileTypes={['application/pdf']}
        />
      )
      
      expect(screen.getByText(/PDF/i)).toBeInTheDocument()
      expect(screen.queryByText(/Word, Excel/i)).not.toBeInTheDocument()
      
      rerender(
        <UploadInterface 
          acceptedFileTypes={[
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ]}
        />
      )
      
      expect(screen.getByText(/PDF, Word/i)).toBeInTheDocument()
    })
  })

  describe('Upload progress', () => {
    it('should show upload progress for files', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ id: '123', status: 'success' })
      
      render(
        <UploadInterface 
          onUpload={mockUpload}
          showProgress={true}
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const file = mockFiles[0]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('upload-progress-list')).toBeInTheDocument()
        expect(screen.getByText('contract1.pdf')).toBeInTheDocument()
      })
    })

    it('should show upload status icons', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ id: '123', status: 'success' })
      
      render(
        <UploadInterface 
          onUpload={mockUpload}
          showProgress={true}
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const file = mockFiles[0]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      })
      
      // Should show loading initially
      expect(screen.getByTestId('status-uploading-contract1.pdf')).toBeInTheDocument()
      
      // Should show success after upload
      await waitFor(() => {
        expect(screen.getByTestId('status-success-contract1.pdf')).toBeInTheDocument()
      })
    })

    it('should handle upload errors', async () => {
      const mockUpload = vi.fn().mockRejectedValue(new Error('Upload failed'))
      const onError = vi.fn()
      
      render(
        <UploadInterface 
          onUpload={mockUpload}
          onError={onError}
          showProgress={true}
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const file = mockFiles[0]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('status-error-contract1.pdf')).toBeInTheDocument()
        expect(onError).toHaveBeenCalledWith('Upload failed: contract1.pdf')
      })
    })

    it('should allow retry on failed uploads', async () => {
      const mockUpload = vi.fn()
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce({ id: '123', status: 'success' })
      
      render(
        <UploadInterface 
          onUpload={mockUpload}
          showProgress={true}
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const file = mockFiles[0]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      })
      
      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('status-error-contract1.pdf')).toBeInTheDocument()
      })
      
      // Click retry
      const user = userEvent.setup()
      await user.click(screen.getByTestId('retry-contract1.pdf'))
      
      // Should succeed on retry
      await waitFor(() => {
        expect(screen.getByTestId('status-success-contract1.pdf')).toBeInTheDocument()
      })
    })
  })

  describe('File list management', () => {
    it('should display selected files', async () => {
      render(<UploadInterface />)
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const files = [mockFiles[0], mockFiles[1]]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: files
        }
      })
      
      await waitFor(() => {
        expect(screen.getByText('contract1.pdf')).toBeInTheDocument()
        expect(screen.getByText('agreement.docx')).toBeInTheDocument()
        expect(screen.getByText('1.00 MB')).toBeInTheDocument()
        expect(screen.getByText('2.00 MB')).toBeInTheDocument()
      })
    })

    it('should allow removing files from list', async () => {
      const user = userEvent.setup()
      render(<UploadInterface />)
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const file = mockFiles[0]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      })
      
      await waitFor(() => {
        expect(screen.getByText('contract1.pdf')).toBeInTheDocument()
      })
      
      await user.click(screen.getByTestId('remove-contract1.pdf'))
      
      expect(screen.queryByText('contract1.pdf')).not.toBeInTheDocument()
    })

    it('should clear all files when clear button clicked', async () => {
      const user = userEvent.setup()
      render(<UploadInterface />)
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const files = [mockFiles[0], mockFiles[1], mockFiles[2]]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: files
        }
      })
      
      await waitFor(() => {
        expect(screen.getByText('3 files selected')).toBeInTheDocument()
      })
      
      await user.click(screen.getByTestId('clear-all-button'))
      
      expect(screen.queryByText('contract1.pdf')).not.toBeInTheDocument()
      expect(screen.queryByText('agreement.docx')).not.toBeInTheDocument()
      expect(screen.queryByText('terms.pdf')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<UploadInterface />)
      
      expect(screen.getByTestId('upload-dropzone')).toHaveAttribute('aria-label', 'File upload dropzone')
      expect(screen.getByTestId('select-files-button')).toHaveAttribute('aria-label', 'Select files to upload')
    })

    it('should support keyboard navigation', () => {
      render(<UploadInterface />)
      
      const button = screen.getByTestId('select-files-button')
      expect(button).toHaveAttribute('tabIndex', '0')
    })

    it('should announce upload status to screen readers', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ id: '123', status: 'success' })
      
      render(
        <UploadInterface 
          onUpload={mockUpload}
          showProgress={true}
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const file = mockFiles[0]
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file]
        }
      })
      
      await waitFor(() => {
        const status = screen.getByTestId('upload-status-contract1.pdf')
        expect(status).toHaveAttribute('aria-live', 'polite')
      })
    })
  })

  describe('Custom configuration', () => {
    it('should respect maxFiles limit', async () => {
      const onError = vi.fn()
      
      render(
        <UploadInterface 
          maxFiles={2}
          onError={onError}
        />
      )
      
      const dropzone = screen.getByTestId('upload-dropzone')
      const files = [mockFiles[0], mockFiles[1], mockFiles[2]] // 3 files
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: files
        }
      })
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('Maximum 2 files allowed'))
      })
    })

    it('should disable interface when disabled prop is true', () => {
      render(<UploadInterface disabled={true} />)
      
      const button = screen.getByTestId('select-files-button')
      expect(button).toBeDisabled()
      
      const dropzone = screen.getByTestId('upload-dropzone')
      expect(dropzone).toHaveClass('opacity-50', 'cursor-not-allowed')
    })

    it('should show custom empty message', () => {
      render(
        <UploadInterface 
          emptyMessage="Drop your contracts here"
        />
      )
      
      expect(screen.getByText('Drop your contracts here')).toBeInTheDocument()
    })
  })
})